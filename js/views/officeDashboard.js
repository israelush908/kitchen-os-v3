/**
 * Office Mode — Executive KPI Dashboard (מרכז שליטה ובקרה תפעולי)
 */

import { store } from "../store.js";
import { CalculationService } from "../services/calculationService.js";
import { InventoryService } from "../services/inventoryService.js";
import { OrderDispatcher } from "../services/orderDispatcher.js";

export function renderOfficeDashboard(container) {
  const state = store.getState();
  const config = state.config;

  // 1. מדד שווי מלאי נוכחי
  const totalStockValue = InventoryService.calculateTotalStockValue(state.catalog);

  // 2. מדד פריטים בחוסר
  const deficitItems = InventoryService.getDeficitItems(state.catalog);

  // 3. מדד לייבור
  const latestLabor = (state.logLabor || [])[0];
  const laborPct = latestLabor ? latestLabor.laborPct : 0.093;
  const targetLabor = config.targetLaborCost || 0.15;
  const isLaborOk = laborPct <= targetLabor;

  // 4. פוד-קוסט ממוצע תפריט
  const menuDishes = state.dishes.filter(d => d.dishType === "MENU_ITEM");
  let totalFoodCostSum = 0;
  let dishesWithCostCount = 0;

  const dishCalculations = menuDishes.map(dish => {
    const cost = CalculationService.calculateDishCost(
      dish.id,
      state.dishes,
      state.recipeLines,
      state.catalog
    );
    const portions = Number(dish.yieldPortions) || 1;
    const portionCost = portions > 0 ? (cost / portions) : 0;
    const priceExclVat = CalculationService.calculatePriceExclVat(dish.priceInclVat, config.vatRate);
    const fcPct = CalculationService.calculateFoodCostPct(portionCost, priceExclVat);
    const profit = CalculationService.calculateGrossProfit(priceExclVat, portionCost);

    if (priceExclVat > 0) {
      totalFoodCostSum += fcPct;
      dishesWithCostCount++;
    }

    return {
      ...dish,
      portionCost,
      priceExclVat,
      fcPct,
      profit
    };
  });

  const avgFoodCost = dishesWithCostCount > 0 ? (totalFoodCostSum / dishesWithCostCount) : 0.245;
  const isFoodCostOk = avgFoodCost <= (config.targetFoodCost || 0.30);

  // 5. סך פחת מצטבר
  const totalWaste = (state.logWaste || []).reduce((sum, w) => sum + (Number(w.totalWasteCost) || 0), 0);

  // 6. משימות פתוחות
  const openTasks = (state.managerTasks || []).filter(t => t.status !== "הושלם");

  // Watchlist: מנות מעל 30% פוד-קוסט
  const highFoodCostDishes = dishCalculations.filter(d => d.fcPct > (config.targetFoodCost || 0.30));

  container.innerHTML = `
    <div class="office-dashboard">
      <!-- כותרת ראשית -->
      <div style="margin-bottom: var(--space-lg); display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="font-size: 24px; font-weight: 700; color: var(--color-text-primary);">
            🍷 מרכז שליטה ובקרה תפעולי — יקב
          </h1>
          <p style="font-size: 13px; color: var(--color-text-dim); margin-top: 4px;">
            לוח מחוונים תפעולי בזמן אמת | סנכרון דו-כיווני פעיל
          </p>
        </div>
        <button class="btn btn-secondary" id="btnResetData" style="font-size: 12px;">
          🔄 אפס לנתוני ברירת מחדל
        </button>
      </div>

      <!-- 6 כרטיסי KPI -->
      <div class="kpi-grid">
        <!-- 1. שווי מלאי -->
        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-title">שווי מלאי נוכחי</span>
            <span class="kpi-icon">📦</span>
          </div>
          <div class="kpi-value">₪${totalStockValue.toLocaleString("he-IL", { maximumFractionDigits: 0 })}</div>
          <div class="kpi-footer">מחושב לפי ספירה אחרונה ומחיר ספק</div>
        </div>

        <!-- 2. פריטים בחוסר -->
        <div class="kpi-card" style="${deficitItems.length > 0 ? 'border-color: #fca5a5; background: #fffbfb;' : ''}">
          <div class="kpi-card-header">
            <span class="kpi-title">פריטים בחוסר להזמנה</span>
            <span class="kpi-icon">🚨</span>
          </div>
          <div class="kpi-value" style="${deficitItems.length > 0 ? 'color: var(--status-critical);' : ''}">
            ${deficitItems.length}
          </div>
          <div class="kpi-footer">
            ${deficitItems.length > 0 ? `<span class="badge badge-danger">דחוף להזמין</span>` : `<span class="badge badge-success">מלאי מעל המינימום</span>`}
          </div>
        </div>

        <!-- 3. לייבור -->
        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-title">אחוז לייבור משוקלל</span>
            <span class="kpi-icon">👥</span>
          </div>
          <div class="kpi-value">${(laborPct * 100).toFixed(1)}%</div>
          <div class="kpi-footer">
            ${isLaborOk ? `
              <span class="badge badge-success">✅ עומד ביעד (עד ${(targetLabor * 100).toFixed(0)}%)</span>
            ` : `
              <span class="badge badge-danger">🔴 חריגה מיעד ${(targetLabor * 100).toFixed(0)}%</span>
            `}
          </div>
        </div>

        <!-- 4. פוד-קוסט תפריט -->
        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-title">פוד-קוסט ממוצע תפריט</span>
            <span class="kpi-icon">🍽️</span>
          </div>
          <div class="kpi-value">${(avgFoodCost * 100).toFixed(1)}%</div>
          <div class="kpi-footer">
            ${isFoodCostOk ? `
              <span class="badge badge-success">✅ עומד ביעד (עד ${(config.targetFoodCost * 100).toFixed(0)}%)</span>
            ` : `
              <span class="badge badge-danger">🔴 חריגה מיעד ${(config.targetFoodCost * 100).toFixed(0)}%</span>
            `}
          </div>
        </div>

        <!-- 5. סך פחת -->
        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-title">סך פחת מצטבר</span>
            <span class="kpi-icon">🗑️</span>
          </div>
          <div class="kpi-value">₪${totalWaste.toLocaleString("he-IL", { maximumFractionDigits: 0 })}</div>
          <div class="kpi-footer">מתוך ${(state.logWaste || []).length} דיווחי פחת רשומים</div>
        </div>

        <!-- 6. משימות פתוחות -->
        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-title">משימות פתוחות</span>
            <span class="kpi-icon">🔥</span>
          </div>
          <div class="kpi-value">${openTasks.length}</div>
          <div class="kpi-footer">מתוך ${(state.managerTasks || []).length} משימות מוגדרות</div>
        </div>
      </div>

      <!-- גריד טבלאות תפעוליות -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-lg); margin-bottom: var(--space-lg);">
        <!-- טבלה 1: התראות מלאי ופריטים בחוסר -->
        <div class="card">
          <h3 class="card-title" style="font-size: 15px;">🚨 התראות מלאי ופריטים בחוסר (Stock Alert Feed)</h3>
          <p class="card-subtitle" style="margin-bottom: var(--space-md);">פריטים שירדו מנקודת ההזמנה וממתינים לאישור רכש</p>

          ${deficitItems.length === 0 ? `
            <div style="padding: 20px; text-align: center; color: var(--status-success); font-weight: 600;">
              אין פריטים בחוסר מלאי כרגע ✅
            </div>
          ` : `
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>חומר גלם</th>
                    <th>ספק</th>
                    <th>מלאי נוכחי</th>
                    <th>תקן סופ"ש</th>
                    <th>להזמנה</th>
                  </tr>
                </thead>
                <tbody>
                  ${deficitItems.map(item => {
                    const sup = state.suppliers.find(s => s.id === item.supplierId);
                    const orderQty = Math.max(0, item.parLevelWeekend - item.currentStock);
                    return `
                      <tr>
                        <td><strong>${item.name}</strong></td>
                        <td>${sup ? sup.name : ''}</td>
                        <td><span class="badge badge-danger">${item.currentStock} ${item.stockUnit}</span></td>
                        <td>${item.parLevelWeekend} ${item.stockUnit}</td>
                        <td><strong>${orderQty} ${item.stockUnit}</strong></td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <!-- טבלה 2: מוקד משימות דחופות -->
        <div class="card">
          <h3 class="card-title" style="font-size: 15px;">⚡ מוקד משימות תפעוליות (Action Center)</h3>
          <p class="card-subtitle" style="margin-bottom: var(--space-md);">מעקב משימות מטבח ומנהל לפי עדיפות</p>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>סטטוס</th>
                  <th>תיאור משימה</th>
                  <th>אחראי</th>
                  <th>עדיפות</th>
                </tr>
              </thead>
              <tbody>
                ${(state.managerTasks || []).slice(0, 5).map(task => `
                  <tr>
                    <td>
                      <input 
                        type="checkbox" 
                        class="task-toggle-checkbox" 
                        data-id="${task.id}" 
                        ${task.status === 'הושלם' ? 'checked' : ''} 
                        style="width: 18px; height: 18px; cursor: pointer;"
                      />
                    </td>
                    <td style="${task.status === 'הושלם' ? 'text-decoration: line-through; color: var(--color-text-dim);' : 'font-weight: 500;'}">
                      ${task.title}
                    </td>
                    <td>${task.assignee}</td>
                    <td>
                      <span class="badge ${task.priority === 'גבוהה' ? 'badge-danger' : 'badge-gray'}">
                        ${task.priority}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- מנות תפריט לבקרת רווחיות -->
      <div class="card">
        <h3 class="card-title" style="font-size: 15px;">📊 מנות תפריט לבקרת רווחיות ופוד-קוסט (Food Cost Watchlist)</h3>
        <p class="card-subtitle" style="margin-bottom: var(--space-md);">מנות שהפוד-קוסט שלהן עולה על 30% או מצריך בקרה</p>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>שם מנה</th>
                <th>קטגוריה</th>
                <th>עלות מנה ₪</th>
                <th>מחיר נטו (ללא מע"מ)</th>
                <th>מחיר לצרכן</th>
                <th>פוד-קוסט %</th>
                <th>רווח גולמי למנה ₪</th>
                <th>סיווג</th>
              </tr>
            </thead>
            <tbody>
              ${dishCalculations.map(dish => {
                const isOver = dish.fcPct > 0.30;
                return `
                  <tr style="${isOver ? 'background: #fff8f8;' : ''}">
                    <td><strong>${dish.name}</strong></td>
                    <td>${dish.category}</td>
                    <td>₪${dish.portionCost.toFixed(2)}</td>
                    <td>₪${dish.priceExclVat.toFixed(2)}</td>
                    <td>₪${dish.priceInclVat.toFixed(2)}</td>
                    <td>
                      <span class="badge ${isOver ? 'badge-danger' : 'badge-success'}">
                        ${(dish.fcPct * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td style="font-weight: 600; color: ${dish.profit > 0 ? 'var(--status-success)' : 'var(--status-critical)'};">
                      ₪${dish.profit.toFixed(2)}
                    </td>
                    <td>
                      <span class="badge ${isOver ? 'badge-danger' : 'badge-wine'}">
                        ${isOver ? 'חורג 🔴' : 'תקין 🟢'}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Toggle tasks
  container.querySelectorAll(".task-toggle-checkbox").forEach(box => {
    box.addEventListener("change", () => {
      const id = box.dataset.id;
      store.toggleManagerTask(id);
      renderOfficeDashboard(container);
    });
  });

  // Reset data button
  container.querySelector("#btnResetData")?.addEventListener("click", () => {
    if (confirm("האם לאפס את כל הנתונים לברירת המחדל הראשונית?")) {
      store.resetToDefaults();
      renderOfficeDashboard(container);
      alert("הנתונים אופסו בהצלחה!");
    }
  });
}
