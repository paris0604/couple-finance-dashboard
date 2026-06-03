"""
우리집 자산 대시보드 — 신혼부부 합산 가계 (Couple Finance Dashboard)
PRD v0.2 구현 · Streamlit

뷰 3개: 🏠 공통요약 · 📒 가계부 · 📈 투자
핵심지표: 저축률 = (예적금 + 투자납입) ÷ 합산수입
"""
from __future__ import annotations

import datetime as dt
import altair as alt
import pandas as pd
import streamlit as st

from core import config as C
from core import data_loader as dl
from core import finance as F
from core import nlp_input as NLP

st.set_page_config(page_title="우리집 자산 대시보드", page_icon="🏡", layout="wide")

# ── 디자인 시스템 (Design Handoff 토큰 이식) ─────────────────────
st.markdown("""
<style>
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css');
:root{
  --paper:#F5F6F9; --card:#FFFFFF; --ink:#2E3138; --ink2:#717784; --line:#ECEEF1;
  --brand:#16B364; --income:#3E92CF; --expense:#FF8E78; --save:#3FC489;
  --person-c:#93A0AF; --person-j:#FBB13C; --person-s:#3FC489;
  --shadow:0 1px 2px rgba(22,28,45,.04), 0 5px 18px rgba(22,28,45,.05);
}
html, body, [class*="css"], .stApp, button, input, textarea, select {
  font-family:'Pretendard', system-ui, -apple-system, sans-serif !important;
}
.stApp{
  background:
    radial-gradient(120% 80% at 8% 0%, #FFEDE4 0%, transparent 55%),
    radial-gradient(120% 90% at 100% 6%, #E6F2FB 0%, transparent 52%),
    #F6F5F1;
  background-attachment: fixed; color:var(--ink);
}
.block-container {padding-top: 2.2rem; max-width: 1180px;}
.num, [data-testid="stMetricValue"], .hero h1, .bal-num {font-variant-numeric: tabular-nums;}

/* KPI 메트릭 → 흰 카드 */
div[data-testid="stMetric"]{
  background:var(--card); border:1px solid var(--line); border-radius:16px;
  padding:16px 18px; box-shadow:var(--shadow);
}
[data-testid="stMetricValue"]{font-weight:700; letter-spacing:-.02em; color:var(--ink);}
[data-testid="stMetricLabel"]{color:var(--ink2); font-weight:600;}

/* 저축률 히어로 */
.hero {background:linear-gradient(135deg,#E2F7EE,#E4F1FA);
       border-radius:18px; padding:24px 28px; border:1px solid #E2F7EE;
       box-shadow:var(--shadow);}
.hero .lab{color:var(--save); font-weight:700; font-size:.92rem;}
.hero h1 {font-size:3.4rem; margin:.1rem 0 0; color:#2B9C6D; letter-spacing:-.03em; line-height:1;}
.hero .sub{color:var(--ink2); font-size:.9rem; margin-top:6px;}

/* 밸런스 히어로 (최우선 지표: 수입−지출=남은 돈) */
.bal{position:relative; background:var(--card); border:1px solid var(--line);
     border-radius:16px; padding:20px 22px 20px 26px; box-shadow:var(--shadow); overflow:hidden;}
.bal::before{content:""; position:absolute; left:0; top:0; bottom:0; width:6px;}
.bal.pos::before{background:var(--save);} .bal.neg::before{background:var(--expense);}
.bal .cap{color:var(--ink2); font-weight:600; font-size:.9rem;}
.bal .big{font-size:2.6rem; font-weight:700; letter-spacing:-.03em; line-height:1.1;}
.bal.pos .big{color:#2B9C6D;} .bal.neg .big{color:#E06A52;}
.bal .eq{color:var(--ink2); font-size:.92rem; margin-top:4px;}

/* 인사이트 카드 */
.insight {background:var(--card); border:1px solid var(--line); border-radius:14px;
          padding:16px 18px; height:100%; box-shadow:var(--shadow);}
.insight .t {font-weight:700; font-size:1.0rem; margin-bottom:6px; color:var(--ink);}
.insight .b {color:var(--ink2); font-size:.88rem; white-space:pre-line; line-height:1.55;}

/* 지출구분 태그 pill (색 점 + 라벨, 이모지 X) */
.tag{display:inline-flex; align-items:center; gap:6px; padding:3px 10px;
     border-radius:999px; font-size:.82rem; font-weight:600; border:1px solid var(--line);}
.tag .dot{width:7px; height:7px; border-radius:999px;}

/* 탭: 선택 시 그린 언더라인 */
.stTabs [aria-selected="true"]{color:var(--brand) !important;}
.stTabs [data-baseweb="tab-highlight"]{background:var(--brand) !important;}
</style>
""", unsafe_allow_html=True)


