"""Kitchen OS v2.0 - Module 2: Smart Inventory & WhatsApp Orders Generator + Logging Layer.

Creates and configures:
  1. 'LOG_Counts'          - Inventory count records (with historical winery counts migrated)
  2. 'LOG_Waste'           - Kitchen waste logs (with historical winery waste migrated)
  3. 'OPS_Inventory_Orders' - Real-time stock calculation + WhatsApp order dispatch hub

Usage:
    python build_module2.py            # builds and migrates logs
    python build_module2.py --force    # forces clean rebuild
"""
import argparse
import json
import sys

from common import (BAND_1, BAND_2, FONT, HEADER_BG, HEADER_FG, MUTED_TEXT, NEW_SPREADSHEET_ID,
                    Sheets, a1_sheet, color, grid, write_block)
from migrate_logs import build_log_rows

LOG_COUNTS = "LOG_Counts"
LOG_WASTE = "LOG_Waste"
OPS_INV = "OPS_Inventory_Orders"
CAT = "DB_Catalog"
SUP = "DB_Config_Suppliers"

TAB_OPS = "#2B8A3E"  # Emerald green for Ops
TAB_LOG = "#868E96"  # Steel gray for Logs

CURRENCY = {"type": "CURRENCY", "pattern": '"₪"#,##0.00'}
PERCENT = {"type": "PERCENT", "pattern": "0%"}
DATE_FMT = {"type": "DATE", "pattern": "yyyy-mm-dd"}
NUMBER_FMT = {"type": "NUMBER", "pattern": "#,##0.##"}
TEXT_FMT = {"type": "TEXT", "pattern": "@"}

# ----------------- LOG_Counts headers -----------------
COUNTS_HEADERS = [
    "תאריך ספירה (Count_Date)",
    "שם חומר גלם (Item_Name)",
    "כמות שנספרה (Counted_Qty)",
    "יחידת מידה (Stock_Unit)",
    'מחיר יחידה ללא מע"מ (Unit_Cost)',
    "שווי בספירה (Count_Value)",
    "מבצע הספירה / הערות (Notes)",
]

# ----------------- LOG_Waste headers -----------------
WASTE_HEADERS = [
    "תאריך דיווח (Report_Date)",
    "מדווח (Reporter)",
    "שם חומר גלם (Item_Name)",
    "כמות פחת (Waste_Qty)",
    "יחידת מידה (Stock_Unit)",
    "סיבת פחת (Waste_Reason)",
    'מחיר יחידה ללא מע"מ (Unit_Cost)',
    "סך פחת ₪ (Total_Waste_Cost)",
    "הערות (Notes)",
]

# ----------------- OPS_Inventory_Orders headers -----------------
INV_HEADERS_TABLE_A = [
    "מזהה פריט (Item_ID)",
    "שם חומר גלם (Item_Name)",
    "קטגוריה (Category)",
    "ספק ראשי (Supplier)",
    "יחידת מידה (Stock_Unit)",
    "ספירה אחרונה בלוג (Last_Count_Qty)",
    "ספירה מהירה / תיקון (Quick_Count_Override)",
    "מלאי נוכחי בפועל (Current_Stock)",
    'תקן סופ"ש (Par_Level)',
    "נקודת הזמנה (Reorder_Point)",
    "כמות להזמנה (Order_Qty)",
    "סטטוס מלאי (Stock_Status)",
    "שווי מלאי ₪ (Stock_Value)",
]

INV_HEADERS_TABLE_B = [
    "ספק (Supplier)",
    "איש קשר (Contact)",
    "טלפון וואטסאפ (WhatsApp_Phone)",
    "פריטים בחוסר (Items_To_Order)",
    "טקסט הזמנה מעוצב (Order_Message)",
    "שיגור בוואטסאפ (Send_WhatsApp)",
]


