/**
 * Field Mode — Fast Waste Logging View (דיווח פחת מהיר בשטח)
 */

import { store } from "../store.js";
import { CalculationService } from "../services/calculationService.js";

let selectedItemId = "";
let wasteQty = 1;
let wasteReason = "פג תוקף / קלקול";
let notes = "";
let reporter = "צוות מטבח";

export function renderFieldWaste(container) {
  const state = store.getState();
  const catalog = state.catalog.filter(i => i.isActive && i.inWasteForm);

  if (!selectedItemId && catalog.length > 0) {
    selectedItemId = catalog[0].id;
  }

  const selectedItem = catalog.find(i => i.id === selectedItemId);
  let estimatedCost = 0;
  if (selectedItem) {
    const effectiveCost = CalculationService.calculateEffectiveCost(
      selectedItem.unitCostExclVat,
      selectedItem.yieldLossPct
    );
    estimatedCost = (Number(wasteQty) || 0) * effectiveCost;
  }

  const recentWaste = (state.logWaste || []).slice(0, 5);

  container.innerHTML = `
    <div class="field-view">
      <div class="waste-card">
        <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">🗑️ דיווח פחת מהיר</h2>
        <p style="font-size: 12px; color: var(--color-text-dim); margin-bottom: var(--space-md);">
          רישום פחת גורע מיד מהמלאי ומחשב את העלות הכספית האפקטיבית.
        </p>

        <!-- תצוגת עלות בזמן אמת -->
        <div class="waste-cost-preview">
          <div style="font-size: 12px; color: var(--color-danger); font-weight: 600;">עלות פחת מוערכת:</div>
          <div class="waste-cost-val">₪${estimatedCost.toFixed(2)}</div>
          <div style="font-size: 11px; color: var(--color-text-dim);">
            ${selectedItem ? `עלות אפקטיבית: ₪${CalculationService.calculateEffectiveCost(selectedItem.unitCostExclVat, selectedItem.yieldLossPct).toFixed(2)} ל-${selectedItem.stockUnit}` : ''}
          </div>
        </div>

        <form id="fastWasteForm">
          <!-- 1. בחירת חומר גלם -->
          <div class="form-group">
            <label class="form-label">חומר גלם</label>
            <select class="form-select" id="wasteItemSelect">
              ${catalog.map(item => `
                <option value="${item.id}" ${item.id === selectedItemId ? 'selected' : ''}>
                  ${item.name} (${item.category} — מלאי נוכחי: ${item.currentStock} ${item.stockUnit})
                </option>
              `).join('')}
            </select>
          </div>

          <!-- 2. כמות פחת -->
          <div class="form-group">
            <label class="form-label">כמות שנזרקה / הושחתה (${selectedItem ? selectedItem.stockUnit : 'יח\''})</label>
            <div class="stepper-container" style="width: 100%;">
              <button type="button" class="stepper-btn" id="wasteMinusBtn" style="flex: 1;">-</button>
              <input 
                type="number" 
                step="any" 
                class="stepper-input" 
                id="wasteQtyInput" 
                value="${wasteQty}" 
                style="flex: 2; font-size: 18px;" 
                required 
              />
              <button type="button" class="stepper-btn" id="wastePlusBtn" style="flex: 1;">+</button>
            </div>
          </div>

          <!-- 3. סיבת פחת -->
          <div class="form-group">
            <label class="form-label">סיבת פחת</label>
            <select class="form-select" id="wasteReasonSelect">
              <option value="פג תוקף / קלקול" ${wasteReason === 'פג תוקף / קלקול' ? 'selected' : ''}>🥀 פג תוקף / קלקול טבעי</option>
              <option value="נפל / נשבר / נזק" ${wasteReason === 'נפל / נשבר / נזק' ? 'selected' : ''}>💥 נפל / נשבר / נזק פיזי</option>
              <option value="הכנה שגויה / תקלה" ${wasteReason === 'הכנה שגויה / תקלה' ? 'selected' : ''}>⚠️ הכנה שגויה / תקלה בפס</option>
              <option value="טעימות עובדים / אירוח" ${wasteReason === 'טעימות עובדים / אירוח' ? 'selected' : ''}>🍷 טעימות עובדים / אירוח מיוחד</option>
            </select>
          </div>

          <!-- הערות ודיווח -->
          <div class="form-group">
            <label class="form-label">שם המדווח</label>
            <input type="text" class="form-input" id="wasteReporterInput" value="${reporter}" />
          </div>

          <div class="form-group">
            <label class="form-label">הערה קצרה (אופציונלי)</label>
            <input type="text" class="form-input" id="wasteNotesInput" placeholder="למשל: נשבר במהלך פריקה..." value="${notes}" />
          </div>

          <button type="submit" class="btn btn-primary" style="width: 100%; min-height: 48px; font-size: 15px;">
            🗑️ רשום פחת וגרע מהמלאי
          </button>
        </form>
      </div>

      <!-- רישומים אחרונים -->
      ${recentWaste.length > 0 ? `
        <div style="margin-top: var(--space-lg); max-width: 480px; margin-left: auto; margin-right: auto;">
          <h4 style="font-size: 13px; font-weight: 600; color: var(--color-text-secondary); margin-bottom: var(--space-xs);">
            📋 דיווחים אחרונים שנרשמו
          </h4>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${recentWaste.map(w => `
              <div style="background: var(--color-bg-surface); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-border-subtle); display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
                <div>
                  <div style="font-weight: 600;">${w.itemName} — ${w.wasteQty} ${w.stockUnit || ''}</div>
                  <div style="color: var(--color-text-dim); font-size: 11px;">${w.wasteReason} • ע"י ${w.reporter}</div>
                </div>
                <div style="font-weight: 700; color: var(--color-danger);">
                  ₪${Number(w.totalWasteCost).toFixed(2)}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  // Listeners
  const itemSelect = container.querySelector("#wasteItemSelect");
  if (itemSelect) {
    itemSelect.addEventListener("change", (e) => {
      selectedItemId = e.target.value;
      renderFieldWaste(container);
    });
  }

  const qtyInput = container.querySelector("#wasteQtyInput");
  if (qtyInput) {
    qtyInput.addEventListener("input", (e) => {
      wasteQty = Math.max(0, Number(e.target.value) || 0);
      updateCostPreview(container, catalog);
    });
  }

  container.querySelector("#wastePlusBtn")?.addEventListener("click", () => {
    wasteQty += 1;
    if (qtyInput) qtyInput.value = wasteQty;
    updateCostPreview(container, catalog);
  });

  container.querySelector("#wasteMinusBtn")?.addEventListener("click", () => {
    wasteQty = Math.max(0, wasteQty - 1);
    if (qtyInput) qtyInput.value = wasteQty;
    updateCostPreview(container, catalog);
  });

  container.querySelector("#wasteReasonSelect")?.addEventListener("change", (e) => {
    wasteReason = e.target.value;
  });

  container.querySelector("#wasteReporterInput")?.addEventListener("input", (e) => {
    reporter = e.target.value;
  });

  container.querySelector("#wasteNotesInput")?.addEventListener("input", (e) => {
    notes = e.target.value;
  });

  const form = container.querySelector("#fastWasteForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!selectedItemId || wasteQty <= 0) {
        alert("נא לבחור חומר גלם ולהזין כמות חיובית.");
        return;
      }

      try {
        store.logWaste({
          itemId: selectedItemId,
          wasteQty,
          wasteReason,
          reporter,
          notes
        });

        alert("✅ הפחת נרשם בהצלחה והמלאי עודכן!");
        wasteQty = 1;
        notes = "";
        renderFieldWaste(container);
      } catch (err) {
        alert("שגיאה ברישום פחת: " + err.message);
      }
    });
  }
}

function updateCostPreview(container, catalog) {
  const selectedItem = catalog.find(i => i.id === selectedItemId);
  if (!selectedItem) return;

  const effectiveCost = CalculationService.calculateEffectiveCost(
    selectedItem.unitCostExclVat,
    selectedItem.yieldLossPct
  );
  const cost = (Number(wasteQty) || 0) * effectiveCost;
  const valEl = container.querySelector(".waste-cost-val");
  if (valEl) {
    valEl.textContent = `₪${cost.toFixed(2)}`;
  }
}
