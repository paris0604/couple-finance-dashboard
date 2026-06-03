"""
계산 레이어 — 가계부(flow) + 투자(transaction log) → 의사결정 지표.
PRD §2 현금흐름 모델, §8 순투입원금, §9 MVP 지표를 구현한다.

설계 원칙
- 숫자는 한 곳에서만 계산해 두 사람이 '같은 숫자'를 본다(PRD §1 성공기준).
- 시세 의존 0 (1차 산출). 평가손익은 2차(여기서 자리만 비워둠).
"""
from __future__ import annotations

import pandas as pd

from . import config as C


# ──────────────────────────────────────────────────────────────
# 숫자 정규화 (PRD §10) — 통화기호·쉼표 텍스트 → 숫자형
# ──────────────────────────────────────────────────────────────
def to_number(series: pd.Series) -> pd.Series:
    if series.dtype.kind in "if":
        return series.fillna(0)
    cleaned = (
        series.astype(str)
        .str.replace(r"[^\d.\-]", "", regex=True)
        .replace("", "0")
    )
    return pd.to_numeric(cleaned, errors="coerce").fillna(0)


# ──────────────────────────────────────────────────────────────
# 가계부 전처리
# ──────────────────────────────────────────────────────────────
def prep_ledger(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["날짜"] = pd.to_datetime(df["날짜"], errors="coerce")
    df["금액"] = to_number(df["금액"])
    df = df.dropna(subset=["날짜"])
    df["연월"] = df["날짜"].dt.to_period("M").astype(str)
    # 고정/변동 태깅
    df["비용성격"] = df["분류"].map(_cost_nature)
    return df.sort_values("날짜")


def _cost_nature(cat: str) -> str:
    if cat in C.FIXED_CATEGORIES:
        return "고정비"
    if cat in C.VARIABLE_CATEGORIES:
        return "변동비"
    if cat == C.ALLOWANCE_CATEGORY:
        return "용돈"
    return "수입" if cat in C.INCOME_CATEGORIES else "기타"


def months_available(ledger: pd.DataFrame) -> list[str]:
    return sorted(ledger["연월"].unique().tolist(), reverse=True)


def month_slice(ledger: pd.DataFrame, ym: str) -> pd.DataFrame:
    return ledger[ledger["연월"] == ym]


# ──────────────────────────────────────────────────────────────
# 월 현금흐름 요약 (PRD §2 모델)
# ──────────────────────────────────────────────────────────────
def monthly_summary(ledger: pd.DataFrame, ym: str, invest_invested: float = 0.0) -> dict:
    m = month_slice(ledger, ym)
    inc = m[m["구분"] == C.GUBUN_INCOME]
    exp = m[m["구분"] == C.GUBUN_EXPENSE]

    income = float(inc["금액"].sum())
    expense = float(exp["금액"].sum())
    fixed = float(exp[exp["비용성격"] == "고정비"]["금액"].sum())
    variable = float(exp[exp["비용성격"] == "변동비"]["금액"].sum())
    allowance = float(exp[exp["비용성격"] == "용돈"]["금액"].sum())

    # 저축액 = 합산수입 − 총지출 (가계 내 현금 잉여) + 당월 투자납입
    # PRD §1 1차 핵심지표: 저축률 = (예적금 + 투자납입) ÷ 합산수입
    cash_surplus = income - expense
    savings = cash_surplus + invest_invested  # 예적금(가계잉여) + 투자납입
    savings_rate = (savings / income) if income > 0 else 0.0

    return {
        "연월": ym,
        "합산수입": income,
        "총지출": expense,
        "고정비": fixed,
        "변동비": variable,
        "용돈": allowance,
        "현금잉여": cash_surplus,
        "투자납입": invest_invested,
        "저축액": savings,
        "저축률": savings_rate,
    }


def category_breakdown(ledger: pd.DataFrame, ym: str, owner: str | None = None) -> pd.DataFrame:
    m = month_slice(ledger, ym)
    exp = m[m["구분"] == C.GUBUN_EXPENSE]
    if owner and owner != "전체":
        exp = exp[exp["지출구분"] == owner]
    if exp.empty:
        return pd.DataFrame(columns=["분류", "금액", "비용성격"])
    g = (
        exp.groupby(["분류", "비용성격"], as_index=False)["금액"]
        .sum()
        .sort_values("금액", ascending=False)
    )
    return g


def owner_breakdown(ledger: pd.DataFrame, ym: str) -> pd.DataFrame:
    """지출구분(공통/지영/승화)별 — 자금 흐름 분석용(PRD §7)."""
    m = month_slice(ledger, ym)
    exp = m[m["구분"] == C.GUBUN_EXPENSE]
    g = exp.groupby("지출구분", as_index=False)["금액"].sum()
    return g.sort_values("금액", ascending=False)


def allowance_status(ledger: pd.DataFrame, ym: str) -> pd.DataFrame:
    """용돈 정액 대비 전출 현황."""
    m = month_slice(ledger, ym)
    allow = m[(m["구분"] == C.GUBUN_EXPENSE) & (m["분류"] == C.ALLOWANCE_CATEGORY)]
    rows = []
    for person in C.MEMBERS:
        sent = float(allow[allow["지출구분"] == person]["금액"].sum())
        rows.append({
            "사람": person,
            "정액": C.ALLOWANCE_PER_PERSON,
            "전출": sent,
            "차이": sent - C.ALLOWANCE_PER_PERSON,
        })
    return pd.DataFrame(rows)


def monthly_trend(ledger: pd.DataFrame, invest_by_month: dict[str, float] | None = None) -> pd.DataFrame:
    """월별 수입/지출/저축률 추이."""
    invest_by_month = invest_by_month or {}
    rows = []
    for ym in sorted(ledger["연월"].unique()):
        s = monthly_summary(ledger, ym, invest_by_month.get(ym, 0.0))
        rows.append({
            "연월": ym, "수입": s["합산수입"], "지출": s["총지출"],
            "저축액": s["저축액"], "저축률": s["저축률"],
        })
    return pd.DataFrame(rows)


# ──────────────────────────────────────────────────────────────
# 투자 — 거래내역 → 순투입원금 (PRD §8 1차 산출, 시세 불필요)
# ──────────────────────────────────────────────────────────────
def prep_invest(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    for col in ["quantity", "price", "fx_rate", "fee_krw"]:
        if col in df:
            df[col] = to_number(df[col])
    df["fx_rate"] = df["fx_rate"].replace(0, 1).fillna(1)
    df = df.dropna(subset=["date"])
    # 거래별 원화 순투입액 (buy +, sell −) + 수수료
    sign = df["action"].str.lower().map({C.ACTION_BUY: 1, C.ACTION_SELL: -1}).fillna(0)
    df["투입원화"] = sign * df["quantity"] * df["price"] * df["fx_rate"] + df["fee_krw"]
    df["연월"] = df["date"].dt.to_period("M").astype(str)
    return df.sort_values("date")


def invested_principal(invest: pd.DataFrame) -> float:
    """전체 순투입원금 합계."""
    return float(invest["투입원화"].sum())


def invested_by_ticker(invest: pd.DataFrame) -> pd.DataFrame:
    g = invest.groupby(["ticker", "account"], as_index=False)["투입원화"].sum()
    g = g.rename(columns={"투입원화": "순투입원금"})
    return g[g["순투입원금"] != 0].sort_values("순투입원금", ascending=False)


def invested_by_account(invest: pd.DataFrame) -> pd.DataFrame:
    g = invest.groupby("account", as_index=False)["투입원화"].sum()
    return g.rename(columns={"투입원화": "순투입원금"}).sort_values("순투입원금", ascending=False)


def invest_month_map(invest: pd.DataFrame) -> dict[str, float]:
    """월별 순투입액 (당월 투자납입 = 저축률 분자에 합산)."""
    g = invest.groupby("연월")["투입원화"].sum()
    # 매도(음수)는 납입으로 보지 않음 → 0 하한
    return {k: max(float(v), 0.0) for k, v in g.items()}


# ──────────────────────────────────────────────────────────────
# 순자산 (PRD §9: 가계 잔액 + 투자 순투입원금)
# ──────────────────────────────────────────────────────────────
def household_balance(ledger: pd.DataFrame, upto_ym: str | None = None) -> float:
    df = ledger
    if upto_ym:
        df = df[df["연월"] <= upto_ym]
    inc = df[df["구분"] == C.GUBUN_INCOME]["금액"].sum()
    exp = df[df["구분"] == C.GUBUN_EXPENSE]["금액"].sum()
    return float(inc - exp)


def net_worth(ledger: pd.DataFrame, invest: pd.DataFrame, upto_ym: str | None = None) -> dict:
    cash = household_balance(ledger, upto_ym)
    if upto_ym:
        invest = invest[invest["연월"] <= upto_ym]
    principal = invested_principal(invest)
    return {"가계잔액": cash, "투자순투입원금": principal, "순자산": cash + principal}


# ──────────────────────────────────────────────────────────────
# 자산현황 — 추이(월/연) + 자산 구성
# ──────────────────────────────────────────────────────────────
def net_worth_trend(ledger: pd.DataFrame, invest: pd.DataFrame) -> pd.DataFrame:
    """월별 누적 순자산 추이 = 누적 가계현금 + 누적 투자순투입원금."""
    months = sorted(set(ledger["연월"]) | set(invest["연월"]))
    rows = []
    for ym in months:
        cash = household_balance(ledger, ym)
        inv = float(invest[invest["연월"] <= ym]["투입원화"].sum())
        rows.append({"연월": ym, "가계현금": cash, "투자": inv, "순자산": cash + inv})
    return pd.DataFrame(rows)


def flow_table(ledger: pd.DataFrame, invest_mmap: dict[str, float],
               by: str = "month") -> pd.DataFrame:
    """기간별(월/연) 수입·고정비·변동비·용돈·지출·저축·저축률 집계."""
    df = ledger.copy()
    df["연도"] = df["날짜"].dt.year.astype(str)
    key = "연월" if by == "month" else "연도"
    invest_mmap = invest_mmap or {}
    rows = []
    for k in sorted(df[key].unique()):
        sub = df[df[key] == k]
        inc = float(sub[sub["구분"] == C.GUBUN_INCOME]["금액"].sum())
        exp = sub[sub["구분"] == C.GUBUN_EXPENSE]
        fixed = float(exp[exp["비용성격"] == "고정비"]["금액"].sum())
        var = float(exp[exp["비용성격"] == "변동비"]["금액"].sum())
        allow = float(exp[exp["비용성격"] == "용돈"]["금액"].sum())
        total_exp = float(exp["금액"].sum())
        # 해당 기간의 투자납입 합 (월키 m이 이 기간에 속하면 합산)
        invest_paid = sum(
            v for m, v in invest_mmap.items()
            if (m if by == "month" else m[:4]) == k
        )
        savings = inc - total_exp + invest_paid
        rate = savings / inc if inc > 0 else 0.0
        rows.append({
            "기간": k, "수입": inc, "고정비": fixed, "변동비": var, "용돈": allow,
            "총지출": total_exp, "투자납입": invest_paid,
            "저축액": savings, "저축률": rate,
        })
    return pd.DataFrame(rows)


def asset_composition(ledger: pd.DataFrame, invest: pd.DataFrame,
                      upto_ym: str | None = None) -> pd.DataFrame:
    """현재 순자산을 자산 카테고리별로 분해 (가계현금 + 투자 계좌별)."""
    cash = household_balance(ledger, upto_ym)
    inv = invest
    if upto_ym:
        inv = inv[inv["연월"] <= upto_ym]
    rows = [{"자산": "💵 가계 현금잔액", "금액": cash}]
    by_acct = inv.groupby("account")["투입원화"].sum()
    for acct, amt in by_acct.items():
        rows.append({"자산": f"📈 투자·{acct}", "금액": float(amt)})
    df = pd.DataFrame(rows)
    return df[df["금액"] != 0].sort_values("금액", ascending=False)


def asset_by_strategy(invest: pd.DataFrame, upto_ym: str | None = None) -> pd.DataFrame:
    """투자 자산을 전략(core/dividend/growth 등)별로 집계."""
    inv = invest
    if upto_ym:
        inv = inv[inv["연월"] <= upto_ym]
    g = inv.groupby("strategy", as_index=False)["투입원화"].sum()
    g = g.rename(columns={"투입원화": "순투입원금"})
    return g[g["순투입원금"] != 0].sort_values("순투입원금", ascending=False)


# ──────────────────────────────────────────────────────────────
# 자산설계사 인사이트 (20년차 관점) — PRD §13 점검 항목 지원
# ──────────────────────────────────────────────────────────────
def savings_grade(rate: float) -> tuple[str, str]:
    for threshold, label, msg in C.SAVINGS_RATE_GRADES:
        if rate >= threshold:
            return label, msg
    return C.SAVINGS_RATE_GRADES[-1][1], C.SAVINGS_RATE_GRADES[-1][2]


def planner_insights(summary: dict, net: dict, avg_expense: float) -> list[dict]:
    """카드로 보여줄 진단 메시지 목록."""
    out = []
    rate = summary["저축률"]
    label, msg = savings_grade(rate)

    # 1) 저축률 등급 + 목표 역산
    gap = C.SAVINGS_RATE_TARGET - rate
    target_line = (
        f"목표 {C.SAVINGS_RATE_TARGET:.0%}까지 {gap:.0%}p 남았어요. "
        f"월 {summary['합산수입']*gap:,.0f}원만 더 모으면 달성."
        if gap > 0 else "목표 저축률을 이미 넘었습니다. 잉여는 투자 비중 확대를 검토하세요."
    )
    out.append({"icon": "🎯", "title": f"저축률 {rate:.0%} · {label}",
                "body": f"{msg}\n\n{target_line}"})

    # 2) 비상예비자금 진단 (월 총지출 × 3~6개월 대비 가계잔액)
    lo, hi = C.EMERGENCY_FUND_MONTHS
    base = avg_expense if avg_expense > 0 else summary["총지출"]
    need_lo, need_hi = base * lo, base * hi
    cash = net["가계잔액"]
    if cash >= need_hi:
        ef = f"가계 현금 {cash:,.0f}원으로 {hi}개월치 비상금을 이미 확보했습니다. 초과분은 투자로 돌릴 여지가 있어요."
        ef_icon = "🟢"
    elif cash >= need_lo:
        ef = f"비상금 {lo}개월치({need_lo:,.0f}원)는 넘겼고, 권장 {hi}개월치({need_hi:,.0f}원)까지 {need_hi-cash:,.0f}원 남았습니다."
        ef_icon = "🟡"
    else:
        ef = f"비상예비자금이 권장({lo}개월 {need_lo:,.0f}원)에 못 미칩니다. 투자 확대보다 현금 버퍼 우선 적립을 권합니다."
        ef_icon = "🔴"
    out.append({"icon": ef_icon, "title": "비상예비자금",
                "body": f"기준: 월 지출 {base:,.0f}원 × {lo}~{hi}개월\n\n{ef}"})

    # 3) 고정비 구조 진단 (수입 대비 고정비 비중)
    if summary["합산수입"] > 0:
        fixed_ratio = summary["고정비"] / summary["합산수입"]
        if fixed_ratio > 0.45:
            fx = f"고정비가 수입의 {fixed_ratio:.0%}입니다. 30~40%가 건강선 — 구독·통신부터 점검하세요."
            fx_icon = "🟠"
        else:
            fx = f"고정비 비중 {fixed_ratio:.0%}로 건강한 구조입니다. 변동비 관리에 집중하세요."
            fx_icon = "🟢"
        out.append({"icon": fx_icon, "title": "고정비 비중", "body": fx})

    # 4) 자산형성 속도 (현 저축액 페이스의 연 환산)
    annual = summary["저축액"] * 12
    out.append({"icon": "🚀", "title": "연 환산 자산형성",
                "body": f"현재 페이스 유지 시 연 {annual:,.0f}원 적립.\n"
                        f"순자산 {net['순자산']:,.0f}원 → 1년 후 약 {net['순자산']+annual:,.0f}원."})
    return out
