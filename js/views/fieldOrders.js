/**
 * Field Mode — Smart Multi-Channel Purchase Orders & Goods Receiving View
 * Aesthetic: Swiss Kitchen Editorial (REQ-09, R11, R20, R21, R46)
 * Supports both Direct WhatsApp Orders and External Supplier Portal Orders (B2B systems) with full Order Logging (logOrders) + Goods Receiving.
 */

import { store } from "../store.js";
import { OrderDispatcher } from "../services/orderDispatcher.js";
import { renderFieldReceiving } from "./fieldReceiving.js";

let activeOrdersMode = "DISPATCH"; // "DISPATCH" (שיגור ותיעוד הזמנה) | "RECEIVE" (קליטת הזמנה / סחורה)
let selectedSupplierId = "";
let manualOverrides = {}; // { itemId: quantity }
let portalCheckedItems = {}; // { itemId: boolean } — צ'קליסט עזר להזנה בפורטל ספק חיצוני
let supplierRefInputs = {}; // { supplierId: externalOrderRef }

export function renderFieldOrders(container) {
  const state = store.getState();
  const supplierOrders = OrderDispatcher.getSupplierOrders(
    state.catalog,
    state.suppliers,
    manualOverrides
  );

  // סנן רק ספקים עם פריטים להזמנה
  const activeOrders = supplierOrders.filter(so => so.totalItemsCount > 0);
  const totalDeficitItems = activeOrders.reduce((acc, grp) => acc + grp.totalItemsCount, 0);
  const openOrders = (state.logOrders || []).filter(o => o.status === "ORDERED");
  const deliveriesCount = (state.logDeliveries || []).length;

  if (activeOrders.length > 0) {
    const exists = activeOrders.some(g => g.supplier.id === selectedSupplierId);
    if (!exists) {
      selectedSupplierId = activeOrders[0].supplier.id;
    }
  } else {
    selectedSupplierId = "";
  }

  const activeGroup = activeOrders.find(g => g.supplier.id === selectedSupplierId) || activeOrders[0];

  container.innerHTML = `
    <div class="field-view">
      <!-- סרגל עליון דביק עם מתג דו-מצבי (הזמנות רכש מול קליטת סחורה) וטאבים של ספקים -->
      <div class="field-control-strip">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
          <button
            type="button"
            id="btnModeOrderDispatch"
            class="filter-pill ${activeOrdersMode === 'DISPATCH' ? 'active' : ''}"
            style="width: 100%;"
          >
            <span>הזמנות רכש (${activeOrders.length})</span>
            ${openOrders.length > 0 ? `<span class="mono">· בדרך: ${openOrders.length}</span>` : ''}
          </button>
          <button
            type="button"
            id="btnModeOrderReceive"
            class="filter-pill ${activeOrdersMode === 'RECEIVE' ? 'active' : ''}"
            style="width: 100%;"
          >
            <span>קליטת סחורה</span>
            <span class="mono">${openOrders.length > 0 ? `(${openOrders.length})` : (deliveriesCount > 0 ? `(${deliveriesCount})` : '')}</span>
          </button>
        </div>

        ${activeOrdersMode === "DISPATCH" ? `
          <div class="field-section-header" style="margin-bottom: ${activeOrders.length > 0 ? '8px' : '0'};">
            <div>
              <h1 class="field-section-title">הזמנות רכש חכמות לספקים</h1>
              <div style="font-size: 13px; color: var(--color-ink-secondary); margin-top: 2px;">
                השלמה לתקן סופ"ש · וואטסאפ או פורטל ספק
              </div>
            </div>
            ${totalDeficitItems > 0 ? `
              <span class="badge badge-danger">
                <span class="badge-dot"></span>
                <span>${totalDeficitItems} בחוסר</span>
              </span>
            ` : `
              <span class="badge badge-success">
                <span class="badge-dot"></span>
                <span>תקין</span>
              </span>
            `}
          </div>

          ${activeOrders.length > 0 ? `
            <div class="filter-bar" role="tablist" aria-label="בחירת ספק להזמנה">
              ${activeOrders.map(grp => {
                const sup = grp.supplier;
                const isSelected = activeGroup && activeGroup.supplier.id === sup.id;
                return `
                  <button
                    type="button"
                    class="filter-pill supplier-tab-btn ${isSelected ? 'active' : ''}"
                    data-sup="${sup.id}"
                    role="tab"
                    aria-selected="${isSelected}"
                  >
                    <span>${sup.name}</span>
                    <span class="mono">(${grp.totalItemsCount})</span>
                  </button>
                `;
              }).join('')}
            </div>
          ` : ''}
        ` : ''}
      </div>

      <div id="fieldOrdersSubContainer"></div>
    </div>
  `;

  const subContainer = container.querySelector("#fieldOrdersSubContainer");

  container.querySelector("#btnModeOrderDispatch")?.addEventListener("click", () => {
    activeOrdersMode = "DISPATCH";
    renderFieldOrders(container);
  });

  container.querySelector("#btnModeOrderReceive")?.addEventListener("click", () => {
    activeOrdersMode = "RECEIVE";
    renderFieldOrders(container);
  });

  // Supplier Tab switching
  container.querySelectorAll(".supplier-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedSupplierId = btn.dataset.sup;
      renderFieldOrders(container);
    });
  });

  if (activeOrdersMode === "RECEIVE") {
    renderFieldReceiving(subContainer);
    return;
  }

  // מצב DISPATCH: הזמנות רכש חכמות (וואטסאפ + מערכות ספקים חיצוניות)
  const sup = activeGroup?.supplier;
  const isExternalPortal = sup?.orderChannel === "EXTERNAL_PORTAL";
  const isPhone = sup?.orderChannel === "PHONE";
  const openOrderForSup = sup ? openOrders.find(o => o.supplierId === sup.id) : null;
  const refVal = sup ? (supplierRefInputs[sup.id] || "") : "";
  const estimatedSupplierCost = activeGroup
    ? activeGroup.items.reduce((sum, itm) => sum + ((Number(itm.orderQty) || 0) * (Number(itm.unitCostExclVat) || 0)), 0)
    : 0;

  subContainer.innerHTML = `
    <!-- בלוק הזמנות פתוחות שכבר הוזמנו וממתינות לאספקה -->
    ${openOrders.length > 0 ? `
      <div style="background: var(--color-accent-cobalt-tint); border-bottom: var(--border-structural); padding: 12px 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="font-size: 14px; font-weight: 700; color: var(--color-ink-primary);">
            הזמנות פתוחות שממתינות לאספקה (${openOrders.length})
          </div>
          <span style="font-size: 12px; color: var(--color-accent-cobalt); font-weight: 700;">לחץ "קלוט משלוח" בהגעת הספק</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${openOrders.map(ord => {
            const channelBadge = ord.orderChannel === "EXTERNAL_PORTAL"
              ? "פורטל ספק"
              : (ord.orderChannel === "PHONE" ? "טלפוני" : "וואטסאפ");
            const timeFormatted = formatShortTime(ord.timestamp);
            return `
              <div style="background: var(--color-bg-surface); border: var(--border-structural); border-radius: var(--radius-ticket); padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                <div>
                  <div style="font-weight: 700; font-size: 15px; color: var(--color-ink-primary); display: flex; align-items: center; gap: 6px;">
                    <span>${ord.supplierName}</span>
                    <span class="badge-unit">${channelBadge}</span>
                  </div>
                  <div style="font-size: 13px; color: var(--color-ink-secondary); margin-top: 2px;">
                    ${(ord.items || []).length} פריטים · אומדן: <strong class="mono">₪${Number(ord.estimatedTotalExclVat || 0).toFixed(0)}</strong> · ${timeFormatted}
                    ${ord.externalOrderRef ? ` · אסמכתא: <strong class="mono">${ord.externalOrderRef}</strong>` : ''}
                  </div>
                </div>
                <div style="display: flex; gap: 6px;">
                  <button
                    type="button"
                    class="btn btn-secondary btn-receive-open-order"
                    data-sup="${ord.supplierId}"
                    data-order="${ord.id}"
                    style="min-height: 44px; padding: 6px 12px; font-size: 13px;"
                  >
                    קלוט משלוח
                  </button>
                  <button
                    type="button"
                    class="btn btn-secondary btn-cancel-open-order"
                    data-order="${ord.id}"
                    style="min-height: 44px; width: 44px; padding: 0;"
                    aria-label="בטל תיעוד הזמנה פתוחה"
                  >
                    ✕
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : ''}

    ${activeOrders.length === 0 ? `
      <div class="empty-state">
        <div class="empty-state-icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div class="empty-state-title">כל המלאי מעל נקודת ההזמנה</div>
        <div class="empty-state-desc">אין כרגע פריטים שירדו מתחת לנקודת ההזמנה המינימלית.</div>
        <button
          type="button"
          class="btn btn-primary"
          id="btnJumpToReceiveFromEmpty"
          style="margin-top: 12px; min-height: 48px;"
        >
          עבור לקליטת הזמנה חדשה מספק
        </button>
      </div>
    ` : `
      <!-- טבלת הזמנה שטוחה לספק הפעיל ללא קינון כרטיסים (SupplierOrderLedger - REQ-09, R46) -->
      <div class="supplier-ledger-block" data-sup="${sup.id}">
        <div class="supplier-ledger-header">
          <div>
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <h2 style="font-size: 18px; font-weight: 700; color: var(--color-ink-primary);">${sup.name}</h2>
              <span class="badge-unit">
                ${isExternalPortal ? 'פורטל ספק' : (isPhone ? 'הזמנה טלפונית' : 'וואטסאפ')}
              </span>
              ${openOrderForSup ? `<span class="badge badge-cobalt">הוזמן וממתין לקליטה</span>` : ''}
            </div>
            <div style="font-size: 13px; color: var(--color-ink-secondary); margin-top: 2px;">
              איש קשר: ${sup.contactName || 'מוקד הזמנות'} · קטגוריה: ${sup.category}
            </div>
          </div>

          <div style="display: flex; gap: 6px;">
            <button
              type="button"
              class="btn btn-secondary btn-copy-order-text"
              data-sup="${sup.id}"
              style="min-height: 44px; padding: 6px 10px; font-size: 12px;"
              title="העתק את רשימת ההזמנה ללוח"
            >
              העתק רשימה
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-receive-this-sup"
              data-sup="${sup.id}"
              style="min-height: 44px; padding: 6px 10px; font-size: 12px;"
            >
              קלוט משלוח
            </button>
          </div>
        </div>

        ${isExternalPortal ? `
          <div style="padding: 10px 16px; background: var(--status-warning-bg); border-bottom: var(--border-structural); font-size: 13px; color: var(--color-ink-primary); font-weight: 500;">
            <strong>ספק עם פורטל הזמנות עצמאי:</strong> סמן V ליד כל פריט תוך כדי הקלדה באתר הספק, ובסיום לחץ על הכפתור התחתון לתיעוד ההזמנה.
          </div>
        ` : ''}

        <!-- שורות פריטים להזמנה -->
        <div class="order-items-list">
          ${activeGroup.items.map(item => {
            const isChecked = Boolean(portalCheckedItems[item.id]);
            const isZeroStock = Number(item.currentStock) <= 0;
            return `
              <div class="order-item-row" style="${isChecked ? 'background: var(--status-success-bg);' : ''}">
                <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
                  ${isExternalPortal ? `
                    <input
                      type="checkbox"
                      class="portal-item-check"
                      data-id="${item.id}"
                      ${isChecked ? 'checked' : ''}
                      title="סמן שהוקלד במערכת הספק"
                      style="width: 24px; height: 24px; accent-color: var(--status-success); cursor: pointer; flex-shrink: 0;"
                    />
                  ` : ''}
                  <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                      <span style="font-size: 18px; font-weight: 700; color: var(--color-ink-primary); ${isChecked ? 'text-decoration: line-through;' : ''}">
                        ${item.name}
                      </span>
                      <span class="badge-unit">${item.stockUnit}</span>
                      ${item.supplierSku ? `<span class="badge-unit mono">מק"ט ${item.supplierSku}</span>` : ''}
                      ${isZeroStock ? `
                        <span class="badge badge-danger">
                          <span class="badge-dot"></span>
                          <span>אזל במלאי</span>
                        </span>
                      ` : ''}
                    </div>
                    <div style="font-size: 15px; color: var(--color-ink-secondary); margin-top: 6px; font-weight: 500;">
                      במלאי: <strong class="mono">${item.currentStock}</strong> · תקן סופ"ש: <strong class="mono">${item.parLevelWeekend}</strong> ${item.stockUnit}
                    </div>
                  </div>
                </div>

                <!-- Stepper 48x48px לכמות הזמנה (REQ-09, R20) -->
                <div class="stepper-container">
                  <button type="button" class="stepper-btn order-minus" data-id="${item.id}" aria-label="הפחת כמות הזמנה עבור ${item.name}">−</button>
                  <input
                    type="number"
                    step="any"
                    class="stepper-input order-qty-input"
                    data-id="${item.id}"
                    value="${item.orderQty}"
                    aria-label="כמות להזמנה עבור ${item.name}"
                  />
                  <button type="button" class="stepper-btn order-plus" data-id="${item.id}" aria-label="הוסף כמות הזמנה עבור ${item.name}">+</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- שדה אסמכתא ושורת סיכום תחתונה (REQ-09) -->
        <div style="padding: 12px 16px; background: var(--color-bg-base); border-top: var(--border-structural); display: flex; gap: 8px; align-items: center;">
          <input
            type="text"
            class="form-input order-ref-input"
            data-sup="${sup.id}"
            placeholder="${isExternalPortal ? 'מס׳ הזמנה / אסמכתא מאתר הספק (אופציונלי)...' : 'הערה או אסמכתא להזמנה (אופציונלי)...'}"
            value="${refVal}"
            style="flex: 1; min-height: 44px; font-size: 14px;"
          />
          ${sup.portalUrl ? `
            <a
              href="${sup.portalUrl}"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-secondary"
              style="min-height: 44px; padding: 6px 12px; font-size: 13px; white-space: nowrap;"
            >
              אתר ספק
            </a>
          ` : `
            <button
              type="button"
              class="btn btn-secondary btn-log-external-order"
              data-sup="${sup.id}"
              style="min-height: 44px; padding: 6px 12px; font-size: 13px; white-space: nowrap;"
              title="תעד הזמנה ללא פתיחת וואטסאפ"
            >
              סמן כהוזמן
            </button>
          `}
        </div>

        <div class="order-summary-footer">
          <span>סה"כ פריטים להזמנה: <strong class="mono">${activeGroup.items.length}</strong></span>
          <span>אומדן כספי: <strong class="mono">₪${estimatedSupplierCost.toFixed(2)}</strong></span>
        </div>
      </div>

      <!-- סרגל פעולה ראשי יחיד בתחתית המסך (REQ-09, R11) -->
      <div class="field-sticky-cta-bar">
        ${isExternalPortal ? `
          <button
            type="button"
            class="btn btn-primary btn-floating btn-log-external-order"
            data-sup="${sup.id}"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>תעד הזמנה שבוצעה במערכת ${sup.name}</span>
          </button>
        ` : `
          <button
            type="button"
            class="btn btn-whatsapp btn-floating btn-dispatch-whatsapp-and-log"
            data-sup="${sup.id}"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m22 2-7 20-4-9-9-4Z"/>
              <path d="M22 2 11 13"/>
            </svg>
            <span>שלח הזמנה בוואטסאפ ל-${sup.name}</span>
          </button>
        `}
      </div>
    `}
  `;

  subContainer.querySelector("#btnJumpToReceiveFromEmpty")?.addEventListener("click", () => {
    activeOrdersMode = "RECEIVE";
    renderFieldOrders(container);
  });

  // Checkbox for portal typing helper
  subContainer.querySelectorAll(".portal-item-check").forEach(cb => {
    cb.addEventListener("change", () => {
      const id = cb.dataset.id;
      portalCheckedItems[id] = cb.checked;
      renderFieldOrders(container);
    });
  });

  // External Order Ref input
  subContainer.querySelectorAll(".order-ref-input").forEach(inp => {
    inp.addEventListener("input", () => {
      supplierRefInputs[inp.dataset.sup] = inp.value;
    });
  });

  // Copy order text to clipboard
  subContainer.querySelectorAll(".btn-copy-order-text").forEach(btn => {
    btn.addEventListener("click", async () => {
      const supId = btn.dataset.sup;
      const grp = activeOrders.find(g => g.supplier.id === supId);
      if (!grp) return;
      const text = OrderDispatcher.formatOrderText(grp.supplier, grp.items);
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "הועתק!";
        setTimeout(() => { btn.textContent = "העתק רשימה"; }, 2000);
      } catch (e) {
        alert("נוסח ההזמנה להעתקה:\n\n" + text);
      }
    });
  });

  // Dispatch via WhatsApp AND record in logOrders
  subContainer.querySelectorAll(".btn-dispatch-whatsapp-and-log").forEach(btn => {
    btn.addEventListener("click", () => {
      const supId = btn.dataset.sup;
      const grp = activeOrders.find(g => g.supplier.id === supId);
      if (!grp) return;

      const waLink = OrderDispatcher.generateWhatsAppLink(grp.supplier, grp.items);
      if (waLink) {
        window.open(waLink, "_blank");
      }

      recordGroupOrder(grp, "WHATSAPP", container);
    });
  });

  // Log external portal / manual order without WhatsApp
  subContainer.querySelectorAll(".btn-log-external-order").forEach(btn => {
    btn.addEventListener("click", () => {
      const supId = btn.dataset.sup;
      const grp = activeOrders.find(g => g.supplier.id === supId);
      if (!grp) return;

      const channel = grp.supplier.orderChannel || "EXTERNAL_PORTAL";
      recordGroupOrder(grp, channel, container);
    });
  });

  // Receive from open order card
  subContainer.querySelectorAll(".btn-receive-open-order").forEach(btn => {
    btn.addEventListener("click", () => {
      const supId = btn.dataset.sup;
      const orderId = btn.dataset.order;
      activeOrdersMode = "RECEIVE";
      renderFieldOrders(container);
      const rcvRoot = container.querySelector("#fieldOrdersSubContainer");
      if (rcvRoot) {
        renderFieldReceiving(rcvRoot, { initialSupplierId: supId, preloadOrderId: orderId });
      }
    });
  });

  // Cancel open order
  subContainer.querySelectorAll(".btn-cancel-open-order").forEach(btn => {
    btn.addEventListener("click", () => {
      const orderId = btn.dataset.order;
      if (confirm("האם לבטל את תיעוד ההזמנה הפתוחה הזו?")) {
        store.deleteOrderLog(orderId);
        renderFieldOrders(container);
      }
    });
  });

  // Jump directly to receiving for a specific supplier
  subContainer.querySelectorAll(".btn-receive-this-sup").forEach(btn => {
    btn.addEventListener("click", () => {
      const supId = btn.dataset.sup;
      activeOrdersMode = "RECEIVE";
      renderFieldOrders(container);
      const rcvRoot = container.querySelector("#fieldOrdersSubContainer");
      if (rcvRoot) {
        renderFieldReceiving(rcvRoot, { initialSupplierId: supId });
      }
    });
  });

  // Steppers events
  subContainer.querySelectorAll(".order-plus").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const input = subContainer.querySelector(`.order-qty-input[data-id="${id}"]`);
      let val = Number(input.value) || 0;
      val = Math.round((val + 1) * 100) / 100;
      manualOverrides[id] = val;
      renderFieldOrders(container);
    });
  });

  subContainer.querySelectorAll(".order-minus").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const input = subContainer.querySelector(`.order-qty-input[data-id="${id}"]`);
      let val = Number(input.value) || 0;
      val = Math.max(0, Math.round((val - 1) * 100) / 100);
      manualOverrides[id] = val;
      renderFieldOrders(container);
    });
  });

  subContainer.querySelectorAll(".order-qty-input").forEach(input => {
    input.addEventListener("change", () => {
      const id = input.dataset.id;
      const val = Math.max(0, Number(input.value) || 0);
      manualOverrides[id] = val;
      renderFieldOrders(container);
    });
  });
}

function recordGroupOrder(group, channel, container) {
  const sup = group.supplier;
  const ref = supplierRefInputs[sup.id] || "";
  const itemsPayload = group.items
    .filter(i => (Number(i.orderQty) || 0) > 0)
    .map(i => ({
      itemId: i.id,
      itemName: i.name,
      supplierSku: i.supplierSku || "",
      unit: i.stockUnit,
      orderedQty: Number(i.orderQty),
      unitCostSnapshot: Number(i.unitCostExclVat) || 0
    }));

  if (itemsPayload.length === 0) {
    alert("נא להזין כמות חיובית לפחות לפריט אחד להזמנה.");
    return;
  }

  try {
    if (typeof store.recordPurchaseOrder === "function") {
      store.recordPurchaseOrder({
        supplierId: sup.id,
        orderChannel: channel,
        externalOrderRef: ref,
        orderedBy: "ישראל - שטח",
        items: itemsPayload
      });
    }
    supplierRefInputs[sup.id] = "";
    renderFieldOrders(container);
  } catch (err) {
    alert("שגיאה בתיעוד ההזמנה: " + err.message);
  }
}

function formatShortTime(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (e) {
    return ts;
  }
}