def tag_html(share: str) -> str:
    c = C.person_color(share)
    return f'<span class="tag" style="color:{c};background:{c}14;border-color:{c}33">' \
           f'<span class="dot" style="background:{c}"></span>{share}</span>'


def won(x: float) -> str:
    return f"{x:,.0f}원"


def man(x: float) -> str:
    """만원 단위 축약."""
    return f"{x/10_000:,.0f}만"


# ── 데이터 로드 ────────────────────────────────────────────────
ledger_raw = dl.load_ledger()
invest_raw = dl.load_invest()
ledger = F.prep_ledger(ledger_raw)
invest = F.prep_invest(invest_raw)
invest_mmap = F.invest_month_map(invest)

months = F.months_available(ledger)
ledger_empty = not months
if ledger_empty:
    # 빈 시트(첫 실행)라도 멈추지 않고 이번 달 기준으로 화면을 띄워
    # 📒 가계부 탭의 빠른입력으로 첫 거래를 넣을 수 있게 한다.
    months = [dt.date.today().strftime("%Y-%m")]

# ── 사이드바: 월 선택 + 연결 상태 ──────────────────────────────
with st.sidebar:
    st.markdown("### 🏡 우리집 자산 대시보드")
    st.caption("띠동이와 쮸쮸의 자산 불리기 프로젝트! 🚀")
    sel_month = st.selectbox("📅 결산 월", months, index=0)
    prev_month = None
    if sel_month in months:
        i = months.index(sel_month)
        prev_month = months[i + 1] if i + 1 < len(months) else None

    src = dl.data_source()
    if src == "needs_install":
        st.error("⚙️ 설정은 됐지만 라이브러리가 없어요.\n\n"
                 "터미널에서 아래를 실행 후 새로고침:\n\n"
                 "`pip install -r requirements.txt`")
    elif src == "google_sheets":
        st.success("🟢 Google Sheets 연결됨\n\n가계부(쓰기) · 포트폴리오(읽기)")
    elif src == "partial":
        led = "🟢" if dl._sheet_connected(C.LEDGER_SHEET) else "🟡"
        inv = "🟢" if dl._sheet_connected(C.INVEST_SHEET) else "🟡"
        st.warning(f"🟠 부분 연결\n\n{led} 가계부 · {inv} 보유현황\n\n연결 안 된 쪽은 샘플로 표시됩니다.")
    else:
        st.info("🟡 샘플 데이터 모드\n\n`.streamlit/secrets.toml`에 서비스 계정·시트 URL을 넣으면 전환됩니다.")

    if dl.LAST_ERRORS:
        for name, err in dl.LAST_ERRORS.items():
            st.caption(f"⚠️ {name} 연결 실패 → 샘플 표시\n\n`{err}`")

    st.divider()
    exclude_wedding = st.toggle(
        "💍 웨딩 지출 제외하고 보기", value=True,
        help="결혼 준비비는 일시적 대형 지출이라 평상시 저축률을 왜곡합니다. "
             "제외하면 '진짜 생활 저축률'을 봅니다. (순자산에는 영향 없음)")
    st.caption("저축률 = (예적금 + 투자납입) ÷ 합산수입")


# 웨딩 제외 토글 — 흐름(저축률·지출·추이)에만 적용, 순자산(실제 잔액)은 전체 사용
flow_ledger = ledger[ledger["분류"] != "웨딩"] if exclude_wedding else ledger

