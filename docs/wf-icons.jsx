/* 신혼부부 가계부 — 아이콘 세트 (레퍼런스의 모노라인 글리프 칩 재구성)
   일러스트가 아닌 UI 글리프. 24x24 그리드, stroke=currentColor. */

const ICONS = {
  pie:      (<><path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 3v9h9"/></>),
  receipt:  (<><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M8.5 8h7"/><path d="M8.5 12h7"/><path d="M8.5 16h4"/></>),
  trending: (<><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></>),
  gem:      (<><path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18"/><path d="M9 3l3 6 3-6"/><path d="M7.5 9L12 21l4.5-12"/></>),
  scale:    (<><path d="M12 4v16"/><path d="M7 7h10"/><path d="M7 7l-3 7h6z"/><path d="M17 7l-3 7h6z"/><path d="M8 20h8"/></>),
  bank:     (<><path d="M4 10 12 5l8 5"/><path d="M4 10h16"/><path d="M6 10v7"/><path d="M10 10v7"/><path d="M14 10v7"/><path d="M18 10v7"/><path d="M4 20h16"/></>),
  list:     (<><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3.5 6h.01"/><path d="M3.5 12h.01"/><path d="M3.5 18h.01"/></>),
  wallet:   (<><path d="M4 7h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h11"/><path d="M16 13h2"/></>),
  coins:    (<><ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.5 2.7 2.7 6 2.7"/><path d="M3 9.5c0 1.5 2.7 2.7 6 2.7"/><ellipse cx="15" cy="15" rx="6" ry="3"/><path d="M9 15.3V17c0 1.5 2.7 2.7 6 2.7s6-1.2 6-2.7v-2"/></>),
  cart:     (<><circle cx="9" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/><path d="M2 3h3l2.2 11a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.2L21 7H6"/></>),
  utensils: (<><path d="M7 2v20"/><path d="M5 2v4a2 2 0 0 0 4 0V2"/><path d="M16 2c-1.7 1-2 4-2 7s1 4 2 4v9"/></>),
  coffee:   (<><path d="M4 8h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M17 9h2a3 3 0 0 1 0 6h-2"/><path d="M7 2v2.5"/><path d="M11 2v2.5"/></>),
  home:     (<><path d="M4 10 12 4l8 6"/><path d="M6 9v11h12V9"/><path d="M10 20v-6h4v6"/></>),
  phone:    (<><path d="M6 3h3l1.5 5-2 1.3a12 12 0 0 0 5 5L15 13l5 1.5V18a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z"/></>),
  film:     (<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16"/><path d="M17 4v16"/><path d="M3 9h4"/><path d="M17 9h4"/><path d="M3 15h4"/><path d="M17 15h4"/></>),
  bag:      (<><path d="M5 7h14l1 13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M8 7a4 4 0 0 1 8 0"/></>),
  cross:    (<><path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z"/></>),
  refresh:  (<><path d="M3.5 12a8.5 8.5 0 1 0 2.4-5.9"/><path d="M3 4v4h4"/></>),
  ring:     (<><circle cx="12" cy="15" r="5"/><path d="M9 11 7.5 4h9L15 11"/></>),
  calendar: (<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/></>),
  chevL:    (<><path d="M15 6l-6 6 6 6"/></>),
  chevR:    (<><path d="M9 6l6 6-6 6"/></>),
  chevD:    (<><path d="M6 9l6 6 6-6"/></>),
  search:   (<><circle cx="11" cy="11" r="7"/><path d="M21 21l-3.6-3.6"/></>),
  download: (<><path d="M12 3v12"/><path d="M7 11l5 4 5-4"/><path d="M4 20h16"/></>),
  plus:     (<><path d="M12 5v14"/><path d="M5 12h14"/></>),
  check:    (<><path d="M5 12l4 4 10-10"/></>),
  x:        (<><path d="M6 6l12 12"/><path d="M18 6 6 18"/></>),
  sliders:  (<><path d="M4 6h9"/><path d="M17 6h3"/><circle cx="15" cy="6" r="2"/><path d="M4 12h3"/><path d="M11 12h9"/><circle cx="9" cy="12" r="2"/><path d="M4 18h11"/><path d="M19 18h1"/><circle cx="17" cy="18" r="2"/></>),
  bolt:     (<><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></>),
  layers:   (<><path d="M12 3 3 8l9 5 9-5z"/><path d="M3 13l9 5 9-5"/></>),
  target:   (<><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></>),
};

function Icon({ name, size = 20, stroke = 1.8, className, style }) {
  const glyph = ICONS[name] || ICONS.list;
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {glyph}
    </svg>
  );
}

/* 레퍼런스의 라운드 사각형 컬러 칩 */
function IconChip({ name, tone = 'gray', size = 28 }) {
  return (
    <span className={`icon-chip tone-${tone}`} style={{ width: size, height: size, flex: `0 0 ${size}px` }}>
      <Icon name={name} size={Math.round(size * 0.6)} stroke={1.9} />
    </span>
  );
}

/* 분류 라벨 → {아이콘, 톤} 매핑 (이모지 대체) */
const CAT = {
  '식비-장보기': { name: 'cart', tone: 'rose' },
  '식비-외식':   { name: 'utensils', tone: 'rose' },
  '식비-카페':   { name: 'coffee', tone: 'yellow' },
  '카페':        { name: 'coffee', tone: 'yellow' },
  '주거':        { name: 'home', tone: 'blue' },
  '통신':        { name: 'phone', tone: 'blue' },
  '보험':        { name: 'cross', tone: 'mint' },
  '구독':        { name: 'refresh', tone: 'purple' },
  '교통(정액)':  { name: 'bank', tone: 'blue' },
  '교통(비정기)':{ name: 'bank', tone: 'blue' },
  '대출원금상환':{ name: 'bank', tone: 'gray' },
  '생활용품':    { name: 'list', tone: 'gray' },
  '문화·여가':   { name: 'film', tone: 'purple' },
  '의류·미용':   { name: 'bag', tone: 'purple' },
  '의료':        { name: 'cross', tone: 'mint' },
  '웨딩':        { name: 'ring', tone: 'rose' },
  '경조사':      { name: 'gem', tone: 'rose' },
  '기타':        { name: 'list', tone: 'gray' },
  '용돈':        { name: 'coins', tone: 'yellow' },
  '상여·보너스': { name: 'wallet', tone: 'green' },
  '분기 상여':   { name: 'wallet', tone: 'green' },
  '지영 급여':   { name: 'wallet', tone: 'yellow' },
  '승화 급여':   { name: 'wallet', tone: 'green' },
  '기타수입':    { name: 'wallet', tone: 'blue' },
};
const catOf = (label) => CAT[label] || { name: 'list', tone: 'gray' };

Object.assign(window, { Icon, IconChip, CAT, catOf });
