import { useState, useEffect, useMemo } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import { syncOrderToSheet, updateOrderInSheet, deleteOrderFromSheet, syncAllToSheet, resetSheet } from '../lib/sheetSync'
import { createFlashOrder, trackFlashOrder, printFlashLabel, notifyFlashCourier, cancelFlashOrder, pingFlash } from '../lib/flashApi'
import { exportProshipExcel, exportProshipCSV, fetchExportLogs } from '../lib/exportProship'
import OrderForm from './OrderForm'
import { T, glass, fmt, fmtDate, fmtDateFull, fmtDateTime, sameDay, withinDays, thisMonth, Stat, Tabs, Btn, Toast, Modal, Empty, LiveDot, Pagination } from './ui'

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
  const [dateFilterEnd, setDateFilterEnd] = useState(todayStr)
  const [quickFilter, setQuickFilter] = useState('today')
  
  const [userFilter, setUserFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [shipFilter, setShipFilter] = useState('all')
  const [pageSize, setPageSize] = useState(100)
  const [currentPage, setCurrentPage] = useState(1)

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1) }, [dateFilter, dateFilterEnd, userFilter, searchQuery, shipFilter, quickFilter])

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
    if (!u.remark) missing.push('หมายเหตุ')
    if (!u.customer_social) missing.push('ชื่อเฟส/ไลน์')
    if (!u.sales_channel) missing.push('ชื่อเพจ')
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
  const [exportLogs, setExportLogs] = useState([])
  const [showExportLogs, setShowExportLogs] = useState(false)
  const loadExportLogs = async () => { setExportLogs(await fetchExportLogs(50)); setShowExportLogs(true) }

  // ═══ เลือกรายชื่อ (Checkbox) ═══
  const [shipSelected, setShipSelected] = useState(new Set())
  const [bulkCreating, setBulkCreating] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0, results: [] })

  const toggleShipSelect = (id) => {
    setShipSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const toggleShipSelectAll = (ids) => {
    setShipSelected(prev => {
      const allSelected = ids.every(id => prev.has(id))
      if (allSelected) return new Set()
      return new Set(ids)
    })
  }

  const bulkCreateFlash = async (selectedOrders) => {
    if (!selectedOrders.length) { flash('❌ กรุณาเลือกออเดอร์'); return }
    const noPno = selectedOrders.filter(o => !o.flash_pno)
    if (!noPno.length) { flash('⚠️ ออเดอร์ที่เลือกมีเลขพัสดุแล้วทั้งหมด'); return }
    if (!confirm(`⚡ สร้างเลขพัสดุ Flash Express ${noPno.length} รายการ?\n\n${noPno.map(o => '• ' + o.customer_name).join('\n')}`)) return

    setBulkCreating(true)
    setBulkProgress({ done: 0, total: noPno.length, results: [] })

    const results = []
    for (let i = 0; i < noPno.length; i++) {
      const order = noPno[i]
      flash(`⏳ สร้างเลขพัสดุ ${i+1}/${noPno.length}... ${order.customer_name}`)
      const result = await createFlashOrder(order, flashSrcInfo)
      if (result.code === 1 && result.data?.pno) {
        await supabase.from('mt_orders').update({ flash_pno: result.data.pno, flash_status: 'created', shipping_status: 'printed', flash_sort_code: result.data.sortCode || '' }).eq('id', order.id)
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, flash_pno: result.data.pno, flash_status: 'created', shipping_status: 'printed', flash_sort_code: result.data.sortCode || '' } : o))
        results.push({ name: order.customer_name, pno: result.data.pno, sortCode: result.data.sortCode || '', ok: true })
      } else {
        results.push({ name: order.customer_name, error: result.message || 'ไม่สำเร็จ', ok: false, debug: result._debug })
      }
      setBulkProgress({ done: i+1, total: noPno.length, results: [...results] })
      // delay เล็กน้อย ป้องกัน rate limit
      if (i < noPno.length - 1) await new Promise(r => setTimeout(r, 300))
    }

    setBulkCreating(false)
    setShipSelected(new Set())
    const okCount = results.filter(r => r.ok).length
    const failCount = results.filter(r => !r.ok).length
    flash(`✅ สร้างเลขพัสดุสำเร็จ ${okCount} รายการ` + (failCount ? ` | ❌ ไม่สำเร็จ ${failCount}` : ''))
    // แสดงผลลัพธ์ใน modal
    setFlashModal({ bulkResults: results })
  }

  const sendToFlash = async (order) => {
    if (!confirm(`📦 ส่งออเดอร์ไป Flash Express?\n\n${order.customer_name}\n${order.customer_phone}\n${order.district} ${order.province}`)) return
    flash('⏳ กำลังส่งไป Flash...')
    const result = await createFlashOrder(order, flashSrcInfo)
    if (result.code === 1 && result.data?.pno) {
      // บันทึก tracking number ใน Supabase
      await supabase.from('mt_orders').update({ flash_pno: result.data.pno, flash_status: 'created', flash_sort_code: result.data.sortCode || '' }).eq('id', order.id)
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, flash_pno: result.data.pno, flash_status: 'created', flash_sort_code: result.data.sortCode || '' } : o))
      flash('✅ ส่ง Flash สำเร็จ! ' + result.data.pno)
      setFlashModal({ order, result: result.data })
    } else {
      flash('❌ ส่ง Flash ไม่สำเร็จ: ' + (result.message || 'Unknown error'))
      setFlashModal({ order, error: result.message, debugInfo: result._debug, fullResponse: result })
    }
  }

  const trackFlash = async (pno) => {
    flash('⏳ กำลังเช็คสถานะ...')
    const result = await trackFlashOrder(pno)
    if (result.code === 1 && result.data) {
      const d = result.data
      setFlashModal({
        pno: d.pno || pno,
        trackState: d.state,
        trackStateText: d.stateText || '',
        tracking: Array.isArray(d.routes) ? d.routes : (Array.isArray(d) ? d : [])
      })
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

  // ═══ จัดการเลขพัสดุ (Manual) ═══
  const [pnoModal, setPnoModal] = useState(null) // { orderId, pno, customerName } or null
  const [pnoInput, setPnoInput] = useState('')

  const openPnoModal = (order) => {
    setPnoModal({ orderId: order.id, pno: order.flash_pno || '', customerName: order.customer_name })
    setPnoInput(order.flash_pno || '')
  }

  const savePno = async () => {
    if (!pnoModal) return
    const val = pnoInput.trim()
    const { error } = await supabase.from('mt_orders').update({ flash_pno: val, flash_status: val ? 'manual' : '' }).eq('id', pnoModal.orderId)
    if (error) { flash('❌ ' + error.message); return }
    setOrders(prev => prev.map(o => o.id === pnoModal.orderId ? { ...o, flash_pno: val, flash_status: val ? 'manual' : '' } : o))
    flash(val ? '✅ บันทึกเลขพัสดุสำเร็จ' : '✅ ลบเลขพัสดุสำเร็จ')
    setPnoModal(null)
    setPnoInput('')
  }

  const deletePno = async (orderId) => {
    if (!confirm('🗑 ลบเลขพัสดุออกจากระบบ?\n(ไม่ยกเลิกกับ Flash — ใช้ปุ่มยกเลิก Flash แยก)')) return
    const { error } = await supabase.from('mt_orders').update({ flash_pno: '', flash_status: '', flash_sort_code: '' }).eq('id', orderId)
    if (error) { flash('❌ ' + error.message); return }
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, flash_pno: '', flash_status: '', flash_sort_code: '' } : o))
    flash('✅ ลบเลขพัสดุออกจากระบบแล้ว (Flash ยังมี order อยู่)')
  }

  // ═══ ยกเลิก Order กับ Flash Express ═══
  const cancelFlash = async (order) => {
    const pno = order.flash_pno
    if (!pno) { flash('❌ ไม่มีเลขพัสดุ'); return }
    if (!confirm(`⚠️ ยกเลิก order กับ Flash Express?\n\nTracking: ${pno}\nลูกค้า: ${order.customer_name}\n\nFlash จะยกเลิก order นี้จริง — ไม่เข้ารับ/ไม่ส่ง`)) return
    flash('⏳ กำลังยกเลิก...')
    const result = await cancelFlashOrder(pno)
    if (result.code === 1) {
      // ลบเลขพัสดุออกจาก Supabase ด้วย
      await supabase.from('mt_orders').update({ flash_pno: '', flash_status: 'cancelled', flash_sort_code: '', shipping_status: 'waiting' }).eq('id', order.id)
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, flash_pno: '', flash_status: 'cancelled', flash_sort_code: '', shipping_status: 'waiting' } : o))
      flash('✅ ยกเลิก Flash order สำเร็จ — ' + pno)
    } else {
      flash('❌ ยกเลิกไม่สำเร็จ: ' + (result.message || 'Unknown error'))
    }
  }

  // ═══ Bulk ยกเลิก Flash ═══
  const bulkCancelFlash = async (selectedOrders) => {
    const withPno = selectedOrders.filter(o => o.flash_pno)
    if (!withPno.length) { flash('❌ ไม่มีรายการที่มีเลขพัสดุ'); return }
    if (!confirm(`⚠️ ยกเลิก ${withPno.length} order กับ Flash Express?\n\nFlash จะยกเลิกทั้งหมด — ไม่เข้ารับ/ไม่ส่ง`)) return
    let ok = 0, fail = 0
    for (const o of withPno) {
      flash(`⏳ ยกเลิก ${ok+fail+1}/${withPno.length}...`)
      const result = await cancelFlashOrder(o.flash_pno)
      if (result.code === 1) {
        await supabase.from('mt_orders').update({ flash_pno: '', flash_status: 'cancelled', flash_sort_code: '', shipping_status: 'waiting' }).eq('id', o.id)
        setOrders(prev => prev.map(x => x.id === o.id ? { ...x, flash_pno: '', flash_status: 'cancelled', flash_sort_code: '', shipping_status: 'waiting' } : x))
        ok++
      } else { fail++ }
      await new Promise(r => setTimeout(r, 300))
    }
    setShipSelected(new Set())
    flash(`✅ ยกเลิกสำเร็จ ${ok} รายการ` + (fail ? ` | ❌ ไม่สำเร็จ ${fail}` : ''))
  }

  // ═══ Print Label — ปริ้นใบปะหน้า ═══
  // ═══ Notify Courier — เรียกพนักงานเข้ารับ ═══
  const notifyCourier = async (pnoList) => {
    const list = Array.isArray(pnoList) ? pnoList : [pnoList]
    if (!confirm(`📞 เรียกพนักงาน Flash เข้ารับพัสดุ ${list.length} รายการ?`)) return
    flash('⏳ กำลังแจ้ง Flash...')
    const result = await notifyFlashCourier(list)
    if (result.code === 1) {
      flash('✅ แจ้งรับพัสดุสำเร็จ! ' + (result.data?.ticketPickupId ? 'Ticket: ' + result.data.ticketPickupId : ''))
    } else {
      flash('❌ ' + (result.message || 'ไม่สำเร็จ'))
    }
  }

  // ═══ สร้างใบปะหน้า (Client-side — ไม่ต้องใช้ Flash Label API) ═══
  // ═══ Label System: HTML → Canvas → PDF (รองรับภาษาไทย) ═══
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

  const printLabel = async (pnoOrOrder) => {
    let order = typeof pnoOrOrder === 'string' ? orders.find(o => o.flash_pno === pnoOrOrder) : pnoOrOrder
    if (!order) { flash('❌ ไม่พบข้อมูลออเดอร์'); return }
    flash('⏳ กำลังสร้างใบปะหน้า...')
    await buildLabelPDF([order])
  }

  const bulkPrintLabels = async (pnoListOrOrders) => {
    let labelOrders
    if (typeof pnoListOrOrders[0] === 'string') {
      labelOrders = pnoListOrOrders.map(pno => orders.find(o => o.flash_pno === pno)).filter(Boolean)
    } else {
      labelOrders = pnoListOrOrders.filter(o => o.flash_pno)
    }
    if (!labelOrders.length) { flash('❌ ไม่มีออเดอร์ที่มีเลขพัสดุ'); return }
    flash(`⏳ กำลังสร้างใบปะหน้า ${labelOrders.length} รายการ...`)
    await buildLabelPDF(labelOrders)
  }

  const buildLabelPDF = async (labelOrders) => {
    // Load libraries
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

      // สร้าง HTML label
      const div = document.createElement('div')
      div.innerHTML = labelHTML(labelOrders[i], i+1, labelOrders.length)
      container.appendChild(div)

      // Barcode + QR
      const pno = labelOrders[i].flash_pno || ''
      try { JsBarcode('#lbc-' + (i+1), pno, { format:'CODE128', width:1.8, height:34, displayValue:false, margin:0 }) } catch(e) {}
      try { new QRCode(document.getElementById('lqr-' + (i+1)), { text:pno, width:58, height:58, correctLevel: QRCode.CorrectLevel.M }) } catch(e) {}

      // รอ render
      await new Promise(r => setTimeout(r, 200))

      // Capture เป็นรูป
      const canvas = await html2canvas(div.firstChild, { scale: 3, backgroundColor: '#ffffff', useCORS: true })
      const imgData = canvas.toDataURL('image/png')

      // ใส่ใน PDF — พอดี 100x75mm
      doc.addImage(imgData, 'PNG', 0, 0, 100, 75)

      container.removeChild(div)
    }

    document.body.removeChild(container)

    // เปิด PDF
    const blob = doc.output('blob')
    window.open(URL.createObjectURL(blob), '_blank')
    flash(`✅ สร้างใบปะหน้า ${labelOrders.length} รายการสำเร็จ`)
  }


  // ═══ Flash Proxy URL ═══
  const [flashProxyUrl, setFlashProxyUrl] = useState(() => {
    try { return localStorage.getItem('flash_proxy_url') || '' } catch { return '' }
  })
  const saveFlashProxyUrl = (url) => {
    try { localStorage.setItem('flash_proxy_url', url) } catch {}
    setFlashProxyUrl(url)
    flash('✅ บันทึก Flash URL สำเร็จ')
  }
  const testFlashConnection = async () => {
    flash('⏳ ทดสอบการเชื่อมต่อ...')
    const result = await pingFlash()
    if (result.code === 1) {
      flash('✅ เชื่อมต่อ Flash สำเร็จ! ENV: ' + (result.env || '-') + ' | mchId: ' + (result.mchId || '-'))
    } else {
      flash('❌ เชื่อมต่อไม่สำเร็จ: ' + (result.message || 'Unknown'))
    }
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

    // Realtime — profiles + teams
    const ch2 = supabase.channel('mgr-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mt_profiles' },
        () => { supabase.from('mt_profiles').select('*, mt_teams(name)').then(({ data }) => { if (data) setProfiles(data) }) }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mt_teams' },
        () => { supabase.from('mt_teams').select('*').order('name').then(({ data }) => { if (data) setTeams(data) }) }
      )
      .subscribe()

    return () => { supabase.removeChannel(ch); supabase.removeChannel(ch2) }
  }, [])
  // ═══ Stats ═══
  const today = useMemo(() => orders.filter(o => sameDay(o.created_at, new Date())), [orders])
  const todaySum = useMemo(() => today.reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0), [today])
  const weekSum = useMemo(() => orders.filter(o => withinDays(o.created_at, 7)).reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0), [orders])
  const monthSum = useMemo(() => orders.filter(o => thisMonth(o.created_at)).reduce((s, o) => s + (parseFloat(o.sale_price) || 0), 0), [orders])

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
      <style>{`
        @media (min-width: 768px) {
          .mt-content { max-width: 1400px; margin: 0 auto; padding: 24px 40px !important; }
          .mt-tabs { max-width: 1400px; margin: 0 auto; padding: 20px 40px 0 !important; }
          .mt-header { padding: 16px 40px !important; }
          .mt-content table { font-size: 13px !important; }
          .mt-content table th { padding: 12px 10px !important; font-size: 12px !important; }
          .mt-content table td { padding: 12px 10px !important; }
        }
        @media (min-width: 1200px) {
          .mt-content { max-width: 1600px; padding: 24px 48px !important; }
          .mt-tabs { max-width: 1600px; padding: 20px 48px 0 !important; }
          .mt-header { padding: 16px 48px !important; }
        }
      `}</style>
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
            <div style={{ fontWeight: 700, color: T.danger, marginBottom: 6 }}>❌ ไม่สำเร็จ</div>
            <div style={{ fontSize: 13, color: T.textDim, marginBottom: 8 }}>{flashModal.error}</div>
            {flashModal.debugInfo && <details style={{ fontSize: 11 }}>
              <summary style={{ cursor: 'pointer', color: '#7F8C8D', fontWeight: 600, marginBottom: 6 }}>🔍 ดูข้อมูลที่ส่งไป Flash (Debug)</summary>
              <div style={{ background: '#F8F9FA', padding: 10, borderRadius: 6, maxHeight: 250, overflowY: 'auto' }}>
                <pre style={{ margin: 0, fontSize: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#2C3E50' }}>{JSON.stringify(flashModal.debugInfo, null, 2)}</pre>
              </div>
            </details>}
            {flashModal.fullResponse && <details style={{ fontSize: 11, marginTop: 6 }}>
              <summary style={{ cursor: 'pointer', color: '#7F8C8D', fontWeight: 600, marginBottom: 6 }}>📋 Flash Response</summary>
              <div style={{ background: '#F8F9FA', padding: 10, borderRadius: 6, maxHeight: 250, overflowY: 'auto' }}>
                <pre style={{ margin: 0, fontSize: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#2C3E50' }}>{JSON.stringify(flashModal.fullResponse, null, 2)}</pre>
              </div>
            </details>}
          </div>}
          {flashModal.tracking && <div>
            {/* Header: PNO + State Badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: T.textDim, marginBottom: 2 }}>หมายเลขพัสดุ</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 16, letterSpacing: 1 }}>{flashModal.pno}</div>
              </div>
              {flashModal.trackState && <div style={{
                padding: '6px 14px', borderRadius: 20, fontWeight: 700, fontSize: 11,
                background: flashModal.trackState >= 5 ? 'linear-gradient(135deg, #2D8A4E, #27AE60)' : flashModal.trackState >= 3 ? 'linear-gradient(135deg, #2980B9, #3498DB)' : 'linear-gradient(135deg, #F39C12, #F1C40F)',
                color: '#fff'
              }}>{flashModal.trackStateText || ['','สร้างออเดอร์','รับพัสดุแล้ว','ศูนย์คัดแยก','กำลังจัดส่ง','เซ็นรับแล้ว'][flashModal.trackState] || `สถานะ ${flashModal.trackState}`}</div>}
            </div>
            {/* Progress Bar */}
            {flashModal.trackState && <div style={{ display: 'flex', gap: 3, marginBottom: 16 }}>
              {[1,2,3,4,5].map(s => (
                <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= flashModal.trackState ? (flashModal.trackState >= 5 ? '#2D8A4E' : flashModal.trackState >= 3 ? '#2980B9' : '#F39C12') : T.border }} />
              ))}
            </div>}
            {/* Timeline */}
            {Array.isArray(flashModal.tracking) && flashModal.tracking.length > 0 ? flashModal.tracking.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 20 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: i === 0 ? T.gold : T.border, border: i === 0 ? `2px solid ${T.gold}` : `2px solid ${T.border}`, flexShrink: 0 }} />
                  {i < flashModal.tracking.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 20, background: T.border }} />}
                </div>
                <div style={{ paddingBottom: 14 }}>
                  <div style={{ fontWeight: i === 0 ? 700 : 500, fontSize: 12, color: i === 0 ? T.text : T.textDim }}>{r.message}</div>
                  <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{r.routedAt ? new Date(r.routedAt * 1000).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : ''}</div>
                </div>
              </div>
            )) : <div style={{ fontSize: 13, color: T.textDim, textAlign: 'center', padding: 20 }}>ไม่พบข้อมูลการติดตาม</div>}
          </div>}
          {/* Bulk Create Results */}
          {flashModal.bulkResults && <div>
            <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>📦 ผลการสร้างเลขพัสดุ ({flashModal.bulkResults.filter(r=>r.ok).length}/{flashModal.bulkResults.length})</div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {flashModal.bulkResults.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', marginBottom: 4, borderRadius: 6, background: r.ok ? 'rgba(45,138,78,0.05)' : 'rgba(214,48,49,0.05)', border: `1px solid ${r.ok ? 'rgba(45,138,78,0.15)' : 'rgba(214,48,49,0.15)'}` }}>
                  <span style={{ fontSize: 14 }}>{r.ok ? '✅' : '❌'}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{r.name}</span>
                  {r.pno && <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#2980B9', fontWeight: 700 }}>{r.pno}</span>}
                  {r.error && <span style={{ fontSize: 11, color: T.danger }}>{r.error}</span>}
                  {r.debug && <details style={{ width: '100%', marginTop: 4 }}><summary style={{ fontSize: 10, color: '#7F8C8D', cursor: 'pointer' }}>debug</summary><pre style={{ fontSize: 9, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(r.debug, null, 2)}</pre></details>}
                </div>
              ))}
            </div>
            {(() => { const pnos = flashModal.bulkResults.filter(r => r.ok && r.pno).map(r => r.pno); return pnos.length > 0 && (
              <button onClick={() => bulkPrintLabels(pnos)} style={{ width: '100%', marginTop: 12, padding: '12px 20px', borderRadius: 8, border: 'none', background: '#E67E22', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: T.font }}>🖨 ปริ้นใบปะหน้าทั้งหมด ({pnos.length} รายการ)</button>
            ) })()}
          </div>}
        </>}
      </Modal>

      {/* Flash Sender Info Modal */}
      <Modal show={showFlashSrc} onClose={() => setShowFlashSrc(false)} title="⚙️ ตั้งค่า Flash Express">
        {/* API URL */}
        <div style={{ padding: 12, borderRadius: T.radiusSm, background: 'rgba(255,107,0,0.04)', border: '1px solid rgba(255,107,0,0.15)', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#FF6B00', marginBottom: 8 }}>⚡ เชื่อมต่อ Flash API</div>
          <FI label="Flash Proxy URL (Cloudflare / Apps Script)" value={flashProxyUrl} onChange={e => setFlashProxyUrl(e.target.value)} placeholder="https://flash-proxy.xxx.workers.dev" />
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn full onClick={() => saveFlashProxyUrl(flashProxyUrl)} grad={T.grad2}>💾 บันทึก URL</Btn>
            <Btn full outline onClick={testFlashConnection}>🔌 ทดสอบ</Btn>
          </div>
        </div>
        {/* ข้อมูลผู้ส่ง */}
        <div style={{ fontSize: 12, fontWeight: 700, color: T.textDim, marginBottom: 8 }}>📍 ข้อมูลผู้ส่ง</div>
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
        <Btn full onClick={() => saveFlashSrc(flashSrcInfo)} grad={T.grad2}>💾 บันทึกข้อมูลผู้ส่ง</Btn>
      </Modal>

      {/* Tracking Number Modal — สร้าง / แก้ไข / ลบ เลขพัสดุ */}
      <Modal show={!!pnoModal} onClose={() => { setPnoModal(null); setPnoInput('') }} title={pnoModal?.pno ? '✏️ แก้ไขเลขพัสดุ' : '📦 สร้างเลขพัสดุ'}>
        {pnoModal && <>
          <div style={{ fontSize: 13, color: T.textDim, marginBottom: 12 }}>ลูกค้า: <strong style={{ color: T.text }}>{pnoModal.customerName}</strong></div>
          <FI label="เลขพัสดุ / Tracking Number" value={pnoInput} onChange={e => setPnoInput(e.target.value)} placeholder="เช่น TH123456789, FLASH-001, ..." />
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn full onClick={savePno} grad={T.grad2}>{pnoModal.pno ? '💾 บันทึก' : '✅ สร้าง'}</Btn>
            <Btn full outline onClick={() => { setPnoModal(null); setPnoInput('') }}>ยกเลิก</Btn>
          </div>
          {pnoModal.pno && <button onClick={() => { deletePno(pnoModal.orderId); setPnoModal(null); setPnoInput('') }} style={{ width: '100%', marginTop: 12, padding: 12, borderRadius: T.radiusSm, border: '1px solid rgba(214,48,49,0.2)', background: 'rgba(214,48,49,0.04)', color: T.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: T.font }}>🗑 ลบเลขพัสดุ</button>}
        </>}
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

      {/* Export History Modal */}
      <Modal show={showExportLogs} onClose={() => setShowExportLogs(false)} title="📜 ประวัติการ Export">
        {exportLogs.length === 0 ? <div style={{ textAlign: 'center', padding: 20, color: T.textDim }}>ยังไม่มีประวัติ</div> : (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: T.font }}>
              <thead>
                <tr style={{ background: T.surfaceAlt, position: 'sticky', top: 0 }}>
                  <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 600, color: T.textDim }}>วันเวลา</th>
                  <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 600, color: T.textDim }}>ผู้ Export</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: T.textDim }}>ประเภท</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: T.textDim }}>จำนวน</th>
                  <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 600, color: T.textDim }}>ไฟล์</th>
                </tr>
              </thead>
              <tbody>
                {exportLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: '8px 6px', fontSize: 11, color: T.textDim }}>{new Date(log.created_at).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ padding: '8px 6px', fontWeight: 600 }}>{log.user_name}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: log.export_type === 'Excel' ? 'rgba(45,138,78,0.1)' : 'rgba(184,134,11,0.1)', color: log.export_type === 'Excel' ? T.success : T.gold }}>{log.export_type}</span>
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 700, color: T.gold }}>{log.record_count}</td>
                    <td style={{ padding: '8px 6px', fontSize: 10, color: T.textDim }}>{log.file_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Header */}
      <div className="mt-header" style={{ ...glass, borderRadius: 0, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.95)', borderBottom: `1px solid ${T.border}` }}>
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

      <div className="mt-tabs" style={{ padding: '16px 16px 0' }}>
        <Tabs items={[{ id: 'dashboard', label: '📈 ภาพรวม' }, { id: 'create', label: '➕ สร้าง' }, { id: 'orders', label: '📋 รายงาน' }, ...(profile.role === 'manager' ? [{ id: 'shipping', label: '🚚 การจัดส่ง' }] : []), { id: 'teams', label: '👥 ทีม' }, { id: 'users', label: '🧑‍💼 ผู้ใช้' }]} active={tab} onChange={setTab} />
      </div>

      <div className="mt-content" style={{ padding: 16 }}>
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
            return { ...p, team: p.mt_teams?.name || (p.role === 'manager' ? '🏢 หัวหน้า' : p.role === 'admin' ? '🔑 แอดมิน' : p.role === 'packer' ? '📦 แพค' : '—'), todayCount: pToday.length, todaySales: pToday.reduce((s,o) => s+(parseFloat(o.sale_price)||0), 0), monthCount: pMonth.length, monthSales: pMonth.reduce((s,o) => s+(parseFloat(o.sale_price)||0), 0) }
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
            const od = (o.order_date||'').substring(0,10)
            if (dateFilter && od < dateFilter) return false
            if (dateFilterEnd && od > dateFilterEnd) return false
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
            {/* ปุ่มเลือกช่วงเวลา */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
              {[
                { id: 'today', label: 'วันนี้', fn: () => { setDateFilter(todayStr); setDateFilterEnd(todayStr); setQuickFilter('today') } },
                { id: 'yesterday', label: 'เมื่อวาน', fn: () => { const y = new Date(); y.setDate(y.getDate()-1); const ys = y.toISOString().split('T')[0]; setDateFilter(ys); setDateFilterEnd(ys); setQuickFilter('yesterday') } },
                { id: 'month', label: 'เดือนนี้', fn: () => { const d = new Date(); setDateFilter(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01'); setDateFilterEnd(todayStr); setQuickFilter('month') } },
                { id: 'prevMonth', label: 'เดือนก่อน', fn: () => { const d = new Date(); d.setMonth(d.getMonth()-1); const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'); setDateFilter(`${y}-${m}-01`); const last = new Date(y, d.getMonth()+1, 0); setDateFilterEnd(`${y}-${m}-${String(last.getDate()).padStart(2,'0')}`); setQuickFilter('prevMonth') } },
                { id: 'all', label: 'ทั้งหมด', fn: () => { setDateFilter(''); setDateFilterEnd(''); setQuickFilter('all') } },
              ].map(b => (
                <button key={b.id} onClick={b.fn} style={{ padding: '6px 14px', borderRadius: 8, border: quickFilter === b.id ? 'none' : `1px solid ${T.border}`, background: quickFilter === b.id ? 'linear-gradient(135deg, #B8860B, #DAA520)' : '#fff', color: quickFilter === b.id ? '#fff' : T.gold, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: T.font, boxShadow: quickFilter === b.id ? '0 2px 8px rgba(184,134,11,0.3)' : 'none' }}>{b.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input type="date" value={dateFilter} onChange={e => { setDateFilter(e.target.value); if (!dateFilterEnd || e.target.value > dateFilterEnd) setDateFilterEnd(e.target.value); setQuickFilter('') }}
                style={{ flex: 1, padding: '8px 10px', borderRadius: T.radiusSm, background: T.surfaceAlt, border: `1px solid ${T.border}`, color: T.text, fontSize: 12, fontFamily: T.font, outline: 'none' }} />
              <span style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: T.textDim }}>ถึง</span>
              <input type="date" value={dateFilterEnd} onChange={e => { setDateFilterEnd(e.target.value); setQuickFilter('') }}
                style={{ flex: 1, padding: '8px 10px', borderRadius: T.radiusSm, background: T.surfaceAlt, border: `1px solid ${T.border}`, color: T.text, fontSize: 12, fontFamily: T.font, outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={userFilter} onChange={e => setUserFilter(e.target.value)}
                style={{ flex: 1, padding: '8px 10px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 12, fontFamily: T.font, outline: 'none' }}>
                <option value="">ทุกคน</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
              {(dateFilter || userFilter || searchQuery) && <button onClick={() => { setDateFilter(todayStr); setDateFilterEnd(todayStr); setUserFilter(''); setSearchQuery(''); setQuickFilter('today') }}
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
            {/* ปุ่ม Export */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { exportProshipCSV(filtered, 'Orders_' + (dateFilter||'all') + '.csv', profile, dateFilter + '~' + dateFilterEnd); flash('✅ Export CSV สำเร็จ!') }} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(45,138,78,0.2)', background: 'rgba(45,138,78,0.05)', color: T.success, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: T.font }}>📥 CSV ({filtered.length})</button>
              <button onClick={() => { exportProshipExcel(filtered, 'Orders_' + (dateFilter||'all') + '.xlsx', profile, dateFilter + '~' + dateFilterEnd).then(() => flash('✅ Export Excel สำเร็จ!')) }} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(45,138,78,0.2)', background: 'rgba(45,138,78,0.05)', color: T.success, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: T.font }}>📊 Excel ({filtered.length})</button>
              <button onClick={loadExportLogs} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${T.border}`, background: '#fff', color: T.textDim, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: T.font }}>📜 ประวัติ</button>
            </div>
          </div>

          {/* จัดอันดับเพจขายดี */}
          <div style={{ ...glass, padding: 14, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>🏆 เพจขายดี</div>
            {(() => {
              const pageMap = {}
              filtered.forEach(o => {
                const page = o.sales_channel || '—'
                if (!pageMap[page]) pageMap[page] = { count: 0, sales: 0 }
                pageMap[page].count++
                pageMap[page].sales += parseFloat(o.sale_price) || 0
              })
              const pageRank = Object.entries(pageMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.count - a.count)
              return <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: T.font }}>
                <thead>
                  <tr style={{ background: T.surfaceAlt }}>
                    <th style={{ padding: '6px', textAlign: 'center', fontWeight: 600, color: T.textDim, width: 30 }}>#</th>
                    <th style={{ padding: '6px', textAlign: 'left', fontWeight: 600, color: T.textDim }}>ชื่อเพจ</th>
                    <th style={{ padding: '6px', textAlign: 'center', fontWeight: 600, color: T.textDim }}>จำนวน</th>
                    <th style={{ padding: '6px', textAlign: 'right', fontWeight: 600, color: T.textDim }}>ยอดขาย</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRank.map((p, i) => (
                    <tr key={p.name} style={{ borderBottom: `1px solid ${T.border}`, background: i < 3 ? 'rgba(184,134,11,0.03)' : 'transparent' }}>
                      <td style={{ padding: '6px', textAlign: 'center', fontWeight: 800, color: i < 3 ? T.gold : T.textDim }}>{i + 1}</td>
                      <td style={{ padding: '6px', fontWeight: 600 }}>{p.name}</td>
                      <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700, color: T.gold }}>{p.count}</td>
                      <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, color: T.success }}>฿{fmt(p.sales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            })()}
          </div>

          {/* จัดอันดับโปรขายดี */}
          <div style={{ ...glass, padding: 14, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>🎯 โปรขายดี</div>
            {(() => {
              const promoMap = {}
              filtered.forEach(o => {
                const promo = o.remark || '—'
                if (!promoMap[promo]) promoMap[promo] = { count: 0, sales: 0 }
                promoMap[promo].count++
                promoMap[promo].sales += parseFloat(o.sale_price) || 0
              })
              const promoRank = Object.entries(promoMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.count - a.count)
              return <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: T.font }}>
                <thead>
                  <tr style={{ background: T.surfaceAlt }}>
                    <th style={{ padding: '6px', textAlign: 'center', fontWeight: 600, color: T.textDim, width: 30 }}>#</th>
                    <th style={{ padding: '6px', textAlign: 'left', fontWeight: 600, color: T.textDim }}>โปร/สินค้า</th>
                    <th style={{ padding: '6px', textAlign: 'center', fontWeight: 600, color: T.textDim }}>จำนวน</th>
                    <th style={{ padding: '6px', textAlign: 'right', fontWeight: 600, color: T.textDim }}>ยอดขาย</th>
                  </tr>
                </thead>
                <tbody>
                  {promoRank.map((p, i) => (
                    <tr key={p.name} style={{ borderBottom: `1px solid ${T.border}`, background: i < 3 ? 'rgba(184,134,11,0.03)' : 'transparent' }}>
                      <td style={{ padding: '6px', textAlign: 'center', fontWeight: 800, color: i < 3 ? T.gold : T.textDim }}>{i + 1}</td>
                      <td style={{ padding: '6px', fontWeight: 600 }}>{p.name}</td>
                      <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700, color: T.gold }}>{p.count}</td>
                      <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, color: T.success }}>฿{fmt(p.sales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            })()}
          </div>

          {/* แจกแจงรายวัน */}
          {filtered.length > 0 && (() => {
            const dayMap = {}
            filtered.forEach(o => {
              const d = (o.order_date||'').substring(0,10)
              if (!d) return
              if (!dayMap[d]) dayMap[d] = { count: 0, sales: 0, cod: 0, codAmt: 0, trans: 0, transAmt: 0 }
              dayMap[d].count++
              dayMap[d].sales += parseFloat(o.sale_price) || 0
              if (o.payment_type === 'transfer') { dayMap[d].trans++; dayMap[d].transAmt += parseFloat(o.sale_price) || 0 }
              else { dayMap[d].cod++; dayMap[d].codAmt += parseFloat(o.cod_amount) || 0 }
            })
            const dayList = Object.entries(dayMap).sort((a,b) => b[0].localeCompare(a[0]))
            const totalCount = dayList.reduce((s,d) => s+d[1].count, 0)
            const totalSales = dayList.reduce((s,d) => s+d[1].sales, 0)
            return <div style={{ ...glass, padding: 14, marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>📅 แจกแจงรายวัน ({dayList.length} วัน)</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: T.font }}>
                <thead>
                  <tr style={{ background: T.surfaceAlt }}>
                    <th style={{ padding: '6px', textAlign: 'left', fontWeight: 600, color: T.textDim }}>วันที่</th>
                    <th style={{ padding: '6px', textAlign: 'center', fontWeight: 600, color: T.textDim }}>ออเดอร์</th>
                    <th style={{ padding: '6px', textAlign: 'right', fontWeight: 600, color: T.textDim }}>ยอดขาย</th>
                    <th style={{ padding: '6px', textAlign: 'center', fontWeight: 600, color: T.textDim }}>📦 COD</th>
                    <th style={{ padding: '6px', textAlign: 'right', fontWeight: 600, color: T.textDim }}>ยอด COD</th>
                    <th style={{ padding: '6px', textAlign: 'center', fontWeight: 600, color: T.textDim }}>🏦 โอน</th>
                    <th style={{ padding: '6px', textAlign: 'right', fontWeight: 600, color: T.textDim }}>ยอดโอน</th>
                  </tr>
                </thead>
                <tbody>
                  {dayList.map(([d, v]) => {
                    const dt = new Date(d)
                    const dayName = dt.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })
                    return <tr key={d} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: '6px', fontWeight: 600 }}>{dayName}</td>
                      <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700, color: T.gold }}>{v.count}</td>
                      <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, color: T.success }}>฿{fmt(v.sales)}</td>
                      <td style={{ padding: '6px', textAlign: 'center', color: T.gold }}>{v.cod}</td>
                      <td style={{ padding: '6px', textAlign: 'right', color: T.gold }}>฿{fmt(v.codAmt)}</td>
                      <td style={{ padding: '6px', textAlign: 'center', color: T.success }}>{v.trans}</td>
                      <td style={{ padding: '6px', textAlign: 'right', color: T.success }}>฿{fmt(v.transAmt)}</td>
                    </tr>
                  })}
                  <tr style={{ background: 'rgba(184,134,11,0.05)' }}>
                    <td style={{ padding: '6px', fontWeight: 800 }}>รวม</td>
                    <td style={{ padding: '6px', textAlign: 'center', fontWeight: 800, color: T.gold }}>{totalCount}</td>
                    <td style={{ padding: '6px', textAlign: 'right', fontWeight: 800, color: T.success }}>฿{fmt(totalSales)}</td>
                    <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700, color: T.gold }}>{dayList.reduce((s,d)=>s+d[1].cod,0)}</td>
                    <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, color: T.gold }}>฿{fmt(dayList.reduce((s,d)=>s+d[1].codAmt,0))}</td>
                    <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700, color: T.success }}>{dayList.reduce((s,d)=>s+d[1].trans,0)}</td>
                    <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, color: T.success }}>฿{fmt(dayList.reduce((s,d)=>s+d[1].transAmt,0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          })()}

          {/* แจกแจงรายคน */}
          {filtered.length > 0 && (() => {
            const empMap = {}
            filtered.forEach(o => {
              const eid = o.employee_id || '__none'
              const ename = o.employee_name || '—'
              if (!empMap[eid]) empMap[eid] = { name: ename, count: 0, sales: 0, cod: 0, codAmt: 0, trans: 0, transAmt: 0 }
              empMap[eid].count++
              empMap[eid].sales += parseFloat(o.sale_price) || 0
              if (o.payment_type === 'transfer') { empMap[eid].trans++; empMap[eid].transAmt += parseFloat(o.sale_price) || 0 }
              else { empMap[eid].cod++; empMap[eid].codAmt += parseFloat(o.cod_amount) || 0 }
            })
            const empList = Object.values(empMap).sort((a, b) => b.count - a.count)
            return <div style={{ ...glass, padding: 14, marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>👤 แจกแจงรายคน ({empList.length} คน)</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: T.font }}>
                <thead>
                  <tr style={{ background: T.surfaceAlt }}>
                    <th style={{ padding: '6px', textAlign: 'center', fontWeight: 600, color: T.textDim, width: 30 }}>#</th>
                    <th style={{ padding: '6px', textAlign: 'left', fontWeight: 600, color: T.textDim }}>พนักงาน</th>
                    <th style={{ padding: '6px', textAlign: 'center', fontWeight: 600, color: T.textDim }}>ออเดอร์</th>
                    <th style={{ padding: '6px', textAlign: 'right', fontWeight: 600, color: T.textDim }}>ยอดขาย</th>
                    <th style={{ padding: '6px', textAlign: 'center', fontWeight: 600, color: T.textDim }}>📦 COD</th>
                    <th style={{ padding: '6px', textAlign: 'right', fontWeight: 600, color: T.textDim }}>ยอด COD</th>
                    <th style={{ padding: '6px', textAlign: 'center', fontWeight: 600, color: T.textDim }}>🏦 โอน</th>
                    <th style={{ padding: '6px', textAlign: 'right', fontWeight: 600, color: T.textDim }}>ยอดโอน</th>
                  </tr>
                </thead>
                <tbody>
                  {empList.map((e, i) => (
                    <tr key={e.name+i} style={{ borderBottom: `1px solid ${T.border}`, background: i < 3 ? 'rgba(184,134,11,0.03)' : 'transparent' }}>
                      <td style={{ padding: '6px', textAlign: 'center', fontWeight: 800, color: i < 3 ? T.gold : T.textDim }}>{i + 1}</td>
                      <td style={{ padding: '6px', fontWeight: 600 }}>{e.name}</td>
                      <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700, color: T.gold }}>{e.count}</td>
                      <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, color: T.success }}>฿{fmt(e.sales)}</td>
                      <td style={{ padding: '6px', textAlign: 'center', color: T.gold }}>{e.cod}</td>
                      <td style={{ padding: '6px', textAlign: 'right', color: T.gold }}>฿{fmt(e.codAmt)}</td>
                      <td style={{ padding: '6px', textAlign: 'center', color: T.success }}>{e.trans}</td>
                      <td style={{ padding: '6px', textAlign: 'right', color: T.success }}>฿{fmt(e.transAmt)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: 'rgba(184,134,11,0.05)' }}>
                    <td colSpan="2" style={{ padding: '6px', fontWeight: 800 }}>รวม</td>
                    <td style={{ padding: '6px', textAlign: 'center', fontWeight: 800, color: T.gold }}>{empList.reduce((s,e)=>s+e.count,0)}</td>
                    <td style={{ padding: '6px', textAlign: 'right', fontWeight: 800, color: T.success }}>฿{fmt(empList.reduce((s,e)=>s+e.sales,0))}</td>
                    <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700, color: T.gold }}>{empList.reduce((s,e)=>s+e.cod,0)}</td>
                    <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, color: T.gold }}>฿{fmt(empList.reduce((s,e)=>s+e.codAmt,0))}</td>
                    <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700, color: T.success }}>{empList.reduce((s,e)=>s+e.trans,0)}</td>
                    <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, color: T.success }}>฿{fmt(empList.reduce((s,e)=>s+e.transAmt,0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          })()}

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
                {filtered.slice((currentPage-1)*pageSize, currentPage*pageSize).map((o, i) => (
                  <tr key={o.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: '8px 6px', fontWeight: 700, color: T.gold }}>{o.daily_seq || (currentPage-1)*pageSize+i+1}</td>
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
            <Pagination total={filtered.length} page={currentPage} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={setPageSize} />
          </div>
        </>
        })()}

        {/* ══ SHIPPING ══ */}
        {tab === 'shipping' && (() => {
          const allShipOrders = orders.filter(o => {
            // กรองตามวันที่
            if (dateFilter) { const od = (o.order_date||'').substring(0,10); if (od < dateFilter) return false }
            if (dateFilterEnd) { const od = (o.order_date||'').substring(0,10); if (od > dateFilterEnd) return false }
            return true
          })
          const shipOrders = allShipOrders.filter(o => {
            if (shipFilter === 'preparing') return (!o.shipping_status || o.shipping_status === 'waiting') && !o.flash_pno
            if (shipFilter === 'ready') return o.shipping_status === 'printed' && !o.flash_pno
            if (shipFilter === 'insystem') return !!o.flash_pno
            if (shipFilter === 'printed') return o.shipping_status === 'printed'
            if (shipFilter === 'waiting') return !o.shipping_status || o.shipping_status === 'waiting'
            return true
          }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          const waitingCount = allShipOrders.filter(o => !o.shipping_status || o.shipping_status === 'waiting').length
          const printedCount = allShipOrders.filter(o => o.shipping_status === 'printed').length

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

          const exportShip = (type) => {
            const rows = shipOrders.filter(o => {
              if (!searchQuery) return true
              const q = searchQuery.toLowerCase()
              return (o.customer_name||'').toLowerCase().includes(q) || (o.customer_phone||'').includes(q) || (o.employee_name||'').toLowerCase().includes(q) || (o.flash_pno||'').toLowerCase().includes(q)
            })
            if (type === 'csv') { exportProshipCSV(rows, 'Orders_' + (dateFilter||'all') + '.csv', profile, 'shipping'); flash('✅ Export CSV สำเร็จ!') }
            else { exportProshipExcel(rows, 'Orders_' + (dateFilter||'all') + '.xlsx', profile, 'shipping').then(() => flash('✅ Export Excel สำเร็จ!')) }
          }

          return <>
          {/* ═══ PROSHIP-STYLE SHIPPING UI ═══ */}
          <div style={{ fontFamily: T.font }}>
            {/* Header */}
            <div style={{ fontSize: 20, fontWeight: 700, color: '#2C3E50', marginBottom: 16 }}>ทั้งหมด การจัดส่ง</div>

            {/* Top Controls */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="date" value={dateFilter} onChange={e => { setDateFilter(e.target.value); if (!dateFilterEnd || e.target.value > dateFilterEnd) setDateFilterEnd(e.target.value); setQuickFilter('') }}
                  style={{ padding: '8px 10px', borderRadius: 6, background: '#fff', border: '1px solid #D5D8DC', color: '#2C3E50', fontSize: 12, fontFamily: T.font, outline: 'none' }} />
                <span style={{ color: '#ABB2B9' }}>—</span>
                <input type="date" value={dateFilterEnd} onChange={e => { setDateFilterEnd(e.target.value); setQuickFilter('') }}
                  style={{ padding: '8px 10px', borderRadius: 6, background: '#fff', border: '1px solid #D5D8DC', color: '#2C3E50', fontSize: 12, fontFamily: T.font, outline: 'none' }} />
                {[{ id: 'today', label: 'วันนี้' }, { id: '7days', label: '7 วัน' }, { id: 'month', label: 'เดือนนี้' }].map(b => (
                  <button key={b.id} onClick={() => {
                    if (b.id === 'today') { setDateFilter(todayStr); setDateFilterEnd(todayStr) }
                    else if (b.id === '7days') { const d = new Date(); d.setDate(d.getDate()-6); setDateFilter(d.toISOString().split('T')[0]); setDateFilterEnd(todayStr) }
                    else { const d = new Date(); setDateFilter(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01'); setDateFilterEnd(todayStr) }
                    setQuickFilter(b.id)
                  }} style={{ padding: '7px 16px', borderRadius: 6, border: quickFilter === b.id ? '1px solid #3498DB' : '1px solid #D5D8DC', background: quickFilter === b.id ? '#3498DB' : '#fff', color: quickFilter === b.id ? '#fff' : '#5D6D7E', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: T.font }}>{b.label}</button>
                ))}
              </div>
              <div style={{ flex: 1 }} />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="ค้นหาชื่อ เบอร์ เลขพัสดุ..."
                style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #D5D8DC', background: '#fff', color: '#2C3E50', fontSize: 12, fontFamily: T.font, outline: 'none', width: 220, boxSizing: 'border-box' }} />
              <button onClick={() => setShowFlashSrc(true)} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #D5D8DC', background: '#fff', color: '#5D6D7E', fontSize: 13, cursor: 'pointer', fontFamily: T.font }}>⚙️</button>
              <button onClick={() => exportShip('excel')} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #27AE60', background: '#EAFAF1', color: '#27AE60', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: T.font }}>📊 Excel</button>
              <button onClick={() => exportShip('csv')} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #D5D8DC', background: '#fff', color: '#5D6D7E', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: T.font }}>📥 CSV</button>
              {(() => { const p = shipOrders.filter(o => o.flash_pno); return p.length > 0 && <button onClick={() => notifyCourier(p.map(o => o.flash_pno))} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#27AE60', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: T.font, whiteSpace: 'nowrap' }}>📞 เรียกรับพัสดุ</button> })()}
            </div>

            {/* Status Filter Bar — Proship Style */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #EAECEE', marginBottom: 16, overflowX: 'auto' }}>
              {(() => {
                const preparing = allShipOrders.filter(o => (!o.shipping_status || o.shipping_status === 'waiting') && !o.flash_pno)
                const readyShip = allShipOrders.filter(o => (o.shipping_status === 'printed' || o.flash_pno) && o.flash_status !== 'created')
                const inSystem = allShipOrders.filter(o => o.flash_pno && (o.flash_status === 'created' || o.flash_status === 'manual'))
                const allPrinted = allShipOrders.filter(o => o.shipping_status === 'printed')
                const filters = [
                  { id: 'all', icon: '📦', label: 'ทั้งหมด', count: allShipOrders.length, color: '#2980B9' },
                  { id: 'preparing', icon: '🚚', label: 'เตรียมส่ง', count: preparing.length, color: '#E67E22' },
                  { id: 'ready', icon: '✅', label: 'พร้อมส่ง', count: readyShip.length, color: '#27AE60' },
                  { id: 'insystem', icon: '📥', label: 'รับเข้าระบบ', count: inSystem.length, color: '#2980B9' },
                  { id: 'printed', icon: '🖨', label: 'ปริ้นแล้ว', count: allPrinted.length, color: '#16A085' },
                ]
                return filters.map(f => (
                  <button key={f.id} onClick={() => setShipFilter(f.id)} style={{
                    padding: '10px 18px', border: 'none', cursor: 'pointer', fontFamily: T.font, fontSize: 12, fontWeight: 500,
                    background: 'transparent', color: shipFilter === f.id ? f.color : '#85929E',
                    borderBottom: shipFilter === f.id ? `3px solid ${f.color}` : '3px solid transparent',
                    marginBottom: -2, whiteSpace: 'nowrap', transition: 'all 0.15s'
                  }}>
                    <span style={{ marginRight: 4 }}>{f.icon}</span>
                    {f.label} <strong style={{ marginLeft: 4, color: shipFilter === f.id ? f.color : '#ABB2B9' }}>{f.count}</strong>
                  </button>
                ))
              })()}
            </div>

            {/* Bulk Action Bar */}
            {shipSelected.size > 0 && (
              <div style={{ padding: '10px 16px', background: '#EBF5FB', border: '1px solid #AED6F1', borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#2980B9' }}>✓ เลือก {shipSelected.size} รายการ</span>
                <div style={{ flex: 1 }} />
                {/* เปลี่ยนสถานะ */}
                <button onClick={() => {
                  const ids = [...shipSelected]
                  if (!confirm(`เปลี่ยนสถานะ ${ids.length} รายการ เป็น "เตรียมส่ง"?`)) return
                  supabase.from('mt_orders').update({ shipping_status: 'waiting' }).in('id', ids).then(({ error }) => {
                    if (error) { flash('❌ ' + error.message); return }
                    setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, shipping_status: 'waiting' } : o))
                    flash('✅ เปลี่ยนสถานะ ' + ids.length + ' รายการ'); setShipSelected(new Set())
                  })
                }} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #E67E22', background: '#FEF5E7', color: '#E67E22', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: T.font }}>🚚 เตรียมส่ง</button>
                <button onClick={() => {
                  const ids = [...shipSelected]
                  if (!confirm(`เปลี่ยนสถานะ ${ids.length} รายการ เป็น "พร้อมส่ง"?`)) return
                  supabase.from('mt_orders').update({ shipping_status: 'printed' }).in('id', ids).then(({ error }) => {
                    if (error) { flash('❌ ' + error.message); return }
                    setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, shipping_status: 'printed' } : o))
                    flash('✅ เปลี่ยนสถานะ ' + ids.length + ' รายการ'); setShipSelected(new Set())
                  })
                }} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #27AE60', background: '#EAFAF1', color: '#27AE60', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: T.font }}>✅ พร้อมส่ง</button>
                <button onClick={() => {
                  const ids = [...shipSelected]
                  if (!confirm(`เปลี่ยนสถานะ ${ids.length} รายการ เป็น "ปริ้นแล้ว"?`)) return
                  supabase.from('mt_orders').update({ shipping_status: 'printed' }).in('id', ids).then(({ error }) => {
                    if (error) { flash('❌ ' + error.message); return }
                    setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, shipping_status: 'printed' } : o))
                    flash('✅ เปลี่ยนสถานะ ' + ids.length + ' รายการ'); setShipSelected(new Set())
                  })
                }} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #16A085', background: '#E8F8F5', color: '#16A085', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: T.font }}>🖨 ปริ้นแล้ว</button>
                {/* สร้างเลขพัสดุ */}
                <button onClick={() => { const sel = orders.filter(o => shipSelected.has(o.id)); bulkCreateFlash(sel) }} disabled={bulkCreating} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: bulkCreating ? '#BDC3C7' : '#E67E22', color: '#fff', fontSize: 11, fontWeight: 700, cursor: bulkCreating ? 'wait' : 'pointer', fontFamily: T.font }}>
                  {bulkCreating ? `⏳ ${bulkProgress.done}/${bulkProgress.total}...` : `⚡ สร้างเลขพัสดุ (${shipSelected.size})`}
                </button>
                {/* Export ที่เลือก */}
                <button onClick={() => {
                  const sel = orders.filter(o => shipSelected.has(o.id))
                  exportProshipExcel(sel, 'Selected_' + sel.length + '.xlsx', profile, 'shipping').then(() => flash('✅ Export สำเร็จ'))
                }} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #2980B9', background: '#EBF5FB', color: '#2980B9', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: T.font }}>📊 Export ที่เลือก</button>
                {/* ปริ้นใบปะหน้า */}
                {(() => { const pnos = orders.filter(o => shipSelected.has(o.id) && o.flash_pno).map(o => o.flash_pno); return pnos.length > 0 && (
                  <button onClick={() => bulkPrintLabels(pnos)} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #E67E22', background: '#FEF5E7', color: '#E67E22', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: T.font }}>🖨 ปริ้นใบปะหน้า ({pnos.length})</button>
                ) })()}
                {/* ยกเลิก Flash */}
                {(() => { const withPno = orders.filter(o => shipSelected.has(o.id) && o.flash_pno); return withPno.length > 0 && (
                  <button onClick={() => bulkCancelFlash(withPno)} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #E74C3C', background: '#FDEDEC', color: '#E74C3C', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: T.font }}>❌ ยกเลิก Flash ({withPno.length})</button>
                ) })()}
                <button onClick={() => setShipSelected(new Set())} style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #D5D8DC', background: '#fff', color: '#85929E', fontSize: 11, cursor: 'pointer', fontFamily: T.font }}>✕</button>
              </div>
            )}

            {/* Table */}
            <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #DEE2E6', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: T.font, minWidth: 1100 }}>
                  <thead>
                    <tr style={{ background: '#F4F6F7', borderBottom: '1px solid #DEE2E6' }}>
                      <th style={{ padding: '12px 6px', textAlign: 'center', width: 36 }}>
                        <input type="checkbox" onChange={() => toggleShipSelectAll(shipOrders.map(o => o.id))} checked={shipOrders.length > 0 && shipOrders.every(o => shipSelected.has(o.id))} style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#3498DB' }} />
                      </th>
                      <th style={{ padding: '12px 6px', textAlign: 'center', color: '#5D6D7E', fontWeight: 600, fontSize: 12, width: 36 }}>#</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', color: '#5D6D7E', fontWeight: 600, fontSize: 12 }}>วันที่</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', color: '#5D6D7E', fontWeight: 600, fontSize: 12 }}>เวลา</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', color: '#5D6D7E', fontWeight: 600, fontSize: 12 }}>ลูกค้า</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', color: '#5D6D7E', fontWeight: 600, fontSize: 12 }}>เบอร์โทรศัพท์</th>
                      <th style={{ padding: '12px 8px', textAlign: 'center', color: '#5D6D7E', fontWeight: 600, fontSize: 12 }}>สถานะ</th>
                      <th style={{ padding: '12px 8px', textAlign: 'center', color: '#5D6D7E', fontWeight: 600, fontSize: 12 }}>การส่งสินค้า</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', color: '#5D6D7E', fontWeight: 600, fontSize: 12 }}>หมายเลขการติดตาม</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right', color: '#5D6D7E', fontWeight: 600, fontSize: 12 }}>COD ⚙</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', color: '#5D6D7E', fontWeight: 600, fontSize: 12 }}>ร้านค้า</th>
                      <th style={{ padding: '12px 8px', textAlign: 'center', color: '#5D6D7E', fontWeight: 600, fontSize: 12 }}>การปฏิบัติ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const searched = shipOrders.filter(o => {
                        if (!searchQuery) return true
                        const q = searchQuery.toLowerCase()
                        return (o.customer_name||'').toLowerCase().includes(q) || (o.customer_phone||'').includes(q) || (o.flash_pno||'').toLowerCase().includes(q) || (o.sales_channel||'').toLowerCase().includes(q)
                      })
                      return searched.slice((currentPage-1)*pageSize, currentPage*pageSize).map((o, i) => {
                        const dt = new Date(o.created_at)
                        const hasPno = !!o.flash_pno
                        const isPrinted = o.shipping_status === 'printed'
                        const st = hasPno
                          ? { label: 'รับเข้าระบบ', bg: '#D4E6F1', color: '#2471A3' }
                          : isPrinted
                            ? { label: 'พร้อมส่ง', bg: '#D5F5E3', color: '#1E8449' }
                            : { label: 'เตรียมส่ง', bg: '#FDEBD0', color: '#CA6F1E' }
                        const dateStr = dt.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', year: 'numeric' })
                        const timeStr = dt.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.'
                        return (
                          <tr key={o.id} style={{ borderBottom: '1px solid #EAECEE', background: shipSelected.has(o.id) ? '#EBF5FB' : '#fff' }}>
                            <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                              <input type="checkbox" checked={shipSelected.has(o.id)} onChange={() => toggleShipSelect(o.id)} style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#3498DB' }} />
                            </td>
                            <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                              <button onClick={() => hasPno ? printLabel(o.flash_pno) : null} style={{ background: 'none', border: 'none', cursor: hasPno ? 'pointer' : 'default', fontSize: 15, opacity: hasPno ? 0.7 : 0.2, padding: 0 }} title={hasPno ? 'ปริ้นใบปะหน้า' : ''}>🖨</button>
                            </td>
                            <td style={{ padding: '10px 8px', fontSize: 13, color: '#2C3E50' }}>{dateStr}</td>
                            <td style={{ padding: '10px 8px', fontSize: 13, color: '#7F8C8D' }}>{timeStr}</td>
                            <td style={{ padding: '10px 8px', fontWeight: 600, color: '#2C3E50', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.customer_name}</td>
                            <td style={{ padding: '10px 8px', color: '#2C3E50', fontSize: 13 }}>{o.customer_phone}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                              <span style={{ padding: '4px 14px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>{st.label}</span>
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'center', color: '#7F8C8D', fontSize: 13 }}>{hasPno ? 'flash' : '—'}</td>
                            <td style={{ padding: '10px 8px' }}>
                              {hasPno ? (
                                <button onClick={() => trackFlash(o.flash_pno)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: '#2980B9', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  {o.flash_pno} <span style={{ fontSize: 11, opacity: 0.6 }}>🔗</span>
                                </button>
                              ) : <span style={{ color: '#D5D8DC' }}>—</span>}
                            </td>
                            <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: '#2C3E50', fontSize: 13 }}>{o.payment_type === 'cod' ? fmt(parseFloat(o.cod_amount||o.sale_price)||0) : ''}</td>
                            <td style={{ padding: '10px 8px', fontSize: 12, color: '#7F8C8D', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.sales_channel||'—'}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                <button onClick={() => openPnoModal(o)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: 0, opacity: 0.6 }} title="แก้ไข">✏️</button>
                                {hasPno && <button onClick={() => trackFlash(o.flash_pno)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: 0, opacity: 0.6 }} title="ดูสถานะ">👁</button>}
                                {hasPno && <button onClick={() => cancelFlash(o)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: 0, opacity: 0.5 }} title="ยกเลิก Flash">❌</button>}
                                {hasPno && <button onClick={() => deletePno(o.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: 0, opacity: 0.5 }} title="ลบเลขพัสดุ (ไม่ยกเลิก Flash)">⊘</button>}
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
              {shipOrders.length === 0 && <Empty text="ไม่มีออเดอร์" />}
              <div style={{ padding: '10px 16px', borderTop: '1px solid #EAECEE', background: '#F8F9FA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#85929E' }}>{shipOrders.length} รายการ</span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#85929E' }}>แสดง</span>
                  {[100, 200, 500].map(n => (
                    <button key={n} onClick={() => { setPageSize(n); setCurrentPage(1) }} style={{
                      padding: '5px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: T.font,
                      border: pageSize === n ? '1px solid #3498DB' : '1px solid #D5D8DC',
                      background: pageSize === n ? '#3498DB' : '#fff',
                      color: pageSize === n ? '#fff' : '#5D6D7E'
                    }}>{n}</button>
                  ))}
                  <span style={{ fontSize: 11, color: '#85929E', marginLeft: 4 }}>ต่อหน้า</span>
                </div>
                <Pagination total={shipOrders.length} page={currentPage} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={setPageSize} />
              </div>
            </div>
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
              <select value={userForm.role} onChange={e => setUserForm(p=>({...p,role:e.target.value}))} style={{ width: '100%', padding: '13px 16px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', boxSizing: 'border-box' }}><option value="employee">👤 พนักงาน</option><option value="packer">📦 พนักงานแพค</option><option value="admin">🔑 แอดมิน</option><option value="manager">🏢 หัวหน้า</option></select>
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
                <select value={editUserData.role} onChange={e => setEditUserData(p=>({...p,role:e.target.value}))} style={{ width: '100%', padding: '13px 16px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', boxSizing: 'border-box' }}><option value="employee">👤 พนักงาน</option><option value="packer">📦 พนักงานแพค</option><option value="admin">🔑 แอดมิน</option><option value="manager">🏢 หัวหน้า</option></select>
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
                    <div style={{ fontSize: 11, color: T.textDim }}>{p.role === 'manager' ? '🏢 หัวหน้า' : p.role === 'admin' ? '🔑 แอดมิน' : p.role === 'packer' ? '📦 พนักงานแพค' : '👤 พนักงาน'}{p.mt_teams?.name && ` · ${p.mt_teams.name}`}</div>
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
