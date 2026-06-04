/* 신혼부부 가계부 — 3개 화면 (공통요약 / 가계부 / 투자) */

const DONUT_COLORS = ['var(--person-c)', 'var(--person-j)', 'var(--person-s)'];
const ACC_COLORS = ['var(--blue)', 'var(--coral)', 'var(--sky)', 'var(--yellow)'];

/* ============== 📊 공통 요약 ============== */
function SummaryView({ excludeWedding, setExcludeWedding, comp, setComp }) {
  const k = WF.kpi;
  const expense = excludeWedding ? WF.expense.totalNoWedding : WF.expense.totalWithWedding;
  const rate = excludeWedding ? k.savingRate : k.savingRateWithWedding;
  const saving = WF.income.total - expense;
  const shareData = WF.expense.byShare.map(s => ({ label: SHARE_LABEL[s.key], amount: s.amount }));
  const investAsset = (WF.invest || {}).principalTotal || 0;

  // 전월 대비 증감 (없으면 설명문 fallback)
  const P = WF.prev;
  const delta = (cur, prevVal, goodUp, fallback) => {
    if (P == null || prevVal == null) return fallback;
    const d = cur - prevVal;
    if (d === 0) return <span style={{ color: 'var(--ink-3)' }}>전월과 동일</span>;
    const up = d > 0, good = goodUp ? up : !up;
    return <span style={{ color: good ? 'var(--save)' : 'var(--expense)' }}>전월비 {up ? '▲' : '▼'}{KRW(Math.abs(d))}</span>;
  };

  return (
    <React.Fragment>
      <div className="grid grid-4">
        <Kpi label="합산 수입" icon="wallet" tone="blue" value={KRW(WF.income.total)} accent="income" delta={delta(WF.income.total, P && P.income, true, '지영 + 승화 + 상여')} />
        <Kpi label="총 지출" icon="receipt" tone="rose" value={KRW(expense)} accent="expense" delta={delta(expense, P && (excludeWedding ? P.expenseNo : P.expenseWith), false, excludeWedding ? '웨딩 제외' : '웨딩 포함')} />
        <Kpi label="투자 자산" icon="trending" tone="yellow" value={KRW(investAsset)} delta={delta(investAsset, P && P.investAsset, true, '누적 순투입원금')} />
        <Kpi label="저축여력률" icon="trending" value={rate + '%'} accent="save" hero delta="잔여 ÷ 수입" />
      </div>

      <div className="table-toolbar" style={{ justifyContent: 'space-between' }}>
        <span className="chart-note">※ 아래 ‘잔여 현금’은 통장 기준(현금·체크·이체). 신용카드는 누계로 따로 표시돼요.</span>
        <Toggle on={excludeWedding} onChange={setExcludeWedding}>웨딩 지출 제외하고 보기</Toggle>
      </div>

      <BalanceHero cash={WF.cash} />

      <div className="card networth">
        <div className="nw-main">
          <SectionTitle icon="gem">합산 순자산</SectionTitle>
          <div className="nw-num">{KRW(WF.networth.total)}</div>
          <div className="chart-note">현금 잔액 + 투자 (= 누적 수입 − 지출)
            {P && P.networth != null && (() => { const d = WF.networth.total - P.networth; return <span style={{ marginLeft: 8, color: d >= 0 ? 'var(--save)' : 'var(--expense)', fontWeight: 700 }}>· 전월비 {d >= 0 ? '▲' : '▼'}{KRW(Math.abs(d))}</span>; })()}
          </div>
        </div>
        <Donut size={110} data={WF.networth.parts.map(p => ({ label: p.label, amount: p.amount }))} colors={['var(--nw-house)', 'var(--nw-invest)']} />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="table-toolbar" style={{ justifyContent: 'space-between', marginBottom: 18 }}>
            <SectionTitle icon="pie">지출 구성 · 공통/지영/승화</SectionTitle>
            <div className="seg seg-sm">
              <button className={comp === 'donut' ? 'on' : ''} onClick={() => setComp('donut')}>도넛</button>
              <button className={comp === 'bars' ? 'on' : ''} onClick={() => setComp('bars')}>막대</button>
            </div>
          </div>
          {comp === 'donut'
            ? <Donut data={shareData} colors={DONUT_COLORS} />
            : <Bars data={WF.expense.byShare.map((s, i) => ({ label: SHARE_LABEL[s.key], amount: s.amount, color: DONUT_COLORS[i] }))} />}
        </div>
        <div className="card">
          <SectionTitle icon="layers">고정비 vs 변동비</SectionTitle>
          <div style={{ marginTop: 20 }}><FixedVarBar fixed={WF.expense.fixed} variable={WF.expense.variable} /></div>
        </div>
      </div>

      <div className="card wide">
        <SectionTitle icon="trending">최근 6개월 흐름</SectionTitle>
        <div style={{ marginTop: 16 }}><Trend trend={WF.trend} /></div>
      </div>
    </React.Fragment>
  );
}

