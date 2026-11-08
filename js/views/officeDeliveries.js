/**
 * Office Mode — Goods Receiving & Supplier Deliveries Management (ניהול קבלת סחורה ומשלוחים)
 * Handles receiving supplier deliveries, invoice logging, automatic stock increments, and live unit cost updates.
 */

import { store } from "../store.js";
import { CalculationService } from "../services/calculationService.js";

let activeSubView = "NEW_DELIVERY"; // NEW_DELIVERY | OPEN_ORDERS | HISTORY
let selectedSupplierId = "";
let invoiceNum = "";
let receivedBy = "ישראל";
let deliveryNotes = "";
let lineInputs = {}; // { itemId: { receivedQty, newUnitCost, updateCatalogPrice } }
let historySearch = "";
let historySupplierFilter = "הכל";

export function renderOfficeDeliveries(container) {
  const state = store.getState();
  const suppliers = state.suppliers.filter(s => s.isActive);
  const catalog = state.catalog.filter(c => c.isActive);
  const deliveries = state.logDeliveries || [];
  const orders = state.logOrders || [];
  const openOrders = orders.filter(o => o.status === "ORDERED");

  if (!selectedSupplierId && suppliers.length > 0) {
    selectedSupplierId = suppliers[0].id;
  }

  const currentSupplier = suppliers.find(s => s.id === selectedSupplierId);
  const supplierItems = catalog.filter(c => c.supplierId === selectedSupplierId);

  // Initialize default line inputs for supplier items if not set
  supplierItems.forEach(item => {
    if (!lineInputs[item.id]) {
      lineInputs[item.id] = {
        receivedQty: 0,
        newUnitCost: item.unitCostExclVat,
        updateCatalogPrice: true
      };
    }
  });

  // KPI calculations
  const totalDeliveriesCount = deliveries.length;
  const totalPurchasesValue = deliveries.reduce((sum, d) => sum + (Number(d.totalAmountExclVat) || 0), 0);
  const priceChangesCount = deliveries.reduce((sum, d) => {
    const changedInDelivery = (d.items || []).filter(i => i.priceChanged).length;
    return sum + changedInDelivery;
  }, 0);

  // Current draft total
  let draftTotalExclVat = 0;
  let draftActiveLinesCount = 0;
  supplierItems.forEach(item => {
    const entry = lineInputs[item.id];
    const qty = Number(entry?.receivedQty) || 0;
    const cost = Number(entry?.newUnitCost ?? item.unitCostExclVat) || 0;
    if (qty > 0) {
      draftActiveLinesCount++;
      draftTotalExclVat += qty * cost;
    }
  });

  container.innerHTML = `
    <div class="office-deliveries">
      <!-- כותרת עליונה -->
      <div style="margin-bottom: var(--space-md); display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="font-size: 22px; font-weight: 700;">🚚 ניהול קבלת סחורה ומשלוחים (Goods Receiving)</h1>
          <p style="font-size: 13px; color: var(--color-text-dim);">
            קליטת תעודות משלוח וחשבוניות ספקים, עדכון אוטומטי של המלאי הזמין ועדכון מחירי קנייה בקטלוג (SSOT).
          </p>
        </div>
        <div style="display: flex; gap: var(--space-xs);">
          <button class="filter-pill ${activeSubView === 'NEW_DELIVERY' ? 'active' : ''}" id="btnTabNewDelivery">
            📥 קליטת משלוח חדש
          </button>
          <button class="filter-pill ${activeSubView === 'OPEN_ORDERS' ? 'active' : ''}" id="btnTabOpenOrders">
            📋 יומן הזמנות רכש (פתוחות: ${openOrders.length} / סה"כ: ${orders.length})
          </button>
          <button class="filter-pill ${activeSubView === 'HISTORY' ? 'active' : ''}" id="btnTabDeliveryHistory">
            📜 היסטוריית תעודות משלוח (${totalDeliveriesCount})
          </button>
        </div>
      </div>

      <!-- 4 כרטיסי מדדי רכש -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-md); margin-bottom: var(--space-lg);">
        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-title">הזמנות רכש פתוחות (בדרך)</span>
            <span class="kpi-icon">🚚</span>
          </div>
          <div class="kpi-value" style="color: ${openOrders.length > 0 ? '#1D4ED8' : 'inherit'};">${openOrders.length}</div>
          <div class="kpi-footer">מתוך ${orders.length} הזמנות שתועדו (וואטסאפ/פורטל)</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-title">סך תעודות משלוח שנקלטו</span>
            <span class="kpi-icon">🧾</span>
          </div>
          <div class="kpi-value">${totalDeliveriesCount}</div>
          <div class="kpi-footer">תעודות משלוח מתועדות ביומן הרכש</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-title">סך הוצאות רכש סחורה (ללא מע"מ)</span>
            <span class="kpi-icon">💳</span>
          </div>
          <div class="kpi-value">₪${totalPurchasesValue.toLocaleString("he-IL", { maximumFractionDigits: 0 })}</div>
          <div class="kpi-footer">סה"כ מצטבר של קבלות סחורה</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-title">שינויי מחירי ספק שזוהו</span>
            <span class="kpi-icon">📈</span>
          </div>
          <div class="kpi-value">${priceChangesCount}</div>
          <div class="kpi-footer">עדכוני מחירון אוטומטיים שהוזרמו לפוד-קוסט</div>
        </div>
      </div>

      ${activeSubView === "NEW_DELIVERY"
        ? renderNewDeliverySection(suppliers, currentSupplier, supplierItems, draftTotalExclVat, draftActiveLinesCount, state.config.vatRate, openOrders)
        : (activeSubView === "OPEN_ORDERS"
            ? renderOrdersLogSection(orders, suppliers)
            : renderDeliveryHistorySection(deliveries, suppliers))}
    </div>
  `;

  // Sub-view tabs
  container.querySelector("#btnTabNewDelivery")?.addEventListener("click", () => {
    activeSubView = "NEW_DELIVERY";
    renderOfficeDeliveries(container);
  });

  container.querySelector("#btnTabOpenOrders")?.addEventListener("click", () => {
    activeSubView = "OPEN_ORDERS";
    renderOfficeDeliveries(container);
  });

  container.querySelector("#btnTabDeliveryHistory")?.addEventListener("click", () => {
    activeSubView = "HISTORY";
    renderOfficeDeliveries(container);
  });

  if (activeSubView === "NEW_DELIVERY") {
    bindNewDeliveryEvents(container, supplierItems, openOrders);
  } else if (activeSubView === "OPEN_ORDERS") {
    bindOrdersLogEvents(container, orders, catalog);
  } else {
    bindHistoryEvents(container, deliveries);
  }
}

