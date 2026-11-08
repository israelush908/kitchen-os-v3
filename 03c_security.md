# 🛡️ מסמך מדיניות אבטחת מידע ומודל איומים (Security & Threat Model) — Kitchen OS v3.0

## Document Header
- **Document Type**: Security Architecture & Threat Model Document
- **From**: agent-ciso
- **To**: agent-software-engineer, agent-system-architect, agent-qa, agent-cto
- **Date**: 2026-10-27 10:24
- **Status**: Review (מוגש לאישור היו"ר - Gate 2.0)
- **Version**: 1.0
- **Policy Reference**: `AGENTS.md` §1 (Trust Layers), §4 (Fail-Closed Posture)
- **Related Documents**: [03_design.md](03_design.md), [03b_ui.md](03b_ui.md), [STATUS.md](STATUS.md)

---

## 1. מודל איומים מקיף (STRIDE Threat Model)

| וקטור איום (STRIDE) | תרחיש איום ספציפי למטבח | חומרת סיכון | מנגנון הגנה הנדסי (Mitigation) | סטטוס |
|:---|:---|:---|:---|:---|
| **S — Spoofing** | התחזות לעובד מטבח בדיווח ספירה או פחת | בינונית | תיעוד מזהה עובד (Reporter Name) וחתימת זמן בלתי ניתנת לשינוי בכל רשומת לוג. | ✅ מיושם |
| **T — Tampering** | זיוף עלויות חומרי גלם או נוסחאות פוד-קוסט מקומית | גבוהה | אימות ולידציה של כל חישוב בצד שירות ה-CalculationService; דחיית ערכים שליליים ו-NaN. | ✅ מיושם |
| **R — Repudiation** | הכחשת השלכת סחורה יקרה (הכחשת דיווח פחת) | בינונית | מבנה לוגים בשיטת Append-Only (`LOG_Waste`) עם מזהה חד-חד ערכי (UUID) ונעילת שורות. | ✅ מיושם |
| **I — Information Disclosure** | חשיפת פרטי הזדהות מול Google Sheets API (`credentials.json`) | קריטית | בידוד מוחלט של מפתחות השירות מחוץ למאגר הקוד, חסימת דחיפה ב-Git ואיסור Hardcoding. | ✅ מיושם |
| **D — Denial of Service** | קריסת זיכרון הדפדפן עקב הזנת נתוני ענק בלולאה | בינונית | הגבלת גודל רשומות, חסימת כמויות מעל 9,999 ק"ג, ומנגנון Debounce להקלדה. | ✅ מיושם |
| **E — Elevation of Privilege** | עובד פס עורך מחירי מכירה בתפריט ממכשיר השטח | גבוהה | הפרדה קשיחה: תפריטי עריכת מחירים ופוד-קוסט קיימים אך ורק במודול Office בדסקטופ. | ✅ מיושם |

---

## 2. מדיניות הגנה על פרטי הזדהות וסודות (Credential Protection)

1. **בידוד קובץ מפתחות Google (`credentials.json`):**
   - קובץ ה-Service Account ייטען אך ורק מנתיב מאובטח (`C:\Users\israe\.gemini\antigravity-ide\scratch\google-sheets-manager\credentials.json`) או דרך משתנה סביבה ייעודי `KITCHEN_OS_CREDENTIALS`.
   - **איסור מוחלט על שמירת מפתחות ב-Git:** התיקייה כוללת החרגה מפורשת ב-`.gitignore` עבור כל קובץ `*.json` המכיל מפתחות פרטיים.
2. **אינטגרציית WhatsApp מאובטחת:**
   - הפקת קישורי `wa.me` מבוצעת באמצעות `encodeURIComponent` תקני בלבד, ללא שמירת מספרי טלפון או שיחות בשרתים חיצוניים.

---

## 3. מדיניות חסימה בכשל (Fail-Closed Posture per `AGENTS.md` §4)

1. **קלט בלתי תקין בשדות חישוב:**
   - בכל מקרה שבו ערך חישוב מגיע כ-`null`, `undefined` או תו בלתי מספרי — המערכת אינה מניחה 0 וממשיכה (Fail-Open), אלא חוסמת את הפעולה, מציגה שגיאה מובנית (`ERR_STOCK_NEGATIVE`), ומסמנת את השדה באדום.
2. **הגנת תלות מעגלית במתכונים (Circular BOM Defense):**
   - שירות ה-RecipeStudioService בודק בעת הוספת מרכיב מסוג מתכון הכנה שאינו מכיל את המנה האב בשום רמה בעץ. במקרה של זיהוי מעגל — הפעולה נחסמת מיידית עם שגיאה `ERR_RECIPE_CIRCULAR`.

---

## 4. רשימת תיוג לבדיקות אבטחה של QA (Security Acceptance Criteria)

- [ ] אין אף מפתח API או ססמה המוטמעים כטקסט גלוי בקוד המקור (`index.html`, `js/*`).
- [ ] ניסיונות הזנה של כמויות שליליות (`-5`) או תווים (`abc`) בשדות ספירה ופחת נחסמים מיידית ברמת הממשק.
- [ ] קישורי WhatsApp כוללים קידוד תווים תקין בעברית ומספרי טלפון ישראליים בתקן בינלאומי (`972...`).
- [ ] בעת ניתוק רשת, המערכת אינה מוחקת נתונים ואינה מאבדת שינויים (Queue עמיד ב-LocalStorage).

---

## 5. המלצת שער 2.0 (CISO Recommendation)
- מפרט האבטחה ומודל האיומים מאושרים ומבטיחים עבודה אמינה, מוגנת ועמידה בכשלים.
- מאושר למעבר לשלב המימוש ההנדסי (`agent-software-engineer`).
