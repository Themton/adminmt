import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { createFlashOrder, trackFlashOrder, pingFlash } from '../lib/flashApi'
import { T, fmt, LiveDot, Toast, Empty, Pagination, Modal } from './ui'
import { exportProshipExcel } from '../lib/exportProship'

let _addrCache = null
async function getAddresses() { if (_addrCache) return _addrCache; const mod = await import('../data/addresses.json'); _addrCache = mod.default; return _addrCache }

function parseSmartPaste(text, ad = []) {
  const r = {}, lines = text.split('\n').map(s=>s.trim()).filter(Boolean)
  const fl = lines.map(l=>l.replace(/อ\.เภอ/g,'อำเภอ').replace(/=/g,' '))
  const all = fl.join(' ')
  const cleaned = all.replace(/(\d)\s*[-–—]\s*(\d)/g,'$1$2')
  const pm = cleaned.match(/(?<!\d)(0[689]\d{8})(?!\d)/); if(pm) r.customerPhone=pm[1]
  const zc = all.match(/[1-9]\d{4}/g)||[]; for(const z of zc){ if(r.customerPhone&&r.customerPhone.includes(z))continue; if(parseInt(z)>=10000&&parseInt(z)<=96000){r.zipCode=z;break} }
  const am = all.match(/(?:COD|ปลายทาง)\s*(\d+)/i); if(am) r.amount=am[1]
  for(const l of fl){const m=l.match(/^(?:FB|Facebook)[:\s]+(.+)/i);if(m)r.customerSocial=m[1].trim();const m2=l.match(/^(?:Line|ไลน์)[:\s]+(.+)/i);if(m2)r.customerSocial=m2[1].trim()}
  for(const l of fl){const m=l.match(/^@\s*(.+)/i);if(m){r.remark=m[1].trim();break}}
  const td=all.match(/(?:^|\s)(?:ต\.|ตำบล|แขวง)\s*([ก-๙ะ-์]+?)(?=\s|อ\.|อำเภอ|เขต|จ\.|จังหวัด|\d|$)/u);if(td)r.subDistrict=td[1]
  const dt=all.match(/(?:^|\s)(?:อ\.|อำเภอ|เขต)\s*([ก-๙ะ-์]+?)(?=\s|จ\.|จังหวัด|กรุงเทพ|\d|$)/u);if(dt)r.district=dt[1]
  const pv=all.match(/(?:^|\s)(?:จ\.|จังหวัด)\s*([ก-๙ะ-์]+?)(?=\s|\d|$)/u);if(pv)r.province=pv[1]
  if(!r.subDistrict){for(const l of fl){const m=l.match(/^แขวง\s*(.+)/);if(m){r.subDistrict=m[1].trim();break}}}
  if(!r.district){for(const l of fl){const m=l.match(/^เขต\s*(.+)/);if(m){r.district=m[1].trim();break}}}
  if(!r.province){const pn=['กรุงเทพ','กรุงเทพมหานคร','กทม','นนทบุรี','ปทุมธานี','สมุทรปราการ','สมุทรสาคร','นครปฐม','เชียงใหม่','เชียงราย','ภูเก็ต','ขอนแก่น','อุดรธานี','นครราชสีมา','สงขลา','สุราษฎร์ธานี','อุบลราชธานี','ชลบุรี','พิษณุโลก','ระยอง','นครศรีธรรมราช'];for(const l of fl){if(pn.some(p=>l.includes(p))){r.province=l.replace(/จ\.|จังหวัด/g,'').trim();break}}}
  if(ad.length>0){
    if(r.zipCode&&!r.subDistrict){const m=ad.filter(a=>a.z===r.zipCode);if(m.length>0){const b=m.find(a=>all.includes(a.s))||m[0];r.subDistrict=b.s;r.district=b.d;r.province=b.p}}
    if(!r.zipCode&&r.subDistrict){const f=ad.find(a=>a.s===r.subDistrict&&(r.district?a.d.includes(r.district):true));if(f){r.zipCode=f.z;if(!r.district)r.district=f.d;if(!r.province)r.province=f.p}}
    if(r.zipCode&&!r.province){const m=ad.find(a=>a.z===r.zipCode);if(m)r.province=m.p}
    if(r.zipCode){const zm=ad.filter(a=>a.z===r.zipCode);if(zm.length>0){const ex=zm.find(a=>a.s===r.subDistrict);if(ex){r.district=ex.d;r.province=ex.p}else{const b=zm.find(a=>all.includes(a.s))||zm[0];r.subDistrict=b.s;r.district=b.d;r.province=b.p}}}
  }
  const skip=/\d{3,}|ม\.\d|ต\.|ตำบล|แขวง|อำเภอ|เขต|จ\.|จังหวัด|^COD|^FB|^P:|^R\d|^@|^Line|หมู่|ซอย|ถนน|บ้านเลขที่|^โทร|กรุงเทพ/i
  for(const l of fl){const m=l.match(/^ชื่อ[.\s:]+(.+)/i);if(m){r.customerName=m[1].trim().replace(/-/g,' ');break}}
  if(!r.customerName){for(const l of fl){if(/^@|^FB|^P:|^R\d|^Line|^COD|^โทร|^ชื่อ/i.test(l))continue;const c=l.replace(/-/g,' ').trim();if(c.length>=3&&c.length<=60&&!skip.test(c)&&!/\d{5}/.test(c)&&(/[ก-๙]/.test(c)||/^[A-Za-z\s'.]+$/.test(c))){r.customerName=c;break}}}
  if(!r.customerAddress){const ap=[];let pn=false;for(const l of fl){if(/^@|^FB|^P:|^R\d|^Line|^COD|^โทร|^ชื่อ/i.test(l))continue;if(l.replace(/-/g,' ').trim()===r.customerName){pn=true;continue};if(/^(?:ต\.|ตำบล|แขวง|อ\.|อำเภอ|เขต|จ\.|จังหวัด|กรุงเทพ)/i.test(l))break;if(/^\d{5}/.test(l))break;if(pn&&l.length>=3){let a=l;if(r.subDistrict)a=a.replace(new RegExp('(?:ต\\.|ตำบล|แขวง)\\s*'+r.subDistrict,'g'),'');if(r.district)a=a.replace(new RegExp('(?:อ\\.|อำเภอ|เขต)\\s*'+r.district,'g'),'');a=a.replace(/(?:จ\.|จังหวัด)\s*[ก-๙ะ-์]+/gu,'').replace(/\d{5}/,'').trim();if(a.length>=2)ap.push(a)}else if(!pn&&/บ้านเลขที่|\d+\/\d|ซอย|ซ\.|หมู่|ม\.|ถนน|ร้าน|\d+/.test(l)){pn=true;let a=l;a=a.replace(/(?:จ\.|จังหวัด)\s*[ก-๙ะ-์]+/gu,'').replace(/\d{5}/,'').trim();if(a.length>=2)ap.push(a)}};if(ap.length>0)r.customerAddress=ap.join(' ')}
  return r
}

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
  const [bulkCreating, setBulkCreating] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 })
  const [flashModal, setFlashModal] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [pnoModal, setPnoModal] = useState(null)
  const [showCreateOrder, setShowCreateOrder] = useState(false)
  // ═══ Global Progress ═══
  const [gProgress, setGProgress] = useState(null) // { label, done, total, color }
  const [newOrder, setNewOrder] = useState({ customer_name:'', customer_phone:'', customer_address:'', sub_district:'', district:'', province:'', zip_code:'', payment_type:'cod', sale_price:'', cod_amount:'', remark:'' })
  const [pasteText, setPasteText] = useState('')
  const [addresses, setAddresses] = useState([])
  useEffect(() => { getAddresses().then(setAddresses) }, [])
  const [pnoInput, setPnoInput] = useState('')
  const [sidebarPage, setSidebarPage] = useState('shipping')
  const [trackSearchQuery, setTrackSearchQuery] = useState('')
  const [trackSearchResult, setTrackSearchResult] = useState(null)
  const [trackSearching, setTrackSearching] = useState(false)
  const [activityLogs, setActivityLogs] = useState([])
  const [upsellModal, setUpsellModal] = useState(null)
  const [upsellSelected, setUpsellSelected] = useState(new Set())
  const [logFilter, setLogFilter] = useState('all')
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 3500) }

  // ═══ Activity Logging ═══
  const logActivity = async (actionType, description, orderCount = 0, details = {}) => {
    try {
      await supabase.from('mt_activity_logs').insert({
        user_name: profile.full_name || '',
        action_type: actionType,
        description,
        order_count: orderCount,
        details: JSON.stringify(details)
      })
    } catch (e) { console.log('Log error:', e) }
  }

  const [flashSrcInfo, setFlashSrcInfo] = useState(() => { try { return JSON.parse(localStorage.getItem('flash_src') || '{}') } catch { return {} } })
  const [flashProxyUrl, setFlashProxyUrl] = useState(() => { try { return localStorage.getItem('flash_proxy_url') || '' } catch { return '' } })
  const saveFlashSrc = (info) => { setFlashSrcInfo(info); try { localStorage.setItem('flash_src', JSON.stringify(info)) } catch {}; setShowSettings(false); flash('OK') }
  const saveProxyUrl = (url) => { setFlashProxyUrl(url); try { localStorage.setItem('flash_proxy_url', url) } catch {} }
  const testConn = async () => { flash('...'); const r = await pingFlash(); flash(r.code === 1 ? 'OK' : 'FAIL') }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      let query = supabase.from('mt_orders').select('*').order('created_at', { ascending: false })
      if (dateFilter) query = query.gte('order_date', dateFilter)
      if (dateFilterEnd) query = query.lte('order_date', dateFilterEnd)
      let all = [], from = 0
      while (true) {
        const { data } = await query.range(from, from + 999)
        if (!data || data.length === 0) break
        all = [...all, ...data]; from += 1000
        if (data.length < 1000) break
      }
      setOrders(all); setLoading(false)
    }
    load()
    const ch = supabase.channel('pk-o').on('postgres_changes',{event:'INSERT',schema:'public',table:'mt_orders'},p=>setOrders(prev=>prev.some(o=>o.id===p.new.id)?prev:[p.new,...prev])).on('postgres_changes',{event:'UPDATE',schema:'public',table:'mt_orders'},p=>setOrders(prev=>prev.map(o=>o.id===p.new.id?p.new:o))).on('postgres_changes',{event:'DELETE',schema:'public',table:'mt_orders'},p=>setOrders(prev=>prev.filter(o=>o.id!==p.old.id))).subscribe()
    return () => supabase.removeChannel(ch)
  }, [dateFilter, dateFilterEnd])

  const SM = { 1:{l:'สร้างออเดอร์',bg:'#EBEDEF',c:'#5D6D7E',i:'📥'},2:{l:'รับพัสดุแล้ว',bg:'#D4E6F1',c:'#2471A3',i:'📦'},3:{l:'ศูนย์คัดแยก',bg:'#D4E6F1',c:'#2471A3',i:'🏭'},4:{l:'กำลังจัดส่ง',bg:'#FDEBD0',c:'#CA6F1E',i:'🛵'},5:{l:'เซ็นรับแล้ว',bg:'#D5F5E3',c:'#1E8449',i:'✅'},6:{l:'ตีกลับ',bg:'#FADBD8',c:'#C0392B',i:'↩️'} }
  const getBadge = (o) => {
    if (!o.flash_pno) return o.shipping_status==='printed'?{l:'พร้อมส่ง',bg:'#D5F5E3',c:'#1E8449',i:'✅'}:o.shipping_status==='upsell'?{l:'รออัพเซล',bg:'#F4ECF7',c:'#8E44AD',i:'💰'}:{l:'เตรียมส่ง',bg:'#FDEBD0',c:'#CA6F1E',i:'🚚'}
    if (o.flash_status==='cancelled') return {l:'ยกเลิก',bg:'#FADBD8',c:'#C0392B',i:'❌'}
    if (o.shipping_status==='upsell') return {l:'รออัพเซล',bg:'#F4ECF7',c:'#8E44AD',i:'💰'}
    const n=parseInt((o.flash_status||'').replace('flash_',''))||0
    return (n>0&&SM[n])?SM[n]:{l:'สร้างเลขพัสดุแล้ว',bg:'#F4ECF7',c:'#8E44AD',i:'⚡'}
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
    logActivity('create_pno', `สร้างเลขพัสดุ ${results.filter(r=>r.ok).length}/${results.length}`, results.filter(r=>r.ok).length, { pnos: results.filter(r=>r.ok).map(r=>r.pno) })
    setFlashModal({bulkResults:results})
  }

  const trackFlash = async (pno) => { flash('...'); const r=await trackFlashOrder(pno); if(r.code===1&&r.data){setFlashModal({pno,trackState:r.data.state,trackStateText:r.data.stateText||'',tracking:Array.isArray(r.data.routes)?r.data.routes:[]})} else flash(r.message||'error') }

  const savePno = async () => { if(!pnoModal)return; const v=pnoInput.trim(); await supabase.from('mt_orders').update({flash_pno:v,flash_status:v?'manual':''}).eq('id',pnoModal.orderId); setOrders(prev=>prev.map(o=>o.id===pnoModal.orderId?{...o,flash_pno:v,flash_status:v?'manual':''}:o)); setPnoModal(null);flash('OK') }

  // ═══ แก้ไขออเดอร์ ═══
  const [editModal, setEditModal] = useState(null)
  const openEditOrder = (o) => {
    setEditModal({ id: o.id, customer_name: o.customer_name||'', customer_phone: o.customer_phone||'', customer_address: o.customer_address||'', sub_district: o.sub_district||'', district: o.district||'', province: o.province||'', zip_code: o.zip_code||'', payment_type: o.payment_type||'cod', sale_price: String(o.sale_price||''), cod_amount: String(o.cod_amount||''), remark: o.remark||'' })
  }
  const saveEditOrder = async () => {
    if (!editModal) return
    const { id, ...fields } = editModal
    fields.sale_price = parseFloat(fields.sale_price) || 0
    fields.cod_amount = parseFloat(fields.cod_amount || fields.sale_price) || 0
    const { error } = await supabase.from('mt_orders').update(fields).eq('id', id)
    if (error) { flash('❌ ' + error.message); return }
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...fields } : o))
    setEditModal(null); flash('✅ แก้ไขสำเร็จ')
  }

  // ═══ ลบออเดอร์ ═══
  // (using gProgress for all operations)

  const deleteOrder = async (o) => {
    if (!confirm(`🗑 ลบออเดอร์?\n\n${o.customer_name}\n${o.customer_phone}\n\n⚠️ ลบถาวร — ไม่สามารถกู้คืนได้`)) return
    flash('⏳ กำลังลบ...')
    const { error } = await supabase.from('mt_orders').delete().eq('id', o.id)
    if (error) { flash('❌ ' + error.message); return }
    setOrders(prev => prev.filter(x => x.id !== o.id))
    flash('✅ ลบออเดอร์แล้ว')
  }

  const bulkDeleteOrders = async (ids) => {
    if (!ids.length) return
    if (!confirm(`🗑 ลบ ${ids.length} ออเดอร์?\n\n⚠️ ลบถาวร — ไม่สามารถกู้คืนได้`)) return
    setGProgress({ label: '🗑 กำลังลบ', done: 0, total: ids.length, color: '#E74C3C' })
    let done = 0, fail = 0
    for (let i = 0; i < ids.length; i++) {
      setGProgress(p => ({ ...p, done: i + 1 }))
      const { error } = await supabase.from('mt_orders').delete().eq('id', ids[i])
      if (!error) { setOrders(prev => prev.filter(x => x.id !== ids[i])); done++ } else { fail++ }
      if (i < ids.length - 1) await new Promise(r => setTimeout(r, 100))
    }
    setGProgress(null); setSelectedIds(new Set())
    flash(`✅ ลบสำเร็จ ${done} รายการ` + (fail ? ` | ❌ ไม่สำเร็จ ${fail}` : ''))
    logActivity('delete', `ลบ ${done} รายการ`, done)
  }

  const cancelFlash = async (o) => { if(!confirm('ยกเลิก '+o.flash_pno+'?\nต้องยกเลิกใน Flash portal ด้วย'))return; await supabase.from('mt_orders').update({flash_pno:'',flash_status:'cancelled',flash_sort_code:'',shipping_status:'waiting'}).eq('id',o.id); setOrders(prev=>prev.map(x=>x.id===o.id?{...x,flash_pno:'',flash_status:'cancelled',flash_sort_code:'',shipping_status:'waiting'}:x)); flash('ลบแล้ว'); logActivity('cancel', `ยกเลิก ${o.flash_pno} - ${o.customer_name}`, 1, { pno: o.flash_pno }) }

  // ═══ Smart Paste — วางข้อมูลแล้วจับอัตโนมัติ ═══
  const applyPaste = (text) => {
    const p = parseSmartPaste(text, addresses)
    setNewOrder(prev => ({
      ...prev,
      customer_name: p.customerName || prev.customer_name,
      customer_phone: p.customerPhone || prev.customer_phone,
      customer_address: p.customerAddress || prev.customer_address,
      sub_district: p.subDistrict || prev.sub_district,
      district: p.district || prev.district,
      province: p.province || prev.province,
      zip_code: p.zipCode || prev.zip_code,
      sale_price: p.amount || prev.sale_price,
      cod_amount: p.amount || prev.cod_amount,
      remark: p.remark || prev.remark,
    }))
  }

  // ═══ สร้างออเดอร์ใหม่ + สร้างเลขพัสดุ Flash ═══
  const createNewOrder = async (andFlash) => {
    const n = newOrder
    if (!n.customer_name || !n.customer_phone) { flash('กรุณาใส่ชื่อและเบอร์โทร'); return }
    if (!n.district || !n.province || !n.zip_code) { flash('กรุณาใส่ อำเภอ จังหวัด รหัสไปรษณีย์'); return }
    flash('⏳ กำลังบันทึก...')
    const orderData = {
      customer_name: n.customer_name.trim(),
      customer_phone: n.customer_phone.trim(),
      customer_address: n.customer_address.trim(),
      sub_district: n.sub_district.trim(),
      district: n.district.trim(),
      province: n.province.trim(),
      zip_code: n.zip_code.trim(),
      payment_type: n.payment_type,
      sale_price: parseFloat(n.sale_price) || 0,
      cod_amount: parseFloat(n.cod_amount || n.sale_price) || 0,
      remark: n.remark.trim(),
      order_date: new Date().toISOString().split('T')[0],
      employee_name: profile.full_name || '',
      shipping_status: 'waiting',
    }
    const { data, error } = await supabase.from('mt_orders').insert(orderData).select().single()
    if (error) { flash('❌ ' + error.message); return }
    setOrders(prev => [data, ...prev])
    flash('✅ สร้างออเดอร์สำเร็จ')

    // สร้างเลขพัสดุ Flash ด้วย
    if (andFlash) {
      flash('⏳ สร้างเลขพัสดุ Flash...')
      const r = await createFlashOrder(data, flashSrcInfo)
      if (r.code === 1 && r.data?.pno) {
        await supabase.from('mt_orders').update({ flash_pno: r.data.pno, flash_status: 'created', shipping_status: 'printed', flash_sort_code: r.data.sortCode || '' }).eq('id', data.id)
        setOrders(prev => prev.map(o => o.id === data.id ? { ...o, flash_pno: r.data.pno, flash_status: 'created', shipping_status: 'printed', flash_sort_code: r.data.sortCode || '' } : o))
        flash('✅ สร้างเลขพัสดุ Flash สำเร็จ! ' + r.data.pno)
      } else {
        flash('❌ สร้างเลขพัสดุไม่สำเร็จ: ' + (r.message || 'Error'))
      }
    }
    setShowCreateOrder(false)
    setNewOrder({ customer_name:'', customer_phone:'', customer_address:'', sub_district:'', district:'', province:'', zip_code:'', payment_type:'cod', sale_price:'', cod_amount:'', remark:'' })
  }

  const refreshStatus = async () => {
    const wp=dateFiltered.filter(o=>o.flash_pno&&o.flash_status!=='cancelled'); if(!wp.length){flash('ไม่มี');return}
    setGProgress({ label: '🔄 อัพเดทสถานะ', done: 0, total: wp.length, color: '#3498DB' })
    let u=0
    for(let i=0;i<wp.length;i++){
      setGProgress(p=>({...p,done:i+1}))
      const r=await trackFlashOrder(wp[i].flash_pno)
      if(r.code===1&&r.data){const ns='flash_'+(r.data.state||0);await supabase.from('mt_orders').update({flash_status:ns}).eq('id',wp[i].id);setOrders(prev=>prev.map(o=>o.id===wp[i].id?{...o,flash_status:ns}:o));u++}
      if(i<wp.length-1)await new Promise(r=>setTimeout(r,150))
    }
    setGProgress(null);flash('✅ อัพเดท '+u+' รายการ')
    logActivity('refresh_status', `อัพเดทสถานะ Flash ${u} รายการ`, u)
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
  const printLabels = async (t) => {
    const w=t.filter(o=>o.flash_pno); if(!w.length){flash('ไม่มีเลขพัสดุ');return}
    await buildLabelPDF(w)
    logActivity('print', `ปริ้นใบปะหน้า ${w.length} รายการ`, w.length, { pnos: w.map(o=>o.flash_pno) })
  }

  // ═══ ค้นหาเลขพัสดุ ═══
  const searchTracking = async (pnoOverride) => {
    const q = (pnoOverride || trackSearchQuery).trim()
    if (!q) { flash('กรุณากรอกเลขพัสดุหรือเบอร์โทร'); return }
    setTrackSearchQuery(q)
    setTrackSearching(true); setTrackSearchResult(null)
    // ถ้าเป็นเบอร์โทร → ค้นจาก Supabase
    if (/^0\d{8,9}$/.test(q)) {
      const { data } = await supabase.from('mt_orders').select('*').eq('customer_phone', q).order('created_at', { ascending: false })
      setTrackSearching(false)
      if (data && data.length > 0) {
        setTrackSearchResult({ type: 'phone', phone: q, orders: data })
      } else {
        setTrackSearchResult({ pno: q, error: 'ไม่พบออเดอร์จากเบอร์ ' + q })
      }
      return
    }
    // ถ้าเป็นเลขพัสดุ → ค้นจาก Flash API
    const local = orders.find(o => o.flash_pno === q)
    const result = await trackFlashOrder(q)
    setTrackSearching(false)
    if (result.code === 1 && result.data) {
      setTrackSearchResult({ pno: q, local, state: result.data.state, stateText: result.data.stateText || '', routes: Array.isArray(result.data.routes) ? result.data.routes : [] })
    } else {
      setTrackSearchResult({ pno: q, local, error: result.message || 'ไม่พบข้อมูล' })
    }
  }

  // ═══ ประวัติการอัพเดต ═══
  const loadActivityLogs = async () => {
    const { data } = await supabase.from('mt_activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)
    setActivityLogs(data || [])
  }
  useEffect(() => { if (sidebarPage === 'history') loadActivityLogs() }, [sidebarPage])

  // ═══ Upsell — แก้ COD + หมายเหตุ ═══
  const openUpsell = (o) => {
    setUpsellModal({ id: o.id, customer_name: o.customer_name, customer_phone: o.customer_phone, flash_pno: o.flash_pno, cod_amount: String(o.cod_amount || o.sale_price || ''), remark: o.remark || '', sale_price: String(o.sale_price || '') })
  }
  const saveUpsell = async () => {
    if (!upsellModal) return
    const codVal = parseFloat(upsellModal.cod_amount) || 0
    const saleVal = parseFloat(upsellModal.sale_price) || codVal
    const { error } = await supabase.from('mt_orders').update({ cod_amount: codVal, sale_price: saleVal > codVal ? saleVal : codVal, remark: upsellModal.remark }).eq('id', upsellModal.id)
    if (error) { flash('❌ ' + error.message); return }
    setOrders(prev => prev.map(o => o.id === upsellModal.id ? { ...o, cod_amount: codVal, sale_price: saleVal > codVal ? saleVal : codVal, remark: upsellModal.remark } : o))
    setUpsellModal(null)
    flash('✅ อัพเซลสำเร็จ — COD ฿' + codVal.toLocaleString())
    logActivity('upsell', `อัพเซล ${upsellModal.customer_name} → COD ฿${codVal}`, 1, { pno: upsellModal.flash_pno, cod: codVal, remark: upsellModal.remark })
  }

  const dateFiltered = orders.filter(o => { if(dateFilter){const od=(o.order_date||'').substring(0,10);if(od<dateFilter)return false}; if(dateFilterEnd){const od=(o.order_date||'').substring(0,10);if(od>dateFilterEnd)return false}; return true })
  const shipOrders = dateFiltered.filter(o => {
    if(shipFilter==='preparing')return(!o.shipping_status||o.shipping_status==='waiting')&&!o.flash_pno
    if(shipFilter==='printed')return o.shipping_status==='printed'&&!o.flash_pno
    if(shipFilter==='created')return o.flash_pno&&['created','manual'].includes(o.flash_status)
    if(shipFilter==='insystem')return o.flash_pno&&o.flash_status==='flash_1'
    if(shipFilter==='pickedup')return['flash_2','flash_3'].includes(o.flash_status)
    if(shipFilter==='delivering')return o.flash_status==='flash_4'
    if(shipFilter==='delivered')return o.flash_status==='flash_5'
    if(shipFilter==='returned')return o.flash_status==='flash_6'||o.flash_status==='cancelled'
    return true
  }).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))
  const searchFiltered = shipOrders.filter(o => { if(!searchQuery)return true; const q=searchQuery.toLowerCase(); return(o.customer_name||'').toLowerCase().includes(q)||(o.customer_phone||'').includes(q)||(o.flash_pno||'').includes(q)||(o.remark||'').toLowerCase().includes(q) })
  // ═══ Confirm Modal ═══
  const [confirmModal, setConfirmModal] = useState(null) // { title, message, color, icon, onConfirm }

  const markStatus = async (ids, st) => {
    const labels = { waiting: '🚚 เตรียมส่ง', printed: '🖨 ปริ้นแล้ว', upsell: '💰 รออัพเซล' }
    const colors = { waiting: '#E67E22', printed: '#16A085', upsell: '#8E44AD' }
    const icons = { waiting: '🚚', printed: '🖨', upsell: '💰' }
    const names = orders.filter(o => ids.includes(o.id)).map(o => o.customer_name).slice(0, 5)
    setConfirmModal({
      title: `${icons[st]||'📦'} ${labels[st]||'เปลี่ยนสถานะ'}`,
      message: `เปลี่ยนสถานะ ${ids.length} รายการ เป็น "${labels[st]||st}"?\n\n${names.join(', ')}${ids.length>5?' ...และอีก '+(ids.length-5)+' รายการ':''}`,
      color: colors[st] || '#3498DB',
      icon: icons[st] || '📦',
      onConfirm: async () => {
        setConfirmModal(null)
        setGProgress({ label: labels[st] || 'อัพเดท', done: 0, total: ids.length, color: colors[st] || '#3498DB' })
        for (let i = 0; i < ids.length; i++) {
          setGProgress(p => ({ ...p, done: i + 1 }))
          await supabase.from('mt_orders').update({ shipping_status: st }).eq('id', ids[i])
          setOrders(prev => prev.map(o => o.id === ids[i] ? { ...o, shipping_status: st } : o))
          if (i < ids.length - 1) await new Promise(r => setTimeout(r, 50))
        }
        setGProgress(null); setSelectedIds(new Set())
        flash(`✅ ${labels[st] || 'อัพเดท'} ${ids.length} รายการ`)
        logActivity('status_change', `${labels[st]} ${ids.length} รายการ`, ids.length, { status: st })
      }
    })
  }
  const lastRef=useRef(null)
  const toggleSelect=(id,e)=>{const list=searchFiltered.slice((page-1)*pageSize,page*pageSize);const idx=list.findIndex(o=>o.id===id);if(e?.shiftKey&&lastRef.current!==null){const s=Math.min(lastRef.current,idx),en=Math.max(lastRef.current,idx);setSelectedIds(prev=>{const n=new Set(prev);for(let i=s;i<=en;i++)n.add(list[i].id);return n})}else{setSelectedIds(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n})};lastRef.current=idx}
  const toggleAll=()=>{const p=searchFiltered.slice((page-1)*pageSize,page*pageSize).map(o=>o.id);const a=p.length>0&&p.every(id=>selectedIds.has(id));setSelectedIds(prev=>{const n=new Set(prev);p.forEach(id=>a?n.delete(id):n.add(id));return n})}
  const C={all:dateFiltered.length,preparing:dateFiltered.filter(o=>(!o.shipping_status||o.shipping_status==='waiting')&&!o.flash_pno).length,printed:dateFiltered.filter(o=>o.shipping_status==='printed'&&!o.flash_pno).length,created:dateFiltered.filter(o=>o.flash_pno&&['created','manual'].includes(o.flash_status)).length,insystem:dateFiltered.filter(o=>o.flash_pno&&o.flash_status==='flash_1').length,pickedup:dateFiltered.filter(o=>['flash_2','flash_3'].includes(o.flash_status)).length,delivering:dateFiltered.filter(o=>o.flash_status==='flash_4').length,delivered:dateFiltered.filter(o=>o.flash_status==='flash_5').length,returned:dateFiltered.filter(o=>o.flash_status==='flash_6'||o.flash_status==='cancelled').length}

  return (
    <div style={{fontFamily:T.font,minHeight:'100vh',background:'#F4F6F7',color:T.text,paddingBottom:40}}>
      <Toast message={toast} />
      {/* ═══ Global Progress Bar (fixed top) ═══ */}
      {gProgress&&<div style={{position:'fixed',top:52,left:220,right:0,zIndex:199,padding:'8px 20px',background:'rgba(255,255,255,0.97)',borderBottom:'1px solid #EAECEE',boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
          <span style={{fontSize:12,fontWeight:700,color:gProgress.color}}>{gProgress.label}</span>
          <span style={{fontSize:12,fontWeight:700,color:gProgress.color}}>{gProgress.done}/{gProgress.total} ({Math.round((gProgress.done/gProgress.total)*100)}%)</span>
        </div>
        <div style={{width:'100%',height:6,background:'#EAECEE',borderRadius:3,overflow:'hidden'}}>
          <div style={{width:Math.round((gProgress.done/gProgress.total)*100)+'%',height:'100%',background:gProgress.color,borderRadius:3,transition:'width 0.15s'}} />
        </div>
      </div>}
      <Modal show={!!flashModal} onClose={()=>setFlashModal(null)} title="Flash Express">
        {flashModal&&<>{flashModal.bulkResults&&<div><div style={{fontWeight:700,marginBottom:10,fontSize:14}}>ผลสร้างเลขพัสดุ ({flashModal.bulkResults.filter(r=>r.ok).length}/{flashModal.bulkResults.length})</div><div style={{maxHeight:400,overflowY:'auto'}}>{flashModal.bulkResults.map((r,i)=>(<div key={i} style={{display:'flex',gap:8,alignItems:'center',padding:'8px 10px',marginBottom:4,borderRadius:6,background:r.ok?'rgba(45,138,78,0.05)':'rgba(214,48,49,0.05)',border:'1px solid '+(r.ok?'rgba(45,138,78,0.15)':'rgba(214,48,49,0.15)')}}><span>{r.ok?'OK':'FAIL'}</span><span style={{fontSize:12,fontWeight:600,flex:1}}>{r.name}</span>{r.pno&&<span style={{fontFamily:'monospace',fontSize:11,color:'#2980B9',fontWeight:700}}>{r.pno}</span>}{r.error&&<span style={{fontSize:11,color:'#E74C3C'}}>{r.error}</span>}{r.debug&&<details style={{width:'100%',marginTop:4}}><summary style={{fontSize:10,color:'#999',cursor:'pointer'}}>debug</summary><pre style={{fontSize:9,whiteSpace:'pre-wrap',wordBreak:'break-all'}}>{JSON.stringify(r.debug,null,2)}</pre></details>}</div>))}</div>{(()=>{const p=flashModal.bulkResults.filter(r=>r.ok&&r.pno);return p.length>0&&<button onClick={()=>printLabels(orders.filter(o=>p.some(x=>x.pno===o.flash_pno)))} style={{width:'100%',marginTop:12,padding:'12px',borderRadius:8,border:'none',background:'#E67E22',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>ปริ้นใบปะหน้า ({p.length})</button>})()}</div>}
        {flashModal.pno&&flashModal.trackState&&<div><div style={{textAlign:'center',marginBottom:12}}><span style={{fontFamily:'monospace',fontSize:16,fontWeight:900}}>{flashModal.pno}</span></div><div style={{textAlign:'center',padding:12,borderRadius:8,background:(SM[flashModal.trackState]||{}).bg||'#f0f0f0',marginBottom:12}}><div style={{fontSize:20,marginBottom:4}}>{(SM[flashModal.trackState]||{}).i||'📦'}</div><div style={{fontWeight:700,color:(SM[flashModal.trackState]||{}).c||'#333'}}>{flashModal.trackStateText||(SM[flashModal.trackState]||{}).l||'?'}</div></div>{flashModal.tracking?.length>0&&<div style={{maxHeight:300,overflowY:'auto'}}>{flashModal.tracking.map((r,i)=>(<div key={i} style={{display:'flex',gap:8,padding:'6px 0',borderBottom:'1px solid #eee',fontSize:11}}><span style={{color:'#999',minWidth:100}}>{r.dateTime||r.datetime||''}</span><span>{r.message||r.routeDesc||''}</span></div>))}</div>}</div>}
        {flashModal.error&&<div style={{padding:12,background:'#FDEDEC',borderRadius:8,color:'#C0392B',fontSize:12}}>{flashModal.error}</div>}
        </>}
      </Modal>
      <Modal show={!!pnoModal} onClose={()=>setPnoModal(null)} title="แก้ไขเลขพัสดุ">{pnoModal&&<div><div style={{marginBottom:8,fontSize:12,color:'#85929E'}}>{pnoModal.customerName}</div><input value={pnoInput} onChange={e=>setPnoInput(e.target.value)} placeholder="เลขพัสดุ..." style={{width:'100%',padding:'10px 12px',borderRadius:6,border:'1px solid #ddd',fontSize:14,fontFamily:'monospace',marginBottom:10}} /><div style={{display:'flex',gap:8}}><button onClick={savePno} style={{flex:1,padding:10,borderRadius:6,border:'none',background:'#3498DB',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>บันทึก</button><button onClick={()=>{setPnoInput('');savePno()}} style={{padding:'10px 14px',borderRadius:6,border:'1px solid #E74C3C',background:'#FDEDEC',color:'#E74C3C',fontSize:13,fontWeight:700,cursor:'pointer'}}>ลบ</button></div></div>}</Modal>

      {/* ═══ Confirm Modal ═══ */}
      {confirmModal && <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}} onClick={()=>setConfirmModal(null)}>
        <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:16,padding:'28px 24px',width:'100%',maxWidth:400,boxShadow:'0 20px 60px rgba(0,0,0,0.2)',animation:'fadeIn 0.15s ease-out'}}>
          <div style={{textAlign:'center',marginBottom:20}}>
            <div style={{fontSize:48,marginBottom:8}}>{confirmModal.icon}</div>
            <div style={{fontSize:18,fontWeight:800,color:'#2C3E50',marginBottom:8}}>{confirmModal.title}</div>
            <div style={{fontSize:13,color:'#85929E',whiteSpace:'pre-line',lineHeight:1.6}}>{confirmModal.message}</div>
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>setConfirmModal(null)} style={{flex:1,padding:'14px',borderRadius:10,border:'1px solid #DEE2E6',background:'#fff',color:'#85929E',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>ยกเลิก</button>
            <button onClick={confirmModal.onConfirm} style={{flex:1,padding:'14px',borderRadius:10,border:'none',background:confirmModal.color,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:T.font,boxShadow:`0 4px 12px ${confirmModal.color}40`}}>✅ ยืนยัน</button>
          </div>
        </div>
      </div>}

      {/* ═══ Upsell Modal ═══ */}
      <Modal show={!!upsellModal} onClose={()=>setUpsellModal(null)} title="💰 อัพเซล">
        {upsellModal&&<div>
          <div style={{padding:12,background:'#F8F9FA',borderRadius:8,marginBottom:12}}>
            <div style={{fontWeight:700,fontSize:14}}>{upsellModal.customer_name}</div>
            <div style={{fontSize:12,color:'#85929E',marginTop:2}}>{upsellModal.customer_phone}</div>
            {upsellModal.flash_pno&&<div style={{fontFamily:'monospace',fontSize:12,color:'#2980B9',fontWeight:700,marginTop:4}}>{upsellModal.flash_pno}</div>}
          </div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:11,color:'#85929E',marginBottom:4}}>💰 ยอด COD ใหม่</div>
            <input value={upsellModal.cod_amount} onChange={e=>setUpsellModal({...upsellModal,cod_amount:e.target.value})} type="number" placeholder="0" style={{width:'100%',padding:'12px 14px',borderRadius:8,border:'1px solid #DEE2E6',fontSize:18,fontWeight:900,fontFamily:T.font,color:'#E74C3C',textAlign:'center'}} />
          </div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,color:'#85929E',marginBottom:4}}>📝 หมายเหตุ/สินค้า</div>
            <textarea value={upsellModal.remark} onChange={e=>setUpsellModal({...upsellModal,remark:e.target.value})} rows={3} placeholder="Rong 1 (50g) เซรั่ม 1 สบู่ 2..." style={{width:'100%',padding:'10px 14px',borderRadius:8,border:'1px solid #DEE2E6',fontSize:13,fontFamily:T.font,resize:'vertical'}} />
          </div>
          <button onClick={saveUpsell} style={{width:'100%',padding:'14px',borderRadius:8,border:'none',background:'linear-gradient(135deg,#8E44AD,#9B59B6)',color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:T.font,boxShadow:'0 2px 10px rgba(142,68,173,0.3)'}}>💰 บันทึกอัพเซล</button>
        </div>}
      </Modal>

      {/* ═══ Edit Order Modal ═══ */}
      <Modal show={!!editModal} onClose={()=>setEditModal(null)} title="✏️ แก้ไขข้อมูลลูกค้า">
        {editModal&&<div>
          {[
            {l:'ชื่อลูกค้า',k:'customer_name'},{l:'เบอร์โทร',k:'customer_phone'},{l:'ที่อยู่',k:'customer_address'},
            {l:'ตำบล',k:'sub_district'},{l:'อำเภอ',k:'district'},{l:'จังหวัด',k:'province'},{l:'รหัสไปรษณีย์',k:'zip_code'},
          ].map(f=><div key={f.k} style={{marginBottom:6}}>
            <div style={{fontSize:10,color:'#85929E',marginBottom:2}}>{f.l}</div>
            <input value={editModal[f.k]} onChange={e=>setEditModal({...editModal,[f.k]:e.target.value})} style={{width:'100%',padding:'7px 10px',borderRadius:6,border:'1px solid #DEE2E6',fontSize:13,fontFamily:T.font}} />
          </div>)}
          <div style={{display:'flex',gap:8,marginBottom:6}}>
            <div style={{flex:1}}>
              <div style={{fontSize:10,color:'#85929E',marginBottom:2}}>ประเภท</div>
              <select value={editModal.payment_type} onChange={e=>setEditModal({...editModal,payment_type:e.target.value})} style={{width:'100%',padding:'7px 10px',borderRadius:6,border:'1px solid #DEE2E6',fontSize:13,fontFamily:T.font}}>
                <option value="cod">COD</option><option value="transfer">โอน</option>
              </select>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:10,color:'#85929E',marginBottom:2}}>ราคา</div>
              <input value={editModal.sale_price} onChange={e=>setEditModal({...editModal,sale_price:e.target.value})} type="number" style={{width:'100%',padding:'7px 10px',borderRadius:6,border:'1px solid #DEE2E6',fontSize:13,fontFamily:T.font}} />
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,color:'#85929E',marginBottom:2}}>หมายเหตุ</div>
            <input value={editModal.remark} onChange={e=>setEditModal({...editModal,remark:e.target.value})} style={{width:'100%',padding:'7px 10px',borderRadius:6,border:'1px solid #DEE2E6',fontSize:13,fontFamily:T.font}} />
          </div>
          <button onClick={saveEditOrder} style={{width:'100%',padding:'12px',borderRadius:8,border:'none',background:'#3498DB',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>💾 บันทึกการแก้ไข</button>
        </div>}
      </Modal>
      {/* ═══ Create Order Modal ═══ */}
      <Modal show={showCreateOrder} onClose={()=>{setShowCreateOrder(false);setPasteText('')}} title="📦 สร้างออเดอร์ใหม่">
        <div>
          {/* Smart Paste */}
          <div style={{marginBottom:12,padding:10,borderRadius:8,background:'rgba(230,126,34,0.04)',border:'1px solid rgba(230,126,34,0.15)'}}>
            <div style={{fontSize:12,fontWeight:700,color:'#E67E22',marginBottom:6}}>📋 Smart Paste — วางข้อมูลจาก Line/Facebook</div>
            <textarea value={pasteText} onChange={e=>setPasteText(e.target.value)}
              onPaste={e=>{const t=e.clipboardData.getData('text');if(t&&t.length>=5){e.preventDefault();setPasteText(t);applyPaste(t);flash('✅ Smart Paste — แยกข้อมูลแล้ว!')}}}
              placeholder={"วางข้อมูลตรงนี้...\n\nตัวอย่าง:\nสมชาย ใจดี\n123/4 หมู่ 5\nต.วังทอง อ.วังทอง\nจ.พิษณุโลก 65130\n0812345678\nCOD 399"}
              rows={4} style={{width:'100%',padding:'8px 10px',borderRadius:6,border:'1px solid #DEE2E6',fontSize:12,fontFamily:T.font,resize:'vertical'}} />
            {pasteText&&<div style={{display:'flex',gap:6,marginTop:6}}>
              <button onClick={()=>{applyPaste(pasteText);flash('✅ แยกข้อมูลสำเร็จ!')}} style={{padding:'6px 12px',borderRadius:6,border:'none',background:'#E67E22',color:'#fff',fontSize:11,fontWeight:700,cursor:'pointer'}}>✨ แยกข้อมูล</button>
              <button onClick={()=>{setPasteText('');setNewOrder({customer_name:'',customer_phone:'',customer_address:'',sub_district:'',district:'',province:'',zip_code:'',payment_type:'cod',sale_price:'',cod_amount:'',remark:''})}} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #DEE2E6',background:'#fff',color:'#85929E',fontSize:11,cursor:'pointer'}}>🗑 ล้าง</button>
            </div>}
          </div>
          {[
            {l:'ชื่อลูกค้า *',k:'customer_name',ph:'ชื่อ-นามสกุล'},
            {l:'เบอร์โทร *',k:'customer_phone',ph:'0812345678'},
            {l:'ที่อยู่',k:'customer_address',ph:'บ้านเลขที่ ซอย ถนน'},
            {l:'ตำบล/แขวง',k:'sub_district',ph:'ตำบล'},
            {l:'อำเภอ/เขต *',k:'district',ph:'อำเภอ'},
            {l:'จังหวัด *',k:'province',ph:'จังหวัด'},
            {l:'รหัสไปรษณีย์ *',k:'zip_code',ph:'10000'},
          ].map(f=><div key={f.k} style={{marginBottom:6}}>
            <div style={{fontSize:10,color:'#85929E',marginBottom:2}}>{f.l}</div>
            <input value={newOrder[f.k]} onChange={e=>setNewOrder({...newOrder,[f.k]:e.target.value})} placeholder={f.ph} style={{width:'100%',padding:'7px 10px',borderRadius:6,border:'1px solid #DEE2E6',fontSize:13,fontFamily:T.font}} />
          </div>)}
          <div style={{display:'flex',gap:8,marginBottom:6}}>
            <div style={{flex:1}}>
              <div style={{fontSize:10,color:'#85929E',marginBottom:2}}>ประเภทชำระ</div>
              <select value={newOrder.payment_type} onChange={e=>setNewOrder({...newOrder,payment_type:e.target.value})} style={{width:'100%',padding:'7px 10px',borderRadius:6,border:'1px solid #DEE2E6',fontSize:13,fontFamily:T.font}}>
                <option value="cod">COD (เก็บเงินปลายทาง)</option>
                <option value="transfer">โอนแล้ว</option>
              </select>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:10,color:'#85929E',marginBottom:2}}>ราคา</div>
              <input value={newOrder.sale_price} onChange={e=>setNewOrder({...newOrder,sale_price:e.target.value})} placeholder="0" type="number" style={{width:'100%',padding:'7px 10px',borderRadius:6,border:'1px solid #DEE2E6',fontSize:13,fontFamily:T.font}} />
            </div>
          </div>
          {newOrder.payment_type==='cod'&&<div style={{marginBottom:6}}>
            <div style={{fontSize:10,color:'#85929E',marginBottom:2}}>ยอด COD (ถ้าต่างจากราคา)</div>
            <input value={newOrder.cod_amount} onChange={e=>setNewOrder({...newOrder,cod_amount:e.target.value})} placeholder={newOrder.sale_price||'เท่ากับราคา'} type="number" style={{width:'100%',padding:'7px 10px',borderRadius:6,border:'1px solid #DEE2E6',fontSize:13,fontFamily:T.font}} />
          </div>}
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,color:'#85929E',marginBottom:2}}>หมายเหตุ/สินค้า</div>
            <input value={newOrder.remark} onChange={e=>setNewOrder({...newOrder,remark:e.target.value})} placeholder="Rong 1 (50g) เซรั่ม 1..." style={{width:'100%',padding:'7px 10px',borderRadius:6,border:'1px solid #DEE2E6',fontSize:13,fontFamily:T.font}} />
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>createNewOrder(false)} style={{flex:1,padding:'12px',borderRadius:8,border:'1px solid #3498DB',background:'#EBF5FB',color:'#3498DB',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>💾 บันทึกออเดอร์</button>
            <button onClick={()=>createNewOrder(true)} style={{flex:1,padding:'12px',borderRadius:8,border:'none',background:'#E67E22',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>⚡ บันทึก + สร้างเลขพัสดุ</button>
          </div>
        </div>
      </Modal>

      <Modal show={showSettings} onClose={()=>setShowSettings(false)} title="ตั้งค่า Flash">
        <div style={{marginBottom:14,padding:10,borderRadius:6,background:'rgba(255,107,0,0.04)',border:'1px solid rgba(255,107,0,0.15)'}}>
          <div style={{fontSize:11,fontWeight:700,marginBottom:6}}>Flash Proxy URL</div>
          <input value={flashProxyUrl} onChange={e=>saveProxyUrl(e.target.value)} placeholder="https://flash2-proxy.xxx.workers.dev" style={{width:'100%',padding:8,borderRadius:4,border:'1px solid #ddd',fontSize:12,fontFamily:'monospace',marginBottom:6}} />
          <button onClick={testConn} style={{padding:'6px 14px',borderRadius:4,border:'none',background:'#E67E22',color:'#fff',fontSize:11,fontWeight:700,cursor:'pointer'}}>ทดสอบ</button>
        </div>
        <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>ข้อมูลผู้ส่ง</div>
        {(()=>{const[f,setF]=useState({name:flashSrcInfo.name||'',phone:flashSrcInfo.phone||'',address:flashSrcInfo.address||'',district:flashSrcInfo.district||'',province:flashSrcInfo.province||'',zip:flashSrcInfo.zip||''});const I=(l,k)=><div style={{marginBottom:6}}><div style={{fontSize:10,color:'#999',marginBottom:2}}>{l}</div><input value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})} style={{width:'100%',padding:'6px 8px',borderRadius:4,border:'1px solid #ddd',fontSize:12}} /></div>;return<div>{I('ชื่อร้าน','name')}{I('เบอร์โทร','phone')}{I('ที่อยู่','address')}{I('อำเภอ','district')}{I('จังหวัด','province')}{I('รหัสไปรษณีย์','zip')}<button onClick={()=>saveFlashSrc(f)} style={{width:'100%',padding:10,borderRadius:6,border:'none',background:'#27AE60',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',marginTop:6}}>บันทึก</button></div>})()}
      </Modal>

      {/* ═══ Header ═══ */}
      <div style={{background:'#fff',padding:'12px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',position:'fixed',top:0,left:0,right:0,zIndex:200,borderBottom:'1px solid #DEE2E6',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}><img src="./logo.png" alt="" style={{height:28}} /><span style={{fontSize:16,fontWeight:900}}>ADMIN THE MT</span><LiveDot /></div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <span style={{fontSize:11,color:'#85929E'}}>{profile.full_name} — {profile.role === 'head' ? '👑 หัวหน้า' : '🚚 จัดส่ง'}</span>
          <button onClick={()=>setShowSettings(true)} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #E67E22',background:'#FEF5E7',color:'#E67E22',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>⚙️</button>
          <button onClick={onLogout} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #DEE2E6',background:'transparent',color:'#85929E',fontSize:11,cursor:'pointer',fontFamily:T.font}}>ออก</button>
        </div>
      </div>

      {/* ═══ Sidebar + Content ═══ */}
      <div style={{display:'flex',marginTop:52,minHeight:'calc(100vh - 52px)'}}>
        {/* Sidebar */}
        <div style={{width:220,minWidth:220,background:'#2C3E50',color:'#fff',padding:'20px 0',position:'fixed',top:52,bottom:0,overflowY:'auto',zIndex:100}}>
          <div style={{padding:'0 16px 16px',borderBottom:'1px solid rgba(255,255,255,0.1)',marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:'#E67E22'}}>⚡ Flash Express</div>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.5)',marginTop:2}}>ระบบจัดการขนส่ง</div>
          </div>
          {[
            { id: 'shipping', icon: '🚚', label: 'การจัดส่ง' },
            { id: 'tracking', icon: '🔍', label: 'ค้นหาเลขพัสดุ' },
            { id: 'upsell', icon: '💰', label: 'รายชื่อรออัพเซล', count: orders.filter(o=>o.shipping_status==='upsell'&&o.flash_pno).length },
            { id: 'history', icon: '📋', label: 'ประวัติการอัพเดต' },
          ].map(m => (
            <button key={m.id} onClick={() => setSidebarPage(m.id)} style={{
              display:'flex',gap:10,alignItems:'center',width:'100%',padding:'12px 20px',border:'none',cursor:'pointer',fontFamily:T.font,fontSize:13,fontWeight:sidebarPage===m.id?700:400,
              background:sidebarPage===m.id?'rgba(230,126,34,0.15)':'transparent',color:sidebarPage===m.id?'#E67E22':'rgba(255,255,255,0.7)',
              borderLeft:sidebarPage===m.id?'3px solid #E67E22':'3px solid transparent',transition:'all 0.15s'
            }}>
              <span style={{fontSize:16}}>{m.icon}</span>{m.label}{m.count>0&&<span style={{marginLeft:'auto',background:'#E67E22',color:'#fff',borderRadius:10,padding:'1px 7px',fontSize:10,fontWeight:700}}>{m.count}</span>}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div style={{flex:1,marginLeft:220,padding:'20px 24px',minHeight:'100%'}}>

          {/* ═══ PAGE: การจัดส่ง ═══ */}
          {sidebarPage === 'shipping' && <>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
              <div style={{fontSize:20,fontWeight:800}}>🚚 การจัดส่ง</div>
              <button onClick={()=>setShowCreateOrder(true)} style={{padding:'8px 16px',borderRadius:8,border:'none',background:'#E67E22',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:T.font,boxShadow:'0 2px 8px rgba(230,126,34,0.3)'}}>+ สร้างออเดอร์</button>
            </div>

            {/* Date filters */}
            <div style={{display:'flex',gap:6,marginBottom:12,alignItems:'center',flexWrap:'wrap'}}>
              <input type="date" value={dateFilter} onChange={e=>{setDateFilter(e.target.value);if(!dateFilterEnd||e.target.value>dateFilterEnd)setDateFilterEnd(e.target.value);setQuickFilter('');setPage(1)}} style={{padding:'7px 10px',borderRadius:6,background:'#fff',border:'1px solid #DEE2E6',fontSize:12,fontFamily:T.font}} />
              <span style={{color:'#ABB2B9'}}>—</span>
              <input type="date" value={dateFilterEnd} onChange={e=>{setDateFilterEnd(e.target.value);setQuickFilter('');setPage(1)}} style={{padding:'7px 10px',borderRadius:6,background:'#fff',border:'1px solid #DEE2E6',fontSize:12,fontFamily:T.font}} />
              {[{id:'today',label:'วันนี้',fn:()=>{setDateFilter(todayStr);setDateFilterEnd(todayStr)}},{id:'7days',label:'7 วัน',fn:()=>{const d=new Date();d.setDate(d.getDate()-6);setDateFilter(d.toISOString().split('T')[0]);setDateFilterEnd(todayStr)}},{id:'month',label:'เดือนนี้',fn:()=>{setDateFilter(new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0')+'-01');setDateFilterEnd(todayStr)}}].map(b=><button key={b.id} onClick={()=>{b.fn();setQuickFilter(b.id);setPage(1)}} style={{padding:'7px 14px',borderRadius:6,border:quickFilter===b.id?'none':'1px solid #DEE2E6',background:quickFilter===b.id?'#E67E22':'#fff',color:quickFilter===b.id?'#fff':'#85929E',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>{b.label}</button>)}
              <div style={{flex:1}} />
              <input placeholder="ค้นหา ชื่อ เบอร์ เลขพัสดุ..." value={searchQuery} onChange={e=>{setSearchQuery(e.target.value);setPage(1)}} style={{padding:'7px 12px',borderRadius:6,border:'1px solid #DEE2E6',fontSize:12,fontFamily:T.font,width:220}} />
              <button onClick={refreshStatus} disabled={!!gProgress} style={{padding:'7px 14px',borderRadius:6,border:'1px solid #3498DB',background:'#EBF5FB',color:'#3498DB',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>{gProgress?'⏳...':'🔄 อัพเดทสถานะ'}</button>
            </div>

            {/* Status tabs */}
            <div style={{display:'flex',gap:0,borderBottom:'2px solid #EAECEE',marginBottom:12,overflowX:'auto'}}>
              {[{id:'all',i:'📦',l:'ทั้งหมด',c:'#2980B9'},{id:'preparing',i:'🚚',l:'เตรียมส่ง',c:'#E67E22'},{id:'printed',i:'🖨',l:'ปริ้นแล้ว',c:'#16A085'},{id:'created',i:'⚡',l:'สร้างเลขพัสดุแล้ว',c:'#8E44AD'},{id:'insystem',i:'📥',l:'รับเข้าระบบ',c:'#5D6D7E'},{id:'pickedup',i:'📦',l:'รับพัสดุแล้ว',c:'#2471A3'},{id:'delivering',i:'🛵',l:'กำลังจัดส่ง',c:'#CA6F1E'},{id:'delivered',i:'✅',l:'เซ็นรับแล้ว',c:'#1E8449'},{id:'returned',i:'↩️',l:'ตีกลับ',c:'#C0392B'}].map(f=>(<button key={f.id} onClick={()=>{setShipFilter(f.id);setPage(1)}} style={{padding:'8px 12px',border:'none',cursor:'pointer',fontFamily:T.font,fontSize:11,fontWeight:500,background:'transparent',color:shipFilter===f.id?f.c:'#85929E',borderBottom:shipFilter===f.id?'3px solid '+f.c:'3px solid transparent',marginBottom:-2,whiteSpace:'nowrap'}}>{f.i} {f.l} <strong style={{marginLeft:2}}>{C[f.id]}</strong></button>))}
            </div>

            {/* Bulk Actions */}
            {selectedIds.size>0&&<div style={{display:'flex',gap:6,marginBottom:10,padding:'10px 14px',background:'#EBF5FB',borderRadius:8,alignItems:'center',flexWrap:'wrap'}}>
              <span style={{fontSize:12,fontWeight:700,color:'#2980B9'}}>✔ เลือก {selectedIds.size}</span>
              <button onClick={()=>markStatus([...selectedIds],'waiting')} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #E67E22',background:'#FEF5E7',color:'#E67E22',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>🚚 เตรียมส่ง</button>
              <button onClick={()=>markStatus([...selectedIds],'printed')} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #27AE60',background:'#EAFAF1',color:'#27AE60',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>🖨 ปริ้นแล้ว</button>
              <button onClick={()=>bulkCreateFlash(orders.filter(o=>selectedIds.has(o.id)))} disabled={bulkCreating} style={{padding:'6px 14px',borderRadius:6,border:'none',background:bulkCreating?'#BDC3C7':'#E67E22',color:'#fff',fontSize:11,fontWeight:700,cursor:bulkCreating?'wait':'pointer',fontFamily:T.font}}>{bulkCreating?'⏳ '+bulkProgress.done+'/'+bulkProgress.total:'⚡ สร้างเลขพัสดุ ('+selectedIds.size+')'}</button>
              <button onClick={()=>printLabels(orders.filter(o=>selectedIds.has(o.id)))} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #E67E22',background:'#FEF5E7',color:'#E67E22',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>🖨 ปริ้นใบปะหน้า</button>
              <button onClick={()=>{exportProshipExcel(orders.filter(o=>selectedIds.has(o.id)),'Selected.xlsx',profile,'shipping');flash('Export OK'); logActivity('export', `Export ${orders.filter(o=>selectedIds.has(o.id)).length} รายการ`, selectedIds.size)}} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #2980B9',background:'#EBF5FB',color:'#2980B9',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>📊 Export</button>
              {(()=>{const wp=orders.filter(o=>selectedIds.has(o.id)&&o.flash_pno);return wp.length>0&&<button onClick={()=>markStatus([...selectedIds].filter(id=>orders.find(o=>o.id===id)?.flash_pno),'upsell')} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #8E44AD',background:'#F4ECF7',color:'#8E44AD',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>💰 รออัพเซล ({wp.length})</button>})()}
              <button onClick={()=>bulkDeleteOrders([...selectedIds])} disabled={!!gProgress} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #E74C3C',background:'#FDEDEC',color:'#E74C3C',fontSize:11,fontWeight:700,cursor:gProgress?'wait':'pointer',fontFamily:T.font}}>🗑 ลบ ({selectedIds.size})</button>
              <button onClick={()=>setSelectedIds(new Set())} style={{padding:'6px 8px',borderRadius:6,border:'1px solid #DEE2E6',background:'#fff',color:'#85929E',fontSize:11,cursor:'pointer'}}>✕</button>
            </div>}

            {/* Global Progress Bar */}
            {gProgress&&<div style={{marginBottom:10,padding:'10px 14px',background:'rgba(0,0,0,0.03)',borderRadius:8,border:`1px solid ${gProgress.color}22`}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                <span style={{fontSize:12,fontWeight:700,color:gProgress.color}}>{gProgress.label}</span>
                <span style={{fontSize:12,fontWeight:700,color:gProgress.color}}>{gProgress.done}/{gProgress.total} ({Math.round((gProgress.done/gProgress.total)*100)}%)</span>
              </div>
              <div style={{width:'100%',height:8,background:'#EAECEE',borderRadius:4,overflow:'hidden'}}>
                <div style={{width:Math.round((gProgress.done/gProgress.total)*100)+'%',height:'100%',background:gProgress.color,borderRadius:4,transition:'width 0.2s'}} />
              </div>
            </div>}

            {/* Table */}
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
                        <button onClick={()=>openEditOrder(o)} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,padding:0}} title="แก้ไขข้อมูล">✏️</button>
                        {hp&&<button onClick={()=>trackFlash(o.flash_pno)} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,padding:0}} title="ดูสถานะ">👁</button>}
                        {hp&&<button onClick={()=>printLabels([o])} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,padding:0}} title="ปริ้นใบปะหน้า">🖨</button>}
                        {hp&&<button onClick={()=>cancelFlash(o)} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,padding:0,opacity:0.5}} title="ยกเลิก Flash">❌</button>}
                        {!hp&&<button onClick={async()=>{if(!confirm('สร้างเลขพัสดุ?\n'+o.customer_name))return;flash('...');const r=await createFlashOrder(o,flashSrcInfo);if(r.code===1&&r.data?.pno){await supabase.from('mt_orders').update({flash_pno:r.data.pno,flash_status:'created',flash_sort_code:r.data.sortCode||''}).eq('id',o.id);setOrders(prev=>prev.map(x=>x.id===o.id?{...x,flash_pno:r.data.pno,flash_status:'created',flash_sort_code:r.data.sortCode||''}:x));flash('OK '+r.data.pno)}else{flash(r.message||'Error')}}} style={{padding:'4px 8px',borderRadius:4,border:'none',background:'#E67E22',color:'#fff',fontSize:10,fontWeight:700,cursor:'pointer'}}>⚡</button>}
                        <button onClick={()=>deleteOrder(o)} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,padding:0,opacity:0.4}} title="ลบออเดอร์">🗑</button>
                      </div></td>
                    </tr>)})}
                </tbody>
              </table>
              {searchFiltered.length===0&&!loading&&<Empty text="ไม่มีออเดอร์" />}
              {loading&&<div style={{textAlign:'center',padding:40,color:'#85929E'}}>⏳ กำลังโหลด...</div>}
            </div></div>
            <Pagination total={searchFiltered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </>}

          {/* ═══ PAGE: ค้นหาเลขพัสดุ ═══ */}
          {sidebarPage === 'tracking' && <div>
            <div style={{fontSize:20,fontWeight:800,marginBottom:20}}>🔍 ค้นหาเลขพัสดุ / เบอร์โทร</div>
            <div style={{maxWidth:700}}>
              <div style={{display:'flex',gap:8,marginBottom:20}}>
                <input value={trackSearchQuery} onChange={e=>setTrackSearchQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&searchTracking()}
                  placeholder="เลขพัสดุ TH... หรือ เบอร์โทร 08..." style={{flex:1,padding:'12px 16px',borderRadius:8,border:'1px solid #DEE2E6',fontSize:15,fontFamily:'monospace'}} />
                <button onClick={()=>searchTracking()} disabled={trackSearching} style={{padding:'12px 24px',borderRadius:8,border:'none',background:'#E67E22',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>{trackSearching?'⏳...':'🔍 ค้นหา'}</button>
              </div>

              {trackSearchResult && <div style={{background:'#fff',borderRadius:12,border:'1px solid #DEE2E6',overflow:'hidden'}}>
                {/* ═══ ผลค้นหาจากเบอร์โทร ═══ */}
                {trackSearchResult.type === 'phone' ? <>
                  <div style={{padding:'16px 20px',borderBottom:'1px solid #EAECEE',background:'#F8F9FA'}}>
                    <div style={{fontSize:14,fontWeight:700}}>📱 ผลค้นหาจากเบอร์ <span style={{color:'#E67E22'}}>{trackSearchResult.phone}</span></div>
                    <div style={{fontSize:12,color:'#85929E',marginTop:2}}>พบ {trackSearchResult.orders.length} ออเดอร์</div>
                  </div>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,fontFamily:T.font}}>
                    <thead><tr style={{background:'#F8F9FA'}}>
                      {['วันที่','ลูกค้า','เลขพัสดุ','สถานะ','COD','หมายเหตุ',''].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',fontWeight:600,color:'#5D6D7E',borderBottom:'1px solid #DEE2E6',fontSize:11}}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {trackSearchResult.orders.map(o=>{
                        const st=o.flash_pno?(SM[parseInt((o.flash_status||'').replace('flash_',''))||0]||{l:'รับเข้าระบบ',bg:'#D4E6F1',c:'#2471A3',i:'📥'}):{l:'ไม่มีเลขพัสดุ',bg:'#EBEDEF',c:'#85929E',i:'—'}
                        return <tr key={o.id} style={{borderBottom:'1px solid #EAECEE'}}>
                          <td style={{padding:'10px',fontSize:11}}>{new Date(o.created_at).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'2-digit',month:'short',year:'numeric'})}</td>
                          <td style={{padding:'10px',fontWeight:600}}>{o.customer_name}</td>
                          <td style={{padding:'10px'}}>{o.flash_pno?<span style={{fontFamily:'monospace',fontSize:11,color:'#2980B9',fontWeight:700}}>{o.flash_pno}</span>:<span style={{color:'#CCD1D1',fontSize:10}}>—</span>}</td>
                          <td style={{padding:'10px'}}><span style={{padding:'3px 8px',borderRadius:6,fontSize:10,fontWeight:700,background:st.bg,color:st.c}}>{st.i} {st.l}</span></td>
                          <td style={{padding:'10px',fontWeight:700}}>{o.payment_type==='cod'?<span style={{color:'#E74C3C'}}>฿{fmt(parseFloat(o.cod_amount||o.sale_price)||0)}</span>:<span style={{color:'#27AE60',fontSize:10}}>โอน</span>}</td>
                          <td style={{padding:'10px',fontSize:10,color:'#85929E',maxWidth:150,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{o.remark||''}</td>
                          <td style={{padding:'10px'}}>{o.flash_pno&&<button onClick={()=>searchTracking(o.flash_pno)} style={{padding:'4px 10px',borderRadius:4,border:'none',background:'#E67E22',color:'#fff',fontSize:10,fontWeight:700,cursor:'pointer'}}>🔍 Track</button>}</td>
                        </tr>})}
                    </tbody>
                  </table>
                </> : <>
                {/* ═══ ผลค้นหาจากเลขพัสดุ ═══ */}
                <div style={{padding:'16px 20px',borderBottom:'1px solid #EAECEE'}}>
                  <div style={{fontFamily:'monospace',fontSize:18,fontWeight:900,color:'#2C3E50'}}>{trackSearchResult.pno}</div>
                  {trackSearchResult.local && <div style={{fontSize:12,color:'#85929E',marginTop:4}}>ลูกค้า: <strong style={{color:'#2C3E50'}}>{trackSearchResult.local.customer_name}</strong> | {trackSearchResult.local.customer_phone}</div>}
                </div>

                {trackSearchResult.error ? (
                  <div style={{padding:20,textAlign:'center',color:'#E74C3C',fontSize:14}}>{trackSearchResult.error}</div>
                ) : (<>
                  <div style={{padding:'16px 20px',textAlign:'center',background:(SM[trackSearchResult.state]||{}).bg||'#f5f5f5'}}>
                    <div style={{fontSize:28,marginBottom:4}}>{(SM[trackSearchResult.state]||{}).i||'📦'}</div>
                    <div style={{fontSize:16,fontWeight:700,color:(SM[trackSearchResult.state]||{}).c||'#333'}}>{trackSearchResult.stateText||(SM[trackSearchResult.state]||{}).l||'ไม่ทราบสถานะ'}</div>
                  </div>
                  <div style={{padding:'12px 20px',display:'flex',gap:4,alignItems:'center'}}>
                    {[1,2,3,4,5].map(s=><div key={s} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                      <div style={{width:24,height:24,borderRadius:12,background:trackSearchResult.state>=s?'#E67E22':'#DEE2E6',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700}}>{s}</div>
                      <div style={{fontSize:8,color:trackSearchResult.state>=s?'#E67E22':'#ABB2B9',textAlign:'center'}}>{['สร้าง','รับ','คัดแยก','จัดส่ง','สำเร็จ'][s-1]}</div>
                    </div>)}
                  </div>
                  {trackSearchResult.routes?.length>0 && <div style={{padding:'0 20px 16px'}}>
                    <div style={{fontSize:13,fontWeight:700,marginBottom:10,color:'#2C3E50'}}>📍 Timeline</div>
                    {trackSearchResult.routes.map((r,i)=>(
                      <div key={i} style={{display:'flex',gap:12,paddingBottom:12}}>
                        <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
                          <div style={{width:10,height:10,borderRadius:5,background:i===0?'#E67E22':'#DEE2E6'}} />
                          {i<trackSearchResult.routes.length-1&&<div style={{width:2,flex:1,background:'#EAECEE'}} />}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:11,color:'#85929E'}}>{r.dateTime||r.datetime||''}</div>
                          <div style={{fontSize:12,color:'#2C3E50',fontWeight:i===0?600:400}}>{r.message||r.routeDesc||''}</div>
                        </div>
                      </div>
                    ))}
                  </div>}
                  {trackSearchResult.local && <div style={{padding:'12px 20px',borderTop:'1px solid #EAECEE',background:'#FAFAFA'}}>
                    <div style={{fontSize:11,color:'#85929E',marginBottom:6}}>ข้อมูลในระบบ</div>
                    <div style={{fontSize:12}}>
                      <span style={{color:'#2C3E50',fontWeight:600}}>{trackSearchResult.local.customer_name}</span> | {trackSearchResult.local.customer_phone} | {trackSearchResult.local.district} {trackSearchResult.local.province}
                      {trackSearchResult.local.payment_type==='cod'&&<span style={{marginLeft:8,color:'#E74C3C',fontWeight:700}}>COD ฿{fmt(parseFloat(trackSearchResult.local.cod_amount||trackSearchResult.local.sale_price)||0)}</span>}
                    </div>
                    {trackSearchResult.local.remark&&<div style={{fontSize:11,color:'#85929E',marginTop:2}}>Note: {trackSearchResult.local.remark}</div>}
                  </div>}
                </>)}
                </>}
              </div>}
            </div>
          </div>}

          {/* ═══ PAGE: รายชื่อรออัพเซล ═══ */}
          {sidebarPage === 'upsell' && <div>
            <div style={{fontSize:20,fontWeight:800,marginBottom:6}}>💰 รายชื่อรออัพเซล</div>
            <div style={{fontSize:12,color:'#85929E',marginBottom:16}}>เลือกจากหน้าการจัดส่ง → กดปุ่ม "💰 รออัพเซล" → รายชื่อจะมาอยู่ที่นี่</div>

            {(() => {
              const upsellOrders = orders.filter(o => o.shipping_status === 'upsell' && o.flash_pno)
              const doneUpsell = async (ids) => {
                setGProgress({ label: '✅ อัพเซลเสร็จ', done: 0, total: ids.length, color: '#27AE60' })
                for (let i = 0; i < ids.length; i++) {
                  setGProgress(p => ({ ...p, done: i + 1 }))
                  await supabase.from('mt_orders').update({ shipping_status: 'printed' }).eq('id', ids[i])
                  setOrders(prev => prev.map(o => o.id === ids[i] ? { ...o, shipping_status: 'printed' } : o))
                  if (i < ids.length - 1) await new Promise(r => setTimeout(r, 50))
                }
                setGProgress(null); setUpsellSelected(new Set())
                flash('✅ เสร็จแล้ว ' + ids.length + ' รายการ')
                logActivity('upsell_done', `อัพเซลเสร็จ ${ids.length} รายการ`, ids.length)
              }
              return <>
                {upsellOrders.length > 0 && <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center'}}>
                  <span style={{fontSize:13,fontWeight:700,color:'#8E44AD'}}>⚡ {upsellOrders.length} รายการรออัพเซล</span>
                  {upsellSelected.size > 0 && <>
                    <button onClick={()=>doneUpsell([...upsellSelected])} style={{padding:'6px 14px',borderRadius:6,border:'none',background:'#27AE60',color:'#fff',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>✅ อัพเซลเสร็จ ({upsellSelected.size})</button>
                    <button onClick={()=>setUpsellSelected(new Set())} style={{padding:'6px 8px',borderRadius:6,border:'1px solid #DEE2E6',background:'#fff',color:'#85929E',fontSize:11,cursor:'pointer'}}>✕</button>
                  </>}
                </div>}

                {upsellOrders.length === 0 ? <div style={{textAlign:'center',padding:40,color:'#85929E',background:'#fff',borderRadius:8,border:'1px solid #DEE2E6'}}>
                  <div style={{fontSize:40,marginBottom:12}}>💰</div>
                  <div style={{fontWeight:700,marginBottom:6}}>ยังไม่มีรายชื่อรออัพเซล</div>
                  <div style={{fontSize:12}}>ไปหน้า 🚚 การจัดส่ง → เลือกรายชื่อ → กด "💰 รออัพเซล"</div>
                </div> : (
                  <div style={{background:'#fff',borderRadius:8,border:'1px solid #DEE2E6',overflow:'hidden'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,fontFamily:T.font}}>
                      <thead><tr style={{background:'#F8F9FA'}}>
                        <th style={{padding:'10px 8px',width:36,borderBottom:'1px solid #DEE2E6'}}>
                          <input type="checkbox" checked={upsellOrders.length>0&&upsellOrders.every(o=>upsellSelected.has(o.id))} onChange={()=>{const ids=upsellOrders.map(o=>o.id);const allSel=ids.every(id=>upsellSelected.has(id));setUpsellSelected(prev=>{const n=new Set(prev);ids.forEach(id=>allSel?n.delete(id):n.add(id));return n})}} style={{cursor:'pointer'}} />
                        </th>
                        {['#','วันที่','ลูกค้า','เบอร์','เลขพัสดุ','COD เดิม','หมายเหตุ','อัพเซล','เสร็จ'].map(h=><th key={h} style={{padding:'10px 8px',textAlign:'left',fontWeight:600,color:'#5D6D7E',borderBottom:'1px solid #DEE2E6',fontSize:11}}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {upsellOrders.map((o,i) => (
                          <tr key={o.id} style={{borderBottom:'1px solid #EAECEE',background:upsellSelected.has(o.id)?'#F4ECF7':'#fff'}}>
                            <td style={{padding:'10px 8px',textAlign:'center'}}>
                              <input type="checkbox" checked={upsellSelected.has(o.id)} onChange={()=>setUpsellSelected(prev=>{const n=new Set(prev);n.has(o.id)?n.delete(o.id):n.add(o.id);return n})} style={{cursor:'pointer'}} />
                            </td>
                            <td style={{padding:'10px 8px',textAlign:'center',color:'#ABB2B9',fontSize:10}}>{i+1}</td>
                            <td style={{padding:'10px 8px',fontSize:11}}>{new Date(o.created_at).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'2-digit',month:'short'})}</td>
                            <td style={{padding:'10px 8px',fontWeight:600}}>{o.customer_name}</td>
                            <td style={{padding:'10px 8px',color:'#85929E',fontSize:11}}>{o.customer_phone}</td>
                            <td style={{padding:'10px 8px'}}><span style={{fontFamily:'monospace',fontSize:11,color:'#2980B9',fontWeight:700}}>{o.flash_pno}</span></td>
                            <td style={{padding:'10px 8px',fontWeight:700,color:'#E74C3C'}}>฿{fmt(parseFloat(o.cod_amount||o.sale_price)||0)}</td>
                            <td style={{padding:'10px 8px',fontSize:10,color:'#85929E',maxWidth:200,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{o.remark||'—'}</td>
                            <td style={{padding:'10px 8px'}}><button onClick={()=>openUpsell(o)} style={{padding:'6px 14px',borderRadius:6,border:'none',background:'linear-gradient(135deg,#8E44AD,#9B59B6)',color:'#fff',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>💰</button></td>
                            <td style={{padding:'10px 8px'}}><button onClick={()=>doneUpsell([o.id])} style={{padding:'6px 10px',borderRadius:6,border:'1px solid #27AE60',background:'#EAFAF1',color:'#27AE60',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>✅</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            })()}
          </div>}

          {/* ═══ PAGE: ประวัติ ═══ */}
          {sidebarPage === 'history' && <div>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
              <div style={{fontSize:20,fontWeight:800}}>📋 ประวัติการดำเนินการ</div>
              <button onClick={loadActivityLogs} style={{padding:'7px 14px',borderRadius:6,border:'1px solid #3498DB',background:'#EBF5FB',color:'#3498DB',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>🔄 รีเฟรช</button>
            </div>

            {/* Filter tabs */}
            <div style={{display:'flex',gap:0,borderBottom:'2px solid #EAECEE',marginBottom:16,overflowX:'auto'}}>
              {[
                {id:'all',i:'📋',l:'ทั้งหมด',c:'#2980B9'},
                {id:'print',i:'🖨',l:'ปริ้น',c:'#16A085'},
                {id:'export',i:'📊',l:'Export',c:'#27AE60'},
                {id:'status_change',i:'🔄',l:'เปลี่ยนสถานะ',c:'#3498DB'},
                {id:'create_pno',i:'⚡',l:'สร้างเลขพัสดุ',c:'#8E44AD'},
                {id:'upsell',i:'💰',l:'อัพเซล',c:'#E67E22'},
                {id:'delete',i:'🗑',l:'ลบ',c:'#E74C3C'},
                {id:'cancel',i:'❌',l:'ยกเลิก',c:'#C0392B'},
              ].map(f=>{
                const count = logFilter==='all'? activityLogs.length : activityLogs.filter(l=>f.id==='all'||l.action_type===f.id||(f.id==='upsell'&&(l.action_type==='upsell'||l.action_type==='upsell_done'))).length
                return <button key={f.id} onClick={()=>setLogFilter(f.id)} style={{
                  padding:'8px 14px',border:'none',cursor:'pointer',fontFamily:T.font,fontSize:11,fontWeight:500,
                  background:'transparent',color:logFilter===f.id?f.c:'#85929E',
                  borderBottom:logFilter===f.id?`3px solid ${f.c}`:'3px solid transparent',marginBottom:-2,whiteSpace:'nowrap'
                }}>{f.i} {f.l}</button>
              })}
            </div>

            {(() => {
              const filtered = logFilter === 'all' ? activityLogs :
                logFilter === 'upsell' ? activityLogs.filter(l=>l.action_type==='upsell'||l.action_type==='upsell_done') :
                activityLogs.filter(l => l.action_type === logFilter)
              const typeIcon = { print:'🖨', export:'📊', status_change:'🔄', create_pno:'⚡', upsell:'💰', upsell_done:'✅', delete:'🗑', cancel:'❌', refresh_status:'🔄' }
              const typeColor = { print:'#16A085', export:'#27AE60', status_change:'#3498DB', create_pno:'#8E44AD', upsell:'#E67E22', upsell_done:'#27AE60', delete:'#E74C3C', cancel:'#C0392B', refresh_status:'#3498DB' }
              const typeName = { print:'ปริ้น', export:'Export', status_change:'เปลี่ยนสถานะ', create_pno:'สร้างเลขพัสดุ', upsell:'อัพเซล', upsell_done:'อัพเซลเสร็จ', delete:'ลบ', cancel:'ยกเลิก', refresh_status:'อัพเดทสถานะ' }
              return <>
                <div style={{fontSize:12,color:'#85929E',marginBottom:10}}>แสดง {filtered.length} รายการ</div>
                <div style={{background:'#fff',borderRadius:8,border:'1px solid #DEE2E6',overflow:'hidden'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,fontFamily:T.font}}>
                    <thead><tr style={{background:'#F8F9FA'}}>
                      {['#','วันเวลา','ประเภท','รายละเอียด','จำนวน','ผู้ดำเนินการ'].map(h=>(
                        <th key={h} style={{padding:'10px 10px',textAlign:'left',fontWeight:600,color:'#5D6D7E',borderBottom:'1px solid #DEE2E6',fontSize:11}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {filtered.map((log,i)=>(
                        <tr key={log.id} style={{borderBottom:'1px solid #EAECEE'}}>
                          <td style={{padding:'10px',textAlign:'center',color:'#ABB2B9',fontSize:10}}>{i+1}</td>
                          <td style={{padding:'10px',fontSize:11,color:'#2C3E50',fontWeight:600}}>{new Date(log.created_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit'})}</td>
                          <td style={{padding:'10px'}}><span style={{padding:'3px 10px',borderRadius:6,fontSize:10,fontWeight:700,background:(typeColor[log.action_type]||'#85929E')+'18',color:typeColor[log.action_type]||'#85929E'}}>{typeIcon[log.action_type]||'📋'} {typeName[log.action_type]||log.action_type}</span></td>
                          <td style={{padding:'10px',fontSize:12}}>{log.description}</td>
                          <td style={{padding:'10px',textAlign:'center',fontWeight:700,color:'#2C3E50'}}>{log.order_count||'—'}</td>
                          <td style={{padding:'10px',fontSize:11,color:'#85929E'}}>{log.user_name||'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.length===0&&<div style={{textAlign:'center',padding:40,color:'#85929E'}}>ไม่มีประวัติ</div>}
                </div>
              </>
            })()}
          </div>}

        </div>
      </div>
    </div>
  )
}
