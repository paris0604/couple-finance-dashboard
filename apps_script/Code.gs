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
  LOAN_TAB: '대출',   // 가계부 스프레드시트 안에 생성 (없으면 자동 생성)
  GOAL_TAB: '목표',
};

var LEDGER_COLS = ['거래ID', '날짜', '구분', '분류', '금액', '지출구분', '결제수단', '메모'];
var LOAN_COLS = ['대출명', '대출기관', '대출금액', '현재잔액', '연이자율(%)', '대출기간(개월)', '시작일', '납부일', '상환방식', '메모'];
var GOAL_COLS = ['목표명', '목표금액', '기준', '메모'];   // 기준: 순자산/현금잔액/투자자산
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

  // txns (최신순) — 수정 팝업용으로 id·전체날짜·지출구분(한글) 포함
  var txns = mRows.slice().sort(function (a, b) { return a._date < b._date ? 1 : -1; }).map(function (r) {
    var isInc = r['구분'] === '수입';
    return {
      id: r['거래ID'], fullDate: r._date,
      date: r._date.slice(5).replace('-', '.'), kind: r['구분'], cat: r['분류'],
      emoji: EMOJI[r['분류']] || (isInc ? '💰' : '📦'),
      amount: isInc ? r._amt : -r._amt,
      share: SHARE_OF[r['지출구분']] || 'common', owner: r['지출구분'] || '공통',
      pay: r['결제수단'] || '', memo: r['메모'] || '',
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

  // 전월 대비 지표
  var mi = months.indexOf(month);
  var prevMonth = (mi >= 0 && mi + 1 < months.length) ? months[mi + 1] : null;
  var prev = null;
  if (prevMonth) {
    var pm = L.filter(function (r) { return r._ym === prevMonth; });
    var pInvest = 0, pHouse = 0;
    I.forEach(function (r) { if (r._ym <= prevMonth) pInvest += r._val; });
    L.forEach(function (r) { if (r._ym <= prevMonth) pHouse += (r['구분'] === '수입' ? r._amt : -r._amt); });
    prev = {
      income: Math.round(sum(pm.filter(function (r) { return r['구분'] === '수입'; }))),
      expenseWith: Math.round(sum(pm.filter(function (r) { return r['구분'] === '지출'; }))),
      expenseNo: Math.round(sum(pm.filter(function (r) { return r['구분'] === '지출' && r['분류'] !== '웨딩'; }))),
      investAsset: Math.round(pInvest),
      networth: Math.round(pHouse),
    };
  }

  // 월별 / 연간 집계 (전체 기간)
  var magg = {}, yagg = {};
  L.forEach(function (r) {
    var y = r._ym; if (!y) return; var yr = y.slice(0, 4);
    if (!magg[y]) magg[y] = { income: 0, expense: 0 };
    if (!yagg[yr]) yagg[yr] = { income: 0, expense: 0 };
    var k = r['구분'] === '수입' ? 'income' : 'expense';
    magg[y][k] += r._amt; yagg[yr][k] += r._amt;
  });
  var monthly = Object.keys(magg).sort().map(function (y) {
    var a = magg[y], net = a.income - a.expense;
    return { ym: y, label: y.slice(2, 4) + '.' + y.slice(5), income: Math.round(a.income), expense: Math.round(a.expense), net: Math.round(net), rate: a.income > 0 ? Math.round(net / a.income * 100) : 0 };
  });
  var yearly = Object.keys(yagg).sort().map(function (yr) {
    var a = yagg[yr], net = a.income - a.expense;
    return { year: yr, income: Math.round(a.income), expense: Math.round(a.expense), net: Math.round(net), rate: a.income > 0 ? Math.round(net / a.income * 100) : 0 };
  });

  // 투자 월평균 납입 (예측용)
  var invMonths = {}; iRows.forEach(function (r) { if (r._val > 0) invMonths[r._ym] = 1; });
  invest.monthlyAvg = Math.round(invest.principalTotal / (Object.keys(invMonths).length || 1));

  // 대출(1회 계산) → 캘린더에 재사용
  var loanData = buildLoans(new Date());

  // 캘린더: 대출 납부일 + 이번 달 고정비 결제일
  var calendar = {};
  loanData.loans.forEach(function (ln) {
    var dd = parseInt(ln.payDay, 10);
    if (dd >= 1 && dd <= 31) (calendar[dd] = calendar[dd] || []).push({ label: ln.name, amount: ln.monthly, type: 'loan', emoji: '🏦' });
  });
  exp.forEach(function (r) {
    if (FIXED.indexOf(r['분류']) >= 0) {
      var dy = parseInt(r._date.slice(8, 10), 10);
      if (dy >= 1) (calendar[dy] = calendar[dy] || []).push({ label: r['분류'], amount: r._amt, type: 'fixed', emoji: EMOJI[r['분류']] || '📌' });
    }
  });

  // 목표: 목표 시트 → 현재값 대비 진행률 + 예상 달성시점
  ensureTab(CONFIG.GOAL_TAB, GOAL_COLS);
  var goalRows = readSheet(CONFIG.LEDGER_ID, CONFIG.GOAL_TAB);
  var avgNet = monthly.length ? Math.round(monthly.reduce(function (s, mm) { return s + mm.net; }, 0) / monthly.length) : 0;
  var goals = goalRows.map(function (g) {
    var target = num(g['목표금액']); if (target <= 0) return null;
    var basis = g['기준'] || '순자산';
    var cur = basis === '현금잔액' ? cashBalance : (basis === '투자자산' ? invest.principalTotal : networth.total);
    var remainAmt = Math.max(target - cur, 0);
    return {
      name: g['목표명'] || '목표', target: Math.round(target), basis: basis,
      current: Math.round(cur), ratio: target > 0 ? Math.round(cur / target * 1000) / 10 : 0,
      remain: Math.round(remainAmt),
      etaMonths: (avgNet > 0 && remainAmt > 0) ? Math.ceil(remainAmt / avgNet) : (remainAmt <= 0 ? 0 : null),
      memo: g['메모'] || '',
    };
  }).filter(function (x) { return x; });

  var wf = {
    month: month.slice(0, 4) + '년 ' + parseInt(month.slice(5), 10) + '월',
    income: { total: incomeTotal, items: incomeItems },
    expense: { totalWithWedding: totalWith, totalNoWedding: totalNo, byShare: byShare, fixed: fixed, variable: variable, byCategory: byCategory },
    kpi: { incomeSum: incomeTotal, expenseSum: expenseKpi, savingInvest: saving, savingRate: savingRate, savingRateWithWedding: savingRateW },
    cash: cash,
    networth: networth,
    prev: prev,
    monthly: monthly,
    yearly: yearly,
    trend: trend,
    ledgerStrip: { fixed: fixed, variable: variable, allowanceJ: allowJ, allowanceS: allowS },
    txns: txns,
    invest: invest,
    loans: loanData,
    calendar: calendar, calMonth: month, calAvgNet: avgNet,
    goals: goals,
  };
  return { ok: true, months: months, month: month, wf: wf };
}

/* ---------- 시트 보장 (없으면 생성, 헤더 빠진 컬럼 자동 추가) ---------- */
function ensureTab(tabName, cols) {
  var ss = SpreadsheetApp.openById(CONFIG.LEDGER_ID);
  var sh = ss.getSheetByName(tabName);
  if (!sh) { sh = ss.insertSheet(tabName); sh.appendRow(cols); return sh; }
  var lc = Math.max(sh.getLastColumn(), 1);
  var header = sh.getRange(1, 1, 1, lc).getValues()[0].map(function (h) { return String(h).trim(); });
  var changed = false;
  cols.forEach(function (c) { if (header.indexOf(c) < 0) { header.push(c); changed = true; } });
  if (changed) sh.getRange(1, 1, 1, header.length).setValues([header]);
  return sh;
}
function ensureLoanTab() { return ensureTab(CONFIG.LOAN_TAB, LOAN_COLS); }
function loanColValue(col, L) {
  if (col === '대출명') return L.name || '대출';
  if (col === '대출기관') return L.lender || '';
  if (col === '대출금액') return num(L.amount);
  if (col === '현재잔액') return L.curBalance ? num(L.curBalance) : '';
  if (col === '연이자율(%)') return num(L.rate);
  if (col === '대출기간(개월)') return Math.round(num(L.term));
  if (col === '시작일') return L.start || '';
  if (col === '납부일') return L.payDay || '';
  if (col === '상환방식') return L.method || '원리금균등';
  if (col === '메모') return L.memo || '';
  return '';
}
/* ---------- 대출 (상환 스케줄 자동계산) ---------- */
function monthsBetween(startYmd, today) {
  var s = String(startYmd).match(/(\d{4})[-/.](\d{1,2})/);
  if (!s) return 0;
  return Math.max((today.getFullYear() - (+s[1])) * 12 + (today.getMonth() + 1 - (+s[2])), 0);
}
function loanSchedule(P, annualPct, n, method) {
  var r = annualPct / 100 / 12;
  var pmt = (r === 0) ? P / n : P * r / (1 - Math.pow(1 + r, -n));
  var principalEqual = P / n, rows = [], bal = P;
  for (var k = 0; k < n; k++) {
    var interest = bal * r, principal;
    if (method === '원금균등') principal = principalEqual;
    else if (method === '만기일시') principal = (k === n - 1) ? bal : 0;
    else principal = pmt - interest;               // 원리금균등(기본)
    if (principal > bal) principal = bal;
    bal -= principal;
    rows.push({ 원금: principal, 이자: interest, 상환액: principal + interest, 잔액: Math.max(bal, 0) });
    if (bal <= 0.5) break;
  }
  return rows;
}
function buildLoans(today) {
  ensureLoanTab();
  var rows = readSheet(CONFIG.LEDGER_ID, CONFIG.LOAN_TAB);
  var loans = [], totalBal = 0, totalMonthly = 0, weighted = 0;
  var agg = [];
  for (var i = 0; i < 12; i++) agg.push({ 원금: 0, 이자: 0, 상환액: 0 });
  rows.forEach(function (r) {
    var P = num(r['대출금액']); if (P <= 0) return;
    var rate = num(r['연이자율(%)']);
    var n = Math.round(num(r['대출기간(개월)'])) || 1;
    var method = r['상환방식'] || '원리금균등';
    var sched = loanSchedule(P, rate, n, method);
    var elapsed = Math.min(monthsBetween(r['시작일'], today), sched.length);
    // 현재잔액을 입력했으면 그 값으로 남은 일정을 다시 계산(더 정확), 없으면 경과개월로 추정
    var givenBal = num(r['현재잔액']);
    var curBal, remain, remainMonths;
    if (givenBal > 0) {
      curBal = givenBal;
      remainMonths = Math.max(n - elapsed, 1);
      remain = loanSchedule(curBal, rate, remainMonths, method);
    } else {
      curBal = (elapsed > 0) ? sched[elapsed - 1].잔액 : P;
      remain = sched.slice(elapsed);
      remainMonths = Math.max(n - elapsed, 0);
    }
    var monthly = remain.length ? remain[0].상환액 : 0;
    // 상환율 + 기간(시작~만기)
    var startStr = ymd(r['시작일']);
    var sm = startStr.match(/(\d{4})-(\d{2})/);
    var startDisp = sm ? sm[1] + '.' + sm[2] : '';
    var endDisp = '';
    if (sm) { var tot = (+sm[1]) * 12 + (+sm[2] - 1) + n; endDisp = Math.floor(tot / 12) + '.' + ('0' + (tot % 12 + 1)).slice(-2); }
    var paidRatio = P > 0 ? Math.round((P - curBal) / P * 1000) / 10 : 0;
    loans.push({
      name: r['대출명'] || '대출', lender: r['대출기관'] || '', principal: P,
      balance: Math.round(curBal), rate: rate, term: n, elapsed: elapsed,
      remainMonths: remainMonths, payDay: r['납부일'] || '', method: method,
      monthly: Math.round(monthly), paidRatio: paidRatio, start: startDisp, end: endDisp,
      totalInterestRemain: Math.round(remain.reduce(function (s, x) { return s + x.이자; }, 0)),
      memo: r['메모'] || '',
    });
    totalBal += curBal; totalMonthly += monthly; weighted += curBal * rate;
    for (var j = 0; j < 12 && j < remain.length; j++) {
      agg[j].원금 += remain[j].원금; agg[j].이자 += remain[j].이자; agg[j].상환액 += remain[j].상환액;
    }
  });
  var running = totalBal, schedule = [];
  for (var m = 0; m < 12; m++) {
    running -= agg[m].원금;
    var d = new Date(today.getFullYear(), today.getMonth() + 1 + m, 1);
    schedule.push({
      label: (d.getMonth() + 1) + '월',
      원금: Math.round(agg[m].원금), 이자: Math.round(agg[m].이자),
      상환액: Math.round(agg[m].상환액), 잔액: Math.max(Math.round(running), 0),
    });
  }
  return {
    loans: loans, totalBalance: Math.round(totalBal), totalMonthly: Math.round(totalMonthly),
    avgRate: totalBal > 0 ? Math.round(weighted / totalBal * 100) / 100 : 0, schedule: schedule,
  };
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

function findRowById(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var ids = sh.getRange(1, 1, last, 1).getValues();
  for (var i = 1; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 1; // 1-based
  return -1;
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');

    // ── 대출 추가/삭제 ──
    if (body.action === 'loan_add') {
      var lsh = ensureLoanTab();
      var L = body.loan || {};
      var hdr = lsh.getRange(1, 1, 1, lsh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
      lsh.appendRow(hdr.map(function (h) { return loanColValue(h, L); }));
      return json({ ok: true, added: 1 });
    }
    if (body.action === 'loan_delete') {
      var lsh2 = ensureLoanTab();
      var vals = lsh2.getDataRange().getValues();
      for (var li = 1; li < vals.length; li++) {
        if (String(vals[li][0]) === String(body.name) &&
            Math.round(num(vals[li][2])) === Math.round(num(body.amount))) {
          lsh2.deleteRow(li + 1); return json({ ok: true, deleted: 1 });
        }
      }
      return json({ ok: false, error: '대출을 찾을 수 없습니다' });
    }
    // ── 목표 추가/삭제 ──
    if (body.action === 'goal_add') {
      var gsh = ensureTab(CONFIG.GOAL_TAB, GOAL_COLS);
      var G = body.goal || {};
      gsh.appendRow([G.name || '목표', num(G.target), G.basis || '순자산', G.memo || '']);
      return json({ ok: true, added: 1 });
    }
    if (body.action === 'goal_delete') {
      var gsh2 = ensureTab(CONFIG.GOAL_TAB, GOAL_COLS);
      var gv = gsh2.getDataRange().getValues();
      for (var gi = 1; gi < gv.length; gi++) {
        if (String(gv[gi][0]) === String(body.name) && Math.round(num(gv[gi][1])) === Math.round(num(body.target))) {
          gsh2.deleteRow(gi + 1); return json({ ok: true, deleted: 1 });
        }
      }
      return json({ ok: false, error: '목표를 찾을 수 없습니다' });
    }

    var sh = SpreadsheetApp.openById(CONFIG.LEDGER_ID).getSheetByName(CONFIG.LEDGER_TAB);
    if (!sh) return json({ ok: false, error: '가계부 탭을 찾을 수 없습니다' });

    // 수정
    if (body.action === 'update') {
      var r = body.row || {};
      var rowNum = findRowById(sh, r.id);
      if (rowNum < 0) return json({ ok: false, error: '거래를 찾을 수 없습니다' });
      sh.getRange(rowNum, 1, 1, 8).setValues([[
        r.id, r.date, r.kind, r.cat, Math.abs(num(r.amount)),
        r.owner || '공통', r.pay || '', r.memo || '',
      ]]);
      return json({ ok: true, updated: 1 });
    }
    // 삭제
    if (body.action === 'delete') {
      var rn = findRowById(sh, body.id);
      if (rn < 0) return json({ ok: false, error: '거래를 찾을 수 없습니다' });
      sh.deleteRow(rn);
      return json({ ok: true, deleted: 1 });
    }
    // 추가 (기본)
    var added = 0;
    (body.rows || []).forEach(function (r) {
      var id = 'TX' + new Date().getTime() + Math.floor(Math.random() * 1000);
      sh.appendRow([id, r.date, r.kind, r.cat, Math.abs(num(r.amount)), r.owner || '공통', r.pay || '', r.memo || '']);
      added++;
    });
    return json({ ok: true, added: added });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}
