// ═══ Export J&T Express Format (.xlsx) ═══
// ใช้ไฟล์แม่แบบของ J&T (public/J_AND_T.xlsx) แล้วเติมข้อมูลลงชีตแรก
// ชีตรายชื่อจังหวัด/อำเภอ/ตำบล และ dropdown ของ J&T ยังอยู่ครบ
import ExcelJS from 'exceljs'
import { supabase } from './supabase'

const TEMPLATE_URL = import.meta.env.BASE_URL + 'J_AND_T.xlsx'
const DEFAULT_WEIGHT_KG = 1 // น้ำหนักเริ่มต้น (J&T ต้องมีน้ำหนัก) — แก้ได้ตามสินค้าจริง

// คอลัมน์ในชีต "ข้อมูลสำหรับโอนถ่าย-V20211028" (A–R)
const COL = {
  orderNo: 1, weight: 2, name: 3, phone: 4, officePhone: 5,
  province: 6, district: 7, subDistrict: 8, zip: 9, address: 10,
  item: 11, value: 12, remark: 13, cod: 14,
  width: 15, length: 16, height: 17, packFee: 18,
}

// ── ทำความสะอาดชื่อจังหวัด/อำเภอ/ตำบลให้ตรงกับรายชื่อของ J&T ──
const strip = (s, prefixes) => {
  let t = String(s || '').trim().replace(/\s+/g, '')
  for (const p of prefixes) if (t.startsWith(p)) { t = t.slice(p.length); break }
  return t
}
const cleanProvince = (p) => {
  const t = strip(p, ['จังหวัด', 'จ.'])
  if (['กรุงเทพ', 'กทม', 'กทม.', 'กรุงเทพฯ', 'กรุงเทพมหานคร'].includes(t)) return 'กรุงเทพมหานคร'
  return t
}
const cleanDistrict = (d) => strip(d, ['อำเภอ', 'อ.', 'เขต']).replace(/-/g, '')
const cleanSub = (s) => strip(s, ['ตำบล', 'ต.', 'แขวง']).replace(/-/g, '')

// ค่าเซลล์บางช่องในแม่แบบเป็น rich text → ดึงเป็นข้อความธรรมดา
const txt = (v) => {
  if (v == null) return ''
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join('').trim()
    if (v.text != null) return String(v.text).trim()
    if (v.result != null) return String(v.result).trim()
  }
  return String(v).trim()
}

// อ่านรายชื่อจากชีต 2 (จังหวัด → อำเภอ) และชีต 3 (จังหวัด_อำเภอ → ตำบล) ของแม่แบบ
function readLookups(wb) {
  const districts = {} // province → [district names ตามที่ J&T ใช้]
  const s2 = wb.worksheets[1]
  s2.getRow(1).eachCell((cell, c) => {
    const p = txt(cell.value)
    if (!p) return
    const list = []
    s2.getColumn(c).eachCell((v, r) => { const t = txt(v.value); if (r > 1 && t) list.push(t) })
    districts[p] = list
  })
  const subs = {} // "จังหวัด_อำเภอ" → [ตำบล]
  wb.worksheets[2].eachRow(row => {
    const key = txt(row.getCell(1).value)
    if (!key) return
    const list = []
    row.eachCell((v, c) => { const t = txt(v.value); if (c > 1 && t) list.push(t) })
    subs[key] = list
  })
  return { districts, subs }
}

function matchAddress(o, lk) {
  const province = cleanProvince(o.province)
  let district = String(o.district || '').trim()
  let sub = String(o.sub_district || '').trim()
  const dList = lk.districts[province]
  if (dList) {
    const want = cleanDistrict(district)
    district = dList.find(d => cleanDistrict(d) === want) || district
    const sList = lk.subs[province + '_' + district]
    if (sList) {
      const wantS = cleanSub(sub)
      sub = sList.find(s => cleanSub(s) === wantS) || sub
    }
  }
  const ok = !!dList && dList.includes(district) && (lk.subs[province + '_' + district] || []).includes(sub)
  return { province, district, sub, ok }
}

async function buildPageGroupMap() {
  const map = {}
  try {
    const { data } = await supabase.from('mt_product_groups').select('name,pages')
    ;(data || []).forEach(g => (g.pages || []).forEach(p => { map[String(p).trim()] = g.name }))
  } catch {}
  return map
}

async function logExport(profile, filename, count, filterInfo) {
  try {
    await supabase.from('mt_export_logs').insert({
      user_id: profile?.id || null,
      user_name: profile?.full_name || '—',
      export_type: 'J&T',
      file_name: filename,
      record_count: count,
      filter_info: filterInfo || '',
    })
  } catch {}
}

// คืนค่า { count, unmatched } — unmatched = จำนวนออเดอร์ที่ชื่อ อำเภอ/ตำบล ไม่ตรงรายชื่อ J&T (ควรตรวจก่อนอัปโหลด)
export async function exportJntExcel(orders, filename, profile, filterInfo) {
  const res = await fetch(TEMPLATE_URL)
  if (!res.ok) throw new Error('โหลดแม่แบบ J&T ไม่สำเร็จ')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await res.arrayBuffer())
  const ws = wb.worksheets[0]
  const lk = readLookups(wb)
  const pgMap = await buildPageGroupMap()

  const badFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } }
  let unmatched = 0

  orders.forEach((o, i) => {
    const r = ws.getRow(i + 2)
    const a = matchAddress(o, lk)
    const isCod = (o.payment_type || 'cod') === 'cod'
    const cod = isCod ? (Number(o.cod_amount) || Number(o.sale_price) || '') : ''

    r.getCell(COL.orderNo).value = String(o.order_number || o.id || '')
    r.getCell(COL.weight).value = DEFAULT_WEIGHT_KG
    r.getCell(COL.name).value = o.customer_name || ''
    r.getCell(COL.phone).value = String(o.customer_phone || '').replace(/\D/g, '')
    r.getCell(COL.province).value = a.province
    r.getCell(COL.district).value = a.district
    r.getCell(COL.subDistrict).value = a.sub
    r.getCell(COL.zip).value = String(o.zip_code || '')
    r.getCell(COL.address).value = o.customer_address || ''
    r.getCell(COL.item).value = pgMap[(o.sales_channel || '').trim()] || ''
    r.getCell(COL.remark).value = o.remark || ''
    r.getCell(COL.cod).value = cod

    if (!a.ok) {
      unmatched++
      ;[COL.province, COL.district, COL.subDistrict].forEach(c => { r.getCell(c).fill = badFill })
    }
    r.commit()
  })

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename || 'JT_' + new Date().toISOString().split('T')[0] + '.xlsx'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)

  await logExport(profile, a.download, orders.length, filterInfo)
  return { count: orders.length, unmatched }
}
