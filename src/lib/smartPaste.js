// ════════════════════════════════════════════════════════════
//  Smart Paste — ตัวแยกข้อมูลลูกค้าจากข้อความที่วาง (ไฟล์กลาง)
//  ใช้ร่วมกันทั้ง OrderForm / EmployeeApp / PackerApp
//  ── อย่าก๊อปไปวางซ้ำในไฟล์อื่น ให้ import จากที่นี่เท่านั้น ──
// ════════════════════════════════════════════════════════════

// บรรทัดที่ไม่ใช่ชื่อลูกค้าแน่ๆ
const NAME_SKIP = /\d{3,}|ม\.\d|ต\.|ตำบล|แขวง|อำเภอ|เขต|จ\.|จังหวัด|^COD|^FB|^P:|^R\d|^@|^Line|หมู่|ซอย|ถนน|บ้านเลขที่|^โทร|กรุงเทพ/i
const LINE_LABEL = /^@|^FB|^P:|^R\d|^Line|^COD|^โทร|^ชื่อ/i

function looksLikeName(s) {
  const c = (s || '').trim()
  if (c.length < 2 || c.length > 60) return false   // รับชื่อเล่นสั้น 2 ตัวอักษร เช่น กบ ปู เป้
  if (/\d/.test(c)) return false                      // ชื่อไม่มีตัวเลข
  if (NAME_SKIP.test(c)) return false                 // ไม่ใช่คำที่เป็นที่อยู่/ป้ายกำกับ
  return /[ก-๙]/.test(c) || /^[A-Za-z\s'.]+$/.test(c) // ไทย หรือ อังกฤษล้วน
}

// ลบเบอร์โทร (รวมแบบมีขีดคั่น) ออกจากข้อความ
function stripPhone(s) {
  return s.replace(/(?<!\d)0[689][\d\s-]{8,12}(?!\d)/g, ' ')
}

export function parseSmartPaste(text, addressData = []) {
  const result = {}
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean)
  // แก้ = เป็น space, แก้ อ.เภอ → อำเภอ
  const fixedLines = lines.map(l => l.replace(/อ\.เภอ/g, 'อำเภอ').replace(/=/g, ' '))
  const all = fixedLines.join(' ')

  // ── บรรทัดสำหรับตรวจจับ "ตัวเลข" (เบอร์โทร/รหัสไปรษณีย์) ──
  //    ตัดบรรทัดชื่อเพจ (P:) ออก เพราะตัวเลขในชื่อเพจไม่ใช่เบอร์ลูกค้า
  const numLines = fixedLines.filter(l => !/^P[:\s]/i.test(l))
  const numAll = numLines.join(' ')

  // 1. เบอร์โทร (ไม่จับจากบรรทัด P:)
  const cleaned = numAll.replace(/(\d)\s*[-–—]\s*(\d)/g, '$1$2')
  const phoneMatch = cleaned.match(/(?<!\d)(0[689]\d{8})(?!\d)/)
  if (phoneMatch) result.customerPhone = phoneMatch[1]

  // 2. รหัสไปรษณีย์ (ไม่จับจากบรรทัด P: เช่นกัน)
  const zipCandidates = numAll.match(/[1-9]\d{4}/g) || []
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
    const provNames = ['กรุงเทพ','กรุงเทพมหานคร','กทม','นนทบุรี','ปทุมธานี','สมุทรปราการ','สมุทรสาคร','นครปฐม','เชียงใหม่','เชียงราย','ภูเก็ต','ขอนแก่น','อุดรธานี','นครราชสีมา','สงขลา','สุราษฎร์ธานี','อุบลราชธานี','ชลบุรี','พิษณุโลก','ลำปาง','ลำพูน','ระยอง','ตรัง','นครศรีธรรมราช']
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
        const exactMatch = zipMatches.find(a => a.s === result.subDistrict)
        if (exactMatch) {
          result.district = exactMatch.d
          result.province = exactMatch.p
        } else {
          const best = zipMatches.find(a => all.includes(a.s)) || zipMatches[0]
          result.subDistrict = best.s
          result.district = best.d
          result.province = best.p
        }
      }
    }
  }

  // 9. ชื่อ ───────────────────────────────────────────────
  //  (a) มีคำนำหน้า "ชื่อ:"
  for (const line of fixedLines) {
    const m = line.match(/^ชื่อ[.\s:]+(.+)/i)
    if (m) { result.customerName = m[1].trim().replace(/-/g, ' '); break }
  }
  //  (b) เดาจากแต่ละบรรทัด — ตัดเบอร์โทร/ตัวเลขออกก่อน
  //      รองรับทั้ง "ชื่อ ตามด้วยเบอร์", "เบอร์ ตามด้วยชื่อ", และชื่อล้วน
  if (!result.customerName) {
    for (const line of fixedLines) {
      if (LINE_LABEL.test(line)) continue
      let cand = stripPhone(line)
        .replace(/\d{3,}/g, ' ')          // เลขชุดยาว (เลขบ้าน/รหัส) ออก
        .replace(/-/g, ' ')
        .replace(/^(?:คุณ|ลูกค้า|ผู้รับ|พี่|น้อง|เจ๊|เฮีย)\s*/i, '') // ตัดคำนำหน้าทั่วไป
        .replace(/\s+/g, ' ').trim()
      if (looksLikeName(cand)) { result.customerName = cand; break }
    }
  }

  // 10. ที่อยู่ ──────────────────────────────────────────
  //  เก็บเฉพาะส่วนที่อยู่จริง — ตัดเบอร์/ยอดเงิน/รหัส ปณ./ตำบล-อำเภอ-จังหวัด ออก
  if (!result.customerAddress) {
    const parts = []
    for (const line of fixedLines) {
      if (LINE_LABEL.test(line)) continue
      if (result.customerName && line.replace(/-/g, ' ').trim() === result.customerName) continue

      let a = line
      a = stripPhone(a)                                                  // ตัดเบอร์โทร
      if (result.customerName) a = a.replace(result.customerName, ' ')   // ตัดชื่อที่ปนมา
      a = a.replace(/(?:ต\.|ตำบล|แขวง|อ\.|อำเภอ|เขต|จ\.|จังหวัด).*$/u, ' ') // ตัดตั้งแต่ตำบลเป็นต้นไป
      a = a.replace(/(?:COD|ปลายทาง)\s*\d+/ig, ' ')                       // ตัดยอดเงิน
      a = a.replace(/\b[1-9]\d{4}\b/g, ' ')                               // ตัดรหัส ปณ.
      a = a.replace(/กรุงเทพมหานคร|กรุงเทพ|กทม/g, ' ')                    // ตัดชื่อจังหวัดที่ค้าง
      a = a.replace(/-/g, ' ').replace(/[,]+/g, ' ').replace(/\s+/g, ' ').trim()

      // เก็บเฉพาะบรรทัดที่มีสัญญาณว่าเป็นที่อยู่จริง
      if (a.length >= 2 && /\d|หมู่|ม\.|ซอย|ซ\.|ถนน|ถ\.|ร้าน|บ้าน|\//.test(a)) parts.push(a)
    }
    if (parts.length > 0) result.customerAddress = parts.join(' ')
  }

  return result
}

export function validatePhone(phone) {
  if (!phone) return { valid: false, msg: '' }
  const d = phone.replace(/\D/g, '')
  if (d.length < 10) return { valid: false, msg: `กรอกอีก ${10 - d.length} หลัก` }
  if (d.length > 10) return { valid: false, msg: 'เกิน 10 หลัก' }
  if (!/^0[689]/.test(d)) return { valid: false, msg: 'ต้องขึ้นต้น 06/08/09' }
  return { valid: true, msg: '' }
}
