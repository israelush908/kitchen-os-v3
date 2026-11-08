/**
 * Field Mode — Smart WhatsApp Orders View (הזמנות רכש חכמות לספקים)
 */

import { store } from "../store.js";
import { OrderDispatcher } from "../services/orderDispatcher.js";

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

  container.innerHTML = `
    <div class="field-view">
      <div style="margin-bottom: var(--space-md);">
        <h2 style="font-size: 18px; font-weight: 700;">📲 הזמנות רכש חכמות בוואטסאפ</h2>
        <p style="font-size: 12px; color: var(--color-text-dim);">
          המערכת מאגדת אוטומטית פריטים שירדו מנקודת ההזמנה ומחשבת כמויות עד תקן סופ"ש.
        </p>
      </div>

      ${activeOrders.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">✅</div>
          <div class="empty-state-title">המלאי תקין לחלוטין!</div>
          <div class="empty-state-desc">אין כרגע פריטים שירדו מתחת לנקודת ההזמנה המינימלית. כל הכבוד!</div>
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
                  <div class="stepper-container" style="height: 38px;">
                    <button class="stepper-btn order-minus" data-id="${item.id}" style="width: 36px; height: 38px;">-</button>
                    <input 
                      type="number" 
                      class="stepper-input order-qty-input" 
                      data-id="${item.id}" 
                      value="${item.orderQty}" 
                      style="width: 50px; height: 38px; font-size: 14px;"
                    />
                    <button class="stepper-btn order-plus" data-id="${item.id}" style="width: 36px; height: 38px;">+</button>
                  </div>
                </div>
              `).join('')}
            </div>

            <!-- כפתור שיגור בוואטסאפ -->
            <div style="display: flex; gap: var(--space-xs); margin-top: var(--space-sm);">
              <a 
                href="${waLink}" 
                target="_blank" 
                class="btn btn-whatsapp" 
                style="flex: 1; min-height: 44px;"
              >
                📲 שלח הזמנה בוואטסאפ ל-${sup.name}
              </a>
              <button class="btn btn-secondary btn-preview-msg" data-sup="${sup.id}" style="padding: 8px 12px;" title="צפה בנוסח ההודעה">
                👁️ תצוגה
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Steppers events
  container.querySelectorAll(".order-plus").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const input = container.querySelector(`.order-qty-input[data-id="${id}"]`);
      let val = Number(input.value) || 0;
      val += 1;
      manualOverrides[id] = val;
      renderFieldOrders(container);
    });
  });

  container.querySelectorAll(".order-minus").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const input = container.querySelector(`.order-qty-input[data-id="${id}"]`);
      let val = Number(input.value) || 0;
      val = Math.max(0, val - 1);
      manualOverrides[id] = val;
      renderFieldOrders(container);
    });
  });

  container.querySelectorAll(".order-qty-input").forEach(input => {
    input.addEventListener("change", () => {
      const id = input.dataset.id;
      const val = Math.max(0, Number(input.value) || 0);
      manualOverrides[id] = val;
      renderFieldOrders(container);
    });
  });

  // Preview message modal
  container.querySelectorAll(".btn-preview-msg").forEach(btn => {
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
