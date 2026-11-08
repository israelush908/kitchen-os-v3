/**
 * Office Mode — Recipe Studio & Food Cost Master-Detail View (סטודיו מתכונים ופוד-קוסט)
 */

import { store } from "../store.js";
import { CalculationService } from "../services/calculationService.js";

let selectedDishId = "DSH-01";
let selectedTab = "ALL"; // ALL | MENU_ITEM | SUB_RECIPE
let searchQuery = "";

export function renderOfficeStudio(container) {
  const state = store.getState();
  const config = state.config;

  const dishes = state.dishes.filter(d => {
    const matchesTab = selectedTab === "ALL" || d.dishType === selectedTab;
    const matchesSearch = !searchQuery || d.name.includes(searchQuery);
    return matchesTab && matchesSearch;
  });

  if (!selectedDishId && dishes.length > 0) {
    selectedDishId = dishes[0].id;
  }

  const selectedDish = state.dishes.find(d => d.id === selectedDishId) || dishes[0];
  const recipeLines = selectedDish ? state.recipeLines.filter(l => l.parentDishId === selectedDish.id) : [];

  // חישוב נתוני המנה הנבחרת
  let totalRecipeCost = 0;
  let portionCost = 0;
  let priceExclVat = 0;
  let fcPct = 0;
  let profit = 0;
  let matrixClassification = null;

  if (selectedDish) {
    totalRecipeCost = CalculationService.calculateDishCost(
      selectedDish.id,
      state.dishes,
      state.recipeLines,
      state.catalog
    );
    const portions = Number(selectedDish.yieldPortions) || 1;
    portionCost = portions > 0 ? (totalRecipeCost / portions) : 0;
    priceExclVat = CalculationService.calculatePriceExclVat(selectedDish.priceInclVat, config.vatRate);
    fcPct = CalculationService.calculateFoodCostPct(portionCost, priceExclVat);
    profit = CalculationService.calculateGrossProfit(priceExclVat, portionCost);
    matrixClassification = CalculationService.classifyMenuMatrix(
      fcPct,
      config.targetFoodCost,
      selectedDish.weeklySalesQty || 35
    );
  }

  container.innerHTML = `
    <div class="office-studio">
      <div style="margin-bottom: var(--space-md); display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 style="font-size: 22px; font-weight: 700;">🍽️ סטודיו מתכונים ופוד-קוסט (Master-Detail)</h1>
          <p style="font-size: 13px; color: var(--color-text-dim);">
            בניית עץ מרכיבים (BOM), חישוב מתכוני הכנה מדורגים ובקרת רווחיות מנות בזמן אמת.
          </p>
        </div>
        <button class="btn btn-primary" id="btnCreateNewDish">
          ➕ הוסף מנה / מתכון הכנה חדש
        </button>
      </div>

      <div class="studio-layout">
        <!-- פאנל ימני: Master (רשימת מנות) -->
        <div class="studio-master">
          <!-- חיפוש וטאבים -->
          <div style="padding: var(--space-md); border-bottom: 1px solid var(--color-border-subtle);">
            <input 
              type="text" 
              class="form-input" 
              id="studioSearchInput" 
              placeholder="חפש מנה או מתכון..." 
              value="${searchQuery}"
              style="margin-bottom: var(--space-xs); font-size: 13px;"
            />
            <div style="display: flex; gap: 4px;">
              <button class="filter-pill ${selectedTab === 'ALL' ? 'active' : ''}" data-tab="ALL" style="flex: 1; padding: 4px; font-size: 11px;">הכל</button>
              <button class="filter-pill ${selectedTab === 'MENU_ITEM' ? 'active' : ''}" data-tab="MENU_ITEM" style="flex: 1; padding: 4px; font-size: 11px;">מנות תפריט</button>
              <button class="filter-pill ${selectedTab === 'SUB_RECIPE' ? 'active' : ''}" data-tab="SUB_RECIPE" style="flex: 1; padding: 4px; font-size: 11px;">מתכוני הכנה</button>
            </div>
          </div>

          <!-- רשימת פריטים נגללת -->
          <div style="flex: 1; overflow-y: auto;">
            ${dishes.map(d => {
              const dCost = CalculationService.calculateDishCost(d.id, state.dishes, state.recipeLines, state.catalog);
              const dPortions = Number(d.yieldPortions) || 1;
              const dPortionCost = dPortions > 0 ? (dCost / dPortions) : 0;
              const dPriceNet = CalculationService.calculatePriceExclVat(d.priceInclVat, config.vatRate);
              const dFc = CalculationService.calculateFoodCostPct(dPortionCost, dPriceNet);

              return `
                <div class="dish-list-item ${d.id === selectedDishId ? 'active' : ''}" data-id="${d.id}">
                  <div>
                    <div style="font-weight: 600; font-size: 14px;">${d.name}</div>
                    <div style="font-size: 11px; color: var(--color-text-dim); margin-top: 2px;">
                      <span>${d.dishType === 'MENU_ITEM' ? 'מנת תפריט' : 'מתכון הכנה'}</span>
                      <span>•</span>
                      <span>עלות מנה: ₪${dPortionCost.toFixed(2)}</span>
                    </div>
                  </div>
                  <div style="text-align: left;">
                    ${d.dishType === 'MENU_ITEM' ? `
                      <span class="badge ${dFc > 0.30 ? 'badge-danger' : 'badge-success'}">
                        ${(dFc * 100).toFixed(0)}%
                      </span>
                    ` : `
                      <span class="badge badge-gray">${d.yieldPortions} מנות</span>
                    `}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- פאנל שמאלי: Detail (עריכת מנה ומרכיבים) -->
        <div class="studio-detail">
          ${!selectedDish ? `
            <div class="empty-state">
              <div class="empty-state-title">בחר מנה לצפייה ועריכה</div>
            </div>
          ` : `
            <div>
              <!-- כותרת מנה ומדדים מהירים -->
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-lg); border-bottom: 1px solid var(--color-border-subtle); padding-bottom: var(--space-md);">
                <div>
                  <div style="display: flex; align-items: center; gap: var(--space-sm);">
                    <h2 style="font-size: 20px; font-weight: 700;">${selectedDish.name}</h2>
                    <span class="badge ${selectedDish.dishType === 'MENU_ITEM' ? 'badge-wine' : 'badge-gray'}">
                      ${selectedDish.dishType === 'MENU_ITEM' ? 'מנת תפריט' : 'מתכון הכנה'}
                    </span>
                    ${matrixClassification && selectedDish.dishType === 'MENU_ITEM' ? `
                      <span class="badge ${matrixClassification.class}" title="${matrixClassification.desc}">
                        ${matrixClassification.icon} ${matrixClassification.label}
                      </span>
                    ` : ''}
                  </div>
                  <div style="font-size: 12px; color: var(--color-text-dim); margin-top: 4px;">
                    קטגוריה: <strong>${selectedDish.category}</strong> | תפוקת מתכון: <strong>${selectedDish.yieldPortions} מנות</strong>
                  </div>
                </div>

                <div style="display: flex; gap: var(--space-xs);">
                  <button class="btn btn-secondary" id="btnEditDishMeta" style="font-size: 12px;">✏️ ערוך פרטים</button>
                  <button class="btn btn-danger" id="btnDeleteDish" style="font-size: 12px;">🗑️ מחק מנה</button>
                </div>
              </div>

              <!-- 4 קלפי מדדים כספיים -->
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-sm); margin-bottom: var(--space-lg);">
                <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; border: 1px solid var(--color-border-subtle);">
                  <div style="font-size: 11px; color: var(--color-text-dim);">עלות כוללת של המתכון</div>
                  <div style="font-size: 20px; font-weight: 700; color: var(--color-text-primary);">₪${totalRecipeCost.toFixed(2)}</div>
                </div>

                <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; border: 1px solid var(--color-border-subtle);">
                  <div style="font-size: 11px; color: var(--color-text-dim);">עלות למנה בודדת</div>
                  <div style="font-size: 20px; font-weight: 700; color: var(--color-accent-primary);">₪${portionCost.toFixed(2)}</div>
                </div>

                <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; border: 1px solid var(--color-border-subtle);">
                  <div style="font-size: 11px; color: var(--color-text-dim);">מחיר נטו לצרכן (ללא מע"מ)</div>
                  <div style="font-size: 20px; font-weight: 700; color: var(--color-text-primary);">
                    ${selectedDish.dishType === 'MENU_ITEM' ? `₪${priceExclVat.toFixed(2)}` : '—'}
                  </div>
                </div>

                <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; border: 1px solid var(--color-border-subtle);">
                  <div style="font-size: 11px; color: var(--color-text-dim);">פוד-קוסט % (יעד 30%)</div>
                  <div style="font-size: 20px; font-weight: 700; color: ${fcPct > 0.30 ? 'var(--color-danger)' : 'var(--status-success)'};">
                    ${selectedDish.dishType === 'MENU_ITEM' ? `${(fcPct * 100).toFixed(1)}%` : '—'}
                  </div>
                </div>
              </div>

              <!-- טבלת מרכיבים (Bill of Materials) -->
              <div class="bom-card">
                <div class="bom-header">
                  <span>עץ מרכיבים ועלויות (Bill of Materials)</span>
                  <button class="btn btn-primary" id="btnAddIngredientBtn" style="min-height: 32px; padding: 4px 12px; font-size: 12px;">
                    ➕ הוסף מרכיב
                  </button>
                </div>

                <table class="data-table">
                  <thead>
                    <tr>
                      <th>סוג</th>
                      <th>שם מרכיב</th>
                      <th>כמות במתכון</th>
                      <th>יחידה</th>
                      <th>עלות אפקטיבית ליחידה</th>
                      <th>סך עלות שורה ₪</th>
                      <th style="width: 50px;"></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${recipeLines.length === 0 ? `
                      <tr>
                        <td colspan="7" style="text-align: center; color: var(--color-text-dim); padding: 20px;">
                          אין מרכיבים מוגדרים למתכון זה. לחץ על "הוסף מרכיב" כדי להתחיל.
                        </td>
                      </tr>
                    ` : recipeLines.map(line => {
                      let compName = line.componentId;
                      let unitCost = 0;
                      let isSub = line.componentType === "SUB_RECIPE";

                      if (line.componentType === "RAW_ITEM") {
                        const raw = state.catalog.find(c => c.id === line.componentId);
                        if (raw) {
                          compName = raw.name;
                          unitCost = CalculationService.calculateEffectiveCost(raw.unitCostExclVat, raw.yieldLossPct);
                        }
                      } else {
                        const sub = state.dishes.find(d => d.id === line.componentId);
                        if (sub) {
                          compName = sub.name;
                          const subCost = CalculationService.calculateDishCost(sub.id, state.dishes, state.recipeLines, state.catalog);
                          unitCost = Number(sub.yieldPortions) > 0 ? (subCost / sub.yieldPortions) : 0;
                        }
                      }

                      const lineCost = (Number(line.quantity) || 0) * unitCost;

                      return `
                        <tr>
                          <td>
                            <span class="badge ${isSub ? 'badge-wine' : 'badge-gray'}">
                              ${isSub ? 'מתכון הכנה' : 'חומר גלם'}
                            </span>
                          </td>
                          <td><strong>${compName}</strong></td>
                          <td><strong>${line.quantity}</strong></td>
                          <td>${line.unit}</td>
                          <td>₪${unitCost.toFixed(2)}</td>
                          <td style="font-weight: 600;">₪${lineCost.toFixed(2)}</td>
                          <td>
                            <button class="btn btn-danger btn-delete-line" data-id="${line.id}" style="min-height: 28px; padding: 2px 8px; font-size: 11px;">
                              ✕
                            </button>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>

              <!-- הוראות הכנה -->
              ${selectedDish.prepInstructions ? `
                <div style="margin-top: var(--space-md); background: var(--color-bg-overlay); padding: 14px; border-radius: 8px; border: 1px solid var(--color-border-subtle);">
                  <h4 style="font-size: 13px; font-weight: 700; margin-bottom: 6px;">הוראות ביצוע וקיצוץ:</h4>
                  <p style="font-size: 13px; line-height: 1.6;">${selectedDish.prepInstructions}</p>
                </div>
              ` : ''}
            </div>
          `}
        </div>
      </div>
    </div>
  `;

  // Search input
  container.querySelector("#studioSearchInput")?.addEventListener("input", (e) => {
    searchQuery = e.target.value.trim();
    renderOfficeStudio(container);
  });

  // Tab buttons
  container.querySelectorAll(".filter-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedTab = btn.dataset.tab;
      renderOfficeStudio(container);
    });
  });

  // Select dish item
  container.querySelectorAll(".dish-list-item").forEach(item => {
    item.addEventListener("click", () => {
      selectedDishId = item.dataset.id;
      renderOfficeStudio(container);
    });
  });

  // Delete line
  container.querySelectorAll(".btn-delete-line").forEach(btn => {
    btn.addEventListener("click", () => {
      const lineId = btn.dataset.id;
      if (confirm("האם למחוק מרכיב זה מהמתכון?")) {
        store.deleteRecipeLine(lineId);
        renderOfficeStudio(container);
      }
    });
  });

  // Delete dish
  container.querySelector("#btnDeleteDish")?.addEventListener("click", () => {
    if (confirm(`האם למחוק את המנה "${selectedDish.name}" וכל מרכיביה?`)) {
      store.deleteDish(selectedDish.id);
      selectedDishId = "";
      renderOfficeStudio(container);
    }
  });

  // Add ingredient modal
  container.querySelector("#btnAddIngredientBtn")?.addEventListener("click", () => {
    showAddIngredientModal(selectedDish.id, container);
  });

  // Create new dish modal
  container.querySelector("#btnCreateNewDish")?.addEventListener("click", () => {
    showCreateDishModal(container);
  });

  // Edit dish meta modal
  container.querySelector("#btnEditDishMeta")?.addEventListener("click", () => {
    showEditDishModal(selectedDish, container);
  });
}