function renderNewDeliverySection(suppliers, currentSupplier, supplierItems, draftTotalExclVat, draftActiveLinesCount, vatRate = 0.18, openOrders = []) {
  const draftTotalInclVat = draftTotalExclVat * (1 + (Number(vatRate) || 0.18));
  const openOrderForCurrent = openOrders.find(o => o.supplierId === currentSupplier?.id);

  return `
    <div class="card">
      ${openOrderForCurrent ? `
        <div style="background: #EFF6FF; border: 1.5px solid #1D4ED8; border-radius: var(--radius-md); padding: 12px 16px; margin-bottom: var(--space-md); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 700; color: #1E3A8A; font-size: 14px;">
              📦 נמצאה הזמנת רכש פתוחה עבור ${currentSupplier.name} (${(openOrderForCurrent.items || []).length} פריטים שהוזמנו)
            </div>
            <div style="font-size: 12px; color: #1E40AF; margin-top: 2px;">
              ערוץ הזמנה: <strong>${openOrderForCurrent.orderChannel === 'EXTERNAL_PORTAL' ? 'מערכת הזמנות ספק' : 'וואטסאפ'}</strong>
              ${openOrderForCurrent.externalOrderRef ? ` • מס׳ אסמכתא/הזמנה: <strong>${openOrderForCurrent.externalOrderRef}</strong>` : ''}
              • תאריך הזמנה: ${formatTimestamp(openOrderForCurrent.timestamp)}
            </div>
          </div>
          <button type="button" class="btn btn-primary" id="btnLoadOpenOrderToDelivery" style="background: #1D4ED8;">
            📥 טען כמויות מההזמנה הפתוחה
          </button>
        </div>
      ` : ''}
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md); border-bottom: 1px solid var(--color-border-subtle); padding-bottom: var(--space-sm);">
        <div>
          <h3 class="card-title" style="font-size: 16px;">📥 טופס קליטת תעודת משלוח מספק</h3>
          <p class="card-subtitle">בחר ספק, הזן את הכמויות שהתקבלו בפועל ובדוק אם מחיר היחידה בחשבונית השתנה</p>
        </div>
        <div style="display: flex; gap: var(--space-xs);">
          <button type="button" class="btn btn-secondary" id="btnAutoFillDeficits" style="font-size: 12px;" title="מלא אוטומטית את הכמויות החסרות להשלמה לתקן סופ״ש">
            ⚡ מלא אוטומטית לפי חוסרים לתקן
          </button>
          <button type="button" class="btn btn-secondary" id="btnClearDeliveryDraft" style="font-size: 12px;">
            🧹 נקה כמויות
          </button>
        </div>
      </div>

      <!-- פרטי תעודת משלוח -->
      <div style="display: grid; grid-template-columns: 1.5fr 1fr 1fr 1.5fr; gap: var(--space-md); margin-bottom: var(--space-lg); background: #f8f9fa; padding: var(--space-md); border-radius: var(--radius-md); border: 1px solid var(--color-border-subtle);">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">ספק מוסר</label>
          <select class="form-select" id="deliverySupplierSelect">
            ${suppliers.map(s => `<option value="${s.id}" ${s.id === (currentSupplier?.id || '') ? 'selected' : ''}>${s.name} (${s.category})</option>`).join('')}
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">מספר תעודת משלוח / חשבונית</label>
          <input type="text" class="form-input" id="deliveryInvoiceInput" placeholder="למשל: INV-4029" value="${invoiceNum}" />
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">נקלט על ידי</label>
          <input type="text" class="form-input" id="deliveryReceiverInput" placeholder="שם הקולט" value="${receivedBy}" />
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">הערות משלוח / בקרת טמפרטורה</label>
          <input type="text" class="form-input" id="deliveryNotesInput" placeholder="למשל: תקין 4°C, חסר ארגז אחד..." value="${deliveryNotes}" />
        </div>
      </div>

      <!-- טבלת פריטי הספק לקליטה -->
      <div class="table-responsive" style="margin-bottom: var(--space-lg);">
        <table class="data-table">
          <thead>
            <tr>
              <th>מק"ט</th>
              <th>שם חומר גלם</th>
              <th>מלאי נוכחי</th>
              <th>תקן סופ"ש (Par)</th>
              <th>חוסר מומלץ</th>
              <th style="width: 150px;">כמות שהתקבלה בפועל</th>
              <th>מחיר קטלוג נוכחי</th>
              <th style="width: 150px;">מחיר יחידה בחשבונית ₪</th>
              <th>עדכן מחירון?</th>
              <th>סה"כ שורה (ללא מע"מ)</th>
            </tr>
          </thead>
          <tbody>
            ${supplierItems.length === 0 ? `
              <tr>
                <td colspan="10" style="text-align: center; padding: 24px; color: var(--color-text-dim);">
                  לא נמצאו חומרי גלם המשויכים לספק זה בקטלוג.
                </td>
              </tr>
            ` : supplierItems.map(item => {
              const line = lineInputs[item.id] || { receivedQty: 0, newUnitCost: item.unitCostExclVat, updateCatalogPrice: true };
              const recommended = CalculationService.calculateOrderQty(item.currentStock, item.parLevelWeekend, item.reorderPoint);
              const qty = Number(line.receivedQty) || 0;
              const cost = Number(line.newUnitCost) || 0;
              const lineTotal = qty * cost;
              const priceDiff = cost - Number(item.unitCostExclVat);
              const hasPriceChange = Math.abs(priceDiff) >= 0.01;

              return `
                <tr style="${qty > 0 ? 'background: #f0fdf4;' : ''}">
                  <td class="mono" style="font-size: 11px; color: var(--color-text-dim);">${item.id}</td>
                  <td>
                    <strong>${item.name}</strong>
                    <div style="font-size: 11px; color: var(--color-text-dim);">יחידת מידה: ${item.stockUnit}</div>
                  </td>
                  <td>
                    <span class="badge ${item.currentStock <= item.reorderPoint ? 'badge-danger' : 'badge-gray'}">
                      ${item.currentStock} ${item.stockUnit}
                    </span>
                  </td>
                  <td>${item.parLevelWeekend} ${item.stockUnit}</td>
                  <td>
                    ${recommended > 0 ? `<strong style="color: var(--color-accent-primary);">${recommended.toFixed(1).replace(/\.0$/, '')} ${item.stockUnit}</strong>` : '<span style="color: var(--color-text-dim);">—</span>'}
                  </td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      class="form-input delivery-qty-input"
                      data-id="${item.id}"
                      value="${qty}"
                      style="font-weight: 700; text-align: center; border-color: ${qty > 0 ? '#10b981' : 'var(--color-border-interactive)'};"
                    />
                  </td>
                  <td class="mono">₪${Number(item.unitCostExclVat).toFixed(2)}</td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      class="form-input delivery-cost-input"
                      data-id="${item.id}"
                      value="${cost}"
                      style="text-align: center; ${hasPriceChange ? 'border-color: #f59e0b; background: #fffbeb; font-weight: 700;' : ''}"
                    />
                    ${hasPriceChange ? `
                      <div style="font-size: 10px; color: ${priceDiff > 0 ? 'var(--color-danger)' : 'var(--status-success)'}; margin-top: 2px;">
                        ${priceDiff > 0 ? `▲ התייקרות ₪${priceDiff.toFixed(2)}` : `▼ הוזלה ₪${Math.abs(priceDiff).toFixed(2)}`}
                      </div>
                    ` : ''}
                  </td>
                  <td style="text-align: center;">
                    <input
                      type="checkbox"
                      class="delivery-update-price-cb"
                      data-id="${item.id}"
                      ${line.updateCatalogPrice !== false ? 'checked' : ''}
                      style="width: 18px; height: 18px; cursor: pointer;"
                      title="עדכן את מחיר הפריט בקטלוג ובכל המתכונים"
                    />
                  </td>
                  <td class="mono delivery-line-total" data-id="${item.id}" style="font-weight: 700;">
                    ₪${lineTotal.toFixed(2)}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- סיכום תחתון ואישור קליטה -->
      <div style="display: flex; justify-content: space-between; align-items: center; background: #1e1e1e; color: #fff; padding: var(--space-md) var(--space-lg); border-radius: var(--radius-md);">
        <div style="display: flex; gap: var(--space-xl); align-items: center;">
          <div>
            <div style="font-size: 11px; color: #9ca3af;">פריטים בקליטה זו</div>
            <div style="font-size: 20px; font-weight: 700;" id="draftLinesCountEl">${draftActiveLinesCount} פריטים</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #9ca3af;">סה"כ תעודה (ללא מע"מ)</div>
            <div style="font-size: 22px; font-weight: 700; color: #10b981;" id="draftTotalExclEl">₪${draftTotalExclVat.toFixed(2)}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #9ca3af;">סה"כ כולל מע"מ</div>
            <div style="font-size: 18px; font-weight: 600; color: #e5e7eb;" id="draftTotalInclEl">₪${draftTotalInclVat.toFixed(2)}</div>
          </div>
        </div>

        <button type="button" class="btn btn-primary" id="btnSubmitDelivery" style="min-height: 46px; padding: 0 24px; font-size: 15px;">
          ✅ אשר קליטת סחורה ועדכן מלאי
        </button>
      </div>
    </div>
  `;
}

function renderDeliveryHistorySection(deliveries, suppliers) {
  const filtered = deliveries.filter(d => {
    const matchSup = historySupplierFilter === "הכל" || d.supplierId === historySupplierFilter;
    const matchSearch = !historySearch ||
      (d.invoiceNumber && d.invoiceNumber.toLowerCase().includes(historySearch.toLowerCase())) ||
      (d.supplierName && d.supplierName.includes(historySearch)) ||
      (d.receivedBy && d.receivedBy.includes(historySearch)) ||
      (d.notes && d.notes.includes(historySearch));
    return matchSup && matchSearch;
  });

  return `
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);">
        <h3 class="card-title" style="font-size: 16px; margin-bottom: 0;">📜 יומן קבלות סחורה וחשבוניות ספקים</h3>
        <div style="display: flex; gap: var(--space-sm);">
          <input
            type="text"
            class="form-input"
            id="historySearchInput"
            placeholder="חפש לפי מס' תעודה, ספק או קולט..."
            value="${historySearch}"
            style="width: 260px;"
          />
          <select class="form-select" id="historySupplierSelect" style="width: 200px;">
            <option value="הכל">כל הספקים</option>
            ${suppliers.map(s => `<option value="${s.id}" ${historySupplierFilter === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
          </select>
        </div>
      </div>

      ${filtered.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">🧾</div>
          <div class="empty-state-title">לא נמצאו תעודות משלוח</div>
          <div class="empty-state-desc">טרם נקלטו משלוחים התואמים לחיפוש זה</div>
        </div>
      ` : `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>מזהה</th>
                <th>תאריך ושעה</th>
                <th>ספק</th>
                <th>מס' תעודה / חשבונית</th>
                <th>נקלט ע"י</th>
                <th>פירוט פריטים שנקלטו</th>
                <th>סכום (ללא מע"מ)</th>
                <th>הערות</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(dlv => {
                const dateFormatted = formatTimestamp(dlv.timestamp);
                const itemsSummary = (dlv.items || []).map(i =>
                  `<span class="badge ${i.priceChanged ? 'badge-warning' : 'badge-gray'}" style="margin-left: 4px; margin-bottom: 3px;">
                    ${i.itemName}: +${i.receivedQty} ${i.unit || ''} (₪${Number(i.newUnitCost).toFixed(1)})
                  </span>`
                ).join('');

                return `
                  <tr>
                    <td class="mono" style="font-size: 11px; color: var(--color-text-dim);">${dlv.id}</td>
                    <td style="font-size: 12px;">${dateFormatted}</td>
                    <td><strong>${dlv.supplierName}</strong></td>
                    <td class="mono">${dlv.invoiceNumber || '—'}</td>
                    <td>${dlv.receivedBy || '—'}</td>
                    <td style="max-width: 340px;">${itemsSummary}</td>
                    <td class="mono" style="font-weight: 700;">₪${Number(dlv.totalAmountExclVat).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style="font-size: 12px; color: var(--color-text-dim);">${dlv.notes || '—'}</td>
                    <td>
                      <button class="btn btn-danger btn-delete-delivery" data-id="${dlv.id}" style="min-height: 28px; padding: 2px 8px; font-size: 11px;" title="בטל תעודה וגרע חזרה מהמלאי">
                        🗑️ בטל
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

function bindNewDeliveryEvents(container, supplierItems, openOrders = []) {
  const supplierSelect = container.querySelector("#deliverySupplierSelect");
  if (supplierSelect) {
    supplierSelect.addEventListener("change", (e) => {
      selectedSupplierId = e.target.value;
      renderOfficeDeliveries(container);
    });
  }

  container.querySelector("#btnLoadOpenOrderToDelivery")?.addEventListener("click", () => {
    const openOrd = openOrders.find(o => o.supplierId === selectedSupplierId);
    if (!openOrd) return;
    supplierItems.forEach(item => {
      const ordLine = (openOrd.items || []).find(l => l.itemId === item.id);
      lineInputs[item.id] = {
        receivedQty: ordLine ? Number(ordLine.orderedQty) || 0 : 0,
        newUnitCost: Number(ordLine?.unitCostSnapshot ?? item.unitCostExclVat) || 0,
        updateCatalogPrice: true
      };
    });
    if (openOrd.externalOrderRef && !invoiceNum) {
      invoiceNum = openOrd.externalOrderRef;
    }
    renderOfficeDeliveries(container);
  });

  container.querySelector("#deliveryInvoiceInput")?.addEventListener("input", (e) => {
    invoiceNum = e.target.value;
  });

  container.querySelector("#deliveryReceiverInput")?.addEventListener("input", (e) => {
    receivedBy = e.target.value;
  });

  container.querySelector("#deliveryNotesInput")?.addEventListener("input", (e) => {
    deliveryNotes = e.target.value;
  });

  // Auto-fill deficits button
  container.querySelector("#btnAutoFillDeficits")?.addEventListener("click", () => {
    supplierItems.forEach(item => {
      const rec = CalculationService.calculateOrderQty(item.currentStock, item.parLevelWeekend, item.reorderPoint);
      lineInputs[item.id] = {
        ...(lineInputs[item.id] || {}),
        receivedQty: rec > 0 ? Number(rec.toFixed(2)) : 0,
        newUnitCost: lineInputs[item.id]?.newUnitCost ?? item.unitCostExclVat,
        updateCatalogPrice: true
      };
    });
    renderOfficeDeliveries(container);
  });

  // Clear draft button
  container.querySelector("#btnClearDeliveryDraft")?.addEventListener("click", () => {
    supplierItems.forEach(item => {
      lineInputs[item.id] = {
        receivedQty: 0,
        newUnitCost: item.unitCostExclVat,
        updateCatalogPrice: true
      };
    });
    invoiceNum = "";
    deliveryNotes = "";
    renderOfficeDeliveries(container);
  });

  // Quantity & Cost inputs
  container.querySelectorAll(".delivery-qty-input").forEach(input => {
    input.addEventListener("input", () => {
      const id = input.dataset.id;
      if (!lineInputs[id]) lineInputs[id] = {};
      lineInputs[id].receivedQty = Math.max(0, Number(input.value) || 0);
      updateDraftTotalsUI(container, supplierItems);
    });
  });

  container.querySelectorAll(".delivery-cost-input").forEach(input => {
    input.addEventListener("input", () => {
      const id = input.dataset.id;
      if (!lineInputs[id]) lineInputs[id] = {};
      lineInputs[id].newUnitCost = Math.max(0, Number(input.value) || 0);
      updateDraftTotalsUI(container, supplierItems);
    });
  });

  container.querySelectorAll(".delivery-update-price-cb").forEach(cb => {
    cb.addEventListener("change", () => {
      const id = cb.dataset.id;
      if (!lineInputs[id]) lineInputs[id] = {};
      lineInputs[id].updateCatalogPrice = cb.checked;
    });
  });

  // Submit delivery
  container.querySelector("#btnSubmitDelivery")?.addEventListener("click", () => {
    const itemsPayload = supplierItems
      .map(item => ({
        itemId: item.id,
        receivedQty: Number(lineInputs[item.id]?.receivedQty) || 0,
        newUnitCost: Number(lineInputs[item.id]?.newUnitCost ?? item.unitCostExclVat),
        updateCatalogPrice: lineInputs[item.id]?.updateCatalogPrice !== false
      }))
      .filter(i => i.receivedQty > 0);

    if (itemsPayload.length === 0) {
      alert("נא להזין כמות שהתקבלה (גדולה מ-0) עבור לפחות פריט אחד מהרשימה.");
      return;
    }

    try {
      const entry = store.recordDelivery({
        supplierId: selectedSupplierId,
        invoiceNumber: invoiceNum.trim() || `INV-${Date.now().toString().slice(-4)}`,
        receivedBy: receivedBy.trim() || "ישראל",
        notes: deliveryNotes.trim(),
        items: itemsPayload
      });

      // Reset inputs for this supplier
      supplierItems.forEach(item => {
        const updatedItem = store.getState().catalog.find(c => c.id === item.id);
        lineInputs[item.id] = {
          receivedQty: 0,
          newUnitCost: updatedItem ? updatedItem.unitCostExclVat : item.unitCostExclVat,
          updateCatalogPrice: true
        };
      });
      invoiceNum = "";
      deliveryNotes = "";

      alert(`✅ המשלוח נקלט בהצלחה! (${entry.items.length} פריטים נוספו למלאי בסך ₪${entry.totalAmountExclVat.toFixed(2)})`);
      renderOfficeDeliveries(container);
    } catch (err) {
      alert("שגיאה בקליטת משלוח: " + err.message);
    }
  });
}

function updateDraftTotalsUI(container, supplierItems) {
  const vatRate = store.getState().config.vatRate || 0.18;
  let totalExcl = 0;
  let activeCount = 0;

  supplierItems.forEach(item => {
    const line = lineInputs[item.id];
    const qty = Number(line?.receivedQty) || 0;
    const cost = Number(line?.newUnitCost ?? item.unitCostExclVat) || 0;
    const rowTotal = qty * cost;

    if (qty > 0) {
      activeCount++;
      totalExcl += rowTotal;
    }

    const cell = container.querySelector(`.delivery-line-total[data-id="${item.id}"]`);
    if (cell) {
      cell.textContent = `₪${rowTotal.toFixed(2)}`;
    }
  });

  const totalIncl = totalExcl * (1 + vatRate);
  const countEl = container.querySelector("#draftLinesCountEl");
  const exclEl = container.querySelector("#draftTotalExclEl");
  const inclEl = container.querySelector("#draftTotalInclEl");

  if (countEl) countEl.textContent = `${activeCount} פריטים`;
  if (exclEl) exclEl.textContent = `₪${totalExcl.toFixed(2)}`;
  if (inclEl) inclEl.textContent = `₪${totalIncl.toFixed(2)}`;
}

function bindHistoryEvents(container, deliveries) {
  container.querySelector("#historySearchInput")?.addEventListener("input", (e) => {
    historySearch = e.target.value;
    renderOfficeDeliveries(container);
  });

  container.querySelector("#historySupplierSelect")?.addEventListener("change", (e) => {
    historySupplierFilter = e.target.value;
    renderOfficeDeliveries(container);
  });

  container.querySelectorAll(".btn-delete-delivery").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const dlv = deliveries.find(d => d.id === id);
      if (!dlv) return;

      if (confirm(`האם לבטל את תעודת המשלוח "${dlv.invoiceNumber || dlv.id}" מאת ${dlv.supplierName} ולגרוע חזרה את הכמויות מהמלאי?`)) {
        store.deleteDeliveryLog(id, true);
        renderOfficeDeliveries(container);
      }
    });
  });
}

