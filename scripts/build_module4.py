"""Kitchen OS v2.0 - Module 4: OPS_Labor_Tracker (Monthly Architecture).

Builds the Monthly Kitchen Labor Management & Tabit Tracking Sheet:
  - Table A (Cols A to O): Monthly Labor Tracking (Sales, Hours, Hourly/Salaried Wages, Employer Cost, Labor %, SPLH)
  - Table B (Cols Q to S): Annual / YTD Labor KPI Summary Cards

Replaces daily tracking with high-level monthly tracking as requested by the user,
incorporating historical winery data from August, September, and October 2026.
"""
import argparse
import sys

from common import (BAND_1, BAND_2, FONT, HEADER_BG, HEADER_FG, MUTED_TEXT, NEW_SPREADSHEET_ID,
                    Sheets, color, grid, write_block)

TAB_LABOR = "OPS_Labor_Tracker"
TAB_OPS = "#2B8A3E"  # Emerald green for Ops layer

CURRENCY = {"type": "CURRENCY", "pattern": '"₪"#,##0.00'}
PERCENT = {"type": "PERCENT", "pattern": "0.0%"}
NUMBER_FMT = {"type": "NUMBER", "pattern": "#,##0.##"}

HEADERS_MONTHLY_TABLE = [
    "חודש / תקופת דיווח (Reporting_Month)",
    'פדיון כולל מע"מ (Sales_Incl_VAT)',
    'פדיון נטו ללא מע"מ (Net_Sales_Excl_VAT)',
    "שעות סרוויס (Service_Hours)",
    "שעות הכנות וניקיון (Prep_Hours)",
    "סה\"כ שעות עבודה (Total_Hours)",
    "שכר שעתי ברוטו ₪ (Hourly_Wages_Gross)",
    "שכר שף / גלובלי ₪ (Salaried_Gross)",
    "סך שכר ישיר ברוטו ₪ (Total_Gross_Wages)",
    "עלות מעסיק אמיתית ₪ (Employer_Cost)",
    "אחוז לייבור בפועל % (Labor_Cost_Pct)",
    "יעד לייבור % (Target_Labor)",
    "סטטוס לייבור (Labor_Status)",
    "פדיון לשעת עבודה - SPLH",
    "עלות לשעת עבודה ₪ (Cost_Per_Hour)",
    "הערות / אירועי חודש (Notes)",
]

HEADERS_KPI_BLOCK = [
    "מדד לייבור שנתי / מצטבר (Annual_Labor_KPI)",
    "ערך מצטבר (YTD_Value)",
    "יעד / משמעות (Benchmark)",
]

# Historical & Projected Monthly Data from user winery sheet
MONTHLY_DATA = [
    # [Month_Name, Sales_Incl_VAT, Service_Hours, Prep_Hours, Hourly_Wages_Gross, Salaried_Gross, Notes]
    ["אוגוסט 2026", 436587.20, 340.0, 107.0, 16835.0, 7000.0, "נתוני אמת מיומן היקב (5 שבועות מלאים)"],
    ["ספטמבר 2026", 359336.73, 260.0, 80.0, 12629.0, 6000.0, "נתוני אמת מיומן היקב (חגי תשרי ואירועים)"],
    ["אוקטובר 2026", 320000.00, 245.0, 75.0, 11500.0, 6000.0, "חודש שוטף (אומדן אמצע חודש)"],
    ["נובמבר 2026", "", "", "", "", "", "יעד תכנון חורף"],
    ["דצמבר 2026", "", "", "", "", "", "יעד אירועי סוף שנה"],
    ["ינואר 2027", "", "", "", "", "", ""],
    ["פברואר 2027", "", "", "", "", "", ""],
    ["מרץ 2027", "", "", "", "", "", ""],
    ["אפריל 2027", "", "", "", "", "", "פסח ועונת האביב"],
    ["מאי 2027", "", "", "", "", "", ""],
    ["יוני 2027", "", "", "", "", "", ""],
    ["יולי 2027", "", "", "", "", "", "פתיחת עונת הקיץ"],
]


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


