/**
 * CalculationService — Pure reactive calculations for Kitchen OS v3.0.
 * Decoupled from DOM and storage for 100% isolated testability.
 */

export const CalculationService = {
  /**
   * עלות אפקטיבית של חומר גלם לאחר פחת קילוף/חיתוך
   * Effective Cost = Unit Cost / (1 - Yield Loss Pct)
   */
  calculateEffectiveCost(unitCostExclVat, yieldLossPct = 0) {
    const cost = Number(unitCostExclVat) || 0;
    const loss = Math.min(0.95, Math.max(0, Number(yieldLossPct) || 0));
    return cost / (1 - loss);
  },

  /**
   * הפשטת מע"מ ממחיר לצרכן
   * Price Excl VAT = Price Incl VAT / (1 + VAT Rate)
   */
  calculatePriceExclVat(priceInclVat, vatRate = 0.18) {
    const price = Number(priceInclVat) || 0;
    const vat = Number(vatRate) || 0.18;
    return price / (1 + vat);
  },

  /**
   * פוד-קוסט באחוזים
   */
  calculateFoodCostPct(totalCost, priceExclVat) {
    const cost = Number(totalCost) || 0;
    const price = Number(priceExclVat) || 0;
    if (price <= 0) return 0;
    return cost / price;
  },

  /**
   * רווח גולמי ב-₪
   */
  calculateGrossProfit(priceExclVat, totalCost) {
    const price = Number(priceExclVat) || 0;
    const cost = Number(totalCost) || 0;
    return price - cost;
  },

  /**
   * חישוב עלות מנה או מתכון הכנה באופן רקורסיבי ומדורג (Cascading BOM)
   */
  calculateDishCost(dishId, allDishes, allRecipeLines, catalogItems, visited = new Set()) {
    if (visited.has(dishId)) {
      console.warn(`[CalculationService] Circular dependency detected in dish: ${dishId}`);
      return 0;
    }
    visited.add(dishId);

    const dish = allDishes.find(d => d.id === dishId);
    if (!dish) return 0;

    const lines = allRecipeLines.filter(l => l.parentDishId === dishId);
    let totalCost = 0;

    for (const line of lines) {
      const qty = Number(line.quantity) || 0;
      let unitCost = 0;

      if (line.componentType === "RAW_ITEM") {
        const raw = catalogItems.find(c => c.id === line.componentId);
        if (raw) {
          unitCost = this.calculateEffectiveCost(raw.unitCostExclVat, raw.yieldLossPct);
        }
      } else if (line.componentType === "SUB_RECIPE") {
        // עלות מנת הכנה למנה אחת (Portion Cost)
        const subDish = allDishes.find(d => d.id === line.componentId);
        if (subDish) {
          const subTotalCost = this.calculateDishCost(subDish.id, allDishes, allRecipeLines, catalogItems, new Set(visited));
          const portions = Number(subDish.yieldPortions) || 1;
          unitCost = portions > 0 ? (subTotalCost / portions) : 0;
        }
      }

      totalCost += qty * unitCost;
    }

    return totalCost;
  },

  /**
   * כמות להזמנה מול תקן סופ"ש
   */
  calculateOrderQty(currentStock, parLevelWeekend, reorderPoint) {
    const stock = Number(currentStock) || 0;
    const par = Number(parLevelWeekend) || 0;
    const reorder = Number(reorderPoint) || 0;

    if (stock <= reorder) {
      return Math.max(0, par - stock);
    }
    return 0;
  },

  /**
   * פדיון לשעת עבודה (SPLH)
   */
  calculateSplh(salesExclVat, serviceHours, prepHours) {
    const sales = Number(salesExclVat) || 0;
    const hours = (Number(serviceHours) || 0) + (Number(prepHours) || 0);
    return hours > 0 ? (sales / hours) : 0;
  },

  /**
   * סיווג הנדסת תפריט (Menu Engineering Matrix)
   */
  classifyMenuMatrix(foodCostPct, targetFoodCost = 0.30, weeklySalesQty = 0, avgSalesQty = 30) {
    const fc = Number(foodCostPct) || 0;
    const target = Number(targetFoodCost) || 0.30;
    const sales = Number(weeklySalesQty) || 0;
    const avg = Number(avgSalesQty) || 30;

    const isHighMargin = fc <= target; // פוד-קוסט נמוך = מרווח גבוה
    const isHighPopularity = sales >= avg; // מכירות גבוהות

    if (isHighMargin && isHighPopularity) {
      return { label: "כוכב", icon: "⭐", class: "matrix-star", desc: "רווחיות גבוהה וביקוש גבוה" };
    }
    if (!isHighMargin && isHighPopularity) {
      return { label: "סוס עבודה", icon: "🐴", class: "matrix-plowhorse", desc: "פופולרי אך דורש הידוק עלויות" };
    }
    if (isHighMargin && !isHighPopularity) {
      return { label: "חידה", icon: "🧩", class: "matrix-puzzle", desc: "רווחי מאוד אך נדרש קידום מכירות" };
    }
    return { label: "כלב", icon: "🐕", class: "matrix-dog", desc: "פוד-קוסט חורג וביקוש נמוך (לבחון החלפה)" };
  },

  /**
   * חישוב מפורט של משמרת/יום עבודה בלייבור (תיבות שעתיות דינמיות + תיבות שכר גלובלי + דמי מעביד)
   */
  calculateDailyLaborEntry({
    salesInclVat = 0,
    vatRate = 0.18,
    employerCostMultiplier = 1.30,
    hourlyBoxes = [], // [{ roleLabel, hours, hourlyRate }]
    globalBoxes = []  // [{ roleLabel, amount }]
  }) {
    const grossSales = Math.max(0, Number(salesInclVat) || 0);
    const salesExclVat = this.calculatePriceExclVat(grossSales, vatRate);

    let totalHours = 0;
    let hourlyGrossSum = 0;

    for (const box of hourlyBoxes) {
      const h = Math.max(0, Number(box.hours) || 0);
      const r = Math.max(0, Number(box.hourlyRate) || 0);
      totalHours += h;
      hourlyGrossSum += h * r;
    }

    let globalGrossSum = 0;
    for (const gBox of globalBoxes) {
      const amt = Math.max(0, Number(gBox.amount) || 0);
      globalGrossSum += amt;
    }

    const totalGrossWages = hourlyGrossSum + globalGrossSum;
    const mult = Number(employerCostMultiplier) || 1.30;
    const employerCost = totalGrossWages * mult;
    const netBalance = salesExclVat - employerCost; // הכנסה נטו מול הוצאת לייבור כולל דמי מעביד
    const laborPct = salesExclVat > 0 ? (employerCost / salesExclVat) : 0;
    const splh = totalHours > 0 ? (salesExclVat / totalHours) : 0;

    return {
      salesInclVat: Number(grossSales.toFixed(2)),
      salesExclVat: Number(salesExclVat.toFixed(2)),
      totalHours: Number(totalHours.toFixed(2)),
      hourlyGrossSum: Number(hourlyGrossSum.toFixed(2)),
      globalGrossSum: Number(globalGrossSum.toFixed(2)),
      totalGrossWages: Number(totalGrossWages.toFixed(2)),
      employerMultiplier: mult,
      employerCost: Number(employerCost.toFixed(2)),
      netBalance: Number(netBalance.toFixed(2)),
      laborPct: Number(laborPct.toFixed(4)),
      splh: Number(splh.toFixed(2))
    };
  }
};
