"""
데이터 입출력 — 단일 출처(SSOT)는 Google Sheets (PRD §10).
secrets.toml 에 서비스 계정이 있으면 시트를, 없으면 sample_data CSV를 읽는다.
→ 키 없이도 즉시 실행되고, 키를 채우면 자동으로 실데이터로 전환.

투자 시트는 '읽기 전용'(PRD §3). 쓰기는 가계부 시트에만 한다.
"""
from __future__ import annotations

import os
import datetime as dt
import pandas as pd
import streamlit as st

from . import config as C

_SAMPLE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "sample_data")
_STREAMLIT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".streamlit")
# 다운로드한 서비스 계정 JSON 키를 여기에 두면 자동 인식 (TOML로 옮겨 적을 필요 X)
_DEFAULT_KEY_FILE = os.path.join(_STREAMLIT_DIR, "service_account.json")


# ──────────────────────────────────────────────────────────────
# 연결 모드 판별
# ──────────────────────────────────────────────────────────────
# 스프레드시트 URL은 시트별로 분리 — 가계부(읽기·쓰기) / 보유현황(읽기 전용).
# 한쪽만 있으면 그 시트만 시트 모드, 나머지는 샘플로 동작(부분 연동 허용).
def _url_for(sheet_name: str) -> str | None:
    try:
        s = st.secrets
    except Exception:
        return None
    if sheet_name == C.LEDGER_SHEET:
        return s.get("ledger_spreadsheet_url") or s.get("spreadsheet_url")
    if sheet_name == C.INVEST_SHEET:
        return s.get("invest_spreadsheet_url") or s.get("spreadsheet_url")
    return None


def _tab_name(sheet_name: str) -> str:
    """실제 구글시트 탭 이름. secrets에서 덮어쓸 수 있어 코드 수정 없이 변경 가능.
    예) secrets.toml 에  ledger_tab_name = "우리집가계부"  하면 그 탭을 읽음."""
    try:
        s = st.secrets
    except Exception:
        s = {}
    if sheet_name == C.LEDGER_SHEET:
        return s.get("ledger_tab_name") or C.LEDGER_SHEET
    if sheet_name == C.INVEST_SHEET:
        return s.get("invest_tab_name") or C.INVEST_SHEET
    return sheet_name


def _key_file_path() -> str | None:
    """서비스 계정 JSON 키 파일 경로. secrets로 지정하거나 기본 위치에 두면 인식."""
    try:
        custom = st.secrets.get("service_account_file")
    except Exception:
        custom = None
    if custom and os.path.exists(custom):
        return custom
    if os.path.exists(_DEFAULT_KEY_FILE):
        return _DEFAULT_KEY_FILE
    return None


def _has_creds() -> bool:
    # 방법 1) JSON 키 파일이 있거나  방법 2) secrets에 인라인으로 적혀 있거나
    if _key_file_path():
        return True
    try:
        return "gcp_service_account" in st.secrets
    except Exception:
        return False


def _libs_ok() -> bool:
    """gspread / google-auth 설치 여부 (미설치 시 크래시 대신 안내)."""
    try:
        import gspread  # noqa: F401
        from google.oauth2.service_account import Credentials  # noqa: F401
        return True
    except ModuleNotFoundError:
        return False


def _sheet_connected(sheet_name: str) -> bool:
    return _libs_ok() and _has_creds() and bool(_url_for(sheet_name))


def data_source() -> str:
    """전체 연결 상태.
    sample=설정 없음 · needs_install=설정됐지만 라이브러리 미설치 ·
    partial=한쪽만 연결 · google_sheets=둘 다 연결."""
    if not _has_creds():
        return "sample"
    if not _libs_ok():
        return "needs_install"
    led = bool(_url_for(C.LEDGER_SHEET))
    inv = bool(_url_for(C.INVEST_SHEET))
    if led and inv:
        return "google_sheets"
    if led or inv:
        return "partial"
    return "sample"


# ──────────────────────────────────────────────────────────────
# Google Sheets 클라이언트 (지연 임포트 — 미설치 환경에서도 샘플 모드 동작)
# ──────────────────────────────────────────────────────────────
@st.cache_resource(show_spinner=False)
def _gspread_client():
    import gspread
    from google.oauth2.service_account import Credentials

    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]
    key_file = _key_file_path()
    if key_file:  # 방법 1) JSON 파일 그대로 사용 (권장 — 간단)
        creds = Credentials.from_service_account_file(key_file, scopes=scopes)
    else:         # 방법 2) secrets.toml에 인라인으로 적은 경우
        creds = Credentials.from_service_account_info(
            dict(st.secrets["gcp_service_account"]), scopes=scopes
        )
    return gspread.authorize(creds)


