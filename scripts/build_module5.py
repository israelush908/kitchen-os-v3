"""Module 5: Build OPS_Kitchen_Tasks in Kitchen OS v2.0."""
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

SHEET_TITLE = "OPS_Kitchen_Tasks"

TABLE1_HEADERS = [
    "מזהה (ID)",
    "תיאור משימה (Task)",
    "תחום / פס (Area)",
    "אחראי (Assignee)",
    "עדיפות (Priority)",
    "תדירות (Frequency)",
    "תאריך יעד (Due_Date)",
    "סטטוס (Status)",
    "הערות ודגשים (Notes)",
]

TABLE2_HEADERS = [
    "פס / תחנה (Station)",
    "הכנה / צ'קליסט (Prep_Item)",
    "תדירות (Frequency)",
    "זמן משוער (דק׳)",
    "בוצע היום (Done)",
    "דגשים והנחיות (Instructions)",
]

# Legacy tasks migrated from A1
TASKS_DATA = [
    ("TSK-01", "לבנות צ׳קליסט לסגירת אירוע", "מטבח", "ישראל", "🔥 דחוף לסרוויס", "חד-פעמי", "2026-11-01", "⏳ לביצוע", "כולל הזנת פריטים שיצאו לאירוע"),
    ("TSK-02", "טסט למנה ספיישל יין", "מטבח", "ישראל", "🔥 דחוף לסרוויס", "חד-פעמי", "2026-10-30", "🔄 בתהליך", "טעימה ובדיקת פוד-קוסט מקדים"),
    ("TSK-03", "שינוי פלטת גבינות והתאמת הרכב", "מטבח", "ישראל", "⚡ דחוף", "חד-פעמי", "2026-11-05", "🔄 בתהליך", "עדכון כמויות לפי B2 וספק מחלבה"),
    ("TSK-04", "לדבר עם מאיה על תפריט קינוחים", "מטבח", "ישראל", "⚡ דחוף", "חד-פעמי", "2026-10-28", "🔄 בתהליך", "התאמת קינוחי ביסקוטי לאירועים"),
    ("TSK-05", "אזור קליטת ספקים מקורה לחורף", "תחזוקה", "ישראל", "⚡ דחוף", "חד-פעמי", "2026-11-15", "⏳ לביצוע", "התקנת קירוי ומדפי קליטה"),
    ("TSK-06", "להסיר מדבקות יינות", "תפעול", "ישראל", "⚡ דחוף", "חד-פעמי", "2026-10-29", "🔄 בתהליך", "עבודה מול צוות פלור"),
    ("TSK-07", "לשנות קינוחים שמתאימים לאירועים", "אירועים", "ישראל", "⏳ שגרתי", "חד-פעמי", "2026-11-10", "⏳ לביצוע", "מנות אישיות וקלות להגשה"),
    ("TSK-08", "להתאים פירות לאירועי בופה", "אירועים", "ישראל", "⏳ שגרתי", "חד-פעמי", "2026-11-10", "⏳ לביצוע", "פרזנטציה לפי עונות השנה"),
    ("TSK-09", "מכלים למטבלים – אירועים קטנים", "אירועים", "ישראל", "⏳ שגרתי", "חד-פעמי", "2026-11-12", "⏳ לביצוע", "רכישת כלי הגשה ייעודיים"),
    ("TSK-10", "סלסלאות לחם – אירועים קטנים", "אירועים", "ישראל", "⏳ שגרתי", "חד-פעמי", "2026-11-12", "⏳ לביצוע", "חידוש מלאי סלסלות שאשא"),
    ("TSK-11", "צ׳קליסט מלצרים ספירת יינות פתוחים", "תפעול", "ישראל", "⏳ שגרתי", "שבועי", "", "⏳ לביצוע", "בקרת פחת יינות כוסות"),
    ("TSK-12", "לדבר עם סטפן לגביי קרטונים חלקים", "תפעול", "ישראל", "💤 פחות דחוף", "חד-פעמי", "2026-11-20", "⏳ לביצוע", "אריזות משלוחים ומארזים"),
    ("TSK-13", "להוסיף נקיונות שולחנות מרכז מבקרים", "תחזוקה", "ישראל", "💤 פחות דחוף", "שבועי", "", "⏳ לביצוע", "אחת לשבועיים יסודי"),
    ("TSK-14", "להקים מערכת לחישוב תמחור אירועים", "מטבח", "ישראל", "💤 פחות דחוף", "חד-פעמי", "2026-12-01", "⏸️ ממתין", "סנכרון מול מחירון מנות"),
    ("TSK-15", "בדיקת אחריות ותפקידים מנהל פלור", "כ\"א", "ישראל", "💤 פחות דחוף", "חד-פעמי", "2026-11-30", "⏳ לביצוע", "ספירות, משמרות, הדרכות"),
    ("TSK-16", "לחקור נושא בניית צוות ומדרגות שכר", "כ\"א", "ישראל", "💤 פחות דחוף", "חד-פעמי", "2026-12-15", "⏳ לביצוע", "שיפור יעילות ושמירת עובדים"),
    ("TSK-17", "פריטים נפרדים למסלול טעימות", "תפעול", "ישראל", "💤 פחות דחוף", "חד-פעמי", "2026-11-25", "⏳ לביצוע", "הפרדת כלים וסימון"),
    ("TSK-18", "לבנות שולחנות תפעוליים", "תפעול", "גלעד", "💤 פחות דחוף", "חד-פעמי", "2026-12-10", "⏳ לביצוע", "עמדת הכנה צדדית"),
    ("TSK-19", "קלאב קאר – סוויץ' וטיפול תקופתי", "תחזוקה", "ישראל", "💤 פחות דחוף", "חד-פעמי", "2026-11-20", "⏸️ ממתין", "ממתין להגעת חלקי חילוף"),
    ("TSK-20", "אזור קבלת ספקים – להסדיר משטח", "תפעול", "ישראל", "💤 פחות דחוף", "חד-פעמי", "2026-11-25", "⏸️ ממתין", "בדיקת משטחי פריקה בטוחים"),
]

