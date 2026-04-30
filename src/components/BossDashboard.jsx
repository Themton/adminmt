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
  const isMoney = (name) => !name?.includes('ออเดอร์') && !name?.includes('จำนวน') && !name?.includes('count')
  return (
    <div style={{ background: C.navy, padding: '10px 14px', borderRadius: 2, boxShadow: C.shadowMd }}>
      {label && <div style={{ fontSize: 11, color: '#a0a0b0', marginBottom: 4, fontFamily: C.fontSans }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 13, color: '#fff', fontWeight: 600, fontFamily: C.fontSans }}>
          {p.name}: {typeof p.value === 'number' ? (isMoney(p.name) ? `฿${fmt(p.value)}` : fmt(p.value)) : p.value}
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
  const [dataLoading, setDataLoading] = useState(false)
  const [prevOrders, setPrevOrders] = useState([])
  const [targets, setTargets] = useState(() => {
    try { return JSON.parse(localStorage.getItem('boss_targets') || '{}') } catch { return {} }
  })
  const [editTarget, setEditTarget] = useState(false)
  const [showAddUser, setShowAddUser] = useState(false)
  const [userForm, setUserForm] = useState({ email: '', password: '', fullName: '', role: 'employee', teamId: '' })
  const [editingUser, setEditingUser] = useState(null)
  const [editTeamId, setEditTeamId] = useState(null)
  const [editTeamName, setEditTeamName] = useState('')
  const [flash, setFlash] = useState('')
  const [commSettings, setCommSettings] = useState(() => {
    try { return JSON.parse(localStorage.getItem('boss_comm') || '{}') } catch { return {} }
  })

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
  const selectFields = 'id,order_number,order_date,customer_name,customer_phone,sale_price,cod_amount,payment_type,remark,employee_name,employee_id,team_id,sales_channel,created_at,slip_url,customer_address,sub_district,district,zip_code,province,shipping_status,flash_pno,flash_status,flash_sort_code'

  useEffect(() => {
    if (status !== 'ready') return
    const fetchAllOrders = async () => {
      // Step 1: get count
      let countQ = supabase.from('mt_orders').select('id', { count: 'exact', head: true })
      if (dateFrom) countQ = countQ.gte('order_date', dateFrom)
      if (dateTo) countQ = countQ.lte('order_date', dateTo)
      const { count } = await countQ
      if (!count || count === 0) return []

      // Step 2: fetch all pages in parallel
      const pageSize = 1000
      const pages = Math.ceil(count / pageSize)
      const promises = Array.from({ length: pages }, (_, i) => {
        let q = supabase.from('mt_orders').select(selectFields).order('created_at', { ascending: false }).range(i * pageSize, (i + 1) * pageSize - 1)
        if (dateFrom) q = q.gte('order_date', dateFrom)
        if (dateTo) q = q.lte('order_date', dateTo)
        return q
      })
      const results = await Promise.all(promises)
      return results.flatMap(r => r.data || [])
    }
    const fetchPrevOrders = async () => {
      if (!dateFrom || !dateTo) return []
      const from = new Date(dateFrom), to = new Date(dateTo)
      const days = Math.round((to - from) / 864e5) + 1
      const prevTo = new Date(from); prevTo.setDate(prevTo.getDate() - 1)
      const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - days + 1)
      const pf = prevFrom.toISOString().split('T')[0], pt = prevTo.toISOString().split('T')[0]
      let cq = supabase.from('mt_orders').select('id', { count: 'exact', head: true }).gte('order_date', pf).lte('order_date', pt)
      const { count } = await cq
      if (!count) return []
      const ps = 1000, pages = Math.ceil(count / ps)
      const res = await Promise.all(Array.from({ length: pages }, (_, i) => {
        return supabase.from('mt_orders').select(selectFields).order('created_at', { ascending: false }).range(i * ps, (i + 1) * ps - 1).gte('order_date', pf).lte('order_date', pt)
      }))
      return res.flatMap(r => r.data || [])
    }
    const fetchAll = async () => {
      setDataLoading(true)
      const [ords, prev, teamRes, profRes] = await Promise.all([
        fetchAllOrders(),
        fetchPrevOrders(),
        supabase.from('mt_teams').select('*').order('name'),
        supabase.from('mt_profiles').select('*, mt_teams(id, name)').order('created_at', { ascending: false }),
      ])
      setOrders(ords)
      setPrevOrders(prev)
      if (teamRes.data) setTeams(teamRes.data)
      if (profRes.data) setProfiles(profRes.data)
      setDataLoading(false)
    }
    fetchAll()
  }, [status, dateFrom, dateTo])

  // Realtime
  useEffect(() => {
    if (status !== 'ready') return
    const refetch = async () => {
      let countQ = supabase.from('mt_orders').select('id', { count: 'exact', head: true })
      if (dateFrom) countQ = countQ.gte('order_date', dateFrom)
      if (dateTo) countQ = countQ.lte('order_date', dateTo)
      const { count } = await countQ
      if (!count || count === 0) { setOrders([]); return }
      const pageSize = 1000
      const pages = Math.ceil(count / pageSize)
      const promises = Array.from({ length: pages }, (_, i) => {
        let q = supabase.from('mt_orders').select(selectFields).order('created_at', { ascending: false }).range(i * pageSize, (i + 1) * pageSize - 1)
        if (dateFrom) q = q.gte('order_date', dateFrom)
        if (dateTo) q = q.lte('order_date', dateTo)
        return q
      })
      const results = await Promise.all(promises)
      setOrders(results.flatMap(r => r.data || []))
    }
    const ch = supabase.channel('boss-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mt_orders' }, () => refetch())
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

  // ═══ Single-pass Computed Data ═══
  const fmtPhone = (p) => { if (!p) return '—'; p = String(p).replace(/\D/g, ''); if (p.length === 9) p = '0' + p; return p }

  const stats = useMemo(() => {
    let _totalSales = 0, _codCount = 0, _transCount = 0, _codTotal = 0, _transTotal = 0
    const _daily = {}, _emp = {}, _team = {}, _prod = {}, _ch = {}, _prov = {}, _cust = {}, _shipEmp = {}
    let _shipWaiting = 0, _shipPrinted = 0, _shipCreated = 0, _shipDelivering = 0, _shipDelivered = 0, _shipReturned = 0, _shipCancelled = 0
    const _hourly = Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2, '0')}:00`, ออเดอร์: 0, ยอดขาย: 0 }))
    const dowLabels = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
    const _dow = dowLabels.map(l => ({ day: l, ออเดอร์: 0, ยอดขาย: 0 }))

    for (let i = 0; i < orders.length; i++) {
      const o = orders[i]
      const amt = parseFloat(o.sale_price) || 0
      const codAmt = parseFloat(o.cod_amount) || 0
      const isTrans = o.payment_type === 'transfer'
      _totalSales += amt
      if (isTrans) { _transCount++; _transTotal += amt } else { _codCount++; _codTotal += amt }

      // Daily
      const d = (o.order_date || '').substring(0, 10)
      if (d) { if (!_daily[d]) _daily[d] = { date: d, ยอดขาย: 0, ออเดอร์: 0 }; _daily[d].ยอดขาย += amt; _daily[d].ออเดอร์++ }

      // Employee
      const eName = o.employee_name || '—'
      if (!_emp[eName]) _emp[eName] = { name: eName, count: 0, sales: 0, cod: 0, trans: 0 }
      _emp[eName].count++; _emp[eName].sales += amt; if (isTrans) _emp[eName].trans++; else _emp[eName].cod++

      // Team
      const tid = o.team_id || 'none'
      if (!_team[tid]) { const tname = teams.find(t => t.id === tid)?.name || '—'; _team[tid] = { name: tname, count: 0, sales: 0 } }
      _team[tid].count++; _team[tid].sales += amt

      // Product
      const prod = (o.remark || '').trim() || '—'
      if (!_prod[prod]) _prod[prod] = { name: prod, count: 0, sales: 0, cod: 0, codAmt: 0, trans: 0, transAmt: 0 }
      _prod[prod].count++; _prod[prod].sales += amt
      if (isTrans) { _prod[prod].trans++; _prod[prod].transAmt += amt } else { _prod[prod].cod++; _prod[prod].codAmt += codAmt }

      // Channel
      const ch = o.sales_channel || '—'
      if (!_ch[ch]) _ch[ch] = { name: ch, count: 0, sales: 0 }
      _ch[ch].count++; _ch[ch].sales += amt

      // Province
      const prov = (o.province || o.district || '').trim() || '—'
      if (!_prov[prov]) _prov[prov] = { name: prov, count: 0, sales: 0 }
      _prov[prov].count++; _prov[prov].sales += amt

      // Hourly + DOW
      const dt = new Date(o.created_at)
      if (!isNaN(dt)) {
        const bkk = new Date(dt.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
        const hr = bkk.getHours(), dow = bkk.getDay()
        _hourly[hr].ออเดอร์++; _hourly[hr].ยอดขาย += amt
        _dow[dow].ออเดอร์++; _dow[dow].ยอดขาย += amt
      }

      // Customer
      const phone = fmtPhone(o.customer_phone) || '—'
      if (!_cust[phone]) _cust[phone] = { phone, name: o.customer_name || '—', count: 0, sales: 0, firstDate: o.order_date, lastDate: o.order_date, address: '', province: '', district: '', products: {} }
      const cu = _cust[phone]
      cu.count++; cu.sales += amt
      if (o.order_date < cu.firstDate) cu.firstDate = o.order_date
      if (o.order_date > cu.lastDate) cu.lastDate = o.order_date
      if (o.customer_name && o.customer_name !== '—') cu.name = o.customer_name
      if (o.customer_address) cu.address = o.customer_address
      if (o.province) cu.province = o.province
      if (o.district) cu.district = o.district
      if (o.sub_district) cu.subDistrict = o.sub_district
      if (o.zip_code) cu.zipCode = o.zip_code
      const rp = (o.remark || '').trim()
      if (rp) cu.products[rp] = (cu.products[rp] || 0) + 1

      // Shipping
      const ss = o.shipping_status || 'waiting'
      const fs = o.flash_status || ''
      const hasPno = !!o.flash_pno
      if (!_shipEmp[eName]) _shipEmp[eName] = { name: eName, total: 0, waiting: 0, printed: 0, shipped: 0, delivered: 0, returned: 0, cancelled: 0, sales: 0 }
      const se = _shipEmp[eName]; se.total++; se.sales += amt
      if (fs === 'flash_5') { _shipDelivered++; se.delivered++ }
      else if (fs === 'flash_4') { _shipDelivering++; se.shipped++ }
      else if (['flash_2', 'flash_3'].includes(fs)) { se.shipped++ }
      else if (fs === 'flash_6' || fs === 'cancelled') { _shipReturned++; se.returned++; if (fs === 'cancelled') _shipCancelled++ }
      else if (hasPno) { _shipCreated++; se.shipped++ }
      else if (ss === 'printed') { _shipPrinted++; se.printed++ }
      else { _shipWaiting++; se.waiting++ }
    }

    const custAll = Object.values(_cust)
    const custRepeat = custAll.filter(c => c.count >= 2).sort((a, b) => b.count - a.count)
    const custNew = custAll.filter(c => c.count === 1)

    // Prev period comparison
    let prevSales = 0, prevCount = prevOrders.length, prevCod = 0, prevTrans = 0
    for (let i = 0; i < prevOrders.length; i++) {
      const a = parseFloat(prevOrders[i].sale_price) || 0; prevSales += a
      if (prevOrders[i].payment_type === 'transfer') prevTrans++; else prevCod++
    }
    const prevAvg = prevCount > 0 ? prevSales / prevCount : 0
    const curAvg = orders.length > 0 ? _totalSales / orders.length : 0
    const pctFn = (cur, prev) => prev > 0 ? ((cur - prev) / prev * 100).toFixed(1) : cur > 0 ? '100.0' : '0.0'

    return {
      totalSales: _totalSales, totalOrders: orders.length, avgOrder: curAvg,
      codCount: _codCount, transCount: _transCount, codTotal: _codTotal, transTotal: _transTotal,
      dailyChart: Object.values(_daily).sort((a, b) => a.date.localeCompare(b.date)),
      empStats: Object.values(_emp).sort((a, b) => b.sales - a.sales),
      teamStats: Object.values(_team).sort((a, b) => b.sales - a.sales),
      productStats: Object.values(_prod).sort((a, b) => b.count - a.count),
      channelStats: Object.values(_ch).sort((a, b) => b.sales - a.sales),
      provinceStats: Object.values(_prov).sort((a, b) => b.sales - a.sales),
      hourlyStats: _hourly, dowStats: _dow,
      paymentPie: [
        { name: 'COD', value: _codTotal, color: C.accent },
        { name: 'โอน', value: _transTotal, color: C.success },
      ].filter(p => p.value > 0),
      customerStats: { all: custAll, repeat: custRepeat, new: custNew, repeatSales: custRepeat.reduce((s, c) => s + c.sales, 0), newSales: custNew.reduce((s, c) => s + c.sales, 0) },
      shippingStats: {
        waiting: _shipWaiting, printed: _shipPrinted, created: _shipCreated, delivering: _shipDelivering,
        delivered: _shipDelivered, returned: _shipReturned, cancelled: _shipCancelled,
        shipped: _shipCreated + _shipDelivering + _shipDelivered,
        empList: Object.values(_shipEmp).sort((a, b) => {
          const aRate = a.total > 0 ? (a.shipped + a.delivered) / a.total : 0
          const bRate = b.total > 0 ? (b.shipped + b.delivered) / b.total : 0
          return bRate - aRate
        }),
      },
      compareStats: {
        curSales: _totalSales, prevSales, curCount: orders.length, prevCount, curAvg, prevAvg,
        curCod: _codCount, prevCod, curTrans: _transCount, prevTrans,
        salesGrowth: pctFn(_totalSales, prevSales), countGrowth: pctFn(orders.length, prevCount), avgGrowth: pctFn(curAvg, prevAvg),
      },
    }
  }, [orders, prevOrders, teams])

  const { totalSales, totalOrders, avgOrder, codCount, transCount, codTotal, transTotal,
    dailyChart, empStats, teamStats, productStats, channelStats, provinceStats,
    hourlyStats, dowStats, paymentPie, customerStats, compareStats, shippingStats } = stats
  const codOrders = { length: codCount }
  const transOrders = { length: transCount }

  // Save targets
  const saveTargets = (newT) => {
    setTargets(newT)
    localStorage.setItem('boss_targets', JSON.stringify(newT))
  }

  const showFlash = (msg) => { setFlash(msg); setTimeout(() => setFlash(''), 3000) }

  const refreshProfiles = async () => {
    const { data } = await supabase.from('mt_profiles').select('*, mt_teams(id, name)').order('created_at', { ascending: false })
    if (data) setProfiles(data)
  }
  const refreshTeams = async () => {
    const { data } = await supabase.from('mt_teams').select('*').order('name')
    if (data) setTeams(data)
  }

  const createUser = async () => {
    const f = userForm
    if (!f.email || !f.password || !f.fullName) { showFlash('❌ กรอกให้ครบ'); return }
    if (f.password.length < 6) { showFlash('❌ รหัสผ่าน 6 ตัวขึ้นไป'); return }
    showFlash('⏳ กำลังสร้าง...')
    try {
      const sbUrl = import.meta.env.VITE_SUPABASE_URL
      const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      let newUserId = null
      const res = await fetch(`${sbUrl}/auth/v1/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': sbKey }, body: JSON.stringify({ email: f.email, password: f.password }) })
      const result = await res.json()
      if (res.ok && (result.id || result.user?.id)) { newUserId = result.id || result.user?.id }
      else if (JSON.stringify(result).includes('already registered')) {
        const lr = await fetch(`${sbUrl}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': sbKey }, body: JSON.stringify({ email: f.email, password: f.password }) })
        const lres = await lr.json()
        if (lr.ok && lres.user?.id) newUserId = lres.user.id
        else { showFlash('❌ อีเมลนี้มีอยู่แล้ว รหัสผ่านไม่ตรง'); return }
      } else { showFlash('❌ ' + (result.error?.message || JSON.stringify(result))); return }
      if (!newUserId) { showFlash('❌ ไม่ได้ user ID'); return }
      const { data: existing } = await supabase.from('mt_profiles').select('id').eq('id', newUserId).single()
      if (existing) { await supabase.from('mt_profiles').update({ full_name: f.fullName, role: f.role, team_id: f.teamId || null, email: f.email, password_text: f.password }).eq('id', newUserId) }
      else { await new Promise(r => setTimeout(r, 300)); await supabase.from('mt_profiles').insert({ id: newUserId, full_name: f.fullName, role: f.role, team_id: f.teamId || null, email: f.email, password_text: f.password }) }
      showFlash('✅ สร้างสำเร็จ — ' + f.fullName)
      setShowAddUser(false); setUserForm({ email: '', password: '', fullName: '', role: 'employee', teamId: '' })
      refreshProfiles()
    } catch (e) { showFlash('❌ ' + e.message) }
  }

  const saveUserEdit = async () => {
    if (!editingUser) return
    const u = editingUser
    await supabase.from('mt_profiles').update({ full_name: u.full_name, role: u.role, team_id: u.team_id || null, email: u.email || '', password_text: u.password_text || '' }).eq('id', u.id)
    setEditingUser(null); showFlash('✅ แก้ไขสำเร็จ'); refreshProfiles()
  }

  const deleteUser = async (p) => {
    if (!confirm(`ลบ ${p.full_name}?`)) return
    await supabase.from('mt_profiles').delete().eq('id', p.id)
    showFlash('✅ ลบแล้ว'); refreshProfiles()
  }

  const saveTeam = async () => {
    if (!editTeamName.trim()) return
    if (editTeamId === 'new') { await supabase.from('mt_teams').insert({ name: editTeamName.trim() }) }
    else { await supabase.from('mt_teams').update({ name: editTeamName.trim() }).eq('id', editTeamId) }
    setEditTeamId(null); setEditTeamName(''); showFlash('✅ บันทึกทีมสำเร็จ'); refreshTeams()
  }

  const deleteTeam = async (t) => {
    if (!confirm(`ลบทีม ${t.name}?`)) return
    await supabase.from('mt_teams').delete().eq('id', t.id)
    showFlash('✅ ลบทีมแล้ว'); refreshTeams()
  }

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
    { id: 'compare', icon: '📈', label: 'เปรียบเทียบ' },
    { id: 'employees', icon: '👥', label: 'พนักงาน' },
    { id: 'products', icon: '📦', label: 'สินค้า' },
    { id: 'customers', icon: '🔄', label: 'ลูกค้า' },
    { id: 'provinces', icon: '🗺️', label: 'พื้นที่ขาย' },
    { id: 'time', icon: '⏰', label: 'ช่วงเวลา' },
    { id: 'channels', icon: '📢', label: 'ช่องทาง' },
    { id: 'shipping', icon: '🚚', label: 'ส่งรายชื่อ' },
    { id: 'weekly', icon: '📊', label: 'สรุปรายสัปดาห์' },
    { id: 'commission', icon: '💰', label: 'ค่าคอม/โบนัส' },
    { id: 'alerts', icon: '🔔', label: 'แจ้งเตือน' },
    { id: 'targets', icon: '🎯', label: 'เป้าหมาย' },
    { id: 'manage', icon: '⚙️', label: 'จัดการพนักงาน' },
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
                disabled={quickRange === 'all'}
                style={{ width: '100%', padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 11, fontFamily: C.fontSans, marginBottom: 4, boxSizing: 'border-box', opacity: quickRange === 'all' ? 0.4 : 1 }} />
              <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setQuickRange('') }}
                disabled={quickRange === 'all'}
                style={{ width: '100%', padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 11, fontFamily: C.fontSans, boxSizing: 'border-box', opacity: quickRange === 'all' ? 0.4 : 1 }} />
            </div>
          </div>
        </div>

        {/* ═══ Main Content ═══ */}
        <div style={{ flex: 1, padding: 32, overflowY: 'auto', maxHeight: 'calc(100vh - 56px)', position: 'relative' }}>
          {dataLoading && (
            <div style={{ position: 'sticky', top: 0, left: 0, right: 0, zIndex: 10, marginBottom: 12 }}>
              <div style={{ background: C.surfaceAlt, borderRadius: 2, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: C.shadow, border: `1px solid ${C.border}` }}>
                <div style={{ width: 16, height: 16, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.accent}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                <span style={{ fontSize: 13, color: C.textDim }}>กำลังโหลดข้อมูล...</span>
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
          {/* Header */}
          {!(section === 'employees' && selectedEmployee) && (
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 28, fontFamily: C.font, fontWeight: 700, color: C.text, margin: 0 }}>
              {navItems.find(n => n.id === section)?.icon} {navItems.find(n => n.id === section)?.label}
            </h1>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
              {dateFrom ? fmtDateFull(dateFrom) : 'ทั้งหมด'}{dateFrom && dateFrom !== dateTo ? ` — ${fmtDateFull(dateTo)}` : ''} · {totalOrders} ออเดอร์ · ฿{fmt(totalSales)}
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
                  {dailyChart.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: C.textMuted, fontSize: 13 }}>ไม่มีข้อมูล</div>
                  ) : dailyChart.length <= 2 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={dailyChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.textDim, fontFamily: C.fontSans }} tickFormatter={d => fmtDate(d)} />
                        <YAxis tick={{ fontSize: 10, fill: C.textDim }} tickFormatter={v => `฿${fmt(v)}`} />
                        <Tooltip content={<ClassicTooltip />} />
                        <Bar dataKey="ยอดขาย" fill={C.accent} radius={[4, 4, 0, 0]} barSize={60} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
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
                  )}
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

              {/* Top 3 Channels */}
              <div style={{ ...card, padding: 20, marginTop: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: C.font }}>📢 Top เพจขายดี</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {channelStats.slice(0, 3).map((ch, i) => {
                    const pct = totalSales > 0 ? (ch.sales / totalSales * 100).toFixed(1) : '0.0'
                    return (
                      <div key={ch.name} style={{ padding: 16, borderRadius: 2, background: i === 0 ? '#fdfaf3' : C.surfaceAlt, border: `1px solid ${C.border}`, borderTop: `3px solid ${[C.gold, C.accent, C.navy][i]}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 20 }}>{['🥇', '🥈', '🥉'][i]}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: [C.gold, C.accent, C.navy][i], padding: '2px 8px', borderRadius: 2, background: [C.gold, C.accent, C.navy][i] + '10' }}>{pct}%</span>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>{ch.name}</div>
                        <div style={{ fontSize: 12, color: C.textDim }}>{ch.count} ออเดอร์ · <b style={{ color: C.success }}>฿{fmt(ch.sales)}</b></div>
                      </div>
                    )
                  })}
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
                <ResponsiveContainer width="100%" height={Math.min(400, Math.max(180, Math.min(empStats.length, 20) * 32))}>
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
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16, fontFamily: C.font }}>จำนวนออเดอร์แยกสินค้า (Top 10)</div>
                <ResponsiveContainer width="100%" height={Math.min(350, Math.max(180, Math.min(productStats.length, 10) * 32))}>
                  <BarChart data={productStats.slice(0, 10)} layout="vertical" margin={{ left: 120, right: 20 }}>
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

          {/* ═══════ MANAGE ═══════ */}
          {section === 'manage' && (
            <div className="fade-in">
              {/* Flash message */}
              {flash && <div style={{ position: 'fixed', top: 70, right: 32, zIndex: 999, padding: '12px 20px', borderRadius: 2, background: flash.includes('❌') ? '#fef2f2' : '#f0fdf4', color: flash.includes('❌') ? C.danger : C.success, fontSize: 13, fontWeight: 600, boxShadow: C.shadowMd, border: `1px solid ${flash.includes('❌') ? '#fecaca' : '#bbf7d0'}` }}>{flash}</div>}

              {/* Team management */}
              <div style={{ ...card, padding: 20, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: C.font }}>👥 จัดการทีม ({teams.length} ทีม)</div>
                  <button onClick={() => { setEditTeamId('new'); setEditTeamName('') }} style={{ padding: '6px 16px', border: `1px solid ${C.border}`, borderRadius: 2, background: C.accent, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: C.fontSans }}>+ เพิ่มทีม</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                  {teams.map(t => (
                    <div key={t.id} style={{ padding: 14, border: `1px solid ${C.border}`, borderRadius: 2, background: C.surfaceAlt, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {editTeamId === t.id ? (
                        <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                          <input value={editTeamName} onChange={e => setEditTeamName(e.target.value)} style={{ flex: 1, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 13, fontFamily: C.fontSans }} autoFocus />
                          <button onClick={saveTeam} style={{ padding: '6px 10px', border: 'none', borderRadius: 2, background: C.success, color: '#fff', fontSize: 11, cursor: 'pointer' }}>✓</button>
                          <button onClick={() => setEditTeamId(null)} style={{ padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 2, background: C.surface, fontSize: 11, cursor: 'pointer' }}>✕</button>
                        </div>
                      ) : (
                        <>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                            <div style={{ fontSize: 11, color: C.textDim }}>{profiles.filter(p => p.team_id === t.id).length} คน</div>
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => { setEditTeamId(t.id); setEditTeamName(t.name) }} style={{ padding: '4px 8px', border: `1px solid ${C.border}`, borderRadius: 2, background: C.surface, fontSize: 11, cursor: 'pointer', color: C.accent }}>✏️</button>
                            <button onClick={() => deleteTeam(t)} style={{ padding: '4px 8px', border: `1px solid ${C.border}`, borderRadius: 2, background: C.surface, fontSize: 11, cursor: 'pointer', color: C.danger }}>🗑</button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {editTeamId === 'new' && (
                    <div style={{ padding: 14, border: `2px dashed ${C.accent}`, borderRadius: 2, display: 'flex', gap: 6 }}>
                      <input value={editTeamName} onChange={e => setEditTeamName(e.target.value)} placeholder="ชื่อทีมใหม่" style={{ flex: 1, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 13, fontFamily: C.fontSans }} autoFocus />
                      <button onClick={saveTeam} style={{ padding: '6px 10px', border: 'none', borderRadius: 2, background: C.success, color: '#fff', fontSize: 11, cursor: 'pointer' }}>✓</button>
                      <button onClick={() => setEditTeamId(null)} style={{ padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 2, background: C.surface, fontSize: 11, cursor: 'pointer' }}>✕</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Employee list */}
              <div style={{ ...card, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: C.font }}>🧑‍💼 พนักงานทั้งหมด ({profiles.length} คน)</div>
                  <button onClick={() => setShowAddUser(true)} style={{ padding: '8px 20px', border: 'none', borderRadius: 2, background: C.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: C.fontSans }}>+ เพิ่มพนักงาน</button>
                </div>

                {/* Add user form */}
                {showAddUser && (
                  <div style={{ padding: 20, marginBottom: 16, border: `2px solid ${C.accent}`, borderRadius: 2, background: '#fdfaf3' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: C.accent }}>เพิ่มพนักงานใหม่</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>ชื่อ-นามสกุล *</div>
                        <input value={userForm.fullName} onChange={e => setUserForm(f => ({ ...f, fullName: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 13, fontFamily: C.fontSans, boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>อีเมล *</div>
                        <input type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 13, fontFamily: C.fontSans, boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>รหัสผ่าน *</div>
                        <input value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 13, fontFamily: C.fontSans, boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>ตำแหน่ง</div>
                        <select value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 13, fontFamily: C.fontSans, boxSizing: 'border-box' }}>
                          <option value="employee">👤 พนักงาน</option>
                          <option value="packer">📦 พนักงานจัดส่ง</option>
                          <option value="head">👑 หัวหน้าจัดส่ง</option>
                          <option value="export">📊 Export รายงาน</option>
                          <option value="admin">🔑 แอดมิน</option>
                          <option value="manager">🏢 ผู้จัดการ</option>
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>ทีม</div>
                        <select value={userForm.teamId} onChange={e => setUserForm(f => ({ ...f, teamId: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 13, fontFamily: C.fontSans, boxSizing: 'border-box' }}>
                          <option value="">— ไม่มีทีม —</option>
                          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                        <button onClick={createUser} style={{ flex: 1, padding: '9px', border: 'none', borderRadius: 2, background: C.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: C.fontSans }}>✓ สร้าง</button>
                        <button onClick={() => setShowAddUser(false)} style={{ padding: '9px 14px', border: `1px solid ${C.border}`, borderRadius: 2, background: C.surface, fontSize: 13, cursor: 'pointer', fontFamily: C.fontSans }}>ยกเลิก</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Edit user modal */}
                {editingUser && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setEditingUser(null)}>
                    <div style={{ background: C.surface, padding: 24, borderRadius: 2, width: 400, boxShadow: C.shadowLg }} onClick={e => e.stopPropagation()}>
                      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, fontFamily: C.font }}>✏️ แก้ไข {editingUser.full_name}</div>
                      {[
                        { label: 'ชื่อ-นามสกุล', key: 'full_name' },
                        { label: 'อีเมล', key: 'email' },
                        { label: 'รหัสผ่าน', key: 'password_text' },
                      ].map(f => (
                        <div key={f.key} style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{f.label}</div>
                          <input value={editingUser[f.key] || ''} onChange={e => setEditingUser(u => ({ ...u, [f.key]: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 13, fontFamily: C.fontSans, boxSizing: 'border-box' }} />
                        </div>
                      ))}
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>ตำแหน่ง</div>
                        <select value={editingUser.role} onChange={e => setEditingUser(u => ({ ...u, role: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 13, fontFamily: C.fontSans, boxSizing: 'border-box' }}>
                          <option value="employee">👤 พนักงาน</option>
                          <option value="packer">📦 พนักงานจัดส่ง</option>
                          <option value="head">👑 หัวหน้าจัดส่ง</option>
                          <option value="export">📊 Export รายงาน</option>
                          <option value="admin">🔑 แอดมิน</option>
                          <option value="manager">🏢 ผู้จัดการ</option>
                        </select>
                      </div>
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>ทีม</div>
                        <select value={editingUser.team_id || ''} onChange={e => setEditingUser(u => ({ ...u, team_id: e.target.value || null }))} style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 13, fontFamily: C.fontSans, boxSizing: 'border-box' }}>
                          <option value="">— ไม่มีทีม —</option>
                          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={saveUserEdit} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 2, background: C.accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>💾 บันทึก</button>
                        <button onClick={() => setEditingUser(null)} style={{ flex: 1, padding: '10px', border: `1px solid ${C.border}`, borderRadius: 2, background: C.surface, fontSize: 13, cursor: 'pointer' }}>ยกเลิก</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Employee table */}
                <table>
                  <thead><tr>
                    <th style={{ ...th, width: 36 }}>#</th>
                    <th style={th}>ชื่อ</th>
                    <th style={th}>อีเมล</th>
                    <th style={th}>รหัสผ่าน</th>
                    <th style={{ ...th, textAlign: 'center' }}>ตำแหน่ง</th>
                    <th style={th}>ทีม</th>
                    <th style={{ ...th, textAlign: 'center' }}>จัดการ</th>
                  </tr></thead>
                  <tbody>
                    {profiles.map((p, i) => {
                      const roleMap = { employee: '👤 พนักงาน', packer: '📦 จัดส่ง', head: '👑 หัวหน้าจัดส่ง', export: '📊 Export', admin: '🔑 แอดมิน', manager: '🏢 ผู้จัดการ' }
                      const roleColors = { employee: C.navy, packer: C.accent, head: C.gold, export: '#8884d8', admin: C.danger, manager: C.success }
                      return (
                        <tr key={p.id} style={{ background: i % 2 === 0 ? C.surfaceAlt : 'transparent' }}>
                          <td style={{ ...td, textAlign: 'center', color: C.textMuted, fontSize: 11 }}>{i + 1}</td>
                          <td style={{ ...td, fontWeight: 600 }}>{p.full_name}</td>
                          <td style={{ ...td, fontSize: 12, color: C.textDim }}>{p.email || '—'}</td>
                          <td style={{ ...td, fontSize: 12, color: C.textDim, fontFamily: 'monospace' }}>{p.password_text || '—'}</td>
                          <td style={{ ...td, textAlign: 'center' }}>
                            <span style={{ padding: '3px 10px', borderRadius: 2, fontSize: 11, fontWeight: 600, background: (roleColors[p.role] || C.navy) + '10', color: roleColors[p.role] || C.navy }}>{roleMap[p.role] || p.role}</span>
                          </td>
                          <td style={{ ...td, fontSize: 12 }}>{p.mt_teams?.name || '—'}</td>
                          <td style={{ ...td, textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                              <button onClick={() => setEditingUser({ ...p })} style={{ padding: '5px 12px', border: `1px solid ${C.border}`, borderRadius: 2, background: C.surface, color: C.accent, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✏️ แก้ไข</button>
                              {p.id !== profile.id && (
                                <button onClick={() => deleteUser(p)} style={{ padding: '5px 12px', border: `1px solid #fecaca`, borderRadius: 2, background: '#fef2f2', color: C.danger, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>🗑 ลบ</button>
                              )}
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

          {/* ═══════ COMPARE ═══════ */}
          {section === 'compare' && (
            <div className="fade-in">
              {!dateFrom ? (
                <div style={{ ...card, padding: 40, textAlign: 'center' }}>
                  <div style={{ fontSize: 16, color: C.textDim, marginBottom: 8 }}>กรุณาเลือกช่วงเวลาที่ต้องการเปรียบเทียบ</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>เช่น วันนี้, 7 วัน, เดือนนี้ — ระบบจะเปรียบเทียบกับช่วงเดียวกันก่อนหน้า</div>
                </div>
              ) : (() => {
                const cs = compareStats
                const from = new Date(dateFrom), to = new Date(dateTo)
                const days = Math.round((to - from) / 864e5) + 1
                const prevTo = new Date(from); prevTo.setDate(prevTo.getDate() - 1)
                const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - days + 1)

                const GrowthCard = ({ label, cur, prev, prefix = '', isMoney = false }) => {
                  const g = prev > 0 ? ((cur - prev) / prev * 100) : cur > 0 ? 100 : 0
                  const up = g >= 0
                  return (
                    <div style={{ ...card, padding: 18 }}>
                      <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontSize: 22, fontWeight: 800, fontFamily: C.font, color: C.text }}>{prefix}{isMoney ? fmt(cur) : cur}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: up ? C.success : C.danger }}>{up ? '▲' : '▼'} {Math.abs(g).toFixed(1)}%</span>
                      </div>
                      <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>ก่อนหน้า: {prefix}{isMoney ? fmt(prev) : prev}</div>
                    </div>
                  )
                }

                const curEmpMap = {}, prevEmpMap = {}
                orders.forEach(o => { const n = o.employee_name || '—'; if (!curEmpMap[n]) curEmpMap[n] = { sales: 0, count: 0 }; curEmpMap[n].sales += parseFloat(o.sale_price) || 0; curEmpMap[n].count++ })
                prevOrders.forEach(o => { const n = o.employee_name || '—'; if (!prevEmpMap[n]) prevEmpMap[n] = { sales: 0, count: 0 }; prevEmpMap[n].sales += parseFloat(o.sale_price) || 0; prevEmpMap[n].count++ })
                const allNames = [...new Set([...Object.keys(curEmpMap), ...Object.keys(prevEmpMap)])]
                const empCompare = allNames.map(n => ({
                  name: n, curSales: curEmpMap[n]?.sales || 0, prevSales: prevEmpMap[n]?.sales || 0,
                  curCount: curEmpMap[n]?.count || 0, prevCount: prevEmpMap[n]?.count || 0,
                })).sort((a, b) => b.curSales - a.curSales)

                return <>
                  <div style={{ ...card, padding: 14, marginBottom: 20, background: C.surfaceAlt }}>
                    <div style={{ fontSize: 12, color: C.textDim }}>
                      📅 ปัจจุบัน: <b>{fmtDateFull(dateFrom)} — {fmtDateFull(dateTo)}</b> ({days} วัน) &nbsp;vs&nbsp;
                      ก่อนหน้า: <b>{fmtDateFull(prevFrom)} — {fmtDateFull(prevTo)}</b>
                      {prevOrders.length === 0 && <span style={{ color: C.danger, marginLeft: 8 }}>(ไม่มีข้อมูลก่อนหน้า)</span>}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                    <GrowthCard label="ยอดขาย" cur={cs.curSales} prev={cs.prevSales} prefix="฿" isMoney />
                    <GrowthCard label="ออเดอร์" cur={cs.curCount} prev={cs.prevCount} />
                    <GrowthCard label="เฉลี่ย/ออเดอร์" cur={cs.curAvg} prev={cs.prevAvg} prefix="฿" isMoney />
                    <GrowthCard label="COD" cur={cs.curCod} prev={cs.prevCod} />
                  </div>
                  <div style={{ ...card, padding: 20, marginBottom: 24 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: C.font }}>เปรียบเทียบรายคน</div>
                    <ResponsiveContainer width="100%" height={Math.min(400, Math.max(180, empCompare.length * 32))}>
                      <BarChart data={empCompare.slice(0, 15)} layout="vertical" margin={{ left: 80, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: C.textDim }} tickFormatter={v => `฿${fmt(v)}`} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: C.text }} width={80} />
                        <Tooltip content={<ClassicTooltip />} />
                        <Bar dataKey="curSales" fill={C.accent} radius={[0, 3, 3, 0]} name="ช่วงนี้" />
                        <Bar dataKey="prevSales" fill={C.borderDark} radius={[0, 3, 3, 0]} name="ก่อนหน้า" />
                        <Legend />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ ...card, padding: 20 }}>
                    <table>
                      <thead><tr>
                        <th style={th}>พนักงาน</th>
                        <th style={{ ...th, textAlign: 'center' }}>ออเดอร์ (ปัจจุบัน)</th>
                        <th style={{ ...th, textAlign: 'center' }}>ออเดอร์ (ก่อนหน้า)</th>
                        <th style={{ ...th, textAlign: 'right' }}>ยอด (ปัจจุบัน)</th>
                        <th style={{ ...th, textAlign: 'right' }}>ยอด (ก่อนหน้า)</th>
                        <th style={{ ...th, textAlign: 'center' }}>เปลี่ยนแปลง</th>
                      </tr></thead>
                      <tbody>
                        {empCompare.map(e => {
                          const g = e.prevSales > 0 ? ((e.curSales - e.prevSales) / e.prevSales * 100) : e.curSales > 0 ? 100 : 0
                          return <tr key={e.name}>
                            <td style={{ ...td, fontWeight: 600 }}>{e.name}</td>
                            <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: C.accent }}>{e.curCount}</td>
                            <td style={{ ...td, textAlign: 'center', color: C.textDim }}>{e.prevCount}</td>
                            <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: C.success }}>฿{fmt(e.curSales)}</td>
                            <td style={{ ...td, textAlign: 'right', color: C.textDim }}>฿{fmt(e.prevSales)}</td>
                            <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: g >= 0 ? C.success : C.danger }}>{g >= 0 ? '▲' : '▼'} {Math.abs(g).toFixed(1)}%</td>
                          </tr>
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              })()}
            </div>
          )}

          {/* ═══════ CUSTOMERS ═══════ */}
          {section === 'customers' && (
            <div className="fade-in">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                {[
                  { label: 'ลูกค้าทั้งหมด', value: customerStats.all.length, color: C.navy },
                  { label: 'ลูกค้าซ้ำ (2+ ครั้ง)', value: customerStats.repeat.length, sub: `฿${fmt(customerStats.repeatSales)}`, color: C.success },
                  { label: 'ลูกค้าใหม่ (1 ครั้ง)', value: customerStats.new.length, sub: `฿${fmt(customerStats.newSales)}`, color: C.accent },
                  { label: 'อัตราซื้อซ้ำ', value: customerStats.all.length > 0 ? (customerStats.repeat.length / customerStats.all.length * 100).toFixed(1) + '%' : '0%', color: C.gold },
                ].map((k, i) => (
                  <div key={i} style={{ ...card, padding: 18, borderTop: `3px solid ${k.color}` }}>
                    <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>{k.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, fontFamily: C.font, color: C.text }}>{k.value}</div>
                    {k.sub && <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{k.sub}</div>}
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 24 }}>
                <div style={{ ...card, padding: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: C.font }}>สัดส่วนยอดขาย</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={[{ name: 'ลูกค้าซ้ำ', value: customerStats.repeatSales, color: C.success }, { name: 'ลูกค้าใหม่', value: customerStats.newSales, color: C.accent }].filter(p => p.value > 0)} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                        {[C.success, C.accent].map((c, i) => <Cell key={i} fill={c} />)}
                      </Pie>
                      <Tooltip content={<ClassicTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.textDim }}><div style={{ width: 8, height: 8, borderRadius: 1, background: C.success }}></div> ซ้ำ: ฿{fmt(customerStats.repeatSales)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.textDim }}><div style={{ width: 8, height: 8, borderRadius: 1, background: C.accent }}></div> ใหม่: ฿{fmt(customerStats.newSales)}</div>
                  </div>
                </div>
                <div style={{ ...card, padding: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: C.font }}>จำนวนครั้งที่ซื้อ</div>
                  {(() => {
                    const freq = {}
                    customerStats.all.forEach(c => { const k = c.count >= 5 ? '5+ ครั้ง' : c.count + ' ครั้ง'; if (!freq[k]) freq[k] = { name: k, count: 0, sort: c.count >= 5 ? 5 : c.count }; freq[k].count++ })
                    return <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={Object.values(freq).sort((a, b) => a.sort - b.sort)}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.textDim }} />
                        <YAxis tick={{ fontSize: 10, fill: C.textDim }} />
                        <Tooltip content={<ClassicTooltip />} />
                        <Bar dataKey="count" fill={C.navy} radius={[3, 3, 0, 0]} name="จำนวนลูกค้า" />
                      </BarChart>
                    </ResponsiveContainer>
                  })()}
                </div>
              </div>
              <div style={{ ...card, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: C.font }}>🏆 ลูกค้าซื้อซ้ำบ่อยที่สุด ({customerStats.repeat.length} คน)</div>
                  <button onClick={() => {
                    const bom = '\uFEFF'
                    const header = '#,ชื่อ,เบอร์โทร,จำนวนครั้ง,ยอดรวม,เฉลี่ย/ครั้ง,สินค้าที่ซื้อ,ที่อยู่,ตำบล,อำเภอ,จังหวัด,รหัสไปรษณีย์,ซื้อครั้งแรก,ซื้อล่าสุด\n'
                    const rows = customerStats.repeat.map((c, i) => {
                      const prods = Object.entries(c.products).sort((a, b) => b[1] - a[1]).map(([n, cnt]) => cnt > 1 ? `${n}(${cnt})` : n).join(', ')
                      return `${i + 1},"${c.name}","=""${c.phone}""",${c.count},${Math.round(c.sales)},${Math.round(c.count > 0 ? c.sales / c.count : 0)},"${prods.replace(/"/g, '""')}","${(c.address || '').replace(/"/g, '""')}","${c.subDistrict || ''}","${c.district || ''}","${c.province || ''}","${c.zipCode || ''}",${c.firstDate || ''},${c.lastDate || ''}`
                    }).join('\n')
                    const blob = new Blob([bom + header + rows], { type: 'text/csv;charset=utf-8;' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a'); a.href = url; a.download = `ลูกค้าซื้อซ้ำ_${dateFrom || 'all'}_${dateTo || 'all'}.csv`; a.click(); URL.revokeObjectURL(url)
                  }} style={{ padding: '6px 16px', border: `1px solid ${C.border}`, borderRadius: 2, background: C.surface, color: C.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: C.fontSans, display: 'flex', alignItems: 'center', gap: 6 }}>
                    📥 Export CSV
                  </button>
                </div>
                <table>
                  <thead><tr>
                    <th style={{ ...th, width: 36 }}>#</th>
                    <th style={th}>ชื่อ</th>
                    <th style={th}>เบอร์โทร</th>
                    <th style={{ ...th, textAlign: 'center' }}>จำนวนครั้ง</th>
                    <th style={{ ...th, textAlign: 'right' }}>ยอดรวม</th>
                    <th style={th}>สินค้าที่ซื้อ</th>
                    <th style={th}>จังหวัด</th>
                    <th style={th}>ซื้อครั้งแรก</th>
                    <th style={th}>ซื้อล่าสุด</th>
                  </tr></thead>
                  <tbody>
                    {customerStats.repeat.slice(0, 50).map((c, i) => {
                      const prodList = Object.entries(c.products).sort((a, b) => b[1] - a[1])
                      return (
                      <tr key={c.phone} style={{ background: i < 3 ? '#fdfaf3' : (i % 2 === 0 ? C.surfaceAlt : 'transparent') }}>
                        <td style={{ ...td, textAlign: 'center', fontWeight: 800, color: i < 3 ? C.gold : C.textMuted }}>{i + 1}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{c.name}</td>
                        <td style={{ ...td, fontSize: 12, color: C.textDim, fontVariantNumeric: 'tabular-nums' }}>{c.phone}</td>
                        <td style={{ ...td, textAlign: 'center', fontWeight: 800, color: C.accent }}>{c.count}</td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: C.success }}>฿{fmt(c.sales)}</td>
                        <td style={{ ...td, fontSize: 11, maxWidth: 220 }}>
                          {prodList.map(([name, cnt], j) => (
                            <span key={j} style={{ display: 'inline-block', padding: '1px 6px', margin: '1px 2px', borderRadius: 2, fontSize: 10, fontWeight: 600, background: j === 0 ? '#fff3e0' : C.surfaceAlt, color: j === 0 ? C.accent : C.textDim }}>
                              {name}{cnt > 1 ? ` ×${cnt}` : ''}
                            </span>
                          ))}
                        </td>
                        <td style={{ ...td, fontSize: 11, color: C.textDim }}>{c.province || '—'}</td>
                        <td style={{ ...td, fontSize: 11, color: C.textDim }}>{c.firstDate || '—'}</td>
                        <td style={{ ...td, fontSize: 11, color: C.textDim }}>{c.lastDate || '—'}</td>
                      </tr>
                    )})}
                  </tbody>
                </table>
                {customerStats.repeat.length > 50 && <div style={{ textAlign: 'center', padding: 12, color: C.textMuted, fontSize: 12 }}>แสดง 50 จาก {customerStats.repeat.length} คน — กด Export CSV เพื่อดาวน์โหลดทั้งหมด</div>}
              </div>
            </div>
          )}

          {/* ═══════ PROVINCES ═══════ */}
          {section === 'provinces' && (
            <div className="fade-in">
              {provinceStats.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
                  {provinceStats.slice(0, 3).map((p, i) => (
                    <div key={p.name} style={{ ...card, padding: 18, borderTop: `3px solid ${[C.gold, C.accent, C.navy][i]}` }}>
                      <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>{['🥇 อันดับ 1', '🥈 อันดับ 2', '🥉 อันดับ 3'][i]}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, fontFamily: C.font, color: C.text, marginTop: 4 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{p.count} ออเดอร์ · ฿{fmt(p.sales)}</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ ...card, padding: 20, marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: C.font }}>ยอดขายแยกพื้นที่ (Top 20)</div>
                <ResponsiveContainer width="100%" height={Math.min(400, Math.max(180, Math.min(provinceStats.length, 15) * 28))}>
                  <BarChart data={provinceStats.slice(0, 20)} layout="vertical" margin={{ left: 100, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: C.textDim }} tickFormatter={v => `฿${fmt(v)}`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: C.text }} width={100} />
                    <Tooltip content={<ClassicTooltip />} />
                    <Bar dataKey="sales" fill={C.accent} radius={[0, 3, 3, 0]} name="ยอดขาย" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ ...card, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: C.font }}>รายละเอียดพื้นที่ ({provinceStats.length} พื้นที่)</div>
                <table>
                  <thead><tr>
                    <th style={{ ...th, width: 36 }}>#</th>
                    <th style={th}>พื้นที่</th>
                    <th style={{ ...th, textAlign: 'center' }}>ออเดอร์</th>
                    <th style={{ ...th, textAlign: 'right' }}>ยอดขาย</th>
                    <th style={{ ...th, textAlign: 'right' }}>เฉลี่ย</th>
                    <th style={{ ...th, textAlign: 'right', width: '20%' }}>สัดส่วน</th>
                  </tr></thead>
                  <tbody>
                    {provinceStats.map((p, i) => {
                      const pct = totalSales > 0 ? (p.sales / totalSales * 100).toFixed(1) : '0.0'
                      return <tr key={p.name} style={{ background: i < 3 ? '#fdfaf3' : (i % 2 === 0 ? C.surfaceAlt : 'transparent') }}>
                        <td style={{ ...td, textAlign: 'center', fontWeight: 800, color: i < 3 ? C.gold : C.textMuted }}>{i + 1}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{p.name}</td>
                        <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: C.accent }}>{p.count}</td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: C.success }}>฿{fmt(p.sales)}</td>
                        <td style={{ ...td, textAlign: 'right' }}>฿{fmt(p.count > 0 ? p.sales / p.count : 0)}</td>
                        <td style={{ ...td }}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ flex: 1, height: 5, borderRadius: 2, background: C.surfaceHover, overflow: 'hidden' }}><div style={{ width: pct + '%', height: '100%', borderRadius: 2, background: C.accent }}></div></div><span style={{ fontSize: 10, color: C.textMuted, minWidth: 36 }}>{pct}%</span></div></td>
                      </tr>
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══════ SHIPPING ═══════ */}
          {section === 'shipping' && (
            <div className="fade-in">
              {(() => {
                // Analyze submission times per employee per day
                const empDayMap = {}
                orders.forEach(o => {
                  const dt = new Date(o.created_at)
                  if (isNaN(dt)) return
                  const bkk = new Date(dt.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
                  const name = o.employee_name || '—'
                  const day = (o.order_date || '').substring(0, 10)
                  if (!day) return
                  const timeMin = bkk.getHours() * 60 + bkk.getMinutes()
                  const timeStr = `${String(bkk.getHours()).padStart(2, '0')}:${String(bkk.getMinutes()).padStart(2, '0')}`
                  if (!empDayMap[name]) empDayMap[name] = {}
                  if (!empDayMap[name][day]) empDayMap[name][day] = { first: timeMin, last: timeMin, firstStr: timeStr, lastStr: timeStr, count: 0 }
                  const ed = empDayMap[name][day]
                  ed.count++
                  if (timeMin < ed.first) { ed.first = timeMin; ed.firstStr = timeStr }
                  if (timeMin > ed.last) { ed.last = timeMin; ed.lastStr = timeStr }
                })

                // Build employee summary
                const empSummary = Object.entries(empDayMap).map(([name, days]) => {
                  const dayList = Object.entries(days).map(([date, d]) => ({ date, ...d })).sort((a, b) => b.date.localeCompare(a.date))
                  const totalOrds = dayList.reduce((s, d) => s + d.count, 0)
                  const avgFirst = dayList.length > 0 ? Math.round(dayList.reduce((s, d) => s + d.first, 0) / dayList.length) : 0
                  const avgLast = dayList.length > 0 ? Math.round(dayList.reduce((s, d) => s + d.last, 0) / dayList.length) : 0
                  const minToStr = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
                  const earliest = dayList.length > 0 ? Math.min(...dayList.map(d => d.first)) : 0
                  const latest = dayList.length > 0 ? Math.max(...dayList.map(d => d.last)) : 0
                  return {
                    name, days: dayList, totalOrds, activeDays: dayList.length,
                    avgFirst, avgLast, avgFirstStr: minToStr(avgFirst), avgLastStr: minToStr(avgLast),
                    earliest, latest, earliestStr: minToStr(earliest), latestStr: minToStr(latest),
                    avgPerDay: dayList.length > 0 ? (totalOrds / dayList.length).toFixed(1) : '0',
                  }
                }).sort((a, b) => a.avgFirst - b.avgFirst)

                const fastest = empSummary.length > 0 ? empSummary[0] : null
                const slowest = empSummary.length > 1 ? empSummary[empSummary.length - 1] : null
                const mostActive = [...empSummary].sort((a, b) => parseFloat(b.avgPerDay) - parseFloat(a.avgPerDay))[0] || null

                return <>
                  {/* Top cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
                    {fastest && (
                      <div style={{ ...card, padding: 20, borderTop: `3px solid ${C.success}` }}>
                        <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>🏆 ส่งรายชื่อไวสุด</div>
                        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: C.font, color: C.success }}>{fastest.name}</div>
                        <div style={{ fontSize: 13, color: C.text, marginTop: 4 }}>เฉลี่ยเริ่มส่ง <b>{fastest.avgFirstStr}</b> น.</div>
                        <div style={{ fontSize: 11, color: C.textDim }}>เร็วสุดเคยส่ง {fastest.earliestStr} น. · {fastest.avgPerDay} ออเดอร์/วัน</div>
                      </div>
                    )}
                    {slowest && slowest.name !== fastest?.name && (
                      <div style={{ ...card, padding: 20, borderTop: `3px solid ${C.danger}` }}>
                        <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>⚠️ ส่งรายชื่อช้าสุด</div>
                        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: C.font, color: C.danger }}>{slowest.name}</div>
                        <div style={{ fontSize: 13, color: C.text, marginTop: 4 }}>เฉลี่ยเริ่มส่ง <b>{slowest.avgFirstStr}</b> น.</div>
                        <div style={{ fontSize: 11, color: C.textDim }}>ช้าสุดเคยส่ง {slowest.latestStr} น. · {slowest.avgPerDay} ออเดอร์/วัน</div>
                      </div>
                    )}
                    {mostActive && (
                      <div style={{ ...card, padding: 20, borderTop: `3px solid ${C.navy}` }}>
                        <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>🔥 ส่งเยอะสุด / วัน</div>
                        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: C.font, color: C.navy }}>{mostActive.name}</div>
                        <div style={{ fontSize: 13, color: C.text, marginTop: 4 }}>เฉลี่ย <b>{mostActive.avgPerDay}</b> ออเดอร์/วัน</div>
                        <div style={{ fontSize: 11, color: C.textDim }}>{mostActive.totalOrds} ออเดอร์ · {mostActive.activeDays} วัน</div>
                      </div>
                    )}
                  </div>

                  {/* Timeline bar chart */}
                  <div style={{ ...card, padding: 20, marginBottom: 24 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14, fontFamily: C.font }}>⏰ เวลาเริ่มส่งรายชื่อเฉลี่ย (เรียงจากไวสุด → ช้าสุด)</div>
                    {empSummary.map((e, i) => {
                      const startPct = (e.avgFirst / (24 * 60)) * 100
                      const endPct = (e.avgLast / (24 * 60)) * 100
                      const width = Math.max(endPct - startPct, 1)
                      return (
                        <div key={e.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: i < 3 ? 800 : 600, width: 90, textAlign: 'right', color: i === 0 ? C.success : i === empSummary.length - 1 ? C.danger : C.text }}>{i === 0 ? '🏆 ' : i === empSummary.length - 1 && empSummary.length > 1 ? '⚠️ ' : ''}{e.name}</span>
                          <div style={{ flex: 1, height: 20, borderRadius: 3, background: C.surfaceAlt, position: 'relative', overflow: 'hidden' }}>
                            {/* Hour markers */}
                            {[6, 8, 10, 12, 14, 16, 18, 20, 22].map(h => (
                              <div key={h} style={{ position: 'absolute', left: (h / 24 * 100) + '%', top: 0, bottom: 0, width: 1, background: C.border, zIndex: 0 }}></div>
                            ))}
                            {/* Active range */}
                            <div style={{ position: 'absolute', left: startPct + '%', width: width + '%', top: 2, bottom: 2, borderRadius: 2, background: i === 0 ? C.success : i === empSummary.length - 1 && empSummary.length > 1 ? C.dangerLight : C.accent, zIndex: 1 }}></div>
                          </div>
                          <div style={{ fontSize: 11, color: C.textDim, minWidth: 100, textAlign: 'left' }}>
                            <b style={{ color: C.text }}>{e.avgFirstStr}</b> - {e.avgLastStr}
                          </div>
                          <span style={{ fontSize: 11, color: C.textDim, minWidth: 55 }}>{e.avgPerDay}/วัน</span>
                        </div>
                      )
                    })}
                    {/* Hour labels */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                      <span style={{ width: 90 }}></span>
                      <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.textMuted }}>
                        {[0, 4, 8, 12, 16, 20, 24].map(h => <span key={h}>{String(h).padStart(2, '0')}:00</span>)}
                      </div>
                      <span style={{ minWidth: 155 }}></span>
                    </div>
                  </div>

                  {/* Detail table */}
                  <div style={{ ...card, padding: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: C.font }}>📋 จัดอันดับเวลาส่งรายชื่อ</div>
                    <table>
                      <thead><tr>
                        <th style={{ ...th, width: 36 }}>#</th>
                        <th style={th}>พนักงาน</th>
                        <th style={{ ...th, textAlign: 'center' }}>เริ่มส่ง (เฉลี่ย)</th>
                        <th style={{ ...th, textAlign: 'center' }}>ส่งล่าสุด (เฉลี่ย)</th>
                        <th style={{ ...th, textAlign: 'center' }}>เร็วสุดเคยส่ง</th>
                        <th style={{ ...th, textAlign: 'center' }}>ช้าสุดเคยส่ง</th>
                        <th style={{ ...th, textAlign: 'center' }}>ออเดอร์/วัน</th>
                        <th style={{ ...th, textAlign: 'center' }}>รวมออเดอร์</th>
                        <th style={{ ...th, textAlign: 'center' }}>วันทำงาน</th>
                      </tr></thead>
                      <tbody>
                        {empSummary.map((e, i) => (
                          <tr key={e.name} style={{ background: i < 3 ? '#fdfaf3' : (i % 2 === 0 ? C.surfaceAlt : 'transparent') }}>
                            <td style={{ ...td, textAlign: 'center', fontWeight: 800, color: i < 3 ? C.gold : C.textMuted }}>
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                            </td>
                            <td style={{ ...td, fontWeight: 600 }}>{e.name}</td>
                            <td style={{ ...td, textAlign: 'center', fontWeight: 800, fontSize: 14, color: i === 0 ? C.success : i === empSummary.length - 1 && empSummary.length > 1 ? C.danger : C.accent }}>{e.avgFirstStr}</td>
                            <td style={{ ...td, textAlign: 'center', color: C.textDim }}>{e.avgLastStr}</td>
                            <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: C.success }}>{e.earliestStr}</td>
                            <td style={{ ...td, textAlign: 'center', color: C.danger }}>{e.latestStr}</td>
                            <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: C.accent }}>{e.avgPerDay}</td>
                            <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{e.totalOrds}</td>
                            <td style={{ ...td, textAlign: 'center', color: C.textDim }}>{e.activeDays} วัน</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Per-day breakdown */}
                  {empSummary.length > 0 && (
                    <div style={{ ...card, padding: 20, marginTop: 20 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: C.font }}>📅 รายละเอียดรายวัน (5 วันล่าสุด)</div>
                      {empSummary.map(e => (
                        <div key={e.name} style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6 }}>{e.name}</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {e.days.slice(0, 5).map(d => (
                              <div key={d.date} style={{ padding: '6px 12px', borderRadius: 2, background: C.surfaceAlt, border: `1px solid ${C.border}`, fontSize: 11, minWidth: 130 }}>
                                <div style={{ color: C.textDim, marginBottom: 2 }}>{d.date}</div>
                                <div style={{ fontWeight: 700, color: C.text }}>{d.firstStr} - {d.lastStr} <span style={{ color: C.accent }}>({d.count})</span></div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              })()}
            </div>
          )}

          {/* ═══════ WEEKLY ═══════ */}
          {section === 'weekly' && (
            <div className="fade-in">
              {(() => {
                // Build weekly data from ALL orders (ignore date filter)
                const weekMap = {}
                orders.forEach(o => {
                  const d = new Date(o.order_date)
                  if (isNaN(d)) return
                  const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1)
                  const mon = new Date(d.setDate(diff))
                  const wk = mon.toISOString().split('T')[0]
                  if (!weekMap[wk]) weekMap[wk] = { week: wk, sales: 0, orders: 0, cod: 0, trans: 0, emps: {} }
                  const w = weekMap[wk]
                  w.sales += parseFloat(o.sale_price) || 0; w.orders++
                  if (o.payment_type === 'transfer') w.trans++; else w.cod++
                  const en = o.employee_name || '—'
                  if (!w.emps[en]) w.emps[en] = { name: en, sales: 0, count: 0 }
                  w.emps[en].sales += parseFloat(o.sale_price) || 0; w.emps[en].count++
                })
                const weeks = Object.values(weekMap).sort((a, b) => b.week.localeCompare(a.week))
                const fmtW = (w) => { const d = new Date(w); const e = new Date(d); e.setDate(e.getDate() + 6); return `${d.getDate()}/${d.getMonth() + 1} - ${e.getDate()}/${e.getMonth() + 1}` }

                return <>
                  {/* Chart */}
                  <div style={{ ...card, padding: 20, marginBottom: 24 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: C.font }}>ยอดขายรายสัปดาห์</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={[...weeks].reverse().slice(-12)}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="week" tick={{ fontSize: 9, fill: C.textDim }} tickFormatter={fmtW} />
                        <YAxis tick={{ fontSize: 10, fill: C.textDim }} tickFormatter={v => `฿${fmt(v)}`} />
                        <Tooltip content={<ClassicTooltip />} />
                        <Bar dataKey="sales" fill={C.accent} radius={[3, 3, 0, 0]} name="ยอดขาย" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Weekly table */}
                  <div style={{ ...card, padding: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: C.font }}>เปรียบเทียบรายสัปดาห์</div>
                    <table>
                      <thead><tr>
                        <th style={th}>สัปดาห์</th>
                        <th style={{ ...th, textAlign: 'center' }}>ออเดอร์</th>
                        <th style={{ ...th, textAlign: 'right' }}>ยอดขาย</th>
                        <th style={{ ...th, textAlign: 'right' }}>เฉลี่ย/ออเดอร์</th>
                        <th style={{ ...th, textAlign: 'center' }}>COD</th>
                        <th style={{ ...th, textAlign: 'center' }}>โอน</th>
                        <th style={{ ...th, textAlign: 'center' }}>เทียบสัปดาห์ก่อน</th>
                        <th style={th}>พนักงานขายดีสุด</th>
                      </tr></thead>
                      <tbody>
                        {weeks.slice(0, 12).map((w, i) => {
                          const prev = weeks[i + 1]
                          const growth = prev ? ((w.sales - prev.sales) / prev.sales * 100) : 0
                          const topEmp = Object.values(w.emps).sort((a, b) => b.sales - a.sales)[0]
                          return (
                            <tr key={w.week} style={{ background: i === 0 ? '#fdfaf3' : (i % 2 === 0 ? C.surfaceAlt : 'transparent') }}>
                              <td style={{ ...td, fontWeight: i === 0 ? 700 : 400 }}>{i === 0 ? '📌 ' : ''}{fmtW(w.week)}</td>
                              <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: C.accent }}>{w.orders}</td>
                              <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: C.success }}>฿{fmt(w.sales)}</td>
                              <td style={{ ...td, textAlign: 'right' }}>฿{fmt(w.orders > 0 ? w.sales / w.orders : 0)}</td>
                              <td style={{ ...td, textAlign: 'center' }}>{w.cod}</td>
                              <td style={{ ...td, textAlign: 'center' }}>{w.trans}</td>
                              <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: !prev ? C.textMuted : growth >= 0 ? C.success : C.danger }}>
                                {prev ? `${growth >= 0 ? '▲' : '▼'} ${Math.abs(growth).toFixed(1)}%` : '—'}
                              </td>
                              <td style={{ ...td, fontSize: 12 }}>{topEmp ? `${topEmp.name} (฿${fmt(topEmp.sales)})` : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              })()}
            </div>
          )}

          {/* ═══════ COMMISSION ═══════ */}
          {section === 'commission' && (
            <div className="fade-in">
              {(() => {
                const cs = commSettings
                const saveComm = (v) => { setCommSettings(v); localStorage.setItem('boss_comm', JSON.stringify(v)) }
                const rate = cs.rate || 0
                const bonusThreshold = cs.bonusThreshold || 0
                const bonusAmount = cs.bonusAmount || 0
                const fixedSalary = cs.fixedSalary || 0

                const empComm = empStats.map(e => {
                  const comm = rate > 0 ? (e.sales * rate / 100) : 0
                  const bonus = bonusThreshold > 0 && e.sales >= bonusThreshold ? bonusAmount : 0
                  const total = fixedSalary + comm + bonus
                  return { ...e, comm, bonus, fixedSalary, total }
                })
                const totalComm = empComm.reduce((s, e) => s + e.comm, 0)
                const totalBonus = empComm.reduce((s, e) => s + e.bonus, 0)
                const totalPay = empComm.reduce((s, e) => s + e.total, 0)

                return <>
                  {/* Settings */}
                  <div style={{ ...card, padding: 20, marginBottom: 24 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14, fontFamily: C.font }}>⚙️ ตั้งค่าคอมมิชชั่น</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>เงินเดือน/ฐาน (฿)</div>
                        <input type="number" value={cs.fixedSalary || ''} placeholder="0" onChange={e => saveComm({ ...cs, fixedSalary: parseFloat(e.target.value) || 0 })}
                          style={{ width: '100%', padding: '10px', border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 14, fontWeight: 700, fontFamily: C.fontSans, boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>ค่าคอม (%)</div>
                        <input type="number" value={cs.rate || ''} placeholder="0" step="0.5" onChange={e => saveComm({ ...cs, rate: parseFloat(e.target.value) || 0 })}
                          style={{ width: '100%', padding: '10px', border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 14, fontWeight: 700, fontFamily: C.fontSans, boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>โบนัสเมื่อยอดถึง (฿)</div>
                        <input type="number" value={cs.bonusThreshold || ''} placeholder="0" onChange={e => saveComm({ ...cs, bonusThreshold: parseFloat(e.target.value) || 0 })}
                          style={{ width: '100%', padding: '10px', border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 14, fontWeight: 700, fontFamily: C.fontSans, boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>โบนัส (฿)</div>
                        <input type="number" value={cs.bonusAmount || ''} placeholder="0" onChange={e => saveComm({ ...cs, bonusAmount: parseFloat(e.target.value) || 0 })}
                          style={{ width: '100%', padding: '10px', border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 14, fontWeight: 700, fontFamily: C.fontSans, boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>สูตร: เงินเดือน + (ยอดขาย × {rate}%) {bonusThreshold > 0 ? `+ โบนัส ฿${fmt(bonusAmount)} เมื่อยอดถึง ฿${fmt(bonusThreshold)}` : ''}</div>
                  </div>

                  {/* Summary cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                    <div style={{ ...card, padding: 18, borderTop: `3px solid ${C.navy}` }}>
                      <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>ยอดขายรวม</div>
                      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: C.font }}>฿{fmt(totalSales)}</div>
                    </div>
                    <div style={{ ...card, padding: 18, borderTop: `3px solid ${C.accent}` }}>
                      <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>คอมมิชชั่นรวม</div>
                      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: C.font, color: C.accent }}>฿{fmt(totalComm)}</div>
                    </div>
                    <div style={{ ...card, padding: 18, borderTop: `3px solid ${C.gold}` }}>
                      <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>โบนัสรวม</div>
                      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: C.font, color: C.gold }}>฿{fmt(totalBonus)}</div>
                      <div style={{ fontSize: 11, color: C.textDim }}>{empComm.filter(e => e.bonus > 0).length}/{empComm.length} คนได้โบนัส</div>
                    </div>
                    <div style={{ ...card, padding: 18, borderTop: `3px solid ${C.danger}` }}>
                      <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>ต้นทุนบุคลากรรวม</div>
                      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: C.font, color: C.danger }}>฿{fmt(totalPay)}</div>
                    </div>
                  </div>

                  {/* Table */}
                  <div style={{ ...card, padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: C.font }}>💰 สรุปค่าคอม/โบนัส ({empComm.length} คน)</div>
                      <button onClick={() => {
                        const bom = '\uFEFF'
                        const h = '#,พนักงาน,ออเดอร์,ยอดขาย,เงินเดือน,คอมมิชชั่น,โบนัส,รวมรับ\n'
                        const r = empComm.map((e, i) => `${i + 1},"${e.name}",${e.count},${Math.round(e.sales)},${Math.round(e.fixedSalary)},${Math.round(e.comm)},${Math.round(e.bonus)},${Math.round(e.total)}`).join('\n')
                        const blob = new Blob([bom + h + r], { type: 'text/csv;charset=utf-8;' })
                        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `คอมมิชชั่น_${dateFrom || 'all'}.csv`; a.click()
                      }} style={{ padding: '6px 16px', border: `1px solid ${C.border}`, borderRadius: 2, background: C.surface, color: C.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: C.fontSans }}>📥 Export CSV</button>
                    </div>
                    <table>
                      <thead><tr>
                        <th style={{ ...th, width: 36 }}>#</th>
                        <th style={th}>พนักงาน</th>
                        <th style={{ ...th, textAlign: 'center' }}>ออเดอร์</th>
                        <th style={{ ...th, textAlign: 'right' }}>ยอดขาย</th>
                        <th style={{ ...th, textAlign: 'right' }}>เงินเดือน</th>
                        <th style={{ ...th, textAlign: 'right' }}>คอมมิชชั่น</th>
                        <th style={{ ...th, textAlign: 'right' }}>โบนัส</th>
                        <th style={{ ...th, textAlign: 'right' }}>รวมรับ</th>
                      </tr></thead>
                      <tbody>
                        {empComm.map((e, i) => (
                          <tr key={e.name} style={{ background: i % 2 === 0 ? C.surfaceAlt : 'transparent' }}>
                            <td style={{ ...td, textAlign: 'center', color: C.textMuted }}>{i + 1}</td>
                            <td style={{ ...td, fontWeight: 600 }}>{e.name}</td>
                            <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{e.count}</td>
                            <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: C.success }}>฿{fmt(e.sales)}</td>
                            <td style={{ ...td, textAlign: 'right' }}>฿{fmt(e.fixedSalary)}</td>
                            <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: C.accent }}>฿{fmt(e.comm)}</td>
                            <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: e.bonus > 0 ? C.gold : C.textMuted }}>{e.bonus > 0 ? `฿${fmt(e.bonus)} ✅` : '—'}</td>
                            <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: C.navy }}>฿{fmt(e.total)}</td>
                          </tr>
                        ))}
                        <tr style={{ background: '#f5f0e8' }}>
                          <td colSpan="2" style={{ ...td, fontWeight: 800 }}>รวม</td>
                          <td style={{ ...td, textAlign: 'center', fontWeight: 800 }}>{totalOrders}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: C.success }}>฿{fmt(totalSales)}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>฿{fmt(fixedSalary * empComm.length)}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: C.accent }}>฿{fmt(totalComm)}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: C.gold }}>฿{fmt(totalBonus)}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: C.navy }}>฿{fmt(totalPay)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              })()}
            </div>
          )}

          {/* ═══════ ALERTS ═══════ */}
          {section === 'alerts' && (
            <div className="fade-in">
              {(() => {
                const alerts = []

                // 1. ยอดตกผิดปกติ — compare today vs avg of last 7 days
                const todayOrd = orders.filter(o => o.order_date === todayStr)
                const todaySales = todayOrd.reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)
                const last7 = {}
                orders.forEach(o => {
                  const d = o.order_date
                  if (d && d !== todayStr) { if (!last7[d]) last7[d] = { sales: 0, count: 0 }; last7[d].sales += parseFloat(o.sale_price) || 0; last7[d].count++ }
                })
                const dayVals = Object.values(last7)
                if (dayVals.length >= 3) {
                  const avgSales = dayVals.reduce((s, d) => s + d.sales, 0) / dayVals.length
                  const avgOrders = dayVals.reduce((s, d) => s + d.count, 0) / dayVals.length
                  if (todaySales < avgSales * 0.5 && todayOrd.length > 0) alerts.push({ type: 'danger', icon: '📉', title: 'ยอดขายวันนี้ตกมาก', desc: `วันนี้ ฿${fmt(todaySales)} (${todayOrd.length} ออเดอร์) ต่ำกว่าค่าเฉลี่ย ฿${fmt(avgSales)} ถึง ${((1 - todaySales / avgSales) * 100).toFixed(0)}%` })
                  if (todayOrd.length < avgOrders * 0.5 && todayOrd.length > 0) alerts.push({ type: 'warning', icon: '⚠️', title: 'ออเดอร์วันนี้น้อยผิดปกติ', desc: `วันนี้ ${todayOrd.length} ออเดอร์ ค่าเฉลี่ย ${avgOrders.toFixed(0)} ออเดอร์/วัน` })
                  if (todayOrd.length === 0) alerts.push({ type: 'danger', icon: '🚨', title: 'วันนี้ยังไม่มีออเดอร์เลย', desc: `ค่าเฉลี่ย ${avgOrders.toFixed(0)} ออเดอร์/วัน · ฿${fmt(avgSales)}/วัน` })
                }

                // 2. พนักงานยอดตก
                if (prevOrders.length > 0) {
                  const curEmp = {}, prevEmp = {}
                  orders.forEach(o => { const n = o.employee_name || '—'; curEmp[n] = (curEmp[n] || 0) + (parseFloat(o.sale_price) || 0) })
                  prevOrders.forEach(o => { const n = o.employee_name || '—'; prevEmp[n] = (prevEmp[n] || 0) + (parseFloat(o.sale_price) || 0) })
                  Object.entries(curEmp).forEach(([name, cur]) => {
                    const prev = prevEmp[name]
                    if (prev && prev > 0 && cur < prev * 0.5) alerts.push({ type: 'warning', icon: '👤', title: `${name} ยอดตก`, desc: `ยอดลดจาก ฿${fmt(prev)} → ฿${fmt(cur)} (ลด ${((1 - cur / prev) * 100).toFixed(0)}%)` })
                  })
                  Object.entries(prevEmp).forEach(([name, prev]) => {
                    if (!curEmp[name] && prev > 5000) alerts.push({ type: 'danger', icon: '❓', title: `${name} ไม่มียอดเลย`, desc: `ช่วงก่อนหน้ามียอด ฿${fmt(prev)} แต่ช่วงนี้ไม่มีเลย` })
                  })
                }

                // 3. ลูกค้าใหญ่หาย — repeat customers who bought in prev but not current
                if (prevOrders.length > 0) {
                  const curPhones = new Set(orders.map(o => fmtPhone(o.customer_phone)))
                  const prevCust = {}
                  prevOrders.forEach(o => {
                    const ph = fmtPhone(o.customer_phone)
                    if (!prevCust[ph]) prevCust[ph] = { name: o.customer_name || '—', phone: ph, sales: 0, count: 0 }
                    prevCust[ph].sales += parseFloat(o.sale_price) || 0; prevCust[ph].count++
                  })
                  Object.values(prevCust)
                    .filter(c => c.count >= 2 && c.sales >= 1000 && !curPhones.has(c.phone))
                    .sort((a, b) => b.sales - a.sales)
                    .slice(0, 5)
                    .forEach(c => alerts.push({ type: 'info', icon: '💤', title: `ลูกค้าประจำหาย: ${c.name}`, desc: `เคยซื้อ ${c.count} ครั้ง ยอดรวม ฿${fmt(c.sales)} แต่ช่วงนี้ไม่กลับมาซื้อ (${c.phone})` }))
                }

                // 4. สินค้ายอดตก
                if (prevOrders.length > 0) {
                  const curProd = {}, prevProd = {}
                  orders.forEach(o => { const p = (o.remark || '').trim() || '—'; curProd[p] = (curProd[p] || 0) + 1 })
                  prevOrders.forEach(o => { const p = (o.remark || '').trim() || '—'; prevProd[p] = (prevProd[p] || 0) + 1 })
                  Object.entries(prevProd).forEach(([name, prev]) => {
                    const cur = curProd[name] || 0
                    if (prev >= 10 && cur < prev * 0.3) alerts.push({ type: 'warning', icon: '📦', title: `สินค้า "${name}" ยอดตก`, desc: `จาก ${prev} → ${cur} ออเดอร์ (ลด ${((1 - cur / prev) * 100).toFixed(0)}%)` })
                  })
                }

                // 5. Good news!
                if (prevOrders.length > 0) {
                  const prevTotal = prevOrders.reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)
                  if (totalSales > prevTotal * 1.3 && prevTotal > 0) alerts.push({ type: 'success', icon: '🎉', title: 'ยอดขายเติบโตดี!', desc: `ยอดขายเพิ่มขึ้น ${((totalSales / prevTotal - 1) * 100).toFixed(0)}% จาก ฿${fmt(prevTotal)} → ฿${fmt(totalSales)}` })
                }

                if (alerts.length === 0) alerts.push({ type: 'success', icon: '✅', title: 'ไม่มีสิ่งผิดปกติ', desc: 'ทุกอย่างปกติดีครับ เลือกช่วงเวลาที่มีข้อมูลเพื่อดูการเปรียบเทียบ' })

                const colors = { danger: { bg: '#fef2f2', border: '#fecaca', text: C.danger }, warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' }, info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' }, success: { bg: '#f0fdf4', border: '#bbf7d0', text: C.success } }

                return <>
                  <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16 }}>
                    {!dateFrom ? 'เลือกช่วงเวลา เช่น "เดือนนี้" เพื่อเปรียบเทียบกับเดือนก่อน' : `เปรียบเทียบช่วงปัจจุบันกับช่วงก่อนหน้า · พบ ${alerts.length} รายการ`}
                  </div>
                  {alerts.map((a, i) => {
                    const cl = colors[a.type]
                    return (
                      <div key={i} style={{ padding: 16, marginBottom: 10, borderRadius: 2, background: cl.bg, border: `1px solid ${cl.border}`, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 24 }}>{a.icon}</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: cl.text, marginBottom: 2 }}>{a.title}</div>
                          <div style={{ fontSize: 12, color: C.textDim }}>{a.desc}</div>
                        </div>
                      </div>
                    )
                  })}
                </>
              })()}
            </div>
          )}

          {/* ═══════ TARGETS ═══════ */}
          {section === 'targets' && (
            <div className="fade-in">
              <div style={{ ...card, padding: 20, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: C.font }}>🎯 ตั้งเป้ายอดขาย</div>
                  <button onClick={() => setEditTarget(!editTarget)} style={{ padding: '6px 16px', border: `1px solid ${C.border}`, borderRadius: 2, background: editTarget ? C.accent : C.surface, color: editTarget ? '#fff' : C.textDim, fontSize: 12, cursor: 'pointer', fontFamily: C.fontSans }}>
                    {editTarget ? '✓ บันทึก' : '✏️ แก้ไข'}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                  {[{ key: 'daily', label: 'เป้ารายวัน (฿)' }, { key: 'monthly', label: 'เป้ารายเดือน (฿)' }, { key: 'dailyOrders', label: 'เป้าออเดอร์/วัน' }].map(t => (
                    <div key={t.key}>
                      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>{t.label}</div>
                      {editTarget ? (
                        <input type="number" value={targets[t.key] || ''} onChange={e => saveTargets({ ...targets, [t.key]: parseFloat(e.target.value) || 0 })}
                          style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 2, fontSize: 16, fontWeight: 700, fontFamily: C.fontSans, boxSizing: 'border-box' }} />
                      ) : (
                        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: C.font, color: C.text }}>{t.key === 'dailyOrders' ? (targets[t.key] || 0) : `฿${fmt(targets[t.key] || 0)}`}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {(() => {
                const now = new Date()
                const todayOrd = orders.filter(o => o.order_date === todayStr)
                const todaySales = todayOrd.reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
                const monthOrd = orders.filter(o => o.order_date >= monthStart)
                const monthSales = monthOrd.reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)
                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
                const daysPassed = now.getDate()
                const projectedMonth = daysPassed > 0 ? (monthSales / daysPassed) * daysInMonth : 0
                const dailyPct = targets.daily > 0 ? (todaySales / targets.daily) * 100 : 0
                const monthPct = targets.monthly > 0 ? (monthSales / targets.monthly) * 100 : 0
                const orderPct = targets.dailyOrders > 0 ? (todayOrd.length / targets.dailyOrders) * 100 : 0

                const PB = ({ label, current, target, pct, prefix = '฿', isMoney = true }) => (
                  <div style={{ ...card, padding: 18, marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: pct >= 100 ? C.success : pct >= 70 ? C.gold : C.danger }}>{pct.toFixed(1)}% {pct >= 100 ? '✅' : pct >= 70 ? '🔥' : '⚡'}</span>
                    </div>
                    <div style={{ height: 12, borderRadius: 6, background: C.surfaceHover, overflow: 'hidden', marginBottom: 6 }}>
                      <div style={{ width: Math.min(pct, 100) + '%', height: '100%', borderRadius: 6, background: pct >= 100 ? C.success : pct >= 70 ? C.gold : C.dangerLight }}></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textDim }}>
                      <span>ปัจจุบัน: {isMoney ? `${prefix}${fmt(current)}` : current}</span>
                      <span>เป้า: {isMoney ? `${prefix}${fmt(target)}` : target}</span>
                    </div>
                  </div>
                )

                return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: C.font }}>📅 วันนี้</div>
                    {targets.daily > 0 && <PB label="ยอดขาย" current={todaySales} target={targets.daily} pct={dailyPct} />}
                    {targets.dailyOrders > 0 && <PB label="ออเดอร์" current={todayOrd.length} target={targets.dailyOrders} pct={orderPct} prefix="" isMoney={false} />}
                    {!targets.daily && !targets.dailyOrders && <div style={{ ...card, padding: 30, textAlign: 'center', color: C.textMuted }}>กด "แก้ไข" เพื่อตั้งเป้า</div>}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: C.font }}>📆 เดือนนี้ (วันที่ {daysPassed}/{daysInMonth})</div>
                    {targets.monthly > 0 ? <>
                      <PB label="ยอดขาย" current={monthSales} target={targets.monthly} pct={monthPct} />
                      <div style={{ ...card, padding: 14 }}>
                        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>คาดการณ์สิ้นเดือน</div>
                        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: C.font, color: projectedMonth >= targets.monthly ? C.success : C.danger }}>
                          ฿{fmt(projectedMonth)} <span style={{ fontSize: 12, fontWeight: 600 }}>({projectedMonth >= targets.monthly ? '✅ น่าจะถึงเป้า' : '⚠️ ยังไม่ถึงเป้า'})</span>
                        </div>
                      </div>
                    </> : <div style={{ ...card, padding: 30, textAlign: 'center', color: C.textMuted }}>กด "แก้ไข" เพื่อตั้งเป้า</div>}
                  </div>
                </div>
              })()}
              {targets.daily > 0 && empStats.length > 0 && (() => {
                const perTarget = targets.daily / empStats.length
                const todayOrd = orders.filter(o => o.order_date === todayStr)
                const todayEmp = {}
                todayOrd.forEach(o => { const n = o.employee_name || '—'; if (!todayEmp[n]) todayEmp[n] = { count: 0, sales: 0 }; todayEmp[n].count++; todayEmp[n].sales += parseFloat(o.sale_price) || 0 })
                return <div style={{ ...card, padding: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12, fontFamily: C.font }}>พนักงานวันนี้ vs เป้าเฉลี่ย (฿{fmt(perTarget)}/คน)</div>
                  <table>
                    <thead><tr>
                      <th style={th}>พนักงาน</th>
                      <th style={{ ...th, textAlign: 'center' }}>ออเดอร์</th>
                      <th style={{ ...th, textAlign: 'right' }}>ยอดขาย</th>
                      <th style={{ ...th, textAlign: 'right', width: '35%' }}>ความคืบหน้า</th>
                    </tr></thead>
                    <tbody>
                      {empStats.map(e => {
                        const te = todayEmp[e.name] || { count: 0, sales: 0 }
                        const p = perTarget > 0 ? (te.sales / perTarget) * 100 : 0
                        return <tr key={e.name}>
                          <td style={{ ...td, fontWeight: 600 }}>{e.name}</td>
                          <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: C.accent }}>{te.count}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: C.success }}>฿{fmt(te.sales)}</td>
                          <td style={{ ...td }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ flex: 1, height: 8, borderRadius: 4, background: C.surfaceHover, overflow: 'hidden' }}><div style={{ width: Math.min(p, 100) + '%', height: '100%', borderRadius: 4, background: p >= 100 ? C.success : p >= 70 ? C.gold : C.dangerLight }}></div></div><span style={{ fontSize: 11, fontWeight: 700, color: p >= 100 ? C.success : p >= 70 ? C.gold : C.danger, minWidth: 45 }}>{p.toFixed(0)}%{p >= 100 ? ' ✅' : ''}</span></div></td>
                        </tr>
                      })}
                    </tbody>
                  </table>
                </div>
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
