"""
Google Sheets 연결 자가진단.
실행:  python scripts/check_connection.py

secrets.toml 을 읽어 ① 키 형식 ② 라이브러리 ③ 실제 시트 접근 ④ 헤더 스키마
순서로 점검하고, 막힌 지점과 다음 행동을 한국어로 알려줍니다.
앱을 켜기 전에 이걸로 먼저 확인하면 설정 실수를 빨리 잡을 수 있습니다.
"""
from __future__ import annotations

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

OK, NO, WARN = "✅", "❌", "⚠️ "


def fail(msg, hint=""):
    print(f"{NO} {msg}")
    if hint:
        print(f"   → {hint}")
    sys.exit(1)


def load_secrets() -> dict:
    path = os.path.join(ROOT, ".streamlit", "secrets.toml")
    if not os.path.exists(path):
        fail(".streamlit/secrets.toml 이 없습니다.",
             "secrets.toml.example 을 secrets.toml 로 복사한 뒤 값을 채우세요.")
    try:
        import tomllib  # py3.11+
        with open(path, "rb") as f:
            return tomllib.load(f)
    except ModuleNotFoundError:
        try:
            import toml  # fallback
            with open(path, encoding="utf-8") as f:
                return toml.load(f)
        except ModuleNotFoundError:
            fail("TOML 파서를 못 찾았습니다.", "pip install toml  (Python 3.11 미만일 때)")


def main():
    print("── Google Sheets 연결 자가진단 ──\n")

    # 1) 라이브러리
    try:
        import gspread  # noqa: F401
        from google.oauth2.service_account import Credentials
        print(f"{OK} 라이브러리(gspread, google-auth) 설치됨")
    except ModuleNotFoundError:
        fail("gspread / google-auth 미설치", "pip install -r requirements.txt")

    # 2) 서비스 계정 키 — JSON 파일 우선, 없으면 secrets 인라인
    import json
    sec = load_secrets()
    key_file = os.path.join(ROOT, ".streamlit", "service_account.json")
    custom = sec.get("service_account_file")
    if custom and os.path.exists(custom):
        key_file = custom

    scopes = ["https://www.googleapis.com/auth/spreadsheets",
              "https://www.googleapis.com/auth/drive"]

    if os.path.exists(key_file):
        try:
            with open(key_file, encoding="utf-8") as f:
                sa = json.load(f)
        except Exception as exc:  # noqa: BLE001
            fail(f"service_account.json 을 읽지 못했습니다: {exc}",
                 "다운로드한 JSON 파일이 손상되지 않았는지 확인하세요.")
        client_email = sa.get("client_email", "(알 수 없음)")
        print(f"{OK} 서비스 계정 키 파일 인식: {os.path.relpath(key_file, ROOT)}")
        creds = Credentials.from_service_account_file(key_file, scopes=scopes)
    elif "gcp_service_account" in sec:
        sa = sec["gcp_service_account"]
        if "BEGIN PRIVATE KEY" not in str(sa.get("private_key", "")):
            fail("private_key 형식이 이상합니다.",
                 r"JSON의 private_key 값을 통째로(헤더 포함, 줄바꿈은 \n) 붙여넣으세요.")
        client_email = sa.get("client_email", "(알 수 없음)")
        print(f"{OK} 서비스 계정 키(secrets 인라인) 인식")
        creds = Credentials.from_service_account_info(dict(sa), scopes=scopes)
    else:
        fail("서비스 계정 키를 찾을 수 없습니다.",
             "다운로드한 JSON 파일을  .streamlit/service_account.json  으로 저장하세요.")

    print(f"   계정 이메일: {client_email}")

    led_url = sec.get("ledger_spreadsheet_url") or sec.get("spreadsheet_url")
    inv_url = sec.get("invest_spreadsheet_url") or sec.get("spreadsheet_url")
    if not led_url and not inv_url:
        fail("시트 URL이 하나도 없습니다.",
             "secrets.toml 에 ledger_spreadsheet_url / invest_spreadsheet_url 을 채우세요.")

    # 3) 실제 접근
    from core import config as C
    gc = gspread.authorize(creds)
    print(f"{OK} 서비스 계정 인증 성공\n")

    # 탭 이름은 secrets에서 덮어쓸 수 있음 (코드 수정 없이 변경)
    led_tab = sec.get("ledger_tab_name") or C.LEDGER_SHEET
    inv_tab = sec.get("invest_tab_name") or C.INVEST_SHEET
    checks = [
        ("가계부", led_url, led_tab, C.LEDGER_COLS, True),
        ("포트폴리오", inv_url, inv_tab, C.INVEST_COLS, False),
    ]
    for nick, url, ws_name, expected_cols, writable in checks:
        if not url:
            print(f"{WARN}{nick}: URL 미설정 → 샘플 데이터로 동작합니다.\n")
            continue
        print(f"── {nick} ({'읽기·쓰기' if writable else '읽기 전용'}) ──")
        try:
            sh = gc.open_by_url(url)
        except Exception as exc:  # noqa: BLE001
            fail(f"{nick} 스프레드시트를 열 수 없습니다: {type(exc).__name__}",
                 f"이 시트를 서비스 계정({client_email})에 "
                 f"{'편집자' if writable else '뷰어'} 로 공유했는지 확인하세요. "
                 "Sheets/Drive API도 사용 설정되어야 합니다.")
        print(f"{OK} 스프레드시트 열기 성공: '{sh.title}'")
        try:
            ws = sh.worksheet(ws_name)
        except Exception:
            if writable:
                print(f"{WARN}'{ws_name}' 탭이 아직 없습니다 → 앱 첫 실행 시 자동 생성됩니다.")
                print()
                continue
            fail(f"'{ws_name}' 탭을 찾을 수 없습니다.",
                 f"투자 시트의 탭 이름이 '{ws_name}' 인지 확인하세요(config.py에서 변경 가능).")
        header = ws.row_values(1)
        missing = [c for c in expected_cols if c not in header]
        if missing:
            print(f"{WARN}헤더에 없는 컬럼: {missing}")
            print(f"   현재 헤더: {header}")
            print("   → 헤더 이름이 맞는지 확인하세요(이름 기준 접근).")
        else:
            print(f"{OK} 헤더 스키마 정상 ({len(header)}개 컬럼)")
        print(f"   데이터 행 수: {len(ws.get_all_values()) - 1}")
        print()

    print("🎉 진단 완료. 문제 없으면 'streamlit run app.py' 로 실행하세요.")


if __name__ == "__main__":
    main()