/* ============== 📒 가계부 ============== */
function LedgerView({ filter, setFilter }) {
  const s = WF.ledgerStrip;
  const cats = filter === 'all' ? WF.expense.byCategory : WF.expense.byCategory.filter(c => c.share === filter);
  const sorted = [...cats].sort((a, b) => b.amount - a.amount);
  const txns = filter === 'all' ? WF.txns : WF.txns.filter(t => t.share === filter);

  return (
    <React.Fragment>
      <QuickInput />

      <div className="grid grid-4">
        <Kpi label="고정비 합계" icon="home" tone="purple" value={KRW(s.fixed)} accent="fixed" />
        <Kpi label="변동비 합계" icon="cart" tone="orange" value={KRW(s.variable)} accent="variable" />
        <Kpi label="용돈 · 지영" icon="coins" tone="yellow" value={KRW(s.allowanceJ)} />
        <Kpi label="용돈 · 승화" icon="coins" tone="green" value={KRW(s.allowanceS)} />
      </div>

      <div className="card">
        <div className="table-toolbar" style={{ justifyContent: 'space-between' }}>
          <SectionTitle icon="pie">카테고리별 지출</SectionTitle>
          <div className="filter-chips">
            {['all', 'common', 'jiyoung', 'seunghwa'].map(f => (
              <button key={f} className={`chip ${filter === f ? 'on ' + f : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? '전체' : SHARE_LABEL[f]}
              </button>
            ))}
          </div>
        </div>
        {(() => {
          const rows = sorted.map(c => { const ic = catOf(c.label); const toneVar = ic.tone === 'gray' ? 'gray-t' : ic.tone; return { label: c.label, emoji: c.emoji, amount: c.amount, color: `var(--${toneVar})` }; });
          const gmax = Math.max(...rows.map(r => r.amount), 1);
          const mid = Math.ceil(rows.length / 2);
          return (
            <div className="grid grid-2" style={{ alignItems: 'start' }}>
              <Bars data={rows.slice(0, mid)} max={gmax} />
              <Bars data={rows.slice(mid)} max={gmax} />
            </div>
          );
        })()}
      </div>

      <div className="card wide">
        <div className="table-toolbar" style={{ justifyContent: 'space-between' }}>
          <SectionTitle icon="receipt">거래 내역</SectionTitle>
          <span className="chart-note">✏️ 행을 클릭하면 수정·삭제</span>
        </div>
        <TxnTable txns={txns} />
      </div>
    </React.Fragment>
  );
}

/* ============== 📈 투자 ============== */
function InvestView() {
  const v = WF.invest;
  return (
    <React.Fragment>
      <div className="grid grid-3">
        <Kpi label="총 순투입원금" icon="gem" tone="mint" value={KRW(v.principalTotal)} accent="save" delta="1차: 원금만 집계" />
        <Kpi label="계좌 수" icon="bank" tone="blue" value={v.accounts} unit="개" />
        <Kpi label="종목 수" icon="trending" tone="purple" value={v.tickers} unit="개" />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <SectionTitle icon="bank">계좌별 순투입원금</SectionTitle>
          <div style={{ marginTop: 18 }}>
            <Donut data={v.byAccount} colors={ACC_COLORS} />
          </div>
        </div>
        <div className="card">
          <SectionTitle icon="target">전략별 비중</SectionTitle>
          <div style={{ marginTop: 18 }}>
            <Bars data={v.byStrategy.map((s, i) => ({ label: s.label, amount: s.amount, color: ACC_COLORS[i % ACC_COLORS.length] }))} color="var(--save)" />
          </div>
        </div>
      </div>

      <div className="card wide">
        <div className="table-toolbar" style={{ justifyContent: 'space-between' }}>
          <SectionTitle icon="list">보유 종목</SectionTitle>
          <span className="chart-note">손익 컬럼은 2차 — 회색 준비중</span>
        </div>
        <HoldingsTable holdings={v.holdings} />
      </div>

      <InvestProjection invest={v} />
    </React.Fragment>
  );
}

/* 투자 자산 증가 예측 — 현 월평균 납입을 계속한다고 가정 */
function fv(current, monthly, annualPct, years) {
  const rm = annualPct / 100 / 12, n = years * 12;
  const fvCur = current * Math.pow(1 + rm, n);
  const fvCon = rm === 0 ? monthly * n : monthly * ((Math.pow(1 + rm, n) - 1) / rm);
  return Math.round(fvCur + fvCon);
}
function InvestProjection({ invest }) {
  const R = { textAlign: 'right' };
  const cur = invest.principalTotal || 0;
  const monthly = invest.monthlyAvg || 0;
  const years = [1, 3, 5, 10, 20];
  const rates = [{ r: 4, label: '보수 4%' }, { r: 6, label: '중립 6%' }, { r: 8, label: '적극 8%' }];
  return (
    <div className="card wide">
      <div className="table-toolbar" style={{ justifyContent: 'space-between' }}>
        <SectionTitle icon="trending">자산 증가 예측</SectionTitle>
        <span className="chart-note">월 {KRW(monthly)} 납입 지속 가정 · 연 수익률 시나리오</span>
      </div>
      <div className="table-wrap" style={{ marginTop: 8 }}>
        <table className="txn">
          <thead><tr>
            <th>기간</th><th style={R}>납입 원금 누계</th>
            {rates.map(x => <th key={x.r} style={R}>{x.label}</th>)}
          </tr></thead>
          <tbody>
            {years.map(y => {
              const paid = cur + monthly * 12 * y;
              return (
                <tr key={y}>
                  <td className="t-date">{y}년 후</td>
                  <td className="amt">{KRW(paid)}</td>
                  {rates.map(x => {
                    const val = fv(cur, monthly, x.r, y);
                    return <td key={x.r} className="amt" style={{ color: 'var(--save)', fontWeight: 700 }}>{KRW(val)}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <span className="chart-note" style={{ marginTop: 8, display: 'block' }}>
        ※ 복리 가정의 단순 추정이며 실제 수익률은 변동합니다. 월평균 납입은 지금까지 투자 내역 기준이에요.
      </span>
    </div>
  );
}

/* ============== 🗓️ 월별 ============== */
function MonthBars({ data }) {
  if (!data.length) return null;
  const H = 200, pad = 28, step = 56, bw = 16, gap = 6;
  const W = Math.max(pad * 2 + data.length * step, 320);
  const max = Math.max.apply(null, data.map(d => Math.max(d.income, d.expense)).concat([1]));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 220 }}>
      {data.map((d, i) => {
        const x = pad + i * step;
        const ih = (d.income / max) * (H - pad * 2), eh = (d.expense / max) * (H - pad * 2);
        return (
          <g key={i}>
            <rect x={x} y={H - pad - ih} width={bw} height={ih} fill="var(--income)" rx="3" />
            <rect x={x + bw + gap} y={H - pad - eh} width={eh > 0 ? bw : 0} height={eh} fill="var(--expense)" rx="3" />
            <text x={x + bw} y={H - 9} fontSize="11" fill="var(--ink-3)" textAnchor="middle" fontFamily="var(--font-hand)">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
function MonthlyView() {
  const M = WF.monthly || [], Y = WF.yearly || [];
  const R = { textAlign: 'right' };
  return (
    <React.Fragment>
      <div className="card wide">
        <div className="table-toolbar" style={{ justifyContent: 'space-between' }}>
          <SectionTitle icon="calendar">월별 수입 · 지출</SectionTitle>
          <span className="trend-legend" style={{ margin: 0 }}>
            <span className="lg"><span className="ln" style={{ background: 'var(--income)' }}></span>수입</span>
            <span className="lg"><span className="ln" style={{ background: 'var(--expense)' }}></span>지출</span>
          </span>
        </div>
        <MonthBars data={M} />
      </div>

      <div className="card wide">
        <SectionTitle icon="list">월별 현황</SectionTitle>
        <div className="table-wrap" style={{ marginTop: 8 }}>
          <table className="txn">
            <thead><tr><th>월</th><th style={R}>수입</th><th style={R}>지출</th><th style={R}>잔여(순)</th><th style={R}>저축률</th></tr></thead>
            <tbody>
              {M.slice().reverse().map((m, i) => (
                <tr key={i}>
                  <td className="t-date">{m.label}</td>
                  <td className="amt in">{WON(m.income)}</td>
                  <td className="amt out">{WON(m.expense)}</td>
                  <td className="amt" style={{ color: m.net >= 0 ? 'var(--save)' : 'var(--expense)', fontWeight: 700 }}>{m.net >= 0 ? '+' : '−'}{WON(Math.abs(m.net))}</td>
                  <td style={R}>{m.rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card wide">
        <SectionTitle icon="trending">연간 누계</SectionTitle>
        <div className="table-wrap" style={{ marginTop: 8 }}>
          <table className="txn">
            <thead><tr><th>연도</th><th style={R}>수입</th><th style={R}>지출</th><th style={R}>잔여(순)</th><th style={R}>저축률</th></tr></thead>
            <tbody>
              {Y.slice().reverse().map((y, i) => (
                <tr key={i}>
                  <td className="t-date"><strong>{y.year}년</strong></td>
                  <td className="amt in">{WON(y.income)}</td>
                  <td className="amt out">{WON(y.expense)}</td>
                  <td className="amt" style={{ color: y.net >= 0 ? 'var(--save)' : 'var(--expense)', fontWeight: 700 }}>{y.net >= 0 ? '+' : '−'}{WON(Math.abs(y.net))}</td>
                  <td style={R}>{y.rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </React.Fragment>
  );
}

/* 대출 추가 폼 (항목별 입력 → 시트 동기화) */
function LoanForm() {
  const blank = { name: '', lender: '', amount: '', rate: '', term: '', start: '', payDay: '', method: '원리금균등', memo: '' };
  const [f, setF] = React.useState(blank);
  const [busy, setBusy] = React.useState(false);
  const set = (k) => (e) => setF(prev => ({ ...prev, [k]: e.target.value }));
  async function add() {
    if (!f.name || !f.amount || !f.term) { alert('대출명·대출금액·대출기간은 필수예요.'); return; }
    setBusy(true);
    try {
      await window.apiPost({ action: 'loan_add', loan: f });
      setF(blank);
      if (window.reloadWF) await window.reloadWF();
    } catch (e) { alert('추가 실패: ' + e.message); }
    setBusy(false);
  }
  return (
    <div className="card">
      <SectionTitle icon="bank">대출 추가</SectionTitle>
      <div className="modal-grid" style={{ marginTop: 12 }}>
        <label className="fld"><span>대출명 *</span><input className="modal-input" value={f.name} onChange={set('name')} placeholder="전세자금대출" /></label>
        <label className="fld"><span>대출기관</span><input className="modal-input" value={f.lender} onChange={set('lender')} placeholder="국민은행" /></label>
        <label className="fld"><span>대출금액(원) *</span><input className="modal-input" type="number" value={f.amount} onChange={set('amount')} /></label>
        <label className="fld"><span>연이자율(%)</span><input className="modal-input" type="number" step="0.01" value={f.rate} onChange={set('rate')} /></label>
        <label className="fld"><span>대출기간(개월) *</span><input className="modal-input" type="number" value={f.term} onChange={set('term')} placeholder="360" /></label>
        <label className="fld"><span>시작일</span><input className="modal-input" type="date" value={f.start} onChange={set('start')} /></label>
        <label className="fld"><span>납부일(매월)</span><input className="modal-input" type="number" min="1" max="31" value={f.payDay} onChange={set('payDay')} placeholder="17" /></label>
        <label className="fld"><span>상환방식</span><select className="modal-input" value={f.method} onChange={set('method')}><option>원리금균등</option><option>원금균등</option><option>만기일시</option></select></label>
        <label className="fld" style={{ gridColumn: '1 / -1' }}><span>메모</span><input className="modal-input" value={f.memo} onChange={set('memo')} /></label>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
        <button className="btn" onClick={add} disabled={busy}><Icon name="plus" size={16} stroke={2.2} />{busy ? '추가중…' : '대출 추가'}</button>
      </div>
    </div>
  );
}

async function deleteLoan(ln) {
  if (!window.confirm(`'${ln.name}' 대출을 삭제할까요?`)) return;
  try { await window.apiPost({ action: 'loan_delete', name: ln.name, amount: ln.principal }); if (window.reloadWF) await window.reloadWF(); }
  catch (e) { alert('삭제 실패: ' + e.message); }
}

/* ============== 🏦 대출 ============== */
function LoanView() {
  const L = WF.loans || { loans: [], totalBalance: 0, totalMonthly: 0, avgRate: 0, schedule: [] };
  const R = { textAlign: 'right' };
  if (!L.loans.length) {
    return (
      <React.Fragment>
        <LoanForm />
        <div className="card" style={{ color: 'var(--ink-2)', lineHeight: 1.7 }}>
          🏦 아직 등록된 대출이 없어요. 위에서 추가하거나, 구글시트 <b style={{ color: 'var(--ink)' }}>‘대출’ 탭</b>에 직접 입력해도 됩니다.
        </div>
      </React.Fragment>
    );
  }
  return (
    <React.Fragment>
      <LoanForm />
      <div className="grid grid-3">
        <Kpi label="총 대출잔액" icon="bank" tone="rose" value={KRW(L.totalBalance)} accent="expense" delta="현재 남은 원금 합계" />
        <Kpi label="월 상환액 합계" icon="receipt" tone="purple" value={KRW(L.totalMonthly)} delta="이번 달 기준" />
        <Kpi label="평균 이자율" icon="trending" tone="yellow" value={L.avgRate + '%'} delta="잔액 가중평균" />
      </div>

      <div className="card wide">
        <SectionTitle icon="bank">대출 현황 · 상환율</SectionTitle>
        <div className="grid grid-2" style={{ marginTop: 12, alignItems: 'start' }}>
          {L.loans.map((ln, i) => (
            <div className="loan-card" key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div className="card-label" style={{ margin: 0 }}>
                  <IconChip name="bank" tone="blue" size={30} />
                  <div>
                    <div style={{ fontWeight: 700 }}>{ln.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{ln.lender || '-'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div className="num" style={{ fontWeight: 700, fontSize: 17, color: 'var(--expense)' }}>{WON(ln.balance)}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>/ {WON(ln.principal)}</div>
                  </div>
                  <button className="btn ghost sm" title="삭제" onClick={() => deleteLoan(ln)}
                    style={{ padding: '4px 6px', color: 'var(--ink-3)' }}><Icon name="x" size={14} /></button>
                </div>
              </div>
              <div className="loan-prog"><span style={{ width: Math.min(ln.paidRatio, 100) + '%' }}></span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span style={{ color: 'var(--brand)', fontWeight: 700 }}>상환율 {ln.paidRatio}%</span>
                <span style={{ color: 'var(--ink-3)' }}>경과 {ln.elapsed}/{ln.term}개월 · 남은 {ln.remainMonths}개월</span>
              </div>
              <div className="loan-meta">
                <span>📅 {ln.start} ~ {ln.end}</span>
                <span>이자율 <b>{ln.rate}%</b></span>
                <span>월 상환 <b>{WON(ln.monthly)}</b></span>
                <span>납부일 <b>{ln.payDay ? '매월 ' + ln.payDay + '일' : '-'}</b></span>
                <span className="kind-tag" style={{ background: 'var(--gray-bg)', color: 'var(--ink-2)' }}>{ln.method}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card wide">
        <div className="table-toolbar" style={{ justifyContent: 'space-between' }}>
          <SectionTitle icon="list">향후 12개월 상환 계획</SectionTitle>
          <span className="chart-note">전체 대출 합산 · 원금/이자 분해</span>
        </div>
        <div className="table-wrap" style={{ marginTop: 8 }}>
          <table className="txn">
            <thead><tr>
              <th>월</th><th style={R}>원금</th><th style={R}>이자</th><th style={R}>상환액</th><th style={R}>남은 잔액</th>
            </tr></thead>
            <tbody>
              {L.schedule.map((s, i) => (
                <tr key={i}>
                  <td className="t-date">{s.label}</td>
                  <td className="amt">{WON(s.원금)}</td>
                  <td className="amt" style={{ color: 'var(--expense)' }}>{WON(s.이자)}</td>
                  <td className="amt"><strong>{WON(s.상환액)}</strong></td>
                  <td className="amt">{WON(s.잔액)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { SummaryView, LedgerView, MonthlyView, InvestView, LoanView });
