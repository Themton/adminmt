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
  const params = {
    outTradeNo: data.outTradeNo || ('MT' + Date.now()),
    expressCategory: '1',
    articleCategory: '99',
    weight: String(data.weight || 500),
  };

  // ผู้ส่ง (src)
  if (data.srcName) params.srcName = data.srcName;
  if (data.srcPhone) params.srcPhone = data.srcPhone;
  if (data.srcProvinceName) params.srcProvinceName = data.srcProvinceName;
  if (data.srcCityName) params.srcCityName = data.srcCityName;
  if (data.srcDistrictName) params.srcDistrictName = data.srcDistrictName;
  if (data.srcPostalCode) params.srcPostalCode = data.srcPostalCode;
  if (data.srcDetailAddress) params.srcDetailAddress = data.srcDetailAddress;

  // ผู้รับ (dst) — required
  if (data.dstName) params.dstName = data.dstName;
  if (data.dstPhone) params.dstPhone = data.dstPhone;
  if (data.dstProvinceName) params.dstProvinceName = data.dstProvinceName;
  if (data.dstCityName) params.dstCityName = data.dstCityName;
  if (data.dstDistrictName) params.dstDistrictName = data.dstDistrictName;
  if (data.dstPostalCode) params.dstPostalCode = data.dstPostalCode;
  if (data.dstDetailAddress) params.dstDetailAddress = data.dstDetailAddress;

  // ที่อยู่ส่งคืน (return) — ใช้ที่อยู่ผู้ส่ง
  params.returnName = data.srcName || '';
  params.returnPhone = data.srcPhone || '';
  params.returnProvinceName = data.srcProvinceName || '';
  params.returnCityName = data.srcCityName || '';
  params.returnDistrictName = data.srcDistrictName || '';
  params.returnPostalCode = data.srcPostalCode || '';
  params.returnDetailAddress = data.srcDetailAddress || '';

  // COD
  if (data.codEnabled && data.codAmount > 0) {
    params.codEnabled = '1';
    params.codAmount = String(data.codAmount);
  }

  // หมายเหตุ
  if (data.remark) params.remark = data.remark;

  return await callFlashAPI('/open/v1/orders', params);
}

// ═══ Print Label ═══
async function printLabel(data) {
  return await callFlashAPI('/open/v1/orders/label', { pno: data.pno });
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
