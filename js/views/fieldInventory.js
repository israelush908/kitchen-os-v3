/**
 * Field Mode — Inventory Count View (ספירת מלאי מובייל ביד אחת)
 * Aesthetic: Swiss Kitchen Editorial (REQ-03, REQ-04, REQ-05, R20, R21, R46, R55)
 */

import { store } from "../store.js";

let selectedCategory = "הכל";
let searchQuery = "";
let localCounts = {}; // { itemId: number }

export function renderFieldInventory(container) {
  const state = store.getState();
  const catalog = (state.catalog || []).filter(i => i.isActive && i.inCountForm);

  // חילוץ קטגוריות ייחודיות
  const categories = ["הכל", ...new Set(catalog.map(i => i.category))];

  // סינון
  const filtered = catalog.filter(item => {
    const matchesCat = selectedCategory === "הכל" || item.category === selectedCategory;
    const matchesSearch = !searchQuery || item.name.includes(searchQuery);
    return matchesCat && matchesSearch;
  });

  const modifiedCount = Object.keys(localCounts).length;

  container.innerHTML = `
    <div class="field-view">
      <!-- סרגל חיפוש וסינון עליון דביק -->
      <div class="field-control-strip">
        <div class="field-section-header">
          <h1 class="field-section-title">ספירת מלאי שטח</h1>
          <span class="badge badge-unit">${filtered.length} פריטים</span>
        </div>

        <!-- שורת חיפוש (REQ-03) -->
        <div class="search-bar-container">
          <span class="search-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.3-4.3"/>
            </svg>
          </span>
          <input
            type="text"
            class="search-input"
            id="inventorySearchInput"
            placeholder="חיפוש מהיר של חומר גלם..."
            value="${searchQuery}"
          />
        </div>

        <!-- פילטר קטגוריות אופקי (REQ-03, R20) -->
        <div class="filter-bar" role="tablist" aria-label="סינון לפי קטגוריה">
          ${categories.map(cat => `
            <button class="filter-pill ${selectedCategory === cat ? 'active' : ''}" data-cat="${cat}" role="tab" aria-selected="${selectedCategory === cat}">
              ${cat}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- רשימת פריטים שטוחה ללא קינון כרטיסים (REQ-04, R46) -->
      <div class="inventory-list">
        ${catalog.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                <path d="m3.3 7 8.7 5 8.7-5"/>
                <path d="M12 22V12"/>
              </svg>
            </div>
            <div class="empty-state-title">קטלוג הספירה ריק</div>
            <div class="empty-state-desc">אין כרגע פריטים פעילים המוגדרים לטופס ספירת מלאי.</div>
          </div>
        ` : filtered.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
              </svg>
            </div>
            <div class="empty-state-title">לא נמצאו פריטים התואמים לחיפוש</div>
            <div class="empty-state-desc">נסה מונח חיפוש אחר או אפס את סינון הקטגוריות.</div>
            <button type="button" class="btn btn-secondary" id="btnResetInventoryFilter">
              נקה סינון
            </button>
          </div>
        ` : filtered.map(item => {
          const isModified = localCounts[item.id] !== undefined;
          const currentVal = isModified ? localCounts[item.id] : item.currentStock;
          const isDeficit = currentVal <= item.reorderPoint;
          const supplier = (state.suppliers || []).find(s => s.id === item.supplierId);

          return `
            <div class="inventory-item-card ${isDeficit ? 'deficit' : ''} ${isModified ? 'modified' : ''}" data-id="${item.id}">
              <div class="inventory-item-info">
                <div class="inventory-item-header">
                  <span class="inventory-item-name">${item.name}</span>
                  <span class="badge-unit">${item.stockUnit}</span>
                </div>
                <div class="inventory-item-meta">
                  <span>תקן סופ"ש: <strong class="mono">${item.parLevelWeekend}</strong></span>
                  ${supplier ? `<span>· ${supplier.name}</span>` : ''}
                </div>
                <div style="margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap;">
                  ${isDeficit ? `
                    <span class="badge badge-danger">
                      <span class="badge-dot"></span>
                      <span>חוסר (מינ' ${item.reorderPoint})</span>
                    </span>
                  ` : `
                    <span class="badge badge-success">
                      <span class="badge-dot"></span>
                      <span>תקין</span>
                    </span>
                  `}
                  ${isModified ? `
                    <span class="badge badge-cobalt">עודכן</span>
                  ` : ''}
                </div>
              </div>

              <!-- Stepper 48x48px (REQ-04, R20) -->
              <div class="stepper-container">
                <button type="button" class="stepper-btn btn-minus" data-id="${item.id}" aria-label="הפחת כמות עבור ${item.name}">−</button>
                <input
                  type="number"
                  step="any"
                  class="stepper-input"
                  data-id="${item.id}"
                  value="${currentVal}"
                  aria-label="כמות נוכחית עבור ${item.name}"
                />
                <button type="button" class="stepper-btn btn-plus" data-id="${item.id}" aria-label="הוסף כמות עבור ${item.name}">+</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- סרגל פעולה ראשי מעוגן (REQ-05, R11) -->
      <div class="field-sticky-cta-bar" id="inventoryStickyBar" style="${modifiedCount > 0 ? '' : 'display: none;'}">
        <button type="button" class="btn btn-primary btn-floating" id="btnSaveInventoryBatch">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          <span id="btnSaveInventoryText">שמור ועדכן מלאי (${modifiedCount} פריטים)</span>
        </button>
      </div>
    </div>
  `;

  // ================= EVENT LISTENERS =================

  // חיפוש
  const searchInput = container.querySelector("#inventorySearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      renderFieldInventory(container);
      const nextInput = container.querySelector("#inventorySearchInput");
      if (nextInput) {
        nextInput.focus();
        nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
      }
    });
  }

  // איפוס סינון ממצב Empty (R55)
  container.querySelector("#btnResetInventoryFilter")?.addEventListener("click", () => {
    searchQuery = "";
    selectedCategory = "הכל";
    renderFieldInventory(container);
  });

  // פילטר קטגוריות
  container.querySelectorAll(".filter-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedCategory = btn.dataset.cat;
      renderFieldInventory(container);
    });
  });

  // כפתורי פלוס ומינוס
  container.querySelectorAll(".btn-plus").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const input = container.querySelector(`.stepper-input[data-id="${id}"]`);
      let val = Number(input.value) || 0;
      val = Math.round((val + 1) * 100) / 100;
      localCounts[id] = val;
      input.value = val;
      const row = container.querySelector(`.inventory-item-card[data-id="${id}"]`);
      if (row) row.classList.add("modified");
      updateFloatingButton(container);
    });
  });

  container.querySelectorAll(".btn-minus").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const input = container.querySelector(`.stepper-input[data-id="${id}"]`);
      let val = Number(input.value) || 0;
      val = Math.max(0, Math.round((val - 1) * 100) / 100);
      localCounts[id] = val;
      input.value = val;
      const row = container.querySelector(`.inventory-item-card[data-id="${id}"]`);
      if (row) row.classList.add("modified");
      updateFloatingButton(container);
    });
  });

  // שינוי ידני באינפוט
  container.querySelectorAll(".stepper-input").forEach(input => {
    input.addEventListener("change", () => {
      const id = input.dataset.id;
      const val = Math.max(0, Number(input.value) || 0);
      localCounts[id] = val;
      const row = container.querySelector(`.inventory-item-card[data-id="${id}"]`);
      if (row) row.classList.add("modified");
      updateFloatingButton(container);
    });
  });

  // שמירה צפה
  const saveBtn = container.querySelector("#btnSaveInventoryBatch");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      store.saveCountsBatch(localCounts, "ישראל - שטח");
      localCounts = {};
      renderFieldInventory(container);
    });
  }
}

function updateFloatingButton(container) {
  const modifiedCount = Object.keys(localCounts).length;
  const bar = container.querySelector("#inventoryStickyBar");
  const textEl = container.querySelector("#btnSaveInventoryText");
  if (!bar) return;

  if (modifiedCount > 0) {
    bar.style.display = "flex";
    if (textEl) {
      textEl.textContent = `שמור ועדכן מלאי (${modifiedCount} פריטים)`;
    }
  } else {
    bar.style.display = "none";
  }
}
