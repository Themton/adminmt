import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createUpdateController, createInputGuard } from '../src/lib/autoUpdate.js'

function controller(options = {}) {
  let reloads = 0, notices = []
  const check = createUpdateController({ currentVersion: 'v1', fetchVersion: async () => 'v2', safeToReload: () => true, reload: () => reloads++, notify: v => notices.push(v), ...options })
  return { check, get reloads() { return reloads }, notices }
}
test('same build never reloads', async () => { const c = controller({fetchVersion: async () => 'v1'}); await c.check(); assert.equal(c.reloads, 0) })
test('new version reloads once', async () => { const c = controller(); await c.check(); await c.check(); assert.equal(c.reloads, 1) })
test('dirty work defers then updates when safe', async () => { let safe = false; const c = controller({safeToReload: () => safe}); await c.check(); assert.equal(c.reloads, 0); assert.deepEqual(c.notices, [true]); safe=true; await c.check(); assert.equal(c.reloads, 1) })
test('offline and invalid manifest do not reload', async () => { const c = controller({fetchVersion: async () => {throw Error('offline')}}); await c.check(); assert.equal(c.reloads, 0); const d = controller({fetchVersion: async () => null}); await d.check(); assert.equal(d.reloads, 0) })
test('concurrent checks do not race', async () => { let resolve; const c=controller({fetchVersion: () => new Promise(r=>resolve=r)}); const first=c.check(); await c.check(); resolve('v2'); await first; assert.equal(c.reloads,1) })
test('CDN stale build has five minute reload cooldown', async () => { let time=1000; let value=JSON.stringify({version:'v2',at:1000}); const c=controller({now:()=>time,storage:{getItem:()=>value,setItem:(k,v)=>value=v}}); await c.check(); assert.equal(c.reloads,0); time+=300001; await c.check(); assert.equal(c.reloads,1) })
test('denied session storage does not break update', async () => { const c=controller({storage:{getItem:()=>{throw Error()},setItem:()=>{throw Error()}}}); await c.check(); assert.equal(c.reloads,1) })
function fixture() {
 let time=0; const listeners=new Map(); const doc={ visibilityState:'visible', addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:k=>listeners.delete(k),querySelector:()=>null,querySelectorAll:()=>[] }
 const guard=createInputGuard(doc,()=>time)
 const input={value:'',type:'text',isConnected:true,matches:()=>true}
 return {doc,guard,input,emit:(k)=>listeners.get(k)?.({target:input}),idle:()=>time+=16000,listeners}
}
test('unfinished order survives update, cleared new order is safe',()=>{const f=fixture();f.emit('focusin');f.input.value='draft';f.emit('input');f.idle();assert.equal(f.guard.safe(),false);f.input.value='';assert.equal(f.guard.safe(),true)})
test('deleting existing field is still an unsaved edit',()=>{const f=fixture();f.input.value='existing';f.emit('focusin');f.input.value='';f.emit('input');f.idle();assert.equal(f.guard.safe(),false)})
test('removed forms no longer block update',()=>{const f=fixture();f.emit('focusin');f.input.value='draft';f.emit('input');f.input.isConnected=false;f.idle();assert.equal(f.guard.safe(),true)})
test('hidden page, active operation and recent interaction defer reload',()=>{const f=fixture();assert.equal(f.guard.safe(),false);f.idle();f.doc.visibilityState='hidden';assert.equal(f.guard.safe(),false);f.doc.visibilityState='visible';f.doc.querySelectorAll=()=>[{textContent:'⏳ กำลังบันทึก...'}];assert.equal(f.guard.safe(),false);f.doc.querySelectorAll=()=>[{textContent:'ก่อนหน้า'}];assert.equal(f.guard.safe(),true);f.emit('pointerdown');assert.equal(f.guard.safe(),false)})
test('focusing untouched field does not make it dirty; dispose removes listeners',()=>{const f=fixture();f.emit('pointerdown');f.emit('focusin');f.idle();assert.equal(f.guard.safe(),true);f.guard.dispose();assert.equal(f.listeners.size,0)})
