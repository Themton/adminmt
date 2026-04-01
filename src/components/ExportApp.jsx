import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { T, fmt, LiveDot, Toast, Empty, Pagination } from './ui'
import { exportProshipExcel, exportProshipCSV } from '../lib/exportProship'

export default function ExportApp({ profile, onLogout }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [searchQuery, setSearchQuery] = useState('')
  const todayStr = new Date().toISOString().split('T')[0]
  const [dateFilter, setDateFilter] = useState(todayStr)
  const [dateFilterEnd, setDateFilterEnd] = useState(todayStr)
  const [quickFilter, setQuickFilter] = useState('today')
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [sidebarPage, setSidebarPage] = useState('orders')
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 3500) }

  // Load orders
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
  }, [dateFilter, dateFilterEnd])

  // Filters
  const filtered = orders.filter(o => {
    if (statusFilter === 'has_pno') return !!o.flash_pno
    if (statusFilter === 'no_pno') return !o.flash_pno
    if (statusFilter === 'cod') return o.payment_type === 'cod'
    if (statusFilter === 'transfer') return o.payment_type === 'transfer'
    if (statusFilter === 'delivered') return o.flash_status === 'flash_5'
    if (statusFilter === 'returned') return o.flash_status === 'flash_6' || o.flash_status === 'cancelled'
    return true
  }).filter(o => {
    if (paymentFilter === 'cod') return o.payment_type === 'cod'
    if (paymentFilter === 'transfer') return o.payment_type === 'transfer'
    return true
  }).filter(o => {
    if (employeeFilter) return (o.employee_name || '').toLowerCase().includes(employeeFilter.toLowerCase())
    return true
  }).filter(o => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (o.customer_name||'').toLowerCase().includes(q) || (o.customer_phone||'').includes(q) || (o.flash_pno||'').includes(q) || (o.remark||'').toLowerCase().includes(q) || (o.employee_name||'').toLowerCase().includes(q)
  })

  // Stats
  const totalSales = filtered.reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)
  const totalCod = filtered.filter(o => o.payment_type === 'cod').reduce((s, o) => s + (parseFloat(o.cod_amount || o.sale_price) || 0), 0)
  const totalTransfer = filtered.filter(o => o.payment_type === 'transfer').reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0)
  const withPno = filtered.filter(o => o.flash_pno).length
  const employees = [...new Set(orders.map(o => o.employee_name).filter(Boolean))]

  // Select
  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => {
    const pIds = filtered.slice((page-1)*pageSize, page*pageSize).map(o => o.id)
    const allSel = pIds.length > 0 && pIds.every(id => selectedIds.has(id))
    setSelectedIds(prev => { const n = new Set(prev); pIds.forEach(id => allSel ? n.delete(id) : n.add(id)); return n })
  }

  // Export
  const doExport = (type, data) => {
    const exportData = data || (selectedIds.size > 0 ? filtered.filter(o => selectedIds.has(o.id)) : filtered)
    const fileName = `Export_${dateFilter||'all'}_${exportData.length}`
    if (type === 'csv') { exportProshipCSV(exportData, fileName + '.csv', profile, 'export'); flash('✅ Export CSV สำเร็จ — ' + exportData.length + ' รายการ') }
    else { exportProshipExcel(exportData, fileName + '.xlsx', profile, 'export').then(() => flash('✅ Export Excel สำเร็จ — ' + exportData.length + ' รายการ')) }
  }

  return (
    <div style={{fontFamily:T.font,minHeight:'100vh',background:'#F4F6F7',color:T.text}}>
      <Toast message={toast} />

      {/* Header */}
      <div style={{background:'#fff',padding:'12px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',position:'fixed',top:0,left:0,right:0,zIndex:200,borderBottom:'1px solid #DEE2E6',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}><img src="./logo.png" alt="" style={{height:28}} /><span style={{fontSize:16,fontWeight:900}}>ADMIN THE MT</span><LiveDot /></div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <span style={{fontSize:11,color:'#85929E'}}>{profile.full_name} — 📊 Export</span>
          <button onClick={onLogout} style={{padding:'6px 12px',borderRadius:6,border:'1px solid #DEE2E6',background:'transparent',color:'#85929E',fontSize:11,cursor:'pointer',fontFamily:T.font}}>ออก</button>
        </div>
      </div>

      {/* Sidebar + Content */}
      <div style={{display:'flex',marginTop:52,minHeight:'calc(100vh - 52px)'}}>
        <div style={{width:200,minWidth:200,background:'#2C3E50',color:'#fff',padding:'20px 0',position:'fixed',top:52,bottom:0,overflowY:'auto'}}>
          <div style={{padding:'0 16px 16px',borderBottom:'1px solid rgba(255,255,255,0.1)',marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:'#27AE60'}}>📊 ระบบรายงาน</div>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.5)',marginTop:2}}>Export ข้อมูล</div>
          </div>
          {[
            { id: 'orders', icon: '📋', label: 'รายการออเดอร์' },
            { id: 'summary', icon: '📊', label: 'สรุปยอด' },
            { id: 'employee', icon: '👥', label: 'สรุปพนักงาน' },
          ].map(m => (
            <button key={m.id} onClick={() => setSidebarPage(m.id)} style={{
              display:'flex',gap:10,alignItems:'center',width:'100%',padding:'12px 20px',border:'none',cursor:'pointer',fontFamily:T.font,fontSize:13,fontWeight:sidebarPage===m.id?700:400,
              background:sidebarPage===m.id?'rgba(39,174,96,0.15)':'transparent',color:sidebarPage===m.id?'#27AE60':'rgba(255,255,255,0.7)',
              borderLeft:sidebarPage===m.id?'3px solid #27AE60':'3px solid transparent'
            }}>
              <span style={{fontSize:16}}>{m.icon}</span>{m.label}
            </button>
          ))}
        </div>

        {/* Main */}
        <div style={{flex:1,marginLeft:200,padding:'20px 24px'}}>

          {/* Date + filters (shared) */}
          <div style={{display:'flex',gap:6,marginBottom:16,alignItems:'center',flexWrap:'wrap'}}>
            <input type="date" value={dateFilter} onChange={e=>{setDateFilter(e.target.value);if(!dateFilterEnd||e.target.value>dateFilterEnd)setDateFilterEnd(e.target.value);setQuickFilter('');setPage(1)}} style={{padding:'7px 10px',borderRadius:6,background:'#fff',border:'1px solid #DEE2E6',fontSize:12,fontFamily:T.font}} />
            <span style={{color:'#ABB2B9'}}>—</span>
            <input type="date" value={dateFilterEnd} onChange={e=>{setDateFilterEnd(e.target.value);setQuickFilter('');setPage(1)}} style={{padding:'7px 10px',borderRadius:6,background:'#fff',border:'1px solid #DEE2E6',fontSize:12,fontFamily:T.font}} />
            {[
              {id:'today',label:'วันนี้',fn:()=>{setDateFilter(todayStr);setDateFilterEnd(todayStr)}},
              {id:'7days',label:'7 วัน',fn:()=>{const d=new Date();d.setDate(d.getDate()-6);setDateFilter(d.toISOString().split('T')[0]);setDateFilterEnd(todayStr)}},
              {id:'month',label:'เดือนนี้',fn:()=>{setDateFilter(new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0')+'-01');setDateFilterEnd(todayStr)}},
            ].map(b=><button key={b.id} onClick={()=>{b.fn();setQuickFilter(b.id);setPage(1)}} style={{padding:'7px 14px',borderRadius:6,border:quickFilter===b.id?'none':'1px solid #DEE2E6',background:quickFilter===b.id?'#27AE60':'#fff',color:quickFilter===b.id?'#fff':'#85929E',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>{b.label}</button>)}
            <div style={{flex:1}} />
            <input placeholder="ค้นหา..." value={searchQuery} onChange={e=>{setSearchQuery(e.target.value);setPage(1)}} style={{padding:'7px 12px',borderRadius:6,border:'1px solid #DEE2E6',fontSize:12,fontFamily:T.font,width:200}} />
          </div>

          {/* ═══ PAGE: รายการออเดอร์ ═══ */}
          {sidebarPage === 'orders' && <>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
              <div style={{fontSize:20,fontWeight:800}}>📋 รายการออเดอร์</div>
            </div>

            {/* Sub filters */}
            <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
              <select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(1)}} style={{padding:'7px 10px',borderRadius:6,border:'1px solid #DEE2E6',fontSize:12,fontFamily:T.font}}>
                <option value="all">ทุกสถานะ</option>
                <option value="has_pno">มีเลขพัสดุ</option>
                <option value="no_pno">ไม่มีเลขพัสดุ</option>
                <option value="delivered">เซ็นรับแล้ว</option>
                <option value="returned">ตีกลับ/ยกเลิก</option>
              </select>
              <select value={paymentFilter} onChange={e=>{setPaymentFilter(e.target.value);setPage(1)}} style={{padding:'7px 10px',borderRadius:6,border:'1px solid #DEE2E6',fontSize:12,fontFamily:T.font}}>
                <option value="all">ทุกประเภท</option>
                <option value="cod">COD</option>
                <option value="transfer">โอน</option>
              </select>
              <select value={employeeFilter} onChange={e=>{setEmployeeFilter(e.target.value);setPage(1)}} style={{padding:'7px 10px',borderRadius:6,border:'1px solid #DEE2E6',fontSize:12,fontFamily:T.font}}>
                <option value="">ทุกพนักงาน</option>
                {employees.map(e=><option key={e} value={e}>{e}</option>)}
              </select>
              <div style={{flex:1}} />
              <span style={{fontSize:12,color:'#85929E'}}>{filtered.length} รายการ | ฿{fmt(totalSales)}</span>
              <button onClick={()=>doExport('xlsx')} style={{padding:'7px 16px',borderRadius:6,border:'none',background:'#27AE60',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>📊 Excel ({selectedIds.size>0?selectedIds.size:filtered.length})</button>
              <button onClick={()=>doExport('csv')} style={{padding:'7px 16px',borderRadius:6,border:'1px solid #27AE60',background:'#EAFAF1',color:'#27AE60',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>📥 CSV</button>
            </div>

            {/* Stats cards */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,marginBottom:16}}>
              {[
                {label:'ออเดอร์ทั้งหมด',value:filtered.length,icon:'📦',color:'#2980B9'},
                {label:'ยอดรวม',value:'฿'+fmt(totalSales),icon:'💰',color:'#E67E22'},
                {label:'COD',value:'฿'+fmt(totalCod)+' ('+filtered.filter(o=>o.payment_type==='cod').length+')',icon:'🔴',color:'#E74C3C'},
                {label:'โอน',value:'฿'+fmt(totalTransfer)+' ('+filtered.filter(o=>o.payment_type==='transfer').length+')',icon:'🟢',color:'#27AE60'},
                {label:'มีเลขพัสดุ',value:withPno,icon:'📮',color:'#8E44AD'},
              ].map(s=>(
                <div key={s.label} style={{background:'#fff',borderRadius:8,padding:'14px 16px',border:'1px solid #DEE2E6'}}>
                  <div style={{fontSize:11,color:'#85929E'}}>{s.icon} {s.label}</div>
                  <div style={{fontSize:20,fontWeight:900,color:s.color,marginTop:4}}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Table */}
            <div style={{background:'#fff',borderRadius:8,border:'1px solid #DEE2E6',overflow:'hidden'}}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,fontFamily:T.font,minWidth:1200}}>
                  <thead><tr style={{background:'#F8F9FA'}}>
                    <th style={{padding:'10px 6px',width:36,borderBottom:'1px solid #DEE2E6'}}><input type="checkbox" checked={(()=>{const p=filtered.slice((page-1)*pageSize,page*pageSize).map(o=>o.id);return p.length>0&&p.every(id=>selectedIds.has(id))})() } onChange={toggleAll} style={{cursor:'pointer'}} /></th>
                    {['#','วันที่','เวลา','ลูกค้า','เบอร์','ที่อยู่','จังหวัด','เลขพัสดุ','ประเภท','ราคา','COD','หมายเหตุ','พนักงาน','เพจ'].map(h=><th key={h} style={{padding:'10px 6px',textAlign:'left',fontWeight:600,color:'#5D6D7E',borderBottom:'1px solid #DEE2E6',fontSize:10}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {filtered.slice((page-1)*pageSize,page*pageSize).map((o,i)=>{
                      const dt = new Date(o.created_at)
                      return <tr key={o.id} style={{borderBottom:'1px solid #EAECEE',background:selectedIds.has(o.id)?'#EAFAF1':'#fff'}}>
                        <td style={{padding:'8px 6px',textAlign:'center'}}><input type="checkbox" checked={selectedIds.has(o.id)} onChange={()=>toggleSelect(o.id)} style={{cursor:'pointer'}} /></td>
                        <td style={{padding:'8px 6px',textAlign:'center',color:'#ABB2B9',fontSize:10}}>{(page-1)*pageSize+i+1}</td>
                        <td style={{padding:'8px 6px',fontSize:11}}>{dt.toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'2-digit',month:'short',year:'numeric'})}</td>
                        <td style={{padding:'8px 6px',fontSize:11,color:'#85929E'}}>{dt.toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'})}</td>
                        <td style={{padding:'8px 6px',fontWeight:600}}>{o.customer_name}</td>
                        <td style={{padding:'8px 6px',color:'#85929E',fontSize:11}}>{o.customer_phone}</td>
                        <td style={{padding:'8px 6px',fontSize:10,color:'#85929E',maxWidth:150,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{o.customer_address||''}</td>
                        <td style={{padding:'8px 6px',fontSize:11}}>{o.province||''}</td>
                        <td style={{padding:'8px 6px'}}>{o.flash_pno?<span style={{fontFamily:'monospace',fontSize:10,color:'#2980B9',fontWeight:700}}>{o.flash_pno}</span>:'—'}</td>
                        <td style={{padding:'8px 6px'}}><span style={{padding:'2px 6px',borderRadius:4,fontSize:9,fontWeight:700,background:o.payment_type==='transfer'?'#EAFAF1':'#FDEDEC',color:o.payment_type==='transfer'?'#27AE60':'#E74C3C'}}>{o.payment_type==='transfer'?'โอน':'COD'}</span></td>
                        <td style={{padding:'8px 6px',textAlign:'right',fontWeight:700,color:'#2C3E50'}}>฿{fmt(parseFloat(o.sale_price)||0)}</td>
                        <td style={{padding:'8px 6px',textAlign:'right',fontWeight:700,color:'#E74C3C'}}>{o.payment_type==='cod'?'฿'+fmt(parseFloat(o.cod_amount||o.sale_price)||0):''}</td>
                        <td style={{padding:'8px 6px',fontSize:10,color:'#85929E',maxWidth:120,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{o.remark||''}</td>
                        <td style={{padding:'8px 6px',fontSize:11,color:'#85929E'}}>{o.employee_name||'—'}</td>
                        <td style={{padding:'8px 6px',fontSize:10,color:'#85929E'}}>{o.sales_channel||''}</td>
                      </tr>
                    })}
                  </tbody>
                </table>
                {filtered.length===0&&!loading&&<Empty text="ไม่มีข้อมูล" />}
                {loading&&<div style={{textAlign:'center',padding:40,color:'#85929E'}}>⏳ กำลังโหลด...</div>}
              </div>
            </div>
            <Pagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </>}

          {/* ═══ PAGE: สรุปยอด ═══ */}
          {sidebarPage === 'summary' && <div>
            <div style={{fontSize:20,fontWeight:800,marginBottom:20}}>📊 สรุปยอดขาย</div>

            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12,marginBottom:20}}>
              {[
                {label:'ออเดอร์ทั้งหมด',value:filtered.length,sub:'รายการ',color:'#2980B9',icon:'📦'},
                {label:'ยอดขายรวม',value:'฿'+fmt(totalSales),sub:'บาท',color:'#E67E22',icon:'💰'},
                {label:'COD รวม',value:'฿'+fmt(totalCod),sub:filtered.filter(o=>o.payment_type==='cod').length+' รายการ',color:'#E74C3C',icon:'🔴'},
                {label:'โอนรวม',value:'฿'+fmt(totalTransfer),sub:filtered.filter(o=>o.payment_type==='transfer').length+' รายการ',color:'#27AE60',icon:'🟢'},
                {label:'มีเลขพัสดุ',value:withPno,sub:'รายการ',color:'#8E44AD',icon:'📮'},
                {label:'เซ็นรับแล้ว',value:filtered.filter(o=>o.flash_status==='flash_5').length,sub:'รายการ',color:'#1E8449',icon:'✅'},
              ].map(s=>(
                <div key={s.label} style={{background:'#fff',borderRadius:10,padding:'20px',border:'1px solid #DEE2E6'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <div style={{fontSize:12,color:'#85929E',marginBottom:6}}>{s.label}</div>
                      <div style={{fontSize:24,fontWeight:900,color:s.color}}>{s.value}</div>
                      <div style={{fontSize:11,color:'#ABB2B9',marginTop:2}}>{s.sub}</div>
                    </div>
                    <div style={{fontSize:32}}>{s.icon}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* สรุปตามวัน */}
            <div style={{background:'#fff',borderRadius:8,border:'1px solid #DEE2E6',padding:20,marginBottom:20}}>
              <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>📅 สรุปรายวัน</div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,fontFamily:T.font}}>
                <thead><tr style={{background:'#F8F9FA'}}>
                  {['วันที่','จำนวน','ยอดรวม','COD','โอน','มีเลขพัสดุ'].map(h=><th key={h} style={{padding:'10px',textAlign:'left',fontWeight:600,color:'#5D6D7E',borderBottom:'1px solid #DEE2E6'}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {(() => {
                    const byDate = {}
                    filtered.forEach(o => { const d = (o.order_date||'').substring(0,10); if (!byDate[d]) byDate[d] = { count:0, total:0, cod:0, transfer:0, pno:0 }; byDate[d].count++; byDate[d].total += parseFloat(o.sale_price)||0; if (o.payment_type==='cod') byDate[d].cod += parseFloat(o.cod_amount||o.sale_price)||0; else byDate[d].transfer += parseFloat(o.sale_price)||0; if (o.flash_pno) byDate[d].pno++ })
                    return Object.entries(byDate).sort((a,b)=>b[0].localeCompare(a[0])).map(([date,s])=>(
                      <tr key={date} style={{borderBottom:'1px solid #EAECEE'}}>
                        <td style={{padding:'10px',fontWeight:600}}>{date}</td>
                        <td style={{padding:'10px',fontWeight:700,color:'#2980B9'}}>{s.count}</td>
                        <td style={{padding:'10px',fontWeight:700}}>฿{fmt(s.total)}</td>
                        <td style={{padding:'10px',color:'#E74C3C',fontWeight:700}}>฿{fmt(s.cod)}</td>
                        <td style={{padding:'10px',color:'#27AE60',fontWeight:700}}>฿{fmt(s.transfer)}</td>
                        <td style={{padding:'10px',color:'#8E44AD',fontWeight:700}}>{s.pno}</td>
                      </tr>
                    ))
                  })()}
                </tbody>
              </table>
            </div>

            <button onClick={()=>doExport('xlsx')} style={{padding:'12px 24px',borderRadius:8,border:'none',background:'#27AE60',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:T.font}}>📊 Export ทั้งหมด ({filtered.length} รายการ)</button>
          </div>}

          {/* ═══ PAGE: สรุปพนักงาน ═══ */}
          {sidebarPage === 'employee' && <div>
            <div style={{fontSize:20,fontWeight:800,marginBottom:20}}>👥 สรุปตามพนักงาน</div>

            <div style={{background:'#fff',borderRadius:8,border:'1px solid #DEE2E6',overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,fontFamily:T.font}}>
                <thead><tr style={{background:'#F8F9FA'}}>
                  {['#','พนักงาน','จำนวน','ยอดรวม','COD','โอน','มีเลขพัสดุ','Export'].map(h=><th key={h} style={{padding:'12px 10px',textAlign:'left',fontWeight:600,color:'#5D6D7E',borderBottom:'1px solid #DEE2E6'}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {(() => {
                    const byEmp = {}
                    filtered.forEach(o => {
                      const e = o.employee_name || 'ไม่ระบุ'
                      if (!byEmp[e]) byEmp[e] = { count:0, total:0, cod:0, transfer:0, pno:0, orders:[] }
                      byEmp[e].count++; byEmp[e].total += parseFloat(o.sale_price)||0
                      if (o.payment_type==='cod') byEmp[e].cod += parseFloat(o.cod_amount||o.sale_price)||0
                      else byEmp[e].transfer += parseFloat(o.sale_price)||0
                      if (o.flash_pno) byEmp[e].pno++
                      byEmp[e].orders.push(o)
                    })
                    return Object.entries(byEmp).sort((a,b)=>b[1].total-a[1].total).map(([name,s],i)=>(
                      <tr key={name} style={{borderBottom:'1px solid #EAECEE'}}>
                        <td style={{padding:'12px 10px',textAlign:'center',color:'#ABB2B9'}}>{i+1}</td>
                        <td style={{padding:'12px 10px',fontWeight:700}}>{name}</td>
                        <td style={{padding:'12px 10px',fontWeight:700,color:'#2980B9'}}>{s.count}</td>
                        <td style={{padding:'12px 10px',fontWeight:700}}>฿{fmt(s.total)}</td>
                        <td style={{padding:'12px 10px',color:'#E74C3C',fontWeight:700}}>฿{fmt(s.cod)}</td>
                        <td style={{padding:'12px 10px',color:'#27AE60',fontWeight:700}}>฿{fmt(s.transfer)}</td>
                        <td style={{padding:'12px 10px',color:'#8E44AD',fontWeight:700}}>{s.pno}</td>
                        <td style={{padding:'12px 10px'}}><button onClick={()=>doExport('xlsx',s.orders)} style={{padding:'5px 12px',borderRadius:4,border:'none',background:'#27AE60',color:'#fff',fontSize:10,fontWeight:700,cursor:'pointer'}}>📊 Excel</button></td>
                      </tr>
                    ))
                  })()}
                </tbody>
              </table>
              {employees.length===0&&!loading&&<div style={{textAlign:'center',padding:40,color:'#85929E'}}>ไม่มีข้อมูล</div>}
            </div>
          </div>}

        </div>
      </div>
    </div>
  )
}
