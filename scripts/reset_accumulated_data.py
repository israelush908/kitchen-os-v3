"""
Clears all accumulated / historical logs and labor data from Google Sheets (Kitchen OS v2.0)
and from the local/cloud database (data/kitchen_db.json), while strictly preserving:
  - DB_Catalog (108 items, prices, units, Par levels, Reorder points)
  - DB_Config_Suppliers (16 suppliers, contacts, WhatsApp numbers, financial targets)
  - OPS_Recipes_FoodCost (17 dishes/sub-recipes and 40 BOM recipe lines)
  - OPS_Kitchen_Tasks (Prep checklist bank reset to doneToday=False, Manager tasks reset to '⏳ לביצוע')
  - All dynamic array formulas in LOG_Counts, LOG_Waste, OPS_Inventory_Orders, and OPS_Labor_Tracker!
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Sheets, NEW_SPREADSHEET_ID, grid, write_block
from sheets_sync import pull_full_state_from_sheets


def reset_accumulated_data():
    api = Sheets(NEW_SPREADSHEET_ID)
    meta = api.get("sheets(properties(sheetId,title))")
    sheet_map = {s["properties"]["title"]: s["properties"]["sheetId"] for s in meta.get("sheets", [])}

    reqs = []

    # 1. Clear LOG_Counts (preserve headers in Row 1 and dynamic array formulas in D2, E2, F2!)
    if "LOG_Counts" in sheet_map:
        sid = sheet_map["LOG_Counts"]
        # Clear Cols A..C (indices 0..3) and Col G (index 6..7) from row 2 downwards
        reqs.append({"updateCells": {"range": grid(sid, 1, 2000, 0, 3), "fields": "userEnteredValue"}})
        reqs.append({"updateCells": {"range": grid(sid, 1, 2000, 6, 7), "fields": "userEnteredValue"}})

    # 2. Clear LOG_Waste (preserve headers in Row 1 and dynamic array formulas in E2, G2, H2!)
    if "LOG_Waste" in sheet_map:
        sid = sheet_map["LOG_Waste"]
        # Clear Cols A..D (0..4), Col F (5..6), Col I (8..9) from row 2 downwards
        reqs.append({"updateCells": {"range": grid(sid, 1, 1000, 0, 4), "fields": "userEnteredValue"}})
        reqs.append({"updateCells": {"range": grid(sid, 1, 1000, 5, 6), "fields": "userEnteredValue"}})
        reqs.append({"updateCells": {"range": grid(sid, 1, 1000, 8, 9), "fields": "userEnteredValue"}})

    # 3. Clear Quick_Count_Override (Col G, index 6..7) in OPS_Inventory_Orders
    if "OPS_Inventory_Orders" in sheet_map:
        sid = sheet_map["OPS_Inventory_Orders"]
        reqs.append({"updateCells": {"range": grid(sid, 1, 500, 6, 7), "fields": "userEnteredValue"}})

    # 4. Clear LOG_Deliveries if exists (keep header row 1)
    if "LOG_Deliveries" in sheet_map:
        sid = sheet_map["LOG_Deliveries"]
        reqs.append({"updateCells": {"range": grid(sid, 1, 500, 0, 9), "fields": "userEnteredValue"}})

    # 5. Clear OPS_Daily_Labor if exists (keep header row 1)
    if "OPS_Daily_Labor" in sheet_map:
        sid = sheet_map["OPS_Daily_Labor"]
        reqs.append({"updateCells": {"range": grid(sid, 1, 500, 0, 17), "fields": "userEnteredValue"}})

    # 6. Clear accumulated input numbers in OPS_Labor_Tracker (Cols A, B, D, E, G, H, P in rows 2..30)
    # while keeping all formulas in Cols C, F, I, J, K, L, M, N, O and KPI block in R..T!
    if "OPS_Labor_Tracker" in sheet_map:
        sid = sheet_map["OPS_Labor_Tracker"]
        reqs.append({"updateCells": {"range": grid(sid, 1, 30, 0, 2), "fields": "userEnteredValue"}})   # Cols A, B
        reqs.append({"updateCells": {"range": grid(sid, 1, 30, 3, 5), "fields": "userEnteredValue"}})   # Cols D, E
        reqs.append({"updateCells": {"range": grid(sid, 1, 30, 6, 8), "fields": "userEnteredValue"}})   # Cols G, H
        reqs.append({"updateCells": {"range": grid(sid, 1, 30, 15, 16), "fields": "userEnteredValue"}}) # Col P

    # 7. Reset daily checkboxes (Col O, index 14..15) in OPS_Kitchen_Tasks to FALSE
    if "OPS_Kitchen_Tasks" in sheet_map:
        sid = sheet_map["OPS_Kitchen_Tasks"]
        prep_vals = api.values("'OPS_Kitchen_Tasks'!K2:P50")
        num_prep = len([r for r in prep_vals if len(r) > 1 and str(r[1]).strip()])
        if num_prep > 0:
            reqs.append(write_block(sid, 1, 14, [[False] for _ in range(num_prep)]))

    if reqs:
        api.batch_update(reqs)
        print(f"Cleared {len(reqs)} accumulated data blocks in Google Sheets.")

    # Pull fresh clean state from Google Sheets
    clean_state = pull_full_state_from_sheets()

    # Ensure all accumulated arrays are strictly empty and currentStock is 0
    clean_state["logCounts"] = []
    clean_state["logWaste"] = []
    clean_state["logDeliveries"] = []
    clean_state["logLabor"] = []
    clean_state["logLaborDaily"] = []
    for item in clean_state.get("catalog", []):
        item["currentStock"] = 0.0
    for prep in clean_state.get("prepChecklist", []):
        prep["doneToday"] = False

    # Write clean state to data/kitchen_db.json
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_path = os.path.join(project_root, "data", "kitchen_db.json")
    with open(db_path, "w", encoding="utf-8") as f:
        json.dump({
            "updatedAt": "2026-11-08T15:35:00Z",
            "spreadsheetId": NEW_SPREADSHEET_ID,
            "state": clean_state
        }, f, ensure_ascii=False, indent=2)

    print("Saved clean state to data/kitchen_db.json:")
    print(f"  - Catalog items preserved: {len(clean_state['catalog'])}")
    print(f"  - Suppliers preserved:     {len(clean_state['suppliers'])}")
    print(f"  - Dishes preserved:        {len(clean_state['dishes'])}")
    print(f"  - Recipe BOM lines:        {len(clean_state['recipeLines'])}")
    print(f"  - Prep checklist items:    {len(clean_state['prepChecklist'])}")
    print(f"  - Accumulated logs:        0 (Counts=0, Waste=0, Deliveries=0, Labor=0)")


if __name__ == "__main__":
    reset_accumulated_data()