# ---------------- Formatting helpers ----------------
def fmt(rng, number=None, align=None, bold=None, fg=None, bg=None, wrap=None):
    f, fields = {}, []
    if number:
        f["numberFormat"] = number
        fields.append("numberFormat")
    if align:
        f["horizontalAlignment"] = align
        fields.append("horizontalAlignment")
    if bg:
        f["backgroundColor"] = color(bg)
        fields.append("backgroundColor")
    if wrap:
        f["wrapStrategy"] = wrap
        fields.append("wrapStrategy")
    tf = {}
    if bold is not None:
        tf["bold"] = bold
    if fg:
        tf["foregroundColor"] = color(fg)
    if tf:
        f["textFormat"] = tf
        fields += [f"textFormat.{k}" for k in tf]
    return {
        "repeatCell": {
            "range": rng,
            "cell": {"userEnteredFormat": f},
            "fields": ",".join(f"userEnteredFormat.{x}" for x in fields),
        }
    }


def base_font(sheet_id):
    return {
        "repeatCell": {
            "range": grid(sheet_id, 0),
            "cell": {
                "userEnteredFormat": {
                    "textFormat": {"fontFamily": FONT, "fontSize": 10},
                    "verticalAlignment": "MIDDLE",
                }
            },
            "fields": "userEnteredFormat.textFormat.fontFamily,userEnteredFormat.textFormat.fontSize,userEnteredFormat.verticalAlignment",
        }
    }


def header(sheet_id, c1, c2):
    return fmt(
        grid(sheet_id, 0, 1, c1, c2),
        bold=True,
        fg=HEADER_FG,
        bg=HEADER_BG,
        align="CENTER",
        wrap="WRAP",
    )


def banding(sheet_id, r2, c1, c2):
    return {
        "addBanding": {
            "bandedRange": {
                "range": grid(sheet_id, 0, r2, c1, c2),
                "rowProperties": {
                    "headerColor": color(HEADER_BG),
                    "firstBandColor": color(BAND_1),
                    "secondBandColor": color(BAND_2),
                },
            }
        }
    }


def validation(rng, cond_type, values=None, strict=True, msg=None):
    cond = {"type": cond_type}
    if values:
        cond["values"] = [{"userEnteredValue": v} for v in values]
    rule = {"condition": cond, "strict": strict, "showCustomUi": cond_type.startswith("ONE_OF")}
    if msg:
        rule["inputMessage"] = msg
    return {"setDataValidation": {"range": rng, "rule": rule}}


def cond_format(rng, formula, fg=None, bg=None, bold=None):
    f = {}
    if fg:
        f["textFormat"] = {"foregroundColor": color(fg)}
    if bg:
        f["backgroundColor"] = color(bg)
    if bold is not None:
        if "textFormat" not in f:
            f["textFormat"] = {}
        f["textFormat"]["bold"] = bold
    return {
        "addConditionalFormatRule": {
            "index": 0,
            "rule": {
                "ranges": [rng],
                "booleanRule": {
                    "condition": {"type": "CUSTOM_FORMULA", "values": [{"userEnteredValue": formula}]},
                    "format": f,
                },
            },
        }
    }


def widths(sheet_id, px_list):
    return [
        {
            "updateDimensionProperties": {
                "range": {"sheetId": sheet_id, "dimension": "COLUMNS", "startIndex": i, "endIndex": i + 1},
                "properties": {"pixelSize": px},
                "fields": "pixelSize",
            }
        }
        for i, px in enumerate(px_list)
    ]


