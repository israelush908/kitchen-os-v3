/**
 * Office Mode — Prep Bank & Station Checklists Manager (ניהול בנק ההכנות והצ'קליסטים במשרד)
 * Allows creating, editing, deleting, linking recipes, and resetting daily station prep tasks.
 */

import { store } from "../store.js";

let selectedStationFilter = "הכל";
let searchQuery = "";

const DEFAULT_STATIONS = [
  "פלטות וגבינות",
  "ברוסקטות וסלטים",
  "הכנות קרות",
  "כללי"
];

export function renderOfficePrepManager(container) {
  const state = store.getState();
  const tasks = state.prepChecklist || [];
  const dishes = state.dishes || [];

  // Build unique stations list
  const stationsSet = new Set([...DEFAULT_STATIONS, ...tasks.map(t => t.station).filter(Boolean)]);
  const stations = ["הכל", ...stationsSet];

  const filteredTasks = tasks.filter(t => {
    const matchStation = selectedStationFilter === "הכל" || t.station === selectedStationFilter;
    const matchSearch = !searchQuery ||
      t.prepItem.includes(searchQuery) ||
      (t.instructions && t.instructions.includes(searchQuery)) ||
      (t.station && t.station.includes(searchQuery));
    return matchStation && matchSearch;
  });

  // KPI metrics
  const totalTasks = tasks.length;
  const doneCount = tasks.filter(t => t.doneToday).length;
  const completionPct = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;
  const totalEstMinutes = filteredTasks.reduce((sum, t) => sum + (Number(t.estMinutes) || 0), 0);
  const remainingMinutes = filteredTasks.filter(t => !t.doneToday).reduce((sum, t) => sum + (Number(t.estMinutes) || 0), 0);

  container.innerHTML = `
    <div class="office-prep-manager">
      <!-- כותרת ראשית ופעולות מהירות -->
      <div style="margin-bottom: var(--space-md); display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="font-size: 22px; font-weight: 700;">🔪 ניהול בנק ההכנות והצ'קליסטים לעמדות</h1>
          <p style="font-size: 13px; color: var(--color-text-dim);">
            הגדרת משימות הכנה קבועות לפי פסים ועמדות, קישור ישיר למתכונים ואיפוס משמרת יומי בלחיצה.
          </p>
        </div>

        <div style="display: flex; gap: var(--space-xs);">
          <button class="btn btn-secondary" id="btnResetPrepDay" title="מאפס את כל הסימונים של היום להתחלת יום עבודה חדש">
            🌅 איפוס יום חדש (נקה סימונים)
          </button>
          <button class="btn btn-secondary" id="btnMarkAllPrepDone">
            ✅ סמן הכל כבוצע
          </button>
          <button class="btn btn-primary" id="btnAddPrepTask">
            ➕ הוסף משימת הכנה לבנק
          </button>
        </div>
      </div>

      <!-- 3 כרטיסי מדדים -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-md); margin-bottom: var(--space-lg);">
        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-title">סטטוס ביצוע הכנות להיום</span>
            <span class="kpi-icon">📋</span>
          </div>
          <div class="kpi-value">${doneCount} / ${totalTasks} (${completionPct}%)</div>
          <div class="kpi-footer">
            <span class="badge ${completionPct === 100 ? 'badge-success' : 'badge-wine'}">
              ${completionPct === 100 ? 'כל ההכנות הושלמו 🎉' : `${totalTasks - doneCount} משימות פתוחות בשטח`}
            </span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-title">נפח זמן הכנות משוער (לסינון הנוכחי)</span>
            <span class="kpi-icon">⏱️</span>
          </div>
          <div class="kpi-value">${totalEstMinutes} דק'</div>
          <div class="kpi-footer">נותרו לביצוע היום: <strong>${remainingMinutes} דקות</strong> (${(remainingMinutes / 60).toFixed(1)} שעות)</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-title">עמדות פעילות במטבח</span>
            <span class="kpi-icon">🔪</span>
          </div>
          <div class="kpi-value">${stationsSet.size} פסים</div>
          <div class="kpi-footer">מסונכרן בזמן אמת מול מסך "הכנות וסרוויס" בשטח</div>
        </div>
      </div>

      <!-- סרגל סינון עמדות וחיפוש -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md); gap: var(--space-md);">
        <div style="display: flex; gap: var(--space-xs); flex-wrap: wrap;">
          ${stations.map(st => {
            const count = st === "הכל" ? tasks.length : tasks.filter(t => t.station === st).length;
            return `
              <button class="filter-pill ${selectedStationFilter === st ? 'active' : ''}" data-station="${st}">
                ${st} (${count})
              </button>
            `;
          }).join('')}
        </div>

        <input
          type="text"
          class="form-input"
          id="prepBankSearchInput"
          placeholder="חפש משימת הכנה או הוראה..."
          value="${searchQuery}"
          style="max-width: 280px;"
        />
      </div>

      <!-- טבלת בנק ההכנות -->
      <div class="card">
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 60px;">בוצע היום</th>
                <th>מזהה</th>
                <th>פס / עמדה</th>
                <th>משימת הכנה</th>
                <th>תדירות</th>
                <th>זמן תקן</th>
                <th>מתכון מקושר</th>
                <th>הנחיות ביצוע לעובד פס</th>
                <th style="width: 120px;">פעולות</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTasks.length === 0 ? `
                <tr>
                  <td colspan="9" style="text-align: center; padding: 28px; color: var(--color-text-dim);">
                    לא נמצאו משימות הכנה בעמדה זו. לחץ על "➕ הוסף משימת הכנה לבנק" ליצירה.
                  </td>
                </tr>
              ` : filteredTasks.map(task => {
                const linkedDish = dishes.find(d => d.id === task.linkedDishId);
                return `
                  <tr style="${task.doneToday ? 'background: #f8fafc;' : ''}">
                    <td style="text-align: center;">
                      <input
                        type="checkbox"
                        class="prep-bank-toggle-cb"
                        data-id="${task.id}"
                        ${task.doneToday ? 'checked' : ''}
                        style="width: 18px; height: 18px; cursor: pointer;"
                      />
                    </td>
                    <td class="mono" style="font-size: 11px; color: var(--color-text-dim);">${task.id}</td>
                    <td><span class="badge badge-wine">${task.station}</span></td>
                    <td style="${task.doneToday ? 'text-decoration: line-through; color: var(--color-text-dim);' : 'font-weight: 700;'}">
                      ${task.prepItem}
                    </td>
                    <td><span class="badge badge-gray">${task.frequency || 'יומי'}</span></td>
                    <td class="mono"><strong>${task.estMinutes}</strong> דק'</td>
                    <td>
                      ${linkedDish ? `
                        <span class="badge badge-success" title="מקושר למתכון בסטודיו">📖 ${linkedDish.name}</span>
                      ` : '<span style="color: var(--color-text-dim); font-size: 11px;">ללא קישור</span>'}
                    </td>
                    <td style="font-size: 12px; color: var(--color-text-secondary); max-width: 320px;">
                      ${task.instructions || '—'}
                    </td>
                    <td>
                      <div style="display: flex; gap: 4px;">
                        <button class="btn btn-secondary btn-edit-prep" data-id="${task.id}" style="min-height: 28px; padding: 2px 8px; font-size: 11px;">
                          ✏️ ערוך
                        </button>
                        <button class="btn btn-danger btn-delete-prep" data-id="${task.id}" style="min-height: 28px; padding: 2px 8px; font-size: 11px;">
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Station filter clicks
  container.querySelectorAll(".filter-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedStationFilter = btn.dataset.station;
      renderOfficePrepManager(container);
    });
  });

  // Search input
  container.querySelector("#prepBankSearchInput")?.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderOfficePrepManager(container);
  });

  // Toggle individual task done status
  container.querySelectorAll(".prep-bank-toggle-cb").forEach(cb => {
    cb.addEventListener("change", () => {
      store.togglePrepTask(cb.dataset.id);
      renderOfficePrepManager(container);
    });
  });

  // Reset day button
  container.querySelector("#btnResetPrepDay")?.addEventListener("click", () => {
    const scopeLabel = selectedStationFilter === "הכל" ? "כל העמדות" : `עמדת "${selectedStationFilter}"`;
    if (confirm(`האם לאפס את סימוני הביצוע עבור ${scopeLabel} לקראת יום עבודה חדש?`)) {
      store.resetAllPrepTasks(selectedStationFilter);
      renderOfficePrepManager(container);
    }
  });

  // Mark all done button
  container.querySelector("#btnMarkAllPrepDone")?.addEventListener("click", () => {
    store.markAllPrepTasksDone(selectedStationFilter);
    renderOfficePrepManager(container);
  });

  // Add new prep task
  container.querySelector("#btnAddPrepTask")?.addEventListener("click", () => {
    showPrepTaskModal(null, container, stations.filter(s => s !== "הכל"));
  });

  // Edit prep task
  container.querySelectorAll(".btn-edit-prep").forEach(btn => {
    btn.addEventListener("click", () => {
      const task = tasks.find(t => t.id === btn.dataset.id);
      if (task) showPrepTaskModal(task, container, stations.filter(s => s !== "הכל"));
    });
  });

  // Delete prep task
  container.querySelectorAll(".btn-delete-prep").forEach(btn => {
    btn.addEventListener("click", () => {
      const task = tasks.find(t => t.id === btn.dataset.id);
      if (!task) return;
      if (confirm(`האם למחוק את משימת ההכנה "${task.prepItem}" מבנק ההכנות?`)) {
        store.deletePrepTask(task.id);
        renderOfficePrepManager(container);
      }
    });
  });
}

