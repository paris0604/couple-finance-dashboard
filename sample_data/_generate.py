"""샘플 데이터 생성기 — 실행: python sample_data/_generate.py
신혼부부 3개월(2026-03~05) 합산 가계 + 투자 거래내역을 만든다.
(결제자 컬럼 없음 — 공동 풀 구조. 지출구분=공통/지영/승화 가 자금흐름 축)"""
import csv, os, random, datetime as dt

random.seed(42)
HERE = os.path.dirname(__file__)
MONTHS = ["2026-03", "2026-04", "2026-05"]


def d(ym, day):
    y, m = map(int, ym.split("-"))
    return f"{y:04d}-{m:02d}-{day:02d}"


def tx(seq):
    return f"TX{seq:06d}"


# ── 가계부 ───────────────────────────────────────────────
ledger = []
seq = 1


def add(date, gubun, cat, amt, owner, pay="계좌이체", memo=""):
    global seq
    ledger.append([tx(seq), date, gubun, cat, amt, owner, pay, memo])
    seq += 1


for ym in MONTHS:
    # 수입
    add(d(ym, 25), "수입", "지영 급여", 3_200_000, "공통", "계좌이체", "급여")
    add(d(ym, 25), "수입", "승화 급여", 3_600_000, "공통", "계좌이체", "급여")
    if ym == "2026-03":
        add(d(ym, 25), "수입", "상여·보너스", 1_500_000, "공통", "계좌이체", "분기상여")

    # 고정비
    add(d(ym, 1), "지출", "주거", 1_200_000, "공통", "계좌이체", "월세+관리비")
    add(d(ym, 5), "지출", "통신", 110_000, "공통", "체크카드", "휴대폰 2인")
    add(d(ym, 5), "지출", "보험", 180_000, "공통", "계좌이체", "실손+종신")
    add(d(ym, 7), "지출", "구독", 39_000, "공통", "체크카드", "넷플릭스+유튜브+멜론")
    add(d(ym, 1), "지출", "교통(정액)", 110_000, "공통", "체크카드", "정기권 2인")
    add(d(ym, 17), "지출", "대출원금상환", 500_000, "공통", "계좌이체", "전세대출 원금")

    # 변동비 — 식비 장보기 (주 1회)
    for day in [3, 11, 18, 26]:
        amt = random.choice([62_000, 48_000, 73_000, 55_000, 81_000])
        add(d(ym, day), "지출", "식비-장보기", amt, "공통", "체크카드", "마트 장보기")
    # 외식
    for day in random.sample(range(2, 28), 6):
        add(d(ym, day), "지출", "식비-외식",
            random.choice([18_000, 32_000, 45_000, 27_000]), "공통", "신용카드", "외식")
    # 카페
    for day in random.sample(range(2, 28), 5):
        add(d(ym, day), "지출", "식비-카페",
            random.choice([4_800, 9_600, 6_400]), "공통", "체크카드", "카페")
    # 생활용품 (공통 + 개인 필수재)
    add(d(ym, 9), "지출", "생활용품", 34_000, "공통", "체크카드", "다이소+세제")
    add(d(ym, 14), "지출", "생활용품", 12_000, "지영", "체크카드", "개인 필수재")
    add(d(ym, 21), "지출", "생활용품", 9_000, "승화", "체크카드", "면도기")
    # 교통 비정기
    add(d(ym, random.randint(5, 25)), "지출", "교통(비정기)",
        random.choice([12_000, 48_000]), "공통", "신용카드", "택시/주유")
    # 의료
    if random.random() < 0.7:
        add(d(ym, random.randint(5, 25)), "지출", "의료",
            random.choice([15_000, 42_000]),
            random.choice(["공통", "지영", "승화"]), "체크카드", "병원/약국")
    # 문화여가
    add(d(ym, random.randint(8, 26)), "지출", "문화·여가",
        random.choice([28_000, 64_000]), "공통", "신용카드", "영화/전시")
    # 의류미용
    if random.random() < 0.6:
        add(d(ym, random.randint(8, 26)), "지출", "의류·미용",
            random.choice([35_000, 80_000]),
            random.choice(["지영", "승화"]), "신용카드", "미용/의류")
    # 경조사
    if ym == "2026-04":
        add(d(ym, 19), "지출", "경조사", 100_000, "공통", "계좌이체", "지인 결혼 축의금")
    # 웨딩 (신혼 초기 일시 비용 — 별도 카테고리로 분리)
    if ym == "2026-03":
        add(d(ym, 8), "지출", "웨딩", 1_800_000, "공통", "계좌이체", "스드메 잔금")
    if ym == "2026-05":
        add(d(ym, 12), "지출", "웨딩", 3_200_000, "공통", "신용카드", "신혼여행 항공+숙소")

    # 용돈 (정액 전출, 사용처 미추적)
    add(d(ym, 25), "지출", "용돈", 400_000, "지영", "계좌이체", "정액 용돈")
    add(d(ym, 25), "지출", "용돈", 400_000, "승화", "계좌이체", "정액 용돈")

with open(os.path.join(HERE, "가계부.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["거래ID", "날짜", "구분", "분류", "금액", "지출구분", "결제수단", "메모"])
    w.writerows(ledger)

# ── 보유현황 (투자 거래내역) ──────────────────────────────
inv = []
iseq = 1


def buy(date, ticker, qty, price, cur, fx, fee, acct, strat, note):
    global iseq
    inv.append([f"IV{iseq:05d}", date, "buy", ticker, qty, price, cur, fx, fee,
                acct, strat, note, "1"])
    iseq += 1


# 미국 ETF (달러) + 국내 ETF (원화)
fx_usd = {"2026-03": 1340, "2026-04": 1355, "2026-05": 1325}
for ym in MONTHS:
    buy(d(ym, 26), "VOO", 1, 500, "USD", fx_usd[ym], 1000, "키움 해외", "core", "S&P500 적립")
    buy(d(ym, 26), "SCHD", 3, 28, "USD", fx_usd[ym], 800, "키움 해외", "dividend", "배당성장")
    buy(d(ym, 27), "360750", 5, 18500, "KRW", 1, 0, "미래 연금", "core", "TIGER S&P500 연금")
    buy(d(ym, 27), "305720", 4, 12000, "KRW", 1, 0, "미래 연금", "growth", "KODEX 2차전지")
# 일부 리밸런싱 매도 1건
inv.append(["IV09001", d("2026-05", 20), "sell", "305720", 2, 13500, "KRW", 1, 0,
            "미래 연금", "growth", "일부 차익실현", "1"])

with open(os.path.join(HERE, "보유현황.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["txn_id", "date", "action", "ticker", "quantity", "price", "currency",
                "fx_rate", "fee_krw", "account", "strategy", "note", "schema_version"])
    w.writerows(inv)

print(f"가계부 {len(ledger)}행, 보유현황 {len(inv)}행 생성 완료")