# ---------------- Step 1: Ensure sheets exist ----------------
def prepare_sheets(api, force=False):
    meta = api.get("sheets(properties(sheetId,title),bandedRanges(bandedRangeId),conditionalFormats)")
    sheets = {s["properties"]["title"]: s for s in meta.get("sheets", [])}

    reqs = []
    for tab in [LOG_COUNTS, LOG_WASTE, OPS_INV]:
        if tab not in sheets:
            reqs.append({"addSheet": {"properties": {"title": tab}}})
    if reqs:
        api.batch_update(reqs)
        meta = api.get("sheets(properties(sheetId,title),bandedRanges(bandedRangeId),conditionalFormats)")
        sheets = {s["properties"]["title"]: s for s in meta.get("sheets", [])}

    ids = {tab: sheets[tab]["properties"]["sheetId"] for tab in [LOG_COUNTS, LOG_WASTE, OPS_INV]}

    # Reset sheets properties
    reset_reqs = []
    configs = [
        (LOG_COUNTS, ids[LOG_COUNTS], 2000, 7, TAB_LOG),
        (LOG_WASTE, ids[LOG_WASTE], 1000, 9, TAB_LOG),
        (OPS_INV, ids[OPS_INV], 500, 21, TAB_OPS),
    ]

    for title, sid, rows, cols, tab_col in configs:
        s = sheets[title]
        for b in s.get("bandedRanges", []):
            reset_reqs.append({"deleteBanding": {"bandedRangeId": b["bandedRangeId"]}})
        for _ in s.get("conditionalFormats", []):
            reset_reqs.append({"deleteConditionalFormatRule": {"sheetId": sid, "index": 0}})
        reset_reqs.append({"updateCells": {"range": grid(sid, 0), "fields": "*"}})

        reset_reqs.append({
            "updateSheetProperties": {
                "properties": {
                    "sheetId": sid,
                    "rightToLeft": True,
                    "tabColorStyle": {"rgbColor": color(tab_col)},
                    "gridProperties": {
                        "frozenRowCount": 1,
                        "frozenColumnCount": 0,
                        "hideGridlines": True,
                        "rowCount": rows,
                        "columnCount": cols,
                    },
                },
                "fields": "rightToLeft,tabColorStyle,gridProperties(frozenRowCount,frozenColumnCount,hideGridlines,rowCount,columnCount)",
            }
        })

    api.batch_update(reset_reqs)
    return ids


# ---------------- Step 2: Build LOG_Counts ----------------
def build_log_counts_requests(sid, counts_rows):
    r = [base_font(sid)]
    # Write Header
    r.append(write_block(sid, 0, 0, [COUNTS_HEADERS]))

    # Array formulas in Row 2 for columns D, E, F:
    # D2 (Unit):
    f_unit = '=MAP(B2:B, LAMBDA(item, IF(item="", "", IFERROR(XLOOKUP(item, DB_Catalog!B:B, DB_Catalog!E:E, ""), ""))))'
    # E2 (Unit_Cost):
    f_cost = '=MAP(B2:B, LAMBDA(item, IF(item="", "", IFERROR(XLOOKUP(item, DB_Catalog!B:B, DB_Catalog!F:F, 0), 0))))'
    # F2 (Count_Value):
    f_val = '=MAP(C2:C, E2:E, LAMBDA(qty, cost, IF(OR(qty="", cost=""), "", qty * cost)))'

    r.append(write_block(sid, 1, 3, [[f_unit]]))
    r.append(write_block(sid, 1, 4, [[f_cost]]))
    r.append(write_block(sid, 1, 5, [[f_val]]))

    # Write data: Cols A, B, C, and G
    data_cells = []
    for row in counts_rows:
        date_str, item, qty, unit, note = row
        data_cells.append([date_str, item, qty])

    if data_cells:
        r.append(write_block(sid, 1, 0, data_cells))
        notes_cells = [[row[4]] for row in counts_rows]
        r.append(write_block(sid, 1, 6, notes_cells))

    # Styling & Layout
    r.append(header(sid, 0, 7))
    r.append(banding(sid, 2000, 0, 7))
    r.append(fmt(grid(sid, 1, 2000, 0, 1), number=DATE_FMT, align="CENTER"))
    r.append(fmt(grid(sid, 1, 2000, 1, 2), bold=True))
    r.append(fmt(grid(sid, 1, 2000, 2, 3), align="CENTER"))
    r.append(fmt(grid(sid, 1, 2000, 3, 4), align="CENTER"))
    r.append(fmt(grid(sid, 1, 2000, 4, 5), number=CURRENCY, align="CENTER"))
    r.append(fmt(grid(sid, 1, 2000, 5, 6), number=CURRENCY, align="CENTER", bold=True))
    r.append(fmt(grid(sid, 1, 2000, 6, 7), fg="#6C757D"))

    # Validation on Item Name
    r.append(validation(grid(sid, 1, 2000, 1, 2), "ONE_OF_RANGE", ["=DB_Catalog!$B$2:$B"]))

    # Widths
    r += widths(sid, [120, 190, 120, 100, 140, 140, 240])
    return r


