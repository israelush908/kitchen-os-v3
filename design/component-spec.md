project_id: kitchen-os-field
platform: mobile-web
device_frame: iPhone 15 — 393x852
ui_language: he
direction: rtl
source_renders:
  - field-inventory: design/renders/field-inventory.png (and design/renders/field-inventory.html)
  - field-prep: design/renders/field-prep.png (and design/renders/field-prep.html)
  - field-prep-sheet: design/renders/field-prep-sheet.png (and design/renders/field-prep-sheet.html)
  - field-orders: design/renders/field-orders.png (and design/renders/field-orders.html)
  - field-waste: design/renders/field-waste.png (and design/renders/field-waste.html)

# Developer Component Specification · Kitchen OS v3.0 — Field Mode (Swiss Kitchen Editorial)

> נוצר בשלב ג' (Post-Stitch Visual Ingestion) על ידי ניתוח הרינדורים וקוד ה-HTML מתוך `design/renders/`.
> זהו המפרט הטכני הסופי למחלקת הפיתוח עבור מצב השטח (Field Mode).

## 1. סקירת מסכים ומצב כיסוי דרישות (R73)

| REQ | דרישה מבריף ה-UX | screen_id שבו היא מופיעה | סטטוס ברינדור של Stitch | הערת התאמה / פער |
|---|---|---|---|---|
| REQ-01 | כותרת עליונה קומפקטית (`56px`) עם שם המערכת ("Kitchen OS v3.0"), מתג מצבים ("שטח" / "משרד") וחיווי סנכרון ("מסונכרן") | `field-inventory`, `field-prep`, `field-orders`, `field-waste` | MATCH (תואם) | מופיע בכל המסכים עם מסגרת תחתונה `1.5px solid #0F1115`, מתג מצבים פעיל בשחור דיו `#0F1115` ונקודה ירוקה `#15803D` |
| REQ-02 | סרגל ניווט תחתון קבוע למצב שטח עם 4 יעדים בדיוק (R45) | `field-inventory`, `field-prep`, `field-orders`, `field-waste` | GAP_RESOLVED_IN_SPEC (פער תוויות נסגר במפרט) | Stitch רינדר 4 לשוניות עם אייקונים וקטוריים והתוויות הקצרות "מלאי / הכנות / ספירה / יומן". במפרט הקומפוננטה `FieldBottomNavBar` אוחדו התוויות המדויקות ל-4 מודולי המערכת: "ספירת מלאי" (`inventory`), "הכנות וסרוויס" (`prep`), "הזמנות רכש" (`orders`), "דיווח פחת" (`waste`) |
| REQ-03 | במסך ספירת מלאי: חיפוש מהיר בעברית וסינון אופקי לפי קטגוריות ("גבינות ומחלבה", "הכל", "ירקות ופירות", "לחמים ומאפים", "יבשים") | `field-inventory` | MATCH (תואם) | שדה חיפוש בגובה `48px` עם אייקון זכוכית מגדלת וקטורי מימין, ותגיות סינון אופקיות כאשר הפעילה ב-Apron Cobalt `#1D4ED8` |
| REQ-04 | במסך ספירת מלאי: שורות פריטים ממוסגרות בבירור עם שם הפריט, תגית יחידה, תקן סופ"ש, וכפתורי Stepper גדולים (`48x48px`) | `field-inventory` | MATCH (תואם) | שורות שטוחות (`min-height: 92px`) עם קווי הפרדה `1.5px solid #0F1115`, פס צד `#1D4ED8` (`4px`) לפריט שעודכן, וכפתורי `-`/`+` בגודל `48x48px` עם מספרים ב-`Space Mono 24px Bold` |
| REQ-05 | במסך ספירת מלאי: כפתור פעולה ראשי יחיד (R11) מעל סרגל הניווט: "שמור ועדכן מלאי (3 פריטים)" | `field-inventory` | MATCH (תואם) | כפתור רוחב מלא בגובה `52px` בצבע Chef Vermilion `#EA580C` עם מסגרת `1.5px solid #0F1115` וטקסט לבן מודגש |
| REQ-06 | במסך הכנות וסרוויס: סינון לפי עמדות ומד התקדמות כנה ("3 מתוך 6 הושלמו", "40 דק' נותרו", פס 50% מימין לשמאל) | `field-prep` | MATCH (תואם) | כרטיס התקדמות עמדה ממוסגר עם תג זמן שחור `#0F1115` ופס התקדמות אופקי המתמלא מימין לשמאל (`RTL`) |
| REQ-07 | במסך הכנות וסרוויס: רשימת משימות הכנה עם תיבת סימון גדולה (`48x48px`), כמות יעד, זמן מוערך וכפתור "מתכון" | `field-prep` | MATCH (תואם) | 4 משימות עם אזור לחיצה `48x48px` לתיבת הסימון מימין, תגית כמות מונוספייס, וכפתור "מתכון" (`min-height: 48px`) משמאל |
| REQ-08 | במגירת מתכון והוראות הכנה (Bottom Sheet): הצגת שם המתכון, תפוקת אצווה, טבלת מרכיבים מדויקת (BOM), שלבי הכנה ממוספרים וכפתור "סמן הכנה כהושלמה" | `field-prep-sheet` | MATCH (תואם) | מגירה תחתונה (`84%` גובה) עם כפתור סגירה `48x48px`, סרגל מפרט אצווה ב-3 עמודות, טבלת BOM עם משקלים ב-`Space Mono 22px`, 3 שלבים ממוספרים וכפתור CTA כתום-ורמיליון |
| REQ-09 | במסך הזמנות רכש: קיבוץ לפי ספק ("אשי שוק", "מחלבות גד"), השוואת מלאי מול תקן סופ"ש, התאמת כמות להזמנה (`48x48px`), שורת סיכום אומדן כספי, וכפתור "שלח הזמנה בוואטסאפ לאשי שוק" | `field-orders` | MATCH (תואם) | טאבים לבחירת ספק (`48px` גובה), טבלת הזמנה אחידה ללא כרטיסים מקוננים (R46), תגית "אזל במלאי" ב-`#B91C1C`, שורת סיכום `₪385.00` וכפתור שיגור וואטסאפ |
| REQ-10 | במסך דיווח פחת: טופס 3 שלבים (בחירת פריט, כמות ב-Stepper + כפתורי קיצור `+0.25`/`+0.50`/`+1.00`, בחירת סיבה ב-Grid 2x2), חישוב עלות כספית בזמן אמת (`₪42.50`) וכפתור אישור | `field-waste` | MATCH (תואם) | שלושת השלבים ממוספרים וברורים, כפתורי קיצור בגובה `48px`, גריד סיבות `2x2` בגובה `48px`, בלוק קבלה עם עלות `₪42.50` ב-`#B91C1C` ויתרת מלאי `2.50 ק"ג` |
| REQ-11 | עמידה בתקני מובייל ונגישות: RTL מלא (R22), יעדי מגע מינימליים `48x48px` / `48dp` (R20), טקסט גוף `>=16px` (R44), ללא אימוג'י (R21), וללא כרטיס בתוך כרטיס (R46) | כל 5 המסכים | MATCH (תואם) | כל האייקונים וקטוריים (SVG / Material Symbols Outlined), יעדי לחיצה של `48x48px` עד `52px`, ניגודיות טקסט ראשי `17.4:1` (`#0F1115` על `#FFFFFF`) |
| REQ-12 | שמירה מקומית שקופה (Offline Queue) וסנכרון ל-Google Sheets API v4 ברקע | כל מסכי השטח | GAP_RESOLVED_IN_SPEC (דרישה לא-חזותית + חיווי ב-Header) | הלוגיקה ממומשת ב-`syncService.js`, והחיווי החזותי מופיע ב-`TopAppBar` דרך תג הסטטוס ("מסונכרן" / "שמור מקומית") ובאנר `partial-error` |

