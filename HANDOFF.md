# 🏡 신혼부부 가계부 대시보드 — 인수인계 / 프로젝트 요약

> 새 대화/세션에서 이 프로젝트를 이어가기 위한 컨텍스트 문서. 무엇이 만들어졌고, 어떻게 배포·수정하는지 정리.

## 0. 한 줄 요약
신혼부부(지영·승화) 공동 가계의 **수입·지출·저축·순자산·투자·대출·목표**를 한 화면에서 보는 대시보드. 데이터는 Google Sheets, 백엔드는 Apps Script, 프론트는 GitHub Pages(React).

---

## 1. 라이브 주소 & 저장소
- **웹앱(메인, 디자인 100%)**: https://paris0604.github.io/couple-finance-dashboard/
- **GitHub repo**(public): https://github.com/paris0604/couple-finance-dashboard
- **Apps Script 백엔드(exec)**: `https://script.google.com/macros/s/AKfycbwHByuPbza_PRDiNF5QJGbdHghPZlhGT92Afe-qwFhdkLjGf7x7Br7srr6UgaT5dxK7/exec`
- **Streamlit 앱**(부차적, 비공개): 별도 streamlit.app — 같은 시트 사용. 로컬 `app.py`.
- 로컬 경로: `/Users/yunjiyoung/Desktop/지영/couple-finance-dashboard`

## 2. 구글 시트 (데이터, SSOT)
- **가계부 스프레드시트** id `1W5Enm5Al3UuW9uxhDuuRWCH3qsYwQt4LaDuygIxtAAg`
  - 탭 `가계부`: 거래ID·날짜·구분(수입/지출)·분류·금액·지출구분(공통/지영/승화)·결제수단(체크/신용카드/계좌이체)·메모
  - 탭 `대출`: 대출명·대출기관·대출금액·현재잔액·연이자율(%)·대출기간(개월)·시작일·납부일·상환방식(원리금균등/원금균등/만기일시)·메모  (없으면 자동 생성)
  - 탭 `목표`: 목표명·목표금액·기준(순자산/현금잔액/투자자산)·메모  (자동 생성)
- **포트폴리오 스프레드시트** id `1LbdkfGt6HTupOh6r95TgzYEhRRDjmtM3Ljp2urSIKlc`
  - 탭 `transactions`(읽기 전용): txn_id·date·action(buy/sell)·ticker·quantity·price·currency·fx_rate·fee_krw·account·strategy·note·schema_version

## 3. 아키텍처
```
docs/  (GitHub Pages, React+Babel-standalone, 빌드 없음)
  index.html         엔트리. 모든 에셋에 ?v=N 캐시버스팅(파일 바꾸면 N 올림)
  config.js          window.API_URL = Apps Script exec URL
  app.jsx            셸(상단 탭) + 데이터 fetch + EditModal + TICKER_INFO + 상수
  parser.js          빠른입력 규칙기반 자연어 파서(window.parseQuick)
  wf-views.jsx       7개 뷰: Summary/Ledger/Monthly/Invest/Loan/Calendar/Goal (+LoanForm/GoalForm)
  wf-components.jsx  공유 컴포넌트(KPI/Donut/Bars/BalanceHero/TxnTable/HoldingsTable/QuickInput…)
  wf-icons.jsx       모노라인 아이콘 + 분류→아이콘 매핑(catOf)
  wf-style.css       디자인시스템 토큰(:root) + 컴포넌트
  app-extra.css      ★ Pastel garden 테마 오버라이드 + 모달/캘린더/대출/목표 CSS + 반응형
apps_script/Code.gs  ★ 백엔드. buildWF(month)이 시트 읽어 WF JSON 반환. doGet/doPost(추가·수정·삭제·loan/goal). buildLoans(상환스케줄). 카카오 D-1 알림 함수.
```
- 프론트는 전부 **CSS 변수 기반** → app-extra.css `:root` 오버라이드 하나로 전체 색 변경.