# ---------------- Step 3: Build LOG_Waste ----------------
def build_log_waste_requests(sid, waste_rows):
    r = [base_font(sid)]
    # Write Header
    r.append(write_block(sid, 0, 0, [WASTE_HEADERS]))

    # Array formulas in Row 2 for columns E, G, H:
    # E2 (Unit):
    f_unit = '=MAP(C2:C, LAMBDA(item, IF(item="", "", IFERROR(XLOOKUP(item, DB_Catalog!B:B, DB_Catalog!E:E, ""), ""))))'
    # G2 (Unit_Cost):
    f_cost = '=MAP(C2:C, LAMBDA(item, IF(item="", "", IFERROR(XLOOKUP(item, DB_Catalog!B:B, DB_Catalog!F:F, 0), 0))))'
    # H2 (Total_Waste_Cost):
    f_val = '=MAP(D2:D, G2:G, LAMBDA(qty, cost, IF(OR(qty="", cost=""), "", qty * cost)))'

    r.append(write_block(sid, 1, 4, [[f_unit]]))
    r.append(write_block(sid, 1, 6, [[f_cost]]))
    r.append(write_block(sid, 1, 7, [[f_val]]))

    # Write data: Cols A, B, C, D, F, I
    data_part1 = []
    for row in waste_rows:
        date_str, reporter, item, qty, unit, reason, note = row
        data_part1.append([date_str, reporter, item, qty])

    if data_part1:
        r.append(write_block(sid, 1, 0, data_part1))
        # Reason in Col F (col idx 5)
        reasons_col = [[row[5]] for row in waste_rows]
        r.append(write_block(sid, 1, 5, reasons_col))
        # Notes in Col I (col idx 8)
        notes_col = [[row[6]] for row in waste_rows]
        r.append(write_block(sid, 1, 8, notes_col))

    # Styling & Layout
    r.append(header(sid, 0, 9))
    r.append(banding(sid, 1000, 0, 9))
    r.append(fmt(grid(sid, 1, 1000, 0, 1), number=DATE_FMT, align="CENTER"))
    r.append(fmt(grid(sid, 1, 1000, 1, 2), align="CENTER"))
    r.append(fmt(grid(sid, 1, 1000, 2, 3), bold=True))
    r.append(fmt(grid(sid, 1, 1000, 3, 4), align="CENTER"))
    r.append(fmt(grid(sid, 1, 1000, 4, 5), align="CENTER"))
    r.append(fmt(grid(sid, 1, 1000, 5, 6), align="CENTER"))
    r.append(fmt(grid(sid, 1, 1000, 6, 7), number=CURRENCY, align="CENTER"))
    r.append(fmt(grid(sid, 1, 1000, 7, 8), number=CURRENCY, align="CENTER", bold=True, fg="#C92A2A"))
    r.append(fmt(grid(sid, 1, 1000, 8, 9), fg="#6C757D"))

    # Validations
    r.append(validation(grid(sid, 1, 1000, 2, 3), "ONE_OF_RANGE", ["=DB_Catalog!$B$2:$B"]))
    r.append(validation(grid(sid, 1, 1000, 5, 6), "ONE_OF_RANGE", ["=DB_Config_Suppliers!$P$2:$P"]))

    # Widths
    r += widths(sid, [120, 110, 180, 100, 95, 160, 130, 130, 240])
    return r


