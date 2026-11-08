"""Shared helpers for Kitchen OS v2.0 build scripts (Google Sheets REST API v4)."""
import os
import re

from google.auth.transport.requests import AuthorizedSession
from google.oauth2.service_account import Credentials

CREDENTIALS_FILE = os.environ.get(
    "KITCHEN_OS_CREDENTIALS",
    r"C:\Users\israe\.gemini\antigravity-ide\scratch\google-sheets-manager\credentials.json",
)
NEW_SPREADSHEET_ID = os.environ.get("KITCHEN_OS_SHEET_ID", "16ToeULQNGXZuYi7Jt08jkLrYbV28h1ad1Vg1tiHVVF4")
OLD_SPREADSHEET_ID = os.environ.get("KITCHEN_OS_OLD_SHEET_ID", "1hq87-JlvaLPzP9hbil3B5Pz1sC-KyOf16-X85vddI9g")

API = "https://sheets.googleapis.com/v4/spreadsheets/"
SCOPE_RW = "https://www.googleapis.com/auth/spreadsheets"
SCOPE_RO = "https://www.googleapis.com/auth/spreadsheets.readonly"

# ---- Design tokens (Quiet Luxury) ----
HEADER_BG = "#1E1E1E"
HEADER_FG = "#FFFFFF"
BAND_1 = "#FFFFFF"
BAND_2 = "#F8F9FA"
MUTED_TEXT = "#ADB5BD"
WARN_BG = "#FFF3CD"
TAB_DB = "#495057"
FONT = "Heebo"


class Sheets:
    """Thin wrapper over the Sheets REST API."""

    def __init__(self, spreadsheet_id, readonly=False):
        creds = Credentials.from_service_account_file(
            CREDENTIALS_FILE, scopes=[SCOPE_RO if readonly else SCOPE_RW]
        )
        self.s = AuthorizedSession(creds)
        self.id = spreadsheet_id
        self.readonly = readonly

    def _check(self, r):
        if r.status_code >= 300:
            raise RuntimeError(f"Sheets API {r.status_code}: {r.text}")
        return r.json()

    def get(self, fields):
        return self._check(self.s.get(API + self.id, params={"fields": fields}))

    def values(self, a1, render="UNFORMATTED_VALUE"):
        r = self.s.get(API + self.id + "/values/" + a1, params={"valueRenderOption": render})
        return self._check(r).get("values", [])

    def batch_update(self, requests):
        if self.readonly:
            raise PermissionError("Read-only client cannot write")
        if not requests:
            return {}
        return self._check(self.s.post(API + self.id + ":batchUpdate", json={"requests": requests}))


def a1_sheet(title):
    return "'" + title.replace("'", "''") + "'"


def color(hex_str):
    h = hex_str.lstrip("#")
    return {"red": int(h[0:2], 16) / 255, "green": int(h[2:4], 16) / 255, "blue": int(h[4:6], 16) / 255}


def grid(sheet_id, r1, r2=None, c1=0, c2=None):
    """Zero-based, end-exclusive GridRange. None = unbounded."""
    g = {"sheetId": sheet_id, "startRowIndex": r1, "startColumnIndex": c1}
    if r2 is not None:
        g["endRowIndex"] = r2
    if c2 is not None:
        g["endColumnIndex"] = c2
    return g


def cell(v, note=None):
    """Python value -> CellData with explicit types (no locale guessing)."""
    d = {}
    if isinstance(v, bool):
        d["userEnteredValue"] = {"boolValue": v}
    elif isinstance(v, (int, float)):
        d["userEnteredValue"] = {"numberValue": v}
    elif isinstance(v, str) and v.startswith("="):
        d["userEnteredValue"] = {"formulaValue": v}
    elif isinstance(v, str) and v != "":
        d["userEnteredValue"] = {"stringValue": v}
    if note:
        d["note"] = note
    return d


def write_block(sheet_id, row, col, rows):
    """updateCells request writing a 2D list starting at (row, col), zero-based.
    Items may be raw values or (value, note) tuples."""
    row_data = []
    for r in rows:
        vals = []
        for v in r:
            vals.append(cell(*v) if isinstance(v, tuple) else cell(v))
        row_data.append({"values": vals})
    return {
        "updateCells": {
            "start": {"sheetId": sheet_id, "rowIndex": row, "columnIndex": col},
            "rows": row_data,
            "fields": "userEnteredValue,note",
        }
    }


def clean_text(v):
    """Trim and strip invisible bidi/control characters."""
    if v is None:
        return ""
    s = str(v)
    s = re.sub(r"[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]", "", s)
    return re.sub(r"\s+", " ", s).strip()


def to_number(v):
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return v
    s = clean_text(v).replace("₪", "").replace(",", "")
    try:
        return float(s) if s else None
    except ValueError:
        return None


def normalize_il_phone(v):
    """'504008601', '054-484-6938', '+972 50...' -> '972504008601'. Empty if unusable."""
    digits = re.sub(r"\D", "", clean_text(v))
    if not digits:
        return ""
    if digits.startswith("972"):
        digits = digits[3:]
    digits = digits.lstrip("0")
    if len(digits) not in (8, 9):
        return ""
    return "972" + digits