function showAddIngredientModal(parentDishId, container) {
  const state = store.getState();
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3 style="font-size: 16px; font-weight: 700;">➕ הוספת מרכיב למתכון</h3>
        <button class="btn btn-secondary btn-close-modal">✕</button>
      </div>
      <form id="addIngredientForm">
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">סוג מרכיב</label>
            <select class="form-select" id="compTypeSelect">
              <option value="RAW_ITEM">חומר גלם מקטלוג</option>
              <option value="SUB_RECIPE">מתכון הכנה (Sub-Recipe)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">בחר מרכיב</label>
            <select class="form-select" id="compItemSelect">
              ${state.catalog.map(c => `<option value="${c.id}" data-unit="${c.stockUnit}">${c.name} (${c.stockUnit})</option>`).join('')}
            </select>
          </div>

          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: var(--space-sm);">
            <div class="form-group">
              <label class="form-label">כמות במתכון</label>
              <input type="number" step="any" class="form-input" id="compQtyInput" value="1" required />
            </div>
            <div class="form-group">
              <label class="form-label">יחידה</label>
              <input type="text" class="form-input" id="compUnitInput" value="${state.catalog[0]?.stockUnit || 'ק\"ג'}" required />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary btn-close-modal">ביטול</button>
          <button type="submit" class="btn btn-primary">שמור והוסף</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const typeSelect = modal.querySelector("#compTypeSelect");
  const itemSelect = modal.querySelector("#compItemSelect");
  const unitInput = modal.querySelector("#compUnitInput");

  typeSelect.addEventListener("change", () => {
    const isRaw = typeSelect.value === "RAW_ITEM";
    if (isRaw) {
      itemSelect.innerHTML = state.catalog.map(c => `<option value="${c.id}" data-unit="${c.stockUnit}">${c.name} (${c.stockUnit})</option>`).join('');
      unitInput.value = state.catalog[0]?.stockUnit || "ק\"ג";
    } else {
      const subs = state.dishes.filter(d => d.dishType === "SUB_RECIPE" && d.id !== parentDishId);
      itemSelect.innerHTML = subs.map(s => `<option value="${s.id}" data-unit="מנה">${s.name} (מנה)</option>`).join('');
      unitInput.value = "מנה";
    }
  });

  itemSelect.addEventListener("change", () => {
    const opt = itemSelect.options[itemSelect.selectedIndex];
    if (opt) unitInput.value = opt.dataset.unit || "ק\"ג";
  });

  modal.querySelectorAll(".btn-close-modal").forEach(b => b.addEventListener("click", () => modal.remove()));

  modal.querySelector("#addIngredientForm").addEventListener("submit", (e) => {
    e.preventDefault();
    store.saveRecipeLine({
      parentDishId,
      componentType: typeSelect.value,
      componentId: itemSelect.value,
      quantity: Number(modal.querySelector("#compQtyInput").value) || 0,
      unit: unitInput.value
    });
    modal.remove();
    renderOfficeStudio(container);
  });
}