# ---------------- Step 4: Build OPS_Inventory_Orders ----------------
def build_ops_inventory_requests(sid):
    r = [base_font(sid)]

    # Headers for Table A (Cols A to M) & Table B (Cols O to T)
    r.append(write_block(sid, 0, 0, [INV_HEADERS_TABLE_A]))
    r.append(write_block(sid, 0, 14, [INV_HEADERS_TABLE_B]))

    # Formula definitions for Table A (Row 2):
    # A2: Item_ID
    f_id = '=FILTER(DB_Catalog!A2:A, DB_Catalog!B2:B<>"", DB_Catalog!K2:K=TRUE)'
    # B2: Item_Name
    f_name = '=FILTER(DB_Catalog!B2:B, DB_Catalog!B2:B<>"", DB_Catalog!K2:K=TRUE)'
    # C2: Category
    f_cat = '=FILTER(DB_Catalog!C2:C, DB_Catalog!B2:B<>"", DB_Catalog!K2:K=TRUE)'
    # D2: Supplier
    f_sup = '=FILTER(DB_Catalog!D2:D, DB_Catalog!B2:B<>"", DB_Catalog!K2:K=TRUE)'
    # E2: Stock_Unit
    f_unit = '=FILTER(DB_Catalog!E2:E, DB_Catalog!B2:B<>"", DB_Catalog!K2:K=TRUE)'
    # F2: Last_Count_Qty (search backwards for latest count in LOG_Counts)
    f_last_count = '=MAP(B2:B, LAMBDA(item, IF(item="", "", IFERROR(XLOOKUP(item, LOG_Counts!B:B, LOG_Counts!C:C, 0, 0, -1), 0))))'
    # H2: Current_Stock (uses Quick_Count in Col G if provided, else Last_Count in Col F)
    f_curr_stock = '=MAP(F2:F, G2:G, LAMBDA(last, manual, IF(ISNUMBER(manual), manual, IF(ISNUMBER(last), last, 0))))'
    # I2: Par_Level
    f_par = '=FILTER(DB_Catalog!I2:I, DB_Catalog!B2:B<>"", DB_Catalog!K2:K=TRUE)'
    # J2: Reorder_Point
    f_reorder = '=FILTER(DB_Catalog!J2:J, DB_Catalog!B2:B<>"", DB_Catalog!K2:K=TRUE)'
    # K2: Order_Qty
    f_order_qty = '=MAP(H2:H, I2:I, J2:J, LAMBDA(stock, par, reorder, IF(stock="", "", IF(stock <= IF(ISNUMBER(reorder), reorder, 0), MAX(0, IF(ISNUMBER(par), par, 0) - stock), 0))))'
    # L2: Stock_Status
    f_status = '=MAP(H2:H, J2:J, LAMBDA(stock, reorder, IF(stock="", "", IF(stock<=0, "אזל מהמלאי 🔴", IF(stock<=IF(ISNUMBER(reorder), reorder, 0), "להזמנה 🟡", "תקין 🟢")))))'
    # M2: Stock_Value
    f_value = '=MAP(B2:B, H2:H, LAMBDA(item, stock, IF(item="", "", stock * IFERROR(XLOOKUP(item, DB_Catalog!B:B, DB_Catalog!F:F, 0), 0))))'

    # Write Table A formulas
    r.append(write_block(sid, 1, 0, [[f_id]]))
    r.append(write_block(sid, 1, 1, [[f_name]]))
    r.append(write_block(sid, 1, 2, [[f_cat]]))
    r.append(write_block(sid, 1, 3, [[f_sup]]))
    r.append(write_block(sid, 1, 4, [[f_unit]]))
    r.append(write_block(sid, 1, 5, [[f_last_count]]))
    r.append(write_block(sid, 1, 7, [[f_curr_stock]]))
    r.append(write_block(sid, 1, 8, [[f_par]]))
    r.append(write_block(sid, 1, 9, [[f_reorder]]))
    r.append(write_block(sid, 1, 10, [[f_order_qty]]))
    r.append(write_block(sid, 1, 11, [[f_status]]))
    r.append(write_block(sid, 1, 12, [[f_value]]))

    # Formula definitions for Table B (Supplier WhatsApp Hub, Cols O to T, row 2):
    # O2: Supplier
    f_b_sup = '=FILTER(DB_Config_Suppliers!B2:B, DB_Config_Suppliers!B2:B<>"", DB_Config_Suppliers!G2:G=TRUE)'
    # P2: Contact
    f_b_contact = '=MAP(O2:O, LAMBDA(s, IF(s="", "", IFERROR(XLOOKUP(s, DB_Config_Suppliers!B:B, DB_Config_Suppliers!D:D, ""), ""))))'
    # Q2: WhatsApp Phone
    f_b_phone = '=MAP(O2:O, LAMBDA(s, IF(s="", "", IFERROR(XLOOKUP(s, DB_Config_Suppliers!B:B, DB_Config_Suppliers!E:E, ""), ""))))'
    # R2: Items To Order Count
    f_b_count = '=MAP(O2:O, LAMBDA(s, IF(s="", "", COUNTIFS(D$2:D, s, K$2:K, ">0"))))'
    # S2: Formatted Order Message
    f_b_msg = (
        '=MAP(O2:O, P2:P, R2:R, LAMBDA(sup, contact, count, '
        'IF(OR(sup="", count=0), "", '
        '"שלום " & IF(contact="", sup, contact) & "," & CHAR(10) & '
        '"הזמנת רכש מטבח (" & TEXT(TODAY(), "DD/MM/YYYY") & "):" & CHAR(10) & '
        'TEXTJOIN(CHAR(10), TRUE, FILTER("• " & B$2:B & " — " & K$2:K & " " & E$2:E, (D$2:D=sup) * (K$2:K>0))) & CHAR(10) & '
        '"תודה רבה! 🙏"'
        ')))'
    )
    # T2: Direct WhatsApp Dispatch Link
    f_b_link = (
        '=MAP(Q2:Q, R2:R, S2:S, LAMBDA(phone, count, msg, '
        'IF(count=0, "— אין חוסרים —", '
        'IF(phone="", "— חסר טלפון —", '
        'HYPERLINK("https://wa.me/" & phone & "?text=" & ENCODEURL(msg), "📲 שלח בוואטסאפ")'
        '))))'
    )

    # Write Table B formulas
    r.append(write_block(sid, 1, 14, [[f_b_sup]]))
    r.append(write_block(sid, 1, 15, [[f_b_contact]]))
    r.append(write_block(sid, 1, 16, [[f_b_phone]]))
    r.append(write_block(sid, 1, 17, [[f_b_count]]))
    r.append(write_block(sid, 1, 18, [[f_b_msg]]))
    r.append(write_block(sid, 1, 19, [[f_b_link]]))

    # Headers & Bandings
    r.append(header(sid, 0, 13))
    r.append(header(sid, 14, 20))
    r.append(banding(sid, 500, 0, 13))
    r.append(banding(sid, 50, 14, 20))

    # Formats for Table A
    r.append(fmt(grid(sid, 1, 500, 0, 1), align="CENTER", fg="#6C757D"))
    r.append(fmt(grid(sid, 1, 500, 1, 2), bold=True))
    r.append(fmt(grid(sid, 1, 500, 2, 5), align="CENTER"))
    r.append(fmt(grid(sid, 1, 500, 5, 6), align="CENTER"))
    # Col G: Quick Count Override (subtle highlight to indicate input field)
    r.append(fmt(grid(sid, 1, 500, 6, 7), align="CENTER", bg="#F1F3F5", bold=True))
    r.append(fmt(grid(sid, 1, 500, 7, 8), align="CENTER", bold=True))
    r.append(fmt(grid(sid, 1, 500, 8, 10), align="CENTER"))
    r.append(fmt(grid(sid, 1, 500, 10, 11), align="CENTER", bold=True, fg="#C92A2A"))
    r.append(fmt(grid(sid, 1, 500, 11, 12), align="CENTER", bold=True))
    r.append(fmt(grid(sid, 1, 500, 12, 13), number=CURRENCY, align="CENTER", bold=True))

    # Formats for Table B
    r.append(fmt(grid(sid, 1, 50, 14, 15), bold=True))
    r.append(fmt(grid(sid, 1, 50, 15, 17), align="CENTER"))
    r.append(fmt(grid(sid, 1, 50, 17, 18), align="CENTER", bold=True))
    r.append(fmt(grid(sid, 1, 50, 18, 19), wrap="CLIP", fg="#6C757D"))
    r.append(fmt(grid(sid, 1, 50, 19, 20), align="CENTER", bold=True))

    # Conditional Formats:
    # Table A - Stock Status
    r.append(cond_format(grid(sid, 1, 500, 11, 12), '=REGEXMATCH($L2,"אזל")', fg="#C92A2A", bg="#FFE3E3", bold=True))
    r.append(cond_format(grid(sid, 1, 500, 11, 12), '=REGEXMATCH($L2,"להזמנה")', fg="#D9480F", bg="#FFF3BF", bold=True))
    r.append(cond_format(grid(sid, 1, 500, 11, 12), '=REGEXMATCH($L2,"תקין")', fg="#2B8A3E", bg="#D3F9D8"))

    # Table B - WhatsApp Link ready
    r.append(cond_format(grid(sid, 1, 50, 19, 20), '=ISNUMBER(SEARCH("שלח",$T2))', fg="#2B8A3E", bg="#D3F9D8", bold=True))
    r.append(cond_format(grid(sid, 1, 50, 19, 20), '=$R2=0', fg=MUTED_TEXT))

    # Column widths
    col_widths = [
        95,   # A: Item_ID
        180,  # B: Item_Name
        140,  # C: Category
        130,  # D: Supplier
        100,  # E: Stock_Unit
        130,  # F: Last_Count_Qty
        150,  # G: Quick_Count_Override
        130,  # H: Current_Stock
        110,  # I: Par_Level
        120,  # J: Reorder_Point
        120,  # K: Order_Qty
        130,  # L: Stock_Status
        140,  # M: Stock_Value
        24,   # N: Spacer
        140,  # O: Supplier
        120,  # P: Contact
        140,  # Q: WhatsApp_Phone
        120,  # R: Items_To_Order
        260,  # S: Order_Message
        150,  # T: Send_WhatsApp
    ]
    r += widths(sid, col_widths)

    return r