function renderOrdersLogSection(orders, suppliers) {
  return `
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);">
        <div>
          <h3 class="card-title" style="font-size: 16px; margin-bottom: 2px;">📋 יומן הזמנות רכש שיצאו לספקים (וואטסאפ + פורטלים חיצוניים)</h3>
          <p class="card-subtitle">מעקב מלא אחר הזמנות שממתינות לאספקה והזמנות שכבר נקלטו במלאי</p>
        </div>
      </div>

      ${orders.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">טרם תועדו הזמנות רכש</div>
          <div class="empty-state-desc">הזמנות שתשלח בוואטסאפ או תתעד ממערכת ספק חיצונית יופיעו כאן אוטומטית</div>
        </div>
      ` : `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>מזהה הזמנה</th>
                <th>תאריך ושעה</th>
                <th>ספק</th>
                <th>ערוץ הזמנה</th>
                <th>אסמכתא / הזמנת ספק</th>
                <th>פירוט פריטים שהוזמנו</th>
                <th>סכום משוער (ללא מע"מ)</th>
                <th>סטטוס</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              ${orders.map(ord => {
                const isReceived = ord.status === "RECEIVED";
                const channelLabel = ord.orderChannel === "EXTERNAL_PORTAL"
                  ? "🌐 מערכת ספק"
                  : (ord.orderChannel === "PHONE" ? "📞 טלפון/סוכן" : "💬 וואטסאפ");
                const itemsBadges = (ord.items || []).map(i =>
                  `<span class="badge badge-gray" style="margin-left: 4px; margin-bottom: 3px;">
                    ${i.itemName}: ${i.orderedQty} ${i.unit || ''}
                  </span>`
                ).join('');

                return `
                  <tr>
                    <td class="mono" style="font-size: 11px; color: var(--color-text-dim);">${ord.id}</td>
                    <td style="font-size: 12px;">${formatTimestamp(ord.timestamp)}</td>
                    <td><strong>${ord.supplierName}</strong></td>
                    <td><span class="badge ${ord.orderChannel === 'EXTERNAL_PORTAL' ? 'badge-warning' : 'badge-gray'}">${channelLabel}</span></td>
                    <td class="mono">${ord.externalOrderRef || '—'}</td>
                    <td style="max-width: 340px;">${itemsBadges}</td>
                    <td class="mono" style="font-weight: 700;">₪${Number(ord.estimatedTotalExclVat || 0).toFixed(2)}</td>
                    <td>
                      <span class="badge ${isReceived ? 'badge-success' : 'badge-warning'}">
                        ${isReceived ? `✅ נקלט במלאי (${ord.invoiceNumber || ''})` : '🚚 הוזמן - ממתין לאספקה'}
                      </span>
                    </td>
                    <td>
                      <div style="display: flex; gap: 4px;">
                        ${!isReceived ? `
                          <button class="btn btn-primary btn-convert-order-to-dlv" data-id="${ord.id}" style="min-height: 28px; padding: 2px 8px; font-size: 11px;">
                            📥 קלוט סחורה
                          </button>
                        ` : ''}
                        <button class="btn btn-danger btn-delete-order-log" data-id="${ord.id}" style="min-height: 28px; padding: 2px 8px; font-size: 11px;">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

function bindOrdersLogEvents(container, orders, catalog) {
  container.querySelectorAll(".btn-convert-order-to-dlv").forEach(btn => {
    btn.addEventListener("click", () => {
      const ordId = btn.dataset.id;
      const ord = orders.find(o => o.id === ordId);
      if (!ord) return;

      selectedSupplierId = ord.supplierId;
      const supItems = catalog.filter(c => c.supplierId === selectedSupplierId);
      supItems.forEach(item => {
        const ordLine = (ord.items || []).find(l => l.itemId === item.id);
        lineInputs[item.id] = {
          receivedQty: ordLine ? Number(ordLine.orderedQty) || 0 : 0,
          newUnitCost: Number(ordLine?.unitCostSnapshot ?? item.unitCostExclVat) || 0,
          updateCatalogPrice: true
        };
      });
      if (ord.externalOrderRef) invoiceNum = ord.externalOrderRef;
      activeSubView = "NEW_DELIVERY";
      renderOfficeDeliveries(container);
    });
  });

  container.querySelectorAll(".btn-delete-order-log").forEach(btn => {
    btn.addEventListener("click", () => {
      const ordId = btn.dataset.id;
      if (confirm("האם למחוק הזמנת רכש זו מהיומן?")) {
        store.deleteOrderLog(ordId);
        renderOfficeDeliveries(container);
      }
    });
  });
}

function formatTimestamp(ts) {
  if (!ts) return "—";
  if (ts.includes("T")) {
    try {
      const d = new Date(ts);
      return d.toLocaleString("he-IL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return ts;
    }
  }
  return ts;
}