summary = F.monthly_summary(flow_ledger, sel_month, invest_mmap.get(sel_month, 0.0))
prev_summary = (
    F.monthly_summary(flow_ledger, prev_month, invest_mmap.get(prev_month, 0.0))
    if prev_month else None
)
net = F.net_worth(ledger, invest, upto_ym=sel_month)   # 순자산은 항상 실제 전체
trend = F.monthly_trend(flow_ledger, invest_mmap)
avg_expense = float(trend["지출"].mean()) if not trend.empty else summary["총지출"]

tab_summary, tab_assets, tab_ledger, tab_invest = st.tabs(
    ["📊 공통 요약", "💎 자산현황", "📒 가계부", "📈 투자"]
)

if ledger_empty:
    st.info("👋 가계부가 비어 있어요. **📒 가계부 탭**의 빠른입력으로 첫 거래를 넣어보세요. "
            "수입·지출이 쌓이면 이 화면에 저축률과 순자산이 채워집니다.")


# ══════════════════════════════════════════════════════════════
# 뷰 1 — 공통 요약
# ══════════════════════════════════════════════════════════════
with tab_summary:
    label, _ = F.savings_grade(summary["저축률"])
    balance = summary["합산수입"] - summary["총지출"]
    bal_cls = "pos" if balance >= 0 else "neg"
    c1, c2 = st.columns([1, 1.05])
    with c1:
        # 밸런스 히어로 — 최우선 지표 (수입 − 지출 = 남은 돈)
        st.markdown(
            f"""<div class="bal {bal_cls}">
            <div class="cap">{sel_month} 이번 달 밸런스</div>
            <div class="big num">{'+' if balance>=0 else '−'}{abs(balance):,.0f}원</div>
            <div class="eq">수입 {man(summary['합산수입'])}원 − 지출 {man(summary['총지출'])}원
            = 남은 돈 {man(balance)}원</div>
            </div>""", unsafe_allow_html=True)
    with c2:
        st.markdown(
            f"""<div class="hero">
            <div class="lab">{sel_month} 저축률 · {label}</div>
            <h1>{summary['저축률']*100:.0f}%</h1>
            <div class="sub">저축액 {won(summary['저축액'])} · 합산수입 {won(summary['합산수입'])}
            · 목표 {C.SAVINGS_RATE_TARGET:.0%}</div>
            </div>""", unsafe_allow_html=True)

    st.markdown("")
    # 핵심 지표 4종 (전월 대비 델타)
    def delta(key):
        if not prev_summary:
            return None
        return summary[key] - prev_summary[key]

    if exclude_wedding and (ledger["분류"] == "웨딩").any():
        st.caption("💍 웨딩 지출을 제외한 '생활 기준' 숫자입니다. (사이드바에서 끄면 포함)")
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("💰 합산수입", man(summary["합산수입"]) + "원",
              delta=man(delta("합산수입")) + "원" if prev_summary else None)
    m2.metric("💳 총지출", man(summary["총지출"]) + "원",
              delta=man(delta("총지출")) + "원" if prev_summary else None,
              delta_color="inverse")
    m3.metric("💵 저축액", man(summary["저축액"]) + "원",
              delta=man(delta("저축액")) + "원" if prev_summary else None)
    m4.metric("💎 순자산", man(net["순자산"]) + "원",
              help=f"가계잔액 {won(net['가계잔액'])} + 투자 순투입원금 {won(net['투자순투입원금'])}")

    st.divider()

    # 현금흐름 폭포(워터폴) — PRD §2 모델
    cL, cR = st.columns([1.15, 1])
    with cL:
        st.markdown("#### 💧 이번 달 현금흐름")
        flow = pd.DataFrame([
            {"단계": "합산수입", "값": summary["합산수입"], "종류": "수입"},
            {"단계": "− 고정비", "값": -summary["고정비"], "종류": "지출"},
            {"단계": "− 변동비", "값": -summary["변동비"], "종류": "지출"},
            {"단계": "− 용돈", "값": -summary["용돈"], "종류": "지출"},
            {"단계": "+ 투자납입", "값": summary["투자납입"], "종류": "저축"},
            {"단계": "= 저축액", "값": summary["저축액"], "종류": "저축"},
        ])
        bar = alt.Chart(flow).mark_bar(cornerRadius=4).encode(
            x=alt.X("값:Q", title="원", axis=alt.Axis(format="~s")),
            y=alt.Y("단계:N", sort=None, title=None),
            color=alt.Color("종류:N",
                            scale=alt.Scale(domain=["수입", "지출", "저축"],
                                            range=[C.COLOR["income"], C.COLOR["expense"], C.COLOR["save"]]),
                            legend=None),
            tooltip=[alt.Tooltip("값:Q", format=",.0f")],
        ).properties(height=260)
        st.altair_chart(bar, use_container_width=True)

    with cR:
        st.markdown("#### 🧭 자금 흐름 (지출구분)")
        ob = F.owner_breakdown(ledger, sel_month)
        if not ob.empty:
            donut = alt.Chart(ob).mark_arc(innerRadius=55).encode(
                theta="금액:Q",
                color=alt.Color("지출구분:N",
                                scale=alt.Scale(domain=C.SPEND_OWNER,
                                                range=[C.person_color(o) for o in C.SPEND_OWNER])),
                tooltip=["지출구분", alt.Tooltip("금액:Q", format=",.0f")],
            ).properties(height=260)
            st.altair_chart(donut, use_container_width=True)
            st.caption("정산이 아니라 자금이 어디로 흐르는지 분석용 (PRD §7)")

    st.divider()

    # 자산설계사 인사이트
    st.markdown("#### 🧑‍💼 자산설계 인사이트")
    insights = F.planner_insights(summary, net, avg_expense)
    cols = st.columns(len(insights))
    for col, ins in zip(cols, insights):
        col.markdown(
            f"""<div class="insight"><div class="t">{ins['icon']} {ins['title']}</div>
            <div class="b">{ins['body']}</div></div>""",
            unsafe_allow_html=True,
        )

    st.markdown("")
    st.markdown("#### 📈 월별 추이")
    if len(trend) >= 1:
        base = alt.Chart(trend).encode(x=alt.X("연월:N", title=None))
        income_bar = base.mark_bar(color="#A9D2EC", size=24).encode(
            y=alt.Y("수입:Q", title="원", axis=alt.Axis(format="~s")))
        expense_bar = base.mark_bar(color="#FFB9A8", size=14).encode(y="지출:Q")
        rate_line = base.mark_line(point=True, color="#2B9C6D", strokeWidth=3).encode(
            y=alt.Y("저축률:Q", axis=alt.Axis(format="%", title="저축률")))
        st.altair_chart(
            alt.layer(income_bar, expense_bar).resolve_scale(y="shared")
            + rate_line.encode(y=alt.Y("저축률:Q", axis=alt.Axis(format="%"))),
            use_container_width=True,
        )
        st.altair_chart(rate_line.properties(height=160, title="저축률 추이"),
                        use_container_width=True)


