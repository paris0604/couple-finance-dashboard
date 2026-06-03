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

  return (
    <React.Fragment>
      <div className="grid grid-4">
        <Kpi label="합산 수입" icon="wallet" tone="blue" value={KRW(WF.income.total)} accent="income" delta="지영 + 승화 + 상여" />
        <Kpi label="총 지출" icon="receipt" tone="rose" value={KRW(expense)} accent="expense" delta={excludeWedding ? '웨딩 제외' : '웨딩 포함'} />
        <Kpi label="투자납입" icon="coins" tone="yellow" value={KRW((WF.cash || {}).invested || 0)} delta="이번 달 실제 투자" />
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
          <div className="chart-note">현금 잔액 + 투자 (= 누적 수입 − 지출)</div>
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
    </React.Fragment>
  );
}

Object.assign(window, { SummaryView, LedgerView, InvestView });
