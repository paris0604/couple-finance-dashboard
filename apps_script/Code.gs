/***** 우리집 자산 대시보드 — Apps Script 백엔드 *****
 * 가계부/포트폴리오 시트를 읽어 프론트(WF) 구조로 내려주고,
 * 빠른입력(POST)으로 가계부에 행을 추가한다. 서비스계정 불필요(소유자 권한).
 *
 * 배포: 확장 프로그램 → Apps Script 에 붙여넣기 → 배포 → 새 배포 → 웹 앱
 *   - 실행: 나 / 액세스: 모든 사용자  → 웹앱 URL(.../exec)을 web/config.js 에 입력
 ****************************************************/

var CONFIG = {
  LEDGER_ID: '1W5Enm5Al3UuW9uxhDuuRWCH3qsYwQt4LaDuygIxtAAg',
  LEDGER_TAB: '가계부',
  INVEST_ID: '1LbdkfGt6HTupOh6r95TgzYEhRRDjmtM3Ljp2urSIKlc',
  INVEST_TAB: 'transactions',
};

var LEDGER_COLS = ['거래ID', '날짜', '구분', '분류', '금액', '지출구분', '결제수단', '메모'];
var FIXED = ['주거', '통신', '보험', '구독', '교통(정액)', '대출원금상환'];
var VARIABLE = ['식비-장보기', '식비-외식', '식비-카페', '생활용품', '교통(비정기)', '의료', '문화·여가', '의류·미용', '웨딩', '경조사', '기타'];
var ALLOWANCE = '용돈';
var INCOME_CATS = ['지영 급여', '승화 급여', '상여·보너스', '기타수입'];
var SHARE_OF = { '공통': 'common', '지영': 'jiyoung', '승화': 'seunghwa' };
var EMOJI = {
  '주거': '🏠', '통신': '📱', '보험': '🛡️', '구독': '🕹️', '교통(정액)': '🚌', '대출원금상환': '🏦',
  '식비-장보기': '🛒', '식비-외식': '🍽️', '식비-카페': '☕', '생활용품': '🧻', '교통(비정기)': '🚌',
  '의료': '💊', '문화·여가': '🎬', '의류·미용': '🛍️', '웨딩': '💍', '경조사': '💐', '기타': '📦',
  '용돈': '💸', '지영 급여': '💰', '승화 급여': '💰', '상여·보너스': '💰', '기타수입': '➕',
};

/* ---------- 유틸 ---------- */
function num(v) {
  if (typeof v === 'number') return v;
  if (v == null) return 0;
  var s = String(v).replace(/[^\d.\-]/g, '');
  return s === '' ? 0 : parseFloat(s);
}
function ymd(v) {
  if (v instanceof Date) {
    return v.getFullYear() + '-' + ('0' + (v.getMonth() + 1)).slice(-2) + '-' + ('0' + v.getDate()).slice(-2);
  }
  var s = String(v).trim();
  var m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  return s;
}
function readSheet(id, tab) {
  var sh = SpreadsheetApp.openById(id).getSheetByName(tab);
  if (!sh) return [];
  var vals = sh.getDataRange().getValues();
  if (vals.length < 2) return [];
  var head = vals[0].map(function (h) { return String(h).trim(); });
  var out = [];
  for (var i = 1; i < vals.length; i++) {
    var o = {}, blank = true;
    for (var c = 0; c < head.length; c++) { o[head[c]] = vals[i][c]; if (vals[i][c] !== '' && vals[i][c] != null) blank = false; }
    if (!blank) out.push(o);
  }
  return out;
}
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- 투자 행 → 원화 순투입 ---------- */
function investVal(r) {
  var sign = String(r['action']).toLowerCase() === 'sell' ? -1 : 1;
  var fx = num(r['fx_rate']) || 1;
  return sign * num(r['quantity']) * num(r['price']) * fx + num(r['fee_krw']);
}

