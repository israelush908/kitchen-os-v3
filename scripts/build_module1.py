"""Kitchen OS v2.0 - Module 1: Core Database Layer.

Builds DB_Config_Suppliers + DB_Catalog (RTL, Quiet-Luxury styling, validations,
array formulas, named ranges) and fills them from the legacy winery sheet.

Usage:
    python build_module1.py            # build; aborts if DB_Catalog already has items
    python build_module1.py --force    # rebuild & re-migrate (overwrites DB sheets)
    python build_module1.py --dry-run  # show migration report only, no writes
"""
import argparse
import json
import sys

from common import (BAND_1, BAND_2, FONT, HEADER_BG, HEADER_FG, MUTED_TEXT, NEW_SPREADSHEET_ID, TAB_DB,
                    WARN_BG, Sheets, a1_sheet, color, grid, write_block)
from migrate_legacy import (ITEM_CATEGORIES, STATIONS, SUPPLIER_CATEGORIES, UNITS, WASTE_REASONS,
                            build_rows)

SUP = "DB_Config_Suppliers"
CAT = "DB_Catalog"
SUP_ROWS, SUP_COLS = 300, 16   # A:P
CAT_ROWS, CAT_COLS = 1000, 14  # A:N
SUP_TABLE_END = 100            # supplier directory formatted rows (incl. header)

SUP_HEADERS = [
    "מזהה ספק (Supplier_ID)", "שם ספק (Supplier_Name)", "קטגוריה ראשית (Category)",
    "איש קשר (Contact_Name)", "טלפון וואטסאפ (WhatsApp_Phone)", "ימי הזמנה/אספקה (Delivery_Days)",
    "פעיל (Is_Active)",
]
CFG_HEADERS = ["פרמטר מערכת (Config_Key)", "ערך (Config_Value)", "הערה"]
CFG_ROWS = [
    ["יעד פוד קוסט (Target_FoodCost)", 0.30, "עלות חומרי גלם / מחיר מכירה ללא מע\"מ"],
    ["יעד לייבור מטבח (Target_LaborCost)", 0.20, "עלות עבודה מטבח / פדיון ללא מע\"מ"],
    ["מקדם עלות מעסיק (Employer_Cost_Multiplier)", 1.25, "שכר ברוטו × מקדם = עלות מעסיק אמיתית"],
    ['מע"מ (VAT)', 0.18, 'מע"מ בישראל'],
]
NAMED = {  # name -> (row0, col0) on SUP
    "CFG_Target_FoodCost": (1, 9), "CFG_Target_LaborCost": (2, 9),
    "CFG_Employer_Cost_Multiplier": (3, 9), "CFG_VAT": (4, 9),
}
LIST_HEADERS = ["קטגוריות חומרי גלם", "יחידות מידה", "עמדות מטבח", "סיבות פחת"]

CAT_HEADERS = [
    "מזהה פריט (Item_ID)", "שם חומר גלם (Item_Name)", "קטגוריה (Category)", "ספק ראשי (Supplier)",
    "יחידת רכש/מלאי (Stock_Unit)", 'מחיר יחידה ללא מע"מ (Unit_Cost)',
    "מקדם פחת קילוף/ניקוי % (Yield_Loss_Pct)", "עלות אפקטיבית למתכון (Effective_Cost)",
    'תקן מלאי סופ"ש (Par_Level)', "נקודת הזמנה מינימום (Reorder_Point)", "פעיל במערכת (Active)",
    "מופיע בטופס ספירה (In_Count_Form)", "מופיע בטופס פחת (In_Waste_Form)", 'הערות / מק"ט ספק (Notes)',
]
F_ITEM_ID = '=MAP(B2:B, LAMBDA(name, IF(name="", "", "ITM-" & TEXT(ROW(name)-1, "000"))))'
F_EFFECTIVE = ('=MAP(F2:F, G2:G, LAMBDA(cost, loss, IF(cost="", "", '
               'cost / (1 - IF(ISNUMBER(loss), loss, 0)))))')

