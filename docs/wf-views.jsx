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

/* ============== 🏦 대출 ============== */
function LoanView() {
  const L = WF.loans || { loans: [], totalBalance: 0, totalMonthly: 0, avgRate: 0, schedule: [] };
  const R = { textAlign: 'right' };
  if (!L.loans.length) {
    return (
      <div className="card" style={{ color: 'var(--ink-2)', lineHeight: 1.7 }}>
        🏦 아직 등록된 대출이 없어요. 구글시트의 <b style={{ color: 'var(--ink)' }}>‘대출’ 탭</b>에 입력하면 현황·상환계획이 자동으로 표시됩니다.
        <div className="chart-note" style={{ marginTop: 10 }}>
          열 구성: 대출명 · 대출기관 · 대출금액 · 연이자율(%) · 대출기간(개월) · 시작일(YYYY-MM-DD) · 납부일 · 상환방식(원리금균등/원금균등/만기일시) · 메모
        </div>
      </div>
    );
  }
  return (
    <React.Fragment>
      <div className="grid grid-3">
        <Kpi label="총 대출잔액" icon="bank" tone="rose" value={KRW(L.totalBalance)} accent="expense" delta="현재 남은 원금 합계" />
        <Kpi label="월 상환액 합계" icon="receipt" tone="purple" value={KRW(L.totalMonthly)} delta="이번 달 기준" />
        <Kpi label="평균 이자율" icon="trending" tone="yellow" value={L.avgRate + '%'} delta="잔액 가중평균" />
      </div>

      <div className="card wide">
        <SectionTitle icon="bank">대출 현황</SectionTitle>
        <div className="table-wrap" style={{ marginTop: 8 }}>
          <table className="txn">
            <thead><tr>
              <th>대출명</th><th>기관</th><th style={R}>잔액</th><th style={R}>이자율</th>
              <th style={R}>남은기간</th><th>납부일</th><th style={R}>월 상환액</th><th>상환방식</th>
            </tr></thead>
            <tbody>
              {L.loans.map((ln, i) => (
                <tr key={i}>
                  <td><span className="cat"><IconChip name="bank" tone="blue" size={26} /><strong>{ln.name}</strong></span></td>
                  <td>{ln.lender || '-'}</td>
                  <td className="amt out">{WON(ln.balance)}</td>
                  <td style={R}>{ln.rate}%</td>
                  <td style={R}>{ln.remainMonths}개월</td>
                  <td>{ln.payDay ? '매월 ' + ln.payDay + '일' : '-'}</td>
                  <td className="amt"><strong>{WON(ln.monthly)}</strong></td>
                  <td><span className="kind-tag expense" style={{ background: 'var(--gray-bg)', color: 'var(--ink-2)' }}>{ln.method}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
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

Object.assign(window, { SummaryView, LedgerView, InvestView, LoanView });
