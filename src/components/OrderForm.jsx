import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { syncOrderToSheet } from '../lib/sheetSync'
import { T, glass, Btn, Toast } from './ui'

// ════════════════════════════════════════════
//  Shared: getAddresses, parseSmartPaste, validatePhone, AddressSearch
// ════════════════════════════════════════════
let _addrCache = null
async function getAddresses() {
  if (_addrCache) return _addrCache
  const mod = await import('../data/addresses.json')
  _addrCache = mod.default
  return _addrCache
}

function parseSmartPaste(text, addressData = []) {
  const result = {}
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean)
  // แก้ = เป็น space, แก้ อ.เภอ → อำเภอ
  const fixedLines = lines.map(l => l.replace(/อ\.เภอ/g, 'อำเภอ').replace(/=/g, ' '))
  const all = fixedLines.join(' ')

  // 1. เบอร์โทร
  const cleaned = all.replace(/(\d)\s*[-–—]\s*(\d)/g, '$1$2')
  const phoneMatch = cleaned.match(/(?<!\d)(0[689]\d{8})(?!\d)/)
  if (phoneMatch) result.customerPhone = phoneMatch[1]

  // 2. รหัสไปรษณีย์
  const zipCandidates = all.match(/[1-9]\d{4}/g) || []
  for (const z of zipCandidates) {
    if (result.customerPhone && result.customerPhone.includes(z)) continue
    if (parseInt(z) >= 10000 && parseInt(z) <= 96000) { result.zipCode = z; break }
  }

  // 3. ยอดเงิน
  const amtMatch = all.match(/(?:COD|ปลายทาง)\s*(\d+)/i)
  if (amtMatch) result.amount = amtMatch[1]

  // 4. FB/Line
  for (const line of fixedLines) {
    const fbM = line.match(/^(?:FB|Facebook)[:\s]+(.+)/i)
    if (fbM) result.customerSocial = fbM[1].trim()
    const liM = line.match(/^(?:Line|ไลน์)[:\s]+(.+)/i)
    if (liM) result.customerSocial = liM[1].trim()
  }

  // 5. เพจ
  for (const line of fixedLines) {
    const pM = line.match(/^P[:\s]+(.+)/i)
    if (pM) { result.salesChannel = pM[1].trim(); break }
  }

  // 6. หมายเหตุ @
  for (const line of fixedLines) {
    const atM = line.match(/^@\s*(.+)/i)
    if (atM) { result.remark = atM[1].trim(); break }
  }

  // 7. ตำบล/แขวง อำเภอ/เขต จังหวัด — รองรับ กทม
  const tdMatch = all.match(/(?:^|\s)(?:ต\.|ตำบล|แขวง)\s*([ก-๙ะ-์]+?)(?=\s|อ\.|อำเภอ|เขต|จ\.|จังหวัด|\d|$)/u)
  if (tdMatch) result.subDistrict = tdMatch[1]
  const dtMatch = all.match(/(?:^|\s)(?:อ\.|อำเภอ|เขต)\s*([ก-๙ะ-์]+?)(?=\s|จ\.|จังหวัด|กรุงเทพ|\d|$)/u)
  if (dtMatch) result.district = dtMatch[1]
  const provMatch = all.match(/(?:^|\s)(?:จ\.|จังหวัด)\s*([ก-๙ะ-์]+?)(?=\s|\d|$)/u)
  if (provMatch) result.province = provMatch[1]

  // จับ แขวง/เขต จากแต่ละบรรทัด (กรณี กทม แยกบรรทัด)
  if (!result.subDistrict) {
    for (const line of fixedLines) {
      const m = line.match(/^แขวง\s*(.+)/); if (m) { result.subDistrict = m[1].trim(); break }
    }
  }
  if (!result.district) {
    for (const line of fixedLines) {
      const m = line.match(/^เขต\s*(.+)/); if (m) { result.district = m[1].trim(); break }
    }
  }
  // จับจังหวัดจากบรรทัดเดี่ยว (เช่น "กรุงเทพ" อยู่บรรทัดเดียว)
  if (!result.province) {
    const provNames = ['กรุงเทพ','กรุงเทพมหานคร','กทม','นนทบุรี','ปทุมธานี','สมุทรปราการ','สมุทรสาคร','นครปฐม','เชียงใหม่','เชียงราย','ภูเก็ต','ขอนแก่น','อุดรธานี','นครราชสีมา','สงขลา','สุราษฎร์ธานี','อุบลราชธานี','ชลบุรี','พิษณุลอก','ลำปาง','ลำพูน','ระยอง','ตรัง','นครศรีธรรมราช']
    for (const line of fixedLines) {
      const trimmed = line.trim()
      if (provNames.some(p => trimmed.includes(p))) {
        result.province = trimmed.replace(/จ\.|จังหวัด/g, '').trim()
        break
      }
    }
  }

  // 8. Lookup จาก address data
  if (addressData.length > 0) {
    if (result.zipCode && !result.subDistrict) {
      const matched = addressData.filter(a => a.z === result.zipCode)
      if (matched.length > 0) { const best = matched.find(a => all.includes(a.s)) || matched[0]; result.subDistrict = best.s; result.district = best.d; result.province = best.p }
    }
    if (!result.zipCode && result.subDistrict) {
      const found = addressData.find(a => a.s === result.subDistrict && (result.district ? a.d.includes(result.district) : true))
      if (found) { result.zipCode = found.z; if (!result.district) result.district = found.d; if (!result.province) result.province = found.p }
    }
    if (result.zipCode && !result.province) { const m = addressData.find(a => a.z === result.zipCode); if (m) result.province = m.p }
    if (!result.zipCode && !result.subDistrict && result.district) {
      const found = addressData.find(a => a.d.includes(result.district))
      if (found) { result.zipCode = found.z; result.subDistrict = found.s; if (!result.province) result.province = found.p }
    }
    if (result.subDistrict && (!result.district || !result.province || !result.zipCode)) {
      const found = addressData.find(a => a.s === result.subDistrict && (result.zipCode ? a.z === result.zipCode : true))
      if (found) { if (!result.district) result.district = found.d; if (!result.province) result.province = found.p; if (!result.zipCode) result.zipCode = found.z }
    }
    if (result.zipCode && (!result.district || !result.subDistrict || !result.province)) {
      const found = addressData.find(a => a.z === result.zipCode && (result.subDistrict ? a.s === result.subDistrict : true))
      if (found) { if (!result.district) result.district = found.d; if (!result.subDistrict) result.subDistrict = found.s; if (!result.province) result.province = found.p }
    }
    // ═══ ZIP เป็นตัวหลัก — ถ้า ตำบล/อำเภอ ไม่ตรง zip ให้แก้ตาม zip ═══
    if (result.zipCode) {
      const zipMatches = addressData.filter(a => a.z === result.zipCode)
      if (zipMatches.length > 0) {
        // เช็คว่า ตำบลที่จับได้ ตรงกับ zip ไหม
        const exactMatch = zipMatches.find(a => a.s === result.subDistrict)
        if (exactMatch) {
          // ตำบลตรง → เติมอำเภอ/จังหวัดให้ถูก
          result.district = exactMatch.d
          result.province = exactMatch.p
        } else {
          // ตำบลไม่ตรงกับ zip → ใช้ข้อมูลจาก zip แทน
          const best = zipMatches.find(a => all.includes(a.s)) || zipMatches[0]
          result.subDistrict = best.s
          result.district = best.d
          result.province = best.p
        }
      }
    }
  }

  // 9. ชื่อ — บรรทัดแรกที่เป็นชื่อ (รองรับ - คั่น)
  const skipRe = /\d{3,}|ม\.\d|ต\.|ตำบล|แขวง|อำเภอ|เขต|จ\.|จังหวัด|^COD|^FB|^P:|^R\d|^@|^Line|หมู่|ซอย|ถนน|บ้านเลขที่|^โทร|กรุงเทพ/i
  for (const line of fixedLines) { const m = line.match(/^ชื่อ[.\s:]+(.+)/i); if (m) { result.customerName = m[1].trim().replace(/-/g, ' '); break } }
  if (!result.customerName) {
    for (const line of fixedLines) {
      if (/^@|^FB|^P:|^R\d|^Line|^COD|^โทร|^ชื่อ/i.test(line)) continue
      const clean = line.replace(/-/g, ' ').trim()
      const isName = clean.length >= 3 && clean.length <= 60 && !skipRe.test(clean) && !/\d{5}/.test(clean) && (/[ก-๙]/.test(clean) || /^[A-Za-z\s'.]+$/.test(clean))
      if (isName) { result.customerName = clean; break }
    }
  }
  if (!result.customerName) {
    for (const line of fixedLines) {
      if (/^@|^FB|^P:|^R\d|^Line|^COD|^โทร|^ชื่อ/i.test(line)) continue
      const split = line.match(/^([ก-๙ะ-์A-Za-z'\s-]{3,40}?)\s+(\d.+)/)
      if (split) { const n = split[1].trim().replace(/-/g, ' '); if (n.length >= 3 && !/ต\.|อ\.|จ\.|ม\.\d|หมู่|ซอย|ถนน|บ้าน|แขวง|เขต/.test(n)) { result.customerName = n; break } }
    }
  }

  // 10. ที่อยู่ — จับบรรทัดที่มีเลขบ้าน/ซอย/ถนน/ร้าน + บรรทัดที่อยู่ระหว่างชื่อกับตำบล
  if (!result.customerAddress) {
    const addrParts = []
    let passedName = false
    for (const line of fixedLines) {
      if (/^@|^FB|^P:|^R\d|^Line|^COD|^โทร|^ชื่อ/i.test(line)) continue
      if (line.replace(/-/g, ' ').trim() === result.customerName) { passedName = true; continue }
      // หยุดเมื่อเจอ ตำบล/แขวง/อำเภอ/เขต/จังหวัด/zip/เบอร์
      if (/^(?:ต\.|ตำบล|แขวง|อ\.|อำเภอ|เขต|จ\.|จังหวัด|กรุงเทพ)/i.test(line)) break
      if (/^\d{5}/.test(line)) break
      if (line === result.remark || line.startsWith('@')) continue

      if (passedName && line.length >= 3) {
        let addr = line
        if (result.subDistrict) addr = addr.replace(new RegExp('(?:ต\\.|ตำบล|แขวง)\\s*' + result.subDistrict, 'g'), '')
        if (result.district) addr = addr.replace(new RegExp('(?:อ\\.|อำเภอ|เขต)\\s*' + result.district, 'g'), '')
        addr = addr.replace(/(?:จ\.|จังหวัด)\s*[ก-๙ะ-์]+/gu, '').replace(/\d{5}/, '').replace(/[,.\s]+$/, '').trim()
        if (addr.length >= 2) addrParts.push(addr)
      } else if (!passedName && /บ้านเลขที่|บ้านเลข|\d+\/\d|ซอย|ซ\.|หมู่|ม\.|ถนน|ถ\.|ร้าน|\d+/.test(line)) {
        passedName = true
        let addr = line
        if (result.subDistrict) addr = addr.replace(new RegExp('(?:ต\\.|ตำบล|แขวง)\\s*' + result.subDistrict, 'g'), '')
        if (result.district) addr = addr.replace(new RegExp('(?:อ\\.|อำเภอ|เขต)\\s*' + result.district, 'g'), '')
        addr = addr.replace(/(?:จ\.|จังหวัด)\s*[ก-๙ะ-์]+/gu, '').replace(/\d{5}/, '').replace(/[,.\s]+$/, '').trim()
        if (addr.length >= 2) addrParts.push(addr)
      }
    }
    if (addrParts.length > 0) result.customerAddress = addrParts.join(' ')
  }
  return result
}

function validatePhone(phone) {
  if (!phone) return { valid: false, msg: '' }
  const d = phone.replace(/\D/g, '')
  if (d.length < 10) return { valid: false, msg: `กรอกอีก ${10 - d.length} หลัก` }
  if (d.length > 10) return { valid: false, msg: 'เกิน 10 หลัก' }
  if (!/^0[689]/.test(d)) return { valid: false, msg: 'ต้องขึ้นต้น 06/08/09' }
  return { valid: true, msg: '' }
}

function FI({ label, error, success, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>{label}</label>}
      <input {...props} style={{ width: '100%', padding: '13px 16px', borderRadius: T.radiusSm, border: `1px solid ${error ? 'rgba(214,48,49,0.4)' : T.border}`, background: error ? 'rgba(214,48,49,0.03)' : T.surfaceAlt, color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', boxSizing: 'border-box', ...(props.style || {}) }} />
      {error && <div style={{ fontSize: 11, color: T.danger, marginTop: 4 }}>{error}</div>}
      {success && <div style={{ fontSize: 11, color: T.success, marginTop: 4 }}>{success}</div>}
    </div>
  )
}

function AddressSearch({ onSelect, currentValue, addresses = [] }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  useEffect(() => { if (q.length < 2) { setResults([]); return }; setResults(addresses.filter(a => a.s.includes(q) || a.d.includes(q) || a.p.includes(q) || a.z.includes(q)).slice(0, 8)) }, [q])
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 6 }}>🔍 ค้นหาตำบล/อำเภอ/รหัสไปรษณีย์</label>
      {currentValue && <div style={{ padding: '10px 14px', borderRadius: T.radiusSm, background: 'rgba(184,134,11,0.06)', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>{currentValue}</div>}
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="พิมพ์ชื่อตำบล อำเภอ หรือรหัส" style={{ width: '100%', padding: '11px 14px', borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: T.surfaceAlt, color: T.text, fontSize: 14, fontFamily: T.font, outline: 'none', boxSizing: 'border-box' }} />
      {results.length > 0 && <div style={{ marginTop: 6, border: `1px solid ${T.border}`, borderRadius: T.radiusSm, maxHeight: 200, overflowY: 'auto' }}>
        {results.map((a, i) => <div key={i} onClick={() => { onSelect(a); setQ(''); setResults([]) }} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${T.border}`, fontSize: 13, background: '#fff' }}><div style={{ fontWeight: 600 }}>{a.s} → {a.d}</div><div style={{ fontSize: 11, color: T.textDim }}>{a.p} · {a.z}</div></div>)}
      </div>}
    </div>
  )
}

// ════════════════════════════════════════════
//  OrderForm Component
// ════════════════════════════════════════════
export default function OrderForm({ profile, onSuccess }) {
  const [form, setForm] = useState({ customerPhone: '', customerName: '', customerAddress: '', subDistrict: '', district: '', zipCode: '', province: '', customerSocial: '', salesChannel: '', amount: '', remark: '' })
  const [phoneError, setPhoneError] = useState('')
  const [addressWarning, setAddressWarning] = useState('')
  const [paymentType, setPaymentType] = useState('cod')
  const [slipFile, setSlipFile] = useState(null)
  const [slipPreview, setSlipPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  const [pasteText, setPasteText] = useState('')
  const [pasteDetected, setPasteDetected] = useState(false)
  const [addresses, setAddresses] = useState([])
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => { getAddresses().then(setAddresses).catch(() => {}) }, [])

  const phoneOk = form.customerPhone.length === 10 && validatePhone(form.customerPhone).valid
  const amt = parseFloat(form.amount) || 0

  const validateAddress = (f) => {
    if (!f.subDistrict && !f.district && !f.zipCode) { setAddressWarning(''); return }
    if (addresses.length === 0) { setAddressWarning(''); return }
    const msgs = []
    if (f.subDistrict && f.district) { const m = addresses.find(a => a.s === f.subDistrict && a.d.includes(f.district)); if (!m) { const c = addresses.find(a => a.s === f.subDistrict); msgs.push(`ตำบล "${f.subDistrict}" ไม่อยู่ในอำเภอ "${f.district}"${c ? ' (ควรเป็น '+c.d+')' : ''}`) } }
    if (f.subDistrict && f.zipCode) { const m = addresses.find(a => a.s === f.subDistrict && a.z === f.zipCode); if (!m) { const c = addresses.find(a => a.s === f.subDistrict); if (c) msgs.push(`รหัส ปณ. ของ "${f.subDistrict}" ควรเป็น ${c.z} ไม่ใช่ ${f.zipCode}`) } }
    if (f.district && f.province) { const m = addresses.find(a => a.d.includes(f.district) && a.p === f.province); if (!m) { const c = addresses.find(a => a.d.includes(f.district)); msgs.push(`อำเภอ "${f.district}" ไม่อยู่ใน "${f.province}"${c ? ' (ควรเป็น '+c.p+')' : ''}`) } }
    setAddressWarning(msgs.length > 0 ? '⚠️ ' + msgs.join(' · ') : '')
  }

  const set = (k) => (e) => {
    const nf = { ...form, [k]: e.target.value }; setForm(nf)
    if (k === 'customerPhone') setPhoneError(validatePhone(e.target.value).valid ? '' : validatePhone(e.target.value).msg)
    if (['subDistrict','district','zipCode','province'].includes(k)) validateAddress(nf)
    if (fieldErrors[k]) setFieldErrors(p => { const n = {...p}; delete n[k]; return n })
  }

  const handleAddressSelect = (a) => { setForm(p => ({ ...p, subDistrict: a.s, district: a.d, zipCode: a.z, province: a.p })); setAddressWarning(''); setFieldErrors(prev => { const n = {...prev}; delete n.subDistrict; delete n.district; delete n.zipCode; delete n.province; return n }) }
  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 2500) }
  const clearForm = () => { setForm({ customerPhone: '', customerName: '', customerAddress: '', subDistrict: '', district: '', zipCode: '', province: '', customerSocial: '', salesChannel: '', amount: '', remark: '' }); setPhoneError(''); setAddressWarning(''); setPasteText(''); setPaymentType('cod'); setSlipFile(null); setSlipPreview(null); setFieldErrors({}) }

  const applyPaste = (text) => {
    const p = parseSmartPaste(text, addresses)
    setForm(prev => ({ ...prev, customerPhone: p.customerPhone || prev.customerPhone, customerName: p.customerName || prev.customerName, customerAddress: p.customerAddress || prev.customerAddress, subDistrict: p.subDistrict || prev.subDistrict, district: p.district || prev.district, zipCode: p.zipCode || prev.zipCode, province: p.province || prev.province, customerSocial: p.customerSocial || prev.customerSocial, salesChannel: p.salesChannel || prev.salesChannel, amount: p.amount || prev.amount, remark: p.remark || prev.remark }))
    if (p.customerPhone) { const v = validatePhone(p.customerPhone); setPhoneError(v.valid ? '' : v.msg) }
    validateAddress({ subDistrict: p.subDistrict || form.subDistrict, district: p.district || form.district, zipCode: p.zipCode || form.zipCode, province: p.province || form.province })
  }

  const submit = async () => {
    const errs = {}
    if (!form.customerPhone) errs.customerPhone = 'กรุณากรอกเบอร์โทร'
    else if (!validatePhone(form.customerPhone).valid) errs.customerPhone = validatePhone(form.customerPhone).msg
    if (!form.customerName) errs.customerName = 'กรุณากรอกชื่อ'
    if (!form.customerAddress) errs.customerAddress = 'กรุณากรอกที่อยู่'
    if (!form.subDistrict) errs.subDistrict = 'กรุณากรอกตำบล'
    if (!form.district) errs.district = 'กรุณากรอกอำเภอ'
    if (!form.zipCode) errs.zipCode = 'กรุณากรอกรหัส ปณ.'
    if (!form.province) errs.province = 'กรุณากรอกจังหวัด'
    if (!form.amount) errs.amount = 'กรุณากรอกยอดเงิน'
    if (!form.remark) errs.remark = 'กรุณากรอกหมายเหตุ'
    if (!form.customerSocial) errs.customerSocial = 'กรุณากรอกชื่อเฟส/ไลน์'
    if (!form.salesChannel) errs.salesChannel = 'กรุณากรอกชื่อเพจ'
    if (paymentType === 'transfer' && !slipFile) errs.slip = 'กรุณาอัพโหลดสลิป'
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) {
      const labels = { customerPhone: 'เบอร์โทร', customerName: 'ชื่อ', customerAddress: 'ที่อยู่', subDistrict: 'ตำบล', district: 'อำเภอ', zipCode: 'รหัส ปณ.', province: 'จังหวัด', amount: 'ยอดเงิน', remark: 'หมายเหตุ', customerSocial: 'ชื่อเฟส/ไลน์', salesChannel: 'ชื่อเพจ', slip: 'สลิป' }
      const missing = Object.keys(errs).map(k => labels[k] || k).join(', ')
      flash('❌ กรุณากรอก: ' + missing)
      return
    }
    setSubmitting(true)

    // เช็คซ้ำ: เบอร์เดียวกัน + เพจเดียวกัน + วันเดียวกัน
    const todayDate = new Date().toISOString().split('T')[0]
    const { data: dupCheck } = await supabase.from('mt_orders')
      .select('id, customer_name')
      .eq('customer_phone', form.customerPhone)
      .eq('order_date', todayDate)
      .eq('sales_channel', form.salesChannel || '')
    if (dupCheck && dupCheck.length > 0) {
      const dupName = dupCheck[0].customer_name
      if (!confirm(`⚠️ พบออเดอร์ซ้ำวันนี้!\n\nเบอร์: ${form.customerPhone}\nชื่อ: ${dupName}\nเพจ: ${form.salesChannel || '—'}\n\nต้องการบันทึกซ้ำหรือไม่?`)) {
        setSubmitting(false)
        return
      }
    }

    let slipUrl = ''
    if (slipFile && paymentType === 'transfer') {
      const fileName = `slips/${Date.now()}_${Math.random().toString(36).slice(2)}.${slipFile.name.split('.').pop()}`
      const { error: upErr } = await supabase.storage.from('slips').upload(fileName, slipFile)
      if (upErr) { flash('❌ อัพโหลดสลิปไม่สำเร็จ'); setSubmitting(false); return }
      const { data: urlData } = supabase.storage.from('slips').getPublicUrl(fileName)
      slipUrl = urlData?.publicUrl || ''
    }

    const { data: newOrder, error } = await supabase.from('mt_orders').insert({
      order_date: new Date().toISOString().split('T')[0],
      customer_phone: form.customerPhone, customer_name: form.customerName,
      customer_address: form.customerAddress, sub_district: form.subDistrict,
      district: form.district, zip_code: form.zipCode, province: form.province,
      customer_social: form.customerSocial, sales_channel: form.salesChannel,
      sale_price: amt, cod_amount: paymentType === 'cod' ? amt : 0,
      payment_type: paymentType, slip_url: slipUrl,
      remark: form.remark, employee_id: profile.id, team_id: profile.team_id || null, employee_name: profile.full_name,
    }).select().single()

    if (error) { flash('❌ ' + error.message) } else {
      syncOrderToSheet(newOrder, profile.full_name)
      flash('✅ บันทึกออเดอร์สำเร็จ!'); clearForm()
      if (onSuccess) onSuccess(newOrder)
    }
    setSubmitting(false)
  }

  return (
    <div style={{ ...glass, padding: 20 }}>
      <Toast message={toast} />
      {pasteDetected && <div style={{ position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)', background: T.grad1, padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 8px 30px rgba(184,134,11,0.25)', fontFamily: T.font, color: '#fff' }}>📋 Smart Paste — แยกข้อมูลแล้ว!</div>}

      {/* Smart Paste */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 8, color: T.gold }}>📋 Smart Paste — วางข้อมูลจาก Line/Facebook</label>
        <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
          onPaste={e => { const t = e.clipboardData.getData('text'); if (t && t.length >= 10) { e.preventDefault(); setPasteText(t); applyPaste(t); setPasteDetected(true); setTimeout(() => setPasteDetected(false), 3000); flash('✅ Smart Paste สำเร็จ!') } }}
          placeholder={"วางข้อมูลตรงนี้..."} rows={4}
          style={{ width: '100%', padding: '12px 14px', borderRadius: T.radiusSm, border: '1px solid rgba(184,134,11,0.15)', background: 'rgba(184,134,11,0.03)', color: T.text, fontSize: 14, fontFamily: T.font, outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.7 }} />
        {pasteText && <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Btn sm grad={T.grad1} onClick={() => { applyPaste(pasteText); flash('✅ แยกข้อมูลสำเร็จ!') }}>✨ แยกข้อมูล</Btn>
          <Btn sm outline onClick={() => { setPasteText(''); clearForm() }}>🗑 ล้าง</Btn>
        </div>}
      </div>

      <FI label="📱 เบอร์มือถือ * (10 หลัก)" type="tel" maxLength={10} value={form.customerPhone} onChange={set('customerPhone')} placeholder="08xxxxxxxx" error={fieldErrors.customerPhone || phoneError} success={phoneOk ? '✅ เบอร์ถูกต้อง' : ''} style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2 }} />
      <FI label="👤 ชื่อลูกค้า *" value={form.customerName} onChange={set('customerName')} placeholder="ชื่อลูกค้า" error={fieldErrors.customerName} />
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 12, color: fieldErrors.customerAddress ? T.danger : T.textDim, fontWeight: 500, marginBottom: 6 }}>📍 ที่อยู่ *</label>
        <textarea value={form.customerAddress} onChange={set('customerAddress')} placeholder="บ้านเลขที่ ซอย ถนน..." rows={2}
          style={{ width: '100%', padding: '13px 16px', borderRadius: T.radiusSm, border: `1px solid ${fieldErrors.customerAddress ? 'rgba(214,48,49,0.4)' : T.border}`, background: fieldErrors.customerAddress ? 'rgba(214,48,49,0.03)' : T.surfaceAlt, color: T.text, fontSize: 15, fontFamily: T.font, outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
        {fieldErrors.customerAddress && <div style={{ fontSize: 11, color: T.danger, marginTop: 4 }}>{fieldErrors.customerAddress}</div>}
      </div>

      <AddressSearch onSelect={handleAddressSelect} addresses={addresses} currentValue={form.subDistrict ? `${form.subDistrict} > ${form.district} > ${form.province} ${form.zipCode}` : ''} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FI label="ตำบล *" value={form.subDistrict} onChange={set('subDistrict')} placeholder="ตำบล" error={fieldErrors.subDistrict} />
        <FI label="อำเภอ *" value={form.district} onChange={set('district')} placeholder="อำเภอ" error={fieldErrors.district} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FI label="รหัส ปณ. *" value={form.zipCode} onChange={set('zipCode')} placeholder="10500" error={fieldErrors.zipCode} />
        <FI label="จังหวัด *" value={form.province} onChange={set('province')} placeholder="กรุงเทพ" error={fieldErrors.province} />
      </div>
      {addressWarning && <div style={{ padding: '10px 14px', borderRadius: T.radiusSm, marginBottom: 14, background: 'rgba(214,48,49,0.05)', border: '1px solid rgba(214,48,49,0.15)', fontSize: 12, color: T.danger, lineHeight: 1.7 }}>{addressWarning}</div>}
      {form.subDistrict && !addressWarning && addresses.length > 0 && <div style={{ fontSize: 11, color: T.success, marginTop: -10, marginBottom: 14 }}>✅ ที่อยู่ถูกต้อง</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FI label="📘 ชื่อเฟส/ไลน์ *" value={form.customerSocial} onChange={set('customerSocial')} placeholder="ชื่อ Facebook" error={fieldErrors.customerSocial} />
        <FI label="📦 ชื่อเพจ *" value={form.salesChannel} onChange={set('salesChannel')} placeholder="ชื่อเพจ" error={fieldErrors.salesChannel} />
      </div>

      <FI label="💰 ยอดเงิน (฿) *" type="number" value={form.amount} onChange={set('amount')} placeholder="0" error={fieldErrors.amount} style={{ fontSize: 22, fontWeight: 800, textAlign: 'center' }} />

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 12, color: T.textDim, fontWeight: 500, marginBottom: 8 }}>💳 ประเภทการชำระเงิน</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button onClick={() => { setPaymentType('cod'); setSlipFile(null); setSlipPreview(null) }} style={{ padding: '12px', borderRadius: T.radiusSm, cursor: 'pointer', fontFamily: T.font, fontSize: 14, fontWeight: 600, border: paymentType === 'cod' ? '2px solid '+T.gold : '1px solid '+T.border, background: paymentType === 'cod' ? 'rgba(184,134,11,0.08)' : T.surface, color: paymentType === 'cod' ? T.gold : T.textDim }}>📦 COD</button>
          <button onClick={() => setPaymentType('transfer')} style={{ padding: '12px', borderRadius: T.radiusSm, cursor: 'pointer', fontFamily: T.font, fontSize: 14, fontWeight: 600, border: paymentType === 'transfer' ? '2px solid '+T.success : '1px solid '+T.border, background: paymentType === 'transfer' ? 'rgba(45,138,78,0.08)' : T.surface, color: paymentType === 'transfer' ? T.success : T.textDim }}>🏦 โอนเงิน</button>
        </div>
      </div>

      {paymentType === 'transfer' && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, color: fieldErrors.slip ? T.danger : T.textDim, fontWeight: 500, marginBottom: 8 }}>🧾 อัพโหลดสลิป *</label>
          <div style={{ padding: 16, borderRadius: T.radiusSm, textAlign: 'center', border: `2px dashed ${slipFile ? T.success : fieldErrors.slip ? T.danger : T.border}`, background: slipFile ? 'rgba(45,138,78,0.03)' : T.surfaceAlt, cursor: 'pointer' }}
            onClick={() => document.getElementById('order-slip').click()}>
            <input id="order-slip" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setSlipFile(f); if (fieldErrors.slip) setFieldErrors(p => { const n={...p}; delete n.slip; return n }); const r = new FileReader(); r.onload = ev => setSlipPreview(ev.target.result); r.readAsDataURL(f) } }} />
            {slipPreview ? <div><img src={slipPreview} alt="สลิป" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, marginBottom: 8 }} /><div style={{ fontSize: 12, color: T.success }}>✅ {slipFile.name}</div></div>
            : <div><div style={{ fontSize: 32, marginBottom: 8 }}>📷</div><div style={{ fontSize: 14, color: T.textDim }}>กดเพื่อเลือกรูปสลิป</div></div>}
          </div>
          {fieldErrors.slip && <div style={{ fontSize: 11, color: T.danger, marginTop: 6 }}>{fieldErrors.slip}</div>}
        </div>
      )}

      <FI label="💬 หมายเหตุ *" value={form.remark} onChange={set('remark')} placeholder="สินค้า / รายละเอียด" error={fieldErrors.remark} />
      <Btn full grad={T.grad2} onClick={submit} disabled={submitting}>{submitting ? '⏳ กำลังบันทึก...' : '✅ บันทึกออเดอร์'}</Btn>
    </div>
  )
}
