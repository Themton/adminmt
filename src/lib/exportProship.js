// ═══ Export Proship Format ═══

const PROSHIP_NOTE = 'ช่องสีแดงต้องกรอก ช่องสีขาวไม่จำเป็น\nอำเภอ จังหวัด หากสกดผิด ระบบจะไม่นำเข้าให้\nเบอร์มือถือ ต้องครบ 10 หลัก ไม่สามารถใช้เบอร์ 02 ได้'

const PROSHIP_HEADERS = [
  'MobileNo*\nเบอร์มือถือ',
  'Name\nชื่อ',
  'Address\nที่อยู่',
  'SubDistrict\nตำบล',
  'District\nอำเภอ',
  'ZIP\nรหัส ปณ.',
  'Customer FB/Line\nเฟส/ไลน์ลูกค้า',
  'SalesChannel\nช่องทางจำหน่าย',
  'SalesPerson\nชื่อแอดมิน',
  'SalePrice\nราคาขาย',
  'COD*\nยอดเก็บเงินปลายทาง',
  'Remark\nหมายเหตุ',
]

function orderToProship(o) {
  return [
    o.customer_phone || '',
    o.customer_name || '',
    o.customer_address || '',
    o.sub_district || '',
    o.district || '',
    o.zip_code || '',
    o.customer_social || '',
    o.sales_channel || '',
    o.employee_name || '',
    o.sale_price || '',
    o.cod_amount || '',
    o.remark || '',
  ]
}

export function exportProshipExcel(orders, filename) {
  const headerRow = '<tr><th colspan="12" style="background:#fff3cd;font-size:10px;text-align:left;white-space:pre-wrap">' + PROSHIP_NOTE.replace(/\n/g, '<br>') + '</th></tr>'
  const colHeaders = '<tr>' + PROSHIP_HEADERS.map(h => '<th style="background:#f8d7da;font-weight:bold;white-space:pre-wrap;font-size:11px">' + h.replace(/\n/g, '<br>') + '</th>').join('') + '</tr>'
  const body = orders.map(o => '<tr>' + orderToProship(o).map(c => '<td>' + c + '</td>').join('') + '</tr>').join('')
  const html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Orders</x:Name></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table border="1">' + headerRow + colHeaders + body + '</table></body></html>'
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename || 'Orders_' + new Date().toISOString().split('T')[0] + '.xls'
  a.click()
}

export function exportProshipCSV(orders, filename) {
  const rows = [PROSHIP_HEADERS.map(h => h.split('\n')[0]), ...orders.map(o => orderToProship(o))]
  const csv = '\uFEFF' + rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename || 'Orders_' + new Date().toISOString().split('T')[0] + '.csv'
  a.click()
}
