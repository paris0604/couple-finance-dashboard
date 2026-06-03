"""
가계부 시트를 '직접 입력해도 안전한' 상태로 세팅한다.
실행:  python scripts/setup_ledger_sheet.py

- 헤더 굵게 + 첫 행 고정
- 구분 / 분류 / 지출구분 / 결제수단 칸에 드롭다운(데이터 검증)
- 금액 천단위 콤마, 날짜 형식 지정
한 번만 돌리면 되고, 여러 번 돌려도 안전(덮어쓰기)합니다.
"""
from __future__ import annotations

import os
import sys
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from core import config as C  # noqa: E402


def main():
    # secrets.toml 에서 URL만 가볍게 추출 (TOML 라이브러리 의존 없음)
    import re
    with open(os.path.join(ROOT, ".streamlit", "secrets.toml"), encoding="utf-8") as f:
        txt = f.read()

    def grab(key):
        m = re.search(rf'^\s*{key}\s*=\s*"([^"]+)"', txt, re.MULTILINE)
        return m.group(1) if m else None

    url = grab("ledger_spreadsheet_url") or grab("spreadsheet_url")
    sec = {}  # 키 파일 방식이면 비워둠
    if not url:
        sys.exit("ledger_spreadsheet_url 이 secrets.toml 에 없습니다.")

    import gspread
    from google.oauth2.service_account import Credentials
    scopes = ["https://www.googleapis.com/auth/spreadsheets",
              "https://www.googleapis.com/auth/drive"]
    key_file = os.path.join(ROOT, ".streamlit", "service_account.json")
    if os.path.exists(key_file):
        creds = Credentials.from_service_account_file(key_file, scopes=scopes)
    else:
        creds = Credentials.from_service_account_info(dict(sec["gcp_service_account"]), scopes=scopes)
    gc = gspread.authorize(creds)

    tab = grab("ledger_tab_name") or C.LEDGER_SHEET  # secrets에서 탭 이름 덮어쓰기 허용
    sh = gc.open_by_url(url)
    try:
        ws = sh.worksheet(tab)
    except Exception:
        ws = sh.add_worksheet(title=tab, rows=1000, cols=len(C.LEDGER_COLS))

    # 컬럼 구성이 바뀌었을 수 있으니 값/검증을 비우고 헤더를 새로 쓴다(데이터 없을 때 안전).
    ws.clear()
    ws.update(values=[C.LEDGER_COLS], range_name="A1")
    sid = ws.id
    col = {name: i for i, name in enumerate(C.LEDGER_COLS)}  # 0-based

    def dropdown_request(col_name: str, values: list[str]):
        c = col[col_name]
        return {
            "setDataValidation": {
                "range": {"sheetId": sid, "startRowIndex": 1,
                          "startColumnIndex": c, "endColumnIndex": c + 1},
                "rule": {
                    "condition": {"type": "ONE_OF_LIST",
                                  "values": [{"userEnteredValue": v} for v in values]},
                    "showCustomUi": True, "strict": False,
                },
            }
        }

    def number_format_request(col_name: str, pattern: str, ftype: str):
        c = col[col_name]
        return {
            "repeatCell": {
                "range": {"sheetId": sid, "startRowIndex": 1,
                          "startColumnIndex": c, "endColumnIndex": c + 1},
                "cell": {"userEnteredFormat": {"numberFormat": {"type": ftype, "pattern": pattern}}},
                "fields": "userEnteredFormat.numberFormat",
            }
        }

    requests = [
        # 이전 레이아웃의 잔여 데이터 검증 제거 (넓은 범위 초기화)
        {"setDataValidation": {
            "range": {"sheetId": sid, "startRowIndex": 1,
                      "startColumnIndex": 0, "endColumnIndex": 26}}},
        # 첫 행 고정 + 굵게
        {"updateSheetProperties": {
            "properties": {"sheetId": sid, "gridProperties": {"frozenRowCount": 1}},
            "fields": "gridProperties.frozenRowCount"}},
        {"repeatCell": {
            "range": {"sheetId": sid, "startRowIndex": 0, "endRowIndex": 1},
            "cell": {"userEnteredFormat": {
                "textFormat": {"bold": True},
                "backgroundColor": {"red": 0.95, "green": 0.97, "blue": 1.0}}},
            "fields": "userEnteredFormat(textFormat,backgroundColor)"}},
        # 드롭다운
        dropdown_request("구분", [C.GUBUN_INCOME, C.GUBUN_EXPENSE]),
        dropdown_request("분류", C.ALL_CATEGORIES),
        dropdown_request("지출구분", C.SPEND_OWNER),
        dropdown_request("결제수단", C.PAYMENT_METHODS),
        # 숫자/날짜 형식
        number_format_request("금액", "#,##0", "NUMBER"),
        number_format_request("날짜", "yyyy-mm-dd", "DATE"),
    ]
    sh.batch_update({"requests": requests})

    print("✅ 가계부 시트 세팅 완료")
    print("   • 첫 행 고정 + 헤더 강조 (결제자 컬럼 제거됨)")
    print(f"   • 드롭다운: 구분(2) · 분류({len(C.ALL_CATEGORIES)}) · 지출구분(3) · 결제수단({len(C.PAYMENT_METHODS)})")
    print("   • 금액 #,##0 · 날짜 yyyy-mm-dd")
    print("\n이제 구글 시트에서 직접 입력해도 드롭다운으로 안전하게 기록됩니다.")


if __name__ == "__main__":
    main()