# Legacy prep items and checklists from A4 & A3
PREP_DATA = [
    ("פלטות וגבינות", "מילוי קופסאות פלטה (גאודה, מנצ'גו, קממבר)", "יומי", 20, False, "חיתוך מדויק ושקילה לפי B2"),
    ("פלטות וגבינות", "סידור מגשי ענבים ופירות עונתיים", "יומי", 15, False, "שטיפה, ייבוש וחלוקה לקופסאות"),
    ("סלטים וברוסקטות", "גריסת פקאנים מסוכרים", "יומי", 15, False, "שמירה בכלי אטום ויבש"),
    ("סלטים וברוסקטות", "הכנת רטבים (קיסר, ויניגרט, טחינה, עגבניות)", "שבועי", 45, False, "לפי מתכוני הכנה ב-OPS_Recipes"),
    ("סלטים וברוסקטות", "חיתוך ירקות רעננים (עגבניות שרי, מלפפון, בצל)", "יומי", 25, False, "קופסאות קמברו מסומנות עם תאריך"),
    ("לחמים ומאפים", "פריסת לחמי מחמצת ופוקאצ'ות", "יומי", 15, False, "שמירה בשקיות בד לסרוויס"),
    ("לחמים ומאפים", "אפיית קרקרים וטוסטונים", "שבועי", 30, False, "לפי צפי סופי שבוע ואירועים"),
    ("קינוחים", "הפשרת קינוחים וביסקוטי", "יומי", 5, False, "לפי תחזית הזמנות מטאביט"),
    ("קינוחים", "מילוי רטבי פירות יער ושוקולד", "שבועי", 20, False, "בקבוקים לחיצים נקיים"),
    ("תפעול וניקיון", "ריכוך מים למכונת קפה", "יומי", 5, False, "בדיקת מלח ורמת לחץ"),
    ("תפעול וניקיון", "ריכוך מים למדיח כלים", "יומי", 5, False, "בדיקת רמת סבון ומבריק"),
    ("תפעול וניקיון", "ניקוי וחיטוי סלייסר (מכונת חיתוך)", "יומי", 10, False, "פירוק להב וחיטוי מלא באלכוהול"),
    ("תפעול וניקיון", "מפוח אוויר מקררים ומעבים", "שבועי", 15, False, "שאיבת אבק ממנועים ופילטרים"),
    ("תפעול וניקיון", "ספירת כלים, סכו\"ם וכוסות יין", "יומי", 10, False, "בקרת שבר ואיבוד ציוד"),
    ("מנהל מטבח", "עדכון מנהל פלור על שינויים ומלאים", "יומי", 5, False, "תדריך פתיחת משמרת בוקר/ערב"),
    ("מנהל מטבח", "בקרת טמפרטורות מקררים ומקפיאים", "יומי", 5, False, "לוח טמפרטורה (תקין מתחת ל-4°C)"),
    ("מנהל מטבח", "בדיקת מלאי סוף משמרת וחסרים דחופים", "יומי", 10, False, "בדיקה ב-OPS_Inventory_Orders ושיגור"),
]