CURRENCY = {"type": "CURRENCY", "pattern": '"₪"#,##0.00'}
PERCENT = {"type": "PERCENT", "pattern": "0%"}
NUMBER = {"type": "NUMBER", "pattern": "#,##0.##"}
TEXT = {"type": "TEXT", "pattern": "@"}


# ---------------------------------------------------------------- request builders
def fmt(rng, number=None, align=None, bold=None, fg=None, bg=None, wrap=None):
    f, fields = {}, []
    if number:
        f["numberFormat"] = number; fields.append("numberFormat")
    if align:
        f["horizontalAlignment"] = align; fields.append("horizontalAlignment")
    if bg:
        f["backgroundColor"] = color(bg); fields.append("backgroundColor")
    if wrap:
        f["wrapStrategy"] = wrap; fields.append("wrapStrategy")
    tf = {}
    if bold is not None:
        tf["bold"] = bold
    if fg:
        tf["foregroundColor"] = color(fg)
    if tf:
        f["textFormat"] = tf; fields += [f"textFormat.{k}" for k in tf]
    return {"repeatCell": {"range": rng, "cell": {"userEnteredFormat": f},
                           "fields": ",".join(f"userEnteredFormat.{x}" for x in fields)}}


def base_font(sheet_id):
    return {"repeatCell": {
        "range": grid(sheet_id, 0),
        "cell": {"userEnteredFormat": {"textFormat": {"fontFamily": FONT, "fontSize": 10},
                                       "verticalAlignment": "MIDDLE"}},
        "fields": "userEnteredFormat.textFormat.fontFamily,userEnteredFormat.textFormat.fontSize,"
                  "userEnteredFormat.verticalAlignment"}}


def header(sheet_id, c1, c2):
    return fmt(grid(sheet_id, 0, 1, c1, c2), bold=True, fg=HEADER_FG, bg=HEADER_BG, align="CENTER", wrap="WRAP")


def banding(sheet_id, r2, c1, c2):
    return {"addBanding": {"bandedRange": {
        "range": grid(sheet_id, 0, r2, c1, c2),
        "rowProperties": {"headerColor": color(HEADER_BG), "firstBandColor": color(BAND_1),
                          "secondBandColor": color(BAND_2)}}}}


def validation(rng, cond_type, values=None, strict=True, msg=None):
    cond = {"type": cond_type}
    if values:
        cond["values"] = [{"userEnteredValue": v} for v in values]
    rule = {"condition": cond, "strict": strict, "showCustomUi": cond_type.startswith("ONE_OF")}
    if msg:
        rule["inputMessage"] = msg
    return {"setDataValidation": {"range": rng, "rule": rule}}


def cond_format(rng, formula, fg=None, bg=None):
    f = {}
    if fg:
        f["textFormat"] = {"foregroundColor": color(fg)}
    if bg:
        f["backgroundColor"] = color(bg)
    return {"addConditionalFormatRule": {"index": 0, "rule": {
        "ranges": [rng], "booleanRule": {"condition": {"type": "CUSTOM_FORMULA",
                                                       "values": [{"userEnteredValue": formula}]},
                                         "format": f}}}}


def widths(sheet_id, px_list):
    return [{"updateDimensionProperties": {
        "range": {"sheetId": sheet_id, "dimension": "COLUMNS", "startIndex": i, "endIndex": i + 1},
        "properties": {"pixelSize": px}, "fields": "pixelSize"}} for i, px in enumerate(px_list)]


def header_height(sheet_id, px=44):
    return {"updateDimensionProperties": {
        "range": {"sheetId": sheet_id, "dimension": "ROWS", "startIndex": 0, "endIndex": 1},
        "properties": {"pixelSize": px}, "fields": "pixelSize"}}


def named_range(name, rng):
    return {"addNamedRange": {"namedRange": {"name": name, "range": rng}}}


