// ═══════════════════════════════════════════════════════════
// Flash Express API Proxy — Cloudflare Worker (Production)
// v2 — เพิ่ม debug mode + better error response
// ═══════════════════════════════════════════════════════════

const MCH_ID = 'CBC9351';
const API_KEY = '0d0b630e5e245149fe120a062c342b3f41ffaea51597464841e97d324b792334';
const BASE_URL = 'https://open-api.flashexpress.com';

// ═══ SHA256 Signature ═══
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function generateSign(params) {
  const filtered = {};
  for (const [k, v] of Object.entries(params)) {
    if (k !== 'sign' && v !== '' && v !== null && v !== undefined && String(v).trim() !== '') {
      filtered[k] = v;
    }
  }
  const sortedKeys = Object.keys(filtered).sort();
  const stringA = sortedKeys.map(k => `${k}=${filtered[k]}`).join('&');
  const stringSignTemp = stringA + '&key=' + API_KEY;
  return await sha256(stringSignTemp);
}

async function callFlashAPI(endpoint, params) {
  params.mchId = MCH_ID;
  params.nonceStr = Date.now().toString() + Math.random().toString(36).substring(2, 8);
  params.sign = await generateSign(params);

  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && String(v).trim() !== '') {
      body.append(k, String(v));
    }
  }

  const url = BASE_URL + endpoint;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const result = await response.json();

  // เพิ่ม debug info ใน response
  result._debug = {
    endpoint,
    sentParams: Object.fromEntries(
      Object.entries(params).filter(([k]) => k !== 'sign' && k !== 'nonceStr')
    ),
    httpStatus: response.status,
  };

  return result;
}

// ═══ CORS ═══
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

// ═══ Create Order ═══
async function createOrder(data) {
  // ทำให้ outTradeNo unique ทุกครั้ง (ป้องกันซ้ำ)
  const ts = Date.now().toString(36);
  const baseTradeNo = data.outTradeNo || ('MT' + Date.now());
  const params = {
    outTradeNo: baseTradeNo + '-' + ts,
    expressCategory: '1',
    articleCategory: '99',
    weight: String(data.weight || 500),
  };

  // helper: trim + ลบ space ซ้ำ
  const clean = (v) => v ? String(v).trim().replace(/\s+/g, ' ') : '';

  // ผู้ส่ง (src)
  if (data.srcName) params.srcName = clean(data.srcName);
  if (data.srcPhone) params.srcPhone = clean(data.srcPhone);
  if (data.srcProvinceName) params.srcProvinceName = clean(data.srcProvinceName);
  if (data.srcCityName) params.srcCityName = clean(data.srcCityName);
  if (data.srcDistrictName) params.srcDistrictName = clean(data.srcDistrictName);
  if (data.srcPostalCode) params.srcPostalCode = clean(data.srcPostalCode);
  if (data.srcDetailAddress) params.srcDetailAddress = clean(data.srcDetailAddress);

  // ผู้รับ (dst) — required
  if (data.dstName) params.dstName = clean(data.dstName);
  if (data.dstPhone) params.dstPhone = clean(data.dstPhone);
  if (data.dstProvinceName) params.dstProvinceName = clean(data.dstProvinceName);
  if (data.dstCityName) params.dstCityName = clean(data.dstCityName);
  if (data.dstDistrictName) params.dstDistrictName = clean(data.dstDistrictName);
  if (data.dstPostalCode) params.dstPostalCode = clean(data.dstPostalCode);
  if (data.dstDetailAddress) params.dstDetailAddress = clean(data.dstDetailAddress);

  // ที่อยู่ส่งคืน (return) — ใช้ที่อยู่ผู้ส่ง
  params.returnName = clean(data.srcName || '');
  params.returnPhone = clean(data.srcPhone || '');
  params.returnProvinceName = clean(data.srcProvinceName || '');
  params.returnCityName = clean(data.srcCityName || '');
  params.returnDistrictName = clean(data.srcDistrictName || '');
  params.returnPostalCode = clean(data.srcPostalCode || '');
  params.returnDetailAddress = clean(data.srcDetailAddress || '');

  // COD — Flash อาจต้องการหน่วยสตางค์ (x100)
  if (data.codEnabled && data.codAmount > 0) {
    params.codEnabled = '1';
    // ถ้า codAmount < 1000 แปลว่าหน่วยบาท → คูณ 100 เป็นสตางค์
    const amt = Number(data.codAmount);
    params.codAmount = String(amt < 1000 ? amt * 100 : amt);
  }

  // หมายเหตุ
  if (data.remark) params.remark = clean(data.remark);

  return await callFlashAPI('/open/v1/orders', params);
}

// ═══ Print Label ═══
async function printLabel(data) {
  const params = { pno: data.pno };
  if (data.outTradeNo) params.outTradeNo = data.outTradeNo;
  // Flash อาจต้องการ type: 1=รูป, 2=PDF, 3=HTML
  params.type = String(data.type || 1);
  return await callFlashAPI('/open/v1/orders/label', params);
}

// ═══ Notify Courier ═══
async function notifyCourier(data) {
  const pnoList = data.pnoList || [data.pno];
  return await callFlashAPI('/open/v1/orders/notify', { pnoList: JSON.stringify(pnoList) });
}

// ═══ Track ═══
async function trackOrder(data) {
  return await callFlashAPI('/open/v1/orders/tracking', { pno: data.pno });
}

// ═══ Cancel ═══
async function cancelOrder(data) {
  return await callFlashAPI('/open/v1/orders/cancel', { pno: data.pno });
}

// ═══ Worker Entry ═══
export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    if (request.method === 'GET') {
      return jsonResponse({ code: 1, message: 'Flash Express Proxy (Cloudflare Worker) is ready!', env: 'production', mchId: MCH_ID, endpoints: ['create', 'label', 'notify', 'track', 'cancel', 'ping'] });
    }
    try {
      const data = await request.json();
      let result;
      switch (data.action) {
        case 'create': result = await createOrder(data); break;
        case 'label': result = await printLabel(data); break;
        case 'notify': result = await notifyCourier(data); break;
        case 'track': result = await trackOrder(data); break;
        case 'cancel': result = await cancelOrder(data); break;
        case 'ping': result = { code: 1, message: 'OK', env: 'production', mchId: MCH_ID }; break;
        default: result = { code: -1, message: 'Unknown action: ' + data.action };
      }
      return jsonResponse(result);
    } catch (err) {
      return jsonResponse({ code: -1, message: err.message, stack: err.stack }, 500);
    }
  },
};
