/**
 * Field Mode — Smart Multi-Channel Purchase Orders & Goods Receiving View
 * Supports both Direct WhatsApp Orders and External Supplier Portal Orders (B2B systems) with full Order Logging (logOrders).
 */

import { store } from "../store.js";
import { OrderDispatcher } from "../services/orderDispatcher.js";
import { renderFieldReceiving } from "./fieldReceiving.js";

let activeOrdersMode = "DISPATCH"; // "DISPATCH" (שיגור ותיעוד הזמנה) | "RECEIVE" (קליטת הזמנה / סחורה)
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
  const openOrders = (state.logOrders || []).filter(o => o.status === "ORDERED");
  const deliveriesCount = (state.logDeliveries || []).length;

  container.innerHTML = `
    <div class="field-view">
      <!-- מתג דו-מצבי בראש מסך הרכש בשטח: שיגור ותיעוד הזמנה מול קליטת הזמנה -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: var(--space-md);">
        <button
          type="button"
          id="btnModeOrderDispatch"
          style="
            min-height: 48px;
            font-size: 14px;
            font-weight: 700;
            border: 1.5px solid #0F1115;
            border-radius: 6px;
            background: ${activeOrdersMode === 'DISPATCH' ? '#1D4ED8' : '#FFFFFF'};
            color: ${activeOrdersMode === 'DISPATCH' ? '#FFFFFF' : '#0F1115'};
            cursor: pointer;
          "
        >
          הזמנות רכש (${activeOrders.length})${openOrders.length > 0 ? ` • בדרך: ${openOrders.length}` : ''}
        </button>
        <button
          type="button"
          id="btnModeOrderReceive"
          style="
            min-height: 48px;
            font-size: 14px;
            font-weight: 700;
            border: 1.5px solid #0F1115;
            border-radius: 6px;
            background: ${activeOrdersMode === 'RECEIVE' ? '#1D4ED8' : '#FFFFFF'};
            color: ${activeOrdersMode === 'RECEIVE' ? '#FFFFFF' : '#0F1115'};
            cursor: pointer;
          "
        >
          קליטת סחורה ${openOrders.length > 0 ? `(ממתין: ${openOrders.length})` : (deliveriesCount > 0 ? `(${deliveriesCount})` : '')}
        </button>
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

  if (activeOrdersMode === "RECEIVE") {
    renderFieldReceiving(subContainer);
    return;
  }

  // מצב DISPATCH: הזמנות רכש חכמות (וואטסאפ + מערכות ספקים חיצוניות)
  subContainer.innerHTML = `
    <div style="margin-bottom: var(--space-md);">
      <h2 style="font-size: 18px; font-weight: 700;">הזמנות רכש חכמות ותיעוד ספקים</h2>
      <p style="font-size: 12px; color: var(--color-text-dim);">
        חשב כמויות לתקן סופ"ש, שלח בוואטסאפ או העתק והזן במערכת הספק, ותעד את ההזמנה כדי שתחכה לך בקליטת הסחורה.
      </p>
    </div>

    <!-- בלוק הזמנות פתוחות שכבר הוזמנו וממתינות לאספקה -->
    ${openOrders.length > 0 ? `
      <div style="background: #EFF6FF; border: 1.5px solid #1D4ED8; border-radius: 6px; padding: 12px; margin-bottom: var(--space-md);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="font-size: 14px; font-weight: 700; color: #1E3A8A;">
            🚚 הזמנות פתוחות שממתינות לאספקה (${openOrders.length})
          </div>
          <span style="font-size: 11px; color: #1D4ED8; font-weight: 600;">לחץ "קלוט משלוח" כשהספק מגיע</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${openOrders.map(ord => {
            const channelBadge = ord.orderChannel === "EXTERNAL_PORTAL"
              ? "🌐 הוזמן במערכת ספק"
              : (ord.orderChannel === "PHONE" ? "📞 הוזמן טלפונית" : "💬 נשלח בוואטסאפ");
            const timeFormatted = formatShortTime(ord.timestamp);
            return `
              <div style="background: #FFFFFF; border: 1.5px solid #0F1115; border-radius: 6px; padding: 10px; display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                <div>
                  <div style="font-weight: 700; font-size: 14px; color: #0F1115;">
                    ${ord.supplierName}
                    <span style="font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: #DBEAFE; color: #1E40AF; margin-right: 4px;">
                      ${channelBadge}
                    </span>
                  </div>
                  <div style="font-size: 12px; color: #4B5563; margin-top: 2px;">
                    ${(ord.items || []).length} פריטים • סה"כ משוער: <strong class="mono">₪${Number(ord.estimatedTotalExclVat || 0).toFixed(0)}</strong> • ${timeFormatted}
                    ${ord.externalOrderRef ? ` • אסמכתא: <strong class="mono">${ord.externalOrderRef}</strong>` : ''}
                  </div>
                </div>
                <div style="display: flex; gap: 6px;">
                  <button
                    type="button"
                    class="btn btn-primary btn-receive-open-order"
                    data-sup="${ord.supplierId}"
                    data-order="${ord.id}"
                    style="min-height: 40px; padding: 6px 12px; font-size: 13px; font-weight: 700;"
                  >
                    📥 קלוט משלוח
                  </button>
                  <button
                    type="button"
                    class="btn btn-secondary btn-cancel-open-order"
                    data-order="${ord.id}"
                    style="min-height: 40px; padding: 6px 10px; font-size: 12px;"
                    title="בטל תיעוד הזמנה פתוחה"
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
        <div class="empty-state-icon">✓</div>
        <div class="empty-state-title">המלאי תקין לחלוטין!</div>
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
    ` : activeOrders.map(group => {
      const sup = group.supplier;
      const isExternalPortal = sup.orderChannel === "EXTERNAL_PORTAL";
      const isPhone = sup.orderChannel === "PHONE";
      const openOrderForSup = openOrders.find(o => o.supplierId === sup.id);
      const refVal = supplierRefInputs[sup.id] || "";

      return `
        <div class="supplier-order-card" data-sup="${sup.id}" style="${openOrderForSup ? 'border: 2px solid #1D4ED8; background: #F8FAFC;' : ''}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; flex-wrap: wrap;">
            <div>
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <h3 style="font-size: 16px; font-weight: 700;">${sup.name}</h3>
                <span style="
                  font-size: 11px;
                  font-weight: 700;
                  padding: 2px 8px;
                  border-radius: 4px;
                  border: 1px solid #0F1115;
                  background: ${isExternalPortal ? '#FEF3C7' : (isPhone ? '#E0E7FF' : '#DCFCE7')};
                  color: #0F1115;
                ">
                  ${isExternalPortal ? '🌐 מערכת הזמנות ספק' : (isPhone ? '📞 הזמנה טלפונית / סוכן' : '💬 הזמנה בוואטסאפ')}
                </span>
              </div>
              <div style="font-size: 12px; color: var(--color-text-dim); margin-top: 2px;">
                <span>איש קשר: ${sup.contactName || '—'}</span>
                <span>•</span>
                <span>קטגוריה: ${sup.category}</span>
                <span>•</span>
                <span>אומדן: <strong class="mono">₪${group.estimatedTotalExclVat.toFixed(0)}</strong></span>
              </div>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
              ${openOrderForSup ? `
                <span class="badge badge-success" style="background: #1D4ED8; color: #FFFFFF;">✓ הוזמן וממתין לקליטה</span>
              ` : ''}
              <span class="badge badge-warning">${group.totalItemsCount} בחוסר</span>
            </div>
          </div>

          ${isExternalPortal ? `
            <div style="margin-top: 8px; padding: 8px 10px; background: #FFFBEB; border: 1px dashed #D97706; border-radius: 6px; font-size: 12px; color: #92400E;">
              <strong>💡 ספק עם מערכת הזמנות משלו:</strong> סמן V ליד כל פריט תוך כדי הקלדה באפליקציה/אתר של <strong>${sup.name}</strong>, ובסיום לחץ על <strong>"תעד הזמנה שבוצעה"</strong>.
            </div>
          ` : ''}

          <!-- פריטים להזמנה אצל ספק זה -->
          <div class="order-items-list">
            ${group.items.map(item => {
              const isChecked = Boolean(portalCheckedItems[item.id]);
              return `
                <div class="order-item-row" style="${isChecked ? 'background: #F0FDF4; opacity: 0.85;' : ''}">
                  <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
                    ${isExternalPortal ? `
                      <input
                        type="checkbox"
                        class="portal-item-check"
                        data-id="${item.id}"
                        ${isChecked ? 'checked' : ''}
                        title="סמן שהוקלד במערכת הספק"
                        style="width: 22px; height: 22px; accent-color: #15803D; cursor: pointer; flex-shrink: 0;"
                      />
                    ` : ''}
                    <div>
                      <div style="font-weight: 600; ${isChecked ? 'text-decoration: line-through; color: #15803D;' : ''}">
                        ${item.name}
                        ${item.supplierSku ? `<span class="mono" style="font-size: 11px; background: #E5E7EB; padding: 1px 5px; border-radius: 3px; margin-right: 4px;">מק"ט: ${item.supplierSku}</span>` : ''}
                      </div>
                      <div style="font-size: 11px; color: var(--color-text-dim);">
                        מלאי: ${item.currentStock} / תקן: ${item.parLevelWeekend} ${item.stockUnit}
                      </div>
                    </div>
                  </div>

                  <!-- Stepper כמות הזמנה -->
                  <div class="stepper-container" style="height: 42px;">
                    <button class="stepper-btn order-minus" data-id="${item.id}" style="width: 42px; height: 42px;">-</button>
                    <input 
                      type="number" 
                      class="stepper-input order-qty-input" 
                      data-id="${item.id}" 
                      value="${item.orderQty}" 
                      style="width: 54px; height: 42px; font-size: 15px;"
                    />
                    <button class="stepper-btn order-plus" data-id="${item.id}" style="width: 42px; height: 42px;">+</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- שדה אסמכתא / הערה להזמנה (במיוחד לספקי פורטל חיצוני) -->
          <div style="margin-top: 10px; display: flex; gap: 8px; align-items: center;">
            <input
              type="text"
              class="form-input order-ref-input"
              data-sup="${sup.id}"
              placeholder="${isExternalPortal ? 'מס׳ הזמנה / אסמכתא מאתר הספק (אופציונלי)...' : 'הערה להזמנה (אופציונלי)...'}"
              value="${refVal}"
              style="flex: 1; min-height: 40px; font-size: 13px; border: 1px solid #0F1115;"
            />
            <button
              type="button"
              class="btn btn-secondary btn-copy-order-text"
              data-sup="${sup.id}"
              style="min-height: 40px; padding: 6px 10px; font-size: 12px; font-weight: 700; white-space: nowrap;"
              title="העתק את רשימת ההזמנה ללוח"
            >
              📋 העתק רשימה
            </button>
            ${sup.portalUrl ? `
              <a
                href="${sup.portalUrl}"
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-secondary"
                style="min-height: 40px; padding: 6px 10px; font-size: 12px; font-weight: 700; white-space: nowrap; text-decoration: none; display: inline-flex; align-items: center;"
              >
                🌐 פתח אתר ספק
              </a>
            ` : ''}
          </div>

          <!-- כפתורי פעולה ראשיים לפי סוג הספק -->
          <div style="display: flex; gap: var(--space-xs); margin-top: var(--space-sm); flex-wrap: wrap;">
            ${isExternalPortal ? `
              <button
                type="button"
                class="btn btn-primary btn-log-external-order"
                data-sup="${sup.id}"
                style="flex: 1; min-height: 48px; background: #1D4ED8; color: #FFFFFF; font-weight: 700; border: 1.5px solid #0F1115;"
              >
                ✓ תעד הזמנה שבוצעה במערכת ${sup.name}
              </button>
            ` : `
              <button
                type="button"
                class="btn btn-whatsapp btn-dispatch-whatsapp-and-log"
                data-sup="${sup.id}"
                style="flex: 1; min-height: 48px; font-weight: 700;"
              >
                💬 שלח בוואטסאפ ותעד הזמנה ל-${sup.name}
              </button>
              <button
                type="button"
                class="btn btn-secondary btn-log-external-order"
                data-sup="${sup.id}"
                style="min-height: 48px; padding: 8px 12px; font-weight: 700;"
                title="סמן כהוזמן ללא פתיחת וואטסאפ (למשל אם הוזמן בטלפון או באתר)"
              >
                ✓ סמן כהוזמן
              </button>
            `}
            <button
              type="button"
              class="btn btn-secondary btn-receive-this-sup"
              data-sup="${sup.id}"
              style="min-height: 48px; padding: 8px 12px; font-weight: 700;"
              title="קלוט סחורה שהגיעה מספק זה"
            >
              קלוט משלוח
            </button>
          </div>
        </div>
      `;
    }).join('')}
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
        btn.textContent = "✓ הועתק!";
        setTimeout(() => { btn.textContent = "📋 העתק רשימה"; }, 2000);
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
      val += 1;
      manualOverrides[id] = val;
      renderFieldOrders(container);
    });
  });

  subContainer.querySelectorAll(".order-minus").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const input = subContainer.querySelector(`.order-qty-input[data-id="${id}"]`);
      let val = Number(input.value) || 0;
      val = Math.max(0, val - 1);
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
    store.recordPurchaseOrder({
      supplierId: sup.id,
      orderChannel: channel,
      externalOrderRef: ref,
      orderedBy: "ישראל - שטח",
      items: itemsPayload
    });
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
