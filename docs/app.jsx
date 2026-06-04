/* 우리집 자산 대시보드 — 실제 셸 (상단 탭형) + 라이브 데이터 연결
   wf-data.jsx(더미)와 wf-app.jsx(시안 셸)를 대체한다. */

/* ---------- 표시 유틸 (구 wf-data.jsx에서 이관) ---------- */
const KRW = (n) => {
  const man = (n || 0) / 10000;
  if (Math.abs(man) >= 10000) return (man / 10000).toFixed(man % 10000 === 0 ? 0 : 1) + '억';
  return man.toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '만';
};
const WON = (n) => Math.round(n || 0).toLocaleString('ko-KR') + '원';   // 정확한 원 단위(쉼표)
const SHARE_COLOR = { common: 'var(--tag-common)', jiyoung: 'var(--tag-jiyoung)', seunghwa: 'var(--tag-seunghwa)' };
const SHARE_LABEL = { common: '공통', jiyoung: '지영', seunghwa: '승화' };
Object.assign(window, { KRW, WON, SHARE_COLOR, SHARE_LABEL });

const API = window.API_URL || '';
const VIEWS = [
  { id: 'summary', icon: 'pie', label: '공통 요약' },
  { id: 'ledger', icon: 'receipt', label: '가계부' },
  { id: 'monthly', icon: 'calendar', label: '월별' },
  { id: 'invest', icon: 'trending', label: '투자' },
  { id: 'loan', icon: 'bank', label: '대출' },
];

