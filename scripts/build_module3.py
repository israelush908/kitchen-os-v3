"""Kitchen OS v2.0 - Module 3: OPS_Recipes_FoodCost.

Builds the two-tier recipe and food cost management sheet:
  1. Table A (Cols A to L): Menu Dishes, Pricing, Food Cost % & BCG Menu Engineering Matrix
  2. Table B (Cols N to S): Recipe Ingredients Breakdown (supporting raw items & sub-recipes)

Usage:
    python build_module3.py            # builds and migrates recipes
    python build_module3.py --force    # forces clean rebuild
"""
import argparse
import sys

from common import (BAND_1, BAND_2, FONT, HEADER_BG, HEADER_FG, MUTED_TEXT, NEW_SPREADSHEET_ID,
                    Sheets, color, grid, write_block)
from migrate_recipes import extract_recipes_and_dishes

TAB_RECIPES = "OPS_Recipes_FoodCost"
TAB_OPS = "#2B8A3E"  # Emerald green for Ops

CURRENCY = {"type": "CURRENCY", "pattern": '"₪"#,##0.00'}
PERCENT = {"type": "PERCENT", "pattern": "0.0%"}
NUMBER_FMT = {"type": "NUMBER", "pattern": "#,##0.##"}

HEADERS_TABLE_A = [
    "שם מנה / מתכון (Dish_Name)",
    "קטגוריית תפריט (Category)",
    "תפוקה במנות / ליטר (Yield_Portions)",
    "עלות כוללת ₪ (Total_Cost)",
    "עלות למנה ₪ (Cost_Per_Portion)",
    "מחיר כולל מע\"מ (Price_Incl_VAT)",
    "מחיר ללא מע\"מ (Price_Excl_VAT)",
    "פוד קוסט בפועל % (Food_Cost_Pct)",
    "רווח גולמי למנה ₪ (Gross_Profit)",
    "סטטוס פוד קוסט (Cost_Status)",
    "סיווג הנדסת תפריט (Menu_Matrix)",
    "מכירות שבועיות (Weekly_Sales)",
]

HEADERS_TABLE_B = [
    "מנה / מתכון אב (Parent_Dish)",
    "רכיב (חומר גלם או רוטב) (Ingredient_Name)",
    "כמות לרכיב (Quantity)",
    "יחידת מידה (Stock_Unit)",
    "עלות שורה ₪ (Line_Cost)",
    "אופן הכנה / דגשים (Prep_Notes)",
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

    if TAB_RECIPES not in sheets:
        api.batch_update([{"addSheet": {"properties": {"title": TAB_RECIPES}}}])
        meta = api.get("sheets(properties(sheetId,title),bandedRanges(bandedRangeId),conditionalFormats)")
        sheets = {s["properties"]["title"]: s for s in meta.get("sheets", [])}

    s = sheets[TAB_RECIPES]
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
                    "rowCount": 500,
                    "columnCount": 20,
                },
            },
            "fields": "rightToLeft,tabColorStyle,gridProperties(frozenRowCount,frozenColumnCount,hideGridlines,rowCount,columnCount)",
        }
    })
    api.batch_update(reqs)
    return sid


