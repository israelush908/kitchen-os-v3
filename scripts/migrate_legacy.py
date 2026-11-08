"""Read-only migration from the old winery sheet -> rows for DB_Config_Suppliers / DB_Catalog.

Replaces the Apps Script `Migration Scrip.js` with these fixes:
  * never writes column A of DB_Catalog (owned by the MAP formula)
  * SUP-01 numbering starts at 01
  * trims names / strips invisible bidi chars; de-duplicates item names
  * maps legacy categories & units onto the new dropdown lists
  * phones -> 972XXXXXXXXX
  * Par / Reorder looked up by (name, supplier); left blank when unknown (no fake 20/5)
  * batch write (one API call) instead of cell-by-cell setValue
"""
from common import OLD_SPREADSHEET_ID, Sheets, a1_sheet, clean_text, normalize_il_phone, to_number

OLD_SUPPLIERS = "G1 ספקים"
OLD_CATALOG = "B1 חומרי גלם"
OLD_INVENTORY = "C1 ניהול מלאי"

# ---- New master lists (DB_Config_Suppliers M:P) ----
ITEM_CATEGORIES = [
    "ירקות ופירות", "גבינות ומחלבה", "לחמים ומאפים", "יבשים ושימורים",
    "רטבים וממרחים", "קינוחים", "מתכלים וחומרי ניקוי",
    "שתייה",  # added: 10 legacy drink items have no other home
]
UNITS = ['ק"ג', "ליטר", "יח'", "נספק", "צרור", "קרטון", "אריזה"]
STATIONS = ["פלטות וגבינות", "ברוסקטות וסלטים", "הכנות קרות", "שטיפה וניקיון", "כללי/ניהול"]
WASTE_REASONS = ["פג תוקף / קלקול", "הכנת יתר", "טעות בהכנה / שריפה", "פגום מהספק", "נפילה / שבירה"]
SUPPLIER_CATEGORIES = ["ירקות", "מחלבה", "לחמים ומתוקים", "יבשים", "אריזות ומתכלים", "שתייה", "קרח"]

# ---- Legacy -> new mappings ----
ITEM_CATEGORY_MAP = {
    "ירקות": "ירקות ופירות",
    "חלבי": "גבינות ומחלבה",
    "קינוחים": "קינוחים",
    "יבש": "יבשים ושימורים",
    "מטבלים": "רטבים וממרחים",
    "חומרי ניקוי": "מתכלים וחומרי ניקוי",
    "פיצה": "לחמים ומאפים",
    "שתייה": "שתייה",
}
UNIT_MAP = {
    'ק"ג': 'ק"ג', "ליטר": "ליטר", "יח'": "יח'", "נספק": "נספק", "צרור": "צרור", "קרטון": "קרטון",
    "קופסא": "אריזה", "שקית": "אריזה", "דלי": "אריזה",
    "בקבוק": "יח'",
    "ארגז": "קרטון",
}
SUPPLIER_CATEGORY_MAP = {
    "ירקות": "ירקות",
    "חלבי": "מחלבה", "גבינות": "מחלבה",
    "קינוחים": "לחמים ומתוקים", "לחמים": "לחמים ומתוקים", "פיצה": "לחמים ומתוקים",
    "יבש": "יבשים",
    "חומרי ניקוי": "אריזות ומתכלים",
    "שתייה": "שתייה",
    "קרח": "קרח",
}
# Legacy rows whose category was literally "בלאנק" (placeholder) - resolved by what they supply.
SUPPLIER_CATEGORY_OVERRIDE = {"בלאנק": "שתייה", "פיצה מרקט": "מחלבה"}


def _row(r, i):
    return r[i] if i < len(r) else ""


def load_old():
    old = Sheets(OLD_SPREADSHEET_ID, readonly=True)  # read-only scope: cannot modify the legacy sheet
    return (
        old.values(a1_sheet(OLD_SUPPLIERS) + "!A1:F"),
        old.values(a1_sheet(OLD_CATALOG) + "!A1:G"),
        old.values(a1_sheet(OLD_INVENTORY) + "!A1:J"),
    )


