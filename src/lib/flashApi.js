// ═══ Flash Express API (ผ่าน Google Apps Script proxy) ═══
// ใส่ URL หลัง deploy Apps Script
const FLASH_PROXY_URL = ''

export async function createFlashOrder(order, srcInfo) {
  if (!FLASH_PROXY_URL) return { code: -1, message: 'กรุณาตั้งค่า Flash Express URL' }
  try {
    const res = await fetch(FLASH_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        order: {
          order_number: order.order_number,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          address: order.customer_address,
          sub_district: order.sub_district,
          district: order.district,
          province: order.province,
          zip_code: order.zip_code,
          cod_enabled: order.payment_type === 'cod' ? true : false,
          cod_amount: order.payment_type === 'cod' ? parseFloat(order.cod_amount) || 0 : 0,
          src_name: srcInfo?.name || 'THE MT',
          src_phone: srcInfo?.phone || '',
          src_province: srcInfo?.province || '',
          src_city: srcInfo?.city || '',
          src_district: srcInfo?.district || '',
          src_zip: srcInfo?.zip || '',
          src_address: srcInfo?.address || '',
        }
      })
    })
    return await res.json()
  } catch (err) {
    return { code: -1, message: err.message }
  }
}

export async function trackFlashOrder(pno) {
  if (!FLASH_PROXY_URL) return { code: -1, message: 'กรุณาตั้งค่า Flash Express URL' }
  try {
    const res = await fetch(FLASH_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'track', pno })
    })
    return await res.json()
  } catch (err) {
    return { code: -1, message: err.message }
  }
}

export async function cancelFlashOrder(pno) {
  if (!FLASH_PROXY_URL) return { code: -1, message: 'กรุณาตั้งค่า Flash Express URL' }
  try {
    const res = await fetch(FLASH_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel', pno })
    })
    return await res.json()
  } catch (err) {
    return { code: -1, message: err.message }
  }
}