function showCreateDishModal(container) {
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3 style="font-size: 16px; font-weight: 700;">➕ יצירת מנה או מתכון הכנה חדש</h3>
        <button class="btn btn-secondary btn-close-modal">✕</button>
      </div>
      <form id="createDishForm">
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">שם המנה / המתכון</label>
            <input type="text" class="form-input" id="newDishName" placeholder="למשל: ברוסקטה סלמון מעושן" required />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm);">
            <div class="form-group">
              <label class="form-label">סוג</label>
              <select class="form-select" id="newDishType">
                <option value="MENU_ITEM">מנת תפריט לצרכן</option>
                <option value="SUB_RECIPE">מתכון הכנה (רכיב למנות)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">קטגוריה</label>
              <input type="text" class="form-input" id="newDishCategory" placeholder="פלטות / סלטים / רטבים" required />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm);">
            <div class="form-group">
              <label class="form-label">מספר מנות בתפוקה (Yield)</label>
              <input type="number" step="1" class="form-input" id="newDishPortions" value="1" required />
            </div>
            <div class="form-group">
              <label class="form-label">מחיר לצרכן כולל מע"מ (₪)</label>
              <input type="number" step="any" class="form-input" id="newDishPrice" value="0" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">הנחיות הכנה וקיצוץ</label>
            <textarea class="form-textarea" id="newDishInstructions" rows="3" placeholder="הוראות הרכבה..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary btn-close-modal">ביטול</button>
          <button type="submit" class="btn btn-primary">צור מנה והמשך לעץ מרכיבים</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelectorAll(".btn-close-modal").forEach(b => b.addEventListener("click", () => modal.remove()));

  modal.querySelector("#createDishForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const created = store.saveDish({
      name: modal.querySelector("#newDishName").value,
      dishType: modal.querySelector("#newDishType").value,
      category: modal.querySelector("#newDishCategory").value,
      yieldPortions: Number(modal.querySelector("#newDishPortions").value) || 1,
      priceInclVat: Number(modal.querySelector("#newDishPrice").value) || 0,
      prepInstructions: modal.querySelector("#newDishInstructions").value
    });
    modal.remove();
    selectedDishId = created.id;
    renderOfficeStudio(container);
  });
}