def prepare_sheet(api, force=False):
    meta = api.get("sheets(properties(sheetId,title),bandedRanges(bandedRangeId),conditionalFormats)")
    sheets = {s["properties"]["title"]: s for s in meta.get("sheets", [])}

    if TAB_LABOR not in sheets:
        api.batch_update([{"addSheet": {"properties": {"title": TAB_LABOR}}}])
        meta = api.get("sheets(properties(sheetId,title),bandedRanges(bandedRangeId),conditionalFormats)")
        sheets = {s["properties"]["title"]: s for s in meta.get("sheets", [])}

    s = sheets[TAB_LABOR]
    sid = s["properties"]["sheetId"]

    reqs = []
    for b in s.get("bandedRanges", []):
        reqs.append({"deleteBanding": {"bandedRangeId": b["bandedRangeId"]}})
    for _ in s.get("conditionalFormats", []):
        reqs.append({"deleteConditionalFormatRule": {"sheetId": sid, "index": 0}})
    reqs.append({"updateCells": {"range": grid(sid, 0), "fields": "*"}})

    reqs.append({
        "updateSheetProperties": {
            "properties": {
                "sheetId": sid,
                "rightToLeft": True,
                "tabColorStyle": {"rgbColor": color(TAB_OPS)},
                "gridProperties": {
                    "frozenRowCount": 1,
                    "frozenColumnCount": 0,
                    "hideGridlines": True,
                    "rowCount": 100,
                    "columnCount": 21,
                },
            },
            "fields": "rightToLeft,tabColorStyle,gridProperties(frozenRowCount,frozenColumnCount,hideGridlines,rowCount,columnCount)",
        }
    })
    api.batch_update(reqs)
    return sid


