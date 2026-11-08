/**
 * Office Mode — Catalog & Suppliers Management View (ניהול קטלוג חומרי גלם וספקים)
 */

import { store } from "../store.js";
import { CalculationService } from "../services/calculationService.js";

let activeSubTab = "ITEMS"; // ITEMS | SUPPLIERS
let searchVal = "";
let catFilter = "הכל";

export function renderOfficeCatalog(container) {
  const state = store.getState();
  const catalog = state.catalog;
  const suppliers = state.suppliers;

  const categories = ["הכל", ...new Set(catalog.map(c => c.category))];

  const filteredItems = catalog.filter(i => {
    const matchCat = catFilter === "הכל" || i.category === catFilter;
    const matchSearch = !searchVal || i.name.includes(searchVal) || i.id.includes(searchVal);
    return matchCat && matchSearch;
  });

  const filteredSuppliers = suppliers.filter(s => {
    return !searchVal || s.name.includes(searchVal) || (s.contactName && s.contactName.includes(searchVal));
  });

  container.innerHTML = `
    <div class="office-catalog">
      <div style="margin-bottom: var(--space-md); display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="font-size: 22px; font-weight: 700;">🗂️ קטלוג חומרי גלם, ספקים ותקני Par</h1>
          <p style="font-size: 13px; color: var(--color-text-dim);">
            מקור האמת האחיד (Single Source of Truth) למחירי רכש, תקני סופ"ש ופרטי ספקים.
          </p>
        </div>
        <div style="display: flex; gap: var(--space-sm);">
          ${activeSubTab === 'ITEMS' ? `
            <button class="btn btn-primary" id="btnAddNewItem">➕ הוסף חומר גלם חדש</button>
          ` : `
            <button class="btn btn-primary" id="btnAddNewSupplier">➕ הוסף ספק חדש</button>
          `}
        </div>
      </div>

      <!-- מתג לשוניות: חומרי גלם / ספקים -->
      <div style="display: flex; gap: var(--space-xs); margin-bottom: var(--space-md); border-bottom: 1px solid var(--color-border-subtle); padding-bottom: var(--space-xs);">
        <button class="filter-pill ${activeSubTab === 'ITEMS' ? 'active' : ''}" id="tabItems">
          📦 קטלוג חומרי גלם (${catalog.length})
        </button>
        <button class="filter-pill ${activeSubTab === 'SUPPLIERS' ? 'active' : ''}" id="tabSuppliers">
          🚚 ספקי מטבח (${suppliers.length})
        </button>
      </div>

      <!-- סרגל חיפוש וסינון -->
      <div style="display: flex; gap: var(--space-md); align-items: center; margin-bottom: var(--space-md);">
        <input 
          type="text" 
          class="form-input" 
          id="catalogSearchInput" 
          placeholder="${activeSubTab === 'ITEMS' ? 'חפש לפי שם או מק\"ט...' : 'חפש ספק...'}" 
          value="${searchVal}" 
          style="max-width: 320px;"
        />
        ${activeSubTab === 'ITEMS' ? `
          <select class="form-select" id="catalogCategorySelect" style="max-width: 200px;">
            ${categories.map(c => `<option value="${c}" ${c === catFilter ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        ` : ''}
      </div>

      ${activeSubTab === 'ITEMS' ? `
        <!-- טבלת חומרי גלם -->
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>מזהה</th>
                <th>שם חומר גלם</th>
                <th>קטגוריה</th>
                <th>ספק ראשי</th>
                <th>יחידה</th>
                <th>מחיר יחידה (ללא מע"מ)</th>
                <th>פחת קילוף %</th>
                <th>עלות אפקטיבית ₪</th>
                <th>תקן סופ"ש (Par)</th>
                <th>מינימום (Reorder)</th>
                <th>מלאי נוכחי</th>
                <th>סטטוס</th>
                <th style="width: 60px;">פעולות</th>
              </tr>
            </thead>
            <tbody>
              ${filteredItems.map(item => {
                const sup = suppliers.find(s => s.id === item.supplierId);
                const effectiveCost = CalculationService.calculateEffectiveCost(item.unitCostExclVat, item.yieldLossPct);
                const isDeficit = item.currentStock <= item.reorderPoint;

                return `
                  <tr style="${isDeficit ? 'background: #fff8f8;' : ''}">
                    <td class="mono" style="font-size: 11px; color: var(--color-text-dim);">${item.id}</td>
                    <td><strong>${item.name}</strong></td>
                    <td>${item.category}</td>
                    <td>${sup ? sup.name : '—'}</td>
                    <td>${item.stockUnit}</td>
                    <td>₪${Number(item.unitCostExclVat).toFixed(2)}</td>
                    <td>${((item.yieldLossPct || 0) * 100).toFixed(0)}%</td>
                    <td style="font-weight: 600;">₪${effectiveCost.toFixed(2)}</td>
                    <td>${item.parLevelWeekend}</td>
                    <td>${item.reorderPoint}</td>
                    <td><strong>${item.currentStock}</strong></td>
                    <td>
                      <span class="badge ${isDeficit ? 'badge-danger' : 'badge-success'}">
                        ${isDeficit ? 'להזמנה 🚨' : 'תקין 🟢'}
                      </span>
                    </td>
                    <td>
                      <button class="btn btn-secondary btn-edit-item" data-id="${item.id}" style="min-height: 28px; padding: 2px 8px; font-size: 11px;">
                        ✏️ ערוך
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <!-- טבלת ספקים -->
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>מזהה</th>
                <th>שם ספק</th>
                <th>תחום ראשי</th>
                <th>איש קשר</th>
                <th>טלפון לוואטסאפ</th>
                <th>ימי חלוקה ואספקה</th>
                <th>פעיל</th>
                <th style="width: 60px;">פעולות</th>
              </tr>
            </thead>
            <tbody>
              ${filteredSuppliers.map(sup => `
                <tr>
                  <td class="mono" style="font-size: 11px; color: var(--color-text-dim);">${sup.id}</td>
                  <td><strong>${sup.name}</strong></td>
                  <td>${sup.category}</td>
                  <td>${sup.contactName || '—'}</td>
                  <td class="mono" dir="ltr" style="text-align: right;">${sup.whatsappPhone}</td>
                  <td>
                    <div style="display: flex; gap: 3px; flex-wrap: wrap;">
                      ${(sup.deliveryDays || []).map(d => `<span class="badge badge-gray" style="font-size: 10px;">${d}</span>`).join('')}
                    </div>
                  </td>
                  <td>
                    <span class="badge ${sup.isActive ? 'badge-success' : 'badge-danger'}">
                      ${sup.isActive ? 'פעיל' : 'לא פעיל'}
                    </span>
                  </td>
                  <td>
                    <button class="btn btn-secondary btn-edit-sup" data-id="${sup.id}" style="min-height: 28px; padding: 2px 8px; font-size: 11px;">
                      ✏️ ערוך
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;

  // Listeners
  container.querySelector("#tabItems")?.addEventListener("click", () => {
    activeSubTab = "ITEMS";
    renderOfficeCatalog(container);
  });

  container.querySelector("#tabSuppliers")?.addEventListener("click", () => {
    activeSubTab = "SUPPLIERS";
    renderOfficeCatalog(container);
  });

  container.querySelector("#catalogSearchInput")?.addEventListener("input", (e) => {
    searchVal = e.target.value.trim();
    renderOfficeCatalog(container);
  });

  container.querySelector("#catalogCategorySelect")?.addEventListener("change", (e) => {
    catFilter = e.target.value;
    renderOfficeCatalog(container);
  });

  // Edit item
  container.querySelectorAll(".btn-edit-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const itm = catalog.find(c => c.id === id);
      if (itm) showItemModal(itm, container);
    });
  });

  // Add item
  container.querySelector("#btnAddNewItem")?.addEventListener("click", () => {
    showItemModal(null, container);
  });

  // Edit supplier
  container.querySelectorAll(".btn-edit-sup").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const sup = suppliers.find(s => s.id === id);
      if (sup) showSupplierModal(sup, container);
    });
  });

  // Add supplier
  container.querySelector("#btnAddNewSupplier")?.addEventListener("click", () => {
    showSupplierModal(null, container);
  });
}

function showItemModal(item, container) {
  const state = store.getState();
  const isEdit = !!item;

  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3 style="font-size: 16px; font-weight: 700;">
          ${isEdit ? `✏️ עריכת חומר גלם: ${item.name}` : `➕ הוספת חומר גלם חדש`}
        </h3>
        <button class="btn btn-secondary btn-close-modal">✕</button>
      </div>
      <form id="itemForm">
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">שם חומר הגלם</label>
            <input type="text" class="form-input" id="modalItemName" value="${item ? item.name : ''}" required />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm);">
            <div class="form-group">
              <label class="form-label">קטגוריה</label>
              <input type="text" class="form-input" id="modalItemCat" value="${item ? item.category : 'גבינות ומחלבה'}" required />
            </div>
            <div class="form-group">
              <label class="form-label">ספק ראשי</label>
              <select class="form-select" id="modalItemSupplier">
                ${state.suppliers.map(s => `<option value="${s.id}" ${item && item.supplierId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm);">
            <div class="form-group">
              <label class="form-label">יחידת מידה</label>
              <select class="form-select" id="modalItemUnit">
                ${['ק\"ג', 'ליטר', 'יח\'', 'צרור', 'אריזה', 'קרטון'].map(u => `<option value="${u}" ${item && item.stockUnit === u ? 'selected' : ''}>${u}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">מחיר יחידה (ללא מע"מ ₪)</label>
              <input type="number" step="any" class="form-input" id="modalItemCost" value="${item ? item.unitCostExclVat : 10}" required />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm);">
            <div class="form-group">
              <label class="form-label">פחת קילוף / ניקוי % (0.00-1.00)</label>
              <input type="number" step="0.01" class="form-input" id="modalItemYield" value="${item ? item.yieldLossPct : 0}" />
            </div>
            <div class="form-group">
              <label class="form-label">מלאי נוכחי</label>
              <input type="number" step="any" class="form-input" id="modalItemStock" value="${item ? item.currentStock : 0}" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm);">
            <div class="form-group">
              <label class="form-label">תקן מלאי סופ"ש (Par)</label>
              <input type="number" step="any" class="form-input" id="modalItemPar" value="${item ? item.parLevelWeekend : 10}" required />
            </div>
            <div class="form-group">
              <label class="form-label">נקודת הזמנה מינימום</label>
              <input type="number" step="any" class="form-input" id="modalItemReorder" value="${item ? item.reorderPoint : 3}" required />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary btn-close-modal">ביטול</button>
          <button type="submit" class="btn btn-primary">שמור חומר גלם</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelectorAll(".btn-close-modal").forEach(b => b.addEventListener("click", () => modal.remove()));

  modal.querySelector("#itemForm").addEventListener("submit", (e) => {
    e.preventDefault();
    store.saveCatalogItem({
      ...(item || {}),
      name: modal.querySelector("#modalItemName").value,
      category: modal.querySelector("#modalItemCat").value,
      supplierId: modal.querySelector("#modalItemSupplier").value,
      stockUnit: modal.querySelector("#modalItemUnit").value,
      unitCostExclVat: Number(modal.querySelector("#modalItemCost").value) || 0,
      yieldLossPct: Number(modal.querySelector("#modalItemYield").value) || 0,
      currentStock: Number(modal.querySelector("#modalItemStock").value) || 0,
      parLevelWeekend: Number(modal.querySelector("#modalItemPar").value) || 0,
      reorderPoint: Number(modal.querySelector("#modalItemReorder").value) || 0
    });
    modal.remove();
    renderOfficeCatalog(container);
  });
}

function showSupplierModal(supplier, container) {
  const isEdit = !!supplier;
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3 style="font-size: 16px; font-weight: 700;">
          ${isEdit ? `✏️ עריכת ספק: ${supplier.name}` : `➕ הוספת ספק חדש`}
        </h3>
        <button class="btn btn-secondary btn-close-modal">✕</button>
      </div>
      <form id="supForm">
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">שם הספק</label>
            <input type="text" class="form-input" id="modalSupName" value="${supplier ? supplier.name : ''}" required />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm);">
            <div class="form-group">
              <label class="form-label">תחום ראשי</label>
              <input type="text" class="form-input" id="modalSupCategory" value="${supplier ? supplier.category : 'ירקות ופירות'}" required />
            </div>
            <div class="form-group">
              <label class="form-label">איש קשר</label>
              <input type="text" class="form-input" id="modalSupContact" value="${supplier ? supplier.contactName : ''}" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">טלפון וואטסאפ (ללא +, למשל 972504008601)</label>
            <input type="text" class="form-input" id="modalSupPhone" value="${supplier ? supplier.whatsappPhone : '972'}" required />
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary btn-close-modal">ביטול</button>
          <button type="submit" class="btn btn-primary">שמור ספק</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelectorAll(".btn-close-modal").forEach(b => b.addEventListener("click", () => modal.remove()));

  modal.querySelector("#supForm").addEventListener("submit", (e) => {
    e.preventDefault();
    store.saveSupplier({
      ...(supplier || {}),
      name: modal.querySelector("#modalSupName").value,
      category: modal.querySelector("#modalSupCategory").value,
      contactName: modal.querySelector("#modalSupContact").value,
      whatsappPhone: modal.querySelector("#modalSupPhone").value.replace(/\D/g, "")
    });
    modal.remove();
    renderOfficeCatalog(container);
  });
}
