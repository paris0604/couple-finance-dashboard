# 🎨 디자인 웹앱 배포 가이드 (React 프론트 + Apps Script)

받으신 디자인 시안을 **그대로** 실제 앱으로 띄우는 방법입니다.
- **프론트엔드**(`docs/`): 디자인 그대로의 React 화면 → GitHub Pages 호스팅
- **백엔드**(`apps_script/Code.gs`): 구글시트 읽기/쓰기 → 서비스계정 불필요(소유자 권한)

> 기존 Streamlit 앱은 그대로 둬도 됩니다(둘 다 같은 시트 사용). 이건 "디자인 100%" 버전이에요.

---

## 1단계. Apps Script 백엔드 만들기

1. **가계부 구글시트**를 연다 → 상단 메뉴 **확장 프로그램 → Apps Script**
2. 기본 `Code.gs` 내용을 모두 지우고, 이 저장소의 **`apps_script/Code.gs`** 전체를 복사해 붙여넣기
3. 💾 저장(⌘S)
4. 상단에서 함수 `doGet` 선택 후 **▶ 실행** 한 번 → 권한 요청 팝업:
   - "권한 검토" → 본인 계정 선택 → "고급" → "(안전하지 않음) 이동" → **허용**
   - (내 시트를 내가 읽겠다는 것이라 안전합니다)

## 2단계. 웹앱으로 배포

1. 우측 상단 **배포 → 새 배포**
2. 톱니바퀴(유형 선택) → **웹 앱**
3. 설정:
   - 설명: 아무거나 (예: v1)
   - **실행 계정: 나**
   - **액세스 권한: 모든 사용자**
4. **배포** → 권한 한 번 더 허용
5. 나오는 **웹 앱 URL**(`https://script.google.com/macros/s/..../exec`) **복사**

## 3단계. 프론트에 URL 연결

1. `docs/config.js` 파일을 열어 `PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` 자리에 복사한 URL을 붙여넣기:
   ```js
   window.API_URL = "https://script.google.com/macros/s/..../exec";
   ```
2. 저장 → GitHub Desktop에서 **Commit → Push origin**

## 4단계. GitHub Pages 켜기

1. https://github.com/paris0604/couple-finance-dashboard → **Settings → Pages**
2. **Build and deployment → Source: Deploy from a branch**
3. Branch: **main** / 폴더: **/docs** → **Save**
4. 1~2분 뒤 주소 생성:
   **https://paris0604.github.io/couple-finance-dashboard/**

→ 이 주소가 **디자인 그대로의 우리집 대시보드**입니다. 폰에서도 열려요.

---

## 동작 확인
- 화면이 뜨고 사이드바(공통요약/가계부/투자) + 월 네비가 보이면 성공
- 가계부 탭 → 빠른입력에 `오늘 마트 3.2만` → **기록** → 표·차트에 반영 + 구글시트에도 행 추가
- 숫자가 안 뜨고 "불러오지 못했어요"면 → `config.js`의 URL, Apps Script 배포(액세스=모든 사용자) 재확인

## 자주 막히는 곳
- **빈 화면/CORS 오류**: Apps Script 배포 시 "액세스: 모든 사용자"가 아니면 실패 → 재배포
- **수정 후 반영 안 됨**: Apps Script 코드를 고치면 **배포 → 배포 관리 → 편집(연필) → 버전: 새 버전 → 배포**
- **Pages 404**: Settings→Pages에서 /docs 폴더 지정했는지, 1~2분 기다렸는지 확인

---

## 구조 요약
```
docs/                  ← GitHub Pages 호스팅(프론트)
  index.html           엔트리
  config.js            ★ Apps Script URL
  app.jsx              셸 + 데이터 연결(사이드바 레이아웃)
  parser.js            빠른입력 자연어 파서
  wf-*.jsx / wf-style.css / app-extra.css   디자인 컴포넌트·스타일
apps_script/Code.gs    ← 구글시트에 붙여넣는 백엔드
```