def build_module3_requests(sid, dishes, recipe_lines):
    r = [base_font(sid)]

    # 1. Write Headers: Table A (Cols A to L, 0 to 11) & Table B (Cols N to S, 13 to 18)
    r.append(write_block(sid, 0, 0, [HEADERS_TABLE_A]))
    r.append(write_block(sid, 0, 13, [HEADERS_TABLE_B]))

    # 2. Write Table A Dishes (Rows 2 to N)
    dish_cells = []
    num_dishes = max(len(dishes), 30)
    for row_idx in range(num_dishes):
        r_num = row_idx + 2
        d = dishes[row_idx] if row_idx < len(dishes) else None
        name = d["name"] if d else ""
        cat = d["category"] if d else ""
        yld = d["yield"] if d else 1
        price = d["price_inc_vat"] if d else ""
        sales = d["sales_qty"] if d else ""

        # Formulas for this row
        # D: Total_Cost = SUMIF(N$2:N, A{r_num}, R$2:R)
        f_cost = f'=IF(A{r_num}="","", IFERROR(SUMIF(N$2:N, A{r_num}, R$2:R), 0))'
        # E: Cost_Per_Portion = D / C
        f_portion_cost = f'=IF(D{r_num}="","", IF(C{r_num}>0, D{r_num} / C{r_num}, D{r_num}))'
        # G: Price_Excl_VAT = F / (1 + CFG_VAT)
        f_ex_vat = f'=IF(F{r_num}="","", IF(F{r_num}>0, F{r_num} / (1 + CFG_VAT), 0))'
        # H: Food_Cost_Pct = E / G
        f_fc = f'=IF(G{r_num}="","", IF(G{r_num}>0, E{r_num} / G{r_num}, 0))'
        # I: Gross_Profit = G - E
        f_profit = f'=IF(G{r_num}="","", IF(G{r_num}>0, G{r_num} - E{r_num}, 0))'
        # J: Cost_Status = IF(F=0,"מתכון הכנה ⚪", IF(H>CFG_Target_FoodCost,"חורג 🔴","תקין 🟢"))
        f_status = f'=IF(A{r_num}="","", IF(F{r_num}=0, "מתכון הכנה ⚪", IF(H{r_num}>CFG_Target_FoodCost, "חורג 🔴", "תקין 🟢")))'
        # K: Menu_Matrix = BCG Matrix
        f_matrix = (
            f'=IF(OR(A{r_num}="", F{r_num}="", F{r_num}=0), "", '
            f'LET(p, I{r_num}, s, IF(ISNUMBER(L{r_num}), L{r_num}, 50), '
            f'avg_p, IFERROR(AVERAGEIF($F$2:$F$35, ">0", $I$2:$I$35), 30), '
            f'avg_s, IFERROR(AVERAGEIF($F$2:$F$35, ">0", $L$2:$L$35), 50), '
            f'IF(AND(p>=avg_p, s>=avg_s), "כוכב ⭐", '
            f'IF(AND(p<avg_p, s>=avg_s), "סוס עבודה 🐴", '
            f'IF(AND(p>=avg_p, s<avg_s), "חידה 🧩", "כלב 🐕")))))'
        )

        dish_cells.append([
            name, cat, yld,
            f_cost, f_portion_cost, price,
            f_ex_vat, f_fc, f_profit,
            f_status, f_matrix, sales
        ])

    r.append(write_block(sid, 1, 0, dish_cells))

    # 3. Write Table B Recipe Lines (Rows 2 to M)
    num_lines = max(len(recipe_lines), 60)
    line_cells = []
    for line_idx in range(num_lines):
        r_num = line_idx + 2
        line = recipe_lines[line_idx] if line_idx < len(recipe_lines) else None
        parent = line["parent"] if line else ""
        ing = line["ingredient"] if line else ""
        qty = line["qty"] if line else ""
        notes = line["notes"] if line else ""

        # Formulas for Table B:
        # Q: Unit = lookup from DB_Catalog, else lookup from Table A (Sub-recipe)
        f_unit = f'=IF(O{r_num}="","", IFERROR(XLOOKUP(O{r_num}, DB_Catalog!$B$2:$B, DB_Catalog!$E$2:$E), IFERROR(XLOOKUP(O{r_num}, $A$2:$A, "מנה", ""), "")))'
        # R: Line_Cost = Qty * Effective_Cost (from DB_Catalog) OR Cost_Per_Portion (from Table A)
        f_line_cost = (
            f'=IF(OR(O{r_num}="", P{r_num}=""), "", '
            f'P{r_num} * IFERROR(XLOOKUP(O{r_num}, DB_Catalog!$B$2:$B, DB_Catalog!$H$2:$H), '
            f'IFERROR(XLOOKUP(O{r_num}, $A$2:$A, $E$2:$E, 0), 0)))'
        )

        line_cells.append([parent, ing, qty, f_unit, f_line_cost, notes])

    r.append(write_block(sid, 1, 13, line_cells))

    # 4. Headers & Bandings
    r.append(header(sid, 0, 12))
    r.append(header(sid, 13, 19))
    r.append(banding(sid, 50, 0, 12))
    r.append(banding(sid, 150, 13, 19))

    # 5. Formats - Table A
    r.append(fmt(grid(sid, 1, 50, 0, 1), bold=True))
    r.append(fmt(grid(sid, 1, 50, 1, 3), align="CENTER"))
    r.append(fmt(grid(sid, 1, 50, 3, 5), number=CURRENCY, align="CENTER"))
    r.append(fmt(grid(sid, 1, 50, 5, 7), number=CURRENCY, align="CENTER", bold=True))
    r.append(fmt(grid(sid, 1, 50, 7, 8), number=PERCENT, align="CENTER", bold=True))
    r.append(fmt(grid(sid, 1, 50, 8, 9), number=CURRENCY, align="CENTER", bold=True, fg="#2B8A3E"))
    r.append(fmt(grid(sid, 1, 50, 9, 11), align="CENTER", bold=True))
    r.append(fmt(grid(sid, 1, 50, 11, 12), align="CENTER"))

    # 6. Formats - Table B
    r.append(fmt(grid(sid, 1, 150, 13, 15), bold=True))
    r.append(fmt(grid(sid, 1, 150, 15, 17), align="CENTER"))
    r.append(fmt(grid(sid, 1, 150, 17, 18), number=CURRENCY, align="CENTER", bold=True))
    r.append(fmt(grid(sid, 1, 150, 18, 19), fg="#6C757D"))

    # 7. Conditional Formatting - Table A
    r.append(cond_format(grid(sid, 1, 50, 7, 8), '=AND($F2>0, $H2>INDIRECT("CFG_Target_FoodCost"))', fg="#C92A2A", bg="#FFE3E3", bold=True))
    r.append(cond_format(grid(sid, 1, 50, 7, 8), '=AND($F2>0, $H2<=INDIRECT("CFG_Target_FoodCost"))', fg="#2B8A3E", bg="#D3F9D8"))
    r.append(cond_format(grid(sid, 1, 50, 9, 10), '=REGEXMATCH($J2,"חורג")', fg="#C92A2A", bg="#FFE3E3", bold=True))
    r.append(cond_format(grid(sid, 1, 50, 9, 10), '=REGEXMATCH($J2,"תקין")', fg="#2B8A3E", bg="#D3F9D8"))

    # 8. Validations
    r.append(validation(grid(sid, 1, 150, 13, 14), "ONE_OF_RANGE", ["=$A$2:$A$35"]))

    # 9. Widths
    col_widths = [
        160,  # A: Dish_Name
        140,  # B: Category
        120,  # C: Yield_Portions
        120,  # D: Total_Cost
        120,  # E: Cost_Per_Portion
        130,  # F: Price_Incl_VAT
        130,  # G: Price_Excl_VAT
        120,  # H: Food_Cost_Pct
        120,  # I: Gross_Profit
        130,  # J: Cost_Status
        130,  # K: Menu_Matrix
        110,  # L: Weekly_Sales
        24,   # M: Spacer
        150,  # N: Parent_Dish
        170,  # O: Ingredient_Name
        95,   # P: Quantity
        100,  # Q: Stock_Unit
        120,  # R: Line_Cost
        240,  # S: Prep_Notes
    ]
    r += widths(sid, col_widths)

    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    api = Sheets(NEW_SPREADSHEET_ID)

    # 1. Extract recipes and dishes from legacy sheet
    dishes, recipe_lines = extract_recipes_and_dishes()
    print(f"Extracted {len(dishes)} dishes and {len(recipe_lines)} recipe line items.")

    # 2. Prepare target sheet
    sid = prepare_sheet(api, force=args.force)
    print(f"Prepared sheet {TAB_RECIPES} (ID: {sid})")

    # 3. Build & update
    print("Writing OPS_Recipes_FoodCost...")
    reqs = build_module3_requests(sid, dishes, recipe_lines)
    api.batch_update(reqs)

    print(f"SUCCESS: Module 3 successfully built!")
    print(f"Spreadsheet URL: https://docs.google.com/spreadsheets/d/{NEW_SPREADSHEET_ID}/edit")


if __name__ == "__main__":
    main()