# ══════════════════════════════════════════════════════════════
# 뷰 2 — 자산현황 (자산 구성 + 월/연 추이 + 수입·지출 집계)
# ══════════════════════════════════════════════════════════════
with tab_assets:
    # ── 1) 자산 구성 (현재 순자산을 카테고리별로) ──────────────
    st.markdown("#### 🧱 자산 카테고리별 구성")
    st.caption(f"{sel_month} 기준 누적 순자산을 자산 종류별로 분해")
    comp = F.asset_composition(ledger, invest, upto_ym=sel_month)
    strat = F.asset_by_strategy(invest, upto_ym=sel_month)

    ac1, ac2 = st.columns([1, 1])
    with ac1:
        if not comp.empty and comp["금액"].sum() != 0:
            pie = alt.Chart(comp).mark_arc(innerRadius=60).encode(
                theta="금액:Q",
                color=alt.Color("자산:N", title="자산", scale=alt.Scale(range=C.ACCOUNT_PALETTE)),
                tooltip=["자산", alt.Tooltip("금액:Q", format=",.0f")],
            ).properties(height=280)
            st.altair_chart(pie, use_container_width=True)
        else:
            st.info("아직 자산 데이터가 없어요. 가계부·투자가 쌓이면 채워집니다.")
    with ac2:
        comp_disp = comp.copy()
        total = comp_disp["금액"].sum()
        if total != 0:
            comp_disp["비중"] = (comp_disp["금액"] / total)
        st.dataframe(
            comp_disp, use_container_width=True, hide_index=True,
            column_config={
                "금액": st.column_config.NumberColumn("금액", format="%,d원"),
                "비중": st.column_config.ProgressColumn("비중", format="%.0f%%",
                                                       min_value=0, max_value=1),
            },
        )
        st.metric("🏦 순자산 합계", f"{total:,.0f}원")
        if not strat.empty:
            with st.expander("투자 전략별 보기 (core/dividend/growth 등)"):
                st.dataframe(strat, use_container_width=True, hide_index=True,
                             column_config={"순투입원금": st.column_config.NumberColumn(
                                 "순투입원금", format="%,d원")})

    st.divider()

    # ── 2) 순자산 추이 (월별 누적) ────────────────────────────
    st.markdown("#### 📈 순자산 추이 (월별 누적)")
    nwt = F.net_worth_trend(ledger, invest)
    if not nwt.empty:
        nwt_long = nwt.melt(id_vars="연월", value_vars=["가계현금", "투자"],
                            var_name="구성", value_name="금액")
        area = alt.Chart(nwt_long).mark_area().encode(
            x=alt.X("연월:N", title=None),
            y=alt.Y("금액:Q", title="원", axis=alt.Axis(format="~s"), stack=True),
            color=alt.Color("구성:N", scale=alt.Scale(
                domain=["가계현금", "투자"], range=[C.COLOR["nw_house"], C.COLOR["nw_invest"]])),
            tooltip=["연월", "구성", alt.Tooltip("금액:Q", format=",.0f")],
        ).properties(height=300)
        line = alt.Chart(nwt).mark_line(color="#2E3138", strokeWidth=2, point=True).encode(
            x="연월:N", y="순자산:Q",
            tooltip=["연월", alt.Tooltip("순자산:Q", format=",.0f")])
        st.altair_chart(area + line, use_container_width=True)
        st.caption("쌓인 면적 = 자산 구성(현금+투자), 진한 선 = 순자산 합계")
    else:
        st.info("추이를 그릴 데이터가 아직 없어요.")

    st.divider()

    # ── 3) 수입·지출(고정/변동) 집계 — 월별/연도별 토글 ────────
    st.markdown("#### 💰 수입 · 지출 집계")
    by_label = st.radio("집계 단위", ["월별", "연도별"], horizontal=True,
                        label_visibility="collapsed")
    ftab = F.flow_table(ledger, invest_mmap, by="month" if by_label == "월별" else "year")
    if not ftab.empty:
        # 막대: 수입 vs 고정/변동/용돈 누적
        stacked = ftab.melt(id_vars="기간", value_vars=["고정비", "변동비", "용돈"],
                            var_name="지출유형", value_name="금액")
        bar = alt.Chart(stacked).mark_bar().encode(
            x=alt.X("기간:N", title=None),
            y=alt.Y("금액:Q", title="지출(원)", axis=alt.Axis(format="~s")),
            color=alt.Color("지출유형:N", scale=alt.Scale(
                domain=["고정비", "변동비", "용돈"],
                range=[C.COLOR["fixed"], C.COLOR["variable"], C.COLOR["person_공통"]])),
            tooltip=["기간", "지출유형", alt.Tooltip("금액:Q", format=",.0f")],
        )
        inc_line = alt.Chart(ftab).mark_line(color="#3E92CF", strokeWidth=3, point=True).encode(
            x="기간:N", y="수입:Q",
            tooltip=["기간", alt.Tooltip("수입:Q", format=",.0f")])
        st.altair_chart(bar + inc_line, use_container_width=True)

        disp = ftab.copy()
        disp["저축률"] = disp["저축률"] * 100  # %% 포맷용
        st.dataframe(
            disp, use_container_width=True, hide_index=True,
            column_config={
                "기간": "기간",
                "수입": st.column_config.NumberColumn("수입", format="%,d원"),
                "고정비": st.column_config.NumberColumn("고정비", format="%,d원"),
                "변동비": st.column_config.NumberColumn("변동비", format="%,d원"),
                "용돈": st.column_config.NumberColumn("용돈", format="%,d원"),
                "총지출": st.column_config.NumberColumn("총지출", format="%,d원"),
                "투자납입": st.column_config.NumberColumn("투자납입", format="%,d원"),
                "저축액": st.column_config.NumberColumn("저축액", format="%,d원"),
                "저축률": st.column_config.NumberColumn("저축률", format="%.0f%%"),
            },
        )
        st.caption("초록 선 = 수입, 막대 = 고정비·변동비·용돈. 저축률은 표에서 확인")
    else:
        st.info("집계할 거래가 아직 없어요.")


