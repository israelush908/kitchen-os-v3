/**
 * Field Mode — Smart WhatsApp Orders & Goods Receiving View (הזמנות רכש וקליטת הזמנה בשטח)
 */

import { store } from "../store.js";
import { OrderDispatcher } from "../services/orderDispatcher.js";
import { renderFieldReceiving } from "./fieldReceiving.js";

let activeOrdersMode = "DISPATCH"; // "DISPATCH" (שיגור הזמנה) | "RECEIVE" (קליטת הזמנה / סחורה)
let manualOverrides = {}; // { itemId: quantity }

export function renderFieldOrders(container) {
  const state = store.getState();
  const supplierOrders = OrderDispatcher.getSupplierOrders(
    state.catalog,
    state.suppliers,
    manualOverrides
  );

  // סנן רק ספקים עם פריטים להזמנה
  const activeOrders = supplierOrders.filter(so => so.totalItemsCount > 0);
  const deliveriesCount = (state.logDeliveries || []).length;

  container.innerHTML = `
    <div class="field-view">
      <!-- מתג דו-מצבי בראש מסך הרכש בשטח: שיגור הזמנה מול קליטת הזמנה -->
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
          שיגור הזמנה (${activeOrders.length})
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
          קליטת הזמנה / סחורה ${deliveriesCount > 0 ? `(${deliveriesCount})` : ''}
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

  // מצב DISPATCH: הזמנות רכש חכמות בוואטסאפ
  subContainer.innerHTML = `
    <div style="margin-bottom: var(--space-md);">
      <h2 style="font-size: 18px; font-weight: 700;">הזמנות רכש חכמות בוואטסאפ</h2>
      <p style="font-size: 12px; color: var(--color-text-dim);">
        המערכת מאגדת אוטומטית פריטים שירדו מנקודת ההזמנה ומחשבת כמויות עד תקן סופ"ש.
      </p>
    </div>

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
      const waLink = OrderDispatcher.generateWhatsAppLink(sup, group.items);

      return `
        <div class="supplier-order-card" data-sup="${sup.id}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h3 style="font-size: 16px; font-weight: 700;">${sup.name}</h3>
              <div style="font-size: 12px; color: var(--color-text-dim); margin-top: 2px;">
                <span>איש קשר: ${sup.contactName || '—'}</span>
                <span>•</span>
                <span>קטגוריה: ${sup.category}</span>
              </div>
            </div>
            <span class="badge badge-warning">${group.totalItemsCount} בחוסר</span>
          </div>

          <!-- פריטים להזמנה אצל ספק זה -->
          <div class="order-items-list">
            ${group.items.map(item => `
              <div class="order-item-row">
                <div>
                  <div style="font-weight: 600;">${item.name}</div>
                  <div style="font-size: 11px; color: var(--color-text-dim);">
                    מלאי: ${item.currentStock} / תקן: ${item.parLevelWeekend} ${item.stockUnit}
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
            `).join('')}
          </div>

          <!-- כפתורי שיגור בוואטסאפ או מעבר ישיר לקליטת ההזמנה שהגיעה -->
          <div style="display: flex; gap: var(--space-xs); margin-top: var(--space-sm); flex-wrap: wrap;">
            <a 
              href="${waLink}" 
              target="_blank" 
              class="btn btn-whatsapp" 
              style="flex: 1; min-height: 48px;"
            >
              שלח הזמנה בוואטסאפ ל-${sup.name}
            </a>
            <button
              type="button"
              class="btn btn-secondary btn-receive-this-sup"
              data-sup="${sup.id}"
              style="min-height: 48px; padding: 8px 12px; font-weight: 700;"
              title="קלוט סחורה שהגיעה מספק זה"
            >
              קלוט משלוח
            </button>
            <button class="btn btn-secondary btn-preview-msg" data-sup="${sup.id}" style="min-height: 48px; padding: 8px 12px;" title="צפה בנוסח ההודעה">
              תצוגה
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

  // Preview message modal
  subContainer.querySelectorAll(".btn-preview-msg").forEach(btn => {
    btn.addEventListener("click", () => {
      const supId = btn.dataset.sup;
      const grp = activeOrders.find(g => g.supplier.id === supId);
      if (!grp) return;
      const link = OrderDispatcher.generateWhatsAppLink(grp.supplier, grp.items);
      const url = new URL(link);
      const text = url.searchParams.get("text") || "";
      alert(`נוסח ההודעה שתישלח ל-${grp.supplier.name}:\n\n` + text);
    });
  });
}
