// ═══════════════════════════════════════════════════════════
// Flash Express API Proxy — Cloudflare Worker (Production)
// ═══════════════════════════════════════════════════════════
// Deploy: https://dash.cloudflare.com → Workers & Pages → Create
// วาง code นี้ → Deploy
// ═══════════════════════════════════════════════════════════

const MCH_ID = 'CBC9351';
const API_KEY = '0d0b630e5e245149fe120a062c342b3f41ffaea51597464841e97d324b79233';
const BASE_URL = 'https://open-api.flashexpress.com';

// ═══ SHA256 Signature ═══
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function generateSign(params) {
  const filtered = {};
  for (const [k, v] of Object.entries(params)) {
    if (k !== 'sign' && v !== '' && v !== null && v !== undefined) {
      filtered[k] = v;
    }
  }
  const sortedKeys = Object.keys(filtered).sort();
  const stringA = sortedKeys.map(k => `${k}=${filtered[k]}`).join('&');
  return await sha256(stringA + '&key=' + API_KEY);
}

async function buildFormBody(params) {
  params.mchId = MCH_ID;
  params.nonceStr = Date.now().toString() + Math.random().toString(36).substring(2, 8);
  params.sign = await generateSign(params);

  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') {
      body.append(k, String(v));
    }
  }
  return body;
}

async function callFlashAPI(endpoint, params) {
  const url = BASE_URL + endpoint;
  const body = await buildFormBody(params);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  return await response.json();
}

// ═══ CORS Headers ═══
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

// ═══ API Handlers ═══

// 1. Create Order — สร้างรายการจัดส่ง
async function createOrder(data) {
  const params = {
    outTradeNo: data.outTradeNo || ('ORD' + Date.now()),
    expressCategory: String(data.expressCategory || 1),
    srcName: data.srcName || '',
    srcPhone: data.srcPhone || '',
    srcProvinceName: data.srcProvinceName || '',
    srcCityName: data.srcCityName || '',
    srcDistrictName: data.srcDistrictName || '',
    srcPostalCode: data.srcPostalCode || '',
    srcDetailAddress: data.srcDetailAddress || '',
    dstName: data.dstName || '',
    dstPhone: data.dstPhone || '',
    dstProvinceName: data.dstProvinceName || '',
    dstCityName: data.dstCityName || '',
    dstDistrictName: data.dstDistrictName || '',
    dstPostalCode: data.dstPostalCode || '',
    dstDetailAddress: data.dstDetailAddress || '',
    articleCategory: String(data.articleCategory || 1),
    weight: String(data.weight || 500),
  };

  if (data.codEnabled) {
    params.codEnabled = '1';
    params.codAmount = String(data.codAmount || 0);
  }
  if (data.remark) params.remark = data.remark;
  if (data.insured) {
    params.insured = '1';
    params.insureDeclareValue = String(data.insureDeclareValue || 0);
  }

  return await callFlashAPI('/open/v1/orders', params);
}

// 2. Print Label — ปริ้นใบปะหน้า
async function printLabel(data) {
  const params = { pno: data.pno };
  if (data.outTradeNo) params.outTradeNo = data.outTradeNo;
  return await callFlashAPI('/open/v1/orders/label', params);
}

// 3. Notify Courier — เรียกพนักงานเข้ารับพัสดุ
async function notifyCourier(data) {
  const pnoList = data.pnoList || [data.pno];
  const params = { pnoList: JSON.stringify(pnoList) };
  return await callFlashAPI('/open/v1/orders/notify', params);
}

// 4. Status Tracking — ตรวจสอบสถานะ
async function trackOrder(data) {
  const params = { pno: data.pno };
  return await callFlashAPI('/open/v1/orders/tracking', params);
}

// 5. Cancel Order — ยกเลิกออเดอร์
async function cancelOrder(data) {
  const params = { pno: data.pno };
  return await callFlashAPI('/open/v1/orders/cancel', params);
}

// ═══ Worker Entry Point ═══
export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // GET = health check
    if (request.method === 'GET') {
      return jsonResponse({
        code: 1,
        message: 'Flash Express Proxy (Cloudflare Worker) is ready!',
        env: 'production',
        mchId: MCH_ID,
        endpoints: ['create', 'label', 'notify', 'track', 'cancel', 'ping'],
      });
    }

    // POST = API calls
    try {
      const data = await request.json();
      const action = data.action || '';
      let result;

      switch (action) {
        case 'create':
          result = await createOrder(data);
          break;
        case 'label':
          result = await printLabel(data);
          break;
        case 'notify':
          result = await notifyCourier(data);
          break;
        case 'track':
          result = await trackOrder(data);
          break;
        case 'cancel':
          result = await cancelOrder(data);
          break;
        case 'ping':
          result = { code: 1, message: 'OK', env: 'production', mchId: MCH_ID };
          break;
        default:
          result = { code: -1, message: 'Unknown action: ' + action };
      }

      return jsonResponse(result);
    } catch (err) {
      return jsonResponse({ code: -1, message: err.message }, 500);
    }
  },
};
