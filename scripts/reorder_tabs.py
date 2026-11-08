"""Reorder tabs and set tab colors by architectural layer in Kitchen OS v2.0."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Sheets, NEW_SPREADSHEET_ID, color

TARGET_ORDER = [
    ("00_Dashboard", "#1E1E1E"),
    ("DB_Config_Suppliers", "#495057"),
    ("DB_Catalog", "#495057"),
    ("OPS_Inventory_Orders", "#2B2D42"),
    ("OPS_Recipes_FoodCost", "#2B2D42"),
    ("OPS_Labor_Tracker", "#2B2D42"),
    ("OPS_Kitchen_Tasks", "#2B2D42"),
    ("LOG_Counts", "#6C757D"),
    ("LOG_Waste", "#6C757D"),
]

def run():
    s = Sheets(NEW_SPREADSHEET_ID)
    meta = s.get("sheets(properties(sheetId,title))")
    sheets_dict = {sh["properties"]["title"]: sh["properties"]["sheetId"] for sh in meta["sheets"]}

    reqs = []
    for idx, (title, tab_color) in enumerate(TARGET_ORDER):
        if title in sheets_dict:
            sh_id = sheets_dict[title]
            reqs.append({
                "updateSheetProperties": {
                    "properties": {
                        "sheetId": sh_id,
                        "index": idx,
                        "tabColorStyle": {"rgbColor": color(tab_color)},
                    },
                    "fields": "index,tabColorStyle",
                }
            })

    if reqs:
        print(f"Reordering {len(reqs)} sheets...")
        s.batch_update(reqs)
        print("Tab reordering complete!")

    # Verify final order
    meta_after = s.get("sheets(properties(sheetId,title,index))")
    ordered = sorted(meta_after["sheets"], key=lambda x: x["properties"]["index"])
    print("\nFinal Tab Order:")
    for sh in ordered:
        print(f"[{sh['properties']['index']}] {sh['properties']['title']}")


if __name__ == "__main__":
    run()