---

## 2. מפת מסכים (Screen Inventory)

| screen_id | כותרת / שם | קובץ מקור ב-renders | סוג רינדור (HTML/PNG) | רכיב עליון (Root Component) |
|---|---|---|---|---|
| `field-inventory` | ספירת מלאי שטח | `design/renders/field-inventory.png` + `.html` | PNG + HTML (`Render HTML`) | `FieldInventoryView` (`js/views/fieldInventory.js`) |
| `field-prep` | הכנות וסרוויס לפי עמדות | `design/renders/field-prep.png` + `.html` | PNG + HTML (`Render HTML`) | `FieldPrepView` (`js/views/fieldPrep.js`) |
| `field-prep-sheet` | מגירת מתכון הכנה ו-BOM | `design/renders/field-prep-sheet.png` + `.html` | PNG + HTML (`Render HTML`) | `PrepRecipeBottomSheet` (בתוך `js/views/fieldPrep.js`) |
| `field-orders` | הזמנות רכש חכמות ושיגור וואטסאפ | `design/renders/field-orders.png` + `.html` | PNG + HTML (`Render HTML`) | `FieldOrdersView` (`js/views/fieldOrders.js`) |
| `field-waste` | דיווח פחת מהיר ב-5 שניות | `design/renders/field-waste.png` + `.html` | PNG + HTML (`Render HTML`) | `FieldWasteView` (`js/views/fieldWaste.js`) |

