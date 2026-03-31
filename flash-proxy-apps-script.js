// ═══════════════════════════════════════════════════════
// Flash Express API Proxy — Google Apps Script
// ═══════════════════════════════════════════════════════
// วิธีใช้:
// 1. ไปที่ https://script.google.com → สร้างโปรเจคใหม่
// 2. วางโค้ดนี้ทั้งหมด
// 3. แก้ MCH_ID + API_KEY ด้านล่าง
// 4. Deploy → New deployment → Web app → Anyone → Deploy
// 5. Copy URL ไปใส่ในระบบ (⚙️ ตั้งค่า Flash)
// ═══════════════════════════════════════════════════════

// ═══ แก้ตรงนี้ ═══
var MCH_ID  = 'CA5610';
var API_KEY = '0bc50ae59546a42fe64dca031005fdb1528486214ec0a4c01551d4f7f762a84c';
var ENV     = 'training'; // 'training' หรือ 'production'
// ═════════════════

var BASE_URL = ENV === 'production'
  ? 'https://open-api.flashexpress.com'
  : 'https://open-api-tra.flashexpress.com';

// ═══ SHA256 Signature ═══
function sha256(str) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
  return raw.map(function(b) { return ('0' + ((b < 0 ? b + 256 : b)).toString(16)).slice(-2); }).join('').toUpperCase();
}

function generateSign(params) {
  var keys = Object.keys(params).filter(function(k) {
    return k !== 'sign' && params[k] !== '' && params[k] !== null && params[k] !== undefined;
  }).sort();
  var stringA = keys.map(function(k) { return k + '=' + params[k]; }).join('&');
  return sha256(stringA + '&key=' + API_KEY);
}

function buildPayload(params) {
  params.mchId = MCH_ID;
  params.nonceStr = '' + new Date().getTime() + Math.random().toString(36).substring(2, 8);
  params.sign = generateSign(params);
  return Object.keys(params).map(function(k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');
}

function callFlashAPI(endpoint, params) {
  var url = BASE_URL + endpoint;
  var payload = buildPayload(params);
  var options = {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: payload,
    muteHttpExceptions: true
  };
  try {
    var response = UrlFetchApp.fetch(url, options);
    return JSON.parse(response.getContentText());
  } catch (e) {
    return { code: -1, message: e.message };
  }
}

// ═══ Handlers ═══

// 1. Create Order — สร้างรายการจัดส่ง
function createOrder(data) {
  var params = {
    outTradeNo: data.outTradeNo || ('ORD' + new Date().getTime()),
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
    weight: String(data.weight || 500)
  };
  // COD
  if (data.codEnabled) {
    params.codEnabled = '1';
    params.codAmount = String(data.codAmount || 0);
  }
  // Remark
  if (data.remark) params.remark = data.remark;
  // Insured
  if (data.insured) {
    params.insured = '1';
    params.insureDeclareValue = String(data.insureDeclareValue || 0);
  }

  return callFlashAPI('/open/v1/orders', params);
}

// 2. Print Label — ปริ้นใบปะหน้า
function printLabel(data) {
  var params = { pno: data.pno };
  if (data.outTradeNo) params.outTradeNo = data.outTradeNo;
  return callFlashAPI('/open/v1/orders/label', params);
}

// 3. Notify Courier — เรียกพนักงานเข้ารับพัสดุ
function notifyCourier(data) {
  var pnoList = data.pnoList || [data.pno];
  var params = { pnoList: JSON.stringify(pnoList) };
  return callFlashAPI('/open/v1/orders/notify', params);
}

// 4. Status Tracking — ตรวจสอบสถานะพัสดุ
function trackOrder(data) {
  var params = { pno: data.pno };
  return callFlashAPI('/open/v1/orders/tracking', params);
}

// ═══ Web App Entry Points ═══
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var action = data.action || '';
  var result;

  switch (action) {
    case 'create':
      result = createOrder(data);
      break;
    case 'label':
      result = printLabel(data);
      break;
    case 'notify':
      result = notifyCourier(data);
      break;
    case 'track':
      result = trackOrder(data);
      break;
    case 'ping':
      result = { code: 1, message: 'Flash Proxy OK', env: ENV, mchId: MCH_ID };
      break;
    default:
      result = { code: -1, message: 'Unknown action: ' + action };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({
    code: 1,
    message: 'Flash Express Proxy is ready!',
    env: ENV,
    mchId: MCH_ID,
    endpoints: ['create', 'label', 'notify', 'track', 'ping']
  })).setMimeType(ContentService.MimeType.JSON);
}
