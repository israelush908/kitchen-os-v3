"""Migration of historical counts and waste logs from the legacy winery spreadsheet.

Maps:
  - 'C2 ספירות מלאי' -> rows for 'LOG_Counts'
  - 'פחת_לוג'        -> rows for 'LOG_Waste'
"""
import datetime
from common import OLD_SPREADSHEET_ID, Sheets, clean_text, to_number

TYPO_MAP = {
    "אננ": "אננס",
    "בצל": "בצל אדום",
}

def parse_date(v):
    """Normalizes Google serial numbers, YYYY-MM-DD or DD/MM/YYYY into YYYY-MM-DD."""
    if v is None or v == "":
        return ""
    if isinstance(v, (int, float)):
        # Google Sheets serial date
        dt = datetime.date(1899, 12, 30) + datetime.timedelta(days=int(v))
        return dt.strftime("%Y-%m-%d")
    s = clean_text(v).replace("-", "/")
    parts = s.split("/")
    if len(parts) == 3:
        d, m, y = parts[0], parts[1], parts[2]
        if len(y) == 4 and len(d) <= 2:
            return f"{y}-{int(m):02d}-{int(d):02d}"
        if len(d) == 4:
            return f"{d}-{int(m):02d}-{int(y):02d}"
    # fallback to string
    return s

def parse_datetime(v):
    """Normalizes Google serial date with time into YYYY-MM-DD HH:MM."""
    if v is None or v == "":
        return ""
    if isinstance(v, (int, float)):
        base = datetime.datetime(1899, 12, 30)
        dt = base + datetime.timedelta(days=float(v))
        return dt.strftime("%Y-%m-%d %H:%M")
    return clean_text(v)

def build_log_rows(catalog_items_set):
    old = Sheets(OLD_SPREADSHEET_ID, readonly=True)
    c2_raw = old.values("'C2 ספירות מלאי'!A1:F")
    waste_raw = old.values("'פחת_לוג'!A1:K")

    # 1. Counts
    counts_rows = []
    for r in c2_raw[1:]:
        if not r or not any(str(x).strip() for x in r):
            continue
        date_str = parse_date(r[0] if len(r) > 0 else "")
        raw_name = clean_text(r[1] if len(r) > 1 else "")
        item_name = TYPO_MAP.get(raw_name, raw_name)
        if not item_name:
            continue
        qty = to_number(r[3] if len(r) > 3 else 0)
        unit = clean_text(r[2] if len(r) > 2 else "")
        notes = "מיגרציה היסטורית (ספירות שבועיות)"
        
        # Row format for LOG_Counts:
        # A: Count_Date, B: Item_Name, C: Counted_Qty, D: Unit (formula/text),
        # E: Unit_Cost (formula), F: Count_Value (formula), G: Notes
        counts_rows.append([date_str, item_name, qty if qty is not None else 0, unit, notes])

    # 2. Waste
    waste_rows = []
    for r in waste_raw[1:]:
        if not r or not any(str(x).strip() for x in r):
            continue
        ts = parse_datetime(r[0] if len(r) > 0 else "")
        report_date = parse_date(r[1] if len(r) > 1 else "") or ts[:10]
        reporter = clean_text(r[2] if len(r) > 2 else "")
        raw_name = clean_text(r[3] if len(r) > 3 else "")
        item_name = TYPO_MAP.get(raw_name, raw_name)
        if not item_name:
            continue
        qty = to_number(r[4] if len(r) > 4 else 0)
        unit = clean_text(r[5] if len(r) > 5 else "")
        reason = clean_text(r[6] if len(r) > 6 else "")
        note = clean_text(r[9] if len(r) > 9 else "")
        
        # Row format for LOG_Waste:
        # A: Report_Date, B: Reporter, C: Item_Name, D: Waste_Qty, E: Unit,
        # F: Waste_Reason, G: Unit_Cost, H: Total_Waste_Cost, I: Notes
        waste_rows.append([report_date, reporter, item_name, qty if qty is not None else 0, unit, reason, note])

    return counts_rows, waste_rows