def build_monthly_labor_requests(sid):
    r = [base_font(sid)]

    # 1. Headers: Monthly Table (Cols A to P, idx 0 to 15) & KPI Block (Cols R to T, idx 17 to 19)
    r.append(write_block(sid, 0, 0, [HEADERS_MONTHLY_TABLE]))
    r.append(write_block(sid, 0, 17, [HEADERS_KPI_BLOCK]))

    # 2. KPI Block Content (Cols R to T, rows 2 to 7)
    kpi_rows = [
        ['סך פדיון נטו מצטבר ₪', '=SUM(C2:C)', 'פדיון נקי ללא מע"מ (בסיס הלייבור)'],
        ['סך שעות עבודה מטבח שנתי', '=SUM(F2:F)', 'שעות עבודה כוללות (סרוויס + הכנות)'],
        ['סך עלות מעסיק מצטברת ₪', '=SUM(J2:J)', 'שכר ישיר ברוטו × מקדם מעסיק (1.25)'],
        ['אחוז לייבור שנתי משוקלל', '=IF(S2>0, S4/S2, 0)', 'יעד מערכת: 20% (CFG_Target_LaborCost)'],
        ['פדיון ממוצע לשעת עבודה (SPLH)', '=IF(S3>0, S2/S3, 0)', 'פדיון נטו לשעת עבודה שנתית'],
        ['עלות ממוצעת לשעת עובד ₪', '=IF(S3>0, S4/S3, 0)', 'עלות מעסיק ממוצעת לשעת מטבח'],
        ['חודשים בחריגת לייבור', '=COUNTIF(M2:M, "חורג 🔴")', 'מספר חודשים שחרגו מיעד 20%'],
    ]
    r.append(write_block(sid, 1, 17, kpi_rows))

    # 3. Monthly Rows (Rows 2 to 25)
    total_months = max(len(MONTHLY_DATA), 20)
    month_cells = []
    for row_idx in range(total_months):
        r_num = row_idx + 2
        m = MONTHLY_DATA[row_idx] if row_idx < len(MONTHLY_DATA) else None
        month_name = m[0] if m else ""
        sales_inc = m[1] if m else ""
        srv_hours = m[2] if m else ""
        prep_hours = m[3] if m else ""
        hourly_wages = m[4] if m else ""
        salary_wages = m[5] if m else ""
        notes = m[6] if m else ""

        # Formulas for row r_num:
        # C: Net_Sales_Excl_VAT = IF(B="","", IF(B>0, B / (1 + CFG_VAT), 0))
        f_net_sales = f'=IF(B{r_num}="","", IF(B{r_num}>0, B{r_num} / (1 + CFG_VAT), 0))'
        # F: Total_Hours = IF(AND(D="", E=""), "", IF(ISNUMBER(D{r_num}), D{r_num}, 0) + IF(ISNUMBER(E{r_num}), E{r_num}, 0))
        f_total_hours = f'=IF(AND(D{r_num}="", E{r_num}=""), "", IF(ISNUMBER(D{r_num}), D{r_num}, 0) + IF(ISNUMBER(E{r_num}), E{r_num}, 0))'
        # I: Total_Gross_Wages = IF(AND(G="", H=""), "", IF(ISNUMBER(G{r_num}), G{r_num}, 0) + IF(ISNUMBER(H{r_num}), H{r_num}, 0))
        f_total_gross = f'=IF(AND(G{r_num}="", H{r_num}=""), "", IF(ISNUMBER(G{r_num}), G{r_num}, 0) + IF(ISNUMBER(H{r_num}), H{r_num}, 0))'
        # J: Employer_Cost = IF(I="","", I * CFG_Employer_Cost_Multiplier)
        f_emp_cost = f'=IF(I{r_num}="","", I{r_num} * CFG_Employer_Cost_Multiplier)'
        # K: Labor_Cost_Pct = IF(OR(C="", C=0), "", J / C)
        f_labor_pct = f'=IF(OR(C{r_num}="", C{r_num}=0), "", J{r_num} / C{r_num})'
        # L: Target_Labor = CFG_Target_LaborCost
        f_target = '=CFG_Target_LaborCost'
        # M: Labor_Status = IF(K="","", IF(K>CFG_Target_LaborCost, "חורג 🔴", "תקין 🟢"))
        f_status = f'=IF(K{r_num}="","", IF(K{r_num}>CFG_Target_LaborCost, "חורג 🔴", "תקין 🟢"))'
        # N: SPLH = IF(OR(F="", F=0), "", C / F)
        f_splh = f'=IF(OR(F{r_num}="", F{r_num}=0), "", C{r_num} / F{r_num})'
        # O: Cost_Per_Hour = IF(OR(F="", F=0), "", J / F)
        f_cost_per_hour = f'=IF(OR(F{r_num}="", F{r_num}=0), "", J{r_num} / F{r_num})'

        month_cells.append([
            month_name, sales_inc, f_net_sales,
            srv_hours, prep_hours, f_total_hours,
            hourly_wages, salary_wages, f_total_gross,
            f_emp_cost, f_labor_pct, f_target,
            f_status, f_splh, f_cost_per_hour, notes
        ])

    r.append(write_block(sid, 1, 0, month_cells))

    # 4. Headers & Banding
    r.append(header(sid, 0, 16))
    r.append(header(sid, 17, 20))
    r.append(banding(sid, 30, 0, 16))
    r.append(banding(sid, 8, 17, 20))

    # 5. Formats - Monthly Table
    r.append(fmt(grid(sid, 1, 30, 0, 1), bold=True))
    r.append(fmt(grid(sid, 1, 30, 1, 3), number=CURRENCY, align="CENTER"))
    r.append(fmt(grid(sid, 1, 30, 3, 6), align="CENTER"))
    r.append(fmt(grid(sid, 1, 30, 6, 10), number=CURRENCY, align="CENTER"))
    r.append(fmt(grid(sid, 1, 30, 10, 12), number=PERCENT, align="CENTER", bold=True))
    r.append(fmt(grid(sid, 1, 30, 12, 13), align="CENTER", bold=True))
    r.append(fmt(grid(sid, 1, 30, 13, 15), number=CURRENCY, align="CENTER", bold=True, fg="#2B8A3E"))
    r.append(fmt(grid(sid, 1, 30, 15, 16), fg="#6C757D"))

    # 6. Formats - KPI Block
    r.append(fmt(grid(sid, 1, 8, 17, 18), bold=True))
    r.append(fmt(grid(sid, 1, 2, 18, 19), number=CURRENCY, align="CENTER", bold=True))
    r.append(fmt(grid(sid, 2, 3, 18, 19), number=NUMBER_FMT, align="CENTER", bold=True))
    r.append(fmt(grid(sid, 3, 4, 18, 19), number=CURRENCY, align="CENTER", bold=True))
    r.append(fmt(grid(sid, 4, 5, 18, 19), number=PERCENT, align="CENTER", bold=True, fg="#2B8A3E"))
    r.append(fmt(grid(sid, 5, 7, 18, 19), number=CURRENCY, align="CENTER", bold=True, fg="#2B8A3E"))
    r.append(fmt(grid(sid, 7, 8, 18, 19), number=NUMBER_FMT, align="CENTER", bold=True))
    r.append(fmt(grid(sid, 1, 8, 19, 20), fg="#6C757D"))

    # 7. Conditional Formatting
    # Labor Status badges
    r.append(cond_format(grid(sid, 1, 30, 12, 13), '=REGEXMATCH($M2,"חורג")', fg="#C92A2A", bg="#FFE3E3", bold=True))
    r.append(cond_format(grid(sid, 1, 30, 12, 13), '=REGEXMATCH($M2,"תקין")', fg="#2B8A3E", bg="#D3F9D8"))
    # Labor % highlight if > 20%
    r.append(cond_format(grid(sid, 1, 30, 10, 11), '=AND($K2>0, $K2>INDIRECT("CFG_Target_LaborCost"))', fg="#C92A2A", bg="#FFE3E3", bold=True))
    r.append(cond_format(grid(sid, 1, 30, 10, 11), '=AND($K2>0, $K2<=INDIRECT("CFG_Target_LaborCost"))', fg="#2B8A3E", bg="#D3F9D8"))

    # 8. Column widths
    col_widths = [
        130,  # A: Month
        140,  # B: Sales_Incl_VAT
        140,  # C: Net_Sales_Excl_VAT
        110,  # D: Service_Hours
        110,  # E: Prep_Hours
        110,  # F: Total_Hours
        140,  # G: Hourly_Wages_Gross
        140,  # H: Salaried_Gross
        140,  # I: Total_Gross_Wages
        140,  # J: Employer_Cost
        120,  # K: Labor_Cost_Pct
        110,  # L: Target_Labor
        120,  # M: Labor_Status
        130,  # N: SPLH
        130,  # O: Cost_Per_Hour
        240,  # P: Notes
        24,   # Q: Spacer
        220,  # R: KPI Name
        140,  # S: Value
        260,  # T: Benchmark
    ]
    r += widths(sid, col_widths)

    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    api = Sheets(NEW_SPREADSHEET_ID)

    # Prepare sheet
    sid = prepare_sheet(api, force=args.force)
    print(f"Prepared sheet {TAB_LABOR} (ID: {sid})")

    # Build and execute
    print(f"Writing {TAB_LABOR} (Monthly Architecture)...")
    reqs = build_monthly_labor_requests(sid)
    api.batch_update(reqs)

    print(f"SUCCESS: Module 4 ({TAB_LABOR}) monthly architecture successfully built!")
    print(f"Spreadsheet URL: https://docs.google.com/spreadsheets/d/{NEW_SPREADSHEET_ID}/edit")


if __name__ == "__main__":
    main()
