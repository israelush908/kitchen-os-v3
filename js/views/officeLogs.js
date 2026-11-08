/**
 * Office Mode — Audit & Logs History Center (מרכז לוגים והיסטוריה — LOG_Streams)
 * Full visibility and management over LOG_Counts, LOG_Waste, and LOG_Deliveries.
 */

import { store } from "../store.js";

let activeLogTab = "WASTE"; // WASTE | COUNTS | DELIVERIES
let searchQuery = "";
let reasonFilter = "הכל";

export function renderOfficeLogs(container) {
  const state = store.getState();
  const catalog = state.catalog || [];
  const logWaste = state.logWaste || [];
  const logCounts = state.logCounts || [];
  const logDeliveries = state.logDeliveries || [];

  // Summary KPIs
  const totalWasteCost = logWaste.reduce((sum, w) => sum + (Number(w.totalWasteCost) || 0), 0);
  const totalDeliveriesCost = logDeliveries.reduce((sum, d) => sum + (Number(d.totalAmountExclVat) || 0), 0);

  container.innerHTML = `
    <div class="office-logs">
      <!-- כותרת עליונה וייצוא -->
      <div style="margin-bottom: var(--space-md); display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="font-size: 22px; font-weight: 700;">📜 מרכז לוגים והיסטוריה תפעולית (Audit & LOG Streams)</h1>
          <p style="font-size: 13px; color: var(--color-text-dim);">
            תיעוד מלא של דיווחי פחת, ספירות מלאי וקבלות סחורה, כולל אפשרות ביטול פעולה שגויה או ייצוא ל-CSV.
          </p>
        </div>

        <button class="btn btn-secondary" id="btnExportCsvLog">
          📥 ייצא טבלה נוכחית ל-CSV (אקסל)
        </button>
      </div>

      <!-- 3 כרטיסי סיכום לוגים -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-md); margin-bottom: var(--space-lg);">
        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-title">יומן פחת מצטבר (LOG_Waste)</span>
            <span class="kpi-icon">🗑️</span>
          </div>
          <div class="kpi-value" style="color: var(--color-danger);">₪${totalWasteCost.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div class="kpi-footer">${logWaste.length} אירועי פחת מתועדים</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-title">יומן ספירות מלאי (LOG_Counts)</span>
            <span class="kpi-icon">📦</span>
          </div>
          <div class="kpi-value">${logCounts.length} רשומות</div>
          <div class="kpi-footer">תיעוד פערים (Delta) ושווי מלאי בעת הספירה</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-title">יומן קבלת סחורה (LOG_Deliveries)</span>
            <span class="kpi-icon">🚚</span>
          </div>
          <div class="kpi-value">₪${totalDeliveriesCost.toLocaleString("he-IL", { maximumFractionDigits: 0 })}</div>
          <div class="kpi-footer">${logDeliveries.length} תעודות משלוח שנקלטו</div>
        </div>
      </div>

      <!-- לשוניות בחירת יומן -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md); border-bottom: 1px solid var(--color-border-subtle); padding-bottom: var(--space-xs);">
        <div style="display: flex; gap: var(--space-xs);">
          <button class="filter-pill ${activeLogTab === 'WASTE' ? 'active' : ''}" data-log="WASTE">
            🗑️ היסטוריית פחת (${logWaste.length})
          </button>
          <button class="filter-pill ${activeLogTab === 'COUNTS' ? 'active' : ''}" data-log="COUNTS">
            📦 היסטוריית ספירות מלאי (${logCounts.length})
          </button>
          <button class="filter-pill ${activeLogTab === 'DELIVERIES' ? 'active' : ''}" data-log="DELIVERIES">
            🚚 היסטוריית משלוחים (${logDeliveries.length})
          </button>
        </div>

        <div style="display: flex; gap: var(--space-sm); align-items: center;">
          ${activeLogTab === 'WASTE' ? renderWasteReasonFilter(logWaste) : ''}
          <input
            type="text"
            class="form-input"
            id="logSearchInput"
            placeholder="חפש לפי פריט, מדווח או הערה..."
            value="${searchQuery}"
            style="width: 260px;"
          />
        </div>
      </div>

      <!-- תוכן היומן הפעיל -->
      <div class="card">
        ${activeLogTab === "WASTE" ? renderWasteTable(logWaste, catalog) : ""}
        ${activeLogTab === "COUNTS" ? renderCountsTable(logCounts, catalog) : ""}
        ${activeLogTab === "DELIVERIES" ? renderDeliveriesTable(logDeliveries) : ""}
      </div>
    </div>
  `;

  // Tab switchers
  container.querySelectorAll(".filter-pill[data-log]").forEach(btn => {
    btn.addEventListener("click", () => {
      activeLogTab = btn.dataset.log;
      renderOfficeLogs(container);
    });
  });

  // Search input
  container.querySelector("#logSearchInput")?.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderOfficeLogs(container);
  });

  // Waste reason filter
  container.querySelector("#wasteReasonFilterSelect")?.addEventListener("change", (e) => {
    reasonFilter = e.target.value;
    renderOfficeLogs(container);
  });

  // Delete waste log
  container.querySelectorAll(".btn-delete-waste-log").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (confirm("האם לבטל דיווח פחת זה ולהחזיר את הכמות שנגרעה חזרה למלאי?")) {
        store.deleteWasteLog(id, true);
        renderOfficeLogs(container);
      }
    });
  });

  // Delete count log
  container.querySelectorAll(".btn-delete-count-log").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (confirm("האם למחוק רשומה זו מיומן היסטוריית הספירות?")) {
        store.deleteCountLog(id);
        renderOfficeLogs(container);
      }
    });
  });

  // Delete delivery log
  container.querySelectorAll(".btn-delete-dlv-log").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (confirm("האם לבטל רישום משלוח זה ולגרוע את הכמויות שנקלטו מהמלאי?")) {
        store.deleteDeliveryLog(id, true);
        renderOfficeLogs(container);
      }
    });
  });

  // Export CSV
  container.querySelector("#btnExportCsvLog")?.addEventListener("click", () => {
    exportCurrentLogToCsv(activeLogTab, state);
  });
}

