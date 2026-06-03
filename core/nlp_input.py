"""
빠른입력 박스 — 규칙 기반(rule-based) 자연어 정규화 (PRD §4).
비용 0 · 예측 가능성 우선. Claude API 연동은 2차 보완(여기서 훅만 열어둠).

예) "어제 마트 3.2만"        → 날짜=어제, 분류=식비-장보기, 금액=32000
    "점심 김밥 5천 외식"      → 분류=식비-외식, 금액=5000
    "스타벅스 4800 카페"      → 분류=식비-카페, 금액=4800
    "6/1 월세 80만 주거"      → 날짜=06-01, 분류=주거, 금액=800000
    "급여 350만 수입"         → 구분=수입, 금액=3500000
"""
from __future__ import annotations

import re
import datetime as dt
from dataclasses import dataclass, field

from .config import (
    EXPENSE_CATEGORIES, INCOME_CATEGORIES, GUBUN_INCOME, GUBUN_EXPENSE,
    SPEND_OWNER, MEMBERS,
)

# ── 키워드 → 분류 사전 (규칙 기반의 핵심) ────────────────────────
KEYWORD_CATEGORY = {
    # 식비
    "마트": "식비-장보기", "장보기": "식비-장보기", "이마트": "식비-장보기",
    "홈플러스": "식비-장보기", "쿠팡": "식비-장보기", "마켓컬리": "식비-장보기",
    "재료": "식비-장보기", "반찬": "식비-장보기",
    "외식": "식비-외식", "점심": "식비-외식", "저녁": "식비-외식", "배달": "식비-외식",
    "식당": "식비-외식", "김밥": "식비-외식", "치킨": "식비-외식", "회식": "식비-외식",
    "카페": "식비-카페", "커피": "식비-카페", "스타벅스": "식비-카페", "스벅": "식비-카페",
    "디저트": "식비-카페", "베이커리": "식비-카페", "빵": "식비-카페",
    # 고정비
    "월세": "주거", "관리비": "주거", "전세대출이자": "주거", "대출이자": "주거", "주거": "주거",
    "통신": "통신", "핸드폰": "통신", "휴대폰": "통신", "인터넷": "통신", "요금": "통신",
    "보험": "보험",
    "구독": "구독", "넷플릭스": "구독", "유튜브": "구독", "멤버십": "구독", "스포티파이": "구독",
    "교통카드": "교통(정액)", "정기권": "교통(정액)",
    "대출상환": "대출원금상환", "원금상환": "대출원금상환", "대출원금": "대출원금상환",
    "원금": "대출원금상환", "상환": "대출원금상환", "할부": "대출원금상환",
    # 변동비
    "생활용품": "생활용품", "다이소": "생활용품", "휴지": "생활용품", "세제": "생활용품",
    "면도기": "생활용품", "생리대": "생활용품", "화장지": "생활용품",
    "택시": "교통(비정기)", "ktx": "교통(비정기)", "기차": "교통(비정기)", "주유": "교통(비정기)",
    "버스": "교통(비정기)", "지하철": "교통(비정기)",
    "병원": "의료", "약국": "의료", "약": "의료", "의료": "의료", "치과": "의료",
    "영화": "문화·여가", "공연": "문화·여가", "여행": "문화·여가", "전시": "문화·여가", "여가": "문화·여가",
    "옷": "의류·미용", "의류": "의류·미용", "미용실": "의류·미용", "화장품": "의류·미용", "네일": "의류·미용",
    "웨딩": "웨딩", "예식": "웨딩", "스드메": "웨딩", "예물": "웨딩", "신혼여행": "웨딩",
    "허니문": "웨딩", "예단": "웨딩", "본식": "웨딩", "웨딩홀": "웨딩", "드레스": "웨딩",
    "경조사": "경조사", "축의금": "경조사", "조의금": "경조사", "선물": "경조사",
    "용돈": "용돈",
    # 수입
    "급여": None, "월급": None, "상여": "상여·보너스", "보너스": "상여·보너스",
    # ── 브랜드명 → 업종 (영문은 소문자) ──
    "투썸": "식비-카페", "이디야": "식비-카페", "메가커피": "식비-카페", "빽다방": "식비-카페",
    "컴포즈": "식비-카페", "폴바셋": "식비-카페", "커피빈": "식비-카페", "할리스": "식비-카페",
    "공차": "식비-카페", "엔젤리너스": "식비-카페", "파리바게뜨": "식비-카페", "뚜레쥬르": "식비-카페",
    "맥도날드": "식비-외식", "맘스터치": "식비-외식", "버거킹": "식비-외식", "롯데리아": "식비-외식",
    "김밥천국": "식비-외식", "배달의민족": "식비-외식", "배민": "식비-외식", "요기요": "식비-외식",
    "쿠팡이츠": "식비-외식", "교촌": "식비-외식", "bhc": "식비-외식", "굽네": "식비-외식",
    "도미노": "식비-외식", "피자헛": "식비-외식", "써브웨이": "식비-외식", "한솥": "식비-외식", "노브랜드버거": "식비-외식",
    "노브랜드": "식비-장보기", "트레이더스": "식비-장보기", "코스트코": "식비-장보기",
    "롯데마트": "식비-장보기", "하나로마트": "식비-장보기", "킴스클럽": "식비-장보기",
    "올리브영": "의류·미용", "무신사": "의류·미용", "지그재그": "의류·미용", "에이블리": "의류·미용",
    "자라": "의류·미용", "유니클로": "의류·미용", "스파오": "의류·미용", "이니스프리": "의류·미용",
    "아리따움": "의류·미용", "에잇세컨즈": "의류·미용",
    "cgv": "문화·여가", "메가박스": "문화·여가", "롯데시네마": "문화·여가", "에버랜드": "문화·여가",
    "롯데월드": "문화·여가", "야놀자": "문화·여가", "여기어때": "문화·여가", "스팀": "문화·여가",
    "카카오택시": "교통(비정기)", "카카오t": "교통(비정기)", "쏘카": "교통(비정기)", "그린카": "교통(비정기)",
    "gs칼텍스": "교통(비정기)", "sk에너지": "교통(비정기)", "현대오일뱅크": "교통(비정기)",
    "에쓰오일": "교통(비정기)", "s-oil": "교통(비정기)", "코레일": "교통(비정기)", "srt": "교통(비정기)",
    "skt": "통신", "kt": "통신", "lg유플러스": "통신", "유플러스": "통신", "알뜰폰": "통신",
    "멜론": "구독", "왓챠": "구독", "티빙": "구독", "쿠팡플레이": "구독", "디즈니": "구독",
    "지니뮤직": "구독", "챗gpt": "구독", "chatgpt": "구독", "노션": "구독", "디즈니플러스": "구독",
    "무인양품": "생활용품",
}

