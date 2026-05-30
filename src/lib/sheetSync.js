// ═══ Google Sheet Realtime Sync ═══
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbwKi1cYjJ4hFGQlXUaa8R3C5fWNApFhgWFfKQ0pptD2CSwKRGqkLpgAiKfVzsupc-le/exec'

function toThaiTime(d) {
  if (!d) return ''
  const dt = new Date(d)
  return dt.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function orderToRow(o, profiles) {
  return {
    seq: o.daily_seq || '',
    phone: o.customer_phone, name: o.customer_name,
    address: o.customer_address, sub_district: o.sub_district,
    district: o.district, zip: o.zip_code,
    fb: o.customer_social, channel: o.sales_channel,
    admin: o.employee_name || (profiles || []).find(p => p.id === o.employee_id)?.full_name || '',
    price: o.sale_price, cod: o.cod_amount,
    remark: o.remark, province: o.province || '',
    slip: o.slip_url || '', order_number: o.order_number,
    created_at: toThaiTime(o.created_at),
  }
}

// Fix #8: ลบ mode: 'no-cors' + เพิ่ม async/await + error logging
async function postSheet(payload) {
  if (!SHEET_URL) return
  try {
    const res = await fetch(SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) console.warn('Sheet sync HTTP error:', res.status)
  } catch (err) {
    console.warn('Sheet sync failed:', err.message)
  }
}

export function syncOrderToSheet(order, employeeName) {
  postSheet({ action: 'sync', orders: [orderToRow(order)] })
}

export function updateOrderInSheet(order) {
  postSheet({ action: 'update', orders: [orderToRow(order)] })
}

export function deleteOrderFromSheet(orderNumber) {
  if (!orderNumber) return
  postSheet({ action: 'delete', order_number: orderNumber })
}

export function syncAllToSheet(orders, profiles) {
  if (!orders.length) return
  postSheet({ action: 'sync', orders: orders.map(o => orderToRow(o, profiles)) })
}

export function resetSheet(orders, profiles) {
  const sorted = [...orders].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  postSheet({ action: 'reset', orders: sorted.map(o => orderToRow(o, profiles)) })
}
