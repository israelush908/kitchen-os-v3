"""Migration of recipes, menu dishes and food-cost data from the legacy winery sheet.

Maps:
  - 'B3 פוד קוסט מנות' -> Table A (Menu Dishes, Pricing & Categories)
  - 'B2 מתכונים'        -> Table B (Recipe Ingredients Breakdown)
"""
from common import OLD_SPREADSHEET_ID, Sheets, clean_text, to_number

TYPO_MAP = {
    "אננ": "אננס",
    "בצל": "בצל אדום",
    "פוקצ' חריפים": "פוקאצ'ה",
    "פלטה גבינות": "פלטת גבינות",
    "באסקית": "באסקית גבינה",
    "שוקולד": "שוקולד חמה",
    "קולה גדול": "קולה",
    "זירו גדול": "זירו",
    "סודה גדול": "סודה",
}

CATEGORY_MAP = {
    "רוטב קיסר": "מתכוני הכנה",
    "מטבל עגבניות פוקאצ'ה": "מתכוני הכנה",
    "מטבל טחינה": "מתכוני הכנה",
    "סלט קיסר": "סלטים",
    "סלט קפרזה": "סלטים",
    "פלטת גבינות": "פלטות",
    "פיצה": "פיצות ומאפים",
    "פוקאצ'ה": "פיצות ומאפים",
    "עלי גפן": "מנות פתיחה ונשנושים",
    "באסקית גבינה": "קינוחים",
    "ביסקוויט": "קינוחים",
    "שוקולד חמה": "קינוחים",
    "יין": "שתייה",
    "קולה": "שתייה",
    "זירו": "שתייה",
    "סודה": "שתייה",
    "מים": "שתייה",
}

def extract_recipes_and_dishes():
    old = Sheets(OLD_SPREADSHEET_ID, readonly=True)
    b3_raw = old.values("'B3 פוד קוסט מנות'!A1:J30")
    b2_raw = old.values("'B2 מתכונים'!A1:F80")

    # 1. Parse Dishes from B3
    dishes = []
    seen_dishes = set()
    for r in b3_raw[2:]:  # header is at row 2
        if not r or not any(str(x).strip() for x in r):
            continue
        raw_name = clean_text(r[0] if len(r) > 0 else "")
        dish_name = TYPO_MAP.get(raw_name, raw_name)
        if not dish_name or dish_name in seen_dishes:
            continue
        seen_dishes.add(dish_name)

        cat = CATEGORY_MAP.get(dish_name, "מנות כללי")
        price_inc_vat = to_number(r[3] if len(r) > 3 else 0) or 0
        weekly_sales = to_number(r[7] if len(r) > 7 else 0) or 0
        yield_portions = 1
        if "מטבל" in dish_name or "רוטב" in dish_name:
            yield_portions = 10  # batch makes ~10 portions

        dishes.append({
            "name": dish_name,
            "category": cat,
            "yield": yield_portions,
            "price_inc_vat": price_inc_vat,
            "sales_qty": weekly_sales,
        })

    # 2. Parse Recipe Lines from B2
    recipe_lines = []
    for r in b2_raw[1:]:
        if not r or not any(str(x).strip() for x in r):
            continue
        raw_parent = clean_text(r[0] if len(r) > 0 else "")
        parent = TYPO_MAP.get(raw_parent, raw_parent)
        raw_ing = clean_text(r[1] if len(r) > 1 else "")
        ing = TYPO_MAP.get(raw_ing, raw_ing)
        if not parent or not ing:
            continue

        qty = to_number(r[2] if len(r) > 2 else 0)
        unit = clean_text(r[3] if len(r) > 3 else "")
        notes = clean_text(r[5] if len(r) > 5 else "")

        recipe_lines.append({
            "parent": parent,
            "ingredient": ing,
            "qty": qty if qty is not None else 0,
            "unit": unit,
            "notes": notes,
        })

    return dishes, recipe_lines