# ══════════════════════════════════════════════════════════════
# 뷰 3 — 가계부
# ══════════════════════════════════════════════════════════════
with tab_ledger:
    st.markdown("### ⚡ 빠른입력")
    st.caption('예: "어제 마트 3.2만" · "점심 김밥 5천 외식" · "6/1 월세 80만 주거" · "지영 용돈 40만"')

    qc1, qc2 = st.columns([4, 1])
    text = qc1.text_input("자연어로 입력", key="quick_text",
                          label_visibility="collapsed", placeholder="어제 스타벅스 4800 카페")
    do_parse = qc2.button("🔎 변환", use_container_width=True)

    if text and (do_parse or text):
        e = NLP.parse(text, today=dt.date.today())
        with st.form("confirm_entry"):
            st.caption("규칙 기반으로 정규화했어요. 확인·수정 후 저장하세요.")
            f1, f2, f3 = st.columns(3)
            date_v = f1.date_input("날짜", value=e.날짜 or dt.date.today())
            gubun_v = f2.selectbox("구분", [C.GUBUN_EXPENSE, C.GUBUN_INCOME],
                                   index=0 if e.구분 == C.GUBUN_EXPENSE else 1)
            cats = C.EXPENSE_CATEGORIES if gubun_v == C.GUBUN_EXPENSE else C.INCOME_CATEGORIES
            cat_idx = cats.index(e.분류) if e.분류 in cats else 0
            cat_v = f3.selectbox("분류", cats, index=cat_idx)

            f4, f5, f6 = st.columns(3)
            amt_v = f4.number_input("금액(원)", min_value=0, step=1000,
                                    value=int(e.금액 or 0))
            owner_idx = C.SPEND_OWNER.index(e.지출구분) if e.지출구분 in C.SPEND_OWNER else 0
            owner_v = f5.selectbox("지출구분", C.SPEND_OWNER, index=owner_idx,
                                   help="공통=공동생활비 / 지영·승화=개인 귀속")
            pay_v = f6.selectbox("결제수단", [""] + C.PAYMENT_METHODS, index=0)

            memo_v = st.text_input("메모", value=e.메모)

            for w in e.warnings:
                st.warning(w)

            if st.form_submit_button("💾 저장", use_container_width=True):
                ok, msg = dl.append_ledger_row({
                    "날짜": date_v.strftime("%Y-%m-%d"), "구분": gubun_v, "분류": cat_v,
                    "금액": int(amt_v), "지출구분": owner_v,
                    "결제수단": pay_v, "메모": memo_v,
                })
                if ok:
                    st.success(msg)
                    st.cache_data.clear()
                    st.rerun()
                else:
                    st.error(msg)

    st.divider()

    # 고정비/변동비 + 카테고리
    s1, s2, s3 = st.columns(3)
    s1.metric("📌 고정비", won(summary["고정비"]))
    s2.metric("🔀 변동비", won(summary["변동비"]))
    s3.metric("💵 용돈 전출", won(summary["용돈"]))

    bL, bR = st.columns([1.2, 1])
    with bL:
        st.markdown("#### 🍱 카테고리별 지출")
        owner_filter = st.radio("자금 흐름 필터", ["전체"] + C.SPEND_OWNER,
                                horizontal=True, label_visibility="collapsed")
        cat = F.category_breakdown(ledger, sel_month, owner=owner_filter)
        cat = cat[cat["분류"] != C.ALLOWANCE_CATEGORY]
        if not cat.empty:
            cat["라벨"] = cat["분류"].map(lambda c: f"{C.CATEGORY_EMOJI.get(c,'•')} {c}")
            chart = alt.Chart(cat).mark_bar(cornerRadius=4).encode(
                x=alt.X("금액:Q", title="원", axis=alt.Axis(format="~s")),
                y=alt.Y("라벨:N", sort="-x", title=None),
                color=alt.Color("비용성격:N",
                                scale=alt.Scale(domain=["고정비", "변동비"],
                                                range=[C.COLOR["fixed"], C.COLOR["variable"]])),
                tooltip=["분류", alt.Tooltip("금액:Q", format=",.0f")],
            ).properties(height=max(260, 26 * len(cat)))
            st.altair_chart(chart, use_container_width=True)

    with bR:
        st.markdown("#### 💵 용돈 현황")
        al = F.allowance_status(ledger, sel_month)
        for _, r in al.iterrows():
            diff = r["차이"]
            tag = "정액대로" if diff == 0 else (f"+{won(diff)}" if diff > 0 else f"{won(diff)}")
            st.metric(f"{r['사람']}", won(r["전출"]),
                      delta=tag if diff != 0 else None)
        st.caption(f"정액 {won(C.ALLOWANCE_PER_PERSON)} · 사용처 미추적 (PRD §6)")

    st.markdown("#### 📜 거래 내역")
    m = F.month_slice(ledger, sel_month).copy()
    m = m[["날짜", "구분", "분류", "금액", "지출구분", "결제수단", "메모"]]
    m["날짜"] = m["날짜"].dt.strftime("%m/%d")
    m["분류"] = m["분류"].map(lambda c: f"{C.CATEGORY_EMOJI.get(c,'•')} {c}")
    st.dataframe(
        m.sort_values("날짜", ascending=False),
        use_container_width=True, hide_index=True,
        column_config={"금액": st.column_config.NumberColumn("금액", format="%,d원")},
    )


