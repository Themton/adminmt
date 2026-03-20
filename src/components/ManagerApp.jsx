import { useState, useEffect, useMemo } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import { syncOrderToSheet, updateOrderInSheet, deleteOrderFromSheet, syncAllToSheet, resetSheet } from '../lib/sheetSync'
import { createFlashOrder, trackFlashOrder } from '../lib/flashApi'
import OrderForm from './OrderForm'
import { T, glass, fmt, fmtDate, fmtDateFull, fmtDateTime, sameDay, withinDays, thisMonth, Stat, Tabs, Btn, Toast, Modal, Empty, LiveDot } from './ui'

function FI({ label, ...p }) {
  return <div style={{ marginBottom: 14 }}>{label && <label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>{label}</label>}<input {...p} style={{ width: '100%', padding: '13px 16px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', boxSizing: 'border-box', ...(p.style||{}) }} /></div>
}

export default function ManagerApp({ profile, onLogout }) {
  const [tab, setTab] = useState('dashboard')
  const [orders, setOrders] = useState([])
  const [teams, setTeams] = useState([])
  const [profiles, setProfiles] = useState([])
  const [toast, setToast] = useState(null)
  const todayStr = new Date().toISOString().split('T')[0]
  const [dateFilter, setDateFilter] = useState(todayStr)
  
  const [userFilter, setUserFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Team modal
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [editTeam, setEditTeam] = useState(null)
  const [teamName, setTeamName] = useState('')

  // User modal
  const [showUserModal, setShowUserModal] = useState(false)
  const [userForm, setUserForm] = useState({ email: '', password: '', fullName: '', role: 'employee', teamId: '' })
  const [editUser, setEditUser] = useState(null)
  const [editUserTeam, setEditUserTeam] = useState('')

  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 3000) }

  // ═══ ลบออเดอร์ ═══
  const deleteOrder = async (order) => {
    if (!confirm(`ลบออเดอร์ "${order.order_number} - ${order.customer_name}"?`)) return
    const { error } = await supabase.from('mt_orders').delete().eq('id', order.id)
    if (error) { flash('❌ ' + error.message); return }
    setOrders(prev => prev.filter(o => o.id !== order.id))
    
    deleteOrderFromSheet(order.order_number)
    flash('🗑 ลบออเดอร์สำเร็จ')
  }

  // ═══ แก้ไขออเดอร์ ═══
  const [editOrder, setEditOrder] = useState(null)
  const saveOrder = async () => {
    if (!editOrder) return
    const u = editOrder
    // validate
    const missing = []
    if (!u.customer_name) missing.push('ชื่อ')
    if (!u.customer_phone) missing.push('เบอร์โทร')
    if (!u.customer_address) missing.push('ที่อยู่')
    if (!u.sub_district) missing.push('ตำบล')
    if (!u.district) missing.push('อำเภอ')
    if (!u.zip_code) missing.push('รหัส ปณ.')
    if (!u.province) missing.push('จังหวัด')
    if (!u.sale_price || parseFloat(u.sale_price) <= 0) missing.push('ราคาขาย')
    if (missing.length > 0) { flash('❌ กรุณากรอก: ' + missing.join(', ')); return }

    const { id, ...updates } = u
    const { data: updated, error } = await supabase.from('mt_orders').update({
      customer_phone: updates.customer_phone, customer_name: updates.customer_name,
      customer_address: updates.customer_address, sub_district: updates.sub_district,
      district: updates.district, zip_code: updates.zip_code, province: updates.province,
      customer_social: updates.customer_social, sales_channel: updates.sales_channel,
      sale_price: updates.sale_price, cod_amount: updates.cod_amount, remark: updates.remark,
    }).eq('id', id).select().single()
    if (error) { flash('❌ ' + error.message); return }
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o))
    
    if (updated?.order_number) {
      updateOrderInSheet(updated)
    }
    setEditOrder(null)
    flash('✅ แก้ไขออเดอร์สำเร็จ')
  }

  // ═══ Flash Express ═══
  const [flashModal, setFlashModal] = useState(null) // { order, result, tracking }
  const [flashSrcInfo, setFlashSrcInfo] = useState(() => {
    try { return JSON.parse(localStorage.getItem('flash_src') || '{}') } catch { return {} }
  })
  const [showFlashSrc, setShowFlashSrc] = useState(false)

  const sendToFlash = async (order) => {
    if (!confirm(`📦 ส่งออเดอร์ไป Flash Express?\n\n${order.customer_name}\n${order.customer_phone}\n${order.district} ${order.province}`)) return
    flash('⏳ กำลังส่งไป Flash...')
    const result = await createFlashOrder(order, flashSrcInfo)
    if (result.code === 1 && result.data?.pno) {
      // บันทึก tracking number ใน Supabase
      await supabase.from('mt_orders').update({ flash_pno: result.data.pno, flash_status: 'created' }).eq('id', order.id)
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, flash_pno: result.data.pno, flash_status: 'created' } : o))
      flash('✅ ส่ง Flash สำเร็จ! ' + result.data.pno)
      setFlashModal({ order, result: result.data })
    } else {
      flash('❌ ส่ง Flash ไม่สำเร็จ: ' + (result.message || 'Unknown error'))
      setFlashModal({ order, error: result.message })
    }
  }

  const trackFlash = async (pno) => {
    flash('⏳ กำลังเช็คสถานะ...')
    const result = await trackFlashOrder(pno)
    if (result.code === 1) {
      setFlashModal({ pno, tracking: result.data })
      flash('✅ โหลดสถานะสำเร็จ')
    } else {
      flash('❌ ' + (result.message || 'ไม่พบข้อมูล'))
    }
  }

  const saveFlashSrc = (info) => {
    setFlashSrcInfo(info)
    try { localStorage.setItem('flash_src', JSON.stringify(info)) } catch {}
    setShowFlashSrc(false)
    flash('✅ บันทึกข้อมูลผู้ส่งสำเร็จ')
  }

  // ═══ โหลดข้อมูล ═══
  useEffect(() => {
    const loadAll = async () => {
      try {
        // โหลดออเดอร์ทั้งหมด (ไม่จำกัด)
        let allOrders = []
        let from = 0
        while (true) {
          const { data } = await supabase.from('mt_orders').select('*').order('created_at', { ascending: false }).range(from, from + 999)
          if (!data || data.length === 0) break
          allOrders = [...allOrders, ...data]
          if (data.length < 1000) break
          from += 1000
        }
        setOrders(allOrders)
        console.log('โหลดออเดอร์ทั้งหมด:', allOrders.length, 'รายการ')

        const [teamsRes, profilesRes] = await Promise.all([
          supabase.from('mt_teams').select('*').order('name'),
          supabase.from('mt_profiles').select('*, mt_teams(id, name)').order('created_at', { ascending: false }),
        ])
        setTeams(teamsRes.data || [])
        setProfiles(profilesRes.data || [])
      } catch (e) { console.error('Load error:', e) }
    }
    loadAll()

    // Realtime
    // Realtime — อัพเดท UI เท่านั้น (sync ไป Sheet ทำจาก client ที่สร้าง/ลบ/แก้ไข)
    const ch = supabase.channel('mgr-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mt_orders' },
        (payload) => { setOrders(prev => prev.some(o => o.id === payload.new.id) ? prev : [payload.new, ...prev]) }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'mt_orders' },
        (payload) => { setOrders(prev => prev.filter(o => o.id !== payload.old.id)) }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mt_orders' },
        (payload) => { setOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new : o)) }
      )
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])
  // ═══ Stats ═══
  const today = orders.filter(o => sameDay(o.created_at, new Date()))
  const todaySum = today.reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)
  const weekSum = orders.filter(o => withinDays(o.created_at, 7)).reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)
  const monthSum = orders.filter(o => thisMonth(o.created_at)).reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)

  const chart7 = useMemo(() => {
    const a = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); a.push({ date: fmtDate(d), ยอดขาย: orders.filter(o => sameDay(o.created_at, d)).reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0) }) }; return a
  }, [orders])

  const teamStats = useMemo(() => teams.map(t => ({
    ...t,
    sales: orders.filter(o => o.team_id === t.id && thisMonth(o.created_at)).reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0),
    count: orders.filter(o => o.team_id === t.id && thisMonth(o.created_at)).length,
    todaySales: orders.filter(o => o.team_id === t.id && sameDay(o.created_at, new Date())).reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0),
    todayCount: orders.filter(o => o.team_id === t.id && sameDay(o.created_at, new Date())).length,
  })).sort((a, b) => b.sales - a.sales), [teams, orders])

  const empStats = useMemo(() => {
    const m = {}
    orders.forEach(o => {
      if (!o.employee_id) return
      if (!m[o.employee_id]) { const p = profiles.find(x => x.id === o.employee_id); m[o.employee_id] = { id: o.employee_id, name: p?.full_name || o.employee_name || '—', team_id: p?.team_id || o.team_id, todaySales: 0, todayCount: 0, weekSales: 0, monthSales: 0, monthCount: 0 } }
      const e = m[o.employee_id]; const a = parseFloat(o.sale_price) || 0
      if (sameDay(o.created_at, new Date())) { e.todaySales += a; e.todayCount++ }
      if (withinDays(o.created_at, 7)) e.weekSales += a
      if (thisMonth(o.created_at)) { e.monthSales += a; e.monthCount++ }
    })
    // เพิ่มพนักงานที่ยังไม่มี order
    profiles.filter(p => p.role === 'employee' && !m[p.id]).forEach(p => { m[p.id] = { id: p.id, name: p.full_name, team_id: p.team_id, todaySales: 0, todayCount: 0, weekSales: 0, monthSales: 0, monthCount: 0 } })
    return Object.values(m).map(e => ({ ...e, teamName: teams.find(t => t.id === e.team_id)?.name || '—' })).sort((a, b) => b.monthSales - a.monthSales)
  }, [orders, profiles, teams])

  
  const ts = { background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, fontFamily: T.font, fontSize: 13 }

  // ═══ Handlers ═══
  const saveTeam = async () => {
    const n = teamName.trim(); if (!n) return
    if (editTeam) {
      const { error } = await supabase.from('mt_teams').update({ name: n }).eq('id', editTeam.id)
      if (error) { flash('❌ ' + error.message); return }
      setTeams(prev => prev.map(t => t.id === editTeam.id ? { ...t, name: n } : t))
      flash('✅ แก้ชื่อทีมสำเร็จ')
    } else {
      const { data, error } = await supabase.from('mt_teams').insert({ name: n }).select().single()
      if (error) { flash('❌ ' + error.message); return }
      setTeams(prev => [...prev, data])
      flash('✅ สร้างทีมสำเร็จ')
    }
    setShowTeamModal(false)
  }

  const deleteTeam = async () => {
    if (!editTeam || !confirm(`ลบทีม "${editTeam.name}"?`)) return
    const { error } = await supabase.from('mt_teams').delete().eq('id', editTeam.id)
    if (error) { flash('❌ ' + error.message); return }
    setTeams(prev => prev.filter(t => t.id !== editTeam.id))
    setShowTeamModal(false); flash('🗑 ลบทีมแล้ว')
  }

  const createUser = async () => {
    const f = userForm; if (!f.email || !f.password || !f.fullName) { flash('❌ กรอกให้ครบ'); return }
    if (f.password.length < 6) { flash('❌ รหัสผ่าน 6 ตัวขึ้นไป'); return }
    const { data: { session: cur } } = await supabase.auth.getSession()
    const { data, error } = await supabase.auth.signUp({ email: f.email, password: f.password })
    if (error) { flash('❌ ' + error.message); return }
    const newUserId = data.user?.id
    if (!newUserId) { flash('❌ สร้าง user ไม่สำเร็จ'); return }
    if (cur) await supabase.auth.setSession({ access_token: cur.access_token, refresh_token: cur.refresh_token })
    await new Promise(r => setTimeout(r, 500))
    const { error: profErr } = await supabase.from('mt_profiles').insert({ id: newUserId, full_name: f.fullName, role: f.role, team_id: f.teamId || null, email: f.email, password_text: f.password })
    if (profErr) { flash('❌ สร้าง profile ไม่สำเร็จ: ' + profErr.message); return }
    const { data: profs } = await supabase.from('mt_profiles').select('*, mt_teams(id, name)').order('created_at', { ascending: false })
    setProfiles(profs || [])
    setShowUserModal(false); setUserForm({ email: '', password: '', fullName: '', role: 'employee', teamId: '' })
    flash('✅ สร้างบัญชีสำเร็จ')
  }

  // แก้ไข user
  const [editUserData, setEditUserData] = useState(null)
  const [showPw, setShowPw] = useState({})

  const saveUserEdit = async () => {
    if (!editUserData) return
    const u = editUserData
    const { error } = await supabase.from('mt_profiles').update({
      full_name: u.full_name, role: u.role, team_id: u.team_id || null, email: u.email || '', password_text: u.password_text || ''
    }).eq('id', u.id)
    if (error) { flash('❌ ' + error.message); return }
    const { data: profs } = await supabase.from('mt_profiles').select('*, mt_teams(id, name)').order('created_at', { ascending: false })
    setProfiles(profs || [])
    setEditUserData(null); flash('✅ แก้ไขสำเร็จ')
  }

  // ลบ user
  const deleteUser = async (p) => {
    if (!confirm(`ลบผู้ใช้ "${p.full_name}" (${p.email})?\n\nออเดอร์ของผู้ใช้นี้จะยังอยู่`)) return
    const { error } = await supabase.rpc('mt_delete_user', { user_id: p.id })
    if (error) { flash('❌ ' + error.message); return }
    setProfiles(prev => prev.filter(x => x.id !== p.id))
    flash('🗑 ลบผู้ใช้สำเร็จ (ลบจาก Supabase แล้ว)')
  }

  const updateUserTeam = async () => {
    if (!editUser) return
    await supabase.from('mt_profiles').update({ team_id: editUserTeam || null }).eq('id', editUser.id)
    const { data: profs } = await supabase.from('mt_profiles').select('*, mt_teams(id, name)').order('created_at', { ascending: false })
    setProfiles(profs || [])
    setEditUser(null); flash('✅ เปลี่ยนทีมสำเร็จ')
  }

  return (
    <div style={{ fontFamily: T.font, minHeight: '100vh', background: T.bg, color: T.text, paddingBottom: 40 }}>
      <Toast message={toast} />

      {/* Flash Express Modal */}
      <Modal show={!!flashModal} onClose={() => setFlashModal(null)} title="📦 Flash Express">
        {flashModal && <>
          {flashModal.result && <div style={{ padding: 14, borderRadius: T.radiusSm, background: 'rgba(45,138,78,0.05)', border: '1px solid rgba(45,138,78,0.15)', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, color: T.success, marginBottom: 4 }}>✅ สร้างออเดอร์สำเร็จ!</div>
            <div style={{ fontSize: 13 }}>Tracking: <strong style={{ fontFamily: 'monospace', fontSize: 15 }}>{flashModal.result.pno}</strong></div>
            {flashModal.result.sortCode && <div style={{ fontSize: 12, color: T.textDim }}>Sort Code: {flashModal.result.sortCode}</div>}
          </div>}
          {flashModal.error && <div style={{ padding: 14, borderRadius: T.radiusSm, background: 'rgba(214,48,49,0.05)', border: '1px solid rgba(214,48,49,0.15)', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, color: T.danger }}>❌ ไม่สำเร็จ</div>
            <div style={{ fontSize: 13, color: T.textDim }}>{flashModal.error}</div>
          </div>}
          {flashModal.tracking && <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>📍 สถานะ: {flashModal.pno}</div>
            {Array.isArray(flashModal.tracking) ? flashModal.tracking.map((r, i) => (
              <div key={i} style={{ padding: '8px 10px', borderLeft: `3px solid ${T.gold}`, marginBottom: 6, background: T.surfaceAlt, borderRadius: '0 8px 8px 0', fontSize: 12 }}>
                <div style={{ fontWeight: 600 }}>{r.message}</div>
                <div style={{ fontSize: 10, color: T.textMuted }}>{r.routedAt ? new Date(r.routedAt * 1000).toLocaleString('th-TH') : ''}</div>
              </div>
            )) : <div style={{ fontSize: 13, color: T.textDim }}>ไม่พบข้อมูลการติดตาม</div>}
          </div>}
        </>}
      </Modal>

      {/* Flash Sender Info Modal */}
      <Modal show={showFlashSrc} onClose={() => setShowFlashSrc(false)} title="⚙️ ข้อมูลผู้ส่ง Flash Express">
        <FI label="ชื่อผู้ส่ง" value={flashSrcInfo.name||''} onChange={e => setFlashSrcInfo(p=>({...p,name:e.target.value}))} placeholder="THE MT" />
        <FI label="เบอร์โทร" value={flashSrcInfo.phone||''} onChange={e => setFlashSrcInfo(p=>({...p,phone:e.target.value}))} placeholder="08xxxxxxxx" />
        <FI label="ที่อยู่" value={flashSrcInfo.address||''} onChange={e => setFlashSrcInfo(p=>({...p,address:e.target.value}))} placeholder="บ้านเลขที่..." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <FI label="ตำบล" value={flashSrcInfo.district||''} onChange={e => setFlashSrcInfo(p=>({...p,district:e.target.value}))} />
          <FI label="อำเภอ" value={flashSrcInfo.city||''} onChange={e => setFlashSrcInfo(p=>({...p,city:e.target.value}))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <FI label="จังหวัด" value={flashSrcInfo.province||''} onChange={e => setFlashSrcInfo(p=>({...p,province:e.target.value}))} />
          <FI label="รหัส ปณ." value={flashSrcInfo.zip||''} onChange={e => setFlashSrcInfo(p=>({...p,zip:e.target.value}))} />
        </div>
        <Btn full onClick={() => saveFlashSrc(flashSrcInfo)} grad={T.grad2}>💾 บันทึก</Btn>
      </Modal>

      {/* Edit Order Modal */}
      <Modal show={!!editOrder} onClose={() => setEditOrder(null)} title="✏️ แก้ไขออเดอร์">
        {editOrder && <>
          <FI label="ชื่อลูกค้า *" value={editOrder.customer_name} onChange={e => setEditOrder(p=>({...p,customer_name:e.target.value}))} />
          <FI label="เบอร์โทร *" value={editOrder.customer_phone} onChange={e => setEditOrder(p=>({...p,customer_phone:e.target.value}))} />
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>ที่อยู่ *</label>
            <textarea value={editOrder.customer_address} onChange={e => setEditOrder(p=>({...p,customer_address:e.target.value}))} rows={2}
              style={{ width: '100%', padding: '13px 16px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <FI label="ตำบล *" value={editOrder.sub_district||''} onChange={e => setEditOrder(p=>({...p,sub_district:e.target.value}))} />
            <FI label="อำเภอ *" value={editOrder.district||''} onChange={e => setEditOrder(p=>({...p,district:e.target.value}))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <FI label="รหัส ปณ. *" value={editOrder.zip_code||''} onChange={e => setEditOrder(p=>({...p,zip_code:e.target.value}))} />
            <FI label="จังหวัด *" value={editOrder.province||''} onChange={e => setEditOrder(p=>({...p,province:e.target.value}))} />
          </div>
          {/* ปุ่ม auto-fill จาก ตำบล/zip */}
          {editOrder.sub_district && (!editOrder.district || !editOrder.province) && (
            <button onClick={async () => {
              try {
                const mod = await import('../data/addresses.json')
                const addrs = mod.default
                const found = addrs.find(a => a.s === editOrder.sub_district) || addrs.find(a => a.z === editOrder.zip_code)
                if (found) {
                  setEditOrder(p => ({ ...p, sub_district: found.s, district: found.d, zip_code: found.z, province: found.p }))
                  flash('✅ เติมที่อยู่อัตโนมัติ')
                } else { flash('❌ ไม่พบข้อมูลตำบลนี้') }
              } catch { flash('❌ โหลดข้อมูลไม่ได้') }
            }} style={{ width: '100%', padding: '10px', marginBottom: 14, borderRadius: T.radiusSm, border: '1px solid rgba(184,134,11,0.2)', background: 'rgba(184,134,11,0.05)', color: T.gold, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: T.font }}>
              🔍 เติมอำเภอ/จังหวัดอัตโนมัติ
            </button>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <FI label="📘 FB/Line" value={editOrder.customer_social||''} onChange={e => setEditOrder(p=>({...p,customer_social:e.target.value}))} />
            <FI label="📦 เพจ" value={editOrder.sales_channel||''} onChange={e => setEditOrder(p=>({...p,sales_channel:e.target.value}))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <FI label="ราคาขาย *" type="number" value={editOrder.sale_price} onChange={e => setEditOrder(p=>({...p,sale_price:e.target.value}))} />
            <FI label="COD" type="number" value={editOrder.cod_amount} onChange={e => setEditOrder(p=>({...p,cod_amount:e.target.value}))} />
          </div>
          <FI label="หมายเหตุ" value={editOrder.remark||''} onChange={e => setEditOrder(p=>({...p,remark:e.target.value}))} />
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn full onClick={saveOrder} grad={T.grad2}>💾 บันทึก</Btn>
            <Btn full outline onClick={() => setEditOrder(null)}>ยกเลิก</Btn>
          </div>
        </>}
      </Modal>

      {/* Header */}
      <div style={{ ...glass, borderRadius: 0, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.95)', borderBottom: `1px solid ${T.border}` }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><img src="./logo.png" alt="" style={{ height: 32 }} /> <span style={{ fontSize: 18, fontWeight: 900 }}>ADMIN THE MT</span><LiveDot /></div>
          <div style={{ fontSize: 11, color: T.textDim }}>{profile.full_name} — {profile.role === 'manager' ? 'หัวหน้า' : 'แอดมิน'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setShowFlashSrc(true)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(255,165,0,0.2)', background: 'rgba(255,165,0,0.05)', color: '#e67e00', fontSize: 12, cursor: 'pointer', fontFamily: T.font, fontWeight: 600 }}>⚡ Flash</button>
          {profile.role === 'manager' && <button onClick={async () => {
            if (!confirm('⚠️ ลบข้อมูลใน Sheet ทั้งหมด แล้วดึงจาก Supabase ใส่ใหม่?\n\nข้อมูลใน Sheet จะตรงกับระบบ 100%')) return
            flash('⏳ กำลัง Reset Sheet...')
            resetSheet(orders, profiles)
            setTimeout(() => flash('✅ Reset Sheet เรียบร้อย! ข้อมูลตรงกับ Supabase'), 2000)
          }} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(184,134,11,0.2)', background: 'rgba(184,134,11,0.05)', color: T.gold, fontSize: 12, cursor: 'pointer', fontFamily: T.font, fontWeight: 600 }}>🔄 Reset Sheet</button>}
          <button onClick={onLogout} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', color: T.textDim, fontSize: 12, cursor: 'pointer', fontFamily: T.font }}>ออก</button>
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <Tabs items={[{ id: 'dashboard', label: '📈 ภาพรวม' }, { id: 'create', label: '➕ สร้าง' }, { id: 'orders', label: '📋 รายงาน' }, { id: 'teams', label: '👥 ทีม' }, { id: 'users', label: '🧑‍💼 ผู้ใช้' }]} active={tab} onChange={setTab} />
      </div>

      <div style={{ padding: 16 }}>
        {/* ══ CREATE ORDER ══ */}
        {tab === 'create' && <OrderForm profile={profile} onSuccess={(newOrder) => {
          setOrders(prev => {
            if (prev.some(o => o.id === newOrder.id)) return prev
            return [newOrder, ...prev]
          })
        }} />}

        {/* ══ DASHBOARD ══ */}
        {tab === 'dashboard' && (() => {
          const monthOrders = orders.filter(o => thisMonth(o.created_at))
          const todayCod = today.filter(o => o.payment_type !== 'transfer')
          const todayTrans = today.filter(o => o.payment_type === 'transfer')
          const monthCod = monthOrders.filter(o => o.payment_type !== 'transfer')
          const monthTrans = monthOrders.filter(o => o.payment_type === 'transfer')

          // สถิติรายทีม
          const teamData = teams.map(t => {
            const tOrders = orders.filter(o => o.team_id === t.id)
            const tToday = tOrders.filter(o => sameDay(o.created_at, new Date()))
            const tMonth = tOrders.filter(o => thisMonth(o.created_at))
            return { ...t, todayCount: tToday.length, todaySales: tToday.reduce((s,o) => s+(parseFloat(o.sale_price)||0), 0), monthCount: tMonth.length, monthSales: tMonth.reduce((s,o) => s+(parseFloat(o.sale_price)||0), 0) }
          })
          // ออเดอร์ที่ไม่มีทีม (หัวหน้า/แอดมิน)
          const noTeamOrders = orders.filter(o => !o.team_id)
          if (noTeamOrders.length > 0) {
            const ntToday = noTeamOrders.filter(o => sameDay(o.created_at, new Date()))
            const ntMonth = noTeamOrders.filter(o => thisMonth(o.created_at))
            teamData.push({ id: '__noteam', name: 'ไม่มีทีม (หัวหน้า/แอดมิน)', todayCount: ntToday.length, todaySales: ntToday.reduce((s,o) => s+(parseFloat(o.sale_price)||0), 0), monthCount: ntMonth.length, monthSales: ntMonth.reduce((s,o) => s+(parseFloat(o.sale_price)||0), 0) })
          }

          // สถิติรายคน
          const personData = profiles.map(p => {
            const pOrders = orders.filter(o => o.employee_id === p.id)
            const pToday = pOrders.filter(o => sameDay(o.created_at, new Date()))
            const pMonth = pOrders.filter(o => thisMonth(o.created_at))
            return { ...p, team: p.mt_teams?.name || (p.role === 'manager' ? '🏢 หัวหน้า' : p.role === 'admin' ? '🔑 แอดมิน' : '—'), todayCount: pToday.length, todaySales: pToday.reduce((s,o) => s+(parseFloat(o.sale_price)||0), 0), monthCount: pMonth.length, monthSales: pMonth.reduce((s,o) => s+(parseFloat(o.sale_price)||0), 0) }
          }).sort((a,b) => b.monthSales - a.monthSales)

          return <>
          {/* ═══ สรุปรวม ═══ */}
          <div style={{ ...glass, padding: 16, marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📊 สรุปรวม</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div style={{ padding: 10, borderRadius: T.radiusSm, background: 'rgba(184,134,11,0.04)', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: T.textMuted }}>วันนี้</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: T.gold }}>{today.length}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.success }}>฿{fmt(todaySum)}</div>
              </div>
              <div style={{ padding: 10, borderRadius: T.radiusSm, background: 'rgba(45,138,78,0.04)', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: T.textMuted }}>7 วัน</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: T.success }}>{orders.filter(o => withinDays(o.created_at, 7)).length}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.success }}>฿{fmt(weekSum)}</div>
              </div>
              <div style={{ padding: 10, borderRadius: T.radiusSm, background: 'rgba(184,134,11,0.04)', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: T.textMuted }}>เดือนนี้</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: T.gold }}>{monthOrders.length}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.success }}>฿{fmt(monthSum)}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ padding: 8, borderRadius: T.radiusSm, background: 'rgba(184,134,11,0.03)', textAlign: 'center', fontSize: 11 }}>
                <span style={{ color: T.textDim }}>📦 COD วันนี้ </span><strong style={{ color: T.gold }}>{todayCod.length}</strong> · ฿{fmt(todayCod.reduce((s,o)=>s+(parseFloat(o.cod_amount)||0),0))}
              </div>
              <div style={{ padding: 8, borderRadius: T.radiusSm, background: 'rgba(45,138,78,0.03)', textAlign: 'center', fontSize: 11 }}>
                <span style={{ color: T.textDim }}>🏦 โอน วันนี้ </span><strong style={{ color: T.success }}>{todayTrans.length}</strong> · ฿{fmt(todayTrans.reduce((s,o)=>s+(parseFloat(o.sale_price)||0),0))}
              </div>
            </div>
          </div>

          {/* ═══ กราฟ 7 วัน ═══ */}
          <div style={{ ...glass, padding: '14px 14px 6px', marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📈 ยอดขาย 7 วัน</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chart7}>
                <defs><linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.accent} stopOpacity={0.35}/><stop offset="100%" stopColor={T.accent} stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" /><XAxis dataKey="date" stroke={T.textMuted} fontSize={10} tickLine={false} /><YAxis stroke={T.textMuted} fontSize={10} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={ts} formatter={v => [`฿${fmt(v)}`, 'ยอดขาย']} /><Area type="monotone" dataKey="ยอดขาย" stroke={T.accent} strokeWidth={2.5} fill="url(#gA)" dot={{ r: 3, fill: T.accent }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ═══ ยอดรายทีม ═══ */}
          <div style={{ ...glass, padding: 16, marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>👥 ยอดรายทีม</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: T.font }}>
              <thead>
                <tr style={{ background: T.surfaceAlt }}>
                  <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 600, color: T.textDim }}>ทีม</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: T.textDim }}>วันนี้</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, color: T.textDim }}>ยอดวันนี้</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: T.textDim }}>เดือนนี้</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, color: T.textDim }}>ยอดเดือน</th>
                </tr>
              </thead>
              <tbody>
                {teamData.map(t => (
                  <tr key={t.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: '8px 6px', fontWeight: 600 }}>{t.name}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 700, color: T.gold }}>{t.todayCount}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', color: T.success }}>฿{fmt(t.todaySales)}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 700, color: T.gold }}>{t.monthCount}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700, color: T.success }}>฿{fmt(t.monthSales)}</td>
                  </tr>
                ))}
                <tr style={{ background: 'rgba(184,134,11,0.05)' }}>
                  <td style={{ padding: '8px 6px', fontWeight: 800 }}>รวม</td>
                  <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 800, color: T.gold }}>{today.length}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 800, color: T.success }}>฿{fmt(todaySum)}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 800, color: T.gold }}>{monthOrders.length}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 800, color: T.success }}>฿{fmt(monthSum)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ═══ ยอดรายคน ═══ */}
          <div style={{ ...glass, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>🏆 ยอดรายคน (เดือนนี้)</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: T.font }}>
              <thead>
                <tr style={{ background: T.surfaceAlt }}>
                  <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: T.textDim, width: 30 }}>#</th>
                  <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 600, color: T.textDim }}>ชื่อ</th>
                  <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 600, color: T.textDim }}>ทีม</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: T.textDim }}>วันนี้</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, color: T.textDim }}>ยอดวันนี้</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: T.textDim }}>เดือน</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, color: T.textDim }}>ยอดเดือน</th>
                </tr>
              </thead>
              <tbody>
                {personData.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${T.border}`, background: i < 3 ? 'rgba(184,134,11,0.03)' : 'transparent' }}>
                    <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 800, color: i < 3 ? T.gold : T.textDim }}>{i+1}</td>
                    <td style={{ padding: '8px 6px', fontWeight: 600 }}>{p.full_name}</td>
                    <td style={{ padding: '8px 6px', fontSize: 11, color: T.textDim }}>{p.team}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 700, color: T.gold }}>{p.todayCount}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', color: T.success }}>฿{fmt(p.todaySales)}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 700, color: T.gold }}>{p.monthCount}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 800, color: T.success }}>฿{fmt(p.monthSales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
        })()}

        {/* ══ ORDERS ══ */}
        {tab === 'orders' && (() => {
          const q = searchQuery.toLowerCase()
          const filtered = orders.filter(o => {
            if (dateFilter && (o.order_date||'').substring(0,10) !== dateFilter) return false
            if (userFilter && o.employee_id !== userFilter) return false
            if (q && !(
              (o.customer_name||'').toLowerCase().includes(q) ||
              (o.customer_phone||'').includes(q) ||
              (o.district||'').includes(q) ||
              (o.province||'').includes(q) ||
              (o.remark||'').toLowerCase().includes(q) ||
              (o.employee_name||'').toLowerCase().includes(q)
            )) return false
            return true
          })
          const total = filtered.reduce((s,o) => s+(parseFloat(o.sale_price)||0), 0)
          const cod = filtered.filter(o => o.payment_type !== 'transfer')
          const trans = filtered.filter(o => o.payment_type === 'transfer')

          return <>
          {/* ตัวกรอง */}
          <div style={{ ...glass, padding: 14, marginBottom: 10 }}>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="🔍 ค้นหา ชื่อ เบอร์ จังหวัด..."
              style={{ width: '100%', padding: '10px 12px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 13, fontFamily: T.font, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                style={{ flex: 1, padding: '8px 10px', borderRadius: T.radiusSm, background: T.surfaceAlt, border: `1px solid ${T.border}`, color: T.text, fontSize: 12, fontFamily: T.font, outline: 'none' }} />
              <select value={userFilter} onChange={e => setUserFilter(e.target.value)}
                style={{ flex: 1, padding: '8px 10px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 12, fontFamily: T.font, outline: 'none' }}>
                <option value="">ทุกคน</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
              {(dateFilter || userFilter || searchQuery) && <button onClick={() => { setDateFilter(todayStr); setUserFilter(''); setSearchQuery('') }}
                style={{ padding: '8px 12px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: '#fff', color: T.textDim, fontSize: 11, cursor: 'pointer', fontFamily: T.font }}>ล้าง</button>}
            </div>
            {/* สรุป */}
            <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: T.radiusSm, background: 'rgba(184,134,11,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: T.textDim }}>{filtered.length} รายการ</span>
                <span style={{ fontWeight: 700, color: T.gold }}>฿{fmt(total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4, color: T.textMuted }}>
                <span>📦 COD {cod.length} · ฿{fmt(cod.reduce((s,o)=>s+(parseFloat(o.cod_amount)||0),0))}</span>
                <span>🏦 โอน {trans.length} · ฿{fmt(trans.reduce((s,o)=>s+(parseFloat(o.sale_price)||0),0))}</span>
              </div>
            </div>
          </div>

          {/* ตาราง */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: T.font }}>
              <thead>
                <tr style={{ background: T.surfaceAlt, position: 'sticky', top: 0 }}>
                  <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 600, color: T.textDim, borderBottom: `1px solid ${T.border}` }}>#</th>
                  <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 600, color: T.textDim, borderBottom: `1px solid ${T.border}` }}>ชื่อ</th>
                  <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 600, color: T.textDim, borderBottom: `1px solid ${T.border}` }}>เบอร์</th>
                  <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 600, color: T.textDim, borderBottom: `1px solid ${T.border}` }}>ที่อยู่</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, color: T.textDim, borderBottom: `1px solid ${T.border}` }}>ยอด</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: T.textDim, borderBottom: `1px solid ${T.border}` }}>ประเภท</th>
                  <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 600, color: T.textDim, borderBottom: `1px solid ${T.border}` }}>แอดมิน</th>
                  <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 600, color: T.textDim, borderBottom: `1px solid ${T.border}` }}>เวลา</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: T.textDim, borderBottom: `1px solid ${T.border}` }}>จัดการ</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: T.textDim, borderBottom: `1px solid ${T.border}` }}>Flash</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o, i) => (
                  <tr key={o.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: '8px 6px', fontWeight: 700, color: T.gold }}>{o.daily_seq || i+1}</td>
                    <td style={{ padding: '8px 6px' }}>
                      <div style={{ fontWeight: 600 }}>{o.customer_name}</div>
                      {o.remark && <div style={{ fontSize: 10, color: T.textMuted }}>💬 {o.remark}</div>}
                    </td>
                    <td style={{ padding: '8px 6px', fontSize: 11, color: T.textDim }}>{o.customer_phone}</td>
                    <td style={{ padding: '8px 6px', fontSize: 11, color: T.textDim }}>{o.district||''} {o.province||''}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 700, color: T.success }}>฿{fmt(parseFloat(o.sale_price)||0)}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: o.payment_type === 'transfer' ? 'rgba(45,138,78,0.1)' : 'rgba(184,134,11,0.08)', color: o.payment_type === 'transfer' ? T.success : T.gold, fontWeight: 600 }}>{o.payment_type === 'transfer' ? 'โอน' : 'COD'}</span>
                      {o.slip_url && <a href={o.slip_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 4, fontSize: 10, color: T.success }}>🧾</a>}
                    </td>
                    <td style={{ padding: '8px 6px', fontSize: 11, color: T.textDim }}>{o.employee_name||'—'}</td>
                    <td style={{ padding: '8px 6px', fontSize: 10, color: T.textMuted }}>{fmtDateTime(o.created_at)}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <button onClick={() => setEditOrder({...o})} style={{ padding: '4px 8px', borderRadius: 4, border: `1px solid ${T.border}`, background: '#fff', color: T.gold, fontSize: 10, cursor: 'pointer', fontFamily: T.font }}>✏️</button>
                        <button onClick={() => deleteOrder(o)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid rgba(214,48,49,0.15)', background: '#fff', color: T.danger, fontSize: 10, cursor: 'pointer', fontFamily: T.font }}>🗑</button>
                      </div>
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                      {o.flash_pno ? (
                        <button onClick={() => trackFlash(o.flash_pno)} style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid rgba(45,138,78,0.2)', background: 'rgba(45,138,78,0.05)', color: T.success, fontSize: 9, cursor: 'pointer', fontFamily: T.font }}>{o.flash_pno.substring(0,12)}</button>
                      ) : (
                        <button onClick={() => sendToFlash(o)} style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid rgba(255,165,0,0.3)', background: 'rgba(255,165,0,0.05)', color: '#e67e00', fontSize: 9, cursor: 'pointer', fontFamily: T.font }}>📦 ส่ง</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <Empty text={searchQuery ? 'ไม่พบผลลัพธ์' : 'ไม่มีออเดอร์'} />}
          </div>
        </>
        })()}

        {/* ══ TEAMS ══ */}
        {tab === 'teams' && <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}><div style={{ fontSize: 15, fontWeight: 700 }}>ทีม ({teams.length})</div><Btn sm onClick={() => { setEditTeam(null); setTeamName(''); setShowTeamModal(true) }}>+ สร้างทีม</Btn></div>
          <Modal show={showTeamModal} onClose={() => setShowTeamModal(false)} title={editTeam ? '✏️ แก้ไขทีม' : '🏗 สร้างทีม'}>
            <FI label="ชื่อทีม" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="ชื่อทีม" />
            <div style={{ display: 'flex', gap: 10 }}><Btn full onClick={saveTeam} grad={T.grad2}>{editTeam ? '💾 บันทึก' : '✅ สร้าง'}</Btn><Btn full outline onClick={() => setShowTeamModal(false)}>ยกเลิก</Btn></div>
            {editTeam && <button onClick={deleteTeam} style={{ width: '100%', marginTop: 12, padding: 12, borderRadius: T.radiusSm, border: '1px solid rgba(214,48,49,0.2)', background: 'rgba(214,48,49,0.04)', color: T.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: T.font }}>🗑 ลบทีม</button>}
          </Modal>
          {teamStats.map((t, i) => (
            <div key={t.id} style={{ ...glass, padding: 18, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: T.radiusSm, background: [T.grad1,T.grad2,T.grad3,T.grad4][i%4], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff' }}>{i+1}</div>
                  <div><div style={{ fontWeight: 700 }}>{t.name}</div><div style={{ fontSize: 11, color: T.textDim }}>วันนี้ {t.todayCount} · เดือน {t.count}</div></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: T.gold }}>฿{fmt(t.sales)}</div>
                  <button onClick={() => { setEditTeam(t); setTeamName(t.name); setShowTeamModal(true) }} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.textDim, fontSize: 12, cursor: 'pointer', fontFamily: T.font }}>✏️</button>
                </div>
              </div>
              {empStats.filter(e => e.team_id === t.id).map(e => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 6px 48px', fontSize: 12, borderTop: `1px solid ${T.border}` }}>
                  <span>👤 {e.name}</span><span>วันนี้ <strong>฿{fmt(e.todaySales)}</strong> · เดือน <strong style={{ color: T.gold }}>฿{fmt(e.monthSales)}</strong></span>
                </div>
              ))}
            </div>
          ))}
        </>}

        {/* ══ USERS ══ */}
        {tab === 'users' && <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}><div style={{ fontSize: 15, fontWeight: 700 }}>ผู้ใช้ ({profiles.length})</div><Btn sm onClick={() => setShowUserModal(true)}>+ เพิ่มผู้ใช้</Btn></div>

          {/* Modal สร้าง user */}
          <Modal show={showUserModal} onClose={() => setShowUserModal(false)} title="🧑‍💼 เพิ่มผู้ใช้">
            <FI label="ชื่อ *" value={userForm.fullName} onChange={e => setUserForm(p=>({...p,fullName:e.target.value}))} placeholder="สมชาย ใจดี" />
            <FI label="อีเมล *" type="email" value={userForm.email} onChange={e => setUserForm(p=>({...p,email:e.target.value}))} placeholder="user@mail.com" />
            <FI label="รหัสผ่าน *" value={userForm.password} onChange={e => setUserForm(p=>({...p,password:e.target.value}))} placeholder="6 ตัวขึ้นไป" />
            <div style={{ marginBottom: 14 }}><label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>ตำแหน่ง</label>
              <select value={userForm.role} onChange={e => setUserForm(p=>({...p,role:e.target.value}))} style={{ width: '100%', padding: '13px 16px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', boxSizing: 'border-box' }}><option value="employee">👤 พนักงาน</option><option value="admin">🔑 แอดมิน</option><option value="manager">🏢 หัวหน้า</option></select>
            </div>
            {userForm.role === 'employee' && <div style={{ marginBottom: 14 }}><label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>ทีม</label>
              <select value={userForm.teamId} onChange={e => setUserForm(p=>({...p,teamId:e.target.value}))} style={{ width: '100%', padding: '13px 16px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', boxSizing: 'border-box' }}><option value="">— เลือกทีม —</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </div>}
            <div style={{ display: 'flex', gap: 10 }}><Btn full onClick={createUser} grad={T.grad2}>✅ สร้าง</Btn><Btn full outline onClick={() => setShowUserModal(false)}>ยกเลิก</Btn></div>
          </Modal>

          {/* Modal แก้ไข user */}
          <Modal show={!!editUserData} onClose={() => setEditUserData(null)} title={`✏️ แก้ไขผู้ใช้`}>
            {editUserData && <>
              <FI label="ชื่อ" value={editUserData.full_name} onChange={e => setEditUserData(p=>({...p,full_name:e.target.value}))} />
              <FI label="อีเมล" value={editUserData.email||''} onChange={e => setEditUserData(p=>({...p,email:e.target.value}))} />
              <FI label="รหัสผ่าน" value={editUserData.password_text||''} onChange={e => setEditUserData(p=>({...p,password_text:e.target.value}))} />
              <div style={{ marginBottom: 14 }}><label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>ตำแหน่ง</label>
                <select value={editUserData.role} onChange={e => setEditUserData(p=>({...p,role:e.target.value}))} style={{ width: '100%', padding: '13px 16px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', boxSizing: 'border-box' }}><option value="employee">👤 พนักงาน</option><option value="admin">🔑 แอดมิน</option><option value="manager">🏢 หัวหน้า</option></select>
              </div>
              <div style={{ marginBottom: 14 }}><label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>ทีม</label>
                <select value={editUserData.team_id||''} onChange={e => setEditUserData(p=>({...p,team_id:e.target.value||null}))} style={{ width: '100%', padding: '13px 16px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', boxSizing: 'border-box' }}><option value="">— ไม่มีทีม —</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
              </div>
              <div style={{ display: 'flex', gap: 10 }}><Btn full onClick={saveUserEdit} grad={T.grad2}>💾 บันทึก</Btn><Btn full outline onClick={() => setEditUserData(null)}>ยกเลิก</Btn></div>
            </>}
          </Modal>

          {/* รายชื่อ user */}
          {profiles.map(p => {
            const userOrders = orders.filter(o => o.employee_id === p.id)
            const todayOrd = userOrders.filter(o => sameDay(o.created_at, new Date()))
            const monthOrd = userOrders.filter(o => thisMonth(o.created_at))
            const todaySales = todayOrd.reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)
            const monthSales = monthOrd.reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)
            const codCount = monthOrd.filter(o => o.payment_type !== 'transfer').length
            const transCount = monthOrd.filter(o => o.payment_type === 'transfer').length
            const pwVisible = showPw[p.id]
            return (
              <div key={p.id} style={{ ...glass, padding: '16px 18px', marginBottom: 10 }}>
                {/* ชื่อ + ตำแหน่ง */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
                  <div style={{ width: 46, height: 46, borderRadius: T.radiusSm, background: p.role === 'manager' ? T.grad3 : T.grad1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff' }}>{p.full_name?.[0]||'?'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{p.full_name}</div>
                    <div style={{ fontSize: 11, color: T.textDim }}>{p.role === 'manager' ? '🏢 หัวหน้า' : p.role === 'admin' ? '🔑 แอดมิน' : '👤 พนักงาน'}{p.mt_teams?.name && ` · ${p.mt_teams.name}`}</div>
                  </div>
                </div>

                {/* email + password */}
                <div style={{ padding: '10px 12px', borderRadius: T.radiusSm, background: T.surfaceAlt, marginBottom: 8, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: T.textDim }}>📧 อีเมล</span>
                    <span style={{ fontWeight: 600 }}>{p.email || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: T.textDim }}>🔑 รหัสผ่าน</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{pwVisible ? (p.password_text || '—') : '••••••'}</span>
                      <button onClick={() => setShowPw(prev => ({...prev, [p.id]: !prev[p.id]}))} style={{ padding: '2px 6px', borderRadius: 4, border: `1px solid ${T.border}`, background: '#fff', fontSize: 10, cursor: 'pointer', fontFamily: T.font, color: T.textDim }}>{pwVisible ? '🙈' : '👁'}</button>
                    </div>
                  </div>
                </div>

                {/* ยอดขาย */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
                  <div style={{ padding: '8px', borderRadius: T.radiusSm, background: 'rgba(184,134,11,0.04)', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: T.textMuted }}>วันนี้</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.gold }}>{todayOrd.length}</div>
                    <div style={{ fontSize: 10, color: T.textDim }}>฿{fmt(todaySales)}</div>
                  </div>
                  <div style={{ padding: '8px', borderRadius: T.radiusSm, background: 'rgba(45,138,78,0.04)', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: T.textMuted }}>เดือนนี้</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.success }}>{monthOrd.length}</div>
                    <div style={{ fontSize: 10, color: T.textDim }}>฿{fmt(monthSales)}</div>
                  </div>
                  <div style={{ padding: '8px', borderRadius: T.radiusSm, background: 'rgba(184,134,11,0.03)', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: T.textMuted }}>📦 COD</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.gold }}>{codCount}</div>
                  </div>
                  <div style={{ padding: '8px', borderRadius: T.radiusSm, background: 'rgba(45,138,78,0.03)', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: T.textMuted }}>🏦 โอน</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.success }}>{transCount}</div>
                  </div>
                </div>

                {/* ปุ่ม */}
                <div style={{ display: 'grid', gridTemplateColumns: p.id === profile.id ? '1fr' : '1fr 1fr 1fr', gap: 6 }}>
                  <button onClick={() => { setTab('orders'); setUserFilter(p.id) }} style={{ padding: '8px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.gold, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: T.font }}>📋 รายงาน</button>
                  {p.id !== profile.id && <button onClick={() => setEditUserData({...p})} style={{ padding: '8px', borderRadius: 8, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.gold, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: T.font }}>✏️ แก้ไข</button>}
                  {p.id !== profile.id && <button onClick={() => deleteUser(p)} style={{ padding: '8px', borderRadius: 8, border: '1px solid rgba(214,48,49,0.2)', background: 'rgba(214,48,49,0.04)', color: T.danger, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: T.font }}>🗑 ลบ</button>}
                </div>
              </div>
            )
          })}
        </>}

        {/* ══ BACKUP ══ */}
      </div>
    </div>
  )
}
