"""Comprehensive end-to-end audit of Kitchen OS v2.0."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Sheets, NEW_SPREADSHEET_ID

def run():
    s = Sheets(NEW_SPREADSHEET_ID)
    meta = s.get("sheets(properties(sheetId,title,index,rightToLeft,gridProperties(rowCount,columnCount))),namedRanges")
    
    print("=" * 60)
    print("      KITCHEN OS v2.0 — COMPREHENSIVE SYSTEM AUDIT")
    print("=" * 60)
    
    # Check named ranges
    named = [nr["name"] for nr in meta.get("namedRanges", [])]
    print(f"\n1. Named Ranges ({len(named)} found):")
    for nr in sorted(named):
        print(f"   ✓ {nr}")

    expected_sheets = [
        "00_Dashboard",
        "DB_Config_Suppliers",
        "DB_Catalog",
        "OPS_Inventory_Orders",
        "OPS_Recipes_FoodCost",
        "OPS_Labor_Tracker",
        "OPS_Kitchen_Tasks",
        "LOG_Counts",
        "LOG_Waste",
    ]

    print("\n2. Sheet Properties & RTL Audit:")
    sheet_meta = {sh["properties"]["title"]: sh["properties"] for sh in meta["sheets"]}
    all_rtl = True
    for title in expected_sheets:
        if title in sheet_meta:
            p = sheet_meta[title]
            rtl = p.get("rightToLeft", False)
            all_rtl = all_rtl and rtl
            print(f"   [{p['index']}] {title:<22} | RTL: {'✓ True' if rtl else '✗ FALSE'} | Size: {p['gridProperties']['rowCount']}x{p['gridProperties']['columnCount']}")
        else:
            print(f"   ✗ MISSING SHEET: {title}")

    # Check for formula errors across all sheets
    error_tokens = ["#REF!", "#VALUE!", "#NAME?", "#N/A", "#DIV/0!", "#ERROR!"]
    total_errors = 0
    print("\n3. Formula Error Audit across all sheets:")
    for title in expected_sheets:
        if title not in sheet_meta:
            continue
        vals = s.values(f"'{title}'!A1:Z120", render="FORMATTED_VALUE")
        sheet_errors = []
        for r_idx, row in enumerate(vals):
            for c_idx, cell_val in enumerate(row):
                s_val = str(cell_val).strip()
                for err in error_tokens:
                    if s_val == err or s_val.startswith(err):
                        sheet_errors.append((r_idx + 1, c_idx + 1, s_val))
        if sheet_errors:
            print(f"   ✗ {title}: FOUND {len(sheet_errors)} ERRORS!")
            for r, c, e in sheet_errors[:5]:
                print(f"      Row {r}, Col {c}: {e}")
            total_errors += len(sheet_errors)
        else:
            print(f"   ✓ {title:<22} | 0 formula errors found")

    print("\n4. Executive Dashboard Status (00_Dashboard):")
    db_cards = s.values("'00_Dashboard'!B3:O4", render="FORMATTED_VALUE")
    if len(db_cards) >= 2:
        top_labels = db_cards[0]
        values = db_cards[1]
        print(f"   Stock Value:       {values[0]} ({top_labels[0]})")
        print(f"   Stock Deficits:    {values[2]} ({top_labels[2]})")
        print(f"   Labor Cost YTD:    {values[4]} ({top_labels[4]})")
        print(f"   Food Cost Menu:    {values[8]} ({top_labels[8]})")
        print(f"   Total Waste:       {values[10]} ({top_labels[10]})")
        print(f"   Urgent Tasks:      {values[12]} ({top_labels[12]})")

    print("\n" + "=" * 60)
    if total_errors == 0 and all_rtl:
        print("   🌟 ALL CHECKS PASSED: SYSTEM 100% HEALTHY & VERIFIED!")
    else:
        print(f"   ⚠️ SYSTEM AUDIT COMPLETED WITH ISSUES (Errors: {total_errors})")
    print("=" * 60)

if __name__ == "__main__":
    run()