# 수입 키워드 (구분 판별용)
INCOME_HINTS = ["급여", "월급", "상여", "보너스", "수입", "입금", "환급"]

_AMOUNT_UNIT = {"억": 100_000_000, "만": 10_000, "천": 1_000, "원": 1}


@dataclass
class ParsedEntry:
    """정규화 결과. 확정 전 사용자에게 보여주고 수정받는 임시 구조."""
    날짜: dt.date | None = None
    구분: str = GUBUN_EXPENSE
    분류: str | None = None
    금액: int | None = None
    지출구분: str = "공통"
    결제수단: str = ""
    메모: str = ""
    warnings: list[str] = field(default_factory=list)


def _parse_date(text: str, today: dt.date) -> tuple[dt.date | None, str]:
    """상대/절대 날짜 추출 후 (날짜, 잔여텍스트) 반환."""
    if "그저께" in text or "그제" in text:
        return today - dt.timedelta(days=2), text.replace("그저께", "").replace("그제", "")
    if "어제" in text:
        return today - dt.timedelta(days=1), text.replace("어제", "")
    if "오늘" in text:
        return today, text.replace("오늘", "")
    # M/D 또는 M-D 또는 YYYY-MM-DD (단, 뒤에 만/천/억/원이 오면 금액이므로 날짜 제외)
    m = re.search(r"(?:(\d{4})[-/.])?(\d{1,2})[-/.](\d{1,2})(?!\s*(?:만|천|억|원))", text)
    if m:
        y = int(m.group(1)) if m.group(1) else today.year
        try:
            d = dt.date(y, int(m.group(2)), int(m.group(3)))
            return d, text[:m.start()] + text[m.end():]
        except ValueError:
            pass
    return None, text


