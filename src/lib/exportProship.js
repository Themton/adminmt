// ═══ Export ProShip Format (.xlsx) ═══
import ExcelJS from 'exceljs'

const NOTE_TEXT = 'ช่องสีแดงต้องกรอก ช่องสีขาวไม่จำเป็น\nอำเภอ จังหวัด หากสกดผิด ระบบจะไม่นำเข้าให้\nเบอร์มือถือ ต้องครบ 10 หลัก ไม่สามารถใช้เบอร์ 02 ได้'

const HEADERS = [
  { key: 'phone', label: 'MobileNo*\nเบอร์มือถือ', width: 14, required: true },
  { key: 'name', label: 'Name\nชื่อ', width: 12, required: true },
  { key: 'address', label: 'Address\nที่อยู่', width: 30, required: true },
  { key: 'subDistrict', label: 'SubDistrict\nตำบล', width: 18, required: true },
  { key: 'district', label: 'District\nอำเภอ', width: 20, required: true },
  { key: 'zip', label: 'ZIP\nรหัส ปณ.', width: 10, required: true },
  { key: 'fb', label: 'Customer FB/Line\nเฟส/ไลน์ลูกค้า', width: 20, required: false },
  { key: 'channel', label: 'SalesChannel\nช่องทางจำหน่าย', width: 14, required: false },
  { key: 'admin', label: 'SalesPerson\nชื่อแอดมิน', width: 16, required: false },
  { key: 'price', label: 'SalePrice\nราคาขาย', width: 12, required: false },
  { key: 'cod', label: 'COD*\nยอดเก็บเงินปลายทาง', width: 16, required: true },
  { key: 'remark', label: 'Remark\nหมายเหตุ', width: 22, required: false },
]

function orderToRow(o) {
  return {
    phone: o.customer_phone || '',
    name: o.customer_name || '',
    address: o.customer_address || '',
    subDistrict: o.sub_district || '',
    district: o.district || '',
    zip: o.zip_code ? Number(o.zip_code) || o.zip_code : '',
    fb: o.customer_social || '',
    channel: o.sales_channel || '',
    admin: o.employee_name || '',
    price: o.sale_price ? Number(o.sale_price) || o.sale_price : '',
    cod: o.cod_amount ? Number(o.cod_amount) || o.cod_amount : '',
    remark: o.remark || '',
  }
}

export async function exportProshipExcel(orders, filename) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('ProShip')

  // Column widths
  HEADERS.forEach((h, i) => { ws.getColumn(i + 1).width = h.width })

  // Row 1: Note (merged A1:L1)
  ws.mergeCells('A1:L1')
  const noteCell = ws.getCell('A1')
  noteCell.value = NOTE_TEXT
  noteCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA5A5A5' } }
  noteCell.font = { size: 9, color: { argb: 'FF000000' } }
  noteCell.alignment = { wrapText: true, vertical: 'top' }
  ws.getRow(1).height = 45

  // Row 2: Headers
  HEADERS.forEach((h, i) => {
    const cell = ws.getCell(2, i + 1)
    cell.value = h.label
    cell.font = { bold: true, size: 10 }
    cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' }
    }
    if (h.required) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } }
    }
  })
  ws.getRow(2).height = 30

  // Data rows
  orders.forEach((o, idx) => {
    const row = orderToRow(o)
    const rowNum = idx + 3
    HEADERS.forEach((h, i) => {
      const cell = ws.getCell(rowNum, i + 1)
      cell.value = row[h.key]
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' }
      }
      cell.font = { size: 10 }
    })
  })

  // Download
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename || 'Orders_' + new Date().toISOString().split('T')[0] + '.xlsx'
  a.click()
}

export function exportProshipCSV(orders, filename) {
  const headerRow = HEADERS.map(h => h.label.split('\n')[0])
  const rows = [headerRow, ...orders.map(o => {
    const r = orderToRow(o)
    return HEADERS.map(h => r[h.key])
  })]
  const csv = '\uFEFF' + rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename || 'Orders_' + new Date().toISOString().split('T')[0] + '.csv'
  a.click()
}