function showPrepTaskModal(task, container, existingStations) {
  const state = store.getState();
  const isEdit = !!task;

  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3 style="font-size: 16px; font-weight: 700;">
          ${isEdit ? `✏️ עריכת משימת הכנה: ${task.prepItem}` : `➕ הוספת משימת הכנה חדשה לבנק`}
        </h3>
        <button class="btn btn-secondary btn-close-modal">✕</button>
      </div>
      <form id="prepTaskForm">
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">שם משימת ההכנה</label>
            <input type="text" class="form-input" id="modalPrepItem" value="${task ? task.prepItem : ''}" placeholder="למשל: חיתוך קוביות גבינת מנצ'גו 500 גרם" required />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm);">
            <div class="form-group">
              <label class="form-label">פס / עמדה במטבח</label>
              <input type="text" list="stationsList" class="form-input" id="modalPrepStation" value="${task ? task.station : (selectedStationFilter !== 'הכל' ? selectedStationFilter : 'פלטות וגבינות')}" required />
              <datalist id="stationsList">
                ${existingStations.map(st => `<option value="${st}"></option>`).join('')}
              </datalist>
            </div>

            <div class="form-group">
              <label class="form-label">תדירות ביצוע</label>
              <select class="form-select" id="modalPrepFreq">
                ${["יומי", "לפני סופ\"ש", "פעמיים בשבוע", "לפי צורך"].map(f => `
                  <option value="${f}" ${task && task.frequency === f ? 'selected' : ''}>${f}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: var(--space-sm);">
            <div class="form-group">
              <label class="form-label">זמן ביצוע משוער (דקות)</label>
              <input type="number" min="1" step="1" class="form-input" id="modalPrepMinutes" value="${task ? task.estMinutes : 15}" required />
            </div>

            <div class="form-group">
              <label class="form-label">קישור למתכון הכנה / מנה (לצפייה בשטח)</label>
              <select class="form-select" id="modalPrepLinkedDish">
                <option value="">— ללא קישור למתכון —</option>
                ${state.dishes.map(d => `
                  <option value="${d.id}" ${task && task.linkedDishId === d.id ? 'selected' : ''}>
                    ${d.name} (${d.dishType === 'SUB_RECIPE' ? 'מתכון הכנה' : 'מנת תפריט'})
                  </option>
                `).join('')}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">הנחיות ביצוע מדויקות לעובד פס</label>
            <textarea class="form-textarea" id="modalPrepInstructions" rows="3" placeholder="פרט כיצד לחתוך, באיזה כלי לאחסן, ואיך לסמן תאריך...">${task ? (task.instructions || '') : ''}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary btn-close-modal">ביטול</button>
          <button type="submit" class="btn btn-primary">שמור משימת הכנה</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelectorAll(".btn-close-modal").forEach(b => b.addEventListener("click", () => modal.remove()));

  modal.querySelector("#prepTaskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    store.savePrepTask({
      ...(task || {}),
      prepItem: modal.querySelector("#modalPrepItem").value.trim(),
      station: modal.querySelector("#modalPrepStation").value.trim(),
      frequency: modal.querySelector("#modalPrepFreq").value,
      estMinutes: Number(modal.querySelector("#modalPrepMinutes").value) || 15,
      linkedDishId: modal.querySelector("#modalPrepLinkedDish").value || null,
      instructions: modal.querySelector("#modalPrepInstructions").value.trim()
    });
    modal.remove();
    renderOfficePrepManager(container);
  });
}

