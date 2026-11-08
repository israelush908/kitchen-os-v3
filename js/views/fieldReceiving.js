/**
 * Field Mode — Fast Goods Receiving & Delivery Intake (קליטת סחורה ומשלוחים בשטח)
 * Designed for mobile one-handed operation at the loading dock, adhering to Swiss Kitchen Editorial
 * standards (high contrast, flat ledger rows, 48x48px touch targets, Space Mono tabular numbers).
 */

import { store } from "../store.js";
import { CalculationService } from "../services/calculationService.js";

let selectedSupplierId = "";
let invoiceNumber = "";
let receivedBy = "ישראל - שטח";
let deliveryNotes = "";
let itemSearch = "";
let showOnlyDeficits = false;
let draftLines = {}; // { itemId: { receivedQty, newUnitCost, updateCatalogPrice } }

export function renderFieldReceiving(container, options = {}) {
  const state = store.getState();
  const suppliers = (state.suppliers || []).filter(s => s.isActive);
  const catalog = (state.catalog || []).filter(c => c.isActive);
  const recentDeliveries = (state.logDeliveries || []).slice(0, 3);

  if (options.initialSupplierId) {
    selectedSupplierId = options.initialSupplierId;
  }

  if (!selectedSupplierId && suppliers.length > 0) {
    selectedSupplierId = suppliers[0].id;
  }

  const currentSupplier = suppliers.find(s => s.id === selectedSupplierId);
  const allSupplierItems = catalog.filter(c => c.supplierId === selectedSupplierId);
  const openOrders = (state.logOrders || []).filter(o => o.status === "ORDERED");
  const openOrderForSupplier = openOrders.find(o => o.supplierId === selectedSupplierId);

  // Initialize draft lines for this supplier
  allSupplierItems.forEach(item => {
    if (!draftLines[item.id]) {
      draftLines[item.id] = {
        receivedQty: 0,
        newUnitCost: Number(item.unitCostExclVat) || 0,
        updateCatalogPrice: true
      };
    }
  });

  // If jumped directly from an open order, preload its quantities automatically
  if (options.preloadOrderId && openOrderForSupplier && openOrderForSupplier.id === options.preloadOrderId) {
    allSupplierItems.forEach(item => {
      const ordLine = (openOrderForSupplier.items || []).find(l => l.itemId === item.id);
      draftLines[item.id] = {
        receivedQty: ordLine ? Number(ordLine.orderedQty) || 0 : 0,
        newUnitCost: Number(ordLine?.unitCostSnapshot ?? item.unitCostExclVat) || 0,
        updateCatalogPrice: true
      };
    });
    if (openOrderForSupplier.externalOrderRef && !invoiceNumber) {
      invoiceNumber = openOrderForSupplier.externalOrderRef;
    }
  }

  // Filter items by search or deficit filter
  const visibleItems = allSupplierItems.filter(item => {
    const matchSearch = !itemSearch || item.name.includes(itemSearch);
    const recOrder = CalculationService.calculateOrderQty(item.currentStock, item.parLevelWeekend, item.reorderPoint);
    const hasDraft = (Number(draftLines[item.id]?.receivedQty) || 0) > 0;
    const matchDeficit = !showOnlyDeficits || recOrder > 0 || hasDraft;
    return matchSearch && matchDeficit;
  });

  // Compute live summary for current supplier
  let activeCount = 0;
  let totalExclVat = 0;
  allSupplierItems.forEach(item => {
    const line = draftLines[item.id];
    const qty = Number(line?.receivedQty) || 0;
    const cost = Number(line?.newUnitCost ?? item.unitCostExclVat) || 0;
    if (qty > 0) {
      activeCount++;
      totalExclVat += qty * cost;
    }
  });

  container.innerHTML = `
    <div class="field-receiving" style="padding-bottom: 90px;">
      <!-- בורר ספקים אופקי (Touch Targets >= 48px) -->
      <div style="margin-bottom: var(--space-sm);">
        <div style="font-size: 12px; font-weight: 700; color: var(--color-text-secondary); margin-bottom: 6px;">
          1. בחר ספק מוסר (${suppliers.length} ספקים פעילים):
        </div>
        <div class="filter-bar" style="padding-bottom: 6px;">
          ${suppliers.map(sup => {
            const supItems = catalog.filter(c => c.supplierId === sup.id);
            const hasOpenOrd = openOrders.some(o => o.supplierId === sup.id);
            const isSelected = sup.id === selectedSupplierId;
            return `
              <button
                type="button"
                class="filter-pill field-rcv-sup-pill ${isSelected ? 'active' : ''}"
                data-sup="${sup.id}"
                style="min-height: 44px; padding: 8px 14px; font-size: 14px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; ${hasOpenOrd && !isSelected ? 'border-color: #1D4ED8; background: #EFF6FF; color: #1E3A8A;' : ''}"
              >
                <span>${sup.name}</span>
                ${hasOpenOrd ? `<span style="font-size: 11px; background: #1D4ED8; color: #FFFFFF; padding: 1px 5px; border-radius: 4px;">בדרך</span>` : `<span class="mono" style="font-size: 12px; opacity: 0.85;">(${supItems.length})</span>`}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      ${openOrderForSupplier ? `
        <!-- באנר הזמנה פתוחה שממתינה לקליטה מספק זה -->
        <div style="background: #EFF6FF; border: 1.5px solid #1D4ED8; border-radius: 6px; padding: 10px 12px; margin-bottom: var(--space-sm); display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
          <div>
            <div style="font-size: 13px; font-weight: 700; color: #1E3A8A;">
              📦 קיימת הזמנה פתוחה מ-${currentSupplier?.name || 'הספק'} (${(openOrderForSupplier.items || []).length} פריטים שהוזמנו)
            </div>
            <div style="font-size: 12px; color: #1E40AF;">
              ${openOrderForSupplier.orderChannel === 'EXTERNAL_PORTAL' ? 'הוזמן במערכת הספק' : 'נשלח בוואטסאפ'}
              ${openOrderForSupplier.externalOrderRef ? ` • אסמכתא: ${openOrderForSupplier.externalOrderRef}` : ''}
            </div>
          </div>
          <button
            type="button"
            class="btn btn-primary"
            id="btnFieldLoadFromOpenOrder"
            style="min-height: 40px; padding: 6px 12px; font-size: 12px; font-weight: 700; background: #1D4ED8; border: 1.5px solid #0F1115;"
          >
            📥 טען כמויות מההזמנה
          </button>
        </div>
      ` : ''}

      <!-- פרטי תעודת משלוח ופעולות מילוי מהיר -->
      <div style="background: var(--color-bg-surface, #FFFFFF); border: 1.5px solid #0F1115; border-radius: 6px; padding: 12px; margin-bottom: var(--space-md);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div>
            <div style="font-size: 16px; font-weight: 700; color: #0F1115;">
              ${currentSupplier ? currentSupplier.name : 'בחר ספק'}
            </div>
            <div style="font-size: 12px; color: var(--color-text-secondary, #4B5563);">
              קטגוריה: ${currentSupplier?.category || 'כללי'} • ${allSupplierItems.length} פריטים משויכים
            </div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button
              type="button"
              class="btn btn-secondary"
              id="btnFieldFillDeficits"
              style="min-height: 40px; padding: 6px 10px; font-size: 12px; font-weight: 700; border: 1.5px solid #0F1115;"
              title="מלא אוטומטית את הכמויות להשלמה לתקן סופ״ש"
            >
              מלא חוסרים לתקן
            </button>
            ${activeCount > 0 ? `
              <button
                type="button"
                class="btn btn-secondary"
                id="btnFieldResetDraft"
                style="min-height: 40px; padding: 6px 10px; font-size: 12px; border: 1.5px solid #0F1115;"
              >
                איפוס
              </button>
            ` : ''}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div>
            <label style="display: block; font-size: 12px; font-weight: 700; margin-bottom: 4px;">מס' תעודה / חשבונית</label>
            <input
              type="text"
              class="form-input mono"
              id="fieldRcvInvoice"
              placeholder="למשל: 40912"
              value="${invoiceNumber}"
              style="min-height: 44px; font-size: 15px; border: 1.5px solid #0F1115;"
            />
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 700; margin-bottom: 4px;">הערה / טמפרטורה</label>
            <input
              type="text"
              class="form-input"
              id="fieldRcvNotes"
              placeholder="תקין 4°C..."
              value="${deliveryNotes}"
              style="min-height: 44px; font-size: 15px; border: 1.5px solid #0F1115;"
            />
          </div>
        </div>
      </div>

      <!-- חיפוש מהיר בתוך פריטי הספק -->
      <div style="display: flex; gap: 8px; margin-bottom: var(--space-sm);">
        <div class="search-bar-container" style="flex: 1; margin-bottom: 0;">
          <input
            type="text"
            class="search-input"
            id="fieldRcvSearch"
            placeholder="חפש פריט של ${currentSupplier?.name || 'הספק'}..."
            value="${itemSearch}"
            style="min-height: 46px; font-size: 16px;"
          />
        </div>
        <button
          type="button"
          class="filter-pill ${showOnlyDeficits ? 'active' : ''}"
          id="btnToggleOnlyDeficits"
          style="min-height: 46px; padding: 0 12px; font-size: 12px; font-weight: 700; white-space: nowrap;"
        >
          רק בחוסר
        </button>
      </div>

      <!-- רשימת פריטי הספק לקליטה בשטח (Flat Ledger Rows — R46, 48x48px Steppers — R20) -->
      <div style="background: #FFFFFF; border: 1.5px solid #0F1115; border-radius: 6px; overflow: hidden;">
        ${visibleItems.length === 0 ? `
          <div style="padding: 28px 16px; text-align: center;">
            <div style="font-size: 16px; font-weight: 700; color: #0F1115; margin-bottom: 4px;">לא נמצאו פריטים להצגה</div>
            <div style="font-size: 13px; color: #4B5563;">נסה לנקות את החיפוש או להציג את כל פריטי הספק</div>
          </div>
        ` : visibleItems.map((item, idx) => {
          const line = draftLines[item.id] || { receivedQty: 0, newUnitCost: item.unitCostExclVat, updateCatalogPrice: true };
          const qty = Number(line.receivedQty) || 0;
          const unitCost = Number(line.newUnitCost ?? item.unitCostExclVat) || 0;
          const recommended = CalculationService.calculateOrderQty(item.currentStock, item.parLevelWeekend, item.reorderPoint);
          const isModified = qty > 0;

          return `
            <div
              class="field-rcv-row"
              data-id="${item.id}"
              style="
                padding: 14px 12px;
                border-bottom: ${idx < visibleItems.length - 1 ? '1.5px solid #0F1115' : 'none'};
                border-right: ${isModified ? '5px solid #1D4ED8' : 'none'};
                background: ${isModified ? '#F0F7FF' : '#FFFFFF'};
              "
            >
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                <!-- מידע פריט -->
                <div style="flex: 1; min-width: 0;">
                  <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <span style="font-size: 17px; font-weight: 700; color: #0F1115;">${item.name}</span>
                    <span style="font-size: 12px; font-weight: 700; padding: 2px 6px; border: 1.5px solid #0F1115; border-radius: 4px; background: #F8F7F4;">
                      ${item.stockUnit}
                    </span>
                  </div>
                  <div style="font-size: 13px; color: #4B5563; margin-top: 4px; display: flex; flex-wrap: wrap; gap: 8px;">
                    <span>במלאי: <strong class="mono" style="direction: ltr; display: inline-block;">${item.currentStock}</strong></span>
                    <span>•</span>
                    <span>תקן: <strong class="mono" style="direction: ltr; display: inline-block;">${item.parLevelWeekend}</strong></span>
                    ${recommended > 0 ? `
                      <span style="color: #B91C1C; font-weight: 700;">
                        • להשלמה: +${Number(recommended.toFixed(1))}
                      </span>
                    ` : ''}
                  </div>
                </div>

                <!-- בקר כמות שהתקבלה (48x48px Touch Targets) -->
                <div class="stepper-container" style="display: flex; align-items: center; gap: 4px;">
                  <button
                    type="button"
                    class="stepper-btn rcv-btn-minus"
                    data-id="${item.id}"
                    aria-label="הפחת כמות"
                    style="width: 48px; height: 48px; font-size: 22px; font-weight: 700; border: 2px solid #0F1115; border-radius: 6px; background: #FFFFFF;"
                  >-</button>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    class="stepper-input rcv-qty-input mono"
                    data-id="${item.id}"
                    value="${qty}"
                    style="width: 64px; height: 48px; font-size: 22px; font-weight: 700; text-align: center; direction: ltr; border: 2px solid #0F1115; border-radius: 6px; background: #FFFFFF;"
                  />
                  <button
                    type="button"
                    class="stepper-btn rcv-btn-plus"
                    data-id="${item.id}"
                    aria-label="הוסף כמות"
                    style="width: 48px; height: 48px; font-size: 22px; font-weight: 700; border: 2px solid #0F1115; border-radius: 6px; background: #FFFFFF;"
                  >+</button>
                </div>
              </div>

              <!-- שורת מחיר יחידה ועדכון מחירון (מוצגת תמיד או מודגשת כשנקלטת כמות) -->
              <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #D6D3C9; display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="color: #4B5563;">מחיר יח' (ללא מע"מ):</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    class="form-input rcv-cost-input mono"
                    data-id="${item.id}"
                    value="${unitCost}"
                    style="width: 84px; height: 36px; padding: 2px 6px; font-size: 15px; font-weight: 700; text-align: center; direction: ltr; border: 1.5px solid #0F1115; border-radius: 4px;"
                  />
                  <span>₪</span>
                </div>
                <div class="mono rcv-row-total" data-id="${item.id}" style="font-size: 14px; font-weight: 700; color: ${qty > 0 ? '#15803D' : '#4B5563'}; direction: ltr;">
                  סה"כ: ₪${(qty * unitCost).toFixed(2)}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- שורת סיכום תעודה וכפתור CTA ראשי יחיד (Chef Vermilion #EA580C — R11) -->
      <div style="margin-top: var(--space-md); background: #F8F7F4; border: 1.5px solid #0F1115; border-radius: 6px; padding: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 14px; font-weight: 700; color: #0F1115;">
            פריטים בקליטה: <span id="fieldRcvActiveCount" class="mono">${activeCount}</span>
          </span>
          <span style="font-size: 16px; font-weight: 700; color: #0F1115;">
            סה"כ משלוח: <span id="fieldRcvTotalVal" class="mono" style="direction: ltr; display: inline-block;">₪${totalExclVat.toFixed(2)}</span>
          </span>
        </div>

        <button
          type="button"
          id="btnFieldConfirmDelivery"
          style="
            width: 100%;
            min-height: 52px;
            background: #EA580C;
            color: #FFFFFF;
            border: 1.5px solid #0F1115;
            border-radius: 6px;
            font-size: 17px;
            font-weight: 700;
            box-shadow: 2px 2px 0px #0F1115;
            cursor: pointer;
          "
        >
          אשר קליטת הזמנה ועדכן מלאי (${activeCount} פריטים)
        </button>
      </div>

      <!-- קבלות סחורה אחרונות שנקלטו -->
      ${recentDeliveries.length > 0 ? `
        <div style="margin-top: var(--space-md);">
          <div style="font-size: 13px; font-weight: 700; color: #4B5563; margin-bottom: 6px;">
            משלוחים אחרונים שנקלטו:
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${recentDeliveries.map(dlv => `
              <div style="background: #FFFFFF; border: 1.5px solid #0F1115; border-radius: 6px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
                <div>
                  <div style="font-weight: 700; color: #0F1115;">${dlv.supplierName} • תעודה: ${dlv.invoiceNumber || '—'}</div>
                  <div style="font-size: 12px; color: #4B5563;">${(dlv.items || []).length} פריטים נוספו למלאי</div>
                </div>
                <div class="mono" style="font-weight: 700; color: #15803D; direction: ltr;">
                  ₪${Number(dlv.totalAmountExclVat || 0).toFixed(2)}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  // ================= EVENT LISTENERS =================

  // Supplier pills
  container.querySelectorAll(".field-rcv-sup-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedSupplierId = btn.dataset.sup;
      renderFieldReceiving(container);
    });
  });

  // Invoice & Notes inputs
  container.querySelector("#fieldRcvInvoice")?.addEventListener("input", (e) => {
    invoiceNumber = e.target.value;
  });

  container.querySelector("#fieldRcvNotes")?.addEventListener("input", (e) => {
    deliveryNotes = e.target.value;
  });

  // Search & Deficit filter
  container.querySelector("#fieldRcvSearch")?.addEventListener("input", (e) => {
    itemSearch = e.target.value.trim();
    renderFieldReceiving(container);
  });

  container.querySelector("#btnToggleOnlyDeficits")?.addEventListener("click", () => {
    showOnlyDeficits = !showOnlyDeficits;
    renderFieldReceiving(container);
  });

  // Auto-fill from open order for current supplier
  container.querySelector("#btnFieldLoadFromOpenOrder")?.addEventListener("click", () => {
    if (!openOrderForSupplier) return;
    allSupplierItems.forEach(item => {
      const ordLine = (openOrderForSupplier.items || []).find(l => l.itemId === item.id);
      draftLines[item.id] = {
        receivedQty: ordLine ? Number(ordLine.orderedQty) || 0 : 0,
        newUnitCost: Number(draftLines[item.id]?.newUnitCost ?? ordLine?.unitCostSnapshot ?? item.unitCostExclVat) || 0,
        updateCatalogPrice: true
      };
    });
    if (openOrderForSupplier.externalOrderRef && !invoiceNumber) {
      invoiceNumber = openOrderForSupplier.externalOrderRef;
    }
    renderFieldReceiving(container);
  });

  // Auto-fill deficits for current supplier
  container.querySelector("#btnFieldFillDeficits")?.addEventListener("click", () => {
    allSupplierItems.forEach(item => {
      const rec = CalculationService.calculateOrderQty(item.currentStock, item.parLevelWeekend, item.reorderPoint);
      draftLines[item.id] = {
        receivedQty: rec > 0 ? Number(rec.toFixed(2)) : 0,
        newUnitCost: Number(draftLines[item.id]?.newUnitCost ?? item.unitCostExclVat) || 0,
        updateCatalogPrice: true
      };
    });
    renderFieldReceiving(container);
  });

  // Reset draft for current supplier
  container.querySelector("#btnFieldResetDraft")?.addEventListener("click", () => {
    allSupplierItems.forEach(item => {
      draftLines[item.id] = {
        receivedQty: 0,
        newUnitCost: Number(item.unitCostExclVat) || 0,
        updateCatalogPrice: true
      };
    });
    invoiceNumber = "";
    deliveryNotes = "";
    renderFieldReceiving(container);
  });

  // Plus / Minus steppers
  container.querySelectorAll(".rcv-btn-plus").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const input = container.querySelector(`.rcv-qty-input[data-id="${id}"]`);
      let val = Number(input?.value) || 0;
      val = Number((val + 1).toFixed(2));
      if (!draftLines[id]) draftLines[id] = { newUnitCost: 0, updateCatalogPrice: true };
      draftLines[id].receivedQty = val;
      if (input) input.value = val;
      updateLiveReceivingTotals(container, allSupplierItems);
    });
  });

  container.querySelectorAll(".rcv-btn-minus").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const input = container.querySelector(`.rcv-qty-input[data-id="${id}"]`);
      let val = Number(input?.value) || 0;
      val = Math.max(0, Number((val - 1).toFixed(2)));
      if (!draftLines[id]) draftLines[id] = { newUnitCost: 0, updateCatalogPrice: true };
      draftLines[id].receivedQty = val;
      if (input) input.value = val;
      updateLiveReceivingTotals(container, allSupplierItems);
    });
  });

  // Manual quantity input
  container.querySelectorAll(".rcv-qty-input").forEach(input => {
    input.addEventListener("input", () => {
      const id = input.dataset.id;
      const val = Math.max(0, Number(input.value) || 0);
      if (!draftLines[id]) draftLines[id] = { newUnitCost: 0, updateCatalogPrice: true };
      draftLines[id].receivedQty = val;
      updateLiveReceivingTotals(container, allSupplierItems);
    });
  });

  // Manual unit cost input
  container.querySelectorAll(".rcv-cost-input").forEach(input => {
    input.addEventListener("input", () => {
      const id = input.dataset.id;
      const val = Math.max(0, Number(input.value) || 0);
      if (!draftLines[id]) draftLines[id] = { receivedQty: 0, updateCatalogPrice: true };
      draftLines[id].newUnitCost = val;
      updateLiveReceivingTotals(container, allSupplierItems);
    });
  });

  // Submit delivery intake
  container.querySelector("#btnFieldConfirmDelivery")?.addEventListener("click", () => {
    const itemsPayload = allSupplierItems
      .map(item => ({
        itemId: item.id,
        receivedQty: Number(draftLines[item.id]?.receivedQty) || 0,
        newUnitCost: Number(draftLines[item.id]?.newUnitCost ?? item.unitCostExclVat) || 0,
        updateCatalogPrice: true
      }))
      .filter(i => i.receivedQty > 0);

    if (itemsPayload.length === 0) {
      alert("נא להזין כמות שהתקבלה (גדולה מ-0) עבור לפחות פריט אחד של הספק.");
      return;
    }

    try {
      const entry = store.recordDelivery({
        supplierId: selectedSupplierId,
        invoiceNumber: invoiceNumber.trim() || `RCV-${Date.now().toString().slice(-4)}`,
        receivedBy: receivedBy.trim() || "ישראל - שטח",
        notes: deliveryNotes.trim(),
        items: itemsPayload
      });

      // Reset draft for this supplier
      allSupplierItems.forEach(item => {
        const updatedItem = store.getState().catalog.find(c => c.id === item.id);
        draftLines[item.id] = {
          receivedQty: 0,
          newUnitCost: updatedItem ? updatedItem.unitCostExclVat : item.unitCostExclVat,
          updateCatalogPrice: true
        };
      });
      invoiceNumber = "";
      deliveryNotes = "";

      alert(`✅ קליטת ההזמנה הושלמה!\n${entry.items.length} פריטים נוספו למלאי (סה"כ ₪${entry.totalAmountExclVat.toFixed(2)}).`);
      renderFieldReceiving(container);
    } catch (err) {
      alert("שגיאה בקליטת ההזמנה: " + err.message);
    }
  });
}

function updateLiveReceivingTotals(container, allSupplierItems) {
  let activeCount = 0;
  let totalExclVat = 0;

  allSupplierItems.forEach(item => {
    const line = draftLines[item.id];
    const qty = Number(line?.receivedQty) || 0;
    const cost = Number(line?.newUnitCost ?? item.unitCostExclVat) || 0;
    const rowSum = qty * cost;

    if (qty > 0) {
      activeCount++;
      totalExclVat += rowSum;
    }

    const rowTotalEl = container.querySelector(`.rcv-row-total[data-id="${item.id}"]`);
    if (rowTotalEl) {
      rowTotalEl.textContent = `סה"כ: ₪${rowSum.toFixed(2)}`;
      rowTotalEl.style.color = qty > 0 ? "#15803D" : "#4B5563";
    }

    const rowEl = container.querySelector(`.field-rcv-row[data-id="${item.id}"]`);
    if (rowEl) {
      rowEl.style.borderRight = qty > 0 ? "5px solid #1D4ED8" : "none";
      rowEl.style.background = qty > 0 ? "#F0F7FF" : "#FFFFFF";
    }
  });

  const countEl = container.querySelector("#fieldRcvActiveCount");
  const totalEl = container.querySelector("#fieldRcvTotalVal");
  const btnEl = container.querySelector("#btnFieldConfirmDelivery");

  if (countEl) countEl.textContent = String(activeCount);
  if (totalEl) totalEl.textContent = `₪${totalExclVat.toFixed(2)}`;
  if (btnEl) btnEl.textContent = `אשר קליטת הזמנה ועדכן מלאי (${activeCount} פריטים)`;
}