---

## 3. קטלוג רכיבים מפורט (Component Breakdown)

### 3.1 טוקנים חזותיים מחולצים מרינדורי Stitch (`Render HTML`)

כל הערכים להלן חולצו ישירות מתוך קובצי ה-HTML המיוצאים מ-Google Stitch (`design/renders/*.html`) ומערכת העיצוב `Swiss Kitchen Editorial` (`assets/1a9c219d54874f90aa3a4059ee69bb4d`):

- **צבעים (Color Tokens):**
  - `--color-bg-canvas`: `#F8F7F4` (Cotton Paper — רקע ראשי של האפליקציה, מונע סנוור תחת תאורת מטבח)
  - `--color-bg-surface`: `#FFFFFF` (Crisp White — משטח שורות, טבלאות, כרטיסי משימה ומגירות)
  - `--color-ink-primary`: `#0F1115` (Obsidian Ink — טקסט ראשי, כותרות, ומסגרות מבניות `1.5px solid`; ניגודיות `17.4:1` מול לבן ו-`16.2:1` מול נייר כותנה)
  - `--color-ink-secondary`: `#4B5563` (Slate Charcoal — טקסט מטא-דאטה, תקני סופ"ש ותוויות משנה; ניגודיות `7.5:1` מול לבן — עובר WCAG AAA)
  - `--color-border-rule`: `#D6D3C9` (Warm Stone — קווי הפרדה פנימיים בטבלאות `1px solid`)
  - `--color-accent-vermilion`: `#EA580C` (Chef Vermilion — צבע מילוי לכפתור ה-CTA הראשי בלבד, עם מסגרת `1.5px solid #0F1115` וטקסט `#FFFFFF`; במצב לחיצה/ריחוף `#CC4900`)
  - `--color-accent-cobalt`: `#1D4ED8` (Apron Cobalt — טאב/פילטר פעיל, צ'יפ סיבה נבחר, ופס חיווי ימני `4px` לשורה שעודכנה; ניגודיות `6.7:1` מול טקסט לבן)
  - `--color-status-ok`: `#15803D` (Forest Green — תגית "תקין", נקודת סנכרון, ותיבת סימון שהושלמה; רקע תגית `#F0FDF4`)
  - `--color-status-warning`: `#B45309` (Amber Ochre — תגית אזהרה / סנכרון ממתין; רקע תגית `#FFFBEB`)
  - `--color-status-danger`: `#B91C1C` (Crimson Red — תגית "חוסר" / "אזל במלאי" וסכום עלות פחת; רקע תגית `#FEF2F2`)

- **טיפוגרפיה (Typography Tokens):**
  - `--font-sans-hebrew`: `'Rubik', 'Heebo', sans-serif`
  - `--font-mono-tabular`: `'Space Mono', 'JetBrains Mono', monospace` (עם `font-variant-numeric: tabular-nums` ו-`direction: ltr` למספרים)
  - `headline-lg-mobile`: `24px` / line-height `30px` / weight `700` / letter-spacing `-0.01em`
  - `headline-md`: `20px` / line-height `26px` / weight `700`
  - `headline-sm`: `18px` / line-height `24px` / weight `700`
  - `body-lg`: `16px` / line-height `22px` / weight `500` (גודל מינימלי לטקסט גוף ושדות קלט במובייל — R44)
  - `body-md`: `14px` / line-height `20px` / weight `400` (למטא-דאטה משני)
  - `label-caps`: `12px` / line-height `16px` / weight `700` (רצפת גודל טקסט מינימלית לפי R23 — עודכן מ-11px ל-12px לעמידה מלאה ב-R23)
  - `label-numeric-lg`: `26px` (`Space Mono Bold`) — לתצוגת כמות ראשית ב-Stepper ולעלות פחת
  - `label-numeric-md`: `22px` (`Space Mono Bold`) — למשקלים בטבלת BOM ולכמויות הזמנה

- **גיאומטריה, גבולות וצללים (Shape, Border & Elevation Tokens):**
  - `--border-structural`: `1.5px solid #0F1115`
  - `--border-hairline`: `1px solid #D6D3C9`
  - `--radius-ticket`: `6px` (רדיוס אחיד לכל הכפתורים, השדות, הטאבים והבלוקים)
  - `--radius-badge`: `4px` (לתגיות יחידת מידה, תגיות סטטוס ותיבות סימון)
  - `--radius-sheet`: `12px 12px 0 0` (למגירת ה-Bottom Sheet)
  - `--shadow-stamp`: `2px 2px 0px #0F1115` (צל חותמת קשיח ללא טשטוש על כפתורי פעולה וצ'יפים פעילים; נעלם ב-`:active` עם `translate(1px, 1px)`)

---

### 3.2 רכיב: `TopAppBar` (כותרת עליונה גלובלית)
- **מסך משויך:** משותף לכל מסכי המערכת (`index.html`)
- **תפקיד פונקציונלי:** הצגת זהות המערכת, החלפה מיידית בין מצב "שטח" למצב "משרד", וחיווי חי של מצב הסנכרון מול הענן.
- **היררכיה באפליקציה:** `Organism` (Global Shell Header)
- **מיקום גיאומטרי ברינדור:** `Sticky Top Bar` (`height: 56px`, `border-bottom: 1.5px solid #0F1115`, `background: #FFFFFF`)
- **מגבלות מגע ונגישות:** כפתורי מתג המצבים בעלי אזור לחיצה נגיש (`min-height: 44px`), ניגודיות `17.4:1`.

#### מאפיינים ומצבים (Props & States)
| מאפיין / מצב | טיפוס (Type) | ערך מברירת מחדל | תיאור חזותי מהרינדור |
|---|---|---|---|
| `activeMode` | `'field' \| 'office'` | `'field'` | הכפתור הפעיל מציג רקע `#0F1115` וטקסט `#FFFFFF`; הכפתור הלא-פעיל מציג רקע שקוף וטקסט `#0F1115` |
| `syncState: synced` | State | Active | נקודה ירוקה `#15803D` (`8x8px`) עם טקסט `"מסונכרן"` בתוך תגית ממוסגרת `1.5px solid #0F1115` |
| `syncState: syncing` | State | — | נקודה כתומה `#B45309` מהבהבת עם טקסט `"מסנכרן..."` |
| `syncState: offline` | State | — | נקודה אדומה `#B91C1C` עם טקסט `"שמור מקומית"` |

---

### 3.3 רכיב: `FieldBottomNavBar` (סרגל ניווט תחתון לשטח)
- **מסך משויך:** `field-inventory`, `field-prep`, `field-orders`, `field-waste`
- **תפקיד פונקציונלי:** מעבר מהיר באגודל אחד בין 4 מודולי השטח של המטבח (R45).
- **היררכיה באפליקציה:** `Organism` (Fixed Bottom Navigation)
- **מיקום גיאומטרי ברינדור:** `Fixed Bottom` (`height: 64px`, `border-top: 1.5px solid #0F1115`, `background: #FFFFFF`)
- **מגבלות מגע ונגישות:** כל אחד מ-4 הכפתורים בעל יעד מגע של לפחות `64x48px` (`>= 48dp / 44pt` לפי R20). אייקונים וקטוריים נקיים בלבד (ללא אימוג'י — R21).

#### מאפיינים ומצבים (Props & States)
| מאפיין / מצב | טיפוס (Type) | ערך מברירת מחדל | תיאור חזותי מהרינדור |
|---|---|---|---|
| `activeTab` | `'inventory' \| 'prep' \| 'orders' \| 'waste'` | `'inventory'` | הלשונית הפעילה מוצגת כמלבן ממוסגר עם רקע `#1D4ED8` (Apron Cobalt), מסגרת `1.5px solid #0F1115` וטקסט/אייקון בלבן `#FFFFFF` |
| `state: inactive` | State | — | רקע לבן `#FFFFFF`, אייקון וטקסט ב-`#4B5563` |
| `state: pressed` | State | — | `transform: scale(0.96)` למשך `120ms` |

---

### 3.4 רכיב: `InventoryLedgerRow` (שורת פריט בספירת מלאי)
- **מסך משויך:** `field-inventory`
- **תפקיד פונקציונלי:** הצגת חומר גלם יחיד עם יחידת המידה, תקן הסופ"ש, סטטוס המלאי, ובקר Stepper לעדכון הכמות ביד אחת.
- **היררכיה באפליקציה:** `Molecule` (Ledger List Item — ללא כרטיס מקונן R46)
- **מיקום גיאומטרי ברינדור:** `Main Ledger List` (`min-height: 92px`, `padding: 16px`, `border-bottom: 1.5px solid #0F1115`)
- **מגבלות מגע ונגישות:** כפתורי ה-`-` וה-`+` בגודל קשיח של `48x48px` (`border: 2px solid #0F1115`, `border-radius: 6px`).

#### מאפיינים ומצבים (Props & States)
| מאפיין / מצב | טיפוס (Type) | ערך מברירת מחדל | תיאור חזותי מהרינדור |
|---|---|---|---|
| `itemName` | String | — | כותרת `18px Rubik Bold` בצבע `#0F1115` |
| `unit` | String | — | תגית ממוסגרת `1.5px solid #0F1115` ברקע `#F8F7F4` (`"ק"ג"`, `"יח'"`, `"צרור"`) |
| `parWeekend` | Number | — | טקסט `"תקן סופ"ש: X"` בגודל `16px Rubik` בצבע `#4B5563` |
| `currentCount` | Number | — | תצוגת מספר מרכזית ברוחב `56px`, גופן `Space Mono 24px Bold` (`tabular-nums`) |
| `state: modified` | State | — | פס אנכי ימני `border-right: 4px solid #1D4ED8` + תגית כחולה `"עודכן"` |
| `state: shortage` | State | — | כאשר `currentCount < reorderPoint`: תגית ממוסגרת באדום `#B91C1C` עם נקודה אדומה והטקסט `"חוסר"` (R24), ומספר הכמות צבוע ב-`#B91C1C` |
| `state: ok` | State | — | תגית ממוסגרת בירוק `#15803D` עם נקודה ירוקה והטקסט `"תקין"` |

---

### 3.5 רכיב: `StationProgressCard` & `PrepTaskRow` (התקדמות עמדה ושורת משימת הכנה)
- **מסך משויך:** `field-prep`
- **תפקיד פונקציונלי:** הצגת קצב התקדמות העמדה היומי ורשימת משימות ההכנה עם סימון ביצוע ופתיחת מתכון.
- **היררכיה באפליקציה:** `Molecule`
- **מיקום גיאומטרי ברינדור:** `Body` (מתחת לסרגל בחירת העמדות)
- **מגבלות מגע ונגישות:** אזור הלחיצה של תיבת הסימון הוא `48x48px` (תיבה פנימית `28x28px` עם מסגרת `2px solid #0F1115`), וכפתור `"מתכון"` בגודל מינימלי `48x48px`.

#### מאפיינים ומצבים (Props & States)
| מאפיין / מצב | טיפוס (Type) | ערך מברירת מחדל | תיאור חזותי מהרינדור |
|---|---|---|---|
| `completedCount / totalCount` | Number | `3 / 6` | כותרת `"3 מתוך 6 הושלמו"` + פס התקדמות בגובה `10px` המתמלא מימין לשמאל ב-`#0F1115` |
| `remainingMinutes` | Number | `40` | תגית שחורה `#0F1115` עם אייקון שעון וקטורי וטקסט `"40 דק' נותרו"` |
| `taskState: pending` | State | Active | רקע `#FFFFFF`, מסגרת `1.5px solid #0F1115`, כותרת `16px Bold #0F1115`, תגית כמות (`"2.5 ק"ג"`), וכפתור `"מתכון"` פעיל |
| `taskState: completed` | State | — | תיבת סימון מלאה בירוק `#15803D` עם אייקון V לבן, כותרת בקו חוצה (`line-through`) בצבע `#64748B`, ותגית ירוקה `"הושלם"` |

---

### 3.6 רכיב: `PrepRecipeBottomSheet` (מגירת מתכון הכנה ו-BOM)
- **מסך משויך:** `field-prep-sheet` (נפתחת מתוך `field-prep`)
- **תפקיד פונקציונלי:** הצגת מרכיבי המתכון המדויקים (BOM) ושלבי ההכנה של משימה מבלי לצאת ממסך העמדה (R30).
- **היררכיה באפליקציה:** `Organism` (Modal Bottom Sheet)
- **מיקום גיאומטרי ברינדור:** `Bottom 84% of Viewport` מעל שכבת עמעום `rgba(15, 17, 21, 0.75)`
- **מגבלות מגע ונגישות:** כפתור סגירה (`X`) בגודל `48x48px` בפינה השמאלית העליונה, כפתור CTA תחתון בגובה `52px`. סגירה בלחיצה על `X`, בלחיצה על הרקע המעומעם, או במקש `Escape`.

#### מאפיינים ומצבים (Props & States)
| מאפיין / מצב | טיפוס (Type) | ערך מברירת מחדל | תיאור חזותי מהרינדור |
|---|---|---|---|
| `recipeName` | String | — | כותרת `"מתכון הכנה · מטבל טחינה ירוקה"` (`20px Rubik Bold`) |
| `batchSpecs` | Object | — | סרגל 3 עמודות על רקע `#F8F7F4`: תפוקת אצווה (`"2.5 ק"ג"`), זמן ביצוע (`"15 דק'"`), עמדת ייצור (`"פלטות וגבינות"`) |
| `bomLines` | Array | — | שורות מרכיבים בגובה מינימלי `48px` מופרדות בקו `1px solid #D6D3C9`: שם מרכיב מימין (`16px Rubik Medium`), משקל ויחידה משמאל (`Space Mono 22px Bold`) |
| `steps` | Array | — | בלוקים ממוספרים (`1`, `2`, `3` בתוך ריבוע שחור `28x28px`) עם טקסט הוראה `16px Rubik` על רקע `#F8F7F4` |

---

### 3.7 רכיב: `SupplierOrderLedger` (טבלת הזמנת רכש לספק)
- **מסך משויך:** `field-orders`
- **תפקיד פונקציונלי:** ריכוז כל הפריטים בחוסר עבור הספק הנבחר, התאמת כמות להזמנה, חישוב אומדן כספי ושיגור הודעת WhatsApp.
- **היררכיה באפליקציה:** `Organism`
- **מיקום גיאומטרי ברינדור:** `Main Content` מתחת לטאבים של בחירת הספק (`height: 48px` לכל טאב ספק)
- **מגבלות מגע ונגישות:** כפתורי `-` ו-`+` בכל שורת הזמנה בגודל `48x48px`. ללא קינון כרטיסים (R46) — טבלה שטוחה אחת עם כותרת ספק, שורות פריטים ושורת סיכום תחתונה.

#### מאפיינים ומצבים (Props & States)
| מאפיין / מצב | טיפוס (Type) | ערך מברירת מחדל | תיאור חזותי מהרינדור |
|---|---|---|---|
| `supplierTabs` | Array | — | טאבים אופקיים בגובה `48px`: ספק פעיל ברקע `#1D4ED8` וטקסט לבן (`"אשי שוק · ירקות (3)"`), ספק משני ברקע לבן ומסגרת דיו (`"מחלבות גד (2)"`) |
| `orderRows` | Array | — | כל שורה מציגה שם פריט, `"במלאי: X · תקן סופ"ש: Y"`, תגית `"אזל במלאי"` (`#B91C1C`) כשמלאי הוא 0, ו-Stepper עם כמות מומלצת ב-`Space Mono 26px Bold` |
| `estimatedTotal` | Number | — | שורת Footer ברקע `#F8F7F4` עם גבול עליון `1.5px solid #0F1115`: `"סה"כ פריטים להזמנה: 3"` ו-`"אומדן כספי: ₪385.00"` |
| `primaryCta` | Button | — | כפתור רוחב מלא `#EA580C` בגובה `52px`: `"שלח הזמנה בוואטסאפ לאשי שוק"` עם אייקון שליחה וקטורי |

---

### 3.8 רכיב: `QuickWasteForm` & `FinancialImpactTicket` (טופס דיווח פחת ב-3 שלבים וקבלת עלות)
- **מסך משויך:** `field-waste`
- **תפקיד פונקציונלי:** דיווח פחת תוך פחות מ-5 שניות עם משוב כספי מיידי ועדכון יתרת המלאי.
- **היררכיה באפליקציה:** `Organism`
- **מיקום גיאומטרי ברינדור:** `Main Form Canvas`
- **מגבלות מגע ונגישות:** בורר פריט בגובה `56px`, כפתורי Stepper בגובה `52px`, כפתורי קיצור (`+0.25`, `+0.50`, `+1.00`) בגובה `48px`, וגריד סיבות `2x2` שבו כל כפתור בגובה `48px` (R20).

#### מאפיינים ומצבים (Props & States)
| מאפיין / מצב | טיפוס (Type) | ערך מברירת מחדל | תיאור חזותי מהרינדור |
|---|---|---|---|
| `selectedItem` | Object | — | שדה בחירה ממוסגר `1.5px solid #0F1115` המציג את שם הפריט (`"צ'דר אנגלית מיושנת"`) ותגית מחיר יחידה (`"₪85.00 / ק"ג"`) |
| `wasteQuantity` | Number | `0.5` | תצוגת מספר מרכזית ב-`Space Mono 26px Bold` עם יחידת מידה, כפתורי `-`/`+` עם צל חותמת `2px 2px 0px #0F1115`, ו-3 כפתורי הוספה מהירה |
| `wasteReason` | Enum | `'פג תוקף / קלקול'` | 4 כפתורי Radio בגריד `2x2`: הנבחר ברקע `#1D4ED8`, טקסט `#FFFFFF`, מסגרת `#0F1115` וצל חותמת `2px 2px 0px #0F1115` |
| `calculatedCost` | Number | `42.50` | קבלת השפעה כספית (`FinancialImpactTicket`) עם סכום מודגש ב-`Space Mono 26px Bold` בצבע `#B91C1C` (`"₪42.50"`) ויתרת מלאי מעודכנת (`"2.50 ק"ג"`) |

---

### 3.9 מפרט חמשת מצבי המסך (R12, R39, R54, R55)
כל אחד מ-4 מסכי השטח והמגירה תומך ב-5 המצבים הבאים באותה שפה חזותית (`Swiss Kitchen Editorial`):
1. **`default`**: התצוגה המלאה כפי שרונדרה ב-Stitch.
2. **`loading`**: שלד שורות (`Skeleton`) בגוון `#EDEDEA` עם מסגרת `1.5px solid #D6D3C9` בגובה המדויק של השורות (`92px` במלאי, `72px` בהכנות) למניעת קפיצת פריסה (CLS = 0).
3. **`empty`**:
   - ב-`field-inventory` (דו-מצבי לפי R55): אם המסד ריק — תיבה ממוסגרת עם כפתור `"טען נתוני בסיס"`; אם חיפוש/סינון החזיר 0 תוצאות — `"לא נמצאו פריטים התואמים לחיפוש"` + כפתור `"נקה סינון"` (`48px` גובה).
   - ב-`field-prep`: `"כל משימות העמדה הושלמו להיום"` + כפתור `"הצג משימות שהושלמו"`.
   - ב-`field-orders`: `"כל המלאי מעל נקודת ההזמנה — אין חוסרים לרכש כעת"` + כפתור `"עבור לספירת מלאי"`.
4. **`partial-error` (R39, R54)**: באנר ממוסגר `1.5px solid #B45309` על רקע `#FFFBEB` בראש המסך שאינו חוסם את העבודה השוטפת, עם הודעה בגובה העיניים וכפתור ניסיון חוזר מקומי (`"נסה לסנכרן שוב"`), תוך שמירה מלאה של כל הקלט שהמשתמש הזין.
5. **`fatal-error`**: כרטיס שגיאה מרכזי ממוסגר `1.5px solid #B91C1C` עם הסבר ברור וכפתור התאוששות `"טען מחדש את המודול"`.

---

## 4. מפרט ניווט ומעברים בין מסכים

| טריגר (רכיב ולחיצה) | מסך מקור | מסך יעד | אופי המעבר במובייל |
|---|---|---|---|
| לחיצה על לשונית ב-`FieldBottomNavBar` | כל מסך שטח | מסך הלשונית שנבחרה (`inventory` / `prep` / `orders` / `waste`) | החלפת תצוגה מיידית (`120ms` fade קל; `0ms` תחת `prefers-reduced-motion: reduce` — R28) |
| לחיצה על כפתור `"מתכון"` בשורת משימה | `field-prep` | `field-prep-sheet` | החלקת מגירת Bottom Sheet מלמטה למעלה (`200ms cubic-bezier(0.2, 0, 0, 1)`) עם עמעום רקע; תחת `prefers-reduced-motion`: הופעה מיידית ללא תנועה מרחבית |
| לחיצה על כפתור `X` או על `"סמן הכנה כהושלמה"` במגירה | `field-prep-sheet` | `field-prep` | סגירת המגירה מטה ועדכון מיידי של שורת המשימה ומד ההתקדמות ב-`field-prep` |
| לחיצה על מתג `"משרד"` ב-`TopAppBar` | כל מסך שטח | מצב משרד (`Office Mode`) | החלפת מעטפת התצוגה (`body.mode-office`) |

---

## 5. הנחיות מימוש למחלקת הפיתוח (Implementation Notes)
- **פלטפורמת יעד:** Vanilla ES Modules SPA (`index.html`, `design/tokens.css`, `css/*.css`, `js/views/field*.js`) בתיקיית ה-Worktree `c:\Users\israe\Desktop\פרוייקטים\ניהול מטבח - עיצוב`.
- **תמיכה ב-RTL ודו-כיווניות (R22):**
  - מעטפת ה-HTML מוגדרת עם `dir="rtl" lang="he"`.
  - כל שדות המספרים, המשקלים והמחירים (`Space Mono`) מוגדרים עם `font-variant-numeric: tabular-nums` ו-`direction: ltr` כדי למנוע היפוך סימני מינוס או נקודה עשרונית.
  - פס ההתקדמות ב-`field-prep` מתמלא מימין לשמאל.
- **נגישות ותנועה מופחתת (R19, R20, R28):**
  - כל הכפתורים האינטראקטיביים במצב שטח מחויבים ב-`min-height: 48px; min-width: 48px` (עומד ב-48dp Android ו-44pt iOS).
  - הוספת כלל גלובלי `@media (prefers-reduced-motion: reduce)` שמבטל כל `transition` ו-`transform` מרחבי.
- **אייקונים וקטוריים (R21):**
  - החלפת כל תווי האימוג'י שהיו בקוד הישן (`🍷`, `📦`, `🔪`, `📲`, `🗑️`) באייקוני SVG וקטוריים נקיים בעובי קו `2px` (Lucide / Material Symbols Outlined) כפי שרונדר ב-Stitch.