/* ---------- API ---------- */
async function fetchWF(month) {
  const url = API + (API.includes('?') ? '&' : '?') + 'month=' + encodeURIComponent(month || '');
  const r = await fetch(url, { method: 'GET' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function apiPost(body) {
  // text/plain 으로 보내 CORS preflight 회피 (Apps Script 표준 패턴)
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(j.error || ('HTTP ' + r.status));
  return j;
}
async function postEntries(rows) { return apiPost({ rows }); }
window.postEntries = postEntries;
window.apiPost = apiPost;

// 수정 팝업 드롭다운용 상수
const EXPENSE_CATS = ['주거', '통신', '보험', '구독', '교통(정액)', '대출원금상환',
  '식비-장보기', '식비-외식', '식비-카페', '생활용품', '교통(비정기)', '의료',
  '문화·여가', '의류·미용', '웨딩', '경조사', '기타', '용돈'];
const INCOME_CATS = ['지영 급여', '승화 급여', '상여·보너스', '기타수입'];
const OWNERS = ['공통', '지영', '승화'];
const PAYS = ['', '체크카드', '신용카드', '계좌이체'];

/* ---------- 셸 ---------- */
function BrandMark() { return <span className="brand-mark"><Icon name="home" size={17} stroke={2} /></span>; }

function MonthPicker({ months, month, onPick }) {
  const i = months.indexOf(month);
  const disp = month ? month.slice(0, 4) + '년 ' + parseInt(month.slice(5), 10) + '월' : '';
  const go = (d) => { const j = i + d; if (j >= 0 && j < months.length) onPick(months[j]); };
  return (
    <div className="month-picker">
      <span className="mp-nav" onClick={() => go(1)} style={{ cursor: 'pointer' }}><Icon name="chevL" size={16} /></span>
      <span className="num">{disp}</span>
      <span className="mp-nav" onClick={() => go(-1)} style={{ cursor: 'pointer' }}><Icon name="chevR" size={16} /></span>
      {i === 0 && <span className="today-pill">최신</span>}
    </div>
  );
}

function HeaderActions() {
  return (
    <div className="header-actions">
      <button className="btn ghost sm" onClick={() => window.reloadWF && window.reloadWF()}>
        <Icon name="refresh" size={16} />새로고침</button>
    </div>
  );
}

/* 입력 필드 (모듈 레벨 — 매 렌더 재생성 방지로 포커스 유지) */
function MField({ label, children, full }) {
  return (
    <label className="fld" style={full ? { gridColumn: '1 / -1' } : null}>
      <span>{label}</span>{children}
    </label>
  );
}

/* ---------- 거래 수정/삭제 팝업 ---------- */
function EditModal({ txn, onClose }) {
  const [kind, setKind] = React.useState(txn.kind);
  const [cat, setCat] = React.useState(txn.cat);
  const [date, setDate] = React.useState(txn.fullDate);
  const [amount, setAmount] = React.useState(Math.abs(txn.amount));
  const [owner, setOwner] = React.useState(txn.owner || '공통');
  const [pay, setPay] = React.useState(txn.pay || '');
  const [memo, setMemo] = React.useState(txn.memo || '');
  const [busy, setBusy] = React.useState(false);
  const cats = kind === '수입' ? INCOME_CATS : EXPENSE_CATS;
  const Field = MField;

  async function save() {
    if (!amount || amount <= 0) { alert('금액을 확인해 주세요.'); return; }
    setBusy(true);
    try {
      await apiPost({ action: 'update', row: { id: txn.id, date, kind, cat, amount: Number(amount), owner, pay, memo } });
      onClose(true);
    } catch (e) { alert('저장 실패: ' + e.message); setBusy(false); }
  }
  async function del() {
    if (!window.confirm('이 거래를 삭제할까요?')) return;
    setBusy(true);
    try { await apiPost({ action: 'delete', id: txn.id }); onClose(true); }
    catch (e) { alert('삭제 실패: ' + e.message); setBusy(false); }
  }

  return (
    <div className="modal-overlay" onClick={() => onClose(false)}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="table-toolbar" style={{ justifyContent: 'space-between', marginBottom: 18 }}>
          <SectionTitle icon="receipt">거래 수정</SectionTitle>
          <button className="btn ghost sm" onClick={() => onClose(false)}><Icon name="x" size={15} /></button>
        </div>
        <div className="modal-grid">
          <Field label="날짜"><input className="modal-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="구분">
            <select className="modal-input" value={kind} onChange={(e) => { const k = e.target.value; setKind(k); const list = k === '수입' ? INCOME_CATS : EXPENSE_CATS; if (!list.includes(cat)) setCat(list[0]); }}>
              <option>지출</option><option>수입</option>
            </select>
          </Field>
          <Field label="분류"><select className="modal-input" value={cat} onChange={(e) => setCat(e.target.value)}>{cats.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
          <Field label="금액(원)"><input className="modal-input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="지출구분"><select className="modal-input" value={owner} onChange={(e) => setOwner(e.target.value)}>{OWNERS.map(o => <option key={o} value={o}>{o}</option>)}</select></Field>
          <Field label="결제수단"><select className="modal-input" value={pay} onChange={(e) => setPay(e.target.value)}>{PAYS.map(p => <option key={p} value={p}>{p || '-'}</option>)}</select></Field>
          <Field label="메모" full><input className="modal-input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="가게·내용 등" /></Field>
        </div>
        <div className="modal-foot">
          <button className="btn ghost sm" onClick={del} disabled={busy} style={{ color: 'var(--expense)' }}><Icon name="x" size={15} />삭제</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost sm" onClick={() => onClose(false)} disabled={busy}>취소</button>
            <button className="btn" onClick={save} disabled={busy}><Icon name="check" size={15} stroke={2.2} />{busy ? '저장중…' : '저장'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const [months, setMonths] = React.useState([]);
  const [month, setMonth] = React.useState('');
  const [loaded, setLoaded] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [view, setView] = React.useState('summary');
  const [excludeWedding, setExcludeWedding] = React.useState(true);
  const [comp, setComp] = React.useState('donut');
  const [filter, setFilter] = React.useState('all');
  const [editTxn, setEditTxn] = React.useState(null);
  window.openEdit = (t) => setEditTxn(t);

  async function load(m) {
    setErr(null);
    try {
      const data = await fetchWF(m);
      window.WF = data.wf;
      setMonths(data.months || []);
      setMonth(data.month || '');
      setLoaded(true);
    } catch (e) { setErr(e.message); setLoaded(true); }
  }
  React.useEffect(() => { load(''); }, []);   // 최초 1회 (최신 월)
  window.reloadWF = () => load(month);

  const tw = { excludeWedding, setExcludeWedding, comp, setComp, filter, setFilter };

  function Body() {
    if (err) return <div className="card" style={{ color: 'var(--expense)' }}>⚠ 데이터를 불러오지 못했어요: {err}<br /><span style={{ color: 'var(--ink-2)', fontSize: 13 }}>config.js의 API_URL과 Apps Script 배포(액세스=모든 사용자)를 확인하세요.</span></div>;
    if (!loaded || !window.WF) return <div className="card" style={{ color: 'var(--ink-2)' }}>불러오는 중…</div>;
    if (view === 'summary') return <SummaryView {...tw} />;
    if (view === 'ledger') return <LedgerView filter={filter} setFilter={setFilter} />;
    if (view === 'monthly') return <MonthlyView />;
    if (view === 'invest') return <InvestView />;
    return <LoanView />;
  }

  return (
    <div className="dash">
      <div className="dash-header">
        <div className="brand"><BrandMark />우리집 자산 대시보드</div>
        <MonthPicker months={months} month={month} onPick={load} />
        <HeaderActions />
      </div>
      <div className="tabnav">
        {VIEWS.map(v => (
          <button key={v.id} className={view === v.id ? 'on' : ''} onClick={() => setView(v.id)}>
            <Icon name={v.icon} size={17} />{v.label}
          </button>
        ))}
      </div>
      <div className="content"><Body /></div>
      {editTxn && <EditModal txn={editTxn} onClose={(changed) => { setEditTxn(null); if (changed) load(month); }} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Dashboard />);