function showEditDishModal(dish, container) {
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3 style="font-size: 16px; font-weight: 700;">✏️ עריכת מנה: ${dish.name}</h3>
        <button class="btn btn-secondary btn-close-modal">✕</button>
      </div>
      <form id="editDishForm">
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">שם המנה / המתכון</label>
            <input type="text" class="form-input" id="editDishName" value="${dish.name}" required />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm);">
            <div class="form-group">
              <label class="form-label">תפוקת מנות (Yield)</label>
              <input type="number" step="1" class="form-input" id="editDishPortions" value="${dish.yieldPortions}" required />
            </div>
            <div class="form-group">
              <label class="form-label">מחיר לצרכן כולל מע"מ (₪)</label>
              <input type="number" step="any" class="form-input" id="editDishPrice" value="${dish.priceInclVat}" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">הנחיות הכנה וקיצוץ</label>
            <textarea class="form-textarea" id="editDishInstructions" rows="3">${dish.prepInstructions || ''}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary btn-close-modal">ביטול</button>
          <button type="submit" class="btn btn-primary">שמור שינויים</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelectorAll(".btn-close-modal").forEach(b => b.addEventListener("click", () => modal.remove()));

  modal.querySelector("#editDishForm").addEventListener("submit", (e) => {
    e.preventDefault();
    store.saveDish({
      ...dish,
      name: modal.querySelector("#editDishName").value,
      yieldPortions: Number(modal.querySelector("#editDishPortions").value) || 1,
      priceInclVat: Number(modal.querySelector("#editDishPrice").value) || 0,
      prepInstructions: modal.querySelector("#editDishInstructions").value
    });
    modal.remove();
    renderOfficeStudio(container);
  });
}
