"""Module 6: Build 00_Dashboard in Kitchen OS v2.0."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (
    Sheets,
    NEW_SPREADSHEET_ID,
    HEADER_BG,
    HEADER_FG,
    BAND_1,
    BAND_2,
    FONT,
    color,
    grid,
    cell,
    write_block,
)

SHEET_TITLE = "00_Dashboard"

CARD_BG_TOP = "#F1F3F5"
CARD_BG_VAL = "#FFFFFF"
CARD_BG_SUB = "#F8F9FA"
BORDER_COLOR = color("#DEE2E6")

def run():
    s = Sheets(NEW_SPREADSHEET_ID)
    meta = s.get("sheets(properties(sheetId,title))")
    sheets_dict = {sh["properties"]["title"]: sh["properties"]["sheetId"] for sh in meta["sheets"]}

    reqs = []
    if SHEET_TITLE in sheets_dict:
        sheet_id = sheets_dict[SHEET_TITLE]
        # Move to index 0
        reqs.append({
            "updateSheetProperties": {
                "properties": {
                    "sheetId": sheet_id,
                    "index": 0,
                    "rightToLeft": True,
                    "tabColorStyle": {"rgbColor": color("#1E1E1E")},
                },
                "fields": "index,rightToLeft,tabColorStyle",
            }
        })
    else:
        add_res = s.batch_update([
            {
                "addSheet": {
                    "properties": {
                        "title": SHEET_TITLE,
                        "index": 0,
                        "tabColorStyle": {"rgbColor": color("#1E1E1E")},
                        "rightToLeft": True,
                        "gridProperties": {
                            "rowCount": 60,
                            "columnCount": 18,
                            "hideGridlines": True,
                        },
                    }
                }
            }
        ])
        sheet_id = add_res["replies"][0]["addSheet"]["properties"]["sheetId"]

    # 1. Column widths
    col_widths = {
        0: 25,   # A: Margin
        1: 180,  # B: Item / Dish
        2: 130,  # C: Category
        3: 140,  # D: Supplier / Cost
        4: 100,  # E: Stock / Price net
        5: 100,  # F: Par / Food Cost %
        6: 110,  # G: Order Qty / Profit
        7: 125,  # H: Stock Status / Dish Status
        8: 30,   # I: Separator
        9: 85,   # J: Task ID
        10: 250, # K: Task Name
        11: 110, # L: Area
        12: 100, # M: Assignee
        13: 130, # N: Priority
        14: 115, # O: Status
        15: 25,  # P: Margin
    }
    for col_idx, width in col_widths.items():
        reqs.append({
            "updateDimensionProperties": {
                "range": {
                    "sheetId": sheet_id,
                    "dimension": "COLUMNS",
                    "startIndex": col_idx,
                    "endIndex": col_idx + 1,
                },
                "properties": {"pixelSize": width},
                "fields": "pixelSize",
            }
        })

    # Row heights for cards and titles
    row_heights = {
        0: 42,  # Row 1: Title
        1: 26,  # Row 2: Subtitle
        2: 26,  # Row 3: Card Top
        3: 40,  # Row 4: Card Value
        4: 24,  # Row 5: Card Subtext
        5: 15,  # Row 6: Spacing
        6: 32,  # Row 7: Section Header
        7: 28,  # Row 8: Table Header
        18: 15, # Row 19: Spacing
        19: 32, # Row 20: Section Header Menu
        20: 28, # Row 21: Table Header Menu
    }
    for row_idx, height in row_heights.items():
        reqs.append({
            "updateDimensionProperties": {
                "range": {
                    "sheetId": sheet_id,
                    "dimension": "ROWS",
                    "startIndex": row_idx,
                    "endIndex": row_idx + 1,
                },
                "properties": {"pixelSize": height},
                "fields": "pixelSize",
            }
        })

    # 2. Merges
    merges = [
        # Row 1: Title (B1:O1 -> 0,1 to 1,15)
        grid(sheet_id, 0, 1, 1, 15),
        # Row 2: Subtitle (B2:O2 -> 1,2 to 1,15)
        grid(sheet_id, 1, 2, 1, 15),

        # Card 1: B3:C3, B4:C4, B5:C5
        grid(sheet_id, 2, 3, 1, 3),
        grid(sheet_id, 3, 4, 1, 3),
        grid(sheet_id, 4, 5, 1, 3),

        # Card 2: D3:E3, D4:E4, D5:E5
        grid(sheet_id, 2, 3, 3, 5),
        grid(sheet_id, 3, 4, 3, 5),
        grid(sheet_id, 4, 5, 3, 5),

        # Card 3: F3:G3, F4:G4, F5:G5
        grid(sheet_id, 2, 3, 5, 7),
        grid(sheet_id, 3, 4, 5, 7),
        grid(sheet_id, 4, 5, 5, 7),

        # Card 4: J3:K3, J4:K4, J5:K5
        grid(sheet_id, 2, 3, 9, 11),
        grid(sheet_id, 3, 4, 9, 11),
        grid(sheet_id, 4, 5, 9, 11),

        # Card 5: L3:M3, L4:M4, L5:M5
        grid(sheet_id, 2, 3, 11, 13),
        grid(sheet_id, 3, 4, 11, 13),
        grid(sheet_id, 4, 5, 11, 13),

        # Card 6: N3:O3, N4:O4, N5:O5
        grid(sheet_id, 2, 3, 13, 15),
        grid(sheet_id, 3, 4, 13, 15),
        grid(sheet_id, 4, 5, 13, 15),

        # Section Headers:
        # Left Table Section Banner (B7:H7 -> 6,7 to 1,8)
        grid(sheet_id, 6, 7, 1, 8),
        # Right Table Section Banner (J7:O7 -> 6,7 to 9,15)
        grid(sheet_id, 6, 7, 9, 15),
        # Menu Food Cost Section Banner (B20:H20 -> 19,20 to 1,8)
        grid(sheet_id, 19, 20, 1, 8),
    ]
    for m in merges:
        reqs.append({"mergeCells": {"range": m, "mergeType": "MERGE_ALL"}})

    # 3. Write Text & Formulas
    # Title & Subtitle
    title_text = "🍷 KITCHEN OS v2.0 — מרכז שליטה ובקרה תפעולי | יקב"
    subtitle_formula = '="לוח מחוונים תפעולי בזמן אמת | מעודכן ליום: " & TEXT(TODAY(), "DD/MM/YYYY")'
    reqs.append(write_block(sheet_id, 0, 1, [[title_text]]))
    reqs.append(write_block(sheet_id, 1, 1, [[subtitle_formula]]))

    # Card 1 (B3:C5)
    c1_top = "📦 שווי מלאי נוכחי"
    c1_val = "=SUM(OPS_Inventory_Orders!M2:M)"
    c1_sub = "מחושב לפי ספירה ומחיר ספק"
    reqs.append(write_block(sheet_id, 2, 1, [[c1_top]]))
    reqs.append(write_block(sheet_id, 3, 1, [[c1_val]]))
    reqs.append(write_block(sheet_id, 4, 1, [[c1_sub]]))

    # Card 2 (D3:E5)
    c2_top = "🚨 פריטים בחוסר להזמנה"
    c2_val = '=COUNTIF(OPS_Inventory_Orders!L2:L, "דחוף להזמין 🚨")'
    c2_sub = '="מתוכם " & COUNTIF(OPS_Inventory_Orders!L2:L, "מתקרב למינימום ⚠️") & " התראת מינימום"'
    reqs.append(write_block(sheet_id, 2, 3, [[c2_top]]))
    reqs.append(write_block(sheet_id, 3, 3, [[c2_val]]))
    reqs.append(write_block(sheet_id, 4, 3, [[c2_sub]]))

    # Card 3 (F3:G5)
    c3_top = "👥 לייבור שנתי משוקלל"
    c3_val = "=OPS_Labor_Tracker!S5"
    c3_sub = '=IF(OPS_Labor_Tracker!S5<=CFG_Target_LaborCost, "✅ עומד ביעד (עד " & TEXT(CFG_Target_LaborCost, "0%") & ")", "🔴 חריגה מיעד הלייבור")'
    reqs.append(write_block(sheet_id, 2, 5, [[c3_top]]))
    reqs.append(write_block(sheet_id, 3, 5, [[c3_val]]))
    reqs.append(write_block(sheet_id, 4, 5, [[c3_sub]]))

    # Card 4 (J3:K5)
    c4_top = "🍽️ פוד-קוסט ממוצע תפריט"
    c4_val = '=AVERAGEIFS(OPS_Recipes_FoodCost!H2:H, OPS_Recipes_FoodCost!H2:H, ">0", OPS_Recipes_FoodCost!B2:B, "<>מתכוני הכנה")'
    c4_sub = '=IF(AVERAGEIFS(OPS_Recipes_FoodCost!H2:H, OPS_Recipes_FoodCost!H2:H, ">0", OPS_Recipes_FoodCost!B2:B, "<>מתכוני הכנה")<=CFG_Target_FoodCost, "✅ עומד ביעד (עד " & TEXT(CFG_Target_FoodCost, "0%") & ")", "🔴 חריגה מיעד עלות מזון")'
    reqs.append(write_block(sheet_id, 2, 9, [[c4_top]]))
    reqs.append(write_block(sheet_id, 3, 9, [[c4_val]]))
    reqs.append(write_block(sheet_id, 4, 9, [[c4_sub]]))

    # Card 5 (L3:M5)
    c5_top = "🗑️ סך פחת מצטבר"
    c5_val = "=SUM(LOG_Waste!H2:H)"
    c5_sub = '="מתוך " & COUNTA(LOG_Waste!A2:A) & " דיווחי פחת רשומים"'
    reqs.append(write_block(sheet_id, 2, 11, [[c5_top]]))
    reqs.append(write_block(sheet_id, 3, 11, [[c5_val]]))
    reqs.append(write_block(sheet_id, 4, 11, [[c5_sub]]))

    # Card 6 (N3:O5)
    c6_top = "🔥 משימות דחופות לסרוויס"
    c6_val = '=COUNTIFS(OPS_Kitchen_Tasks!E2:E, "🔥 דחוף לסרוויס", OPS_Kitchen_Tasks!H2:H, "<>✅ הושלם")'
    c6_sub = '="מתוך " & COUNTIF(OPS_Kitchen_Tasks!H2:H, "<>✅ הושלם") & " משימות פעילות"'
    reqs.append(write_block(sheet_id, 2, 13, [[c6_top]]))
    reqs.append(write_block(sheet_id, 3, 13, [[c6_val]]))
    reqs.append(write_block(sheet_id, 4, 13, [[c6_sub]]))

    # Section Headers (Row 7)
    sec_left_title = "🚨 התראות מלאי ופריטים בחוסר להזמנה דחופה (Stock Alert Feed)"
    sec_right_title = "⚡ מוקד משימות דחופות לסרוויס ותפעול (Urgent Action Center)"
    reqs.append(write_block(sheet_id, 6, 1, [[sec_left_title]]))
    reqs.append(write_block(sheet_id, 6, 9, [[sec_right_title]]))

    # Table Column Headers (Row 8)
    t_left_headers = ["שם חומר גלם", "קטגוריה", "ספק ראשי", "מלאי נוכחי", "תקן Par", "כמות להזמנה", "סטטוס מלאי"]
    t_right_headers = ["מזהה", "תיאור משימה דחופה", "תחום / פס", "אחראי", "עדיפות", "סטטוס"]
    reqs.append(write_block(sheet_id, 7, 1, [t_left_headers]))
    reqs.append(write_block(sheet_id, 7, 9, [t_right_headers]))

    # Spill Formulas (Row 9)
    f_stock_feed = '=IFERROR(FILTER(HSTACK(OPS_Inventory_Orders!B2:D, OPS_Inventory_Orders!H2:H, OPS_Inventory_Orders!I2:I, OPS_Inventory_Orders!K2:L), (OPS_Inventory_Orders!L2:L="דחוף להזמין 🚨") + (OPS_Inventory_Orders!L2:L="מתקרב למינימום ⚠️")), {"אין פריטים בחוסר מלאי כרגע ✅", "", "", "", "", "", ""})'
    f_tasks_feed = '=IFERROR(FILTER(HSTACK(OPS_Kitchen_Tasks!A2:E, OPS_Kitchen_Tasks!H2:H), (OPS_Kitchen_Tasks!H2:H<>"✅ הושלם") * ((OPS_Kitchen_Tasks!E2:E="🔥 דחוף לסרוויס") + (OPS_Kitchen_Tasks!E2:E="⚡ דחוף"))), {"אין משימות דחופות כרגע ✅", "", "", "", "", ""})'
    reqs.append(write_block(sheet_id, 8, 1, [[f_stock_feed]]))
    reqs.append(write_block(sheet_id, 8, 9, [[f_tasks_feed]]))

    # Menu Food Cost Section Banner (Row 20)
    sec_menu_title = "📊 מנות תפריט לבקרת רווחיות ופוד-קוסט (Menu Food Cost Watchlist > 30%)"
    reqs.append(write_block(sheet_id, 19, 1, [[sec_menu_title]]))

    # Menu Table Headers (Row 21)
    t_menu_headers = ["שם מנה / מתכון", "קטגוריית תפריט", "עלות למנה ₪", "מחיר נטו (ללא מע\"מ)", "פוד קוסט %", "רווח גולמי למנה ₪", "סטטוס"]
    reqs.append(write_block(sheet_id, 20, 1, [t_menu_headers]))

    # Menu Food Cost Spill Formula (Row 22)
    f_menu_feed = '=IFERROR(FILTER(HSTACK(OPS_Recipes_FoodCost!A2:B, OPS_Recipes_FoodCost!E2:E, OPS_Recipes_FoodCost!G2:J), (OPS_Recipes_FoodCost!B2:B<>"מתכוני הכנה") * (OPS_Recipes_FoodCost!H2:H > CFG_Target_FoodCost)), {"כל מנות התפריט עומדות ביעד הפוד-קוסט בהצלחה! 🟢", "", "", "", "", "", ""})'
    reqs.append(write_block(sheet_id, 21, 1, [[f_menu_feed]]))

    # 4. STYLING & FORMATTING

    # Title styling (B1:O1)
    reqs.append({
        "repeatCell": {
            "range": grid(sheet_id, 0, 1, 1, 15),
            "cell": {
                "userEnteredFormat": {
                    "backgroundColor": color(HEADER_BG),
                    "textFormat": {"foregroundColor": color(HEADER_FG), "bold": True, "fontFamily": FONT, "fontSize": 15},
                    "horizontalAlignment": "CENTER",
                    "verticalAlignment": "MIDDLE",
                }
            },
            "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
        }
    })

    # Subtitle styling (B2:O2)
    reqs.append({
        "repeatCell": {
            "range": grid(sheet_id, 1, 2, 1, 15),
            "cell": {
                "userEnteredFormat": {
                    "backgroundColor": color("#2B2D42"),
                    "textFormat": {"foregroundColor": color("#E0E0E0"), "fontFamily": FONT, "fontSize": 10},
                    "horizontalAlignment": "CENTER",
                    "verticalAlignment": "MIDDLE",
                }
            },
            "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
        }
    })

    # Card Ranges: [(c1, c2)]
    card_cols = [(1, 3), (3, 5), (5, 7), (9, 11), (11, 13), (13, 15)]

    for c1, c2 in card_cols:
        # Card Header (Row 3)
        reqs.append({
            "repeatCell": {
                "range": grid(sheet_id, 2, 3, c1, c2),
                "cell": {
                    "userEnteredFormat": {
                        "backgroundColor": color(CARD_BG_TOP),
                        "textFormat": {"foregroundColor": color("#495057"), "bold": True, "fontFamily": FONT, "fontSize": 10},
                        "horizontalAlignment": "CENTER",
                        "verticalAlignment": "MIDDLE",
                    }
                },
                "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
            }
        })
        # Card Value (Row 4)
        reqs.append({
            "repeatCell": {
                "range": grid(sheet_id, 3, 4, c1, c2),
                "cell": {
                    "userEnteredFormat": {
                        "backgroundColor": color(CARD_BG_VAL),
                        "textFormat": {"foregroundColor": color("#1E1E1E"), "bold": True, "fontFamily": FONT, "fontSize": 18},
                        "horizontalAlignment": "CENTER",
                        "verticalAlignment": "MIDDLE",
                    }
                },
                "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
            }
        })
        # Card Subtext (Row 5)
        reqs.append({
            "repeatCell": {
                "range": grid(sheet_id, 4, 5, c1, c2),
                "cell": {
                    "userEnteredFormat": {
                        "backgroundColor": color(CARD_BG_SUB),
                        "textFormat": {"foregroundColor": color("#6C757D"), "fontFamily": FONT, "fontSize": 9},
                        "horizontalAlignment": "CENTER",
                        "verticalAlignment": "MIDDLE",
                    }
                },
                "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
            }
        })
        # Border around the whole card (B3:C5, etc.)
        reqs.append({
            "updateBorders": {
                "range": grid(sheet_id, 2, 5, c1, c2),
                "top": {"style": "SOLID", "color": BORDER_COLOR},
                "bottom": {"style": "SOLID", "color": BORDER_COLOR},
                "left": {"style": "SOLID", "color": BORDER_COLOR},
                "right": {"style": "SOLID", "color": BORDER_COLOR},
                "innerHorizontal": {"style": "SOLID", "color": BORDER_COLOR},
            }
        })

    # Specific Number Formats for Card Values
    # Card 1 (B4): Currency
    reqs.append({
        "repeatCell": {
            "range": grid(sheet_id, 3, 4, 1, 3),
            "cell": {"userEnteredFormat": {"numberFormat": {"type": "CURRENCY", "pattern": "₪#,##0"}}},
            "fields": "userEnteredFormat(numberFormat)",
        }
    })
    # Card 2 (D4): Number
    reqs.append({
        "repeatCell": {
            "range": grid(sheet_id, 3, 4, 3, 5),
            "cell": {"userEnteredFormat": {"numberFormat": {"type": "NUMBER", "pattern": "#,##0"}}},
            "fields": "userEnteredFormat(numberFormat)",
        }
    })
    # Card 3 (F4): Percent
    reqs.append({
        "repeatCell": {
            "range": grid(sheet_id, 3, 4, 5, 7),
            "cell": {"userEnteredFormat": {"numberFormat": {"type": "PERCENT", "pattern": "0.0%"}}},
            "fields": "userEnteredFormat(numberFormat)",
        }
    })
    # Card 4 (J4): Percent
    reqs.append({
        "repeatCell": {
            "range": grid(sheet_id, 3, 4, 9, 11),
            "cell": {"userEnteredFormat": {"numberFormat": {"type": "PERCENT", "pattern": "0.0%"}}},
            "fields": "userEnteredFormat(numberFormat)",
        }
    })
    # Card 5 (L4): Currency
    reqs.append({
        "repeatCell": {
            "range": grid(sheet_id, 3, 4, 11, 13),
            "cell": {"userEnteredFormat": {"numberFormat": {"type": "CURRENCY", "pattern": "₪#,##0"}}},
            "fields": "userEnteredFormat(numberFormat)",
        }
    })
    # Card 6 (N4): Number
    reqs.append({
        "repeatCell": {
            "range": grid(sheet_id, 3, 4, 13, 15),
            "cell": {"userEnteredFormat": {"numberFormat": {"type": "NUMBER", "pattern": "#,##0"}}},
            "fields": "userEnteredFormat(numberFormat)",
        }
    })

    # Section Headers (Row 7 & Row 20)
    for r_start, c_start, c_end in [(6, 1, 8), (6, 9, 15), (19, 1, 8)]:
        reqs.append({
            "repeatCell": {
                "range": grid(sheet_id, r_start, r_start + 1, c_start, c_end),
                "cell": {
                    "userEnteredFormat": {
                        "backgroundColor": color(HEADER_BG),
                        "textFormat": {"foregroundColor": color(HEADER_FG), "bold": True, "fontFamily": FONT, "fontSize": 10},
                        "horizontalAlignment": "CENTER",
                        "verticalAlignment": "MIDDLE",
                    }
                },
                "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
            }
        })

    # Table Column Headers (Row 8 & Row 21)
    for r_start, c_start, c_end in [(7, 1, 8), (7, 9, 15), (20, 1, 8)]:
        reqs.append({
            "repeatCell": {
                "range": grid(sheet_id, r_start, r_start + 1, c_start, c_end),
                "cell": {
                    "userEnteredFormat": {
                        "backgroundColor": color("#2B2D42"),
                        "textFormat": {"foregroundColor": color(HEADER_FG), "bold": True, "fontFamily": FONT, "fontSize": 9},
                        "horizontalAlignment": "CENTER",
                        "verticalAlignment": "MIDDLE",
                    }
                },
                "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
            }
        })

    # Data font & vertical alignment for table bodies
    for r1, r2, c1, c2 in [(8, 18, 1, 8), (8, 18, 9, 15), (21, 30, 1, 8)]:
        reqs.append({
            "repeatCell": {
                "range": grid(sheet_id, r1, r2, c1, c2),
                "cell": {
                    "userEnteredFormat": {
                        "textFormat": {"fontFamily": FONT, "fontSize": 10},
                        "verticalAlignment": "MIDDLE",
                    }
                },
                "fields": "userEnteredFormat(textFormat,verticalAlignment)",
            }
        })

    # Center alignments in table columns
    # Left table center: Category (C), Stock (E), Par (F), Order (G), Status (H)
    for c in [2, 4, 5, 6, 7]:
        reqs.append({
            "repeatCell": {
                "range": grid(sheet_id, 8, 18, c, c + 1),
                "cell": {"userEnteredFormat": {"horizontalAlignment": "CENTER"}},
                "fields": "userEnteredFormat(horizontalAlignment)",
            }
        })
    # Right table center: ID (J), Area (L), Assignee (M), Priority (N), Status (O)
    for c in [9, 11, 12, 13, 14]:
        reqs.append({
            "repeatCell": {
                "range": grid(sheet_id, 8, 18, c, c + 1),
                "cell": {"userEnteredFormat": {"horizontalAlignment": "CENTER"}},
                "fields": "userEnteredFormat(horizontalAlignment)",
            }
        })
    # Menu table center: Category (C), Food cost % (F), Status (H)
    for c in [2, 5, 7]:
        reqs.append({
            "repeatCell": {
                "range": grid(sheet_id, 21, 30, c, c + 1),
                "cell": {"userEnteredFormat": {"horizontalAlignment": "CENTER"}},
                "fields": "userEnteredFormat(horizontalAlignment)",
            }
        })
    # Menu table currency: Cost (D), Price (E), Gross profit (G)
    for c in [3, 4, 6]:
        reqs.append({
            "repeatCell": {
                "range": grid(sheet_id, 21, 30, c, c + 1),
                "cell": {
                    "userEnteredFormat": {
                        "horizontalAlignment": "RIGHT",
                        "numberFormat": {"type": "CURRENCY", "pattern": "₪#,##0.00"},
                    }
                },
                "fields": "userEnteredFormat(horizontalAlignment,numberFormat)",
            }
        })
    # Menu table percent: Food cost % (F)
    reqs.append({
        "repeatCell": {
            "range": grid(sheet_id, 21, 30, 5, 6),
            "cell": {
                "userEnteredFormat": {
                    "numberFormat": {"type": "PERCENT", "pattern": "0.0%"},
                }
            },
            "fields": "userEnteredFormat(numberFormat)",
        }
    })

    print(f"Sending {len(reqs)} requests to batchUpdate for {SHEET_TITLE}...")
    s.batch_update(reqs)
    print(f"Successfully created and styled {SHEET_TITLE}!")


if __name__ == "__main__":
    run()
