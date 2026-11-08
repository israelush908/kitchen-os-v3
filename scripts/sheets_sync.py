"""
Two-Way Synchronization Adapter between Google Sheets (Kitchen OS v2.0) and Kitchen OS v3.0 SPA State.
Spreadsheet ID: 16ToeULQNGXZuYi7Jt08jkLrYbV28h1ad1Vg1tiHVVF4

Pulls all live data from:
  - DB_Config_Suppliers (Suppliers + Config targets)
  - DB_Catalog + OPS_Inventory_Orders (108+ Catalog items with real Current_Stock)
  - OPS_Recipes_FoodCost (Table A: Dishes & Sub-recipes, Table B: Recipe BOM lines)
  - OPS_Labor_Tracker (Monthly labor history)
  - OPS_Daily_Labor (Daily/Weekly shift labor with hourly & global boxes)
  - OPS_Kitchen_Tasks (Table 1: Manager Tasks, Table 2: Station Prep Checklists)
  - LOG_Counts (Inventory count logs)
  - LOG_Waste (Waste logs)
  - LOG_Deliveries (Goods receiving / supplier invoices)

And pushes updates back to Google Sheets while preserving all dynamic array formulas!
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import Sheets, NEW_SPREADSHEET_ID, clean_text, to_number, write_block, grid, a1_sheet


def pull_full_state_from_sheets():
    """Reads all tabs from the Google Spreadsheet and returns a normalized SPA state object."""
    api = Sheets(NEW_SPREADSHEET_ID, readonly=True)

    # Batch read all ranges using single values calls
    sup_cfg_rows = api.values("'DB_Config_Suppliers'!A2:P100")
    cat_rows = api.values("'DB_Catalog'!A2:N500")
    inv_rows = api.values("'OPS_Inventory_Orders'!A2:M500")
    rec_a_rows = api.values("'OPS_Recipes_FoodCost'!A2:L100")
    rec_b_rows = api.values("'OPS_Recipes_FoodCost'!N2:S300")
    labor_m_rows = api.values("'OPS_Labor_Tracker'!A2:P50")
    tasks_rows = api.values("'OPS_Kitchen_Tasks'!A2:P100")
    counts_rows = api.values("'LOG_Counts'!A2:G600")
    waste_rows = api.values("'LOG_Waste'!A2:I500")

    # Check optional tabs (OPS_Daily_Labor, LOG_Deliveries)
    meta = api.get("sheets(properties(sheetId,title))")
    existing_titles = {s["properties"]["title"] for s in meta.get("sheets", [])}

    daily_labor_rows = api.values("'OPS_Daily_Labor'!A2:Q200") if "OPS_Daily_Labor" in existing_titles else []
    deliveries_rows = api.values("'LOG_Deliveries'!A2:I200") if "LOG_Deliveries" in existing_titles else []

    # 1. Parse Config & Suppliers
    config = {
        "kitchenName": "מרכז מבקרים יקב בוטיק",
        "targetFoodCost": 0.30,
        "targetLaborCost": 0.15,
        "employerCostMultiplier": 1.30,
        "vatRate": 0.18,
        "currency": "₪"
    }

    suppliers = []
    supplier_name_to_id = {}

    for idx, r in enumerate(sup_cfg_rows):
        # Config is in cols I (8) and J (9)
        if len(r) > 9 and clean_text(r[8]):
            cfg_key = clean_text(r[8])
            cfg_val = to_number(r[9])
            if cfg_val is not None:
                if "Target_FoodCost" in cfg_key or "פוד קוסט" in cfg_key:
                    config["targetFoodCost"] = float(cfg_val)
                elif "Target_LaborCost" in cfg_key or "לייבור" in cfg_key:
                    config["targetLaborCost"] = float(cfg_val)
                elif "Employer_Cost" in cfg_key or "מעסיק" in cfg_key:
                    config["employerCostMultiplier"] = float(cfg_val)
                elif "VAT" in cfg_key or "מע\"מ" in cfg_key:
                    config["vatRate"] = float(cfg_val)

        # Supplier is in cols A..G (0..6)
        sup_name = clean_text(r[1]) if len(r) > 1 else ""
        if sup_name:
            sup_id = clean_text(r[0]) if len(r) > 0 and clean_text(r[0]) else f"SUP-{idx+1:02d}"
            sup_cat = clean_text(r[2]) if len(r) > 2 else "כללי"
            contact = clean_text(r[3]) if len(r) > 3 else ""
            phone = clean_text(r[4]) if len(r) > 4 else ""
            days_raw = clean_text(r[5]) if len(r) > 5 else ""
            days_list = [d.strip() for d in days_raw.split(",") if d.strip()] if days_raw else ["ראשון", "שלישי", "חמישי"]
            is_active = bool(r[6]) if len(r) > 6 and isinstance(r[6], bool) else True

            suppliers.append({
                "id": sup_id,
                "name": sup_name,
                "category": sup_cat,
                "contactName": contact,
                "whatsappPhone": phone,
                "deliveryDays": days_list,
                "isActive": is_active
            })
            supplier_name_to_id[sup_name] = sup_id

    # 2. Map current stock from OPS_Inventory_Orders (Col B = Name, Col H = Current_Stock)
    item_stock_map = {}
    for r in inv_rows:
        if len(r) > 1 and clean_text(r[1]):
            iname = clean_text(r[1])
            curr_stk = to_number(r[7]) if len(r) > 7 else 0
            item_stock_map[iname] = float(curr_stk) if curr_stk is not None else 0.0

    # 3. Parse DB_Catalog (108 items)
    catalog = []
    item_name_to_id = {}
    for idx, r in enumerate(cat_rows):
        name = clean_text(r[1]) if len(r) > 1 else ""
        if not name:
            continue
        item_id = clean_text(r[0]) if len(r) > 0 and clean_text(r[0]) else f"ITM-{idx+1:03d}"
        cat = clean_text(r[2]) if len(r) > 2 and clean_text(r[2]) else "כללי"
        sup_name = clean_text(r[3]) if len(r) > 3 else ""
        sup_id = supplier_name_to_id.get(sup_name, suppliers[0]["id"] if suppliers else "SUP-01")
        # If supplier wasn't in suppliers table, add it dynamically
        if sup_name and sup_name not in supplier_name_to_id:
            new_sup_id = f"SUP-{len(suppliers)+1:02d}"
            suppliers.append({
                "id": new_sup_id,
                "name": sup_name,
                "category": cat,
                "contactName": "",
                "whatsappPhone": "",
                "deliveryDays": ["ראשון", "חמישי"],
                "isActive": True
            })
            supplier_name_to_id[sup_name] = new_sup_id
            sup_id = new_sup_id

        unit = clean_text(r[4]) if len(r) > 4 and clean_text(r[4]) else 'ק"ג'
        cost = to_number(r[5]) if len(r) > 5 else 0.0
        yield_loss = to_number(r[6]) if len(r) > 6 else 0.0
        par = to_number(r[8]) if len(r) > 8 else 10.0
        reorder = to_number(r[9]) if len(r) > 9 else 2.0
        active = bool(r[10]) if len(r) > 10 and isinstance(r[10], bool) else True
        in_count = bool(r[11]) if len(r) > 11 and isinstance(r[11], bool) else True
        in_waste = bool(r[12]) if len(r) > 12 and isinstance(r[12], bool) else True
        notes = clean_text(r[13]) if len(r) > 13 else ""

        catalog.append({
            "id": item_id,
            "name": name,
            "category": cat,
            "supplierId": sup_id,
            "supplierName": sup_name,
            "stockUnit": unit,
            "unitCostExclVat": float(cost) if cost is not None else 0.0,
            "yieldLossPct": float(yield_loss) if yield_loss is not None else 0.0,
            "parLevelWeekend": float(par) if par is not None else 0.0,
            "reorderPoint": float(reorder) if reorder is not None else 0.0,
            "currentStock": item_stock_map.get(name, 0.0),
            "inCountForm": in_count,
            "inWasteForm": in_waste,
            "isActive": active,
            "notes": notes
        })
        item_name_to_id[name] = item_id

    # 4. Parse OPS_Recipes_FoodCost (Dishes & Recipe BOM Lines)
    dishes = []
    dish_name_to_id = {}
    for idx, r in enumerate(rec_a_rows):
        dname = clean_text(r[0]) if len(r) > 0 else ""
        if not dname:
            continue
        dcat = clean_text(r[1]) if len(r) > 1 else "כללי"
        yld = to_number(r[2]) if len(r) > 2 else 1.0
        price_inc = to_number(r[5]) if len(r) > 5 else 0.0
        sales_qty = to_number(r[11]) if len(r) > 11 else 35

        is_sub = ("הכנה" in dcat) or (price_inc is None or float(price_inc) == 0.0)
        dish_id = f"DSH-{idx+1:02d}"
        dishes.append({
            "id": dish_id,
            "name": dname,
            "dishType": "SUB_RECIPE" if is_sub else "MENU_ITEM",
            "category": dcat,
            "yieldPortions": float(yld) if yld and float(yld) > 0 else 1.0,
            "priceInclVat": round(float(price_inc), 2) if price_inc else 0.0,
            "weeklySalesQty": int(sales_qty) if sales_qty else 35,
            "prepInstructions": ""
        })
        dish_name_to_id[dname] = dish_id

    recipe_lines = []
    for idx, r in enumerate(rec_b_rows):
        parent_name = clean_text(r[0]) if len(r) > 0 else ""
        ing_name = clean_text(r[1]) if len(r) > 1 else ""
        if not parent_name or not ing_name:
            continue

        # Ensure parent dish exists
        if parent_name not in dish_name_to_id:
            new_did = f"DSH-{len(dishes)+1:02d}"
            dishes.append({
                "id": new_did,
                "name": parent_name,
                "dishType": "SUB_RECIPE",
                "category": "מתכוני הכנה",
                "yieldPortions": 1.0,
                "priceInclVat": 0.0,
                "weeklySalesQty": 0,
                "prepInstructions": ""
            })
            dish_name_to_id[parent_name] = new_did

        parent_id = dish_name_to_id[parent_name]
        qty = to_number(r[2]) if len(r) > 2 else 1.0
        unit = clean_text(r[3]) if len(r) > 3 else 'ק"ג'
        notes = clean_text(r[5]) if len(r) > 5 else ""

        # Attach instructions to parent dish if present
        if notes:
            for d in dishes:
                if d["id"] == parent_id and not d["prepInstructions"]:
                    d["prepInstructions"] = notes

        if ing_name in dish_name_to_id:
            comp_type = "SUB_RECIPE"
            comp_id = dish_name_to_id[ing_name]
        else:
            comp_type = "RAW_ITEM"
            comp_id = item_name_to_id.get(ing_name, ing_name)

        recipe_lines.append({
            "id": f"RL-{idx+1:03d}",
            "parentDishId": parent_id,
            "parentDishName": parent_name,
            "componentType": comp_type,
            "componentId": comp_id,
            "componentName": ing_name,
            "quantity": float(qty) if qty is not None else 0.0,
            "unit": unit,
            "notes": notes
        })

    # 5. Parse OPS_Kitchen_Tasks (Table 1: Manager Tasks, Table 2: Prep Checklist)
    manager_tasks = []
    prep_checklist = []

    for idx, r in enumerate(tasks_rows):
        # Table 1: cols 0..8
        tid = clean_text(r[0]) if len(r) > 0 else ""
        ttitle = clean_text(r[1]) if len(r) > 1 else ""
        tnotes = clean_text(r[8]) if len(r) > 8 else ""
        if tid or ttitle:
            manager_tasks.append({
                "id": tid or f"TSK-{idx+1:02d}",
                "title": ttitle if ttitle else (tnotes or f"משימת מטבח {tid}"),
                "area": clean_text(r[2]) if len(r) > 2 and clean_text(r[2]) else "מטבח",
                "assignee": clean_text(r[3]) if len(r) > 3 and clean_text(r[3]) else "ישראל",
                "priority": clean_text(r[4]) if len(r) > 4 and clean_text(r[4]) else "רגילה",
                "frequency": clean_text(r[5]) if len(r) > 5 else "חד-פעמי",
                "dueDate": clean_text(r[6]) if len(r) > 6 else "",
                "status": "הושלם" if (len(r) > 7 and "הושלם" in clean_text(r[7])) else (clean_text(r[7]) if len(r) > 7 and clean_text(r[7]) else "לביצוע"),
                "notes": tnotes
            })

        # Table 2: cols 10..15 (K..P)
        if len(r) > 11 and clean_text(r[11]):
            station = clean_text(r[10]) if clean_text(r[10]) else "כללי"
            prep_item = clean_text(r[11])
            freq = clean_text(r[12]) if len(r) > 12 and clean_text(r[12]) else "יומי"
            est_min = to_number(r[13]) if len(r) > 13 else 15
            done_today = bool(r[14]) if len(r) > 14 and isinstance(r[14], bool) else False
            instr = clean_text(r[15]) if len(r) > 15 else ""

            prep_checklist.append({
                "id": f"PREP-{idx+1:02d}",
                "station": station,
                "prepItem": prep_item,
                "frequency": freq,
                "estMinutes": int(est_min) if est_min else 15,
                "doneToday": done_today,
                "instructions": instr,
                "linkedDishId": None
            })

    # 6. Parse OPS_Labor_Tracker (Monthly Labor)
    log_labor = []
    for r in labor_m_rows:
        m_name = clean_text(r[0]) if len(r) > 0 else ""
        sales_inc = to_number(r[1]) if len(r) > 1 else None
        if not m_name or sales_inc is None:
            continue
        sales_exc = to_number(r[2]) if len(r) > 2 else (float(sales_inc) / (1 + config["vatRate"]))
        srv_h = to_number(r[3]) if len(r) > 3 else 0.0
        prep_h = to_number(r[4]) if len(r) > 4 else 0.0
        hr_wages = to_number(r[6]) if len(r) > 6 else 0.0
        sal_wages = to_number(r[7]) if len(r) > 7 else 0.0
        emp_cost = to_number(r[9]) if len(r) > 9 else ((float(hr_wages or 0) + float(sal_wages or 0)) * config["employerCostMultiplier"])
        l_pct = to_number(r[10]) if len(r) > 10 else 0.0
        splh = to_number(r[13]) if len(r) > 13 else 0.0
        notes = clean_text(r[15]) if len(r) > 15 else ""

        log_labor.append({
            "monthId": m_name,
            "salesInclVat": round(float(sales_inc), 2),
            "salesExclVat": round(float(sales_exc or 0), 2),
            "serviceHours": float(srv_h or 0),
            "prepHours": float(prep_h or 0),
            "hourlyWagesGross": float(hr_wages or 0),
            "salariedGross": float(sal_wages or 0),
            "grossWages": float(hr_wages or 0) + float(sal_wages or 0),
            "employerCost": round(float(emp_cost or 0), 2),
            "laborPct": round(float(l_pct or 0), 4),
            "splh": round(float(splh or 0), 2),
            "notes": notes
        })

    # 7. Parse OPS_Daily_Labor if exists
    log_labor_daily = []
    for idx, r in enumerate(daily_labor_rows):
        d_date = clean_text(r[0]) if len(r) > 0 else ""
        if not d_date:
            continue
        # Try parsing JSON boxes from col 16 if stored, else reconstruct
        boxes_json = clean_text(r[16]) if len(r) > 16 else ""
        hourly_boxes = []
        global_boxes = []
        if boxes_json:
            try:
                parsed_b = json.loads(boxes_json)
                hourly_boxes = parsed_b.get("hourlyBoxes", [])
                global_boxes = parsed_b.get("globalBoxes", [])
            except Exception:
                pass
        if not hourly_boxes and (to_number(r[5]) or 0) > 0:
            hrs = float(to_number(r[5]) or 0)
            hr_sum = float(to_number(r[6]) or 0)
            rate = round(hr_sum / hrs, 2) if hrs > 0 else 50
            hourly_boxes = [{"id": "HB-1", "roleLabel": "צוות שעתי", "hours": hrs, "hourlyRate": rate}]
        if not global_boxes and (to_number(r[7]) or 0) > 0:
            global_boxes = [{"id": "GB-1", "roleLabel": "שף / גלובלי", "amount": float(to_number(r[7]) or 0)}]

        log_labor_daily.append({
            "id": f"LBR-DAY-{idx+1:03d}",
            "date": d_date,
            "monthId": d_date[:7] if len(d_date) >= 7 else "2026-10",
            "dayOfWeek": clean_text(r[1]) if len(r) > 1 else "",
            "weekLabel": clean_text(r[2]) if len(r) > 2 else "שבוע שוטף",
            "salesInclVat": float(to_number(r[3]) or 0),
            "salesExclVat": float(to_number(r[4]) or 0),
            "totalHours": float(to_number(r[5]) or 0),
            "hourlyGrossSum": float(to_number(r[6]) or 0),
            "globalGrossSum": float(to_number(r[7]) or 0),
            "totalGrossWages": float(to_number(r[8]) or 0),
            "employerMultiplier": float(to_number(r[9]) or 1.30),
            "employerCost": float(to_number(r[10]) or 0),
            "netBalance": float(to_number(r[11]) or 0),
            "laborPct": float(to_number(r[12]) or 0),
            "splh": float(to_number(r[13]) or 0),
            "notes": clean_text(r[15]) if len(r) > 15 else "",
            "hourlyBoxes": hourly_boxes,
            "globalBoxes": global_boxes
        })

    # 8. Parse LOG_Counts (most recent 150 for fast UI, while keeping full accuracy)
    log_counts = []
    for idx, r in enumerate(reversed(counts_rows)):
        if len(r) < 3 or not clean_text(r[1]):
            continue
        iname = clean_text(r[1])
        qty = to_number(r[2]) or 0.0
        unit = clean_text(r[3]) if len(r) > 3 else ""
        ucost = to_number(r[4]) if len(r) > 4 else 0.0
        cval = to_number(r[5]) if len(r) > 5 else 0.0
        rep = clean_text(r[6]) if len(r) > 6 else "צוות מטבח"
        log_counts.append({
            "id": f"CNT-{len(counts_rows)-idx:04d}",
            "timestamp": str(clean_text(r[0])),
            "itemId": item_name_to_id.get(iname, ""),
            "itemName": iname,
            "countedQty": float(qty),
            "unit": unit,
            "unitCostSnapshot": float(ucost or 0),
            "totalCountValue": float(cval or 0),
            "reporter": rep
        })
        if len(log_counts) >= 150:
            break

    # 9. Parse LOG_Waste
    log_waste = []
    for idx, r in enumerate(reversed(waste_rows)):
        if len(r) < 4 or not clean_text(r[2]):
            continue
        iname = clean_text(r[2])
        wqty = to_number(r[3]) or 0.0
        unit = clean_text(r[4]) if len(r) > 4 else ""
        reason = clean_text(r[5]) if len(r) > 5 else "פג תוקף / קלקול"
        ucost = to_number(r[6]) if len(r) > 6 else 0.0
        tcost = to_number(r[7]) if len(r) > 7 else 0.0
        notes = clean_text(r[8]) if len(r) > 8 else ""
        log_waste.append({
            "id": f"WST-{len(waste_rows)-idx:03d}",
            "timestamp": str(clean_text(r[0])),
            "reporter": clean_text(r[1]) if len(r) > 1 else "ישראל",
            "itemId": item_name_to_id.get(iname, ""),
            "itemName": iname,
            "wasteQty": float(wqty),
            "stockUnit": unit,
            "wasteReason": reason,
            "unitCostSnapshot": float(ucost or 0),
            "totalWasteCost": round(float(tcost or 0), 2),
            "notes": notes
        })

    # 10. Parse LOG_Deliveries if present
    log_deliveries = []
    for idx, r in enumerate(deliveries_rows):
        if len(r) < 3 or not clean_text(r[0]):
            continue
        items_json = clean_text(r[7]) if len(r) > 7 else "[]"
        try:
            items_parsed = json.loads(items_json)
        except Exception:
            items_parsed = []
        log_deliveries.append({
            "id": clean_text(r[0]),
            "timestamp": clean_text(r[1]),
            "supplierName": clean_text(r[2]),
            "invoiceNumber": clean_text(r[3]) if len(r) > 3 else "",
            "receivedBy": clean_text(r[4]) if len(r) > 4 else "ישראל",
            "totalAmountExclVat": float(to_number(r[5]) or 0),
            "notes": clean_text(r[6]) if len(r) > 6 else "",
            "items": items_parsed
        })

    return {
        "config": config,
        "suppliers": suppliers,
        "catalog": catalog,
        "dishes": dishes,
        "recipeLines": recipe_lines,
        "prepChecklist": prep_checklist,
        "managerTasks": manager_tasks,
        "logCounts": log_counts,
        "logWaste": log_waste,
        "logLabor": log_labor,
        "logLaborDaily": log_labor_daily,
        "logDeliveries": log_deliveries
    }


def push_state_to_sheets(state, actions=None):
    """Writes SPA state and incremental actions back to the Google Spreadsheet safely."""
    api = Sheets(NEW_SPREADSHEET_ID)
    meta = api.get("sheets(properties(sheetId,title))")
    sheet_map = {s["properties"]["title"]: s["properties"]["sheetId"] for s in meta.get("sheets", [])}
    reqs = []

    actions = actions or []

    # 1. Handle incremental Append-Only Logs (COUNTS, WASTE, DELIVERIES)
    for act in actions:
        atype = act.get("type", "")
        payload = act.get("payload") or {}

        if atype == "COUNTS_BATCH_SAVED" and "LOG_Counts" in sheet_map:
            logs = payload.get("logs") or []
            if logs:
                existing = api.values("'LOG_Counts'!B1:B2000")
                next_row = len(existing)
                rows_c1 = []
                rows_c2 = []
                for l in logs:
                    dt_str = (l.get("timestamp") or "")[:10]
                    rows_c1.append([dt_str, l.get("itemName", ""), float(l.get("countedQty", 0))])
                    rows_c2.append([l.get("reporter", "צוות מטבח")])
                reqs.append(write_block(sheet_map["LOG_Counts"], next_row, 0, rows_c1))
                reqs.append(write_block(sheet_map["LOG_Counts"], next_row, 6, rows_c2))

        elif atype == "WASTE_LOGGED" and "LOG_Waste" in sheet_map:
            existing = api.values("'LOG_Waste'!C1:C1000")
            next_row = len(existing)
            dt_str = (payload.get("timestamp") or "")[:10]
            row_p1 = [[dt_str, payload.get("reporter", "ישראל"), payload.get("itemName", ""), float(payload.get("wasteQty", 0))]]
            row_reason = [[payload.get("wasteReason", "פג תוקף / קלקול")]]
            row_note = [[payload.get("notes", "")]]
            reqs.append(write_block(sheet_map["LOG_Waste"], next_row, 0, row_p1))
            reqs.append(write_block(sheet_map["LOG_Waste"], next_row, 5, row_reason))
            reqs.append(write_block(sheet_map["LOG_Waste"], next_row, 8, row_note))

        elif atype == "DELIVERY_RECORDED":
            # Ensure LOG_Deliveries exists
            if "LOG_Deliveries" not in sheet_map:
                add_res = api.batch_update([{
                    "addSheet": {
                        "properties": {
                            "title": "LOG_Deliveries",
                            "rightToLeft": True,
                            "gridProperties": {"rowCount": 500, "columnCount": 9, "frozenRowCount": 1}
                        }
                    }
                }])
                sheet_map["LOG_Deliveries"] = add_res["replies"][0]["addSheet"]["properties"]["sheetId"]
                reqs.append(write_block(sheet_map["LOG_Deliveries"], 0, 0, [[
                    "מזהה משלוח", "תאריך", "ספק", "מספר תעודה", "נקלט ע\"י", "סכום ללא מע\"מ", "הערות", "פירוט JSON"
                ]]))

            dlv_sid = sheet_map["LOG_Deliveries"]
            existing_dlv = api.values("'LOG_Deliveries'!A1:A500")
            next_dlv_row = max(1, len(existing_dlv))
            reqs.append(write_block(dlv_sid, next_dlv_row, 0, [[
                payload.get("id", ""),
                (payload.get("timestamp") or "")[:16].replace("T", " "),
                payload.get("supplierName", ""),
                payload.get("invoiceNumber", ""),
                payload.get("receivedBy", "ישראל"),
                float(payload.get("totalAmountExclVat", 0)),
                payload.get("notes", ""),
                json.dumps(payload.get("items", []), ensure_ascii=False)
            ]]))

            # Also append the updated stock counts to LOG_Counts so OPS_Inventory_Orders updates Current_Stock!
            if "LOG_Counts" in sheet_map and payload.get("items"):
                existing_cnt = api.values("'LOG_Counts'!B1:B2000")
                next_cnt_row = len(existing_cnt)
                c1, c2 = [], []
                dt_str = (payload.get("timestamp") or "")[:10]
                for itm in payload.get("items", []):
                    c1.append([dt_str, itm.get("itemName", ""), float(itm.get("newStock", 0))])
                    c2.append([f"קבלת סחורה ({payload.get('invoiceNumber', '')})"])
                reqs.append(write_block(sheet_map["LOG_Counts"], next_cnt_row, 0, c1))
                reqs.append(write_block(sheet_map["LOG_Counts"], next_cnt_row, 6, c2))

    # 2. Sync Config & Suppliers (DB_Config_Suppliers)
    if "DB_Config_Suppliers" in sheet_map and state.get("suppliers"):
        sup_sid = sheet_map["DB_Config_Suppliers"]
        cfg = state.get("config") or {}
        cfg_rows = [
            ["יעד פוד קוסט (Target_FoodCost)", float(cfg.get("targetFoodCost", 0.30)), "עלות חומרי גלם / מחיר מכירה ללא מע\"מ"],
            ["יעד לייבור מטבח (Target_LaborCost)", float(cfg.get("targetLaborCost", 0.15)), "עלות עבודה מטבח / פדיון ללא מע\"מ"],
            ["מקדם עלות מעסיק (Employer_Cost_Multiplier)", float(cfg.get("employerCostMultiplier", 1.30)), "שכר ברוטו × מקדם = עלות מעסיק אמיתית"],
            ['מע"מ (VAT)', float(cfg.get("vatRate", 0.18)), 'מע"מ בישראל'],
        ]
        reqs.append(write_block(sup_sid, 1, 8, cfg_rows))

        sup_rows = []
        for s in state["suppliers"]:
            days_str = ", ".join(s.get("deliveryDays") or []) if isinstance(s.get("deliveryDays"), list) else str(s.get("deliveryDays") or "")
            sup_rows.append([
                s.get("id", ""),
                s.get("name", ""),
                s.get("category", ""),
                s.get("contactName", ""),
                s.get("whatsappPhone", ""),
                days_str,
                bool(s.get("isActive", True))
            ])
        if sup_rows:
            reqs.append(write_block(sup_sid, 1, 0, sup_rows))

    # 3. Sync Catalog (DB_Catalog) — preserving Col A (Item_ID formula) and Col H (Effective_Cost formula)!
    if "DB_Catalog" in sheet_map and state.get("catalog"):
        cat_sid = sheet_map["DB_Catalog"]
        sup_id_to_name = {s["id"]: s["name"] for s in (state.get("suppliers") or [])}
        cat_part1 = []  # Cols B..G (indices 1..6)
        cat_part2 = []  # Cols I..N (indices 8..13)
        for item in state["catalog"]:
            sup_name = item.get("supplierName") or sup_id_to_name.get(item.get("supplierId"), "")
            cat_part1.append([
                item.get("name", ""),
                item.get("category", ""),
                sup_name,
                item.get("stockUnit", 'ק"ג'),
                float(item.get("unitCostExclVat", 0)),
                float(item.get("yieldLossPct", 0))
            ])
            cat_part2.append([
                float(item.get("parLevelWeekend", 0)),
                float(item.get("reorderPoint", 0)),
                bool(item.get("isActive", True)),
                bool(item.get("inCountForm", True)),
                bool(item.get("inWasteForm", True)),
                item.get("notes", "")
            ])
        if cat_part1:
            reqs.append(write_block(cat_sid, 1, 1, cat_part1))
            reqs.append(write_block(cat_sid, 1, 8, cat_part2))

    # 4. Sync OPS_Kitchen_Tasks (Table 1: Manager Tasks, Table 2: Station Prep Checklists)
    if "OPS_Kitchen_Tasks" in sheet_map:
        tsk_sid = sheet_map["OPS_Kitchen_Tasks"]
        if state.get("managerTasks") is not None:
            t_rows = []
            for t in state["managerTasks"]:
                status_val = "✅ הושלם" if t.get("status") == "הושלם" else (t.get("status") or "⏳ לביצוע")
                t_rows.append([
                    t.get("id", ""),
                    t.get("title", ""),
                    t.get("area", "מטבח"),
                    t.get("assignee", "ישראל"),
                    t.get("priority", "רגילה"),
                    t.get("frequency", "חד-פעמי"),
                    t.get("dueDate", ""),
                    status_val,
                    t.get("notes", "")
                ])
            reqs.append({"updateCells": {"range": grid(tsk_sid, 1, 60, 0, 9), "fields": "userEnteredValue"}})
            if t_rows:
                reqs.append(write_block(tsk_sid, 1, 0, t_rows))

        if state.get("prepChecklist") is not None:
            p_rows = []
            for p in state["prepChecklist"]:
                p_rows.append([
                    p.get("station", "כללי"),
                    p.get("prepItem", ""),
                    p.get("frequency", "יומי"),
                    int(p.get("estMinutes", 15)),
                    bool(p.get("doneToday", False)),
                    p.get("instructions", "")
                ])
            reqs.append({"updateCells": {"range": grid(tsk_sid, 1, 60, 10, 16), "fields": "userEnteredValue"}})
            if p_rows:
                reqs.append(write_block(tsk_sid, 1, 10, p_rows))

    # 5. Sync OPS_Daily_Labor (Daily/Weekly shift labor with hourly & global boxes)
    daily_tab = "OPS_Daily_Labor"
    if daily_tab not in sheet_map:
        res = api.batch_update([{
            "addSheet": {
                "properties": {
                    "title": daily_tab,
                    "rightToLeft": True,
                    "gridProperties": {"rowCount": 500, "columnCount": 17, "frozenRowCount": 1}
                }
            }
        }])
        sheet_map[daily_tab] = res["replies"][0]["addSheet"]["properties"]["sheetId"]

    daily_sid = sheet_map[daily_tab]
    daily_headers = [[
        "תאריך",
        "יום בשבוע",
        "שבוע",
        "הכנסה ברוטו ₪",
        "הכנסה נטו (ללא מע\"מ) ₪",
        "סה\"כ שעות",
        "שכר שעתי ברוטו ₪",
        "שכר שף / גלובלי ₪",
        "סה\"כ שכר ברוטו ₪",
        "מקדם דמי מעביד",
        "עלות מעסיק כוללת ₪",
        "הכנסה נגד הוצאה (נטו) ₪",
        "אחוז לייבור %",
        "SPLH ₪",
        "פירוט תיבות עובדים (שעתי + גלובלי)",
        "הערות",
        "Boxes_JSON"
    ]]

    daily_rows = []
    for d in (state.get("logLaborDaily") or []):
        boxes_str = " | ".join(
            [f"{b.get('roleLabel','')}: {b.get('hours',0)}ש'*₪{b.get('hourlyRate',0)}" for b in (d.get("hourlyBoxes") or [])] +
            [f"{g.get('roleLabel','')}: ₪{g.get('amount',0)} (גלובלי)" for g in (d.get("globalBoxes") or [])]
        )
        boxes_json = json.dumps({
            "hourlyBoxes": d.get("hourlyBoxes") or [],
            "globalBoxes": d.get("globalBoxes") or []
        }, ensure_ascii=False)
        daily_rows.append([
            d.get("date", ""),
            d.get("dayOfWeek", ""),
            d.get("weekLabel", ""),
            float(d.get("salesInclVat", 0)),
            float(d.get("salesExclVat", 0)),
            float(d.get("totalHours", 0)),
            float(d.get("hourlyGrossSum", 0)),
            float(d.get("globalGrossSum", 0)),
            float(d.get("totalGrossWages", 0)),
            float(d.get("employerMultiplier", 1.3)),
            float(d.get("employerCost", 0)),
            float(d.get("netBalance", 0)),
            float(d.get("laborPct", 0)),
            float(d.get("splh", 0)),
            boxes_str,
            d.get("notes", ""),
            boxes_json
        ])

    reqs.append({"updateCells": {"range": grid(daily_sid, 0, 200, 0, 17), "fields": "userEnteredValue"}})
    reqs.append(write_block(daily_sid, 0, 0, daily_headers + daily_rows))

    # 6. Sync Monthly Labor in OPS_Labor_Tracker
    if "OPS_Labor_Tracker" in sheet_map and state.get("logLabor"):
        labor_sid = sheet_map["OPS_Labor_Tracker"]
        m_rows = []
        for idx, m in enumerate(state.get("logLabor") or []):
            r_num = idx + 2
            m_rows.append([
                m.get("monthId", ""),
                float(m.get("salesInclVat", 0)),
                f'=IF(B{r_num}="","", IF(B{r_num}>0, B{r_num} / (1 + CFG_VAT), 0))',
                float(m.get("serviceHours", 0)),
                float(m.get("prepHours", 0)),
                f'=IF(AND(D{r_num}="", E{r_num}=""), "", N(D{r_num}) + N(E{r_num}))',
                float(m.get("hourlyWagesGross", 0)),
                float(m.get("salariedGross", 0)),
                f'=IF(AND(G{r_num}="", H{r_num}=""), "", N(G{r_num}) + N(H{r_num}))',
                f'=IF(I{r_num}="","", I{r_num} * CFG_Employer_Cost_Multiplier)',
                f'=IF(OR(C{r_num}="", C{r_num}=0), "", J{r_num} / C{r_num})',
                '=CFG_Target_LaborCost',
                f'=IF(K{r_num}="","", IF(K{r_num}>CFG_Target_LaborCost, "חורג 🔴", "תקין 🟢"))',
                f'=IF(OR(F{r_num}="", F{r_num}=0), "", C{r_num} / F{r_num})',
                f'=IF(OR(F{r_num}="", F{r_num}=0), "", J{r_num} / F{r_num})',
                m.get("notes", "")
            ])
        if m_rows:
            reqs.append(write_block(labor_sid, 1, 0, m_rows))

    # 7. Sync Recipes & Food Cost (OPS_Recipes_FoodCost) if modified
    recipe_actions = {"DISH_CREATED", "DISH_UPDATED", "DISH_DELETED", "RECIPE_LINE_ADDED", "RECIPE_LINE_UPDATED", "RECIPE_LINE_DELETED"}
    if "OPS_Recipes_FoodCost" in sheet_map and (not actions or any(a.get("type") in recipe_actions for a in actions)):
        rec_sid = sheet_map["OPS_Recipes_FoodCost"]
        dishes = state.get("dishes") or []
        rlines = state.get("recipeLines") or []
        cat_id_to_name = {c["id"]: c["name"] for c in (state.get("catalog") or [])}
        dish_id_to_name = {d["id"]: d["name"] for d in dishes}

        dish_cells = []
        for row_idx, d in enumerate(dishes):
            r_num = row_idx + 2
            name = d.get("name", "")
            cat = d.get("category", "")
            yld = float(d.get("yieldPortions", 1))
            price = float(d.get("priceInclVat", 0)) if d.get("dishType") == "MENU_ITEM" else 0
            sales = int(d.get("weeklySalesQty", 35)) if d.get("dishType") == "MENU_ITEM" else 0

            f_cost = f'=IF(A{r_num}="","", IFERROR(SUMIF(N$2:N, A{r_num}, R$2:R), 0))'
            f_portion_cost = f'=IF(D{r_num}="","", IF(C{r_num}>0, D{r_num} / C{r_num}, D{r_num}))'
            f_ex_vat = f'=IF(F{r_num}="","", IF(F{r_num}>0, F{r_num} / (1 + CFG_VAT), 0))'
            f_fc = f'=IF(G{r_num}="","", IF(G{r_num}>0, E{r_num} / G{r_num}, 0))'
            f_profit = f'=IF(G{r_num}="","", IF(G{r_num}>0, G{r_num} - E{r_num}, 0))'
            f_status = f'=IF(A{r_num}="","", IF(F{r_num}=0, "מתכון הכנה ⚪", IF(H{r_num}>CFG_Target_FoodCost, "חורג 🔴", "תקין 🟢")))'
            f_matrix = (
                f'=IF(OR(A{r_num}="", F{r_num}="", F{r_num}=0), "", '
                f'LET(p, I{r_num}, s, IF(ISNUMBER(L{r_num}), L{r_num}, 50), '
                f'avg_p, IFERROR(AVERAGEIF($F$2:$F$35, ">0", $I$2:$I$35), 30), '
                f'avg_s, IFERROR(AVERAGEIF($F$2:$F$35, ">0", $L$2:$L$35), 50), '
                f'IF(AND(p>=avg_p, s>=avg_s), "כוכב ⭐", '
                f'IF(AND(p<avg_p, s>=avg_s), "סוס עבודה 🐴", '
                f'IF(AND(p>=avg_p, s<avg_s), "חידה 🧩", "כלב 🐕")))))'
            )
            dish_cells.append([name, cat, yld, f_cost, f_portion_cost, price, f_ex_vat, f_fc, f_profit, f_status, f_matrix, sales])

        line_cells = []
        for l_idx, line in enumerate(rlines):
            r_num = l_idx + 2
            parent_name = line.get("parentDishName") or dish_id_to_name.get(line.get("parentDishId"), "")
            if line.get("componentType") == "SUB_RECIPE":
                ing_name = line.get("componentName") or dish_id_to_name.get(line.get("componentId"), "")
            else:
                ing_name = line.get("componentName") or cat_id_to_name.get(line.get("componentId"), line.get("componentId", ""))
            qty = float(line.get("quantity", 0))
            notes = line.get("notes", "")
            f_unit = f'=IF(O{r_num}="","", IFERROR(XLOOKUP(O{r_num}, DB_Catalog!$B$2:$B, DB_Catalog!$E$2:$E), IFERROR(XLOOKUP(O{r_num}, $A$2:$A, "מנה", ""), "")))'
            f_line_cost = (
                f'=IF(OR(O{r_num}="", P{r_num}=""), "", '
                f'P{r_num} * IFERROR(XLOOKUP(O{r_num}, DB_Catalog!$B$2:$B, DB_Catalog!$H$2:$H), '
                f'IFERROR(XLOOKUP(O{r_num}, $A$2:$A, $E$2:$E, 0), 0)))'
            )
            line_cells.append([parent_name, ing_name, qty, f_unit, f_line_cost, notes])

        reqs.append({"updateCells": {"range": grid(rec_sid, 1, 60, 0, 12), "fields": "userEnteredValue"}})
        if dish_cells:
            reqs.append(write_block(rec_sid, 1, 0, dish_cells))
        reqs.append({"updateCells": {"range": grid(rec_sid, 1, 150, 13, 19), "fields": "userEnteredValue"}})
        if line_cells:
            reqs.append(write_block(rec_sid, 1, 13, line_cells))

    if reqs:
        api.batch_update(reqs)

    return {"synced": True, "spreadsheetId": NEW_SPREADSHEET_ID, "updatedBlocks": len(reqs)}