def _parse_amount(text: str) -> tuple[int | None, str]:
    """'3.2만', '5천', '1만2천', '80만', '4800' 등 → 정수 원."""
    # 1) 만/천/억 복합: '1만2천', '3만5천원'
    combo = re.findall(r"(\d+(?:\.\d+)?)\s*(억|만|천)", text)
    total, used = 0, False
    span_text = text
    if combo:
        used = True
        for num, unit in combo:
            total += float(num) * _AMOUNT_UNIT[unit]
        # 단위 뒤 남은 순수 숫자(예: '1만2' = 1만 + 2천? → 무시, 명시적 천만)
        span_text = re.sub(r"\d+(?:\.\d+)?\s*(?:억|만|천)", "", text)
        # 단위 없는 잔여 숫자(원 단위)는 더하지 않음 — 모호성 차단
        return int(round(total)), span_text
    # 2) 단위 없는 순수 숫자: '4800', '4,800'
    m = re.search(r"(\d[\d,]*)\s*원?", text)
    if m:
        return int(m.group(1).replace(",", "")), text[:m.start()] + text[m.end():]
    return None, text


def _detect_category(text: str) -> tuple[str | None, bool]:
    """키워드 매칭 → (분류, 수입여부). 가장 먼저 매칭된 키워드 채택."""
    compact = re.sub(r"\s+", "", text.lower())  # 띄어쓰기 무시 ("대출 상환"→"대출상환")
    is_income = any(h in compact for h in INCOME_HINTS)
    # 긴(구체적) 키워드 우선 — "신혼여행"이 "여행"보다 먼저 매칭되도록
    for kw in sorted(KEYWORD_CATEGORY, key=len, reverse=True):
        cat = KEYWORD_CATEGORY[kw]
        if kw.replace(" ", "") in compact:
            if cat is None:  # 급여류 → 분류는 후처리(이름별 급여)
                return None, True
            if cat in INCOME_CATEGORIES:
                return cat, True
            return cat, is_income
    return None, is_income


def parse(text: str, today: dt.date | None = None) -> ParsedEntry:
    today = today or dt.date.today()
    raw = text.strip()
    e = ParsedEntry(메모=raw)

    # 지출구분 힌트 — 사람 이름이 언급되면 개인 귀속 후보로 본다.
    person = next((n for n in MEMBERS if n in raw), None)
    for owner in SPEND_OWNER:
        if f"({owner})" in raw or f"[{owner}]" in raw:
            e.지출구분 = owner

    e.날짜, rest = _parse_date(raw, today)
    if e.날짜 is None:
        e.날짜 = today
        e.warnings.append("날짜 미인식 → 오늘로 설정")

    e.금액, rest = _parse_amount(rest)
    if e.금액 is None:
        e.warnings.append("금액을 못 찾았어요. 직접 입력해 주세요.")

    cat, is_income = _detect_category(raw)
    if is_income:
        e.구분 = GUBUN_INCOME
        if cat is None:  # 급여 — 이름으로 귀속
            if "지영" in raw:
                cat = "지영 급여"
            elif "승화" in raw:
                cat = "승화 급여"
            else:
                cat = "기타수입"
    e.분류 = cat
    if cat is None:
        e.warnings.append("분류 미인식 → 드롭다운에서 선택하세요.")

    # 용돈은 지출구분이 개인이어야 함 — 이름이 있으면 그 사람으로
    if cat == "용돈" and e.지출구분 == "공통" and person in MEMBERS:
        e.지출구분 = person

    e.메모 = _clean_memo(raw)  # 금액·날짜는 별도 저장되므로 메모에서 제거
    return e


def _clean_memo(raw: str) -> str:
    """메모에서 금액·날짜·구분태그 제거 → 가게/키워드만 남김."""
    s = re.sub(r"\d+(?:\.\d+)?\s*(?:억|만|천|원)", "", raw)      # 금액 단위
    s = re.sub(r"(그저께|그제|어제|오늘)", "", s)                # 상대 날짜
    s = re.sub(r"(?:\d{4}[-/.])?\d{1,2}[-/.]\d{1,2}", "", s)     # 절대 날짜 ← 숫자 제거보다 먼저
    s = re.sub(r"\d[\d,]*\s*원?", "", s)                         # 남은 숫자
    s = re.sub(r"[\[\(](공통|지영|승화)[\]\)]", "", s)
    return re.sub(r"\s+", " ", s).strip()
