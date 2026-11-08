/**
 * Field Mode — Station Prep & Service Checklist View (צ'קליסט הכנות עמדה)
 */

import { store } from "../store.js";

let selectedStation = "הכל";

export function renderFieldPrep(container) {
  const state = store.getState();
  const tasks = state.prepChecklist || [];

  const stations = ["הכל", "פלטות וגבינות", "ברוסקטות וסלטים", "הכנות קרות", "כללי"];

  const filtered = tasks.filter(t => {
    return selectedStation === "הכל" || t.station === selectedStation;
  });

  const total = filtered.length;
  const completed = filtered.filter(t => t.doneToday).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  container.innerHTML = `
    <div class="field-view">
      <!-- כרטיס התקדמות יומי -->
      <div class="prep-progress-card">
        <div class="prep-progress-header">
          <span style="font-weight: 600; font-size: 14px;">התקדמות הכנות להיום</span>
          <span class="badge" style="background: rgba(255,255,255,0.2); color: #fff;">${completed}/${total} (${pct}%)</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${pct}%;"></div>
        </div>
      </div>

      <!-- פילטר עמדות -->
      <div class="filter-bar">
        ${stations.map(st => `
          <button class="filter-pill ${selectedStation === st ? 'active' : ''}" data-station="${st}">
            ${st}
          </button>
        `).join('')}
      </div>

      <!-- רשימת משימות -->
      <div class="prep-tasks-list">
        ${filtered.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">🎉</div>
            <div class="empty-state-title">אין משימות בעמדה זו</div>
          </div>
        ` : filtered.map(task => `
          <div class="prep-task-card ${task.doneToday ? 'done' : ''}" data-id="${task.id}">
            <div class="task-checkbox">
              ${task.doneToday ? '✓' : ''}
            </div>
            <div style="flex: 1;">
              <div class="task-name" style="font-size: 15px; font-weight: 600;">${task.prepItem}</div>
              <div style="font-size: 12px; color: var(--color-text-dim); margin-top: 2px;">
                <span>עמדה: <strong>${task.station}</strong></span>
                <span>•</span>
                <span>זמן משוער: <strong>${task.estMinutes} דק'</strong></span>
              </div>
              ${task.instructions ? `
                <div style="font-size: 11px; color: var(--color-text-secondary); margin-top: 4px; background: rgba(0,0,0,0.03); padding: 4px 8px; border-radius: 4px;">
                  💡 ${task.instructions}
                </div>
              ` : ''}
            </div>
            ${task.linkedDishId ? `
              <button class="btn btn-secondary btn-recipe-modal" data-dish="${task.linkedDishId}" style="padding: 4px 8px; font-size: 11px; height: 32px;" title="צפה במתכון המלא">
                📖 מתכון
              </button>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Filter clicks
  container.querySelectorAll(".filter-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedStation = btn.dataset.station;
      renderFieldPrep(container);
    });
  });

  // Toggle tasks
  container.querySelectorAll(".prep-task-card").forEach(card => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".btn-recipe-modal")) return; // Don't toggle on recipe button
      const id = card.dataset.id;
      store.togglePrepTask(id);
      renderFieldPrep(container);
    });
  });

  // Recipe view modal
  container.querySelectorAll(".btn-recipe-modal").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const dishId = btn.dataset.dish;
      showRecipeModal(dishId);
    });
  });
}

function showRecipeModal(dishId) {
  const state = store.getState();
  const dish = state.dishes.find(d => d.id === dishId);
  if (!dish) return;

  const lines = state.recipeLines.filter(l => l.parentDishId === dishId);

  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3 style="font-size: 16px; font-weight: 700;">📖 ${dish.name}</h3>
        <button class="btn btn-secondary btn-close-modal" style="min-height: 32px; padding: 4px 10px;">✕</button>
      </div>
      <div class="modal-body">
        <div style="margin-bottom: var(--space-md);">
          <div style="font-size: 13px; color: var(--color-text-dim); margin-bottom: 6px;">מרכיבים וכמויות למתכון (${dish.yieldPortions} מנות):</div>
          <table class="data-table" style="font-size: 12px;">
            <thead>
              <tr>
                <th>מרכיב</th>
                <th>כמות</th>
                <th>יחידה</th>
              </tr>
            </thead>
            <tbody>
              ${lines.map(line => {
                let name = line.componentId;
                if (line.componentType === "RAW_ITEM") {
                  const itm = state.catalog.find(c => c.id === line.componentId);
                  if (itm) name = itm.name;
                } else {
                  const sub = state.dishes.find(d => d.id === line.componentId);
                  if (sub) name = sub.name;
                }
                return `
                  <tr>
                    <td>${name}</td>
                    <td><strong>${line.quantity}</strong></td>
                    <td>${line.unit}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        ${dish.prepInstructions ? `
          <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; border: 1px solid var(--color-border-subtle);">
            <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px;">הוראות ביצוע:</div>
            <div style="font-size: 13px; line-height: 1.5;">${dish.prepInstructions}</div>
          </div>
        ` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary btn-close-modal">הבנתי, סגור</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelectorAll(".btn-close-modal").forEach(b => {
    b.addEventListener("click", () => modal.remove());
  });
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}
