/**
 * Field Mode — Station Prep & Service Checklist View (צ'קליסט הכנות עמדה + מגירת מתכון)
 * Aesthetic: Swiss Kitchen Editorial (REQ-06, REQ-07, REQ-08, R11, R20, R21, R30, R46)
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
  const pendingTasks = filtered.filter(t => !t.doneToday);
  const remainingMinutes = pendingTasks.reduce((sum, t) => sum + (Number(t.estMinutes) || 0), 0);
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  container.innerHTML = `
    <div class="field-view">
      <!-- סרגל עליון לבחירת עמדה -->
      <div class="field-control-strip">
        <div class="field-section-header">
          <h1 class="field-section-title">הכנות וסרוויס לפי עמדות</h1>
          <span class="badge badge-unit">${selectedStation}</span>
        </div>

        <!-- פילטר עמדות (REQ-06, R20) -->
        <div class="filter-bar" role="tablist" aria-label="בחירת עמדת הכנה">
          ${stations.map(st => `
            <button type="button" class="filter-pill ${selectedStation === st ? 'active' : ''}" data-station="${st}" role="tab" aria-selected="${selectedStation === st}">
              ${st}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- כרטיס התקדמות עמדה ממוסגר (StationProgressCard - REQ-06) -->
      <div class="prep-progress-card">
        <div class="prep-progress-header">
          <div>
            <div class="prep-progress-title">${completed} מתוך ${total} הושלמו</div>
            <div style="font-size: 13px; color: var(--color-ink-secondary); margin-top: 2px;">
              קצב מוכנות עמדה לסרוויס (${pct}%)
            </div>
          </div>
          <span class="prep-time-stamp">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span>${remainingMinutes} דק' נותרו</span>
          </span>
        </div>
        <div class="progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-fill" style="width: ${pct}%;"></div>
        </div>
      </div>

      <!-- רשימת משימות שטוחה ללא קינון כרטיסים (PrepTaskRow - REQ-07, R46) -->
      <div class="prep-tasks-list">
        ${filtered.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div class="empty-state-title">אין משימות בעמדה זו</div>
            <div class="empty-state-desc">בחר עמדה אחרת בסרגל העליון כדי לצפות במשימות ההכנה שלה.</div>
          </div>
        ` : filtered.map(task => `
          <div class="prep-task-card ${task.doneToday ? 'done' : ''}" data-id="${task.id}">
            <!-- יעד לחיצה 48x48px לתיבת הסימון (R20) -->
            <div class="task-checkbox-hit" role="checkbox" aria-checked="${Boolean(task.doneToday)}" aria-label="סמן משימה ${task.prepItem}">
              <div class="task-checkbox">
                ${task.doneToday ? `
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ` : ''}
              </div>
            </div>

            <div class="task-info">
              <div class="task-name">${task.prepItem}</div>
              <div class="task-meta">
                <span class="badge-unit">${task.station}</span>
                <span>זמן ביצוע: <strong class="mono">${task.estMinutes}</strong> דק'</span>
                ${task.doneToday ? `<span class="badge badge-success"><span class="badge-dot"></span>הושלם</span>` : ''}
              </div>
              ${task.instructions ? `
                <div style="font-size: 13px; color: var(--color-ink-secondary); margin-top: 6px;">
                  ${task.instructions}
                </div>
              ` : ''}
            </div>

            ${task.linkedDishId ? `
              <button type="button" class="btn btn-secondary btn-recipe-modal" data-dish="${task.linkedDishId}" data-task="${task.id}" title="צפה במתכון הכנה המלא">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
                </svg>
                <span>מתכון</span>
              </button>
            ` : ''}
          </div>
        `).join('')}
      </div>

      <!-- כפתור פעולה ראשי יחיד בתחתית המסך (R11) -->
      ${pendingTasks.length > 0 ? `
        <div class="field-sticky-cta-bar">
          <button type="button" class="btn btn-primary btn-floating" id="btnCompleteStationPrep">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>סמן משימה הבאה כהושלמה (${pendingTasks[0].prepItem})</span>
          </button>
        </div>
      ` : ''}
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
      if (e.target.closest(".btn-recipe-modal")) return;
      const id = card.dataset.id;
      store.togglePrepTask(id);
      renderFieldPrep(container);
    });
  });

  // Primary CTA: complete next pending task
  container.querySelector("#btnCompleteStationPrep")?.addEventListener("click", () => {
    if (pendingTasks.length > 0) {
      store.togglePrepTask(pendingTasks[0].id);
      renderFieldPrep(container);
    }
  });

  // Recipe view Bottom Sheet (field-prep-sheet)
  container.querySelectorAll(".btn-recipe-modal").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const dishId = btn.dataset.dish;
      const taskId = btn.dataset.task;
      showRecipeModal(dishId, taskId, container);
    });
  });
}

function showRecipeModal(dishId, taskId, container) {
  const state = store.getState();
  const dish = (state.dishes || []).find(d => d.id === dishId);
  if (!dish) return;

  const task = (state.prepChecklist || []).find(t => t.id === taskId);
  const lines = (state.recipeLines || []).filter(l => l.parentDishId === dishId);

  // פיצול הוראות ההכנה לשלבים ממוספרים (REQ-08)
  const rawSteps = (dish.prepInstructions || task?.instructions || "שקול את כל המרכיבים לפי הטבלה. ערבב ואחסן בכלי גסטרונום מסומן עם תאריך.")
    .split(/\.\s+|\n+/)
    .map(s => s.trim())
    .filter(Boolean);

  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", `מתכון הכנה · ${dish.name}`);

  modal.innerHTML = `
    <div class="modal-box">
      <div class="sheet-drag-handle" aria-hidden="true"></div>
      <div class="modal-header">
        <div>
          <div style="font-size: 12px; font-weight: 700; color: var(--color-ink-secondary);">כרטיס מתכון הכנה ו-BOM</div>
          <h3 style="font-size: 20px; font-weight: 700; color: var(--color-ink-primary); margin-top: 2px;">${dish.name}</h3>
        </div>
        <button type="button" class="btn btn-secondary btn-close-modal" style="width: 48px; height: 48px; padding: 0;" aria-label="סגור מגירת מתכון">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <!-- סרגל מפרט אצווה ב-3 עמודות (REQ-08) -->
        <div class="recipe-specs-strip">
          <div class="recipe-spec-cell">
            <span class="recipe-spec-label">תפוקת אצווה</span>
            <span class="recipe-spec-value"><span class="mono">${dish.yieldPortions || 1}</span> מנות</span>
          </div>
          <div class="recipe-spec-cell">
            <span class="recipe-spec-label">זמן ביצוע</span>
            <span class="recipe-spec-value"><span class="mono">${task ? task.estMinutes : 15}</span> דק'</span>
          </div>
          <div class="recipe-spec-cell">
            <span class="recipe-spec-label">עמדת ייצור</span>
            <span class="recipe-spec-value">${task ? task.station : (dish.category || 'מטבח')}</span>
          </div>
        </div>

        <!-- טבלת מרכיבים מדויקת BOM (REQ-08) -->
        <div style="margin-bottom: 16px;">
          <div style="font-size: 14px; font-weight: 700; color: var(--color-ink-primary); margin-bottom: 8px;">
            מרכיבים וכמויות שקילה (BOM)
          </div>
          <div class="recipe-bom-list">
            ${lines.length === 0 ? `
              <div class="recipe-bom-row">
                <span class="recipe-bom-name">לפי כרטיס עבודה בעמדה</span>
                <span class="badge-unit">1 יח'</span>
              </div>
            ` : lines.map(line => {
              let name = line.componentId;
              if (line.componentType === "RAW_ITEM") {
                const itm = (state.catalog || []).find(c => c.id === line.componentId);
                if (itm) name = itm.name;
              } else {
                const sub = (state.dishes || []).find(d => d.id === line.componentId);
                if (sub) name = sub.name;
              }
              return `
                <div class="recipe-bom-row">
                  <span class="recipe-bom-name">${name}</span>
                  <div style="display: inline-flex; align-items: center; gap: 8px;">
                    <span class="recipe-bom-qty mono">${line.quantity}</span>
                    <span class="badge-unit">${line.unit}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- שלבי הכנה ממוספרים (REQ-08) -->
        <div>
          <div style="font-size: 14px; font-weight: 700; color: var(--color-ink-primary); margin-bottom: 8px;">
            שלבי הכנה וביצוע
          </div>
          ${rawSteps.map((stepText, idx) => `
            <div class="recipe-step-row">
              <span class="recipe-step-num">${idx + 1}</span>
              <div style="font-size: 16px; line-height: 1.45; color: var(--color-ink-primary); font-weight: 500;">
                ${stepText}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-primary" id="btnCompleteFromSheet" style="width: 100%; min-height: 52px; font-size: 16px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>${task && task.doneToday ? 'סגור כרטיס מתכון' : 'סמן הכנה כהושלמה'}</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    modal.remove();
  };

  modal.querySelectorAll(".btn-close-modal").forEach(b => {
    b.addEventListener("click", closeModal);
  });

  modal.querySelector("#btnCompleteFromSheet")?.addEventListener("click", () => {
    if (task && !task.doneToday) {
      store.togglePrepTask(task.id);
      if (container) renderFieldPrep(container);
    }
    closeModal();
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
}