# ---------------------------------------------------------------- phase 1: ensure + reset
def prepare(api, force):
    meta = api.get("sheets(properties(sheetId,title),bandedRanges(bandedRangeId),"
                   "conditionalFormats),namedRanges(namedRangeId,name)")
    sheets = {s["properties"]["title"]: s for s in meta.get("sheets", [])}

    if CAT in sheets and not force:
        existing = api.values(a1_sheet(CAT) + "!B2:B3")
        if existing:
            sys.exit(f"ABORT: {CAT} already contains items. Re-run with --force to rebuild (overwrites).")

    reqs = []
    # Reuse the default blank tab for the first DB sheet.
    if SUP not in sheets:
        blank = [t for t in sheets if t in ("גיליון1", "Sheet1")]
        if blank and len(sheets) == 1:
            reqs.append({"updateSheetProperties": {
                "properties": {"sheetId": sheets[blank[0]]["properties"]["sheetId"], "title": SUP},
                "fields": "title"}})
        else:
            reqs.append({"addSheet": {"properties": {"title": SUP}}})
    if CAT not in sheets:
        reqs.append({"addSheet": {"properties": {"title": CAT}}})
    api.batch_update(reqs)

    meta = api.get("sheets(properties(sheetId,title),bandedRanges(bandedRangeId),conditionalFormats)")
    sheets = {s["properties"]["title"]: s for s in meta["sheets"]}
    ids = {SUP: sheets[SUP]["properties"]["sheetId"], CAT: sheets[CAT]["properties"]["sheetId"]}

    reqs = []
    for nr in api.get("namedRanges(namedRangeId,name)").get("namedRanges", []):
        if nr["name"].startswith(("CFG_", "LIST_")):
            reqs.append({"deleteNamedRange": {"namedRangeId": nr["namedRangeId"]}})
    for title, sid in ids.items():
        s = sheets[title]
        for b in s.get("bandedRanges", []):
            reqs.append({"deleteBanding": {"bandedRangeId": b["bandedRangeId"]}})
        for _ in s.get("conditionalFormats", []):
            reqs.append({"deleteConditionalFormatRule": {"sheetId": sid, "index": 0}})
        reqs.append({"updateCells": {"range": grid(sid, 0), "fields": "*"}})  # values+formats+validation+notes
    for title, sid, rows, cols in ((SUP, ids[SUP], SUP_ROWS, SUP_COLS), (CAT, ids[CAT], CAT_ROWS, CAT_COLS)):
        reqs.append({"updateSheetProperties": {"properties": {
            "sheetId": sid, "rightToLeft": True, "tabColorStyle": {"rgbColor": color(TAB_DB)},
            "gridProperties": {"frozenRowCount": 1, "frozenColumnCount": 0, "hideGridlines": True,
                               "rowCount": rows, "columnCount": cols}},
            "fields": "rightToLeft,tabColorStyle,gridProperties(frozenRowCount,frozenColumnCount,"
                      "hideGridlines,rowCount,columnCount)"}})
    reqs.append({"updateSpreadsheetProperties": {
        "properties": {"locale": "iw_IL", "timeZone": "Asia/Jerusalem"}, "fields": "locale,timeZone"}})
    api.batch_update(reqs)
    return ids


