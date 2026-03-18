function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  var action = data.action || 'sync';

  // ═══ RESET — ลบทั้ง Sheet แล้วใส่ใหม่ทั้งหมด ═══
  if (action === 'reset') {
    sheet.clear();
    sheet.appendRow(['เบอร์โทร','ชื่อ','ที่อยู่','ตำบล','อำเภอ','รหัส ปณ.','FB/Line','เพจ','แอดมิน','ราคาขาย','COD','หมายเหตุ','จังหวัด','สลิป','วันเวลาบันทึก','OrderID']);
    var h = sheet.getRange(1,1,1,16);
    h.setFontWeight('bold').setBackground('#B8860B').setFontColor('#FFFFFF');
    sheet.setColumnWidth(14, 300);
    sheet.setColumnWidth(15, 160);
    sheet.setColumnWidth(16, 1);
    sheet.setRowHeight(1, 40);

    var orders = data.orders || [];
    var added = 0;
    orders.forEach(function(o) {
      var timestamp = o.created_at || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm');
      sheet.appendRow([
        o.phone, o.name, o.address, o.sub_district, o.district, o.zip,
        o.fb, o.channel, o.admin, o.price, o.cod, o.remark,
        o.province, '', timestamp, o.order_number
      ]);
      if (o.slip && o.slip.length > 5) {
        var row = sheet.getLastRow();
        sheet.getRange(row, 14).setFormula('=IMAGE("' + o.slip + '", 1)');
        sheet.setRowHeight(row, 200);
      }
      added++;
    });
    return ContentService.createTextOutput(JSON.stringify({ok:true, action:'reset', added:added})).setMimeType(ContentService.MimeType.JSON);
  }

  // ═══ DELETE ═══
  if (action === 'delete') {
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return ContentService.createTextOutput('{"ok":true}');
    var col = sheet.getRange(2, 16, lastRow - 1, 1).getValues();
    for (var i = col.length - 1; i >= 0; i--) {
      if (col[i][0] === data.order_number) sheet.deleteRow(i + 2);
    }
    return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
  }

  // ═══ SYNC ═══
  var orders = data.orders || [];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['เบอร์โทร','ชื่อ','ที่อยู่','ตำบล','อำเภอ','รหัส ปณ.','FB/Line','เพจ','แอดมิน','ราคาขาย','COD','หมายเหตุ','จังหวัด','สลิป','วันเวลาบันทึก','OrderID']);
    var h = sheet.getRange(1,1,1,16);
    h.setFontWeight('bold').setBackground('#B8860B').setFontColor('#FFFFFF');
    sheet.setColumnWidth(14, 300);
    sheet.setColumnWidth(15, 160);
    sheet.setColumnWidth(16, 1);
    sheet.setRowHeight(1, 40);
  }

  var existing = {};
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    try {
      var col = sheet.getRange(2, 16, lastRow - 1, 1).getValues();
      col.forEach(function(r) { if (r[0]) existing[r[0]] = true; });
    } catch(e) {}
  }

  var added = 0;
  orders.forEach(function(o) {
    if (!existing[o.order_number]) {
      var timestamp = o.created_at || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm');
      sheet.appendRow([
        o.phone, o.name, o.address, o.sub_district, o.district, o.zip,
        o.fb, o.channel, o.admin, o.price, o.cod, o.remark,
        o.province, '', timestamp, o.order_number
      ]);
      if (o.slip && o.slip.length > 5) {
        var row = sheet.getLastRow();
        sheet.getRange(row, 14).setFormula('=IMAGE("' + o.slip + '", 1)');
        sheet.setRowHeight(row, 200);
      }
      added++;
      existing[o.order_number] = true;
    }
  });

  return ContentService.createTextOutput(JSON.stringify({ok:true, added:added})).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput('ADMIN THE MT Backup is ready!');
}
