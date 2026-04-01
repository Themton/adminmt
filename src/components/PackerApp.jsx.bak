import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { trackFlashOrder } from '../lib/flashApi'
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

  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 3000) }

  // Flash Sender Info
  const [flashSrcInfo] = useState(() => {
    try { return JSON.parse(localStorage.getItem('flash_src') || '{}') } catch { return {} }
  })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      let all = [], from = 0
      while (true) {
        const { data } = await supabase.from('mt_orders').select('*').order('created_at', { ascending: false }).range(from, from + 999)
        if (!data || data.length === 0) break
        all = [...all, ...data]; from += 1000
        if (data.length < 1000) break
      }
      setOrders(all); setLoading(false)
    }
    load()
    const ch = supabase.channel('packer-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mt_orders' }, p => setOrders(prev => prev.some(o => o.id === p.new.id) ? prev : [p.new, ...prev]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mt_orders' }, p => setOrders(prev => prev.map(o => o.id === p.new.id ? p.new : o)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'mt_orders' }, p => setOrders(prev => prev.filter(o => o.id !== p.old.id)))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  // ═══ Flash Status ═══
  const flashStateMap = {
    1: { label: 'สร้างออเดอร์', bg: '#EBEDEF', color: '#5D6D7E', icon: '📥' },
    2: { label: 'รับพัสดุแล้ว', bg: '#D4E6F1', color: '#2471A3', icon: '📦' },
    3: { label: 'ศูนย์คัดแยก', bg: '#D4E6F1', color: '#2471A3', icon: '🏭' },
    4: { label: 'กำลังจัดส่ง', bg: '#FDEBD0', color: '#CA6F1E', icon: '🛵' },
    5: { label: 'เซ็นรับแล้ว', bg: '#D5F5E3', color: '#1E8449', icon: '✅' },
    6: { label: 'ตีกลับ', bg: '#FADBD8', color: '#C0392B', icon: '↩️' },
  }

  const getBadge = (o) => {
    if (!o.flash_pno) {
      return o.shipping_status === 'printed'
        ? { label: 'พร้อมส่ง', bg: '#D5F5E3', color: '#1E8449', icon: '✅' }
        : { label: 'เตรียมส่ง', bg: '#FDEBD0', color: '#CA6F1E', icon: '🚚' }
    }
    if (o.flash_status === 'cancelled') return { label: 'ยกเลิก', bg: '#FADBD8', color: '#C0392B', icon: '❌' }
    const n = parseInt((o.flash_status || '').replace('flash_', '')) || 0
    if (n > 0 && flashStateMap[n]) return flashStateMap[n]
    return { label: 'รับเข้าระบบ', bg: '#D4E6F1', color: '#2471A3', icon: '📥' }
  }

  // ═══ Refresh Flash Status ═══
  const refreshStatus = async () => {
    const withPno = dateFiltered.filter(o => o.flash_pno && o.flash_status !== 'cancelled')
    if (!withPno.length) { flash('❌ ไม่มีรายการที่มีเลขพัสดุ'); return }
    setRefreshing(true)
    let updated = 0
    for (let i = 0; i < withPno.length; i++) {
      if (i % 5 === 0) flash(`⏳ อัพเดท ${i+1}/${withPno.length}...`)
      const result = await trackFlashOrder(withPno[i].flash_pno)
      if (result.code === 1 && result.data) {
        const state = result.data.state || 0
        const ns = 'flash_' + state
        await supabase.from('mt_orders').update({ flash_status: ns }).eq('id', withPno[i].id)
        setOrders(prev => prev.map(o => o.id === withPno[i].id ? { ...o, flash_status: ns } : o))
        updated++
      }
      if (i < withPno.length - 1) await new Promise(r => setTimeout(r, 150))
    }
    setRefreshing(false)
    flash(`✅ อัพเดทสถานะ ${updated} รายการ`)
  }

  // ═══ Label Printing (html2canvas + jsPDF) ═══
  const labelHTML = (order, idx, total) => {
    const pno = order.flash_pno || ''
    const phone = order.customer_phone || ''
    const mp = phone.length >= 7 ? phone.substring(0,3) + '****' + phone.substring(phone.length-3) : phone
    const cod = order.payment_type === 'cod' ? (parseFloat(order.cod_amount || order.sale_price) || 0) : 0
    const now = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const dst = (order.district || '') + ' — ' + (order.province || '')
    const src = (flashSrcInfo.name || 'THE MT') + ' ' + (flashSrcInfo.phone || '') + ' ' + (flashSrcInfo.address || '') + ' ' + (flashSrcInfo.district || '') + ' ' + (flashSrcInfo.province || '') + ' ' + (flashSrcInfo.zip || '')
    return `<div style="width:400px;height:300px;background:#fff;font-family:sans-serif;overflow:hidden;position:relative">
      ${order.flash_sort_code ? `<div style="text-align:center;padding:2px 0;font-size:20px;font-weight:900;font-family:monospace;border-bottom:2px solid #000;position:relative"><span style="position:absolute;left:4px;top:3px;background:#E67E22;color:#fff;width:20px;height:20px;border-radius:3px;display:inline-flex;align-items:center;justify-content:center;font-size:12px">${idx}</span>${order.flash_sort_code}</div>` : ''}
      <div style="text-align:center;padding:1px 8px;border-bottom:2px solid #000"><svg id="lbc-${idx}" style="width:384px;height:40px"></svg></div>
      <div style="text-align:center;padding:2px;font-size:13px;font-weight:900;font-family:monospace;letter-spacing:1px;background:#f0f0f0;border-bottom:2px solid #000">${pno}</div>
      <div style="background:#444;color:#fff;padding:2px 8px;font-size:10px;font-weight:700">DST &nbsp; ${dst}</div>
      <div style="padding:1px 8px;font-size:7px;color:#777;border-bottom:1px solid #ddd;overflow:hidden;white-space:nowrap">${src.trim()}</div>
      <div style="display:flex">
        <div style="flex:1;padding:3px 8px">
          <div style="font-weight:700;font-size:12px">ผู้รับ ${order.customer_name || ''}</div>
          <div style="font-size:18px;font-weight:900;letter-spacing:1px">${mp}</div>
          <div style="font-size:9px;color:#333;line-height:1.3">${order.customer_address || ''}</div>
          <div style="font-size:9px;color:#333">${order.sub_district || ''}, ${order.district || ''}</div>
          <div style="font-size:9px;color:#333">${order.province || ''} ${order.zip_code || ''}</div>
        </div>
        <div id="lqr-${idx}" style="width:70px;display:flex;align-items:center;justify-content:center;padding:2px"></div>
      </div>
      ${cod > 0 ? `<div style="background:#1a1a1a;color:#fff;padding:3px 8px;font-size:15px;font-weight:900;display:flex;align-items:center;gap:6px"><span style="background:#E67E22;padding:1px 6px;border-radius:3px;font-size:10px">COD</span>เก็บเงินค่าสินค้า COD ${cod.toLocaleString()}</div>` : ''}
      ${order.remark ? `<div style="padding:2px 8px;font-size:11px;font-weight:700;border-top:1px solid #ddd;overflow:hidden;white-space:nowrap">Note: ${order.remark}</div>` : ''}
      <div style="padding:1px 8px;font-size:7px;color:#999;display:flex;justify-content:space-between;border-top:1px solid #eee"><span>Print-: ${now}</span><span>${idx}/${total}</span><span>THE MT</span></div>
    </div>`
  }

  const buildLabelPDF = async (labelOrders) => {
    const loadScript = (url) => new Promise((resolve) => {
      if (document.querySelector(`script[src="${url}"]`)) { resolve(); return }
      const s = document.createElement('script'); s.src = url; s.onload = resolve; document.head.appendChild(s)
    })
    await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js')
    await loadScript('https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js')
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js')
    await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js')

    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px'
    document.body.appendChild(container)

    const { jsPDF } = window.jspdf
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [75, 100] })

    for (let i = 0; i < labelOrders.length; i++) {
      flash(`⏳ สร้างใบปะหน้า ${i+1}/${labelOrders.length}...`)
      if (i > 0) doc.addPage([75, 100], 'landscape')
      const div = document.createElement('div')
      div.innerHTML = labelHTML(labelOrders[i], i+1, labelOrders.length)
      container.appendChild(div)
      const pno = labelOrders[i].flash_pno || ''
      try { JsBarcode('#lbc-' + (i+1), pno, { format:'CODE128', width:1.8, height:34, displayValue:false, margin:0 }) } catch(e) {}
      try { new QRCode(document.getElementById('lqr-' + (i+1)), { text:pno, width:58, height:58, correctLevel: QRCode.CorrectLevel.M }) } catch(e) {}
      await new Promise(r => setTimeout(r, 200))
      const canvas = await html2canvas(div.firstChild, { scale: 3, backgroundColor: '#ffffff', useCORS: true })
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 100, 75)
      container.removeChild(div)
    }
    document.body.removeChild(container)
    window.open(URL.createObjectURL(doc.output('blob')), '_blank')
    flash(`✅ สร้างใบปะหน้า ${labelOrders.length} รายการสำเร็จ`)
  }

  const printLabels = async (targetOrders) => {
    const withPno = targetOrders.filter(o => o.flash_pno)
    if (!withPno.length) { flash('❌ ไม่มีรายการที่มีเลขพัสดุ'); return }
    await buildLabelPDF(withPno)
  }

  // ═══ Filters ═══
  const dateFiltered = orders.filter(o => {
    if (dateFilter) { const od = (o.order_date || '').substring(0, 10); if (od < dateFilter) return false }
    if (dateFilterEnd) { const od = (o.order_date || '').substring(0, 10); if (od > dateFilterEnd) return false }
    return true
  })

  const shipOrders = dateFiltered.filter(o => {
    if (shipFilter === 'preparing') return (!o.shipping_status || o.shipping_status === 'waiting') && !o.flash_pno
    if (shipFilter === 'insystem') return o.flash_pno && ['created','manual','flash_1'].includes(o.flash_status)
    if (shipFilter === 'pickedup') return ['flash_2','flash_3'].includes(o.flash_status)
    if (shipFilter === 'delivering') return o.flash_status === 'flash_4'
    if (shipFilter === 'delivered') return o.flash_status === 'flash_5'
    if (shipFilter === 'returned') return o.flash_status === 'flash_6' || o.flash_status === 'cancelled'
    return true
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  const searchFiltered = shipOrders.filter(o => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (o.customer_name || '').toLowerCase().includes(q) || (o.customer_phone || '').includes(q) || (o.flash_pno || '').includes(q) || (o.remark || '').toLowerCase().includes(q)
  })

  const markStatus = async (ids, status) => {
    await supabase.from('mt_orders').update({ shipping_status: status }).in('id', ids)
    setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, shipping_status: status } : o))
    flash(`✅ อัพเดท ${ids.length} รายการ`)
    setSelectedIds(new Set())
  }

  const lastRef = useRef(null)
  const toggleSelect = (id, e) => {
    const list = searchFiltered.slice((page-1)*pageSize, page*pageSize)
    const idx = list.findIndex(o => o.id === id)
    if (e?.shiftKey && lastRef.current !== null) {
      const s = Math.min(lastRef.current, idx), en = Math.max(lastRef.current, idx)
      setSelectedIds(prev => { const n = new Set(prev); for (let i = s; i <= en; i++) n.add(list[i].id); return n })
    } else {
      setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    }
    lastRef.current = idx
  }
  const toggleAll = () => {
    const pIds = searchFiltered.slice((page-1)*pageSize, page*pageSize).map(o => o.id)
    const allSel = pIds.every(id => selectedIds.has(id))
    setSelectedIds(prev => { const n = new Set(prev); pIds.forEach(id => allSel ? n.delete(id) : n.add(id)); return n })
  }

  // ═══ Filter counts ═══
  const counts = {
    all: dateFiltered.length,
    preparing: dateFiltered.filter(o => (!o.shipping_status || o.shipping_status === 'waiting') && !o.flash_pno).length,
    insystem: dateFiltered.filter(o => o.flash_pno && ['created','manual','flash_1'].includes(o.flash_status)).length,
    pickedup: dateFiltered.filter(o => ['flash_2','flash_3'].includes(o.flash_status)).length,
    delivering: dateFiltered.filter(o => o.flash_status === 'flash_4').length,
    delivered: dateFiltered.filter(o => o.flash_status === 'flash_5').length,
    returned: dateFiltered.filter(o => o.flash_status === 'flash_6' || o.flash_status === 'cancelled').length,
  }

  return (
    <div style={{ fontFamily: T.font, minHeight: '100vh', background: T.bg, color: T.text, paddingBottom: 40 }}>
      <Toast message={toast} />

      {/* Header */}
      <div style={{ ...glass, borderRadius: 0, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.95)', borderBottom: `1px solid ${T.border}` }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><img src="./logo.png" alt="" style={{ height: 32 }} /> <span style={{ fontSize: 18, fontWeight: 900 }}>ADMIN THE MT</span><LiveDot /></div>
          <div style={{ fontSize: 11, color: T.textDim }}>{profile.full_name} — 📦 พนักงานจัดส่ง</div>
        </div>
        <button onClick={onLogout} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.textDim, fontSize: 12, cursor: 'pointer', fontFamily: T.font }}>ออก</button>
      </div>

      <div style={{ maxWidth: 1600, margin: '0 auto', padding: '16px 20px' }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 14 }}>🚚 การจัดส่ง</div>

        {/* วันที่ */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" value={dateFilter} onChange={e => { setDateFilter(e.target.value); if (!dateFilterEnd || e.target.value > dateFilterEnd) setDateFilterEnd(e.target.value); setQuickFilter(''); setPage(1) }}
            style={{ padding: '7px 10px', borderRadius: 6, background: '#fff', border: `1px solid ${T.border}`, fontSize: 12, fontFamily: T.font }} />
          <span style={{ color: T.textDim }}>—</span>
          <input type="date" value={dateFilterEnd} onChange={e => { setDateFilterEnd(e.target.value); setQuickFilter(''); setPage(1) }}
            style={{ padding: '7px 10px', borderRadius: 6, background: '#fff', border: `1px solid ${T.border}`, fontSize: 12, fontFamily: T.font }} />
          {[
            { id: 'today', label: 'วันนี้', fn: () => { setDateFilter(todayStr); setDateFilterEnd(todayStr) } },
            { id: '7days', label: '7 วัน', fn: () => { const d = new Date(); d.setDate(d.getDate()-6); setDateFilter(d.toISOString().split('T')[0]); setDateFilterEnd(todayStr) } },
            { id: 'month', label: 'เดือนนี้', fn: () => { setDateFilter(new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0')+'-01'); setDateFilterEnd(todayStr) } },
          ].map(b => <button key={b.id} onClick={() => { b.fn(); setQuickFilter(b.id); setPage(1) }} style={{ padding: '7px 14px', borderRadius: 6, border: quickFilter === b.id ? 'none' : `1px solid ${T.border}`, background: quickFilter === b.id ? '#E67E22' : '#fff', color: quickFilter === b.id ? '#fff' : T.textDim, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: T.font }}>{b.label}</button>)}
          <div style={{ flex: 1 }} />
          <input placeholder="ค้นหา ชื่อ เบอร์ เลขพัสดุ..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1) }}
            style={{ padding: '7px 12px', borderRadius: 6, border: `1px solid ${T.border}`, fontSize: 12, fontFamily: T.font, width: 200 }} />
          <button onClick={refreshStatus} disabled={refreshing} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #3498DB', background: '#EBF5FB', color: '#3498DB', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: T.font }}>{refreshing ? '⏳...' : '🔄 อัพเดทสถานะ'}</button>
        </div>

        {/* สถานะ Flash tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #EAECEE', marginBottom: 12, overflowX: 'auto' }}>
          {[
            { id: 'all', icon: '📦', label: 'ทั้งหมด', color: '#2980B9' },
            { id: 'preparing', icon: '🚚', label: 'เตรียมส่ง', color: '#E67E22' },
            { id: 'insystem', icon: '📥', label: 'รับเข้าระบบ', color: '#5D6D7E' },
            { id: 'pickedup', icon: '📦', label: 'รับพัสดุแล้ว', color: '#2471A3' },
            { id: 'delivering', icon: '🛵', label: 'กำลังจัดส่ง', color: '#CA6F1E' },
            { id: 'delivered', icon: '✅', label: 'เซ็นรับแล้ว', color: '#1E8449' },
            { id: 'returned', icon: '↩️', label: 'ตีกลับ', color: '#C0392B' },
          ].map(f => (
            <button key={f.id} onClick={() => { setShipFilter(f.id); setPage(1) }} style={{
              padding: '8px 12px', border: 'none', cursor: 'pointer', fontFamily: T.font, fontSize: 11, fontWeight: 500,
              background: 'transparent', color: shipFilter === f.id ? f.color : '#85929E',
              borderBottom: shipFilter === f.id ? `3px solid ${f.color}` : '3px solid transparent',
              marginBottom: -2, whiteSpace: 'nowrap'
            }}>
              {f.icon} {f.label} <strong style={{ marginLeft: 2, color: shipFilter === f.id ? f.color : '#ABB2B9' }}>{counts[f.id]}</strong>
            </button>
          ))}
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, padding: '10px 14px', background: '#EBF5FB', borderRadius: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#2980B9' }}>✔ เลือก {selectedIds.size} รายการ</span>
            <button onClick={() => markStatus([...selectedIds], 'waiting')} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #E67E22', background: '#FEF5E7', color: '#E67E22', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: T.font }}>🚚 เตรียมส่ง</button>
            <button onClick={() => markStatus([...selectedIds], 'printed')} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #27AE60', background: '#EAFAF1', color: '#27AE60', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: T.font }}>🖨 ปริ้นแล้ว</button>
            <button onClick={() => printLabels(orders.filter(o => selectedIds.has(o.id)))} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #E67E22', background: '#FEF5E7', color: '#E67E22', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: T.font }}>🖨 ปริ้นใบปะหน้า</button>
            <button onClick={() => {
              exportProshipExcel(orders.filter(o => selectedIds.has(o.id)), 'Selected.xlsx', profile, 'shipping')
              flash('✅ Export สำเร็จ')
            }} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #2980B9', background: '#EBF5FB', color: '#2980B9', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: T.font }}>📊 Export</button>
            <button onClick={() => setSelectedIds(new Set())} style={{ padding: '6px 8px', borderRadius: 6, border: `1px solid ${T.border}`, background: '#fff', color: '#85929E', fontSize: 11, cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #DEE2E6', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: T.font, minWidth: 1000 }}>
              <thead>
                <tr style={{ background: '#F8F9FA' }}>
                  <th style={{ padding: '10px 6px', textAlign: 'center', borderBottom: '1px solid #DEE2E6', width: 36 }}>
                    <input type="checkbox" checked={(() => { const p = searchFiltered.slice((page-1)*pageSize, page*pageSize).map(o=>o.id); return p.length>0 && p.every(id=>selectedIds.has(id)) })()} onChange={toggleAll} style={{ cursor:'pointer' }} />
                  </th>
                  {['#','วันที่','เวลา','ลูกค้า','เบอร์','สถานะ','เลขพัสดุ','COD','หมายเหตุ','พนักงาน'].map(h => (
                    <th key={h} style={{ padding: '10px 6px', textAlign: 'left', fontWeight: 600, color: '#5D6D7E', borderBottom: '1px solid #DEE2E6', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {searchFiltered.slice((page-1)*pageSize, page*pageSize).map((o, i) => {
                  const dt = new Date(o.created_at)
                  const badge = getBadge(o)
                  return (
                    <tr key={o.id} style={{ borderBottom: '1px solid #EAECEE', background: selectedIds.has(o.id) ? '#EBF5FB' : '#fff' }}>
                      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                        <input type="checkbox" checked={selectedIds.has(o.id)} onClick={e => toggleSelect(o.id, e)} readOnly style={{ cursor: 'pointer' }} />
                      </td>
                      <td style={{ padding: '8px 6px', textAlign: 'center', color: '#ABB2B9', fontSize: 11 }}>{(page-1)*pageSize + i + 1}</td>
                      <td style={{ padding: '8px 6px', fontSize: 11 }}>{dt.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td style={{ padding: '8px 6px', fontSize: 11, color: T.textDim }}>{dt.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={{ padding: '8px 6px', fontWeight: 600 }}>{o.customer_name}</td>
                      <td style={{ padding: '8px 6px', color: T.textDim }}>{o.customer_phone}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                        <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.color }}>{badge.icon} {badge.label}</span>
                      </td>
                      <td style={{ padding: '8px 6px' }}>
                        {o.flash_pno ? <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#2980B9', fontWeight: 700 }}>{o.flash_pno}</span> : <span style={{ color: '#CCD1D1', fontSize: 10 }}>—</span>}
                      </td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700 }}>
                        {o.payment_type === 'cod' ? <span style={{ color: '#E74C3C' }}>฿{fmt(parseFloat(o.cod_amount || o.sale_price) || 0)}</span> : <span style={{ color: '#27AE60', fontSize: 10 }}>โอน</span>}
                      </td>
                      <td style={{ padding: '8px 6px', fontSize: 10, color: T.textDim, maxWidth: 150, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{o.remark || ''}</td>
                      <td style={{ padding: '8px 6px', fontSize: 11, color: T.textDim }}>{o.employee_name || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {searchFiltered.length === 0 && !loading && <Empty text="ไม่มีออเดอร์" />}
            {loading && <div style={{ textAlign: 'center', padding: 40, color: T.textDim }}>⏳ กำลังโหลด...</div>}
          </div>
        </div>

        <Pagination total={searchFiltered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>
    </div>
  )
}