# ---------------------------------------------------------------- phase 2: suppliers sheet
def suppliers_requests(sid, suppliers):
    r = [base_font(sid)]
    # data
    r.append(write_block(sid, 0, 0, [SUP_HEADERS]))
    r.append(write_block(sid, 1, 0, [[s["id"], (s["name"], s["note"]), s["category"], s["contact"],
                                      s["phone"], s["delivery_days"], s["active"]] for s in suppliers]))
    r.append(write_block(sid, 0, 8, [CFG_HEADERS] + CFG_ROWS))
    lists = [ITEM_CATEGORIES, UNITS, STATIONS, WASTE_REASONS]
    depth = max(map(len, lists))
    r.append(write_block(sid, 0, 12, [LIST_HEADERS] + [
        [lst[i] if i < len(lst) else "" for lst in lists] for i in range(depth)]))
    # headers + bands
    r += [header(sid, 0, 7), header(sid, 8, 11), header(sid, 12, 16)]
    r += [banding(sid, SUP_TABLE_END, 0, 7), banding(sid, 15, 8, 11), banding(sid, 30, 12, 16)]
    # formats
    r.append(fmt(grid(sid, 1, SUP_TABLE_END, 0, 1), align="CENTER"))
    r.append(fmt(grid(sid, 1, SUP_TABLE_END, 4, 5), number=TEXT, align="CENTER"))
    r.append(fmt(grid(sid, 1, SUP_TABLE_END, 6, 7), align="CENTER"))
    r.append(fmt(grid(sid, 1, 3, 9, 10), number=PERCENT, align="CENTER", bold=True))
    r.append(fmt(grid(sid, 3, 4, 9, 10), number={"type": "NUMBER", "pattern": "0.00"}, align="CENTER", bold=True))
    r.append(fmt(grid(sid, 4, 5, 9, 10), number=PERCENT, align="CENTER", bold=True))
    r.append(fmt(grid(sid, 1, 15, 10, 11), fg="#6C757D"))
    # validations
    r.append(validation(grid(sid, 1, SUP_TABLE_END, 1, 2), "CUSTOM_FORMULA",
                        ["=COUNTIF($B$2:$B$100,B2)<=1"], msg="שם ספק חייב להיות ייחודי"))
    r.append(validation(grid(sid, 1, SUP_TABLE_END, 2, 3), "ONE_OF_LIST", SUPPLIER_CATEGORIES, strict=False))
    r.append(validation(grid(sid, 1, SUP_TABLE_END, 4, 5), "CUSTOM_FORMULA",
                        ['=OR(E2="",REGEXMATCH(TO_TEXT(E2),"^972[0-9]{8,9}$"))'], strict=False,
                        msg="פורמט בינלאומי ללא +, לדוגמה 972504008601"))
    r.append(validation(grid(sid, 1, SUP_TABLE_END, 6, 7), "BOOLEAN"))
    # conditional formats
    r.append(cond_format(grid(sid, 1, SUP_TABLE_END, 0, 7), '=AND($B2<>"",$G2=FALSE)', fg=MUTED_TEXT))
    r.append(cond_format(grid(sid, 1, SUP_TABLE_END, 4, 5), '=AND($B2<>"",$E2="")', bg=WARN_BG))
    # layout
    r += widths(sid, [105, 140, 140, 120, 175, 165, 75, 24, 260, 95, 260, 24, 170, 120, 160, 180])
    r.append(header_height(sid))
    # named ranges
    for name, (row, col) in NAMED.items():
        r.append(named_range(name, grid(sid, row, row + 1, col, col + 1)))
    r.append(named_range("LIST_Suppliers", grid(sid, 1, SUP_ROWS, 1, 2)))
    for name, col in (("LIST_Item_Categories", 12), ("LIST_Units", 13), ("LIST_Stations", 14),
                      ("LIST_Waste_Reasons", 15)):
        r.append(named_range(name, grid(sid, 1, SUP_ROWS, col, col + 1)))
    return r


