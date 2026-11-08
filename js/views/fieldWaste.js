/**
 * Field Mode — Fast Waste Logging View (דיווח פחת מהיר ב-5 שניות)
 * Aesthetic: Swiss Kitchen Editorial (REQ-10, R11, R20, R21, R46)
 */

import { store } from "../store.js";
import { CalculationService } from "../services/calculationService.js";

let selectedItemId = "";
let wasteQty = 0.5;
let wasteReason = "פג תוקף / קלקול";
let notes = "";
let reporter = "צוות מטבח";

const WASTE_REASONS = [
  "פג תוקף / קלקול",
  "נפל / נשבר / נזק",
  "הכנה שגויה / תקלה",
  "טעימות עובדים / אירוח"
];

export function renderFieldWaste(container) {
  const state = store.getState();
  const catalog = (state.catalog || []).filter(i => i.isActive && i.inWasteForm);

  if (!selectedItemId && catalog.length > 0) {
    selectedItemId = catalog[0].id;
  }

  const selectedItem = catalog.find(i => i.id === selectedItemId);
  let effectiveUnitCost = 0;
  let estimatedCost = 0;
  let remainingStock = 0;

  if (selectedItem) {
    effectiveUnitCost = CalculationService.calculateEffectiveCost(
      selectedItem.unitCostExclVat,
      selectedItem.yieldLossPct
    );
    estimatedCost = (Number(wasteQty) || 0) * effectiveUnitCost;
    remainingStock = Math.max(0, (Number(selectedItem.currentStock) || 0) - (Number(wasteQty) || 0));
  }

  const recentWaste = (state.logWaste || []).slice(0, 4);

  container.innerHTML = `
    <div class="field-view">
      <!-- סרגל כותרת עליון -->
      <div class="field-control-strip">
        <div class="field-section-header" style="margin-bottom: 0;">
          <div>
            <h1 class="field-section-title">דיווח פחת מהיר</h1>
            <div style="font-size: 13px; color: var(--color-ink-secondary); margin-top: 2px;">
              רישום ב-3 שלבים · גריעה מיידית מיתרת המלאי
            </div>
          </div>
          ${selectedItem ? `
            <span class="badge badge-unit" dir="ltr">₪${effectiveUnitCost.toFixed(2)} / ${selectedItem.stockUnit}</span>
          ` : ''}
        </div>
      </div>

      <form id="fastWasteForm" class="waste-form-container">
        <!-- שלב 1: בחירת פריט חומר גלם (REQ-10) -->
        <div class="waste-step-block">
          <div class="waste-step-label">
            <span>1. בחירת פריט שנפסל</span>
            ${selectedItem ? `<span>מלאי נוכחי: <strong class="mono">${selectedItem.currentStock}</strong> ${selectedItem.stockUnit}</span>` : ''}
          </div>
          <select class="form-select" id="wasteItemSelect" aria-label="בחירת חומר גלם לדיווח פחת">
            ${catalog.map(item => `
              <option value="${item.id}" ${item.id === selectedItemId ? 'selected' : ''}>
                ${item.name} (${item.category} · ₪${CalculationService.calculateEffectiveCost(item.unitCostExclVat, item.yieldLossPct).toFixed(2)}/${item.stockUnit})
              </option>
            `).join('')}
          </select>
        </div>

        <!-- שלב 2: כמות שנפסלה + כפתורי הוספה מהירה (REQ-10, R20) -->
        <div class="waste-step-block">
          <div class="waste-step-label">
            <span>2. כמות שנפסלה (${selectedItem ? selectedItem.stockUnit : 'יח\''})</span>
            <span class="badge-unit">${selectedItem ? selectedItem.stockUnit : 'יח\''}</span>
          </div>

          <div class="stepper-container" style="width: 100%; justify-content: space-between;">
            <button type="button" class="stepper-btn" id="wasteMinusBtn" style="width: 56px; height: 52px;" aria-label="הפחת כמות פחת">−</button>
            <input
              type="number"
              step="any"
              class="stepper-input"
              id="wasteQtyInput"
              value="${wasteQty}"
              style="flex: 1; height: 52px; font-size: 26px;"
              required
              aria-label="כמות פחת"
            />
            <button type="button" class="stepper-btn" id="wastePlusBtn" style="width: 56px; height: 52px;" aria-label="הוסף כמות פחת">+</button>
          </div>

          <!-- כפתורי קיצור +0.25 / +0.50 / +1.00 (REQ-10) -->
          <div class="waste-quick-pills">
            <button type="button" class="waste-quick-pill" data-add="0.25">+0.25</button>
            <button type="button" class="waste-quick-pill" data-add="0.5">+0.50</button>
            <button type="button" class="waste-quick-pill" data-add="1">+1.00</button>
          </div>
        </div>

        <!-- שלב 3: סיבת הפחת ב-Grid 2x2 (REQ-10, R20) -->
        <div class="waste-step-block">
          <div class="waste-step-label">
            <span>3. סיבת הפחת</span>
            <span>בחר סיבה אחת</span>
          </div>
          <div class="waste-reason-grid" role="radiogroup" aria-label="סיבת הפחת">
            ${WASTE_REASONS.map(reason => `
              <button
                type="button"
                class="waste-reason-chip ${wasteReason === reason ? 'active' : ''}"
                data-reason="${reason}"
                role="radio"
                aria-checked="${wasteReason === reason}"
              >
                ${reason}
              </button>
            `).join('')}
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px;">
            <div>
              <label class="form-label" for="wasteReporterInput" style="font-size: 12px;">מדווח</label>
              <input type="text" class="form-input" id="wasteReporterInput" value="${reporter}" style="min-height: 44px; font-size: 14px;" />
            </div>
            <div>
              <label class="form-label" for="wasteNotesInput" style="font-size: 12px;">הערה (אופציונלי)</label>
              <input type="text" class="form-input" id="wasteNotesInput" placeholder="פירוט קצר..." value="${notes}" style="min-height: 44px; font-size: 14px;" />
            </div>
          </div>
        </div>

        <!-- קבלת השפעה כספית (FinancialImpactTicket - REQ-10) -->
        <div class="waste-cost-preview">
          <div class="waste-ticket-row">
            <span style="font-size: 15px; font-weight: 700; color: var(--color-ink-primary);">אומדן עלות פחת (אפקטיבי):</span>
            <span class="waste-cost-val" id="wasteCostVal">₪${estimatedCost.toFixed(2)}</span>
          </div>
          <div class="waste-ticket-row" style="border-top: var(--border-hairline); padding-top: 8px; font-size: 14px; color: var(--color-ink-secondary);">
            <span>יתרת מלאי לאחר גריעה:</span>
            <strong class="mono" id="wasteRemainingStockVal">${remainingStock.toFixed(2)} ${selectedItem ? selectedItem.stockUnit : ''}</strong>
          </div>
        </div>

        <!-- דיווחים אחרונים -->
        ${recentWaste.length > 0 ? `
          <div class="waste-step-block" style="padding: 12px 14px;">
            <div style="font-size: 13px; font-weight: 700; color: var(--color-ink-secondary); margin-bottom: 8px;">
              דיווחי פחת אחרונים במשמרת
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${recentWaste.map(w => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: var(--border-hairline); font-size: 13px;">
                  <div>
                    <div style="font-weight: 700; color: var(--color-ink-primary);">${w.itemName} · <span class="mono">${w.wasteQty}</span> ${w.stockUnit || ''}</div>
                    <div style="color: var(--color-ink-secondary); font-size: 12px;">${w.wasteReason} · ${w.reporter}</div>
                  </div>
                  <div class="mono" style="font-weight: 700; color: var(--status-critical); font-size: 14px;">
                    ₪${Number(w.totalWasteCost).toFixed(2)}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- כפתור פעולה ראשי יחיד (REQ-10, R11) -->
        <div class="field-sticky-cta-bar">
          <button type="submit" class="btn btn-primary btn-floating" id="btnSubmitWaste">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span id="btnSubmitWasteText">אשר דיווח פחת (₪${estimatedCost.toFixed(2)})</span>
          </button>
        </div>
      </form>
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
    wasteQty = Math.round((wasteQty + 0.5) * 100) / 100;
    if (qtyInput) qtyInput.value = wasteQty;
    updateCostPreview(container, catalog);
  });

  container.querySelector("#wasteMinusBtn")?.addEventListener("click", () => {
    wasteQty = Math.max(0, Math.round((wasteQty - 0.5) * 100) / 100);
    if (qtyInput) qtyInput.value = wasteQty;
    updateCostPreview(container, catalog);
  });

  // Quick-add pills (+0.25, +0.50, +1.00)
  container.querySelectorAll(".waste-quick-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      const addVal = Number(pill.dataset.add) || 0;
      wasteQty = Math.round((wasteQty + addVal) * 100) / 100;
      if (qtyInput) qtyInput.value = wasteQty;
      updateCostPreview(container, catalog);
    });
  });

  // 2x2 Reason chips
  container.querySelectorAll(".waste-reason-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      wasteReason = chip.dataset.reason;
      container.querySelectorAll(".waste-reason-chip").forEach(c => {
        const active = c.dataset.reason === wasteReason;
        c.classList.toggle("active", active);
        c.setAttribute("aria-checked", String(active));
      });
    });
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

        wasteQty = 0.5;
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
  const remaining = Math.max(0, (Number(selectedItem.currentStock) || 0) - (Number(wasteQty) || 0));

  const valEl = container.querySelector("#wasteCostVal");
  if (valEl) {
    valEl.textContent = `₪${cost.toFixed(2)}`;
  }

  const remEl = container.querySelector("#wasteRemainingStockVal");
  if (remEl) {
    remEl.textContent = `${remaining.toFixed(2)} ${selectedItem.stockUnit}`;
  }

  const btnTextEl = container.querySelector("#btnSubmitWasteText");
  if (btnTextEl) {
    btnTextEl.textContent = `אשר דיווח פחת (₪${cost.toFixed(2)})`;
  }
}