function renderWasteReasonFilter(logWaste) {
  const reasons = ["הכל", ...new Set(logWaste.map(w => w.wasteReason).filter(Boolean))];
  return `
    <select class="form-select" id="wasteReasonFilterSelect" style="width: 190px;">
      ${reasons.map(r => `<option value="${r}" ${reasonFilter === r ? 'selected' : ''}>${r === 'הכל' ? 'כל סיבות הפחת' : r}</option>`).join('')}
    </select>
  `;
}

function renderWasteTable(logWaste, catalog) {
  const filtered = logWaste.filter(w => {
    const itemObj = catalog.find(c => c.id === w.itemId);
    const itemName = w.itemName || (itemObj ? itemObj.name : w.itemId);
    const matchReason = reasonFilter === "הכל" || w.wasteReason === reasonFilter;
    const matchSearch = !searchQuery ||
      itemName.includes(searchQuery) ||
      (w.reporter && w.reporter.includes(searchQuery)) ||
      (w.notes && w.notes.includes(searchQuery)) ||
      (w.wasteReason && w.wasteReason.includes(searchQuery));
    return matchReason && matchSearch;
  });

  if (filtered.length === 0) {
    return `<div class="empty-state"><div class="empty-state-title">אין רשומות פחת להצגה</div></div>`;
  }

  return `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>מזהה</th>
            <th>תאריך ושעה</th>
            <th>חומר גלם</th>
            <th>כמות שנזרקה</th>
            <th>סיבת פחת</th>
            <th>עלות כספית ₪</th>
            <th>מדווח</th>
            <th>הערות</th>
            <th style="width: 95px;">פעולות</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(w => {
            const id = w.id || w.wasteId;
            const itemObj = catalog.find(c => c.id === w.itemId);
            const itemName = w.itemName || (itemObj ? itemObj.name : w.itemId);
            const unit = w.stockUnit || (itemObj ? itemObj.stockUnit : "");

            return `
              <tr>
                <td class="mono" style="font-size: 11px; color: var(--color-text-dim);">${id}</td>
                <td style="font-size: 12px;">${formatTime(w.timestamp)}</td>
                <td><strong>${itemName}</strong></td>
                <td><span class="badge badge-danger">${w.wasteQty} ${unit}</span></td>
                <td>${w.wasteReason}</td>
                <td class="mono" style="font-weight: 700; color: var(--color-danger);">₪${Number(w.totalWasteCost).toFixed(2)}</td>
                <td>${w.reporter || '—'}</td>
                <td style="font-size: 12px; color: var(--color-text-dim);">${w.notes || '—'}</td>
                <td>
                  <button class="btn btn-secondary btn-delete-waste-log" data-id="${id}" style="min-height: 28px; padding: 2px 8px; font-size: 11px;" title="בטל פחת והחזר למלאי">
                    ↩️ בטל פחת
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderCountsTable(logCounts, catalog) {
  const filtered = logCounts.filter(c => {
    const itemObj = catalog.find(i => i.id === c.itemId);
    const itemName = c.itemName || (itemObj ? itemObj.name : c.itemId);
    return !searchQuery ||
      itemName.includes(searchQuery) ||
      (c.reporter && c.reporter.includes(searchQuery)) ||
      (c.itemId && c.itemId.includes(searchQuery));
  });

  if (filtered.length === 0) {
    return `<div class="empty-state"><div class="empty-state-title">אין רשומות ספירת מלאי להצגה</div></div>`;
  }

  return `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>מזהה</th>
            <th>תאריך ושעה</th>
            <th>חומר גלם</th>
            <th>מלאי קודם</th>
            <th>כמות שנספרה</th>
            <th>פער (Delta)</th>
            <th>שווי כספי בספירה ₪</th>
            <th>סופר / מדווח</th>
            <th style="width: 70px;">פעולות</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(c => {
            const id = c.id || c.countId;
            const itemObj = catalog.find(i => i.id === c.itemId);
            const itemName = c.itemName || (itemObj ? itemObj.name : c.itemId);
            const unit = c.unit || (itemObj ? itemObj.stockUnit : "");
            const prev = c.previousStock !== undefined ? `${c.previousStock} ${unit}` : "—";
            const delta = c.delta !== undefined ? Number(c.delta) : null;
            const val = c.totalCountValue ?? c.countValue ?? 0;

            return `
              <tr>
                <td class="mono" style="font-size: 11px; color: var(--color-text-dim);">${id}</td>
                <td style="font-size: 12px;">${formatTime(c.timestamp)}</td>
                <td><strong>${itemName}</strong></td>
                <td>${prev}</td>
                <td><strong>${c.countedQty} ${unit}</strong></td>
                <td>
                  ${delta === null ? '—' : `
                    <span class="badge ${delta < 0 ? 'badge-danger' : (delta > 0 ? 'badge-success' : 'badge-gray')}">
                      ${delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
                    </span>
                  `}
                </td>
                <td class="mono" style="font-weight: 600;">₪${Number(val).toFixed(2)}</td>
                <td>${c.reporter || '—'}</td>
                <td>
                  <button class="btn btn-danger btn-delete-count-log" data-id="${id}" style="min-height: 28px; padding: 2px 8px; font-size: 11px;">
                    ✕
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderDeliveriesTable(logDeliveries) {
  const filtered = logDeliveries.filter(d => {
    return !searchQuery ||
      (d.supplierName && d.supplierName.includes(searchQuery)) ||
      (d.invoiceNumber && d.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (d.receivedBy && d.receivedBy.includes(searchQuery));
  });

  if (filtered.length === 0) {
    return `<div class="empty-state"><div class="empty-state-title">אין רשומות משלוחים להצגה</div></div>`;
  }

  return `
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>מזהה</th>
            <th>תאריך ושעה</th>
            <th>ספק</th>
            <th>מס' תעודה</th>
            <th>מספר פריטים</th>
            <th>סכום תעודה (ללא מע"מ)</th>
            <th>נקלט ע"י</th>
            <th>הערות</th>
            <th style="width: 90px;">פעולות</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(d => `
            <tr>
              <td class="mono" style="font-size: 11px; color: var(--color-text-dim);">${d.id}</td>
              <td style="font-size: 12px;">${formatTime(d.timestamp)}</td>
              <td><strong>${d.supplierName}</strong></td>
              <td class="mono">${d.invoiceNumber || '—'}</td>
              <td><span class="badge badge-wine">${(d.items || []).length} פריטים</span></td>
              <td class="mono" style="font-weight: 700;">₪${Number(d.totalAmountExclVat).toFixed(2)}</td>
              <td>${d.receivedBy || '—'}</td>
              <td style="font-size: 12px; color: var(--color-text-dim);">${d.notes || '—'}</td>
              <td>
                <button class="btn btn-danger btn-delete-dlv-log" data-id="${d.id}" style="min-height: 28px; padding: 2px 8px; font-size: 11px;">
                  ↩️ בטל
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function formatTime(ts) {
  if (!ts) return "—";
  if (ts.includes("T")) {
    try {
      return new Date(ts).toLocaleString("he-IL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return ts;
    }
  }
  return ts;
}

function exportCurrentLogToCsv(tab, state) {
  let headers = [];
  let rows = [];

  if (tab === "WASTE") {
    headers = ["מזהה", "תאריך", "מזהה פריט", "שם פריט", "כמות", "סיבה", "עלות בשח", "מדווח", "הערות"];
    rows = (state.logWaste || []).map(w => [
      w.id || w.wasteId,
      w.timestamp,
      w.itemId,
      w.itemName || "",
      w.wasteQty,
      w.wasteReason,
      w.totalWasteCost,
      w.reporter,
      w.notes || ""
    ]);
  } else if (tab === "COUNTS") {
    headers = ["מזהה", "תאריך", "מזהה פריט", "שם פריט", "כמות שנספרה", "פער", "שווי בשח", "מדווח"];
    rows = (state.logCounts || []).map(c => [
      c.id || c.countId,
      c.timestamp,
      c.itemId,
      c.itemName || "",
      c.countedQty,
      c.delta ?? "",
      c.totalCountValue ?? c.countValue ?? 0,
      c.reporter
    ]);
  } else {
    headers = ["מזהה", "תאריך", "ספק", "מספר תעודה", "סהכ ללא מעמ", "נקלט עי", "הערות"];
    rows = (state.logDeliveries || []).map(d => [
      d.id,
      d.timestamp,
      d.supplierName,
      d.invoiceNumber,
      d.totalAmountExclVat,
      d.receivedBy,
      d.notes || ""
    ]);
  }

  const csvContent = "\uFEFF" + [headers, ...rows]
    .map(r => r.map(field => `"${String(field ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kitchen_os_log_${tab.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