def run():
    s = Sheets(NEW_SPREADSHEET_ID)
    meta = s.get("sheets(properties(sheetId,title))")
    sheets_dict = {sh["properties"]["title"]: sh["properties"]["sheetId"] for sh in meta["sheets"]}

    reqs = []
    if SHEET_TITLE in sheets_dict:
        sheet_id = sheets_dict[SHEET_TITLE]
    else:
        add_res = s.batch_update([
            {
                "addSheet": {
                    "properties": {
                        "title": SHEET_TITLE,
                        "tabColorStyle": {"rgbColor": color("#4A5568")},
                        "rightToLeft": True,
                        "gridProperties": {
                            "rowCount": 100,
                            "columnCount": 18,
                            "frozenRowCount": 1,
                            "hideGridlines": True,
                        },
                    }
                }
            }
        ])
        sheet_id = add_res["replies"][0]["addSheet"]["properties"]["sheetId"]

    # 1. Column widths
    col_widths = {
        0: 85,    # A: ID
        1: 260,   # B: Task Name
        2: 120,   # C: Area
        3: 100,   # D: Assignee
        4: 135,   # E: Priority
        5: 100,   # F: Frequency
        6: 110,   # G: Due Date
        7: 115,   # H: Status
        8: 240,   # I: Notes
        9: 35,    # J: Separator
        10: 145,  # K: Station
        11: 250,  # L: Prep Item
        12: 95,   # M: Frequency
        13: 100,  # N: Time
        14: 80,   # O: Done Checkbox
        15: 250,  # P: Instructions
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

    # 2. Write Headers
    # Table 1: Cols A-I
    reqs.append(write_block(sheet_id, 0, 0, [TABLE1_HEADERS]))
    # Separator: Col J
    reqs.append(write_block(sheet_id, 0, 9, [[""]]))
    # Table 2: Cols K-P
    reqs.append(write_block(sheet_id, 0, 10, [TABLE2_HEADERS]))

    # Header styling
    reqs.append({
        "repeatCell": {
            "range": grid(sheet_id, 0, 1, 0, 9),
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
    reqs.append({
        "repeatCell": {
            "range": grid(sheet_id, 0, 1, 10, 16),
            "cell": {
                "userEnteredFormat": {
                    "backgroundColor": color("#2B2D42"),
                    "textFormat": {"foregroundColor": color(HEADER_FG), "bold": True, "fontFamily": FONT, "fontSize": 10},
                    "horizontalAlignment": "CENTER",
                    "verticalAlignment": "MIDDLE",
                }
            },
            "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
        }
    })

    # 3. Populate Table 1 Tasks Data
    reqs.append(write_block(sheet_id, 1, 0, TASKS_DATA))

    # Format Table 1 rows
    t1_rows = len(TASKS_DATA)
    reqs.append({
        "repeatCell": {
            "range": grid(sheet_id, 1, 1 + t1_rows, 0, 9),
            "cell": {
                "userEnteredFormat": {
                    "textFormat": {"fontFamily": FONT, "fontSize": 10},
                    "verticalAlignment": "MIDDLE",
                }
            },
            "fields": "userEnteredFormat(textFormat,verticalAlignment)",
        }
    })
    # Center-align specific cols in Table 1: A, C, D, E, F, G, H
    for c in [0, 2, 3, 4, 5, 6, 7]:
        reqs.append({
            "repeatCell": {
                "range": grid(sheet_id, 1, 1 + t1_rows, c, c + 1),
                "cell": {
                    "userEnteredFormat": {
                        "horizontalAlignment": "CENTER",
                    }
                },
                "fields": "userEnteredFormat(horizontalAlignment)",
            }
        })

    # Alternating row colors Table 1
    for i in range(t1_rows):
        bg = BAND_1 if i % 2 == 0 else BAND_2
        reqs.append({
            "repeatCell": {
                "range": grid(sheet_id, 1 + i, 2 + i, 0, 9),
                "cell": {"userEnteredFormat": {"backgroundColor": color(bg)}},
                "fields": "userEnteredFormat(backgroundColor)",
            }
        })

    # 4. Populate Table 2 Prep Data
    reqs.append(write_block(sheet_id, 1, 10, PREP_DATA))

    t2_rows = len(PREP_DATA)
    reqs.append({
        "repeatCell": {
            "range": grid(sheet_id, 1, 1 + t2_rows, 10, 16),
            "cell": {
                "userEnteredFormat": {
                    "textFormat": {"fontFamily": FONT, "fontSize": 10},
                    "verticalAlignment": "MIDDLE",
                }
            },
            "fields": "userEnteredFormat(textFormat,verticalAlignment)",
        }
    })
    # Center-align in Table 2: K, M, N, O
    for c in [10, 12, 13, 14]:
        reqs.append({
            "repeatCell": {
                "range": grid(sheet_id, 1, 1 + t2_rows, c, c + 1),
                "cell": {
                    "userEnteredFormat": {
                        "horizontalAlignment": "CENTER",
                    }
                },
                "fields": "userEnteredFormat(horizontalAlignment)",
            }
        })

    # Alternating row colors Table 2
    for i in range(t2_rows):
        bg = BAND_1 if i % 2 == 0 else BAND_2
        reqs.append({
            "repeatCell": {
                "range": grid(sheet_id, 1 + i, 2 + i, 10, 16),
                "cell": {"userEnteredFormat": {"backgroundColor": color(bg)}},
                "fields": "userEnteredFormat(backgroundColor)",
            }
        })

    # 5. Checkbox validation on Col O (14)
    reqs.append({
        "setDataValidation": {
            "range": grid(sheet_id, 1, 1 + t2_rows, 14, 15),
            "rule": {
                "condition": {"type": "BOOLEAN"},
                "showCustomUi": True,
            },
        }
    })

    # 6. Dropdown Validations
    # Priority dropdown in Table 1 Col E (4)
    reqs.append({
        "setDataValidation": {
            "range": grid(sheet_id, 1, 50, 4, 5),
            "rule": {
                "condition": {
                    "type": "ONE_OF_LIST",
                    "values": [
                        {"userEnteredValue": "🔥 דחוף לסרוויס"},
                        {"userEnteredValue": "⚡ דחוף"},
                        {"userEnteredValue": "⏳ שגרתי"},
                        {"userEnteredValue": "💤 פחות דחוף"},
                    ],
                },
                "showCustomUi": True,
            },
        }
    })
    # Status dropdown in Table 1 Col H (7)
    reqs.append({
        "setDataValidation": {
            "range": grid(sheet_id, 1, 50, 7, 8),
            "rule": {
                "condition": {
                    "type": "ONE_OF_LIST",
                    "values": [
                        {"userEnteredValue": "⏳ לביצוע"},
                        {"userEnteredValue": "🔄 בתהליך"},
                        {"userEnteredValue": "⏸️ ממתין"},
                        {"userEnteredValue": "✅ הושלם"},
                    ],
                },
                "showCustomUi": True,
            },
        }
    })

    # Area dropdown in Table 1 Col C (2)
    reqs.append({
        "setDataValidation": {
            "range": grid(sheet_id, 1, 50, 2, 3),
            "rule": {
                "condition": {
                    "type": "ONE_OF_LIST",
                    "values": [
                        {"userEnteredValue": "מטבח"},
                        {"userEnteredValue": "תפעול"},
                        {"userEnteredValue": "תחזוקה"},
                        {"userEnteredValue": "אירועים"},
                        {"userEnteredValue": "כ\"א"},
                    ],
                },
                "showCustomUi": True,
            },
        }
    })

    # Station dropdown in Table 2 Col K (10)
    reqs.append({
        "setDataValidation": {
            "range": grid(sheet_id, 1, 50, 10, 11),
            "rule": {
                "condition": {
                    "type": "ONE_OF_LIST",
                    "values": [
                        {"userEnteredValue": "פלטות וגבינות"},
                        {"userEnteredValue": "סלטים וברוסקטות"},
                        {"userEnteredValue": "לחמים ומאפים"},
                        {"userEnteredValue": "קינוחים"},
                        {"userEnteredValue": "תפעול וניקיון"},
                        {"userEnteredValue": "מנהל מטבח"},
                    ],
                },
                "showCustomUi": True,
            },
        }
    })

    # 7. Conditional Formatting Rules
    # Status Completed (Col H = "✅ הושלם") -> soft green background
    reqs.append({
        "addConditionalFormatRule": {
            "rule": {
                "ranges": [grid(sheet_id, 1, 50, 7, 8)],
                "booleanRule": {
                    "condition": {
                        "type": "TEXT_EQ",
                        "values": [{"userEnteredValue": "✅ הושלם"}],
                    },
                    "format": {
                        "backgroundColor": color("#E8F5E9"),
                        "textFormat": {"foregroundColor": color("#2E7D32"), "bold": True},
                    },
                },
            },
            "index": 0,
        }
    })
    # Status In Progress (Col H = "🔄 בתהליך") -> soft blue background
    reqs.append({
        "addConditionalFormatRule": {
            "rule": {
                "ranges": [grid(sheet_id, 1, 50, 7, 8)],
                "booleanRule": {
                    "condition": {
                        "type": "TEXT_EQ",
                        "values": [{"userEnteredValue": "🔄 בתהליך"}],
                    },
                    "format": {
                        "backgroundColor": color("#E3F2FD"),
                        "textFormat": {"foregroundColor": color("#1565C0"), "bold": True},
                    },
                },
            },
            "index": 1,
        }
    })
    # Priority Urgent (Col E = "🔥 דחוף לסרוויס") -> soft red background
    reqs.append({
        "addConditionalFormatRule": {
            "rule": {
                "ranges": [grid(sheet_id, 1, 50, 4, 5)],
                "booleanRule": {
                    "condition": {
                        "type": "TEXT_EQ",
                        "values": [{"userEnteredValue": "🔥 דחוף לסרוויס"}],
                    },
                    "format": {
                        "backgroundColor": color("#FFEBEE"),
                        "textFormat": {"foregroundColor": color("#C62828"), "bold": True},
                    },
                },
            },
            "index": 2,
        }
    })

    # Prep Done (Col O = TRUE) -> strike through or light green
    reqs.append({
        "addConditionalFormatRule": {
            "rule": {
                "ranges": [grid(sheet_id, 1, 50, 11, 12)],  # Column L (Prep Item)
                "booleanRule": {
                    "condition": {
                        "type": "CUSTOM_FORMULA",
                        "values": [{"userEnteredValue": "=O2=TRUE"}],
                    },
                    "format": {
                        "textFormat": {"strikethrough": True, "foregroundColor": color("#9E9E9E")},
                    },
                },
            },
            "index": 3,
        }
    })

    print(f"Sending {len(reqs)} requests to batchUpdate for {SHEET_TITLE}...")
    s.batch_update(reqs)
    print(f"Successfully created and styled {SHEET_TITLE}!")


if __name__ == "__main__":
    run()
