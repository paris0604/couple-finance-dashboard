/* 빠른입력 규칙기반 파서 (core/nlp_input.py 의 JS 포팅)
   "어제 마트 3.2만, 점심 김밥 5천 외식" → [{구조화 항목}, ...]
   쉼표로 여러 건 분리. window.parseQuick 으로 노출. */
(function () {
  const MEMBERS = ['지영', '승화'];
  const OWNERS = ['공통', '지영', '승화'];
  const SHARE_OF = { '공통': 'common', '지영': 'jiyoung', '승화': 'seunghwa' };

  const INCOME_CATS = ['지영 급여', '승화 급여', '상여·보너스', '기타수입'];
  const INCOME_HINTS = ['급여', '월급', '상여', '보너스', '수입', '입금', '환급'];

  const EMOJI = {
    '주거': '🏠', '통신': '📱', '보험': '🛡️', '구독': '🕹️', '교통(정액)': '🚌',
    '대출원금상환': '🏦', '식비-장보기': '🛒', '식비-외식': '🍽️', '식비-카페': '☕',
    '생활용품': '🧻', '교통(비정기)': '🚌', '의료': '💊', '문화·여가': '🎬',
    '의류·미용': '🛍️', '웨딩': '💍', '경조사': '💐', '기타': '📦', '용돈': '💸',
    '지영 급여': '💰', '승화 급여': '💰', '상여·보너스': '💰', '기타수입': '➕',
  };

  // 키워드 → 분류 (null = 급여류, 후처리)
  const KW = {
    '마트': '식비-장보기', '장보기': '식비-장보기', '이마트': '식비-장보기', '홈플러스': '식비-장보기',
    '쿠팡': '식비-장보기', '마켓컬리': '식비-장보기', '재료': '식비-장보기', '반찬': '식비-장보기',
    '외식': '식비-외식', '점심': '식비-외식', '저녁': '식비-외식', '배달': '식비-외식',
    '식당': '식비-외식', '김밥': '식비-외식', '치킨': '식비-외식', '회식': '식비-외식',
    '카페': '식비-카페', '커피': '식비-카페', '스타벅스': '식비-카페', '스벅': '식비-카페',
    '디저트': '식비-카페', '베이커리': '식비-카페', '빵': '식비-카페',
    '월세': '주거', '관리비': '주거', '대출이자': '주거', '주거': '주거',
    '통신': '통신', '핸드폰': '통신', '휴대폰': '통신', '인터넷': '통신', '요금': '통신',
    '보험': '보험', '구독': '구독', '넷플릭스': '구독', '유튜브': '구독', '멤버십': '구독', '스포티파이': '구독',
    '교통카드': '교통(정액)', '정기권': '교통(정액)', '원금': '대출원금상환', '대출상환': '대출원금상환',
    '생활용품': '생활용품', '다이소': '생활용품', '휴지': '생활용품', '세제': '생활용품',
    '면도기': '생활용품', '생리대': '생활용품', '화장지': '생활용품',
    '택시': '교통(비정기)', 'ktx': '교통(비정기)', '기차': '교통(비정기)', '주유': '교통(비정기)',
    '버스': '교통(비정기)', '지하철': '교통(비정기)',
    '병원': '의료', '약국': '의료', '약': '의료', '의료': '의료', '치과': '의료',
    '영화': '문화·여가', '공연': '문화·여가', '여행': '문화·여가', '전시': '문화·여가', '여가': '문화·여가',
    '옷': '의류·미용', '의류': '의류·미용', '미용실': '의류·미용', '화장품': '의류·미용', '네일': '의류·미용',
    '웨딩': '웨딩', '예식': '웨딩', '스드메': '웨딩', '예물': '웨딩', '신혼여행': '웨딩',
    '허니문': '웨딩', '예단': '웨딩', '본식': '웨딩', '웨딩홀': '웨딩', '드레스': '웨딩',
    '경조사': '경조사', '축의금': '경조사', '조의금': '경조사', '선물': '경조사',
    '용돈': '용돈', '급여': null, '월급': null, '상여': '상여·보너스', '보너스': '상여·보너스',
  };
  const UNIT = { '억': 1e8, '만': 1e4, '천': 1e3, '원': 1 };

  function pad(n) { return String(n).padStart(2, '0'); }
  function fmtDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function label(d) { return pad(d.getMonth() + 1) + '.' + pad(d.getDate()); }

  function parseDate(text, today) {
    let t = text;
    if (t.includes('그저께') || t.includes('그제')) return [new Date(today - 2 * 864e5), t.replace(/그저께|그제/g, '')];
    if (t.includes('어제')) return [new Date(today - 864e5), t.replace('어제', '')];
    if (t.includes('오늘')) return [new Date(+today), t.replace('오늘', '')];
    const m = t.match(/(?:(\d{4})[-/.])?(\d{1,2})[-/.](\d{1,2})/);
    if (m) {
      const y = m[1] ? +m[1] : today.getFullYear();
      const d = new Date(y, +m[2] - 1, +m[3]);
      if (!isNaN(d)) return [d, t.slice(0, m.index) + t.slice(m.index + m[0].length)];
    }
    return [new Date(+today), t];
  }

  function parseAmount(text) {
    const combo = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(억|만|천)/g)];
    if (combo.length) {
      let total = 0;
      for (const c of combo) total += parseFloat(c[1]) * UNIT[c[2]];
      return Math.round(total);
    }
    const m = text.match(/(\d[\d,]*)\s*원?/);
    if (m) return parseInt(m[1].replace(/,/g, ''), 10);
    return null;
  }

  function detectCat(low) {
    const isIncome = INCOME_HINTS.some(h => low.includes(h));
    const keys = Object.keys(KW).sort((a, b) => b.length - a.length); // 긴 키워드 우선
    for (const kw of keys) {
      if (low.includes(kw)) {
        const cat = KW[kw];
        if (cat === null) return [null, true];
        if (INCOME_CATS.includes(cat)) return [cat, true];
        return [cat, isIncome];
      }
    }
    return [null, isIncome];
  }

  function parseOne(raw, today) {
    const low = raw.toLowerCase();
    const person = MEMBERS.find(n => raw.includes(n)) || null;
    let owner = '공통';
    for (const o of OWNERS) if (raw.includes('(' + o + ')') || raw.includes('[' + o + ']')) owner = o;

    const [d, rest] = parseDate(raw, today);
    const amount = parseAmount(rest);
    let [cat, isIncome] = detectCat(low);
    let kind = '지출';
    if (isIncome) {
      kind = '수입';
      if (cat === null) cat = raw.includes('지영') ? '지영 급여' : raw.includes('승화') ? '승화 급여' : '기타수입';
    }
    if (cat === '용돈' && owner === '공통' && person) owner = person;

    return {
      date: fmtDate(d), dateLabel: label(d), kind,
      cat: cat || '기타', emoji: EMOJI[cat] || '📦',
      amount: amount || 0, owner, share: SHARE_OF[owner],
      pay: '', memo: raw.trim(),
    };
  }

  window.parseQuick = function (text) {
    const today = new Date();
    return text.split(',').map(s => s.trim()).filter(Boolean).map(s => parseOne(s, today));
  };
})();