# ══════════════════════════════════════════════════════════════
# 뷰 3 — 투자
# ══════════════════════════════════════════════════════════════
with tab_invest:
    st.markdown("### 📈 투자 — 순투입원금 (거래내역 집계)")
    st.caption("기존 `포트폴리오 > transactions` 시트는 읽기 전용. 시세 의존 0 — 순투입원금만 1차 산출 (PRD §8)")

    principal = F.invested_principal(invest)
    by_ticker = F.invested_by_ticker(invest)
    by_account = F.invested_by_account(invest)

    iv1, iv2, iv3 = st.columns(3)
    iv1.metric("💼 총 순투입원금", won(principal))
    iv2.metric("📦 종목 수", f"{by_ticker['ticker'].nunique()}개")
    iv3.metric("🗓️ 이번 달 투자납입", won(invest_mmap.get(sel_month, 0.0)))

    st.divider()
    pL, pR = st.columns(2)
    with pL:
        st.markdown("#### 🏷️ 종목별 순투입원금")
        if not by_ticker.empty:
            chart = alt.Chart(by_ticker).mark_bar(cornerRadius=4, color="#3FC489").encode(
                x=alt.X("순투입원금:Q", title="원", axis=alt.Axis(format="~s")),
                y=alt.Y("ticker:N", sort="-x", title=None),
                tooltip=["ticker", "account",
                         alt.Tooltip("순투입원금:Q", format=",.0f")],
            ).properties(height=max(220, 30 * len(by_ticker)))
            st.altair_chart(chart, use_container_width=True)
    with pR:
        st.markdown("#### 🏦 계좌별 비중")
        if not by_account.empty:
            donut = alt.Chart(by_account).mark_arc(innerRadius=55).encode(
                theta="순투입원금:Q",
                color=alt.Color("account:N", title="계좌", scale=alt.Scale(range=C.ACCOUNT_PALETTE)),
                tooltip=["account", alt.Tooltip("순투입원금:Q", format=",.0f")],
            ).properties(height=260)
            st.altair_chart(donut, use_container_width=True)

    st.markdown("#### 📜 거래내역")
    iv = invest[["date", "action", "ticker", "quantity", "price", "currency",
                 "fx_rate", "fee_krw", "account", "strategy", "투입원화"]].copy()
    iv["date"] = iv["date"].dt.strftime("%Y-%m-%d")
    st.dataframe(
        iv.sort_values("date", ascending=False), use_container_width=True, hide_index=True,
        column_config={"투입원화": st.column_config.NumberColumn("투입원화", format="%,d원")},
    )

    st.info("ℹ️ **2차 예정**: 평가손익(현재시세×환율) — 데이터 모델은 동일하므로 언제든 얹을 수 있습니다 (PRD §8).")
