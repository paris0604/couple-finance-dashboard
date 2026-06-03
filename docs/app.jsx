/* 우리집 자산 대시보드 — 실제 셸 (사이드바형) + 라이브 데이터 연결
   wf-data.jsx(더미)와 wf-app.jsx(시안 셸)를 대체한다. */

/* ---------- 표시 유틸 (구 wf-data.jsx에서 이관) ---------- */
const KRW = (n) => {
  const man = (n || 0) / 10000;
  if (Math.abs(man) >= 10000) return (man / 10000).toFixed(man % 10000 === 0 ? 0 : 1) + '억';
  return man.toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '만';
};
const SHARE_COLOR = { common: 'var(--tag-common)', jiyoung: 'var(--tag-jiyoung)', seunghwa: 'var(--tag-seunghwa)' };
const SHARE_LABEL = { common: '공통', jiyoung: '지영', seunghwa: '승화' };
Object.assign(window, { KRW, SHARE_COLOR, SHARE_LABEL });

const API = window.API_URL || '';
const VIEWS = [
  { id: 'summary', icon: 'pie', label: '공통 요약' },
  { id: 'ledger', icon: 'receipt', label: '가계부' },
  { id: 'invest', icon: 'trending', label: '투자' },
];

/* ---------- API ---------- */
async function fetchWF(month) {
  const url = API + (API.includes('?') ? '&' : '?') + 'month=' + encodeURIComponent(month || '');
  const r = await fetch(url, { method: 'GET' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function postEntries(rows) {
  // text/plain 으로 보내 CORS preflight 회피 (Apps Script 표준 패턴)
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ rows }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(j.error || ('HTTP ' + r.status));
  return j;
}
window.postEntries = postEntries;

/* ---------- 셸 ---------- */
function BrandMark() { return <span className="brand-mark"><Icon name="home" size={17} stroke={2} /></span>; }

function MonthPicker({ months, month, setMonth }) {
  const i = months.indexOf(month);
  const disp = month ? month.slice(0, 4) + '년 ' + parseInt(month.slice(5), 10) + '월' : '';
  const go = (d) => { const j = i + d; if (j >= 0 && j < months.length) setMonth(months[j]); };
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

function Dashboard() {
  const [months, setMonths] = React.useState([]);
  const [month, setMonth] = React.useState('');
  const [loaded, setLoaded] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [view, setView] = React.useState('summary');
  const [excludeWedding, setExcludeWedding] = React.useState(true);
  const [comp, setComp] = React.useState('donut');
  const [filter, setFilter] = React.useState('all');
  const [tick, setTick] = React.useState(0);

  async function load(m) {
    setErr(null);
    try {
      const data = await fetchWF(m);
      window.WF = data.wf;
      setMonths(data.months || []);
      setMonth(data.month || '');
      setLoaded(true);
      setTick(t => t + 1);
    } catch (e) { setErr(e.message); setLoaded(true); }
  }
  React.useEffect(() => { load(''); }, []);
  React.useEffect(() => { if (month) load(month); /* eslint-disable-next-line */ }, [month]);
  window.reloadWF = () => load(month);

  const tw = { excludeWedding, setExcludeWedding, comp, setComp, filter, setFilter };
  const cur = VIEWS.find(v => v.id === view);

  function Body() {
    if (err) return <div className="card" style={{ color: 'var(--expense)' }}>⚠ 데이터를 불러오지 못했어요: {err}<br /><span style={{ color: 'var(--ink-2)', fontSize: 13 }}>config.js의 API_URL과 Apps Script 배포를 확인하세요.</span></div>;
    if (!loaded || !window.WF) return <div className="card" style={{ color: 'var(--ink-2)' }}>불러오는 중…</div>;
    if (view === 'summary') return <SummaryView {...tw} />;
    if (view === 'ledger') return <LedgerView filter={filter} setFilter={setFilter} />;
    return <InvestView />;
  }

  return (
    <div className="dash" key={tick}>
      <div className="with-sidebar">
        <nav className="sidebar">
          <div className="side-brand"><BrandMark />우리집</div>
          {VIEWS.map(v => (
            <button key={v.id} className={view === v.id ? 'on' : ''} onClick={() => setView(v.id)}>
              <Icon name={v.icon} size={18} />{v.label}
            </button>
          ))}
          <div className="side-foot">띠동이 · 쮸쮸 💚</div>
        </nav>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="dash-header">
            <div className="brand"><Icon name={cur.icon} size={19} style={{ color: 'var(--ink-2)' }} />{cur.label}</div>
            <MonthPicker months={months} month={month} setMonth={setMonth} />
            <HeaderActions />
          </div>
          <div className="content"><Body /></div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Dashboard />);
