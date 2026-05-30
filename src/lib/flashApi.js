// ═══ Flash Express API (ผ่าน Google Apps Script proxy) ═══
// ใส่ URL หลัง deploy Apps Script ที่ ⚙️ ตั้งค่า Flash ในแอป
const FLASH_PROXY_URL = ''

function getProxyUrl() {
  try { return localStorage.getItem('flash_proxy_url') || FLASH_PROXY_URL }
  catch { return FLASH_PROXY_URL }
}

async function callProxy(payload, retries = 2) {
  const url = getProxyUrl()
  if (!url) return { code: -1, message: 'กรุณาตั้งค่า Flash Express URL\n⚙️ ตั้งค่า Flash → ใส่ URL ของ Apps Script' }
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      return await res.json()
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }
      return { code: -1, message: 'เชื่อมต่อไม่ได้หลังลอง ' + (retries + 1) + ' ครั้ง: ' + err.message }
    }
  }
}

// 1. Create Order — สร้างรายการจัดส่ง → ได้ tracking number (pno)
export async function createFlashOrder(order, srcInfo) {
  const phone = (order.customer_phone || '').replace(/\D/g, '')
  if (!phone || phone.length !== 10 || !/^0[689]/.test(phone)) {
    return { code: -1, message: 'เบอร์โทรไม่ถูกต้อง: ต้อง 10 หลัก เริ่มด้วย 06/08/09 (' + (order.customer_phone || 'ว่าง') + ')' }
  }
  if (!order.customer_name?.trim()) {
    return { code: -1, message: 'ไม่มีชื่อลูกค้า' }
  }
  if (!order.province?.trim() || !order.district?.trim()) {
    return { code: -1, message: 'ที่อยู่ไม่ครบ: ต้องมีจังหวัดและอำเภอ' }
  }
  return callProxy({
    action: 'create',
    outTradeNo: order.order_number || ('ORD' + Date.now()),
    expressCategory: 1,
    srcName: srcInfo?.name || 'THE MT',
    srcPhone: srcInfo?.phone || '',
    srcProvinceName: srcInfo?.province || '',
    srcCityName: srcInfo?.city || '',
    srcDistrictName: srcInfo?.district || '',
    srcPostalCode: srcInfo?.zip || '',
    srcDetailAddress: srcInfo?.address || '',
    dstName: order.customer_name,
    dstPhone: order.customer_phone,
    dstProvinceName: order.province || '',
    dstCityName: order.district || '',
    dstDistrictName: order.sub_district || '',
    dstPostalCode: order.zip_code || '',
    dstDetailAddress: order.customer_address || '',
    articleCategory: 1,
    weight: 500,
    codEnabled: order.payment_type === 'cod',
    codAmount: order.payment_type === 'cod' ? (parseFloat(order.cod_amount) || 0) : 0,
    remark: order.remark || ''
  })
}

// 2. Print Label — ปริ้นใบปะหน้า
export async function printFlashLabel(pno) {
  return callProxy({ action: 'label', pno })
}

// 3. Notify Courier — เรียกพนักงานเข้ารับพัสดุ
export async function notifyFlashCourier(pnoList) {
  const list = Array.isArray(pnoList) ? pnoList : [pnoList]
  return callProxy({ action: 'notify', pnoList: list })
}

// 4. Status Tracking — ตรวจสอบสถานะพัสดุ
export async function trackFlashOrder(pno) {
  return callProxy({ action: 'track', pno })
}

// Cancel Order — ยกเลิกออเดอร์
export async function cancelFlashOrder(pno) {
  return callProxy({ action: 'cancel', pno })
}

// Ping — ทดสอบการเชื่อมต่อ
export async function pingFlash() {
  return callProxy({ action: 'ping' })
}
