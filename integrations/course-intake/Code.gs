const SHEET_NAME = '測驗回覆';

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    const data = e && e.postData && e.postData.contents
      ? JSON.parse(e.postData.contents)
      : {};

    const submissionId = data.submissionId || '';
    if (submissionId && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId)) throw new Error('Invalid submission ID');
    if (submissionId && sheet.getLastRow() > 1 && sheet.getMaxColumns() >= 30) {
      const ids = sheet.getRange(2, 30, sheet.getLastRow()-1, 1).getValues();
      const found = ids.findIndex(r => r[0] === submissionId);
      if (found >= 0) return ContentService.createTextOutput(JSON.stringify({status:'success',submissionId:submissionId,row:found+2})).setMimeType(ContentService.MimeType.JSON);
    }
    const headers = [
      '送出時間',
      '姓名',
      '性別',
      '上過課程',
      '來上課的目的',
      '喜歡的香水名稱或品牌',
      '偏好的氣味類型',
      '還想進修',
      '測驗結果',
      '英文分類',
      'Atlas No.',
      'Origin',
      'Instrument',
      'Scent Direction',
      'Taste',
      'A 分數',
      'B 分數',
      'C 分數',
      'D 分數',
      'E 分數',
      'F 分數',
      'G 分數',
      '答題紀錄',
      '角色檔案',
      '氣味方向',
      '推薦原料方向',
      '配方方向',
      '感官線索',
      '資料使用同意'
    ];

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
    }

    const p = data.profile || {};
    const s = data.scores || {};
    const row = [
      data.submittedAt || new Date(),
      data.name || '',
      data.gender || '',
      Array.isArray(data.courses) ? data.courses.join('、') : '',
      Array.isArray(data.purpose) ? data.purpose.join('、') : '',
      data.favoritePerfume || '',
      Array.isArray(data.preferredFamily) ? data.preferredFamily.join('、') : '',
      data.studyMore || '',
      p.type || '',
      p.english || '',
      p.atlasNo || '',
      p.origin || '',
      p.instrument || '',
      p.scentShort || '',
      p.taste || '',
      s.A || 0,
      s.B || 0,
      s.C || 0,
      s.D || 0,
      s.E || 0,
      s.F || 0,
      s.G || 0,
      Array.isArray(data.answerLog) ? data.answerLog.join('\n') : '',
      p.desc || '',
      p.families || '',
      p.materials || '',
      p.formula || '',
      p.advice || '',
      data.consentText || ''
    ];

    if (sheet.getMaxColumns() < 30) sheet.insertColumnsAfter(sheet.getMaxColumns(), 30-sheet.getMaxColumns());
    sheet.getRange(1,30).setValue('HANA Submission ID');
    row.push(submissionId);
    sheet.appendRow(row.map(v => typeof v === 'string' && /^[=+@-]/.test(v) ? String.fromCharCode(39)+v : v));
    const savedRow = sheet.getLastRow();
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success', submissionId: submissionId, row: savedRow }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally { lock.releaseLock(); }
}

// 這個只是給你在 Apps Script 內按「執行」測試用，正式回傳是網頁送出時呼叫 doPost。
function testDoPost() {
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({
        submittedAt: new Date().toISOString(),
        name: '測試學生',
        gender: '未填寫',
        courses: ['測試課程'],
        purpose: ['喜歡香氣'],
        favoritePerfume: 'Test Perfume',
        preferredFamily: ['茶感／綠意｜Tea / Green'],
        studyMore: '想了解進階課程',
        scores: { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7 },
        answerLog: ['1. 測試選項（A）'],
        profile: {
          type: 'Tealu｜Tealune',
          english: 'Tea & Air｜White Tone Tea Hills',
          atlasNo: '06',
          origin: 'White Tone Tea Hills',
          instrument: 'Tea-Breath Recorder',
          scentShort: 'Tea・Green・Transparent Floral・White Musk',
          taste: 'Sencha・Rice sweets・White grape・Wagashi',
          desc: '測試角色檔案',
          families: '測試氣味方向',
          materials: '測試原料方向',
          formula: '測試配方方向',
          advice: '測試感官線索'
        },
        consentText: '已同意資料使用。'
      })
    }
  };
  Logger.log(doPost(fakeEvent).getContent());
}

