import React, { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { supabase } from '../lib/supabase'

// ═══════════════════════════════════════════
//  Classic Executive Theme
// ═══════════════════════════════════════════
const C = {
  font: "'Sarabun', 'Noto Sans Thai', sans-serif",
  fontSans: "'Sarabun', 'Noto Sans Thai', sans-serif",
  bg: '#f4f1ec',
  surface: '#ffffff',
  surfaceAlt: '#faf8f5',
  surfaceHover: '#f0ede6',
  border: '#e0ddd5',
  borderDark: '#c9c4b8',
  text: '#2c2c2c',
  textDim: '#6b6560',
  textMuted: '#a09890',
  accent: '#8b4513',
  accentDark: '#6b3410',
  accentLight: '#a0612b',
  success: '#2e7d32',
  successLight: '#4caf50',
  danger: '#c62828',
  dangerLight: '#ef5350',
  gold: '#b8860b',
  navy: '#1a1a2e',
  navyLight: '#2d2d44',
  cream: '#fdfbf7',
  shadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  shadowMd: '0 4px 12px rgba(0,0,0,0.08)',
  shadowLg: '0 10px 30px rgba(0,0,0,0.1)',
}

const fmt = (n) => new Intl.NumberFormat('th-TH').format(Math.round(n))
const fmtDate = (d) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
const fmtDateFull = (d) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
const sameDay = (a, b) => { const x = new Date(a), y = new Date(b); return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate() }
const withinDays = (d, n) => { const diff = (new Date() - new Date(d)) / 864e5; return diff >= 0 && diff < n }
const thisMonth = (d) => { const now = new Date(), t = new Date(d); return now.getFullYear() === t.getFullYear() && now.getMonth() === t.getMonth() }

// ═══════════════════════════════════════════
//  Login Screen
// ═══════════════════════════════════════════
function BossLogin({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const err = await onLogin(email, password)
    if (err) setError(err)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: C.fontSans }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&family=Noto+Sans+Thai:wght@300;400;500;600;700;800&display=swap');
      `}</style>
      <div style={{ width: 380, padding: 40, background: C.surface, borderRadius: 2, boxShadow: C.shadowLg }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 14, letterSpacing: 6, color: C.textMuted, fontWeight: 500, marginBottom: 8 }}>THE MT</div>
          <div style={{ fontSize: 28, fontFamily: C.font, fontWeight: 700, color: C.navy }}>Boss Dashboard</div>
          <div style={{ width: 40, height: 2, background: C.accent, margin: '12px auto 0' }}></div>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" required
              style={{ width: '100%', padding: '12px 14px', border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 14, fontFamily: C.fontSans, outline: 'none', background: C.surfaceAlt, boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Password</label>
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" required
              style={{ width: '100%', padding: '12px 14px', border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 14, fontFamily: C.fontSans, outline: 'none', background: C.surfaceAlt, boxSizing: 'border-box' }} />
          </div>
          {error && <div style={{ color: C.danger, fontSize: 13, marginBottom: 12, padding: '8px 12px', background: '#fef2f2', borderRadius: 2 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '13px', border: 'none', borderRadius: 2,
            background: C.navy, color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer', fontFamily: C.fontSans,
            letterSpacing: 1, textTransform: 'uppercase', opacity: loading ? 0.6 : 1,
          }}>{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</button>
        </form>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
//  Custom Tooltip
// ═══════════════════════════════════════════
function ClassicTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: C.navy, padding: '10px 14px', borderRadius: 2, boxShadow: C.shadowMd }}>
      <div style={{ fontSize: 11, color: '#a0a0b0', marginBottom: 4, fontFamily: C.fontSans }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 13, color: '#fff', fontWeight: 600, fontFamily: C.fontSans }}>
          {p.name}: {typeof p.value === 'number' ? (p.name.includes('ยอด') || p.name.includes('฿') ? `฿${fmt(p.value)}` : fmt(p.value)) : p.value}
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════
//  Main Dashboard
// ═══════════════════════════════════════════
export default function BossDashboard() {
  const [status, setStatus] = useState('loading')
  const [profile, setProfile] = useState(null)
  const [orders, setOrders] = useState([])
  const [teams, setTeams] = useState([])
  const [profiles, setProfiles] = useState([])
  const [section, setSection] = useState('overview')

  // Date filters
  const todayStr = new Date().toISOString().split('T')[0]
  const [dateFrom, setDateFrom] = useState(todayStr)
  const [dateTo, setDateTo] = useState(todayStr)
  const [quickRange, setQuickRange] = useState('today')
  const [selectedEmployee, setSelectedEmployee] = useState(null)

  const setQuick = (key) => {
    setQuickRange(key)
    const now = new Date()
    const todayS = now.toISOString().split('T')[0]
    if (key === 'all') { setDateFrom(''); setDateTo('') }
    else if (key === 'today') { setDateFrom(todayS); setDateTo(todayS) }
    else if (key === 'yesterday') { const y = new Date(now); y.setDate(y.getDate() - 1); const ys = y.toISOString().split('T')[0]; setDateFrom(ys); setDateTo(ys) }
    else if (key === 'week') { const w = new Date(now); w.setDate(w.getDate() - 6); setDateFrom(w.toISOString().split('T')[0]); setDateTo(todayS) }
    else if (key === 'month') { const m = new Date(now.getFullYear(), now.getMonth(), 1); setDateFrom(m.toISOString().split('T')[0]); setDateTo(todayS) }
    else if (key === 'last_month') { const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1); const lme = new Date(now.getFullYear(), now.getMonth(), 0); setDateFrom(lm.toISOString().split('T')[0]); setDateTo(lme.toISOString().split('T')[0]) }
  }

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data } = await supabase.from('mt_profiles').select('*, mt_teams(id, name)').eq('id', session.user.id).single()
        if (data && (data.role === 'manager' || data.role === 'admin')) {
          setProfile(data); setStatus('ready'); return
        }
      }
      setStatus('login')
    }).catch(() => setStatus('login'))
  }, [])

  // Fetch data
  useEffect(() => {
    if (status !== 'ready') return
    const fetchAll = async () => {
      let query = supabase.from('mt_orders').select('*').order('created_at', { ascending: false })
      if (dateFrom) query = query.gte('order_date', dateFrom)
      if (dateTo) query = query.lte('order_date', dateTo)
      const [ordRes, teamRes, profRes] = await Promise.all([
        query,
        supabase.from('mt_teams').select('*').order('name'),
        supabase.from('mt_profiles').select('*, mt_teams(id, name)').order('created_at', { ascending: false }),
      ])
      if (ordRes.data) setOrders(ordRes.data)
      if (teamRes.data) setTeams(teamRes.data)
      if (profRes.data) setProfiles(profRes.data)
    }
    fetchAll()
  }, [status, dateFrom, dateTo])

  // Realtime
  useEffect(() => {
    if (status !== 'ready') return
    const ch = supabase.channel('boss-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mt_orders' }, () => {
        let query = supabase.from('mt_orders').select('*').order('created_at', { ascending: false })
        if (dateFrom) query = query.gte('order_date', dateFrom)
        if (dateTo) query = query.lte('order_date', dateTo)
        query.then(({ data }) => { if (data) setOrders(data) })
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [status, dateFrom, dateTo])

  const handleLogin = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return error.message
    const { data: prof } = await supabase.from('mt_profiles').select('*, mt_teams(id, name)').eq('id', data.user.id).single()
    if (!prof) return 'ไม่พบโปรไฟล์'
    if (prof.role !== 'manager' && prof.role !== 'admin') return 'เฉพาะหัวหน้าเท่านั้น'
    setProfile(prof)
    setStatus('ready')
    return null
  }

  const handleLogout = () => { setProfile(null); setStatus('login'); supabase.auth.signOut() }

  // ═══ Computed Data ═══
  const totalSales = useMemo(() => orders.reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0), [orders])
  const totalOrders = orders.length
  const avgOrder = totalOrders > 0 ? totalSales / totalOrders : 0
  const codOrders = useMemo(() => orders.filter(o => o.payment_type !== 'transfer'), [orders])
  const transOrders = useMemo(() => orders.filter(o => o.payment_type === 'transfer'), [orders])
  const codTotal = useMemo(() => codOrders.reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0), [codOrders])
  const transTotal = useMemo(() => transOrders.reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0), [transOrders])

  // Daily chart
  const dailyChart = useMemo(() => {
    const map = {}
    orders.forEach(o => {
      const d = (o.order_date || '').substring(0, 10)
      if (!d) return
      if (!map[d]) map[d] = { date: d, ยอดขาย: 0, ออเดอร์: 0 }
      map[d].ยอดขาย += parseFloat(o.sale_price) || 0
      map[d].ออเดอร์++
    })
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
  }, [orders])

  // Employee stats
  const empStats = useMemo(() => {
    const m = {}
    orders.forEach(o => {
      const name = o.employee_name || '—'
      if (!m[name]) m[name] = { name, count: 0, sales: 0, cod: 0, trans: 0 }
      m[name].count++
      m[name].sales += parseFloat(o.sale_price) || 0
      if (o.payment_type === 'transfer') m[name].trans++
      else m[name].cod++
    })
    return Object.values(m).sort((a, b) => b.sales - a.sales)
  }, [orders])

  // Team stats
  const teamStats = useMemo(() => {
    const m = {}
    orders.forEach(o => {
      const tid = o.team_id || 'none'
      const tname = teams.find(t => t.id === tid)?.name || '—'
      if (!m[tid]) m[tid] = { name: tname, count: 0, sales: 0 }
      m[tid].count++
      m[tid].sales += parseFloat(o.sale_price) || 0
    })
    return Object.values(m).sort((a, b) => b.sales - a.sales)
  }, [orders, teams])

  // Product stats
  const productStats = useMemo(() => {
    const m = {}
    orders.forEach(o => {
      const prod = (o.remark || '').trim() || '—'
      if (!m[prod]) m[prod] = { name: prod, count: 0, sales: 0, cod: 0, codAmt: 0, trans: 0, transAmt: 0 }
      const p = m[prod]
      p.count++
      p.sales += parseFloat(o.sale_price) || 0
      if (o.payment_type === 'transfer') { p.trans++; p.transAmt += parseFloat(o.sale_price) || 0 }
      else { p.cod++; p.codAmt += parseFloat(o.cod_amount) || 0 }
    })
    return Object.values(m).sort((a, b) => b.count - a.count)
  }, [orders])

  // Hourly stats
  const hourlyStats = useMemo(() => {
    const h = Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2, '0')}:00`, ออเดอร์: 0, ยอดขาย: 0 }))
    orders.forEach(o => {
      const dt = new Date(o.created_at)
      if (isNaN(dt)) return
      const bkk = new Date(dt.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
      const hr = bkk.getHours()
      h[hr].ออเดอร์++
      h[hr].ยอดขาย += parseFloat(o.sale_price) || 0
    })
    return h
  }, [orders])

  // Day of week stats
  const dowStats = useMemo(() => {
    const labels = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
    const d = labels.map((l, i) => ({ day: l, ออเดอร์: 0, ยอดขาย: 0 }))
    orders.forEach(o => {
      const dt = new Date(o.created_at)
      if (isNaN(dt)) return
      const bkk = new Date(dt.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
      d[bkk.getDay()].ออเดอร์++
      d[bkk.getDay()].ยอดขาย += parseFloat(o.sale_price) || 0
    })
    return d
  }, [orders])

  // Channel stats
  const channelStats = useMemo(() => {
    const m = {}
    orders.forEach(o => {
      const ch = o.sales_channel || '—'
      if (!m[ch]) m[ch] = { name: ch, count: 0, sales: 0 }
      m[ch].count++
      m[ch].sales += parseFloat(o.sale_price) || 0
    })
    return Object.values(m).sort((a, b) => b.sales - a.sales)
  }, [orders])

  // Pie data
  const paymentPie = useMemo(() => [
    { name: 'COD', value: codTotal, color: C.accent },
    { name: 'โอน', value: transTotal, color: C.success },
  ].filter(p => p.value > 0), [codTotal, transTotal])

  // ═══ Render ═══
  if (status === 'loading') return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: C.fontSans }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&family=Noto+Sans+Thai:wght@300;400;500;600;700;800&display=swap');`}</style>
      <div style={{ textAlign: 'center', color: C.textDim }}>
        <div style={{ fontSize: 18, fontFamily: C.font, fontWeight: 600 }}>กำลังโหลด...</div>
      </div>
    </div>
  )

  if (status === 'login') return <BossLogin onLogin={handleLogin} />

  const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 2, boxShadow: C.shadow }
  const th = { padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: C.textDim, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', borderBottom: `2px solid ${C.borderDark}`, fontFamily: C.fontSans }
  const td = { padding: '10px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 13, fontFamily: C.fontSans }

  const navItems = [
    { id: 'overview', icon: '📊', label: 'ภาพรวม' },
    { id: 'employees', icon: '👥', label: 'พนักงาน' },
    { id: 'products', icon: '📦', label: 'สินค้า' },
    { id: 'time', icon: '⏰', label: 'ช่วงเวลา' },
    { id: 'channels', icon: '📢', label: 'ช่องทาง' },
    { id: 'orders', icon: '📋', label: 'รายการออเดอร์' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: C.fontSans }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&family=Noto+Sans+Thai:wght@300;400;500;600;700;800&display=swap');
        body { background: ${C.bg}; }
        table { border-spacing: 0; width: 100%; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: ${C.borderDark}; border-radius: 3px; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.4s ease; }
      `}</style>

      {/* ═══ Top Bar ═══ */}
      <div style={{ background: C.navy, color: '#fff', padding: '0 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, letterSpacing: 4, fontWeight: 500, color: '#a0a0b0' }}>THE MT</span>
          <span style={{ width: 1, height: 24, background: '#3a3a50' }}></span>
          <span style={{ fontSize: 15, fontFamily: C.font, fontWeight: 600 }}>Boss Dashboard</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: '#a0a0b0' }}>สวัสดี, {profile?.full_name || 'หัวหน้า'}</span>
          <button onClick={handleLogout} style={{ padding: '6px 16px', border: '1px solid #3a3a50', borderRadius: 2, background: 'transparent', color: '#a0a0b0', fontSize: 12, cursor: 'pointer', fontFamily: C.fontSans }}>ออกจากระบบ</button>
        </div>
      </div>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)' }}>
        {/* ═══ Sidebar ═══ */}
        <div style={{ width: 220, background: C.surface, borderRight: `1px solid ${C.border}`, padding: '20px 0', flexShrink: 0 }}>
          {navItems.map(n => (
            <button key={n.id} onClick={() => setSection(n.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 24px',
              border: 'none', background: section === n.id ? C.surfaceHover : 'transparent',
              color: section === n.id ? C.accent : C.textDim, fontSize: 13, fontWeight: section === n.id ? 600 : 400,
              cursor: 'pointer', fontFamily: C.fontSans, textAlign: 'left',
              borderLeft: section === n.id ? `3px solid ${C.accent}` : '3px solid transparent',
              transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: 16 }}>{n.icon}</span>
              {n.label}
            </button>
          ))}

          {/* Date filter in sidebar */}
          <div style={{ padding: '20px 20px 0', borderTop: `1px solid ${C.border}`, marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>ช่วงเวลา</div>
            {[
              { key: 'all', label: 'ทั้งหมด' },
              { key: 'today', label: 'วันนี้' },
              { key: 'yesterday', label: 'เมื่อวาน' },
              { key: 'week', label: '7 วัน' },
              { key: 'month', label: 'เดือนนี้' },
              { key: 'last_month', label: 'เดือนก่อน' },
            ].map(q => (
              <button key={q.key} onClick={() => setQuick(q.key)} style={{
                display: 'block', width: '100%', padding: '7px 12px', marginBottom: 3,
                border: 'none', borderRadius: 2, textAlign: 'left',
                background: quickRange === q.key ? C.accent : 'transparent',
                color: quickRange === q.key ? '#fff' : C.textDim,
                fontSize: 12, fontWeight: quickRange === q.key ? 600 : 400,
                cursor: 'pointer', fontFamily: C.fontSans,
              }}>{q.label}</button>
            ))}
            <div style={{ marginTop: 10 }}>
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setQuickRange('') }}
                style={{ width: '100%', padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 11, fontFamily: C.fontSans, marginBottom: 4, boxSizing: 'border-box' }} />
              <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setQuickRange('') }}
                style={{ width: '100%', padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 11, fontFamily: C.fontSans, boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>

        {/* ═══ Main Content ═══ */}
        <div style={{ flex: 1, padding: 32, overflowY: 'auto', maxHeight: 'calc(100vh - 56px)' }}>
          {/* Header */}
          {!(section === 'employees' && selectedEmployee) && (
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 28, fontFamily: C.font, fontWeight: 700, color: C.text, margin: 0 }}>
              {navItems.find(n => n.id === section)?.icon} {navItems.find(n => n.id === section)?.label}
            </h1>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
              {fmtDateFull(dateFrom)}{dateFrom !== dateTo ? ` — ${fmtDateFull(dateTo)}` : ''} · {totalOrders} ออเดอร์ · ฿{fmt(totalSales)}
            </div>
          </div>
          )}

          {/* ═══════ OVERVIEW ═══════ */}
          {section === 'overview' && (
            <div className="fade-in">
              {/* KPI Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
                {[
                  { label: 'ยอดขายรวม', value: `฿${fmt(totalSales)}`, sub: `${totalOrders} ออเดอร์`, color: C.accent },
                  { label: 'เฉลี่ย/ออเดอร์', value: `฿${fmt(avgOrder)}`, sub: '', color: C.navy },
                  { label: 'COD', value: `฿${fmt(codTotal)}`, sub: `${codOrders.length} รายการ`, color: C.accent },
                  { label: 'โอนเงิน', value: `฿${fmt(transTotal)}`, sub: `${transOrders.length} รายการ`, color: C.success },
                  { label: 'ทีม', value: teamStats.length, sub: `${empStats.length} คน`, color: C.navy },
                ].map((k, i) => (
                  <div key={i} style={{ ...card, padding: 20, borderTop: `3px solid ${k.color}` }}>
                    <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>{k.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: C.text, fontFamily: C.font }}>{k.value}</div>
                    {k.sub && <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{k.sub}</div>}
                  </div>
                ))}
              </div>

              {/* Charts Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
                {/* Daily Trend */}
                <div style={{ ...card, padding: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16, fontFamily: C.font }}>ยอดขายรายวัน</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={dailyChart}>
                      <defs>
                        <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.accent} stopOpacity={0.15} />
                          <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.textDim, fontFamily: C.fontSans }} tickFormatter={d => fmtDate(d)} />
                      <YAxis tick={{ fontSize: 10, fill: C.textDim }} tickFormatter={v => `฿${fmt(v)}`} />
                      <Tooltip content={<ClassicTooltip />} />
                      <Area type="monotone" dataKey="ยอดขาย" stroke={C.accent} strokeWidth={2} fill="url(#gradSales)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Payment Pie */}
                <div style={{ ...card, padding: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16, fontFamily: C.font }}>สัดส่วนการชำระ</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={paymentPie} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="value">
                        {paymentPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip content={<ClassicTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 8 }}>
                    {paymentPie.map((p, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 1, background: p.color }}></div>
                        <span style={{ fontSize: 11, color: C.textDim }}>{p.name}: ฿{fmt(p.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Top 5 Employees + Top 5 Products */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ ...card, padding: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: C.font }}>🏆 Top พนักงาน</div>
                  <table>
                    <thead><tr>
                      <th style={{ ...th, width: 30 }}>#</th>
                      <th style={th}>ชื่อ</th>
                      <th style={{ ...th, textAlign: 'center' }}>ออเดอร์</th>
                      <th style={{ ...th, textAlign: 'right' }}>ยอดขาย</th>
                    </tr></thead>
                    <tbody>
                      {empStats.slice(0, 8).map((e, i) => (
                        <tr key={e.name} style={{ background: i < 3 ? '#fdfaf3' : 'transparent' }}>
                          <td style={{ ...td, textAlign: 'center', fontWeight: 800, color: i < 3 ? C.gold : C.textMuted }}>{i + 1}</td>
                          <td style={{ ...td, fontWeight: 600 }}>{i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : ''}{e.name}</td>
                          <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: C.accent }}>{e.count}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: C.success }}>฿{fmt(e.sales)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ ...card, padding: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: C.font }}>📦 Top สินค้า</div>
                  <table>
                    <thead><tr>
                      <th style={{ ...th, width: 30 }}>#</th>
                      <th style={th}>สินค้า</th>
                      <th style={{ ...th, textAlign: 'center' }}>จำนวน</th>
                      <th style={{ ...th, textAlign: 'right' }}>ยอดขาย</th>
                    </tr></thead>
                    <tbody>
                      {productStats.slice(0, 8).map((p, i) => (
                        <tr key={p.name} style={{ background: i < 3 ? '#fdfaf3' : 'transparent' }}>
                          <td style={{ ...td, textAlign: 'center', fontWeight: 800, color: i < 3 ? C.gold : C.textMuted }}>{i + 1}</td>
                          <td style={{ ...td, fontWeight: 600 }}>{p.name}</td>
                          <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: C.accent }}>{p.count}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: C.success }}>฿{fmt(p.sales)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════ EMPLOYEES ═══════ */}
          {section === 'employees' && (
            <div className="fade-in">
              {selectedEmployee ? (() => {
                // ═══ Individual Employee Report ═══
                const emp = selectedEmployee
                const empOrders = orders.filter(o => o.employee_name === emp.name)
                const empSales = empOrders.reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)
                const empCod = empOrders.filter(o => o.payment_type !== 'transfer')
                const empTrans = empOrders.filter(o => o.payment_type === 'transfer')
                const empCodAmt = empCod.reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)
                const empTransAmt = empTrans.reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)
                const empAvg = empOrders.length > 0 ? empSales / empOrders.length : 0

                // Products
                const empProducts = {}
                empOrders.forEach(o => {
                  const p = (o.remark || '').trim() || '—'
                  if (!empProducts[p]) empProducts[p] = { name: p, count: 0, sales: 0 }
                  empProducts[p].count++
                  empProducts[p].sales += parseFloat(o.sale_price) || 0
                })
                const empProdList = Object.values(empProducts).sort((a, b) => b.count - a.count)

                // Channels
                const empChannels = {}
                empOrders.forEach(o => {
                  const ch = o.sales_channel || '—'
                  if (!empChannels[ch]) empChannels[ch] = { name: ch, count: 0, sales: 0 }
                  empChannels[ch].count++
                  empChannels[ch].sales += parseFloat(o.sale_price) || 0
                })
                const empChList = Object.values(empChannels).sort((a, b) => b.count - a.count)

                // Hourly
                const empHourly = Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2, '0')}:00`, ออเดอร์: 0, ยอดขาย: 0 }))
                empOrders.forEach(o => {
                  const dt = new Date(o.created_at)
                  if (isNaN(dt)) return
                  const bkk = new Date(dt.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
                  empHourly[bkk.getHours()].ออเดอร์++
                  empHourly[bkk.getHours()].ยอดขาย += parseFloat(o.sale_price) || 0
                })
                const peakH = empHourly.reduce((a, b) => b.ออเดอร์ > a.ออเดอร์ ? b : a)

                // Daily
                const empDaily = {}
                empOrders.forEach(o => {
                  const d = (o.order_date || '').substring(0, 10)
                  if (!d) return
                  if (!empDaily[d]) empDaily[d] = { date: d, ยอดขาย: 0, ออเดอร์: 0 }
                  empDaily[d].ยอดขาย += parseFloat(o.sale_price) || 0
                  empDaily[d].ออเดอร์++
                })
                const empDailyList = Object.values(empDaily).sort((a, b) => a.date.localeCompare(b.date))

                // Rank
                const rank = empStats.findIndex(e => e.name === emp.name) + 1

                return <>
                  {/* Back button + header */}
                  <div style={{ marginBottom: 20 }}>
                    <button onClick={() => setSelectedEmployee(null)} style={{
                      padding: '8px 18px', border: `1px solid ${C.border}`, borderRadius: 2,
                      background: C.surface, color: C.textDim, fontSize: 13, cursor: 'pointer',
                      fontFamily: C.fontSans, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16,
                    }}>← กลับ ดูทั้งหมด</button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#fff', fontWeight: 700 }}>
                        {emp.name.charAt(0)}
                      </div>
                      <div>
                        <h2 style={{ margin: 0, fontSize: 22, fontFamily: C.font, fontWeight: 700, color: C.text }}>{emp.name}</h2>
                        <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>อันดับ #{rank} · {empOrders.length} ออเดอร์ · ฿{fmt(empSales)}</div>
                      </div>
                    </div>
                  </div>

                  {/* KPI Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
                    {[
                      { label: 'ยอดขายรวม', value: `฿${fmt(empSales)}`, color: C.accent },
                      { label: 'ออเดอร์', value: empOrders.length, color: C.navy },
                      { label: 'เฉลี่ย/ออเดอร์', value: `฿${fmt(empAvg)}`, color: C.success },
                      { label: 'COD', value: `${empCod.length} (฿${fmt(empCodAmt)})`, color: C.accent },
                      { label: 'โอน', value: `${empTrans.length} (฿${fmt(empTransAmt)})`, color: C.success },
                    ].map((k, i) => (
                      <div key={i} style={{ ...card, padding: 16, borderTop: `3px solid ${k.color}` }}>
                        <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>{k.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: C.text, fontFamily: C.font }}>{k.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Daily chart */}
                  {empDailyList.length > 1 && (
                    <div style={{ ...card, padding: 20, marginBottom: 20 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: C.font }}>ยอดขายรายวัน</div>
                      <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={empDailyList}>
                          <defs><linearGradient id="gradEmp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity={0.15} /><stop offset="100%" stopColor={C.accent} stopOpacity={0} /></linearGradient></defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.textDim }} tickFormatter={d => fmtDate(d)} />
                          <YAxis tick={{ fontSize: 10, fill: C.textDim }} tickFormatter={v => `฿${fmt(v)}`} />
                          <Tooltip content={<ClassicTooltip />} />
                          <Area type="monotone" dataKey="ยอดขาย" stroke={C.accent} strokeWidth={2} fill="url(#gradEmp)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* 3 columns: Products, Channels, Hourly */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                    {/* Products */}
                    <div style={{ ...card, padding: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10, fontFamily: C.font }}>📦 สินค้าที่ขาย ({empProdList.length})</div>
                      <table>
                        <thead><tr>
                          <th style={{ ...th, fontSize: 10, padding: '6px 10px' }}>สินค้า</th>
                          <th style={{ ...th, fontSize: 10, padding: '6px 10px', textAlign: 'center' }}>จำนวน</th>
                          <th style={{ ...th, fontSize: 10, padding: '6px 10px', textAlign: 'right' }}>ยอด</th>
                        </tr></thead>
                        <tbody>
                          {empProdList.map((p, i) => (
                            <tr key={p.name} style={{ background: i === 0 ? '#fdfaf3' : 'transparent' }}>
                              <td style={{ ...td, fontSize: 12, padding: '6px 10px', fontWeight: i === 0 ? 700 : 400 }}>{i === 0 ? '🏆 ' : ''}{p.name}</td>
                              <td style={{ ...td, fontSize: 12, padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: C.accent }}>{p.count}</td>
                              <td style={{ ...td, fontSize: 12, padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: C.success }}>฿{fmt(p.sales)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Channels */}
                    <div style={{ ...card, padding: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10, fontFamily: C.font }}>📢 ช่องทาง ({empChList.length})</div>
                      <table>
                        <thead><tr>
                          <th style={{ ...th, fontSize: 10, padding: '6px 10px' }}>เพจ</th>
                          <th style={{ ...th, fontSize: 10, padding: '6px 10px', textAlign: 'center' }}>จำนวน</th>
                          <th style={{ ...th, fontSize: 10, padding: '6px 10px', textAlign: 'right' }}>ยอด</th>
                        </tr></thead>
                        <tbody>
                          {empChList.map((c, i) => (
                            <tr key={c.name} style={{ background: i === 0 ? '#fdfaf3' : 'transparent' }}>
                              <td style={{ ...td, fontSize: 12, padding: '6px 10px', fontWeight: i === 0 ? 700 : 400 }}>{i === 0 ? '🏆 ' : ''}{c.name}</td>
                              <td style={{ ...td, fontSize: 12, padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: C.accent }}>{c.count}</td>
                              <td style={{ ...td, fontSize: 12, padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: C.success }}>฿{fmt(c.sales)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Hourly */}
                    <div style={{ ...card, padding: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10, fontFamily: C.font }}>⏰ ช่วงเวลาขายดี</div>
                      <div style={{ textAlign: 'center', padding: '10px 0 14px', background: C.surfaceAlt, borderRadius: 2, marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: C.textMuted }}>ชั่วโมงขายดีสุด</div>
                        <div style={{ fontSize: 24, fontWeight: 800, fontFamily: C.font, color: C.accent }}>{peakH.hour}</div>
                        <div style={{ fontSize: 10, color: C.textDim }}>{peakH.ออเดอร์} ออเดอร์ · ฿{fmt(peakH.ยอดขาย)}</div>
                      </div>
                      <ResponsiveContainer width="100%" height={120}>
                        <BarChart data={empHourly}>
                          <XAxis dataKey="hour" tick={{ fontSize: 8, fill: C.textDim }} interval={3} />
                          <YAxis tick={{ fontSize: 8, fill: C.textDim }} width={20} />
                          <Tooltip content={<ClassicTooltip />} />
                          <Bar dataKey="ออเดอร์" fill={C.accent} radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Orders table */}
                  <div style={{ ...card, padding: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: C.font }}>📋 รายการออเดอร์ ({empOrders.length})</div>
                    <div style={{ overflowX: 'auto' }}>
                      <table>
                        <thead><tr>
                          <th style={{ ...th, width: 36 }}>#</th>
                          <th style={th}>เลขออเดอร์</th>
                          <th style={th}>วันที่</th>
                          <th style={th}>ลูกค้า</th>
                          <th style={th}>สินค้า</th>
                          <th style={th}>เพจ</th>
                          <th style={{ ...th, textAlign: 'center' }}>ชำระ</th>
                          <th style={{ ...th, textAlign: 'right' }}>ยอด</th>
                        </tr></thead>
                        <tbody>
                          {empOrders.slice(0, 100).map((o, i) => (
                            <tr key={o.id} style={{ background: i % 2 === 0 ? C.surfaceAlt : 'transparent' }}>
                              <td style={{ ...td, textAlign: 'center', color: C.textMuted, fontSize: 11 }}>{i + 1}</td>
                              <td style={{ ...td, fontWeight: 600, fontSize: 12 }}>{o.order_number || '—'}</td>
                              <td style={{ ...td, fontSize: 11, color: C.textDim }}>{o.order_date || '—'}</td>
                              <td style={{ ...td, fontWeight: 500 }}>{o.customer_name || '—'}</td>
                              <td style={{ ...td, fontSize: 12, color: C.textDim, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.remark || '—'}</td>
                              <td style={{ ...td, fontSize: 11, color: C.textDim }}>{o.sales_channel || '—'}</td>
                              <td style={{ ...td, textAlign: 'center' }}>
                                <span style={{ padding: '2px 8px', borderRadius: 2, fontSize: 10, fontWeight: 600, background: o.payment_type === 'transfer' ? '#e8f5e9' : '#fff3e0', color: o.payment_type === 'transfer' ? C.success : C.accent }}>{o.payment_type === 'transfer' ? 'โอน' : 'COD'}</span>
                              </td>
                              <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: C.success }}>฿{fmt(parseFloat(o.sale_price) || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {empOrders.length > 100 && <div style={{ textAlign: 'center', padding: 12, color: C.textMuted, fontSize: 12 }}>แสดง 100 จาก {empOrders.length} รายการ</div>}
                    </div>
                  </div>
                </>
              })() : (
                <>
              {/* Team summary */}
              {teamStats.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(teamStats.length, 4)}, 1fr)`, gap: 16, marginBottom: 24 }}>
                  {teamStats.map((t, i) => (
                    <div key={t.name} style={{ ...card, padding: 20, borderLeft: `4px solid ${[C.accent, C.success, C.navy, C.gold][i % 4]}` }}>
                      <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>{t.name}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: C.font, color: C.text }}>฿{fmt(t.sales)}</div>
                      <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{t.count} ออเดอร์</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Employee bar chart */}
              <div style={{ ...card, padding: 20, marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16, fontFamily: C.font }}>ยอดขายแต่ละคน</div>
                <ResponsiveContainer width="100%" height={Math.max(200, empStats.length * 32)}>
                  <BarChart data={empStats.slice(0, 20)} layout="vertical" margin={{ left: 80, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: C.textDim }} tickFormatter={v => `฿${fmt(v)}`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: C.text, fontFamily: C.fontSans }} width={80} />
                    <Tooltip content={<ClassicTooltip />} />
                    <Bar dataKey="sales" fill={C.accent} radius={[0, 3, 3, 0]} name="ยอดขาย" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Full employee table */}
              <div style={{ ...card, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: C.font }}>รายละเอียดพนักงาน ({empStats.length} คน) — กดชื่อเพื่อดูรายงานรายบุคคล</div>
                <table>
                  <thead><tr>
                    <th style={{ ...th, width: 40 }}>#</th>
                    <th style={th}>ชื่อ</th>
                    <th style={{ ...th, textAlign: 'center' }}>ออเดอร์</th>
                    <th style={{ ...th, textAlign: 'right' }}>ยอดขาย</th>
                    <th style={{ ...th, textAlign: 'center' }}>COD</th>
                    <th style={{ ...th, textAlign: 'center' }}>โอน</th>
                    <th style={{ ...th, textAlign: 'right' }}>เฉลี่ย/ออเดอร์</th>
                    <th style={{ ...th, textAlign: 'right', width: '12%' }}>สัดส่วน</th>
                    <th style={{ ...th, textAlign: 'center', width: 80 }}></th>
                  </tr></thead>
                  <tbody>
                    {empStats.map((e, i) => {
                      const pct = totalSales > 0 ? (e.sales / totalSales * 100).toFixed(1) : '0.0'
                      return (
                        <tr key={e.name} style={{ background: i < 3 ? '#fdfaf3' : (i % 2 === 0 ? C.surfaceAlt : 'transparent'), cursor: 'pointer', transition: 'background 0.15s' }} onClick={() => setSelectedEmployee(e)} onMouseEnter={ev => ev.currentTarget.style.background = '#f0ede6'} onMouseLeave={ev => ev.currentTarget.style.background = i < 3 ? '#fdfaf3' : (i % 2 === 0 ? C.surfaceAlt : 'transparent')}>
                          <td style={{ ...td, textAlign: 'center', fontWeight: 800, color: i < 3 ? C.gold : C.textMuted }}>{i + 1}</td>
                          <td style={{ ...td, fontWeight: 600, color: C.accent }}>{i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : ''}{e.name}</td>
                          <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: C.accent }}>{e.count}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: C.success }}>฿{fmt(e.sales)}</td>
                          <td style={{ ...td, textAlign: 'center' }}>{e.cod}</td>
                          <td style={{ ...td, textAlign: 'center' }}>{e.trans}</td>
                          <td style={{ ...td, textAlign: 'right' }}>฿{fmt(e.count > 0 ? e.sales / e.count : 0)}</td>
                          <td style={{ ...td, textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ flex: 1, height: 5, borderRadius: 2, background: C.surfaceHover, overflow: 'hidden' }}>
                                <div style={{ width: pct + '%', height: '100%', borderRadius: 2, background: C.accent }}></div>
                              </div>
                              <span style={{ fontSize: 10, color: C.textMuted, minWidth: 36 }}>{pct}%</span>
                            </div>
                          </td>
                          <td style={{ ...td, textAlign: 'center' }}>
                            <span style={{ padding: '4px 10px', borderRadius: 2, fontSize: 11, fontWeight: 600, background: C.navy, color: '#fff', cursor: 'pointer' }}>ดูรายงาน</span>
                          </td>
                        </tr>
                      )
                    })}
                    <tr style={{ background: '#f5f0e8', fontWeight: 700 }}>
                      <td colSpan="2" style={{ ...td, fontWeight: 800 }}>รวม</td>
                      <td style={{ ...td, textAlign: 'center', fontWeight: 800, color: C.accent }}>{totalOrders}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: C.success }}>฿{fmt(totalSales)}</td>
                      <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{codOrders.length}</td>
                      <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{transOrders.length}</td>
                      <td style={{ ...td, textAlign: 'right' }}>฿{fmt(avgOrder)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>100%</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
                </>
              )}
            </div>
          )}

          {/* ═══════ PRODUCTS ═══════ */}
          {section === 'products' && (
            <div className="fade-in">
              {/* Product bar chart */}
              <div style={{ ...card, padding: 20, marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16, fontFamily: C.font }}>จำนวนออเดอร์แยกสินค้า</div>
                <ResponsiveContainer width="100%" height={Math.max(200, productStats.length * 32)}>
                  <BarChart data={productStats.slice(0, 15)} layout="vertical" margin={{ left: 120, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: C.textDim }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: C.text, fontFamily: C.fontSans }} width={120} />
                    <Tooltip content={<ClassicTooltip />} />
                    <Bar dataKey="count" fill={C.accent} radius={[0, 3, 3, 0]} name="ออเดอร์" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Full product table */}
              <div style={{ ...card, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: C.font }}>รายละเอียดสินค้า ({productStats.length} รายการ)</div>
                <table>
                  <thead><tr>
                    <th style={{ ...th, width: 40 }}>#</th>
                    <th style={th}>สินค้า</th>
                    <th style={{ ...th, textAlign: 'center' }}>ออเดอร์</th>
                    <th style={{ ...th, textAlign: 'right' }}>ยอดขาย</th>
                    <th style={{ ...th, textAlign: 'center' }}>COD</th>
                    <th style={{ ...th, textAlign: 'right' }}>ยอด COD</th>
                    <th style={{ ...th, textAlign: 'center' }}>โอน</th>
                    <th style={{ ...th, textAlign: 'right' }}>ยอดโอน</th>
                    <th style={{ ...th, textAlign: 'right', width: '12%' }}>สัดส่วน</th>
                  </tr></thead>
                  <tbody>
                    {productStats.map((p, i) => {
                      const pct = totalSales > 0 ? (p.sales / totalSales * 100).toFixed(1) : '0.0'
                      return (
                        <tr key={p.name} style={{ background: i < 3 ? '#fdfaf3' : (i % 2 === 0 ? C.surfaceAlt : 'transparent') }}>
                          <td style={{ ...td, textAlign: 'center', fontWeight: 800, color: i < 3 ? C.gold : C.textMuted }}>{i + 1}</td>
                          <td style={{ ...td, fontWeight: 600 }}>{p.name}</td>
                          <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: C.accent }}>{p.count}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: C.success }}>฿{fmt(p.sales)}</td>
                          <td style={{ ...td, textAlign: 'center' }}>{p.cod}</td>
                          <td style={{ ...td, textAlign: 'right', color: C.accent }}>฿{fmt(p.codAmt)}</td>
                          <td style={{ ...td, textAlign: 'center' }}>{p.trans}</td>
                          <td style={{ ...td, textAlign: 'right', color: C.success }}>฿{fmt(p.transAmt)}</td>
                          <td style={{ ...td }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ flex: 1, height: 5, borderRadius: 2, background: C.surfaceHover, overflow: 'hidden' }}>
                                <div style={{ width: pct + '%', height: '100%', borderRadius: 2, background: C.accent }}></div>
                              </div>
                              <span style={{ fontSize: 10, color: C.textMuted, minWidth: 36 }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    <tr style={{ background: '#f5f0e8', fontWeight: 700 }}>
                      <td colSpan="2" style={{ ...td, fontWeight: 800 }}>รวม</td>
                      <td style={{ ...td, textAlign: 'center', fontWeight: 800, color: C.accent }}>{totalOrders}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: C.success }}>฿{fmt(totalSales)}</td>
                      <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{codOrders.length}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: C.accent }}>฿{fmt(codTotal)}</td>
                      <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{transOrders.length}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: C.success }}>฿{fmt(transTotal)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══════ TIME ═══════ */}
          {section === 'time' && (
            <div className="fade-in">
              {/* Peak summary cards */}
              {(() => {
                const peakHour = hourlyStats.reduce((a, b) => b.ออเดอร์ > a.ออเดอร์ ? b : a)
                const peakDow = dowStats.reduce((a, b) => b.ออเดอร์ > a.ออเดอร์ ? b : a)
                const periods = [
                  { name: 'เช้า (06-12)', count: 0, sales: 0 },
                  { name: 'บ่าย (12-18)', count: 0, sales: 0 },
                  { name: 'ค่ำ (18-24)', count: 0, sales: 0 },
                  { name: 'ดึก (00-06)', count: 0, sales: 0 },
                ]
                hourlyStats.forEach((h, i) => {
                  if (i >= 6 && i < 12) { periods[0].count += h.ออเดอร์; periods[0].sales += h.ยอดขาย }
                  else if (i >= 12 && i < 18) { periods[1].count += h.ออเดอร์; periods[1].sales += h.ยอดขาย }
                  else if (i >= 18) { periods[2].count += h.ออเดอร์; periods[2].sales += h.ยอดขาย }
                  else { periods[3].count += h.ออเดอร์; periods[3].sales += h.ยอดขาย }
                })
                const peakPeriod = periods.reduce((a, b) => b.count > a.count ? b : a)

                return <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                    <div style={{ ...card, padding: 24, textAlign: 'center', borderTop: `3px solid ${C.accent}` }}>
                      <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>ชั่วโมงขายดีสุด</div>
                      <div style={{ fontSize: 32, fontWeight: 800, fontFamily: C.font, color: C.accent }}>{peakHour.hour}</div>
                      <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>{peakHour.ออเดอร์} ออเดอร์ · ฿{fmt(peakHour.ยอดขาย)}</div>
                    </div>
                    <div style={{ ...card, padding: 24, textAlign: 'center', borderTop: `3px solid ${C.navy}` }}>
                      <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>วันขายดีสุด</div>
                      <div style={{ fontSize: 32, fontWeight: 800, fontFamily: C.font, color: C.navy }}>{peakDow.day}</div>
                      <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>{peakDow.ออเดอร์} ออเดอร์ · ฿{fmt(peakDow.ยอดขาย)}</div>
                    </div>
                    <div style={{ ...card, padding: 24, textAlign: 'center', borderTop: `3px solid ${C.success}` }}>
                      <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>ช่วงขายดีสุด</div>
                      <div style={{ fontSize: 32, fontWeight: 800, fontFamily: C.font, color: C.success }}>{peakPeriod.name}</div>
                      <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>{peakPeriod.count} ออเดอร์ · ฿{fmt(peakPeriod.sales)}</div>
                    </div>
                  </div>

                  {/* Period table */}
                  <div style={{ ...card, padding: 20, marginBottom: 24 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: C.font }}>สรุปช่วงเวลา</div>
                    <table>
                      <thead><tr>
                        <th style={th}>ช่วง</th>
                        <th style={{ ...th, textAlign: 'center' }}>ออเดอร์</th>
                        <th style={{ ...th, textAlign: 'right' }}>ยอดขาย</th>
                        <th style={{ ...th, textAlign: 'right' }}>เฉลี่ย</th>
                        <th style={{ ...th, textAlign: 'right', width: '25%' }}>สัดส่วน</th>
                      </tr></thead>
                      <tbody>
                        {periods.map(p => {
                          const pct = totalOrders > 0 ? (p.count / totalOrders * 100).toFixed(1) : '0.0'
                          return (
                            <tr key={p.name} style={{ background: p.name === peakPeriod.name ? '#fdfaf3' : 'transparent' }}>
                              <td style={{ ...td, fontWeight: 600 }}>{p.name === peakPeriod.name ? '🏆 ' : ''}{p.name}</td>
                              <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: C.accent }}>{p.count}</td>
                              <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: C.success }}>฿{fmt(p.sales)}</td>
                              <td style={{ ...td, textAlign: 'right' }}>฿{fmt(p.count > 0 ? p.sales / p.count : 0)}</td>
                              <td style={{ ...td }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <div style={{ flex: 1, height: 6, borderRadius: 2, background: C.surfaceHover, overflow: 'hidden' }}>
                                    <div style={{ width: pct + '%', height: '100%', borderRadius: 2, background: p.name === peakPeriod.name ? C.accent : C.borderDark }}></div>
                                  </div>
                                  <span style={{ fontSize: 11, color: C.textMuted, minWidth: 40 }}>{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              })()}

              {/* Hourly + DOW charts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ ...card, padding: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16, fontFamily: C.font }}>ออเดอร์รายชั่วโมง</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={hourlyStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="hour" tick={{ fontSize: 9, fill: C.textDim }} interval={2} />
                      <YAxis tick={{ fontSize: 10, fill: C.textDim }} />
                      <Tooltip content={<ClassicTooltip />} />
                      <Bar dataKey="ออเดอร์" fill={C.accent} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ ...card, padding: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16, fontFamily: C.font }}>ออเดอร์รายวัน (สัปดาห์)</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dowStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.textDim }} />
                      <YAxis tick={{ fontSize: 10, fill: C.textDim }} />
                      <Tooltip content={<ClassicTooltip />} />
                      <Bar dataKey="ออเดอร์" fill={C.navy} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ═══════ CHANNELS ═══════ */}
          {section === 'channels' && (
            <div className="fade-in">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div style={{ ...card, padding: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16, fontFamily: C.font }}>ยอดขายแยกช่องทาง</div>
                  <ResponsiveContainer width="100%" height={Math.max(180, channelStats.length * 36)}>
                    <BarChart data={channelStats} layout="vertical" margin={{ left: 100, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: C.textDim }} tickFormatter={v => `฿${fmt(v)}`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: C.text }} width={100} />
                      <Tooltip content={<ClassicTooltip />} />
                      <Bar dataKey="sales" fill={C.success} radius={[0, 3, 3, 0]} name="ยอดขาย" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ ...card, padding: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16, fontFamily: C.font }}>สัดส่วนช่องทาง</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={channelStats.map((c, i) => ({ ...c, value: c.sales, color: [C.accent, C.success, C.navy, C.gold, C.dangerLight, '#8884d8', '#82ca9d'][i % 7] }))} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                        {channelStats.map((_, i) => <Cell key={i} fill={[C.accent, C.success, C.navy, C.gold, C.dangerLight, '#8884d8', '#82ca9d'][i % 7]} />)}
                      </Pie>
                      <Tooltip content={<ClassicTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 8 }}>
                    {channelStats.map((c, i) => (
                      <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.textDim }}>
                        <div style={{ width: 8, height: 8, borderRadius: 1, background: [C.accent, C.success, C.navy, C.gold, C.dangerLight, '#8884d8', '#82ca9d'][i % 7] }}></div>
                        {c.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ ...card, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: C.font }}>รายละเอียดช่องทาง</div>
                <table>
                  <thead><tr>
                    <th style={{ ...th, width: 40 }}>#</th>
                    <th style={th}>ช่องทาง</th>
                    <th style={{ ...th, textAlign: 'center' }}>ออเดอร์</th>
                    <th style={{ ...th, textAlign: 'right' }}>ยอดขาย</th>
                    <th style={{ ...th, textAlign: 'right' }}>เฉลี่ย</th>
                    <th style={{ ...th, textAlign: 'right', width: '20%' }}>สัดส่วน</th>
                  </tr></thead>
                  <tbody>
                    {channelStats.map((c, i) => {
                      const pct = totalSales > 0 ? (c.sales / totalSales * 100).toFixed(1) : '0.0'
                      return (
                        <tr key={c.name} style={{ background: i % 2 === 0 ? C.surfaceAlt : 'transparent' }}>
                          <td style={{ ...td, textAlign: 'center', fontWeight: 800, color: C.textMuted }}>{i + 1}</td>
                          <td style={{ ...td, fontWeight: 600 }}>{c.name}</td>
                          <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: C.accent }}>{c.count}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: C.success }}>฿{fmt(c.sales)}</td>
                          <td style={{ ...td, textAlign: 'right' }}>฿{fmt(c.count > 0 ? c.sales / c.count : 0)}</td>
                          <td style={{ ...td }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ flex: 1, height: 5, borderRadius: 2, background: C.surfaceHover, overflow: 'hidden' }}>
                                <div style={{ width: pct + '%', height: '100%', borderRadius: 2, background: [C.accent, C.success, C.navy, C.gold][i % 4] }}></div>
                              </div>
                              <span style={{ fontSize: 10, color: C.textMuted, minWidth: 36 }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══════ ORDERS ═══════ */}
          {section === 'orders' && (
            <div className="fade-in">
              <div style={{ ...card, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: C.font }}>รายการออเดอร์ ({orders.length} รายการ)</div>
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead><tr>
                      <th style={{ ...th, width: 40 }}>#</th>
                      <th style={th}>เลขออเดอร์</th>
                      <th style={th}>วันที่</th>
                      <th style={th}>ลูกค้า</th>
                      <th style={th}>สินค้า</th>
                      <th style={th}>พนักงาน</th>
                      <th style={th}>เพจ</th>
                      <th style={{ ...th, textAlign: 'center' }}>ชำระ</th>
                      <th style={{ ...th, textAlign: 'right' }}>ยอด</th>
                    </tr></thead>
                    <tbody>
                      {orders.slice(0, 200).map((o, i) => (
                        <tr key={o.id} style={{ background: i % 2 === 0 ? C.surfaceAlt : 'transparent' }}>
                          <td style={{ ...td, textAlign: 'center', color: C.textMuted, fontSize: 11 }}>{i + 1}</td>
                          <td style={{ ...td, fontWeight: 600, fontSize: 12 }}>{o.order_number || '—'}</td>
                          <td style={{ ...td, fontSize: 11, color: C.textDim }}>{o.order_date || '—'}</td>
                          <td style={{ ...td, fontWeight: 500 }}>{o.customer_name || '—'}</td>
                          <td style={{ ...td, fontSize: 12, color: C.textDim, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.remark || '—'}</td>
                          <td style={{ ...td, fontSize: 12 }}>{o.employee_name || '—'}</td>
                          <td style={{ ...td, fontSize: 11, color: C.textDim }}>{o.sales_channel || '—'}</td>
                          <td style={{ ...td, textAlign: 'center' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 2, fontSize: 10, fontWeight: 600,
                              background: o.payment_type === 'transfer' ? '#e8f5e9' : '#fff3e0',
                              color: o.payment_type === 'transfer' ? C.success : C.accent,
                            }}>{o.payment_type === 'transfer' ? 'โอน' : 'COD'}</span>
                          </td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: C.success }}>฿{fmt(parseFloat(o.sale_price) || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {orders.length > 200 && <div style={{ textAlign: 'center', padding: 16, color: C.textMuted, fontSize: 12 }}>แสดง 200 จาก {orders.length} รายการ</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
