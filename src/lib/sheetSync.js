// ═══ Google Sheet Realtime Sync ═══
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbwvYeK51MfcADKKBPVuUBrjo22fdTQB1pdocWSCjGwBaJt0Oa5pYqa5l5KjlTpaMe1U/exec'

function toThaiTime(d) {
  if (!d) return ''
  const dt = new Date(d)
  return dt.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function orderToRow(o, profiles) {
  return {
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

export function syncOrderToSheet(order, employeeName) {
  if (!SHEET_URL) return
  try {
    fetch(SHEET_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync', orders: [orderToRow(order)] })
    })
  } catch {}
}

export function updateOrderInSheet(order) {
  if (!SHEET_URL) return
  try {
    fetch(SHEET_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', orders: [orderToRow(order)] })
    })
  } catch {}
}

export function deleteOrderFromSheet(orderNumber) {
  if (!SHEET_URL || !orderNumber) return
  try {
    fetch(SHEET_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', order_number: orderNumber })
    })
  } catch {}
}

export function syncAllToSheet(orders, profiles) {
  if (!SHEET_URL || !orders.length) return
  try {
    fetch(SHEET_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync', orders: orders.map(o => orderToRow(o, profiles)) })
    })
  } catch {}
}

export function resetSheet(orders, profiles) {
  if (!SHEET_URL) return
  try {
    const sorted = [...orders].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    fetch(SHEET_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset', orders: sorted.map(o => orderToRow(o, profiles)) })
    })
  } catch {}
}
