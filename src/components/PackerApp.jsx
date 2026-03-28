import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { T, glass, fmt, fmtDateTime, LiveDot, Toast, Empty } from './ui'
import { exportProshipExcel, exportProshipCSV } from '../lib/exportProship'

export default function PackerApp({ profile, onLogout }) {
  const [orders, setOrders] = useState([])
  const [toast, setToast] = useState(null)
  const [shipFilter, setShipFilter] = useState('waiting')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const todayStr = new Date().toISOString().split('T')[0]
  const [dateFilter, setDateFilter] = useState('')
  const [dateFilterEnd, setDateFilterEnd] = useState('')
  const [quickFilter, setQuickFilter] = useState('')

  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 3000) }

  useEffect(() => {
    const loadOrders = async () => {
      let all = [], from = 0
      while (true) {
        const { data } = await supabase.from('mt_orders').select('*').order('created_at', { ascending: false }).range(from, from + 999)
        if (!data || data.length === 0) break
        all = [...all, ...data]; from += 1000
        if (data.length < 1000) break
      }
      setOrders(all)
    }
    loadOrders()

    const ch = supabase.channel('packer-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mt_orders' },
        (payload) => { setOrders(prev => prev.some(o => o.id === payload.new.id) ? prev : [payload.new, ...prev]) })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mt_orders' },
        (payload) => { setOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new : o)) })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  // กรองตามวันที่
  const dateFiltered = orders.filter(o => {
    if (dateFilter) { const od = (o.order_date || '').substring(0, 10); if (od < dateFilter) return false }
    if (dateFilterEnd) { const od = (o.order_date || '').substring(0, 10); if (od > dateFilterEnd) return false }
    return true
  })

  const shipOrders = dateFiltered.filter(o => {
    if (shipFilter === 'waiting') return !o.shipping_status || o.shipping_status === 'waiting'
    if (shipFilter === 'printed') return o.shipping_status === 'printed'
    return true
  })

  const searchFiltered = shipOrders.filter(o => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (o.customer_name || '').toLowerCase().includes(q) || (o.customer_phone || '').includes(q) || (o.employee_name || '').toLowerCase().includes(q) || (o.remark || '').toLowerCase().includes(q)
  })

  const waitingCount = dateFiltered.filter(o => !o.shipping_status || o.shipping_status === 'waiting').length
  const printedCount = dateFiltered.filter(o => o.shipping_status === 'printed').length

  const markPrinted = async (ids) => {
    const { error } = await supabase.from('mt_orders').update({ shipping_status: 'printed' }).in('id', ids)
    if (error) { flash('❌ ' + error.message); return }
    setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, shipping_status: 'printed' } : o))
    flash('✅ อัพเดทสถานะ ' + ids.length + ' รายการ')
  }

  const markWaiting = async (ids) => {
    const { error } = await supabase.from('mt_orders').update({ shipping_status: 'waiting' }).in('id', ids)
    if (error) { flash('❌ ' + error.message); return }
    setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, shipping_status: 'waiting' } : o))
    flash('✅ เปลี่ยนกลับเป็นรอส่ง ' + ids.length + ' รายการ')
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const toggleAll = () => {
    if (selectedIds.size === searchFiltered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(searchFiltered.map(o => o.id)))
  }

  const exportShip = (type) => {
    const exportData = selectedIds.size > 0 ? searchFiltered.filter(o => selectedIds.has(o.id)) : searchFiltered
    if (type === 'csv') { exportProshipCSV(exportData, 'Orders_' + (dateFilter||'all') + '.csv'); flash('✅ Export CSV สำเร็จ!') }
    else { exportProshipExcel(exportData, 'Orders_' + (dateFilter||'all') + '.xls'); flash('✅ Export Excel สำเร็จ!') }
  }

  return (
    <div style={{ fontFamily: T.font, minHeight: '100vh', background: T.bg, color: T.text, paddingBottom: 40 }}>
      <Toast message={toast} />

      {/* Header */}
      <div style={{ ...glass, borderRadius: 0, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.95)', borderBottom: `1px solid ${T.border}` }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><img src="./logo.png" alt="" style={{ height: 32 }} /> <span style={{ fontSize: 18, fontWeight: 900 }}>ADMIN THE MT</span><LiveDot /></div>
          <div style={{ fontSize: 11, color: T.textDim }}>{profile.full_name} — 📦 พนักงานแพค</div>
        </div>
        <button onClick={onLogout} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.textDim, fontSize: 12, cursor: 'pointer', fontFamily: T.font }}>ออก</button>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ ...glass, padding: 14, marginBottom: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>🚚 การจัดส่ง</div>

          {/* วันที่ + ปุ่มเลือกช่วง */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" value={dateFilter} onChange={e => { setDateFilter(e.target.value); if (!dateFilterEnd || e.target.value > dateFilterEnd) setDateFilterEnd(e.target.value); setQuickFilter('') }}
              style={{ padding: '8px 10px', borderRadius: T.radiusSm, background: T.surfaceAlt, border: `1px solid ${T.border}`, color: T.text, fontSize: 12, fontFamily: T.font, outline: 'none' }} />
            <span style={{ fontSize: 12, color: T.textDim }}>ถึง</span>
            <input type="date" value={dateFilterEnd} onChange={e => { setDateFilterEnd(e.target.value); setQuickFilter('') }}
              style={{ padding: '8px 10px', borderRadius: T.radiusSm, background: T.surfaceAlt, border: `1px solid ${T.border}`, color: T.text, fontSize: 12, fontFamily: T.font, outline: 'none' }} />
            {[
              { id: 'today', label: 'วันนี้', fn: () => { setDateFilter(todayStr); setDateFilterEnd(todayStr); setQuickFilter('today') } },
              { id: '7days', label: '7 วัน', fn: () => { const d = new Date(); d.setDate(d.getDate() - 6); setDateFilter(d.toISOString().split('T')[0]); setDateFilterEnd(todayStr); setQuickFilter('7days') } },
              { id: 'month', label: 'เดือนนี้', fn: () => { const d = new Date(); setDateFilter(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'); setDateFilterEnd(todayStr); setQuickFilter('month') } },
              { id: 'all', label: 'ทั้งหมด', fn: () => { setDateFilter(''); setDateFilterEnd(''); setQuickFilter('all') } },
            ].map(b => (
              <button key={b.id} onClick={b.fn} style={{ padding: '6px 12px', borderRadius: 8, border: quickFilter === b.id ? 'none' : `1px solid ${T.border}`, background: quickFilter === b.id ? 'linear-gradient(135deg, #B8860B, #DAA520)' : '#fff', color: quickFilter === b.id ? '#fff' : T.textDim, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: T.font, boxShadow: quickFilter === b.id ? '0 2px 8px rgba(184,134,11,0.3)' : 'none' }}>{b.label}</button>
            ))}
          </div>

          {/* สถานะ + Export */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { id: 'all', label: '📦 ทั้งหมด', count: dateFiltered.length },
                { id: 'waiting', label: '🟡 รอส่ง', count: waitingCount },
                { id: 'printed', label: '🟢 ปริ้นแล้ว', count: printedCount },
              ].map(b => (
                <button key={b.id} onClick={() => setShipFilter(b.id)} style={{
                  padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontFamily: T.font, fontSize: 12, fontWeight: 700,
                  border: shipFilter === b.id ? 'none' : `1px solid ${T.border}`,
                  background: shipFilter === b.id ? (b.id === 'waiting' ? 'linear-gradient(135deg, #F39C12, #F1C40F)' : b.id === 'printed' ? 'linear-gradient(135deg, #2D8A4E, #27AE60)' : 'linear-gradient(135deg, #B8860B, #DAA520)') : '#fff',
                  color: shipFilter === b.id ? '#fff' : T.textDim,
                  boxShadow: shipFilter === b.id ? '0 2px 8px rgba(0,0,0,0.15)' : 'none'
                }}>{b.label} <span style={{ marginLeft: 4, padding: '2px 8px', borderRadius: 6, background: shipFilter === b.id ? 'rgba(255,255,255,0.3)' : T.surfaceAlt, fontSize: 11 }}>{b.count}</span></button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => exportShip('excel')} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(45,138,78,0.2)', background: 'rgba(45,138,78,0.05)', color: T.success, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: T.font }}>📊 Excel ({searchFiltered.length})</button>
              <button onClick={() => exportShip('csv')} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${T.border}`, background: '#fff', color: T.textDim, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: T.font }}>📥 CSV</button>
            </div>
          </div>

          {/* ค้นหา */}
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="🔍 ค้นหาชื่อ เบอร์ พนักงาน หมายเหตุ..."
            style={{ width: '100%', padding: '10px 12px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 13, fontFamily: T.font, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />

          <div style={{ fontSize: 12, color: T.textDim }}>{searchFiltered.length} รายการ</div>
        </div>

        {/* ปุ่ม bulk */}
        {(shipFilter === 'waiting' && waitingCount > 0) || selectedIds.size > 0 ? (
          <div style={{ ...glass, padding: 12, marginBottom: 10, display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: T.textDim }}>
              {selectedIds.size > 0 ? `เลือก ${selectedIds.size} รายการ` : ''}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {selectedIds.size > 0 && (
                <>
                  <button onClick={() => {
                    const ids = [...selectedIds]
                    if (confirm(`🖨 เปลี่ยน ${ids.length} รายการ เป็น "ปริ้นแล้ว"?`)) { markPrinted(ids); setSelectedIds(new Set()) }
                  }} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #2D8A4E, #27AE60)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: T.font }}>🖨 ปริ้นที่เลือก ({selectedIds.size})</button>
                  <button onClick={() => {
                    const ids = [...selectedIds]
                    if (confirm(`↩ เปลี่ยน ${ids.length} รายการ เป็น "รอส่ง"?`)) { markWaiting(ids); setSelectedIds(new Set()) }
                  }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(243,156,18,0.3)', background: 'rgba(243,156,18,0.05)', color: '#F39C12', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: T.font }}>↩ รอส่ง ({selectedIds.size})</button>
                  <button onClick={() => {
                    exportProshipExcel(searchFiltered.filter(o => selectedIds.has(o.id)), 'Orders_selected.xls')
                    flash('✅ Export ' + selectedIds.size + ' รายการ')
                  }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(45,138,78,0.2)', background: 'rgba(45,138,78,0.05)', color: T.success, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: T.font }}>📊 Excel ({selectedIds.size})</button>
                </>
              )}
              {selectedIds.size === 0 && shipFilter === 'waiting' && <button onClick={() => {
                const ids = searchFiltered.filter(o => !o.shipping_status || o.shipping_status === 'waiting').map(o => o.id)
                if (confirm(`✅ เปลี่ยนสถานะ ${ids.length} รายการ เป็น "ปริ้นแล้ว"?`)) markPrinted(ids)
              }} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #2D8A4E, #27AE60)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: T.font, boxShadow: '0 2px 10px rgba(45,138,78,0.3)' }}>🖨 ปริ้นทั้งหมด ({searchFiltered.filter(o => !o.shipping_status || o.shipping_status === 'waiting').length})</button>}
            </div>
          </div>
        ) : null}

        {/* ตาราง */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: T.font, background: 'rgba(255,255,255,0.85)', borderRadius: 14, overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: T.surfaceAlt }}>
                <th style={{ padding: '10px 8px', textAlign: 'center', borderBottom: `1px solid ${T.border}`, width: 36 }}>
                  <input type="checkbox" checked={selectedIds.size === searchFiltered.length && searchFiltered.length > 0} onChange={toggleAll} style={{ cursor: 'pointer', width: 16, height: 16 }} />
                </th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, color: T.textDim, borderBottom: `1px solid ${T.border}`, width: 40 }}>#</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: T.textDim, borderBottom: `1px solid ${T.border}` }}>วันที่</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: T.textDim, borderBottom: `1px solid ${T.border}` }}>เวลา</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: T.textDim, borderBottom: `1px solid ${T.border}` }}>ลูกค้า</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: T.textDim, borderBottom: `1px solid ${T.border}` }}>เบอร์โทรศัพท์</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: T.textDim, borderBottom: `1px solid ${T.border}` }}>ราคา</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, color: T.textDim, borderBottom: `1px solid ${T.border}` }}>ประเภท</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, color: T.textDim, borderBottom: `1px solid ${T.border}` }}>สถานะ</th>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: T.textDim, borderBottom: `1px solid ${T.border}` }}>พนักงาน</th>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, color: T.textDim, borderBottom: `1px solid ${T.border}` }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {searchFiltered.map((o, i) => {
                const dt = new Date(o.created_at)
                const isPrinted = o.shipping_status === 'printed'
                return (
                  <tr key={o.id} style={{ borderBottom: `1px solid ${T.border}`, borderLeft: isPrinted ? '3px solid #2D8A4E' : '3px solid #F39C12', background: selectedIds.has(o.id) ? 'rgba(184,134,11,0.06)' : 'transparent' }}>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <input type="checkbox" checked={selectedIds.has(o.id)} onChange={() => toggleSelect(o.id)} style={{ cursor: 'pointer', width: 16, height: 16 }} />
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: T.gold }}>{o.daily_seq || i + 1}</td>
                    <td style={{ padding: '10px 8px', fontSize: 11 }}>{(o.order_date || '').substring(0, 10)}</td>
                    <td style={{ padding: '10px 8px', fontSize: 11, color: T.textDim }}>{dt.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                    <td style={{ padding: '10px 8px' }}><div style={{ fontWeight: 600 }}>{o.customer_name}</div><div style={{ fontSize: 10, color: T.textMuted }}>{o.remark || ''}</div></td>
                    <td style={{ padding: '10px 8px', color: T.textDim }}>{o.customer_phone}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: T.success }}>฿{fmt(parseFloat(o.sale_price) || 0)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: o.payment_type === 'transfer' ? 'rgba(45,138,78,0.1)' : 'rgba(214,48,49,0.1)', color: o.payment_type === 'transfer' ? T.success : '#D63031' }}>{o.payment_type === 'transfer' ? 'โอน' : 'COD'}</span>
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: isPrinted ? 'rgba(45,138,78,0.1)' : 'rgba(243,156,18,0.1)', color: isPrinted ? T.success : '#F39C12' }}>{isPrinted ? '🖨 ปริ้นแล้ว' : '🟡 รอส่ง'}</span>
                    </td>
                    <td style={{ padding: '10px 8px', fontSize: 11, color: T.textDim }}>{o.employee_name || '—'}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      {isPrinted ? (
                        <button onClick={() => markWaiting([o.id])} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(243,156,18,0.3)', background: 'rgba(243,156,18,0.05)', color: '#F39C12', fontSize: 10, cursor: 'pointer', fontFamily: T.font, fontWeight: 600 }}>↩ รอส่ง</button>
                      ) : (
                        <button onClick={() => markPrinted([o.id])} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(45,138,78,0.3)', background: 'rgba(45,138,78,0.05)', color: T.success, fontSize: 10, cursor: 'pointer', fontFamily: T.font, fontWeight: 600 }}>🖨 ปริ้นแล้ว</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {searchFiltered.length === 0 && <Empty text="ไม่มีออเดอร์" />}
        </div>
      </div>
    </div>
  )
}
