/* 신혼부부 가계부 — 공유 컴포넌트 (차트/카드/태그/테이블) */

const { useState } = React;

/* ---------- 작은 유틸 ---------- */
function SectionTitle({ icon, children, right }) {
  return (
    <h3 className="section-title">
      {icon && <Icon name={icon} size={18} style={{ color: 'var(--ink-2)' }} />}
      {children}
    </h3>
  );
}

function Tag({ share }) {
  return <span className={`tag ${share}`}>{SHARE_LABEL[share]}</span>;
}

/* ---------- KPI 카드 ---------- */
function Kpi({ label, icon, tone, value, unit, delta, accent, hero }) {
  return (
    <div className={`card kpi ${accent ? 'accent-' + accent : ''} ${hero ? 'hero' : ''}`}>
      <div className="card-label">
        {icon && <IconChip name={icon} tone={hero ? 'green' : (tone || 'gray')} size={28} />}
        {label}
      </div>
      <div>
        <span className="kpi-val">{value}</span>
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      {delta && <div className="kpi-delta">{delta}</div>}
    </div>
  );
}

/* ---------- 현재 통장 잔여 현금 (최우선 지표) ---------- */
function BalanceHero({ cash }) {
  if (!cash) {  // 백엔드(Code.gs) 미재배포 시 — 0원 대신 안내
    return (
      <div className="balance-hero">
        <div className="bh-main">
          <div className="bh-tag"><Icon name="scale" size={17} style={{ color: 'var(--ink-3)' }} />현재 잔여 현금</div>
          <div className="chart-note" style={{ marginTop: 6 }}>⚙️ Apps Script(Code.gs)를 새 버전으로 재배포하면 잔여 현금이 표시됩니다.</div>
        </div>
      </div>
    );
  }
  const c = cash;
  const neg = c.balance < 0;
  const afterNeg = c.afterCard < 0;
  return (
    <div className={`balance-hero ${neg ? 'is-neg' : ''}`}>
      <div className="bh-main">
        <div className="bh-tag"><Icon name="scale" size={17} style={{ color: 'var(--ink-3)' }} />현재 잔여 현금 · 통장 기준</div>
        <div className={`bh-num ${neg ? 'neg' : ''}`}>{neg ? '−' : ''}{KRW(Math.abs(c.balance))}</div>
        <div className="chart-note">누적 수입 − 현금·체크·이체 지출 (신용카드 제외)</div>
      </div>
      {c.monthCredit > 0 && (
        <div className="cc-strip">
          <div className="cc-item">
            <span className="l"><Icon name="receipt" size={13} style={{ color: 'var(--expense)', verticalAlign: '-2px' }} /> 이번 달 신용카드 누계</span>
            <span className="v" style={{ color: 'var(--expense)' }}>{WON(c.monthCredit)}</span>
          </div>
          <span className="eq-op" style={{ fontSize: 18 }}>→</span>
          <div className="cc-item">
            <span className="l">카드값 결제 후 잔액</span>
            <span className="v" style={{ color: afterNeg ? 'var(--expense)' : 'var(--save)' }}>{afterNeg ? '−' : ''}{WON(Math.abs(c.afterCard))}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- 도넛 ---------- */
function Donut({ data, colors, size = 120 }) {
  const total = data.reduce((s, d) => s + d.amount, 0);
  const r = size / 2 - 8, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut-wrap">
      <svg className="donut" viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line-soft)" strokeWidth="13" />
        {data.map((d, i) => {
          const frac = d.amount / total;
          const dash = frac * C;
          const el = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={colors[i % colors.length]} strokeWidth="13"
              strokeDasharray={`${Math.max(dash - 2, 0)} ${C - Math.max(dash - 2, 0)}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="round" />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="legend">
        {data.map((d, i) => (
          <div className="lg" key={i}>
            <span className="sw" style={{ background: colors[i % colors.length] }}></span>
            {d.label}
            <span className="lv">{KRW(d.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- 가로 막대 (옵션: 아이콘칩, 공통 max) ---------- */
function Bars({ data, color = 'var(--expense)', max }) {
  if (!data.length) return null;
  max = max || Math.max(...data.map(d => d.amount));
  return (
    <div className="bars">
      {data.map((d, i) => (
        <div className="bar-row" key={i}>
          <span className="bar-label">
            {d.emoji
              ? <span className="cat-emoji">{d.emoji}</span>
              : (d.icon && <IconChip name={d.icon} tone={d.tone || 'gray'} size={26} />)}
            {d.label}
          </span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(d.amount / max) * 100}%`, background: d.color || color }}></div>
          </div>
          <span className="bar-val">{KRW(d.amount)}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- 고정비 vs 변동비 ---------- */
function FixedVarBar({ fixed, variable }) {
  const total = fixed + variable;
  return (
    <div>
      <div className="fv-bar">
        <div className="fv-seg" style={{ width: `${fixed / total * 100}%`, background: 'var(--fixed-c)' }}>고정 {Math.round(fixed / total * 100)}%</div>
        <div className="fv-seg" style={{ width: `${variable / total * 100}%`, background: 'var(--variable-c)' }}>변동 {Math.round(variable / total * 100)}%</div>
      </div>
      <div className="legend" style={{ flexDirection: 'row', gap: 24, marginTop: 16, minWidth: 0 }}>
        <div className="lg"><span className="sw" style={{ background: 'var(--fixed-c)' }}></span>고정비<span className="lv">{KRW(fixed)}</span></div>
        <div className="lg"><span className="sw" style={{ background: 'var(--variable-c)' }}></span>변동비<span className="lv">{KRW(variable)}</span></div>
      </div>
    </div>
  );
}

/* ---------- 추이 라인 차트 ---------- */
function Trend({ trend }) {
  const W = 560, H = 190, padX = 26, padY = 26;
  const n = trend.months.length;
  const x = (i) => padX + (i / (n - 1)) * (W - padX * 2);
  const maxAmt = Math.max(...trend.income, ...trend.expense) * 1.1;
  const yA = (v) => H - padY - (v / maxAmt) * (H - padY * 2);
  const yR = (v) => H - padY - (v / 60) * (H - padY * 2);
  const line = (arr, yf) => arr.map((v, i) => `${x(i)},${yf(v)}`).join(' ');
  return (
    <div>
      <svg className="trend" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {[0.25, 0.5, 0.75].map((g, i) => (
          <line key={i} x1={padX} x2={W - padX} y1={padY + g * (H - padY * 2)} y2={padY + g * (H - padY * 2)} stroke="var(--line-soft)" strokeWidth="1" />
        ))}
        <polyline points={line(trend.income, yA)} fill="none" stroke="var(--income)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={line(trend.expense, yA)} fill="none" stroke="var(--expense)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={line(trend.rate, yR)} fill="none" stroke="var(--save)" strokeWidth="2.5" strokeDasharray="5 5" strokeLinejoin="round" strokeLinecap="round" />
        {trend.rate.map((v, i) => <circle key={i} cx={x(i)} cy={yR(v)} r="3" fill="#fff" stroke="var(--save)" strokeWidth="2" />)}
        {trend.months.map((m, i) => (
          <text key={i} x={x(i)} y={H - 4} fontSize="11" fill="var(--ink-3)" textAnchor="middle" fontFamily="var(--font-hand)">{m}</text>
        ))}
      </svg>
      <div className="trend-legend">
        <span className="lg"><span className="ln" style={{ background: 'var(--income)' }}></span>수입</span>
        <span className="lg"><span className="ln" style={{ background: 'var(--expense)' }}></span>지출</span>
        <span className="lg"><span className="ln" style={{ background: 'var(--save)' }}></span>저축률(%)</span>
      </div>
    </div>
  );
}

/* ---------- 토글 ---------- */
function Toggle({ on, onChange, children }) {
  return (
    <label className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
      <span className="track"><span className="knob"></span></span>{children}
    </label>
  );
}

/* ---------- 빠른입력 (자연어 → 파싱 미리보기 → 기록) ---------- */
function QuickInput() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const parsed = text.trim() ? parseQuick(text) : [];

  async function submit() {
    if (!parsed.length) return;
    setBusy(true); setMsg(null);
    try {
      await postEntries(parsed);            // app.jsx 전역 함수
      setText(''); setMsg({ ok: true, t: `${parsed.length}건 기록됨` });
      if (window.reloadWF) await window.reloadWF();
    } catch (e) {
      setMsg({ ok: false, t: '저장 실패: ' + e.message });
    } finally { setBusy(false); }
  }

  return (
    <div className="quick">
      <div className="card-label">
        <IconChip name="bolt" tone="blue" size={28} />
        빠른 입력 <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>· 자연어로 적으면 자동 분류</span>
      </div>
      <div className="q-row">
        <input value={text} onChange={e => setText(e.target.value)}
          placeholder="예: 어제 마트 3.2만, 점심 김밥 5천 외식"
          onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
        <button className="btn" onClick={submit} disabled={busy || !parsed.length}>
          <Icon name="plus" size={16} stroke={2.2} />{busy ? '저장중…' : '기록'}
        </button>
      </div>
      {parsed.length > 0 && (
        <div className="parse-preview">
          <span>미리보기</span>
          {parsed.map((p, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ color: 'var(--ink-3)' }}>·</span>}
              <span className="pp-pill"><Icon name="calendar" size={14} style={{ color: 'var(--ink-3)' }} />{p.dateLabel}</span>
              <span className="pp-pill"><span className="cat-emoji" style={{ width: 'auto', flex: 'none' }}>{p.emoji}</span>{p.cat} {p.kind === '수입' ? '+' : '−'}{KRW(Math.abs(p.amount))}</span>
              <Tag share={p.share} />
            </React.Fragment>
          ))}
        </div>
      )}
      {msg && <div className="parse-preview" style={{ color: msg.ok ? 'var(--brand)' : 'var(--expense)' }}>{msg.ok ? '✓ ' : '⚠ '}{msg.t}</div>}
    </div>
  );
}

/* ---------- 거래 테이블 ---------- */
function TxnTable({ txns }) {
  return (
    <div className="table-wrap">
      <table className="txn">
        <thead>
          <tr>
            <th>날짜</th><th>구분</th><th>분류</th><th style={{ textAlign: 'right' }}>금액</th>
            <th>지출구분</th><th>결제수단</th><th>메모</th>
          </tr>
        </thead>
        <tbody>
          {txns.map((t, i) => {
            return (
              <tr key={i} onClick={() => window.openEdit && window.openEdit(t)}
                  style={{ cursor: 'pointer' }} title="클릭하면 수정/삭제">

                <td className="t-date">{t.date}</td>
                <td><span className={`kind-tag ${t.kind === '수입' ? 'income' : 'expense'}`}>{t.kind}</span></td>
                <td><span className="cat"><span className="cat-emoji">{t.emoji}</span>{t.cat}</span></td>
                <td className={`amt ${t.amount > 0 ? 'in' : 'out'}`}>{t.amount > 0 ? '+' : '−'}{WON(Math.abs(t.amount))}</td>
                <td><Tag share={t.share} /></td>
                <td style={{ color: 'var(--ink-2)' }}>{t.pay || '-'}</td>
                <td className="t-memo">{t.memo}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- 투자 보유 테이블 ---------- */
function HoldingsTable({ holdings }) {
  return (
    <div className="table-wrap">
      <table className="txn">
        <thead>
          <tr>
            <th>종목</th><th>계좌</th><th style={{ textAlign: 'right' }}>순투입원금</th>
            <th style={{ textAlign: 'right' }}>평가손익</th><th style={{ textAlign: 'right' }}>수익률</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h, i) => (
            <tr key={i}>
              <td><span className="cat"><IconChip name="trending" tone="mint" size={26} /><strong>{h.ticker}</strong></span></td>
              <td>{h.account}</td>
              <td className="amt">{KRW(h.principal)}</td>
              <td style={{ textAlign: 'right' }}><span className="soon">준비중</span></td>
              <td style={{ textAlign: 'right' }}><span className="soon">준비중</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

Object.assign(window, {
  SectionTitle, Tag, Kpi, BalanceHero, Donut, Bars, FixedVarBar, Trend,
  Toggle, QuickInput, TxnTable, HoldingsTable,
});
