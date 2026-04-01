import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { createFlashOrder, trackFlashOrder, pingFlash } from '../lib/flashApi'
import { T, glass, fmt, LiveDot, Toast, Empty, Pagination, Modal } from './ui'
import { exportProshipExcel } from '../lib/exportProship'

export default function PackerApp({ profile, onLogout }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [shipFilter, setShipFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const todayStr = new Date().toISOString().split('T')[0]
  const [dateFilter, setDateFilter] = useState(todayStr)
  const [dateFilterEnd, setDateFilterEnd] = useState(todayStr)
  const [quickFilter, setQuickFilter] = useState('today')
  const [refreshing, setRefreshing] = useState(false)
  const [bulkCreating, setBulkCreating] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 })
  const [flashModal, setFlashModal] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [pnoModal, setPnoModal] = useState(null)
  const [pnoInput, setPnoInput] = useState('')
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 3500) }

  const [flashSrcInfo, setFlashSrcInfo] = useState(() => { try { return JSON.parse(localStorage.getItem('flash_src') || '{}') } catch { return {} } })
  const [flashProxyUrl, setFlashProxyUrl] = useState(() => { try { return localStorage.getItem('flash_proxy_url') || '' } catch { return '' } })
  const saveFlashSrc = (info) => { setFlashSrcInfo(info); try { localStorage.setItem('flash_src', JSON.stringify(info)) } catch {}; setShowSettings(false); flash('OK') }
  const saveProxyUrl = (url) => { setFlashProxyUrl(url); try { localStorage.setItem('flash_proxy_url', url) } catch {} }
  const testConn = async () => { flash('...'); const r = await pingFlash(); flash(r.code === 1 ? 'OK' : 'FAIL') }

  useEffect(() => {
    const load = async () => { setLoading(true); let all=[],from=0; while(true){ const{data}=await supabase.from('mt_orders').select('*').order('created_at',{ascending:false}).range(from,from+999); if(!data||data.length===0)break; all=[...all,...data];from+=1000; if(data.length<1000)break }; setOrders(all);setLoading(false) }
    load()
    const ch = supabase.channel('pk-o').on('postgres_changes',{event:'INSERT',schema:'public',table:'mt_orders'},p=>setOrders(prev=>prev.some(o=>o.id===p.new.id)?prev:[p.new,...prev])).on('postgres_changes',{event:'UPDATE',schema:'public',table:'mt_orders'},p=>setOrders(prev=>prev.map(o=>o.id===p.new.id?p.new:o))).on('postgres_changes',{event:'DELETE',schema:'public',table:'mt_orders'},p=>setOrders(prev=>prev.filter(o=>o.id!==p.old.id))).subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  const SM = { 1:{l:'สร้างออเดอร์',bg:'#EBEDEF',c:'#5D6D7E',i:'📥'},2:{l:'รับพัสดุแล้ว',bg:'#D4E6F1',c:'#2471A3',i:'📦'},3:{l:'ศูนย์คัดแยก',bg:'#D4E6F1',c:'#2471A3',i:'🏭'},4:{l:'กำลังจัดส่ง',bg:'#FDEBD0',c:'#CA6F1E',i:'🛵'},5:{l:'เซ็นรับแล้ว',bg:'#D5F5E3',c:'#1E8449',i:'✅'},6:{l:'ตีกลับ',bg:'#FADBD8',c:'#C0392B',i:'↩️'} }
  const getBadge = (o) => {
    if (!o.flash_pno) return o.shipping_status==='printed'?{l:'พร้อมส่ง',bg:'#D5F5E3',c:'#1E8449',i:'✅'}:{l:'เตรียมส่ง',bg:'#FDEBD0',c:'#CA6F1E',i:'🚚'}
    if (o.flash_status==='cancelled') return {l:'ยกเลิก',bg:'#FADBD8',c:'#C0392B',i:'❌'}
    const n=parseInt((o.flash_status||'').replace('flash_',''))||0
    return (n>0&&SM[n])?SM[n]:{l:'รับเข้าระบบ',bg:'#D4E6F1',c:'#2471A3',i:'📥'}
  }

  const bulkCreateFlash = async (sel) => {
    const noPno=sel.filter(o=>!o.flash_pno); if(!noPno.length){flash('มีเลขพัสดุแล้ว');return}
    if(!confirm('สร้างเลขพัสดุ '+noPno.length+' รายการ?'))return
    setBulkCreating(true);setBulkProgress({done:0,total:noPno.length})
    const results=[]
    for(let i=0;i<noPno.length;i++){
      const o=noPno[i]; flash('สร้าง '+(i+1)+'/'+noPno.length+'...')
      const r=await createFlashOrder(o,flashSrcInfo)
      if(r.code===1&&r.data?.pno){ await supabase.from('mt_orders').update({flash_pno:r.data.pno,flash_status:'created',shipping_status:'printed',flash_sort_code:r.data.sortCode||''}).eq('id',o.id); setOrders(prev=>prev.map(x=>x.id===o.id?{...x,flash_pno:r.data.pno,flash_status:'created',shipping_status:'printed',flash_sort_code:r.data.sortCode||''}:x)); results.push({name:o.customer_name,pno:r.data.pno,ok:true}) }
      else { results.push({name:o.customer_name,error:r.message||'fail',ok:false,debug:r._debug}) }
      setBulkProgress({done:i+1,total:noPno.length})
      if(i<noPno.length-1) await new Promise(r=>setTimeout(r,300))
    }
    setBulkCreating(false);setSelectedIds(new Set())
    flash('สำเร็จ '+results.filter(r=>r.ok).length+'/'+results.length)
    setFlashModal({bulkResults:results})
  }

  const trackFlash = async (pno) => { flash('...'); const r=await trackFlashOrder(pno); if(r.code===1&&r.data){setFlashModal({pno,trackState:r.data.state,trackStateText:r.data.stateText||'',tracking:Array.isArray(r.data.routes)?r.data.routes:[]})} else flash(r.message||'error') }

  const savePno = async () => { if(!pnoModal)return; const v=pnoInput.trim(); await supabase.from('mt_orders').update({flash_pno:v,flash_status:v?'manual':''}).eq('id',pnoModal.orderId); setOrders(prev=>prev.map(o=>o.id===pnoModal.orderId?{...o,flash_pno:v,flash_status:v?'manual':''}:o)); setPnoModal(null);flash('OK') }

  const cancelFlash = async (o) => { if(!confirm('ยกเลิก '+o.flash_pno+'?\nต้องยกเลิกใน Flash portal ด้วย'))return; await supabase.from('mt_orders').update({flash_pno:'',flash_status:'cancelled',flash_sort_code:'',shipping_status:'waiting'}).eq('id',o.id); setOrders(prev=>prev.map(x=>x.id===o.id?{...x,flash_pno:'',flash_status:'cancelled',flash_sort_code:'',shipping_status:'waiting'}:x)); flash('ลบแล้ว') }

  const refreshStatus = async () => {
    const wp=dateFiltered.filter(o=>o.flash_pno&&o.flash_status!=='cancelled'); if(!wp.length){flash('ไม่มี');return}
    setRefreshing(true); let u=0
    for(let i=0;i<wp.length;i++){ if(i%5===0)flash('อัพเดท '+(i+1)+'/'+wp.length); const r=await trackFlashOrder(wp[i].flash_pno); if(r.code===1&&r.data){const ns='flash_'+(r.data.state||0);await supabase.from('mt_orders').update({flash_status:ns}).eq('id',wp[i].id);setOrders(prev=>prev.map(o=>o.id===wp[i].id?{...o,flash_status:ns}:o));u++}; if(i<wp.length-1)await new Promise(r=>setTimeout(r,150)) }
    setRefreshing(false);flash('อัพเดท '+u+' รายการ')
  }

  const labelHTML = (order, idx, total) => {
    const pno=order.flash_pno||'',phone=order.customer_phone||'',mp=phone.length>=7?phone.substring(0,3)+'****'+phone.substring(phone.length-3):phone
    const cod=order.payment_type==='cod'?(parseFloat(order.cod_amount||order.sale_price)||0):0
    const now=new Date().toLocaleString('th-TH',{timeZone:'Asia/Bangkok',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})
    const dst=(order.district||'')+' — '+(order.province||'')
    const src=(flashSrcInfo.name||'THE MT')+' '+(flashSrcInfo.phone||'')+' '+(flashSrcInfo.address||'')+' '+(flashSrcInfo.district||'')+' '+(flashSrcInfo.province||'')+' '+(flashSrcInfo.zip||'')
    return '<div style="width:400px;height:300px;background:#fff;font-family:sans-serif;overflow:hidden">'
      +(order.flash_sort_code?'<div style="text-align:center;padding:2px 0;font-size:20px;font-weight:900;font-family:monospace;border-bottom:2px solid #000;position:relative"><span style="position:absolute;left:4px;top:3px;background:#E67E22;color:#fff;width:20px;height:20px;border-radius:3px;display:inline-flex;align-items:center;justify-content:center;font-size:12px">'+idx+'</span>'+order.flash_sort_code+'</div>':'')
      +'<div style="text-align:center;padding:1px 8px;border-bottom:2px solid #000"><svg id="lbc-'+idx+'" style="width:384px;height:40px"></svg></div>'
      +'<div style="text-align:center;padding:2px;font-size:13px;font-weight:900;font-family:monospace;letter-spacing:1px;background:#f0f0f0;border-bottom:2px solid #000">'+pno+'</div>'
      +'<div style="background:#444;color:#fff;padding:2px 8px;font-size:10px;font-weight:700">DST &nbsp; '+dst+'</div>'
      +'<div style="padding:1px 8px;font-size:7px;color:#777;border-bottom:1px solid #ddd;overflow:hidden;white-space:nowrap">'+src.trim()+'</div>'
      +'<div style="display:flex"><div style="flex:1;padding:3px 8px"><div style="font-weight:700;font-size:12px">\u0e1c\u0e39\u0e49\u0e23\u0e31\u0e1a '+(order.customer_name||'')+'</div><div style="font-size:18px;font-weight:900;letter-spacing:1px">'+mp+'</div><div style="font-size:9px;color:#333;line-height:1.3">'+(order.customer_address||'')+'</div><div style="font-size:9px;color:#333">'+(order.sub_district||'')+', '+(order.district||'')+'</div><div style="font-size:9px;color:#333">'+(order.province||'')+' '+(order.zip_code||'')+'</div></div><div id="lqr-'+idx+'" style="width:70px;display:flex;align-items:center;justify-content:center;padding:2px"></div></div>'
      +(cod>0?'<div style="background:#1a1a1a;color:#fff;padding:3px 8px;font-size:15px;font-weight:900;display:flex;align-items:center;gap:6px"><span style="background:#E67E22;padding:1px 6px;border-radius:3px;font-size:10px">COD</span>\u0e40\u0e01\u0e47\u0e1a\u0e40\u0e07\u0e34\u0e19\u0e04\u0e48\u0e32\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32 COD '+cod.toLocaleString()+'</div>':'')
      +(order.remark?'<div style="padding:2px 8px;font-size:11px;font-weight:700;border-top:1px solid #ddd;overflow:hidden;white-space:nowrap">Note: '+order.remark+'</div>':'')
      +'<div style="padding:1px 8px;font-size:7px;color:#999;display:flex;justify-content:space-between;border-top:1px solid #eee"><span>Print-: '+now+'</span><span>'+idx+'/'+total+'</span><span>THE MT</span></div></div>'
  }

  const buildLabelPDF = async (lo) => {
    const ls=(u)=>new Promise(r=>{if(document.querySelector('script[src="'+u+'"]')){r();return};const s=document.createElement('script');s.src=u;s.onload=r;document.head.appendChild(s)})
    await ls('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js')
    await ls('https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js')
    await ls('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js')
    await ls('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js')
    const ct=document.createElement('div');ct.style.cssText='position:fixed;top:-9999px;left:-9999px';document.body.appendChild(ct)
    const{jsPDF}=window.jspdf;const doc=new jsPDF({orientation:'landscape',unit:'mm',format:[75,100]})
    for(let i=0;i<lo.length;i++){
      flash('สร้างใบปะหน้า '+(i+1)+'/'+lo.length+'...')
      if(i>0)doc.addPage([75,100],'landscape')
      const d=document.createElement('div');d.innerHTML=labelHTML(lo[i],i+1,lo.length);ct.appendChild(d)
      const pno=lo[i].flash_pno||''
      try{JsBarcode('#lbc-'+(i+1),pno,{format:'CODE128',width:1.8,height:34,displayValue:false,margin:0})}catch(e){}
      try{new QRCode(document.getElementById('lqr-'+(i+1)),{text:pno,width:58,height:58,correctLevel:QRCode.CorrectLevel.M})}catch(e){}
      await new Promise(r=>setTimeout(r,200))
      const cv=await html2canvas(d.firstChild,{scale:3,backgroundColor:'#fff',useCORS:true})
      doc.addImage(cv.toDataURL('image/png'),'PNG',0,0,100,75);ct.removeChild(d)
    }
    document.body.removeChild(ct);window.open(URL.createObjectURL(doc.output('blob')),'_blank')
    flash('สร้างใบปะหน้า '+lo.length+' รายการ')
  }
  const printLabels = async (t) => { const w=t.filter(o=>o.flash_pno); if(!w.length){flash('ไม่มีเลขพัสดุ');return}; await buildLabelPDF(w) }

  const dateFiltered = orders.filter(o => { if(dateFilter){const od=(o.order_date||'').substring(0,10);if(od<dateFilter)return false}; if(dateFilterEnd){const od=(o.order_date||'').substring(0,10);if(od>dateFilterEnd)return false}; return true })
  const shipOrders = dateFiltered.filter(o => {
    if(shipFilter==='preparing')return(!o.shipping_status||o.shipping_status==='waiting')&&!o.flash_pno
    if(shipFilter==='printed')return o.shipping_status==='printed'&&!o.flash_pno
    if(shipFilter==='insystem')return o.flash_pno&&['created','manual','flash_1'].includes(o.flash_status)
    if(shipFilter==='pickedup')return['flash_2','flash_3'].includes(o.flash_status)
    if(shipFilter==='delivering')return o.flash_status==='flash_4'
    if(shipFilter==='delivered')return o.flash_status==='flash_5'
    if(shipFilter==='returned')return o.flash_status==='flash_6'||o.flash_status==='cancelled'
    return true
  }).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))
  const searchFiltered = shipOrders.filter(o => { if(!searchQuery)return true; const q=searchQuery.toLowerCase(); return(o.customer_name||'').toLowerCase().includes(q)||(o.customer_phone||'').includes(q)||(o.flash_pno||'').includes(q)||(o.remark||'').toLowerCase().includes(q) })
  const markStatus = async (ids,st) => { await supabase.from('mt_orders').update({shipping_status:st}).in('id',ids); setOrders(prev=>prev.map(o=>ids.includes(o.id)?{...o,shipping_status:st}:o)); flash('OK '+ids.length); setSelectedIds(new Set()) }
  const lastRef=useRef(null)
  const toggleSelect=(id,e)=>{const list=searchFiltered.slice((page-1)*pageSize,page*pageSize);const idx=list.findIndex(o=>o.id===id);if(e?.shiftKey&&lastRef.current!==null){const s=Math.min(lastRef.current,idx),en=Math.max(lastRef.current,idx);setSelectedIds(prev=>{const n=new Set(prev);for(let i=s;i<=en;i++)n.add(list[i].id);return n})}else{setSelectedIds(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n})};lastRef.current=idx}
  const toggleAll=()=>{const p=searchFiltered.slice((page-1)*pageSize,page*pageSize).map(o=>o.id);const a=p.length>0&&p.every(id=>selectedIds.has(id));setSelectedIds(prev=>{const n=new Set(prev);p.forEach(id=>a?n.delete(id):n.add(id));return n})}
  const C={all:dateFiltered.length,preparing:dateFiltered.filter(o=>(!o.shipping_status||o.shipping_status==='waiting')&&!o.flash_pno).length,printed:dateFiltered.filter(o=>o.shipping_status==='printed'&&!o.flash_pno).length,insystem:dateFiltered.filter(o=>o.flash_pno&&['created','manual','flash_1'].includes(o.flash_status)).length,pickedup:dateFiltered.filter(o=>['flash_2','flash_3'].includes(o.flash_status)).length,delivering:dateFiltered.filter(o=>o.flash_status==='flash_4').length,delivered:dateFiltered.filter(o=>o.flash_status==='flash_5').length,returned:dateFiltered.filter(o=>o.flash_status==='flash_6'||o.flash_status==='cancelled').length}

  return (
    <div style={{fontFamily:T.font,minHeight:'100vh',background:'#F4F6F7',color:T.text,paddingBottom:40}}>
      <Toast message={toast} />
      <Modal show={!!flashModal} onClose={()=>setFlashModal(null)} title="Flash Express">
        {flashModal&&<>{flashModal.bulkResults&&<div><div style={{fontWeight:700,marginBottom:10,fontSize:14}}>ผลสร้างเลขพัสดุ ({flashModal.bulkResults.filter(r=>r.ok).length}/{flashModal.bulkResults.length})</div><div style={{maxHeight:400,overflowY:'auto'}}>{flashModal.bulkResults.map((r,i)=>(<div key={i} style={{display:'flex',gap:8,alignItems:'center',padding:'8px 10px',marginBottom:4,borderRadius:6,background:r.ok?'rgba(45,138,78,0.05)':'rgba(214,48,49,0.05)',border:'1px solid '+(r.ok?'rgba(45,138,78,0.15)':'rgba(214,48,49,0.15)')}}><span>{r.ok?'OK':'FAIL'}</span><span style={{fontSize:12,fontWeight:600,flex:1}}>{r.name}</span>{r.pno&&<span style={{fontFamily:'monospace',fontSize:11,color:'#2980B9',fontWeight:700}}>{r.pno}</span>}{r.error&&<span style={{fontSize:11,color:'#E74C3C'}}>{r.error}</span>}{r.debug&&<details style={{width:'100%',marginTop:4}}><summary style={{fontSize:10,color:'#999',cursor:'pointer'}}>debug</summary><pre style={{fontSize:9,whiteSpace:'pre-wrap',wordBreak:'break-all'}}>{JSON.stringify(r.debug,null,2)}</pre></details>}</div>))}</div>{(()=>{const p=flashModal.bulkResults.filter(r=>r.ok&&r.pno);return p.length>0&&<button onClick={()=>printLabels(orders.filter(o=>p.some(x=>x.pno===o.flash_pno)))} style={{width:'100%',marginTop:12,padding:'12px',borderRadius:8,border:'none',background:'#E67E22',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>ปริ้นใบปะหน้า ({p.length})</button>})()}</div>}
        {flashModal.pno&&flashModal.trackState&&<div><div style={{textAlign:'center',marginBottom:12}}><span style={{fontFamily:'monospace',fontSize:16,fontWeight:900}}>{flashModal.pno}</span></div><div style={{textAlign:'center',padding:12,borderRadius:8,background:(SM[flashModal.trackState]||{}).bg||'#f0f0f0',marginBottom:12}}><div style={{fontSize:20,marginBottom:4}}>{(SM[flashModal.trackState]||{}).i||'📦'}</div><div style={{fontWeight:700,color:(SM[flashModal.trackState]||{}).c||'#333'}}>{flashModal.trackStateText||(SM[flashModal.trackState]||{}).l||'?'}</div></div>{flashModal.tracking?.length>0&&<div style={{maxHeight:300,overflowY:'auto'}}>{flashModal.tracking.map((r,i)=>(<div key={i} style={{display:'flex',gap:8,padding:'6px 0',borderBottom:'1px solid #eee',fontSize:11}}><span style={{color:'#999',minWidth:100}}>{r.dateTime||r.datetime||''}</span><span>{r.message||r.routeDesc||''}</span></div>))}</div>}</div>}
        {flashModal.error&&<div style={{padding:12,background:'#FDEDEC',borderRadius:8,color:'#C0392B',fontSize:12}}>{flashModal.error}</div>}
        </>}
      </Modal>
      <Modal show={!!pnoModal} onClose={()=>setPnoModal(null)} title="แก้ไขเลขพัสดุ">{pnoModal&&<div><div style={{marginBottom:8,fontSize:12,color:'#85929E'}}>{pnoModal.customerName}</div><input value={pnoInput} onChange={e=>setPnoInput(e.target.value)} placeholder="เลขพัสดุ..." style={{width:'100%',padding:'10px 12px',borderRadius:6,border:'1px solid #ddd',fontSize:14,fontFamily:'monospace',marginBottom:10}} /><div style={{display:'flex',gap:8}}><button onClick={savePno} style={{flex:1,padding:10,borderRadius:6,border:'none',background:'#3498DB',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>บันทึก</button><button onClick={()=>{setPnoInput('');savePno()}} style={{padding:'10px 14px',borderRadius:6,border:'1px solid #E74C3C',background:'#FDEDEC',color:'#E74C3C',fontSize:13,fontWeight:700,cursor:'pointer'}}>ลบ</button></div></div>}</Modal>
      <Modal show={showSettings} onClose={()=>setShowSettings(false)} title="ตั้งค่า Flash">
        <div style={{marginBottom:14,padding:10,borderRadius:6,background:'rgba(255,107,0,0.04)',border:'1px solid rgba(255,107,0,0.15)'}}>
          <div style={{fontSize:11,fontWeight:700,marginBottom:6}}>Flash Proxy URL</div>
          <input value={flashProxyUrl} onChange={e=>saveProxyUrl(e.target.value)} placeholder="https://flash2-proxy.xxx.workers.dev" style={{width:'100%',padding:8,borderRadius:4,border:'1px solid #ddd',fontSize:12,fontFamily:'monospace',marginBottom:6}} />
          <button onClick={testConn} style={{padding:'6px 14px',borderRadius:4,border:'none',background:'#E67E22',color:'#fff',fontSize:11,fontWeight:700,cursor:'pointer'}}>ทดสอบ</button>
        </div>
        <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>ข้อมูลผู้ส่ง</div>
        {(()=>{const[f,setF]=useState({name:flashSrcInfo.name||'',phone:flashSrcInfo.phone||'',address:flashSrcInfo.address||'',district:flashSrcInfo.district||'',province:flashSrcInfo.province||'',zip:flashSrcInfo.zip||''});const I=(l,k)=><div style={{marginBottom:6}}><div style={{fontSize:10,color:'#999',marginBottom:2}}>{l}</div><input value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})} style={{width:'100%',padding:'6px 8px',borderRadius:4,border:'1px solid #ddd',fontSize:12}} /></div>;return<div>{I('ชื่อร้าน','name')}{I('เบอร์โทร','phone')}{I('ที่อยู่','address')}{I('อำเภอ','district')}{I('จังหวัด','province')}{I('รหัสไปรษณีย์','zip')}<button onClick={()=>saveFlashSrc(f)} style={{width:'100%',padding:10,borderRadius:6,border:'none',background:'#27AE60',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',marginTop:6}}>บันทึก</button></div>})()}
      </Modal>

      <div style={{background:'#fff',padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,zIndex:100,borderBottom:'1px solid #DEE2E6',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
        <div><div style={{display:'flex',alignItems:'center',gap:10}}><img src="./logo.png" alt="" style={{height:32}} /><span style={{fontSize:18,fontWeight:900}}>ADMIN THE MT</span><LiveDot /></div><div style={{fontSize:11,color:'#85929E'}}>{profile.full_name} — 🚚 จัดการขนส่ง</div></div>
        <div style={{display:'flex',gap:8}}><button onClick={()=>setShowSettings(true)} style={{padding:'8px 14px',borderRadius:6,border:'1px solid #E67E22',background:'#FEF5E7',color:'#E67E22',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>⚙️ Flash</button><button onClick={onLogout} style={{padding:'8px 14px',borderRadius:6,border:'1px solid #DEE2E6',background:'transparent',color:'#85929E',fontSize:12,cursor:'pointer',fontFamily:T.font}}>ออก</button></div>
      </div>

      <div style={{maxWidth:1600,margin:'0 auto',padding:'16px 20px'}}>
        <div style={{fontSize:20,fontWeight:800,marginBottom:14}}>🚚 ระบบจัดการขนส่ง Flash Express</div>

        <div style={{display:'flex',gap:6,marginBottom:12,alignItems:'center',flexWrap:'wrap'}}>
          <input type="date" value={dateFilter} onChange={e=>{setDateFilter(e.target.value);if(!dateFilterEnd||e.target.value>dateFilterEnd)setDateFilterEnd(e.target.value);setQuickFilter('');setPage(1)}} style={{padding:'7px 10px',borderRadius:6,background:'#fff',border:'1px solid #DEE2E6',fontSize:12,fontFamily:T.font}} />
          <span style={{color:'#ABB2B9'}}>—</span>
          <input type="date" value={dateFilterEnd} onChange={e=>{setDateFilterEnd(e.target.value);setQuickFilter('');setPage(1)}} style={{padding:'7px 10px',borderRadius:6,background:'#fff',border:'1px solid #DEE2E6',fontSize:12,fontFamily:T.font}} />
          {[{id:'today',label:'วันนี้',fn:()=>{setDateFilter(todayStr);setDateFilterEnd(todayStr)}},{id:'7days',label:'7 วัน',fn:()=>{const d=new Date();d.setDate(d.getDate()-6);setDateFilter(d.toISOString().split('T')[0]);setDateFilterEnd(todayStr)}},{id:'month',label:'เดือนนี้',fn:()=>{setDateFilter(new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0')+'-01');setDateFilterEnd(todayStr)}}].map(b=><button key={b.id} onClick={()=>{b.fn();setQuickFilter(b.id);setPage(1)}} style={{padding:'7px 14px',borderRadius:6,border:quickFilter===b.id?'none':'1px solid #DEE2E6',background:quickFilter===b.id?'#E67E22':'#fff',color:quickFilter===b.id?'#fff':'#85929E',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>{b.label}</button>)}
          <div style={{flex:1}} />
          <input placeholder="ค้นหา ชื่อ เบอร์ เลขพัสดุ..." value={searchQuery} onChange={e=>{setSearchQuery(e.target.value);setPage(1)}} style={{padding:'7px 12px',borderRadius:6,border:'1px solid #DEE2E6',fontSize:12,fontFamily:T.font,width:220}} />
          <button onClick={refreshStatus} disabled={refreshing} style={{padding:'7px 14px',borderRadius:6,border:'1px solid #3498DB',background:'#EBF5FB',color:'#3498DB',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>{refreshing?'⏳...':'🔄 อัพเดทสถานะ'}</button>
        </div>

        <div style={{display:'flex',gap:0,borderBottom:'2px solid #EAECEE',marginBottom:12,overflowX:'auto'}}>
          {[{id:'all',i:'📦',l:'ทั้งหมด',c:'#2980B9'},{id:'preparing',i:'🚚',l:'เตรียมส่ง',c:'#E67E22'},{id:'printed',i:'🖨',l:'ปริ้นแล้ว',c:'#16A085'},{id:'insystem',i:'📥',l:'รับเข้าระบบ',c:'#5D6D7E'},{id:'pickedup',i:'📦',l:'รับพัสดุแล้ว',c:'#2471A3'},{id:'delivering',i:'🛵',l:'กำลังจัดส่ง',c:'#CA6F1E'},{id:'delivered',i:'✅',l:'เซ็นรับแล้ว',c:'#1E8449'},{id:'returned',i:'↩️',l:'ตีกลับ',c:'#C0392B'}].map(f=>(<button key={f.id} onClick={()=>{setShipFilter(f.id);setPage(1)}} style={{padding:'8px 12px',border:'none',cursor:'pointer',fontFamily:T.font,fontSize:11,fontWeight:500,background:'transparent',color:shipFilter===f.id?f.c:'#85929E',borderBottom:shipFilter===f.id?'3px solid '+f.c:'3px solid transparent',marginBottom:-2,whiteSpace:'nowrap'}}>{f.i} {f.l} <strong style={{marginLeft:2}}>{C[f.id]}</strong></button>))}
        </div>

        {selectedIds.size>0&&<div style={{display:'flex',gap:6,marginBottom:10,padding:'10px 14px',background:'#EBF5FB',borderRadius:8,alignItems:'center',flexWrap:'wrap'}}>
          <span style={{fontSize:12,fontWeight:700,color:'#2980B9'}}>✔ เลือก {selectedIds.size}</span>
          <button onClick={()=>markStatus([...selectedIds],'waiting')} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #E67E22',background:'#FEF5E7',color:'#E67E22',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>🚚 เตรียมส่ง</button>
          <button onClick={()=>markStatus([...selectedIds],'printed')} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #27AE60',background:'#EAFAF1',color:'#27AE60',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>🖨 ปริ้นแล้ว</button>
          <button onClick={()=>bulkCreateFlash(orders.filter(o=>selectedIds.has(o.id)))} disabled={bulkCreating} style={{padding:'6px 14px',borderRadius:6,border:'none',background:bulkCreating?'#BDC3C7':'#E67E22',color:'#fff',fontSize:11,fontWeight:700,cursor:bulkCreating?'wait':'pointer',fontFamily:T.font}}>{bulkCreating?'⏳ '+bulkProgress.done+'/'+bulkProgress.total:'⚡ สร้างเลขพัสดุ ('+selectedIds.size+')'}</button>
          <button onClick={()=>printLabels(orders.filter(o=>selectedIds.has(o.id)))} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #E67E22',background:'#FEF5E7',color:'#E67E22',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>🖨 ปริ้นใบปะหน้า</button>
          <button onClick={()=>{exportProshipExcel(orders.filter(o=>selectedIds.has(o.id)),'Selected.xlsx',profile,'shipping');flash('Export OK')}} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #2980B9',background:'#EBF5FB',color:'#2980B9',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>📊 Export</button>
          <button onClick={()=>setSelectedIds(new Set())} style={{padding:'6px 8px',borderRadius:6,border:'1px solid #DEE2E6',background:'#fff',color:'#85929E',fontSize:11,cursor:'pointer'}}>✕</button>
        </div>}

        <div style={{background:'#fff',borderRadius:8,border:'1px solid #DEE2E6',overflow:'hidden'}}><div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,fontFamily:T.font,minWidth:1100}}>
            <thead><tr style={{background:'#F8F9FA'}}>
              <th style={{padding:'10px 6px',textAlign:'center',borderBottom:'1px solid #DEE2E6',width:36}}><input type="checkbox" checked={(()=>{const p=searchFiltered.slice((page-1)*pageSize,page*pageSize).map(o=>o.id);return p.length>0&&p.every(id=>selectedIds.has(id))})() } onChange={toggleAll} style={{cursor:'pointer'}} /></th>
              {['#','วันที่','เวลา','ลูกค้า','เบอร์','สถานะ','ขนส่ง','หมายเลขติดตาม','COD','หมายเหตุ','จัดการ'].map(h=><th key={h} style={{padding:'10px 6px',textAlign:'left',fontWeight:600,color:'#5D6D7E',borderBottom:'1px solid #DEE2E6',fontSize:11}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {searchFiltered.slice((page-1)*pageSize,page*pageSize).map((o,i)=>{const dt=new Date(o.created_at);const b=getBadge(o);const hp=!!o.flash_pno;return(
                <tr key={o.id} style={{borderBottom:'1px solid #EAECEE',background:selectedIds.has(o.id)?'#EBF5FB':'#fff'}}>
                  <td style={{padding:'8px 6px',textAlign:'center'}}><input type="checkbox" checked={selectedIds.has(o.id)} onClick={e=>toggleSelect(o.id,e)} readOnly style={{cursor:'pointer'}} /></td>
                  <td style={{padding:'8px 6px',textAlign:'center',color:'#ABB2B9',fontSize:10}}>{(page-1)*pageSize+i+1}</td>
                  <td style={{padding:'8px 6px',fontSize:11}}>{dt.toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'2-digit',month:'short',year:'numeric'})}</td>
                  <td style={{padding:'8px 6px',fontSize:11,color:'#85929E'}}>{dt.toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'})}</td>
                  <td style={{padding:'8px 6px',fontWeight:600}}>{o.customer_name}</td>
                  <td style={{padding:'8px 6px',color:'#85929E',fontSize:11}}>{o.customer_phone}</td>
                  <td style={{padding:'8px 6px'}}><span style={{padding:'3px 8px',borderRadius:6,fontSize:10,fontWeight:700,background:b.bg,color:b.c}}>{b.i} {b.l}</span></td>
                  <td style={{padding:'8px 6px',fontSize:11}}>{hp?'flash':'—'}</td>
                  <td style={{padding:'8px 6px'}}>{hp?<div style={{display:'flex',alignItems:'center',gap:4}}><span style={{fontFamily:'monospace',fontSize:11,color:'#2980B9',fontWeight:700}}>{o.flash_pno}</span><button onClick={()=>{setPnoModal({orderId:o.id,pno:o.flash_pno,customerName:o.customer_name});setPnoInput(o.flash_pno||'')}} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,padding:0,opacity:0.5}} title="แก้ไข">✏️</button></div>:<span style={{color:'#CCD1D1',fontSize:10}}>—</span>}</td>
                  <td style={{padding:'8px 6px',textAlign:'right',fontWeight:700}}>{o.payment_type==='cod'?<span style={{color:'#E74C3C'}}>฿{fmt(parseFloat(o.cod_amount||o.sale_price)||0)}</span>:<span style={{color:'#27AE60',fontSize:10}}>โอน</span>}</td>
                  <td style={{padding:'8px 6px',fontSize:10,color:'#85929E',maxWidth:120,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{o.remark||''}</td>
                  <td style={{padding:'8px 6px'}}><div style={{display:'flex',gap:4}}>
                    {hp&&<button onClick={()=>trackFlash(o.flash_pno)} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,padding:0}} title="ดูสถานะ">👁</button>}
                    {hp&&<button onClick={()=>printLabels([o])} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,padding:0}} title="ปริ้นใบปะหน้า">🖨</button>}
                    {hp&&<button onClick={()=>cancelFlash(o)} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,padding:0,opacity:0.5}} title="ยกเลิก">❌</button>}
                    {!hp&&<button onClick={async()=>{if(!confirm('สร้างเลขพัสดุ?\n'+o.customer_name))return;flash('...');const r=await createFlashOrder(o,flashSrcInfo);if(r.code===1&&r.data?.pno){await supabase.from('mt_orders').update({flash_pno:r.data.pno,flash_status:'created',flash_sort_code:r.data.sortCode||''}).eq('id',o.id);setOrders(prev=>prev.map(x=>x.id===o.id?{...x,flash_pno:r.data.pno,flash_status:'created',flash_sort_code:r.data.sortCode||''}:x));flash('OK '+r.data.pno)}else{flash(r.message||'Error')}}} style={{padding:'4px 8px',borderRadius:4,border:'none',background:'#E67E22',color:'#fff',fontSize:10,fontWeight:700,cursor:'pointer'}}>⚡</button>}
                  </div></td>
                </tr>)})}
            </tbody>
          </table>
          {searchFiltered.length===0&&!loading&&<Empty text="ไม่มีออเดอร์" />}
          {loading&&<div style={{textAlign:'center',padding:40,color:'#85929E'}}>⏳ กำลังโหลด...</div>}
        </div></div>
        <Pagination total={searchFiltered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>
    </div>
  )
}