# ---------------- Main runner ----------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    api = Sheets(NEW_SPREADSHEET_ID)

    # 1. Fetch catalog items for validation
    catalog_rows = api.values(f"'{CAT}'!B2:B")
    catalog_items = set(r[0] for r in catalog_rows if r)
    print(f"Loaded {len(catalog_items)} catalog items from {CAT}")

    # 2. Build migrated rows from legacy winery sheet
    counts_rows, waste_rows = build_log_rows(catalog_items)
    print(f"Prepared {len(counts_rows)} count records and {len(waste_rows)} waste records for migration.")

    # 3. Prepare target sheets
    ids = prepare_sheets(api, force=args.force)
    print(f"Prepared sheets: {ids}")

    # 4. Build and execute batch updates
    print("Writing LOG_Counts...")
    api.batch_update(build_log_counts_requests(ids[LOG_COUNTS], counts_rows))

    print("Writing LOG_Waste...")
    api.batch_update(build_log_waste_requests(ids[LOG_WASTE], waste_rows))

    print("Writing OPS_Inventory_Orders...")
    api.batch_update(build_ops_inventory_requests(ids[OPS_INV]))

    print(f"SUCCESS: Module 2 successfully built!")
    print(f"Spreadsheet URL: https://docs.google.com/spreadsheets/d/{NEW_SPREADSHEET_ID}/edit")


if __name__ == "__main__":
    main()