## 4. 7개 탭 기능
1. **공통 요약**: KPI(합산수입·총지출·투자자산·저축여력률, 전월대비 ▲▼) · 잔여현금(통장기준=수입−현금/체크/이체지출, 신용카드 누계 별도) · 합산순자산(현금+투자, 전월대비) · 지출구성(공통/지영/승화 도넛↔막대) · 고정/변동 · 6개월 추이 · 웨딩제외 토글
2. **가계부**: 빠른입력(자연어) · 고정/변동/용돈 KPI · 카테고리별 지출(2열, 필터칩) · 거래내역(행 클릭→수정/삭제 팝업, 금액 원단위)
3. **월별**: 월별 수입/지출 막대 + 월별현황 표 + 연간누계 표
4. **투자**: 순투입원금 KPI · 계좌별/전략별 · 보유종목(설명=TICKER_INFO) · **자산증가 예측**(월평균 납입 지속 가정, 4/6/8% 시나리오, 1~20년)
5. **대출**: 입력폼(현재잔액 입력시 정확 재계산) · 대출현황 카드(상환율 진행바 보라/테라코타 #B06B43, 시작~만기) · 향후 12개월 상환계획표
6. **캘린더**: 대출 납부일 + 고정비 결제일 월간 그리드(금융사/구독명 상세는 lender·메모에서)
7. **목표**: 목표 추가폼 + 진행바 + 예상 달성시점(월평균 순저축 기준)

## 5. 빠른입력 파서 규칙 (parser.js = nlp_input.py 동일 로직)
- 날짜(어제/오늘/M.D), 금액(3.2만/5천/억/원), 지출구분 `(지영)`·이름, 결제수단 미지정
- **띄어쓰기 무시** 매칭(compact), **긴 키워드 우선**, **용돈 최우선**(다른 키워드보다)
- 브랜드 사전(스타벅스→카페, 올리브영→의류·미용 등), 생활용품 사전(샴푸/바디워시/주방세제 등)
- 메모에서 금액·날짜·태그 자동 제거
- 두 파서 항상 **동시 수정**할 것(웹/Streamlit 동일)

## 6. 디자인 — Pastel garden 테마
로즈 `#C75F71` · 핑크 `#F0B8B8` · 세이지 `#A2AE9D` · 브라운 `#54463A`
- 수입/저축=딥세이지 #5F7A57, 지출/투자/primary=로즈, 대출=테라코타 #B06B43, 고정비=브라운
- app-extra.css `:root` 오버라이드 + body 배경 워시. 가독성 위해 텍스트는 진한 파생색.

## 7. 카카오 D-1 대출 알림 (항상 자동)
- Apps Script `sendLoanReminderKakao()` — **매일 오전 9~10시 시간 트리거**
- 내일이 '실제 출금일'인 대출에 카톡 "나에게 보내기"(무료 memo API). **주말·공휴일이면 다음 영업일로 순연**(한국 공휴일 Nager.Date API), 메모에 '직접' 있으면 순연 제외(월세 등)
- 토큰은 **Script Properties**에 보관(코드/깃엔 없음): `KAKAO_CLIENT_ID`/`KAKAO_CLIENT_SECRET`/`KAKAO_REFRESH_TOKEN`
- Client Secret이 **필수**라 토큰 교환에 반드시 포함해야 함(KOE010 원인)
- 테스트 함수 `testKakaoNow()`

## 8. 배포/수정 워크플로 ★중요
- **프론트(docs/*)만 바꿈** → `index.html`의 `?v=N` 올리고 → GitHub Desktop **Push** → 웹앱 **시크릿창/⌘⇧R**
- **Code.gs 바꿈** → Apps Script에 **다시 붙여넣고 저장** → 웹앱 동작 변경이면 **배포 관리 → 새 버전 배포**(같은 URL 유지). 알림 함수만 바꾼 경우 트리거는 Head라 저장만 해도 됨.
- Code.gs 복사: `cat ".../apps_script/Code.gs" | pbcopy` (TextEdit은 옛 내용 캐시됨 주의)

## 9. 자주 겪은 함정(디버깅 메모)
- **브라우저 캐시**: 변경 반영 안 보이면 시크릿창. `?v=N`은 index.html 새로 로드돼야 효과.
- **Apps Script "새 버전" 미배포**: 저장만 하면 /exec는 옛 버전 → 꼭 새 버전 배포.
- **시트 날짜 = Date 객체**: 문자열 정규식 파싱 실패 → `ymd()`로 정규화(예: monthsBetween 버그였음).
- **순자산 이중계산**: 순자산=누적(수입−지출), 현금=−투자. 투자금 두 번 세지 말 것.
- **잔여현금=통장 기준**: 신용카드 지출은 잔액에서 빼지 않고 '이번달 누계'로 별도.

## 10. 다음에 해볼 만한 것(미구현/아이디어)
- 정기지출 등록(구독·통신·보험 D-1 알림까지 — 지금 캘린더 고정비는 '기록 기반'이라 미래예측 불가)
- 투자 목표비중 vs 현재비중 리밸런싱 가이드(streamlitApp의 목표구성 참고)
- 예산 설정(카테고리 한도 초과 경고)
- 투자 평가손익(실시간 시세 연동)
- 승화님도 카톡 받기(각자 토큰 또는 유료 알림톡)

---
*최종 갱신: 2026-06. 프론트 캐시 버전은 index.html 참고. 토큰 등 비밀값은 이 파일에 없음(Script Properties).*
