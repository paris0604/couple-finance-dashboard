# 🚀 웹 배포 가이드 — 어디서든 둘이 같이 보기

로컬(`localhost`)은 내 컴퓨터에서만 보입니다. 두 분이 폰·외부에서 접속하려면 **웹에 배포**해야 합니다.
무료이고 가장 쉬운 **Streamlit Community Cloud** 기준으로 안내합니다.

> 가계 데이터는 민감하므로 **비공개(Private) 앱 + 허용 이메일만 접속**으로 설정하는 걸 권장합니다.

---

## 한눈에 보는 흐름
```
코드를 GitHub(비공개)에 올림  →  Streamlit Cloud에서 그 repo 연결
   →  Secrets 붙여넣기  →  Private + 두 사람 이메일 허용  →  완료(고정 URL)
```

데이터(구글시트)는 그대로 두고, 앱만 클라우드에서 돌립니다. 입력하면 **여전히 같은 구글시트**에 쌓입니다.

---

## 1단계. GitHub에 코드 올리기 (비공개 repo)

1. https://github.com 가입/로그인 → 우상단 **+ → New repository**
2. 이름 예: `couple-finance-dashboard` → **Private** 선택 → Create
3. 터미널에서 (이 폴더에서):
   ```bash
   cd ~/Desktop/지영/couple-finance-dashboard
   git init
   git add .
   git commit -m "우리집 자산 대시보드"
   git branch -M main
   git remote add origin https://github.com/<내아이디>/couple-finance-dashboard.git
   git push -u origin main
   ```
   > `.gitignore`가 **service_account.json·secrets.toml·cloud_secrets.toml을 자동 제외**하므로 키는 GitHub에 올라가지 않습니다. (안전)

## 2단계. Streamlit Cloud에서 앱 만들기

1. https://share.streamlit.io 접속 → **GitHub 계정으로 로그인**
2. **Create app → Deploy a public app from GitHub** (repo가 private여도 본인 계정이면 선택 가능)
3. 항목 선택:
   - Repository: `<내아이디>/couple-finance-dashboard`
   - Branch: `main`
   - Main file path: `app.py`
4. **Deploy** 클릭 → 잠시 빌드 후 `https://....streamlit.app` 주소가 생깁니다.

## 3단계. Secrets(키) 넣기 ★중요

클라우드엔 JSON 파일을 못 올리므로, 미리 만들어 둔 인라인 형식을 붙여넣습니다.

1. 배포된 앱 화면 우측 하단 **⋮ → Settings → Secrets** (또는 앱 관리화면의 Secrets)
2. 로컬 파일 **`.streamlit/cloud_secrets.toml`** 을 열어 **전체 내용을 복사**
   ```bash
   open -a TextEdit ~/Desktop/지영/couple-finance-dashboard/.streamlit/cloud_secrets.toml
   ```
3. Secrets 입력칸에 **붙여넣기 → Save**
4. 앱이 자동 재시작되며 🟢 Google Sheets 연결됨 으로 바뀝니다.

## 4단계. 비공개 + 두 사람만 허용

1. 앱 **Settings → Sharing**
2. **"Only specific people can view this app"** 선택
3. 띠동이·쮸쮸 **두 사람의 Google 이메일** 추가 → Save

이제 그 두 계정으로 로그인해야만 접속됩니다. (외부인 차단)

---

## 자주 막히는 곳
- **빌드 실패 / 모듈 없음** → `requirements.txt`가 repo에 포함됐는지 확인 (이미 있음)
- **🟡 샘플 모드로 뜸** → 3단계 Secrets 붙여넣기를 안 했거나 저장 안 됨
- **403 권한 오류** → 두 구글시트를 서비스 계정 이메일에 공유했는지 (이미 완료한 부분)
- **키 변경/유출 우려** → Google Cloud에서 서비스계정 키 새로 발급 후 `cloud_secrets.toml` 재생성

---

## 대안 (참고)
- **잠깐만 외부에 보여주기**: 로컬 실행 + `ngrok http 8501` → 임시 공개 URL (앱 끄면 사라짐)
- **항상 켜두기 싫지 않다면**: 집 컴퓨터에서 계속 실행 + 같은 와이파이에서 `http://192.168.x.x:8501`
- 위 둘은 임시/제한적이라, 상시 접속은 **Streamlit Cloud**를 권장합니다.