/* ---------- 집계 → WF ---------- */
function buildWF(month) {
  var L = readSheet(CONFIG.LEDGER_ID, CONFIG.LEDGER_TAB);
  var I = readSheet(CONFIG.INVEST_ID, CONFIG.INVEST_TAB);

  L.forEach(function (r) { r._date = ymd(r['날짜']); r._ym = r._date.slice(0, 7); r._amt = num(r['금액']); });
  I.forEach(function (r) { r._date = ymd(r['date']); r._ym = r._date.slice(0, 7); r._val = investVal(r); });

  var months = [];
  L.forEach(function (r) { if (r._ym && months.indexOf(r._ym) < 0) months.push(r._ym); });
  months.sort(function (a, b) { return a < b ? 1 : -1; }); // 최신순
  if (!month || months.indexOf(month) < 0) month = months[0] || new Date().toISOString().slice(0, 7);

  var mRows = L.filter(function (r) { return r._ym === month; });
  var inc = mRows.filter(function (r) { return r['구분'] === '수입'; });
  var exp = mRows.filter(function (r) { return r['구분'] === '지출'; });
  var sum = function (a) { return a.reduce(function (s, r) { return s + r._amt; }, 0); };

  var incomeTotal = sum(inc);
  var totalWith = sum(exp);
  var totalNo = sum(exp.filter(function (r) { return r['분류'] !== '웨딩'; }));
  var fixed = sum(exp.filter(function (r) { return FIXED.indexOf(r['분류']) >= 0; }));
  var variable = sum(exp.filter(function (r) { return VARIABLE.indexOf(r['분류']) >= 0; }));

  // byShare
  var shareAgg = { '공통': 0, '지영': 0, '승화': 0 };
  exp.forEach(function (r) { var o = r['지출구분'] || '공통'; if (shareAgg[o] == null) o = '공통'; shareAgg[o] += r._amt; });
  var byShare = [['공통', 'common'], ['지영', 'jiyoung'], ['승화', 'seunghwa']].map(function (p) {
    return { key: p[1], label: p[0], amount: shareAgg[p[0]] };
  });

  // byCategory (용돈 제외)
  var catMap = {};
  exp.forEach(function (r) {
    var c = r['분류']; if (c === ALLOWANCE) return;
    if (!catMap[c]) catMap[c] = { label: c, emoji: EMOJI[c] || '📦', amount: 0, group: FIXED.indexOf(c) >= 0 ? 'fix' : 'var', shareAgg: {} };
    catMap[c].amount += r._amt;
    var o = r['지출구분'] || '공통'; catMap[c].shareAgg[o] = (catMap[c].shareAgg[o] || 0) + r._amt;
  });
  var byCategory = Object.keys(catMap).map(function (c) {
    var x = catMap[c], best = '공통', bv = -1;
    for (var o in x.shareAgg) if (x.shareAgg[o] > bv) { bv = x.shareAgg[o]; best = o; }
    return { label: x.label, emoji: x.emoji, amount: x.amount, group: x.group, share: SHARE_OF[best] || 'common' };
  }).sort(function (a, b) { return b.amount - a.amount; });

  // 수입 items
  var incMap = {};
  inc.forEach(function (r) {
    var c = r['분류']; if (!incMap[c]) incMap[c] = 0; incMap[c] += r._amt;
  });
  var incomeItems = Object.keys(incMap).map(function (c) {
    var who = c.indexOf('지영') >= 0 ? 'jiyoung' : c.indexOf('승화') >= 0 ? 'seunghwa' : 'common';
    return { who: who, label: c, emoji: EMOJI[c] || '💰', amount: incMap[c] };
  });

  // KPI
  var expenseKpi = totalNo;
  var saving = incomeTotal - expenseKpi;
  var savingRate = incomeTotal > 0 ? Math.round(saving / incomeTotal * 100) : 0;
  var savingRateW = incomeTotal > 0 ? Math.round((incomeTotal - totalWith) / incomeTotal * 100) : 0;

  // 순자산 (누적 ≤ month)
  var houseBal = 0;
  L.forEach(function (r) { if (r._ym <= month) houseBal += (r['구분'] === '수입' ? r._amt : -r._amt); });
  var investPrin = 0;
  I.forEach(function (r) { if (r._ym <= month) investPrin += r._val; });
  // 현금 잔액 = 누적(수입−지출) − 투자납입 (투자한 돈은 현금에서 빠진 것)
  // 순자산 = 현금잔액 + 투자 = 누적 수입−지출 (이중계산 없음)
  var cashBalance = houseBal - investPrin;
  var networth = {
    total: houseBal,
    parts: [{ label: '현금 잔액', amount: cashBalance }, { label: '투자', amount: investPrin }],
  };

  // trend (최근 6개월, 웨딩 제외 기준)
  var trendMonths = months.slice(0, 6).reverse();
  var tIncome = [], tExpense = [], tRate = [];
  trendMonths.forEach(function (ym) {
    var rows = L.filter(function (r) { return r._ym === ym; });
    var ti = sum(rows.filter(function (r) { return r['구분'] === '수입'; }));
    var te = sum(rows.filter(function (r) { return r['구분'] === '지출' && r['분류'] !== '웨딩'; }));
    tIncome.push(Math.round(ti / 10000));
    tExpense.push(Math.round(te / 10000));
    tRate.push(ti > 0 ? Math.round((ti - te) / ti * 100) : 0);
  });
  var trend = { months: trendMonths.map(function (ym) { return parseInt(ym.slice(5), 10) + '월'; }), income: tIncome, expense: tExpense, rate: tRate };

  // ledgerStrip
  var allowJ = sum(exp.filter(function (r) { return r['분류'] === ALLOWANCE && r['지출구분'] === '지영'; }));
  var allowS = sum(exp.filter(function (r) { return r['분류'] === ALLOWANCE && r['지출구분'] === '승화'; }));

  // txns (최신순)
  var txns = mRows.slice().sort(function (a, b) { return a._date < b._date ? 1 : -1; }).map(function (r) {
    var isInc = r['구분'] === '수입';
    return {
      date: r._date.slice(5).replace('-', '.'), kind: r['구분'], cat: r['분류'],
      emoji: EMOJI[r['분류']] || (isInc ? '💰' : '📦'),
      amount: isInc ? r._amt : -r._amt,
      share: SHARE_OF[r['지출구분']] || 'common', pay: r['결제수단'] || '', memo: r['메모'] || '',
    };
  });

  // 투자 (누적 ≤ month)
  var iRows = I.filter(function (r) { return r._ym <= month; });
  var accSet = {}, tkSet = {}, accAgg = {}, stratAgg = {}, holdAgg = {};
  iRows.forEach(function (r) {
    var acc = r['account'] || '기타', tk = r['ticker'] || '?', strat = r['strategy'] || '기타';
    accSet[acc] = 1; tkSet[tk] = 1;
    accAgg[acc] = (accAgg[acc] || 0) + r._val;
    stratAgg[strat] = (stratAgg[strat] || 0) + r._val;
    var key = tk + '||' + acc;
    if (!holdAgg[key]) holdAgg[key] = { ticker: tk, account: acc, principal: 0 };
    holdAgg[key].principal += r._val;
  });
  var toArr = function (agg) { return Object.keys(agg).map(function (k) { return { label: k, amount: agg[k] }; }).filter(function (x) { return x.amount > 0; }).sort(function (a, b) { return b.amount - a.amount; }); };
  var invest = {
    principalTotal: investPrin,
    accounts: Object.keys(accSet).length,
    tickers: Object.keys(tkSet).length,
    byAccount: toArr(accAgg),
    byStrategy: toArr(stratAgg),
    holdings: Object.keys(holdAgg).map(function (k) { return holdAgg[k]; }).filter(function (h) { return h.principal > 0; }).sort(function (a, b) { return b.principal - a.principal; }),
  };
  // 현금 흐름 / 런웨이 — 수입 − 실제지출 − 이번달 투자 = 잔여 현금,
  // 그리고 '아직 안 나간 고정비(지난달 기준)'를 빼면 월말 예상 잔여
  // 통장 잔액 = 누적(수입 − 통장에서 실제로 빠진 지출). 신용카드 이번 달분은 아직 안 빠졌으니 잔액에 남김.
  // cashBalance = houseBal − 투자 (전체 지출 차감) 이므로, 이번 달 신용카드분을 더해 통장 실잔액으로 보정.
  var monthCredit = sum(exp.filter(function (r) { return r['결제수단'] === '신용카드'; }));
  var accountBalance = cashBalance + monthCredit;
  var cash = {
    balance: accountBalance,    // ★ 현재 통장 잔여 현금 (신용카드 누계 제외)
    afterCard: cashBalance,     // 이번 달 카드값 결제 후 잔액
    monthCredit: monthCredit,   // 이번 달 신용카드 누계액 (곧 빠질 돈)
    income: incomeTotal, expense: totalWith,
  };

  var wf = {
    month: month.slice(0, 4) + '년 ' + parseInt(month.slice(5), 10) + '월',
    income: { total: incomeTotal, items: incomeItems },
    expense: { totalWithWedding: totalWith, totalNoWedding: totalNo, byShare: byShare, fixed: fixed, variable: variable, byCategory: byCategory },
    kpi: { incomeSum: incomeTotal, expenseSum: expenseKpi, savingInvest: saving, savingRate: savingRate, savingRateWithWedding: savingRateW },
    cash: cash,
    networth: networth,
    trend: trend,
    ledgerStrip: { fixed: fixed, variable: variable, allowanceJ: allowJ, allowanceS: allowS },
    txns: txns,
    invest: invest,
  };
  return { ok: true, months: months, month: month, wf: wf };
}

/* ---------- 엔드포인트 ---------- */
function doGet(e) {
  try {
    var month = (e && e.parameter && e.parameter.month) || '';
    return json(buildWF(month));
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    var rows = body.rows || [];
    var sh = SpreadsheetApp.openById(CONFIG.LEDGER_ID).getSheetByName(CONFIG.LEDGER_TAB);
    if (!sh) return json({ ok: false, error: '가계부 탭을 찾을 수 없습니다' });
    var added = 0;
    rows.forEach(function (r) {
      var id = 'TX' + new Date().getTime() + Math.floor(Math.random() * 1000);
      sh.appendRow([id, r.date, r.kind, r.cat, Math.abs(num(r.amount)), r.owner || '공통', r.pay || '', r.memo || '']);
      added++;
    });
    return json({ ok: true, added: added });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}