def _open_ws(sheet_name: str):
    url = _url_for(sheet_name)
    if not url:
        raise RuntimeError(f"{sheet_name} 시트 URL이 secrets에 없습니다.")
    tab = _tab_name(sheet_name)
    writable = (sheet_name == C.LEDGER_SHEET)
    gc = _gspread_client()
    sh = gc.open_by_url(url)
    try:
        return sh.worksheet(tab)
    except Exception:
        # 가계부 탭이 없으면 헤더와 함께 생성 (투자 탭은 절대 생성하지 않음)
        if writable:
            ws = sh.add_worksheet(title=tab, rows=1000, cols=len(C.LEDGER_COLS))
            ws.append_row(C.LEDGER_COLS)
            return ws
        raise


# ──────────────────────────────────────────────────────────────
# 읽기 — 시트 연결 실패 시 크래시하지 않고 샘플로 폴백(+에러 기록)
# ──────────────────────────────────────────────────────────────
# 마지막 연결 오류를 사이드바에서 보여주기 위한 저장소 (설정 중 디버깅용)
LAST_ERRORS: dict[str, str] = {}


@st.cache_data(ttl=60, show_spinner=False)
def load_ledger() -> pd.DataFrame:
    LAST_ERRORS.pop("가계부", None)
    if _sheet_connected(C.LEDGER_SHEET):
        try:
            ws = _open_ws(C.LEDGER_SHEET)
            df = pd.DataFrame(ws.get_all_records())
        except Exception as exc:  # noqa: BLE001
            LAST_ERRORS["가계부"] = f"{type(exc).__name__}: {exc}"
            df = pd.read_csv(os.path.join(_SAMPLE_DIR, "가계부.csv"), dtype=str)
    else:
        df = pd.read_csv(os.path.join(_SAMPLE_DIR, "가계부.csv"), dtype=str)
    for col in C.LEDGER_COLS:
        if col not in df.columns:
            df[col] = ""
    return df[C.LEDGER_COLS]


@st.cache_data(ttl=60, show_spinner=False)
def load_invest() -> pd.DataFrame:
    LAST_ERRORS.pop("포트폴리오", None)
    if _sheet_connected(C.INVEST_SHEET):
        try:
            ws = _open_ws(C.INVEST_SHEET)
            df = pd.DataFrame(ws.get_all_records())
        except Exception as exc:  # noqa: BLE001
            LAST_ERRORS["포트폴리오"] = f"{type(exc).__name__}: {exc}"
            df = pd.read_csv(os.path.join(_SAMPLE_DIR, "보유현황.csv"), dtype=str)
    else:
        df = pd.read_csv(os.path.join(_SAMPLE_DIR, "보유현황.csv"), dtype=str)
    for col in C.INVEST_COLS:
        if col not in df.columns:
            df[col] = ""
    return df


# ──────────────────────────────────────────────────────────────
# 쓰기 (가계부 한정)
# ──────────────────────────────────────────────────────────────
def new_txn_id() -> str:
    return "TX" + dt.datetime.now().strftime("%Y%m%d%H%M%S%f")[:-3]


def append_ledger_row(row: dict) -> tuple[bool, str]:
    """가계부에 한 행 추가. 샘플 모드면 CSV에, 시트 모드면 시트에."""
    record = {col: row.get(col, "") for col in C.LEDGER_COLS}
    if not record.get("거래ID"):
        record["거래ID"] = new_txn_id()

    if _sheet_connected(C.LEDGER_SHEET):
        try:
            ws = _open_ws(C.LEDGER_SHEET)
            ws.append_row([str(record[c]) for c in C.LEDGER_COLS],
                          value_input_option="USER_ENTERED")
            load_ledger.clear()
            return True, "Google Sheets에 저장했습니다."
        except Exception as exc:  # noqa: BLE001
            return False, f"시트 저장 실패: {exc}"
    else:
        path = os.path.join(_SAMPLE_DIR, "가계부.csv")
        df = pd.read_csv(path, dtype=str)
        df = pd.concat([df, pd.DataFrame([record])[C.LEDGER_COLS]], ignore_index=True)
        df.to_csv(path, index=False)
        load_ledger.clear()
        return True, "샘플 데이터(CSV)에 저장했습니다. (시트 연동 시 자동으로 시트에 저장)"