# ---------------------------------------------------------------- phase 3: catalog sheet
def catalog_requests(sid, items):
    r = [base_font(sid)]
    r.append(write_block(sid, 0, 0, [CAT_HEADERS]))
    blank = ""
    r.append(write_block(sid, 1, 1, [[
        i["name"], i["category"], i["supplier"], i["unit"],
        i["cost"] if i["cost"] is not None else blank, i["yield_loss"], blank,  # H written by formula below
        i["par"] if i["par"] is not None else blank, i["reorder"] if i["reorder"] is not None else blank,
        i["active"], i["in_count"], i["in_waste"], i["notes"]] for i in items]))
    # Column A and H are owned by array formulas - written last so nothing blocks the spill.
    r.append({"updateCells": {"range": grid(sid, 1, CAT_ROWS, 7, 8), "fields": "userEnteredValue"}})
    r.append(write_block(sid, 1, 0, [[F_ITEM_ID]]))
    r.append(write_block(sid, 1, 7, [[F_EFFECTIVE]]))

    r.append(header(sid, 0, CAT_COLS))
    r.append(banding(sid, CAT_ROWS, 0, CAT_COLS))
    n = CAT_ROWS
    r.append(fmt(grid(sid, 1, n, 0, 1), align="CENTER", fg="#6C757D"))
    r.append(fmt(grid(sid, 1, n, 1, 2), bold=True))
    r.append(fmt(grid(sid, 1, n, 5, 6), number=CURRENCY, align="CENTER"))
    r.append(fmt(grid(sid, 1, n, 6, 7), number=PERCENT, align="CENTER"))
    r.append(fmt(grid(sid, 1, n, 7, 8), number=CURRENCY, align="CENTER", bold=True))
    r.append(fmt(grid(sid, 1, n, 8, 10), align="CENTER"))  # automatic format: "20" not "20."
    r.append(fmt(grid(sid, 1, n, 10, 13), align="CENTER"))
    r.append(fmt(grid(sid, 1, n, 13, 14), fg="#6C757D"))

    sup_ref = a1_sheet(SUP)
    r.append(validation(grid(sid, 1, n, 1, 2), "CUSTOM_FORMULA", ["=COUNTIF($B$2:$B,B2)<=1"],
                        msg="שם חומר גלם חייב להיות ייחודי בקטלוג"))
    r.append(validation(grid(sid, 1, n, 2, 3), "ONE_OF_RANGE", [f"={sup_ref}!$M$2:$M"]))
    r.append(validation(grid(sid, 1, n, 3, 4), "ONE_OF_RANGE", [f"={sup_ref}!$B$2:$B"]))
    r.append(validation(grid(sid, 1, n, 4, 5), "ONE_OF_RANGE", [f"={sup_ref}!$N$2:$N"]))
    r.append(validation(grid(sid, 1, n, 5, 6), "NUMBER_GREATER_THAN_EQ", ["0"], msg='מחיר ליחידת רכש, ללא מע"מ'))
    r.append(validation(grid(sid, 1, n, 6, 7), "NUMBER_BETWEEN", ["0", "0.95"],
                        msg="אחוז אובדן בקילוף/ניקוי. לדוגמה 15% לירק קלוף. ריק = 0%"))
    r.append(validation(grid(sid, 1, n, 8, 10), "NUMBER_GREATER_THAN_EQ", ["0"]))
    r.append(validation(grid(sid, 1, n, 10, 13), "BOOLEAN"))

    r.append(cond_format(grid(sid, 1, n, 0, CAT_COLS), '=AND($B2<>"",$K2=FALSE)', fg=MUTED_TEXT))
    r.append(cond_format(grid(sid, 1, n, 5, 6), '=AND($B2<>"",$F2="")', bg=WARN_BG))

    r += widths(sid, [95, 190, 160, 130, 120, 140, 150, 160, 120, 140, 105, 125, 125, 260])
    r.append(header_height(sid, 52))
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    suppliers, items, report = build_rows()
    print(json.dumps({k: v for k, v in report.items()}, ensure_ascii=False, indent=2))
    if args.dry_run:
        return

    api = Sheets(NEW_SPREADSHEET_ID)
    ids = prepare(api, args.force)
    api.batch_update(suppliers_requests(ids[SUP], suppliers) + catalog_requests(ids[CAT], items))
    print(f"OK: https://docs.google.com/spreadsheets/d/{NEW_SPREADSHEET_ID}/edit")


if __name__ == "__main__":
    main()
