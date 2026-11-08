/**
 * Field Mode — Inventory Count View (ספירת מלאי מובייל ביד אחת)
 */

import { store } from "../store.js";

let selectedCategory = "הכל";
let searchQuery = "";
let localCounts = {}; // { itemId: number }

export function renderFieldInventory(container) {
  const state = store.getState();
  const catalog = state.catalog.filter(i => i.isActive && i.inCountForm);

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
      <!-- שורת חיפוש -->
      <div class="search-bar-container">
        <input 
          type="text" 
          class="search-input" 
          id="inventorySearchInput" 
          placeholder="חפש חומר גלם..." 
          value="${searchQuery}"
        />
        <span class="search-icon">🔍</span>
      </div>

      <!-- פילטר קטגוריות אופקי -->
      <div class="filter-bar">
        ${categories.map(cat => `
          <button class="filter-pill ${selectedCategory === cat ? 'active' : ''}" data-cat="${cat}">
            ${cat}
          </button>
        `).join('')}
      </div>

      <!-- רשימת פריטים לספירה -->
      <div class="inventory-list">
        ${filtered.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">📦</div>
            <div class="empty-state-title">לא נמצאו חומרי גלם</div>
            <div class="empty-state-desc">נסה לשנות את מונח החיפוש או לבחור קטגוריה אחרת</div>
          </div>
        ` : filtered.map(item => {
          const currentVal = localCounts[item.id] !== undefined ? localCounts[item.id] : item.currentStock;
          const isDeficit = item.currentStock <= item.reorderPoint;
          const supplier = state.suppliers.find(s => s.id === item.supplierId);

          return `
            <div class="inventory-item-card ${isDeficit ? 'deficit' : ''}" data-id="${item.id}">
              <div class="inventory-item-info">
                <div class="inventory-item-name">${item.name}</div>
                <div class="inventory-item-meta">
                  <span>${supplier ? supplier.name : ''}</span>
                  <span>•</span>
                  <span>יחידה: <strong>${item.stockUnit}</strong></span>
                  <span>•</span>
                  <span>תקן: ${item.parLevelWeekend}</span>
                </div>
                ${isDeficit ? `
                  <div style="margin-top: 4px;">
                    <span class="badge badge-danger">מתחת למינימום (${item.reorderPoint})</span>
                  </div>
                ` : ''}
              </div>

              <!-- Stepper -->
              <div class="stepper-container">
                <button class="stepper-btn btn-minus" data-id="${item.id}" aria-label="הפחת">-</button>
                <input 
                  type="number" 
                  step="any" 
                  class="stepper-input" 
                  data-id="${item.id}" 
                  value="${currentVal}"
                />
                <button class="stepper-btn btn-plus" data-id="${item.id}" aria-label="הוסף">+</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- כפתור שמירה צף -->
      ${modifiedCount > 0 ? `
        <button class="btn btn-primary btn-floating" id="btnSaveInventoryBatch">
          💾 שמור ועדכן ספירה (${modifiedCount} פריטים)
        </button>
      ` : ''}
    </div>
  `;

  // ================= EVENT LISTENERS =================

  // חיפוש
  const searchInput = container.querySelector("#inventorySearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      renderFieldInventory(container);
    });
  }

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
      val += 1;
      localCounts[id] = val;
      input.value = val;
      updateFloatingButton(container);
    });
  });

  container.querySelectorAll(".btn-minus").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const input = container.querySelector(`.stepper-input[data-id="${id}"]`);
      let val = Number(input.value) || 0;
      val = Math.max(0, val - 1);
      localCounts[id] = val;
      input.value = val;
      updateFloatingButton(container);
    });
  });

  // שינוי ידני באינפוט
  container.querySelectorAll(".stepper-input").forEach(input => {
    input.addEventListener("change", () => {
      const id = input.dataset.id;
      const val = Math.max(0, Number(input.value) || 0);
      localCounts[id] = val;
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
      alert("✅ ספירת המלאי נשמרה ועודכנה בהצלחה!");
    });
  }
}

function updateFloatingButton(container) {
  const modifiedCount = Object.keys(localCounts).length;
  let btn = container.querySelector("#btnSaveInventoryBatch");
  if (modifiedCount > 0) {
    if (!btn) {
      btn = document.createElement("button");
      btn.className = "btn btn-primary btn-floating";
      btn.id = "btnSaveInventoryBatch";
      btn.addEventListener("click", () => {
        store.saveCountsBatch(localCounts, "ישראל - שטח");
        localCounts = {};
        renderFieldInventory(container);
        alert("✅ ספירת המלאי נשמרה ועודכנה בהצלחה!");
      });
      container.querySelector(".field-view").appendChild(btn);
    }
    btn.innerHTML = `💾 שמור ועדכן ספירה (${modifiedCount} פריטים)`;
  } else if (btn) {
    btn.remove();
  }
}
