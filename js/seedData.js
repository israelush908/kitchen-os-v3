/**
 * Kitchen OS v3.0 — Realistic Seed Dataset (Winery Visitor Center Kitchen)
 * Normalized entities matching the schema specification.
 */

export const INITIAL_DATA = {
  config: {
    targetFoodCost: 0.30,        // 30% יעד פוד קוסט
    targetLaborCost: 0.15,       // 15% יעד לייבור
    employerCostMultiplier: 1.30,// 1.30 מכפיל עלות מעסיק
    vatRate: 0.18,               // 18% מע"מ
    currency: "₪"
  },

  suppliers: [
    {
      id: "SUP-01",
      name: "אשי שוק",
      category: "ירקות ופירות",
      contactName: "אשי",
      whatsappPhone: "972504008601",
      orderChannel: "WHATSAPP",
      portalUrl: "",
      deliveryDays: ["ראשון", "שלישי", "חמישי"],
      isActive: true
    },
    {
      id: "SUP-02",
      name: "מחלבת בוטיק כפר תבור",
      category: "גבינות ומחלבה",
      contactName: "דוד שמואלי",
      whatsappPhone: "972544846938",
      orderChannel: "EXTERNAL_PORTAL",
      portalUrl: "",
      deliveryDays: ["שני", "רביעי"],
      isActive: true
    },
    {
      id: "SUP-03",
      name: "אקזוטיקה פירות מיוחדים",
      category: "ירקות ופירות",
      contactName: "רונן",
      whatsappPhone: "972521234567",
      orderChannel: "WHATSAPP",
      portalUrl: "",
      deliveryDays: ["שלישי", "חמישי"],
      isActive: true
    },
    {
      id: "SUP-04",
      name: "מאפיית לחמי בוטיק",
      category: "לחמים ומאפים",
      contactName: "שמעון",
      whatsappPhone: "972509876543",
      orderChannel: "WHATSAPP",
      portalUrl: "",
      deliveryDays: ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי"],
      isActive: true
    },
    {
      id: "SUP-05",
      name: "אייס ישראל ומתכלים",
      category: "אריזות ומתכלים",
      contactName: "יוסי",
      whatsappPhone: "972533334455",
      orderChannel: "EXTERNAL_PORTAL",
      portalUrl: "",
      deliveryDays: ["רביעי", "שישי"],
      isActive: true
    }
  ],

  catalog: [
    {
      id: "ITM-001",
      name: "מנצ'גו כמהין 6 חודשים",
      category: "גבינות ומחלבה",
      supplierId: "SUP-02",
      stockUnit: 'ק"ג',
      unitCostExclVat: 115.00,
      yieldLossPct: 0.05,
      parLevelWeekend: 6.0,
      reorderPoint: 3.0,
      currentStock: 2.2,
      inCountForm: true,
      inWasteForm: true,
      isActive: true
    },
    {
      id: "ITM-002",
      name: "פקורינו רומנו DOP",
      category: "גבינות ומחלבה",
      supplierId: "SUP-02",
      stockUnit: 'ק"ג',
      unitCostExclVat: 98.00,
      yieldLossPct: 0.05,
      parLevelWeekend: 5.0,
      reorderPoint: 2.5,
      currentStock: 3.8,
      inCountForm: true,
      inWasteForm: true,
      isActive: true
    },
    {
      id: "ITM-003",
      name: "צ'דר מיושנת חריפה",
      category: "גבינות ומחלבה",
      supplierId: "SUP-02",
      stockUnit: 'ק"ג',
      unitCostExclVat: 85.00,
      yieldLossPct: 0.05,
      parLevelWeekend: 7.0,
      reorderPoint: 3.5,
      currentStock: 2.8,
      inCountForm: true,
      inWasteForm: true,
      isActive: true
    },
    {
      id: "ITM-004",
      name: "ברי כמהין צרפתית",
      category: "גבינות ומחלבה",
      supplierId: "SUP-02",
      stockUnit: 'ק"ג',
      unitCostExclVat: 105.00,
      yieldLossPct: 0.05,
      parLevelWeekend: 4.0,
      reorderPoint: 2.0,
      currentStock: 3.5,
      inCountForm: true,
      inWasteForm: true,
      isActive: true
    },
    {
      id: "ITM-005",
      name: "לאבנה עיזים מקומית 9%",
      category: "גבינות ומחלבה",
      supplierId: "SUP-02",
      stockUnit: 'ק"ג',
      unitCostExclVat: 42.00,
      yieldLossPct: 0.02,
      parLevelWeekend: 8.0,
      reorderPoint: 3.5,
      currentStock: 6.0,
      inCountForm: true,
      inWasteForm: true,
      isActive: true
    },
    {
      id: "ITM-006",
      name: "חסה קיסר טרייה",
      category: "ירקות ופירות",
      supplierId: "SUP-01",
      stockUnit: "צרור",
      unitCostExclVat: 7.50,
      yieldLossPct: 0.15,
      parLevelWeekend: 16.0,
      reorderPoint: 6.0,
      currentStock: 4.0,
      inCountForm: true,
      inWasteForm: true,
      isActive: true
    },
    {
      id: "ITM-007",
      name: "עגבניות שרי תמר מתוקות",
      category: "ירקות ופירות",
      supplierId: "SUP-01",
      stockUnit: 'ק"ג',
      unitCostExclVat: 14.00,
      yieldLossPct: 0.08,
      parLevelWeekend: 12.0,
      reorderPoint: 5.0,
      currentStock: 4.2,
      inCountForm: true,
      inWasteForm: true,
      isActive: true
    },
    {
      id: "ITM-008",
      name: "אננס טרי מובחר",
      category: "ירקות ופירות",
      supplierId: "SUP-03",
      stockUnit: "יח'",
      unitCostExclVat: 28.00,
      yieldLossPct: 0.35,
      parLevelWeekend: 8.0,
      reorderPoint: 4.0,
      currentStock: 2.0,
      inCountForm: true,
      inWasteForm: true,
      isActive: true
    },
    {
      id: "ITM-009",
      name: "ענבים ירוקים ללא חרצנים",
      category: "ירקות ופירות",
      supplierId: "SUP-01",
      stockUnit: 'ק"ג',
      unitCostExclVat: 22.00,
      yieldLossPct: 0.05,
      parLevelWeekend: 10.0,
      reorderPoint: 4.0,
      currentStock: 8.5,
      inCountForm: true,
      inWasteForm: true,
      isActive: true
    },
    {
      id: "ITM-010",
      name: "סלק מבושל בוואקום",
      category: "ירקות ופירות",
      supplierId: "SUP-01",
      stockUnit: 'ק"ג',
      unitCostExclVat: 16.00,
      yieldLossPct: 0.05,
      parLevelWeekend: 6.0,
      reorderPoint: 3.0,
      currentStock: 1.5,
      inCountForm: true,
      inWasteForm: true,
      isActive: true
    },
    {
      id: "ITM-011",
      name: "טחינה גולמית הר ברכה",
      category: "יבשים ושימורים",
      supplierId: "SUP-01",
      stockUnit: "ליטר",
      unitCostExclVat: 26.00,
      yieldLossPct: 0.02,
      parLevelWeekend: 8.0,
      reorderPoint: 3.0,
      currentStock: 5.0,
      inCountForm: true,
      inWasteForm: true,
      isActive: true
    },
    {
      id: "ITM-012",
      name: "שמן זית כתית מעולה יקב",
      category: "יבשים ושימורים",
      supplierId: "SUP-01",
      stockUnit: "ליטר",
      unitCostExclVat: 45.00,
      yieldLossPct: 0.01,
      parLevelWeekend: 15.0,
      reorderPoint: 5.0,
      currentStock: 11.0,
      inCountForm: true,
      inWasteForm: true,
      isActive: true
    },
    {
      id: "ITM-013",
      name: "פקאן מסוכר קראנץ'",
      category: "יבשים ושימורים",
      supplierId: "SUP-01",
      stockUnit: 'ק"ג',
      unitCostExclVat: 65.00,
      yieldLossPct: 0.02,
      parLevelWeekend: 5.0,
      reorderPoint: 2.0,
      currentStock: 3.2,
      inCountForm: true,
      inWasteForm: true,
      isActive: true
    },
    {
      id: "ITM-014",
      name: "לחם מחמצת שיפון כפרי",
      category: "לחמים ומאפים",
      supplierId: "SUP-04",
      stockUnit: "יח'",
      unitCostExclVat: 18.00,
      yieldLossPct: 0.10,
      parLevelWeekend: 15.0,
      reorderPoint: 6.0,
      currentStock: 4.0,
      inCountForm: true,
      inWasteForm: true,
      isActive: true
    },
    {
      id: "ITM-015",
      name: "שקי קרח צלול 5 ק\"ג",
      category: "אריזות ומתכלים",
      supplierId: "SUP-05",
      stockUnit: "יח'",
      unitCostExclVat: 12.00,
      yieldLossPct: 0.00,
      parLevelWeekend: 20.0,
      reorderPoint: 8.0,
      currentStock: 5.0,
      inCountForm: true,
      inWasteForm: false,
      isActive: true
    }
  ],

  dishes: [
    {
      id: "DSH-01",
      name: "מטבל טחינה עשבי תיבול",
      dishType: "SUB_RECIPE",
      category: "מתכוני הכנה",
      yieldPortions: 1.0, // 1 kg
      priceInclVat: 0,
      weeklySalesQty: 0,
      prepInstructions: "לערבב טחינה גולמית עם מים קרים 1:1, להוסיף שמן זית, מיץ לימון, מלח ופטרוזיליה קצוצה דק דק עד למרקם קטיפתי."
    },
    {
      id: "DSH-02",
      name: "רוטב קיסר ביתי",
      dishType: "SUB_RECIPE",
      category: "מתכוני הכנה",
      yieldPortions: 1.0, // 1 liter
      priceInclVat: 0,
      weeklySalesQty: 0,
      prepInstructions: "לטחון בבלנדר מוט חלמונים, חרדל דיז'ון, אנשובי, שום ופרמז'ן מגורר. לזלף שמן זית עד לאמולסיה יציבה."
    },
    {
      id: "DSH-10",
      name: "פלטת גבינות בוטיק זוגית",
      dishType: "MENU_ITEM",
      category: "פלטות וגבינות",
      yieldPortions: 1,
      priceInclVat: 145.00,
      weeklySalesQty: 48,
      prepInstructions: "לסדר על קרש עץ אלון: 80 גרם מנצ'גו, 80 גרם פקורינו, 70 גרם צ'דר, 60 גרם ברי. לקשט באשכול ענבים, פקאנים מסוכרים, ומטבל טחינה בצד."
    },
    {
      id: "DSH-11",
      name: "ברוסקטה סלק צלוי ולאבנה",
      dishType: "MENU_ITEM",
      category: "ברוסקטות וסלטים",
      yieldPortions: 1,
      priceInclVat: 58.00,
      weeklySalesQty: 32,
      prepInstructions: "לקלות 3 פרוסות מחמצת עם שמן זית, למרוח שכבה נדיבה של לאבנה עיזים, להניח קוביות סלק מתובל בבלסמי מצומצם, לפזר פקאן מסוכר."
    },
    {
      id: "DSH-12",
      name: "סלט קיסר יקב פריך",
      dishType: "MENU_ITEM",
      category: "ברוסקטות וסלטים",
      yieldPortions: 1,
      priceInclVat: 64.00,
      weeklySalesQty: 38,
      prepInstructions: "לחתוך חסה קיסר לפיסות גדולות, לערבב עם רוטב קיסר, לפזר קרוטוני מחמצת קריספיים וגילופי פקורינו רומנו בנדיבות."
    },
    {
      id: "DSH-13",
      name: "לחם מחמצת כפרי ומטבלים",
      dishType: "MENU_ITEM",
      category: "מנות פתיחה ונשנושים",
      yieldPortions: 1,
      priceInclVat: 42.00,
      weeklySalesQty: 55,
      prepInstructions: "לחמם כיכר מחמצת קטנה בתנור 4 דקות. להגיש על מגש עם קערית שמן זית-בלסמי וקערית מטבל טחינה עשבי תיבול."
    }
  ],

  recipeLines: [
    // מטבל טחינה (DSH-01)
    { id: "RL-001", parentDishId: "DSH-01", componentType: "RAW_ITEM", componentId: "ITM-011", quantity: 0.5, unit: "ליטר", notes: "טחינה גולמית" },
    { id: "RL-002", parentDishId: "DSH-01", componentType: "RAW_ITEM", componentId: "ITM-012", quantity: 0.08, unit: "ליטר", notes: "שמן זית" },

    // רוטב קיסר (DSH-02)
    { id: "RL-003", parentDishId: "DSH-02", componentType: "RAW_ITEM", componentId: "ITM-012", quantity: 0.25, unit: "ליטר", notes: "שמן זית" },
    { id: "RL-004", parentDishId: "DSH-02", componentType: "RAW_ITEM", componentId: "ITM-002", quantity: 0.10, unit: 'ק"ג', notes: "פקורינו מגוררת" },

    // פלטת גבינות זוגית (DSH-10)
    { id: "RL-010", parentDishId: "DSH-10", componentType: "RAW_ITEM", componentId: "ITM-001", quantity: 0.08, unit: 'ק"ג', notes: "מנצ'גו כמהין" },
    { id: "RL-011", parentDishId: "DSH-10", componentType: "RAW_ITEM", componentId: "ITM-002", quantity: 0.08, unit: 'ק"ג', notes: "פקורינו" },
    { id: "RL-012", parentDishId: "DSH-10", componentType: "RAW_ITEM", componentId: "ITM-003", quantity: 0.07, unit: 'ק"ג', notes: "צ'דר" },
    { id: "RL-013", parentDishId: "DSH-10", componentType: "RAW_ITEM", componentId: "ITM-004", quantity: 0.06, unit: 'ק"ג', notes: "ברי כמהין" },
    { id: "RL-014", parentDishId: "DSH-10", componentType: "RAW_ITEM", componentId: "ITM-009", quantity: 0.15, unit: 'ק"ג', notes: "ענבים" },
    { id: "RL-015", parentDishId: "DSH-10", componentType: "RAW_ITEM", componentId: "ITM-013", quantity: 0.04, unit: 'ק"ג', notes: "פקאן מסוכר" },
    { id: "RL-016", parentDishId: "DSH-10", componentType: "SUB_RECIPE", componentId: "DSH-01", quantity: 0.08, unit: 'ק"ג', notes: "מטבל טחינה (מתכון הכנה)" },

    // ברוסקטה סלק ולאבנה (DSH-11)
    { id: "RL-020", parentDishId: "DSH-11", componentType: "RAW_ITEM", componentId: "ITM-014", quantity: 0.35, unit: "יח'", notes: "3 פרוסות מחמצת" },
    { id: "RL-021", parentDishId: "DSH-11", componentType: "RAW_ITEM", componentId: "ITM-005", quantity: 0.12, unit: 'ק"ג', notes: "לאבנה עיזים" },
    { id: "RL-022", parentDishId: "DSH-11", componentType: "RAW_ITEM", componentId: "ITM-010", quantity: 0.15, unit: 'ק"ג', notes: "סלק מבושל" },
    { id: "RL-023", parentDishId: "DSH-11", componentType: "RAW_ITEM", componentId: "ITM-013", quantity: 0.02, unit: 'ק"ג', notes: "פקאן מסוכר לקישוט" },

    // סלט קיסר (DSH-12)
    { id: "RL-030", parentDishId: "DSH-12", componentType: "RAW_ITEM", componentId: "ITM-006", quantity: 1.0, unit: "צרור", notes: "חסה קיסר" },
    { id: "RL-031", parentDishId: "DSH-12", componentType: "SUB_RECIPE", componentId: "DSH-02", quantity: 0.09, unit: "ליטר", notes: "רוטב קיסר" },
    { id: "RL-032", parentDishId: "DSH-12", componentType: "RAW_ITEM", componentId: "ITM-002", quantity: 0.04, unit: 'ק"ג', notes: "גילופי פקורינו" },
    { id: "RL-033", parentDishId: "DSH-12", componentType: "RAW_ITEM", componentId: "ITM-014", quantity: 0.20, unit: "יח'", notes: "קרוטונים" },

    // לחם ומטבלים (DSH-13)
    { id: "RL-040", parentDishId: "DSH-13", componentType: "RAW_ITEM", componentId: "ITM-014", quantity: 1.0, unit: "יח'", notes: "כיכר מחמצת קטנה" },
    { id: "RL-041", parentDishId: "DSH-13", componentType: "SUB_RECIPE", componentId: "DSH-01", quantity: 0.08, unit: 'ק"ג', notes: "מטבל טחינה" },
    { id: "RL-042", parentDishId: "DSH-13", componentType: "RAW_ITEM", componentId: "ITM-012", quantity: 0.05, unit: "ליטר", notes: "שמן זית לטבילה" }
  ],

  prepChecklist: [
    {
      id: "PREP-01",
      station: "פלטות וגבינות",
      prepItem: "מילוי קופסאות גבינות לפלטות שקולות",
      frequency: "יומי",
      estMinutes: 25,
      doneToday: true,
      instructions: "לחתוך מראש קוביות מנצ'גו וצ'דר בקופסאות של 500 גרם, לשמור מכוסה עם נייר פרגמנט לח.",
      linkedDishId: "DSH-10"
    },
    {
      id: "PREP-02",
      station: "פלטות וגבינות",
      prepItem: "שטיפה והפרדת אשכולות ענבים",
      frequency: "יומי",
      estMinutes: 15,
      doneToday: true,
      instructions: "לשטוף במים קרים, לסנן היטב, לחלק למנות קטנות של 150 גרם על מגש מרופד.",
      linkedDishId: "DSH-10"
    },
    {
      id: "PREP-03",
      station: "ברוסקטות וסלטים",
      prepItem: "חיתוך סלק לקוביות ותיבול בבלסמי",
      frequency: "יומי",
      estMinutes: 20,
      doneToday: false,
      instructions: "לחתוך סלק מבושל לקוביות 1.5 ס\"מ, לערבב עם כף שמן זית, כף חומץ בלסמי איכותי ומעט מלח ים.",
      linkedDishId: "DSH-11"
    },
    {
      id: "PREP-04",
      station: "ברוסקטות וסלטים",
      prepItem: "שטיפה וייבוש חסות בסרכזת (Spin)",
      frequency: "יומי",
      estMinutes: 20,
      doneToday: false,
      instructions: "לפרק עלי חסה, לשטוף במי קרח, לייבש פעמיים בסרכזת. חובה ייבוש מלא לפריכות הרוטב.",
      linkedDishId: "DSH-12"
    },
    {
      id: "PREP-05",
      station: "הכנות קרות",
      prepItem: "הכנת מטבל טחינה עשבי תיבול (2 ליטר)",
      frequency: "יומי",
      estMinutes: 15,
      doneToday: true,
      instructions: "לפעול לפי מתכון הכנה DSH-01, לתקן תיבול, לחלק לדיספנסרים מסומנים עם תאריך.",
      linkedDishId: "DSH-01"
    },
    {
      id: "PREP-06",
      station: "הכנות קרות",
      prepItem: "הכנת רוטב קיסר ביתי (1 ליטר)",
      frequency: "לפני סופ\"ש",
      estMinutes: 20,
      doneToday: false,
      instructions: "לטחון בבלנדר מוט לפי יחסי מתכון DSH-02, לשמור בקירור עמוק עד לסרוויס.",
      linkedDishId: "DSH-02"
    }
  ],

  managerTasks: [
    {
      id: "TSK-01",
      title: "עדכון מחירון מנצ'גו מול מחלבת כפר תבור",
      area: "ספקים ורכש",
      assignee: "ישראל",
      priority: "גבוהה",
      dueDate: "2026-10-28",
      status: "בתהליך",
      notes: "דוד הודיע על עליית מחיר צפויה ב-5%; לבדוק השפעה על פוד-קוסט הפלטה הזוגית."
    },
    {
      id: "TSK-02",
      title: "טעימות ופיתוח מנת ספיישל שבת (ברוסקטת גבינת עיזים חמה)",
      area: "פיתוח תפריט",
      assignee: "ישראל",
      priority: "רגילה",
      dueDate: "2026-10-29",
      status: "לביצוע",
      notes: "לבנות מתכון בסטודיו, לבדוק פוד-קוסט יעד 28% ומחיר ₪52 לצרכן."
    },
    {
      id: "TSK-03",
      title: "הזמנת שקי קרח מוגברת לאירוע חמישי ערב",
      area: "לוגיסטיקה ואירועים",
      assignee: "ישראל",
      priority: "גבוהה",
      dueDate: "2026-10-29",
      status: "הושלם",
      notes: "הוזמנו 15 שקים נוספים מאייס ישראל."
    }
  ],

  logCounts: [
    {
      countId: "CNT-101",
      timestamp: "2026-10-25 18:30",
      itemId: "ITM-001",
      itemName: "מנצ'גו כמהין 6 חודשים",
      previousStock: 3.5,
      countedQty: 2.2,
      delta: -1.3,
      unit: 'ק"ג',
      unitCostSnapshot: 115.0,
      countValue: 253.0,
      reporter: "אורן"
    },
    {
      countId: "CNT-102",
      timestamp: "2026-10-25 18:32",
      itemId: "ITM-006",
      itemName: "חסה קיסר טרייה",
      previousStock: 6.0,
      countedQty: 4.0,
      delta: -2.0,
      unit: "צרור",
      unitCostSnapshot: 7.5,
      countValue: 30.0,
      reporter: "אורן"
    }
  ],

  logDeliveries: [
    {
      id: "DLV-301",
      timestamp: "2026-10-26 09:15",
      supplierId: "SUP-02",
      supplierName: "מחלבת בוטיק כפר תבור",
      invoiceNumber: "INV-88412",
      receivedBy: "ישראל",
      notes: "סחורה הגיעה בטמפרטורה תקינה 3°C",
      totalAmountExclVat: 669.00,
      items: [
        {
          itemId: "ITM-002",
          itemName: "פקורינו רומנו DOP",
          unit: 'ק"ג',
          receivedQty: 3.0,
          previousUnitCost: 98.00,
          newUnitCost: 98.00,
          priceChanged: false,
          lineTotal: 294.00
        },
        {
          itemId: "ITM-004",
          itemName: "ברי כמהין צרפתית",
          unit: 'ק"ג',
          receivedQty: 2.5,
          previousUnitCost: 102.00,
          newUnitCost: 105.00,
          priceChanged: true,
          lineTotal: 262.50
        },
        {
          itemId: "ITM-005",
          itemName: "לאבנה עיזים מקומית 9%",
          unit: 'ק"ג',
          receivedQty: 2.5,
          previousUnitCost: 42.00,
          newUnitCost: 45.00,
          priceChanged: true,
          lineTotal: 112.50
        }
      ]
    },
    {
      id: "DLV-302",
      timestamp: "2026-10-27 07:45",
      supplierId: "SUP-04",
      supplierName: "מאפיית לחמי בוטיק",
      invoiceNumber: "INV-1094",
      receivedBy: "אורן",
      notes: "אספקת בוקר שוטפת",
      totalAmountExclVat: 180.00,
      items: [
        {
          itemId: "ITM-014",
          itemName: "לחם מחמצת שיפון כפרי",
          unit: "יח'",
          receivedQty: 10.0,
          previousUnitCost: 18.00,
          newUnitCost: 18.00,
          priceChanged: false,
          lineTotal: 180.00
        }
      ]
    }
  ],

  logWaste: [
    {
      wasteId: "WST-201",
      timestamp: "2026-10-26 14:15",
      reporter: "אורן",
      itemId: "ITM-006",
      itemName: "חסה קיסר טרייה",
      wasteQty: 1.5,
      stockUnit: "צרור",
      wasteReason: "פג תוקף / קלקול",
      totalWasteCost: 13.24, // 1.5 * (7.5 / 0.85)
      notes: "חסה התעייפה בסופ\"ש"
    },
    {
      wasteId: "WST-202",
      timestamp: "2026-10-26 21:40",
      reporter: "ישראל",
      itemId: "ITM-014",
      itemName: "לחם מחמצת שיפון כפרי",
      wasteQty: 2.0,
      stockUnit: "יח'",
      wasteReason: "הכנת יתר",
      totalWasteCost: 40.0,
      notes: "לחמי מחמצת שנפרסו ולא נמכרו בסגירה"
    }
  ],

  logLabor: [
    {
      monthId: "2026-09",
      salesInclVat: 148500,
      salesExclVat: 125847.46,
      serviceHours: 540,
      prepHours: 260,
      hourlyWagesGross: 36000,
      salariedGross: 14000,
      employerCost: 65000,
      laborPct: 0.148, // 14.8%
      splh: 157.31,
      notes: "ספטמבר חגים — עמידה ביעד לייבור מתחת ל-15%"
    },
    {
      monthId: "2026-10",
      salesInclVat: 132000,
      salesExclVat: 111864.41,
      serviceHours: 490,
      prepHours: 230,
      hourlyWagesGross: 32400,
      salariedGross: 14000,
      employerCost: 60320,
      laborPct: 0.154, // 15.4%
      splh: 155.37,
      notes: "אוקטובר שוטף — מעקב צמוד בסופי שבוע"
    }
  ],

  logLaborDaily: [
    {
      id: "LBR-DAY-01",
      date: "2026-10-22",
      monthId: "2026-10",
      weekLabel: "שבוע 4 (18/10 - 24/10)",
      dayOfWeek: "יום חמישי",
      salesInclVat: 18400,
      salesExclVat: 15593.22,
      hourlyBoxes: [
        { id: "HB-1", roleLabel: "טבח פס קר", hours: 7, hourlyRate: 55 },
        { id: "HB-2", roleLabel: "טבח סרוויס", hours: 6, hourlyRate: 65 },
        { id: "HB-3", roleLabel: "הכנות ושטיפה", hours: 5, hourlyRate: 45 }
      ],
      globalBoxes: [
        { id: "GB-1", roleLabel: "שף / מנהל מטבח (גלובלי יומי)", amount: 650 }
      ],
      totalHours: 18,
      hourlyGrossSum: 1000,
      globalGrossSum: 650,
      totalGrossWages: 1650,
      employerMultiplier: 1.30,
      employerCost: 2145.00,
      netBalance: 13448.22,
      laborPct: 0.1376,
      splh: 866.29,
      notes: "סרוויס חמישי ערב מלא"
    },
    {
      id: "LBR-DAY-02",
      date: "2026-10-23",
      monthId: "2026-10",
      weekLabel: "שבוע 4 (18/10 - 24/10)",
      dayOfWeek: "יום שישי",
      salesInclVat: 28900,
      salesExclVat: 24491.53,
      hourlyBoxes: [
        { id: "HB-4", roleLabel: "טבח פלטות 1", hours: 8, hourlyRate: 60 },
        { id: "HB-5", roleLabel: "טבח פלטות 2", hours: 8, hourlyRate: 50 },
        { id: "HB-6", roleLabel: "טבח ברוסקטות וסלטים", hours: 7, hourlyRate: 70 },
        { id: "HB-7", roleLabel: "שוטף כלים ועוזר", hours: 6, hourlyRate: 45 }
      ],
      globalBoxes: [
        { id: "GB-2", roleLabel: "שף (גלובלי יומי)", amount: 700 }
      ],
      totalHours: 29,
      hourlyGrossSum: 1640,
      globalGrossSum: 700,
      totalGrossWages: 2340,
      employerMultiplier: 1.30,
      employerCost: 3042.00,
      netBalance: 21449.53,
      laborPct: 0.1242,
      splh: 844.54,
      notes: "שישי שיא ביקורים ביקב"
    }
  ],

  logOrders: [],
  logDeliveries: []
};