def build_rows():
    sup_raw, cat_raw, inv_raw = load_old()
    report = {"warnings": []}

    # ---------- Suppliers: G1 = [name, contact, category, supplies, phone] ----------
    suppliers = []
    seen = set()
    for r in sup_raw[1:]:
        name = clean_text(_row(r, 0))
        if not name or name in seen:
            continue
        seen.add(name)
        legacy_cat = clean_text(_row(r, 2))
        cat = SUPPLIER_CATEGORY_OVERRIDE.get(name) or SUPPLIER_CATEGORY_MAP.get(legacy_cat, legacy_cat)
        phone = normalize_il_phone(_row(r, 4))
        if clean_text(_row(r, 4)) and not phone:
            report["warnings"].append(f"טלפון לא תקין לספק {name}: {_row(r, 4)}")
        contact = clean_text(_row(r, 1))
        if contact == name:  # legacy placeholder ("בלאנק" | "בלאנק")
            contact = ""
        supplies = clean_text(_row(r, 3))
        suppliers.append({
            "id": f"SUP-{len(suppliers) + 1:02d}",
            "name": name, "category": cat, "contact": contact, "phone": phone,
            "delivery_days": "", "active": True,
            "note": f"מספק: {supplies}" if supplies else None,
        })
    supplier_names = {s["name"] for s in suppliers}

    # ---------- Inventory lookup: C1 = [item, cat, supplier, unit, stock, par, reorder, ...] ----------
    inv_by_pair, inv_by_name = {}, {}
    for r in inv_raw[1:]:
        n, sup = clean_text(_row(r, 0)), clean_text(_row(r, 2))
        if not n:
            continue
        rec = {"par": to_number(_row(r, 5)), "reorder": to_number(_row(r, 6))}
        inv_by_pair[(n, sup)] = rec
        inv_by_name.setdefault(n, rec)

    # ---------- Catalog: B1 = [name, category, supplier, unit, price, sku, note] ----------
    items, name_count = [], {}
    for r in cat_raw[1:]:
        name = clean_text(_row(r, 0))
        if not name:
            continue
        sup = clean_text(_row(r, 2))
        legacy_cat, legacy_unit = clean_text(_row(r, 1)), clean_text(_row(r, 3))

        cat = ITEM_CATEGORY_MAP.get(legacy_cat, "") if legacy_cat else ""
        if legacy_cat and not cat:
            report["warnings"].append(f"קטגוריה לא ממופה '{legacy_cat}' בפריט {name}")
        unit = UNIT_MAP.get(legacy_unit, "") if legacy_unit else ""
        if legacy_unit and not unit:
            report["warnings"].append(f"יחידה לא ממופה '{legacy_unit}' בפריט {name}")
        if sup and sup not in supplier_names:
            report["warnings"].append(f"ספק '{sup}' של {name} לא קיים ברשימת הספקים")

        final_name = name
        if name in name_count:  # Item_Name must be unique
            final_name = f"{name} ({sup or 'כפול'})"
            report["warnings"].append(f"שם כפול '{name}' -> שונה ל-'{final_name}'")
        name_count[name] = name_count.get(name, 0) + 1

        inv = inv_by_pair.get((name, sup)) or inv_by_name.get(name) or {}
        notes = []
        if legacy_unit and UNIT_MAP.get(legacy_unit) not in (None, legacy_unit):
            notes.append(f"יחידה מקורית: {legacy_unit}")
        if clean_text(_row(r, 5)):
            notes.append(f'מק"ט: {clean_text(_row(r, 5))}')
        if clean_text(_row(r, 6)):
            notes.append(f"הערה מקורית: {clean_text(_row(r, 6))}")

        items.append({
            "name": final_name, "category": cat, "supplier": sup, "unit": unit,
            "cost": to_number(_row(r, 4)), "yield_loss": 0,
            "par": inv.get("par"), "reorder": inv.get("reorder"),
            "active": True, "in_count": True, "in_waste": True,
            "notes": " | ".join(notes),
        })

    report["suppliers"] = len(suppliers)
    report["items"] = len(items)
    report["missing_price"] = [i["name"] for i in items if i["cost"] in (None, "")]
    report["missing_par"] = [i["name"] for i in items if i["par"] in (None, "")]
    return suppliers, items, report
