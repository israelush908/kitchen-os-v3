/**
 * Office Mode — Weekly/Daily Shift Labor Calculator, Monthly Tracker & Excel Exporter
 * Supports:
 * 1. Dynamic Hourly Worker Boxes (e.g., 6 hours * 50₪/hr, 3 hours * 80₪/hr — user chooses how many boxes!)
 * 2. Dynamic Global / Salaried Boxes (e.g., Chef fixed daily/shift amount without hours * rate)
 * 3. Income vs Expense including Employer Cost (דמי מעביד) per workday, grouped by week
 * 4. Monthly aggregation & 1-click Excel (.csv) export + Google Sheets cloud sync
 */

import { store } from "../store.js";
import { CalculationService } from "../services/calculationService.js";
import { SyncService } from "../services/syncService.js";

let activeSubView = "WEEKLY_DAILY"; // WEEKLY_DAILY | MONTHLY_SUMMARY | TASKS
let selectedMonthFilter = "הכל";
let editingEntryId = null;

// Draft state for the Dynamic Shift / Workday Calculator
let formDraft = createDefaultDraft();

function createDefaultDraft() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    date: today,
    weekLabel: getWeekLabelForDate(today),
    dayOfWeek: getHebrewDayName(today),
    salesInclVat: 18500,
    employerMultiplier: 1.30,
    notes: "",
    hourlyBoxes: [
      { id: "HB-1", roleLabel: "עובד שעתי 1 (פס קר)", hours: 6, hourlyRate: 50 },
      { id: "HB-2", roleLabel: "עובד שעתי 2 (סרוויס)", hours: 3, hourlyRate: 80 }
    ],
    globalBoxes: [
      { id: "GB-1", roleLabel: "שף / מנהל (סכום גלובלי)", amount: 650 }
    ]
  };
}

function getHebrewDayName(dateStr) {
  try {
    const days = ["יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "יום שישי", "יום שבת"];
    const d = new Date(dateStr + "T12:00:00");
    return days[d.getDay()] || "יום חמישי";
  } catch (e) {
    return "יום חמישי";
  }
}

function getWeekLabelForDate(dateStr) {
  try {
    const d = new Date(dateStr + "T12:00:00");
    const dayNum = d.getDate();
    const weekNum = Math.ceil(dayNum / 7);
    const monthNum = (d.getMonth() + 1).toString().padStart(2, "0");
    return `שבוע ${weekNum} (חודש ${monthNum}/${d.getFullYear()})`;
  } catch (e) {
    return "שבוע 1";
  }
}

export function renderOfficeLabor(container) {
  const state = store.getState();
  const config = state.config || {};
  const targetLabor = config.targetLaborCost || 0.15;
  const vatRate = config.vatRate || 0.18;
  const defaultMult = config.employerCostMultiplier || 1.30;

  if (!editingEntryId && formDraft.employerMultiplier === 1.30 && defaultMult !== 1.30) {
    formDraft.employerMultiplier = defaultMult;
  }

  const dailyLogs = state.logLaborDaily || [];
  const monthlyLogs = state.logLabor || [];

  // Extract unique months
  const monthsSet = new Set([
    ...dailyLogs.map(d => d.monthId),
    ...monthlyLogs.map(m => m.monthId)
  ].filter(Boolean));
  const monthsList = ["הכל", ...Array.from(monthsSet).sort().reverse()];

  const filteredDaily = dailyLogs.filter(d => selectedMonthFilter === "הכל" || d.monthId === selectedMonthFilter);

  // Aggregate metrics for filtered daily logs
  let sumSalesIncl = 0;
  let sumSalesExcl = 0;
  let sumHours = 0;
  let sumHourlyGross = 0;
  let sumGlobalGross = 0;
  let sumEmployerCost = 0;

  filteredDaily.forEach(d => {
    sumSalesIncl += Number(d.salesInclVat) || 0;
    sumSalesExcl += Number(d.salesExclVat) || 0;
    sumHours += Number(d.totalHours) || 0;
    sumHourlyGross += Number(d.hourlyGrossSum) || 0;
    sumGlobalGross += Number(d.globalGrossSum) || 0;
    sumEmployerCost += Number(d.employerCost) || 0;
  });

  const sumNetBalance = sumSalesExcl - sumEmployerCost;
  const weightedLaborPct = sumSalesExcl > 0 ? (sumEmployerCost / sumSalesExcl) : 0;
  const weightedSplh = sumHours > 0 ? (sumSalesExcl / sumHours) : 0;

  container.innerHTML = `
    <div class="office-labor">
      <!-- כותרת עליונה וכפתורי ייצוא וסנכרון -->
      <div style="margin-bottom: var(--space-md); display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: var(--space-sm);">
        <div>
          <h1 style="font-size: 22px; font-weight: 700;">👥 ניהול לייבור יומי/שבועי, דמי מעביד ודוח חודשי</h1>
          <p style="font-size: 13px; color: var(--color-text-dim);">
            חישוב מדויק של כל יום עבודה לפי תיבות עובדים שעתיים + שכר גלובלי, השוואת הכנסה מול הוצאה (כולל דמי מעביד) וייצוא לאקסל ו-Google Sheets.
          </p>
        </div>

        <div style="display: flex; gap: var(--space-xs); flex-wrap: wrap;">
          <button class="btn btn-secondary" id="btnExportMonthlyExcel" title="ייצא דוח לייבור חודשי ויומי מפורט לקובץ אקסל (CSV)">
            📊 ייצא דוח חודשי לאקסל (CSV)
          </button>
          <button class="btn btn-primary" id="btnSyncLaborToSheets" title="סנכרן מיד את כל נתוני הלייבור והמערכת ל-Google Sheets">
            ☁️ סנכרן עכשיו ל-Google Sheets
          </button>
        </div>
      </div>

      <!-- לשוניות משנה וסינון חודש -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md); border-bottom: 1px solid var(--color-border-subtle); padding-bottom: var(--space-xs);">
        <div style="display: flex; gap: var(--space-xs);">
          <button class="filter-pill ${activeSubView === 'WEEKLY_DAILY' ? 'active' : ''}" data-sub="WEEKLY_DAILY">
            📅 יומן משמרות שבועי / יומי (${dailyLogs.length} ימים)
          </button>
          <button class="filter-pill ${activeSubView === 'MONTHLY_SUMMARY' ? 'active' : ''}" data-sub="MONTHLY_SUMMARY">
            📈 דוח סיכום חודשי (${monthlyLogs.length} חודשים)
          </button>
          <button class="filter-pill ${activeSubView === 'TASKS' ? 'active' : ''}" data-sub="TASKS">
            📋 משימות מנהל (${(state.managerTasks || []).length})
          </button>
        </div>

        <div style="display: flex; align-items: center; gap: var(--space-xs);">
          <span style="font-size: 12px; color: var(--color-text-dim); font-weight: 600;">סנן לפי חודש:</span>
          <select class="form-select" id="laborMonthFilterSelect" style="width: 160px; min-height: 34px; padding: 4px 10px;">
            ${monthsList.map(m => `<option value="${m}" ${selectedMonthFilter === m ? 'selected' : ''}>${m === 'הכל' ? 'כל החודשים' : m}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- 4 כרטיסי KPI עליונים לתקופה הנבחרת -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-md); margin-bottom: var(--space-lg);">
        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-title">הכנסה נטו (ללא מע"מ)</span>
            <span class="kpi-icon">💵</span>
          </div>
          <div class="kpi-value">₪${sumSalesExcl.toLocaleString("he-IL", { maximumFractionDigits: 0 })}</div>
          <div class="kpi-footer">ברוטו כולל מע"מ: ₪${sumSalesIncl.toLocaleString("he-IL", { maximumFractionDigits: 0 })}</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-title">סך הוצאת לייבור (כולל דמי מעביד)</span>
            <span class="kpi-icon">💼</span>
          </div>
          <div class="kpi-value" style="color: var(--color-accent-primary);">₪${sumEmployerCost.toLocaleString("he-IL", { maximumFractionDigits: 0 })}</div>
          <div class="kpi-footer">שעתי: ₪${sumHourlyGross.toLocaleString()} | גלובלי: ₪${sumGlobalGross.toLocaleString()}</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-title">מאזן תפעולי (הכנסה נטו נגד לייבור)</span>
            <span class="kpi-icon">⚖️</span>
          </div>
          <div class="kpi-value" style="color: ${sumNetBalance >= 0 ? 'var(--status-success)' : 'var(--color-danger)'};">
            ₪${sumNetBalance.toLocaleString("he-IL", { maximumFractionDigits: 0 })}
          </div>
          <div class="kpi-footer">רווח תפעולי אחרי עלות מעסיק מלאה</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-title">אחוז לייבור משוקלל ו-SPLH</span>
            <span class="kpi-icon">📊</span>
          </div>
          <div class="kpi-value">${(weightedLaborPct * 100).toFixed(1)}%</div>
          <div class="kpi-footer">
            <span class="badge ${weightedLaborPct <= targetLabor ? 'badge-success' : 'badge-danger'}">
              ${weightedLaborPct <= targetLabor ? `תקין (יעד ${(targetLabor * 100).toFixed(0)}%)` : `חריגה מיעד ${(targetLabor * 100).toFixed(0)}%`}
            </span>
            <span>• SPLH: ₪${weightedSplh.toFixed(0)}</span>
          </div>
        </div>
      </div>

      ${activeSubView === "WEEKLY_DAILY" ? renderWeeklyDailyView(filteredDaily, vatRate, targetLabor) : ""}
      ${activeSubView === "MONTHLY_SUMMARY" ? renderMonthlySummaryView(monthlyLogs, targetLabor) : ""}
      ${activeSubView === "TASKS" ? renderTasksSection(state.managerTasks || []) : ""}
    </div>
  `;

  // Sub-view tabs
  container.querySelectorAll(".filter-pill[data-sub]").forEach(btn => {
    btn.addEventListener("click", () => {
      activeSubView = btn.dataset.sub;
      renderOfficeLabor(container);
    });
  });

  // Month filter
  container.querySelector("#laborMonthFilterSelect")?.addEventListener("change", (e) => {
    selectedMonthFilter = e.target.value;
    renderOfficeLabor(container);
  });

  // Export Monthly & Daily Excel CSV
  container.querySelector("#btnExportMonthlyExcel")?.addEventListener("click", () => {
    exportLaborReportToExcel(filteredDaily, monthlyLogs, selectedMonthFilter);
  });

  // Sync now to Google Sheets
  container.querySelector("#btnSyncLaborToSheets")?.addEventListener("click", async () => {
    const btn = container.querySelector("#btnSyncLaborToSheets");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "⏳ מסנכרן ל-Google Sheets...";
    }
    try {
      const res = await fetch("/api/sheets/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: store.getState() })
      });
      const data = await res.json();
      if (res.ok && data.status === "ok") {
        alert(`✅ סונכרן בהצלחה ל-Google Sheets!\nעודכנו הלשוניות (כולל OPS_Labor_Tracker ו-OPS_Daily_Labor).`);
      } else {
        alert("⚠️ הנתונים נשמרו מקומית בשרת. הודעת שרת: " + (data.message || "בדוק חיבור שרת"));
      }
    } catch (err) {
      alert("הנתונים שמורים מקומית. ודא ששרת הפייתון (run.bat) פועל לסנכרון לענן.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "☁️ סנכרן עכשיו ל-Google Sheets";
      }
    }
  });

  if (activeSubView === "WEEKLY_DAILY") {
    bindWeeklyDailyEvents(container, vatRate);
  } else if (activeSubView === "MONTHLY_SUMMARY") {
    bindMonthlyEvents(container);
  } else if (activeSubView === "TASKS") {
    bindTasksEvents(container);
  }
}

/**
 * תצוגה 1: מחשבון משמרת יומי (עם תיבות דינמיות) + דאטה מצטברת לפי שבועות
 */
function renderWeeklyDailyView(filteredDaily, vatRate, targetLabor) {
  const liveCalc = CalculationService.calculateDailyLaborEntry({
    salesInclVat: formDraft.salesInclVat,
    vatRate,
    employerCostMultiplier: formDraft.employerMultiplier,
    hourlyBoxes: formDraft.hourlyBoxes,
    globalBoxes: formDraft.globalBoxes
  });

  // Group daily logs by weekLabel
  const weeksMap = {};
  filteredDaily.forEach(entry => {
    const wk = entry.weekLabel || "שבוע כללי";
    if (!weeksMap[wk]) {
      weeksMap[wk] = {
        weekLabel: wk,
        days: [],
        totalSalesIncl: 0,
        totalSalesExcl: 0,
        totalHours: 0,
        totalHourlyGross: 0,
        totalGlobalGross: 0,
        totalEmployerCost: 0,
        totalNetBalance: 0
      };
    }
    const g = weeksMap[wk];
    g.days.push(entry);
    g.totalSalesIncl += Number(entry.salesInclVat) || 0;
    g.totalSalesExcl += Number(entry.salesExclVat) || 0;
    g.totalHours += Number(entry.totalHours) || 0;
    g.totalHourlyGross += Number(entry.hourlyGrossSum) || 0;
    g.totalGlobalGross += Number(entry.globalGrossSum) || 0;
    g.totalEmployerCost += Number(entry.employerCost) || 0;
    g.totalNetBalance += Number(entry.netBalance) || 0;
  });

  const weekGroups = Object.values(weeksMap);

  return `
    <!-- בונה משמרת / יום עבודה דינמי -->
    <div class="card" style="margin-bottom: var(--space-lg); border: 2px solid var(--color-border-interactive);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md); border-bottom: 1px solid var(--color-border-subtle); padding-bottom: var(--space-sm);">
        <div>
          <h3 class="card-title" style="font-size: 17px; color: var(--color-accent-primary);">
            ${editingEntryId ? '✏️ עריכת יום עבודה / משמרת' : '➕ הזנת יום עבודה / משמרת חדשה (תיבות עובדים דינמיות)'}
          </h3>
          <p class="card-subtitle">
            הוסף כמה תיבות עובדים שעתיים שתרצה (שעות × תעריף שעתי) + תיבות שכר גלובלי/שף (סכום קבוע), וראה מיד הכנסה מול הוצאה כולל דמי מעביד.
          </p>
        </div>

        <div style="display: flex; gap: var(--space-xs); align-items: center;">
          <label style="font-size: 12px; font-weight: 600;">מספר תיבות שעתיות מהיר:</label>
          <select class="form-select" id="quickHourlyBoxCountSelect" style="width: 90px; min-height: 32px; padding: 2px 8px;">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 10].map(n => `
              <option value="${n}" ${formDraft.hourlyBoxes.length === n ? 'selected' : ''}>${n} תיבות</option>
            `).join('')}
          </select>
          ${editingEntryId ? `
            <button type="button" class="btn btn-secondary" id="btnCancelEditDay" style="font-size: 12px;">ביטול עריכה</button>
          ` : ''}
        </div>
      </div>

      <!-- שורת פרטי יום והכנסה -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1.2fr 1.2fr 0.9fr 1.5fr; gap: var(--space-sm); margin-bottom: var(--space-md); background: #f8f9fa; padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border-subtle);">
        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">תאריך יום העבודה</label>
          <input type="date" class="form-input" id="dayDateInput" value="${formDraft.date}" />
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">יום בשבוע</label>
          <select class="form-select" id="dayOfWeekSelect">
            ${["יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "יום שישי", "יום שבת"].map(d => `
              <option value="${d}" ${formDraft.dayOfWeek === d ? 'selected' : ''}>${d}</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">שיוך לשבוע (לקיבוץ שבועי)</label>
          <input type="text" class="form-input" id="dayWeekLabelInput" value="${formDraft.weekLabel}" placeholder="למשל: שבוע 4 (18/10-24/10)" />
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">פדיון/הכנסה יומית כולל מע"מ ₪</label>
          <input type="number" step="any" min="0" class="form-input" id="daySalesInclInput" value="${formDraft.salesInclVat}" style="font-weight: 700; color: var(--status-success);" />
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">מקדם דמי מעביד</label>
          <input type="number" step="0.01" min="1.0" max="2.5" class="form-input" id="dayEmployerMultInput" value="${formDraft.employerMultiplier}" title="למשל 1.30 = תוספת 30% דמי מעביד וסוציאליות" />
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">הערות משמרת / אירוע</label>
          <input type="text" class="form-input" id="dayNotesInput" value="${formDraft.notes}" placeholder="למשל: סרוויס שישי בוקר..." />
        </div>
      </div>

      <!-- שתי עמודות: 1. תיבות עובדים שעתיים | 2. תיבות שכר גלובלי/שף -->
      <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: var(--space-md); margin-bottom: var(--space-md);">
        <!-- עמודה ימנית: תיבות עובדים שעתיים (שעות * תעריף לשעה) -->
        <div style="background: #ffffff; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); padding: var(--space-md);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-sm);">
            <div>
              <h4 style="font-size: 14px; font-weight: 700;">⏱️ תיבות עובדים שעתיים (שעות × תעריף לשעה)</h4>
              <span style="font-size: 11px; color: var(--color-text-dim);">לדוגמה: 6 שעות × 50 ₪ = 300 ₪ | 3 שעות × 80 ₪ = 240 ₪</span>
            </div>
            <button type="button" class="btn btn-secondary" id="btnAddHourlyBox" style="min-height: 30px; padding: 4px 10px; font-size: 12px;">
              ➕ הוסף תיבת עובד שעתי
            </button>
          </div>

          <div id="hourlyBoxesContainer" style="display: flex; flex-direction: column; gap: 8px;">
            ${formDraft.hourlyBoxes.map((box, idx) => {
              const rowSum = (Number(box.hours) || 0) * (Number(box.hourlyRate) || 0);
              return `
                <div class="hourly-box-row" data-idx="${idx}" style="display: grid; grid-template-columns: 1.4fr 0.9fr 0.2fr 0.9fr 0.9fr 34px; gap: 6px; align-items: center; background: #f8f9fa; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--color-border-subtle);">
                  <input
                    type="text"
                    class="form-input hb-role-input"
                    data-idx="${idx}"
                    value="${box.roleLabel}"
                    placeholder="תיאור / שם עובד"
                    style="min-height: 32px; font-size: 12px;"
                  />
                  <div>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      class="form-input hb-hours-input"
                      data-idx="${idx}"
                      value="${box.hours}"
                      placeholder="שעות"
                      title="מספר שעות עבודה"
                      style="min-height: 32px; font-size: 13px; font-weight: 700; text-align: center;"
                    />
                    <div style="font-size: 9px; text-align: center; color: var(--color-text-dim);">שעות</div>
                  </div>
                  <div style="text-align: center; font-weight: 700; color: var(--color-text-dim);">×</div>
                  <div>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      class="form-input hb-rate-input"
                      data-idx="${idx}"
                      value="${box.hourlyRate}"
                      placeholder="₪ לשעה"
                      title="תעריף שעתי ב-₪"
                      style="min-height: 32px; font-size: 13px; font-weight: 700; text-align: center;"
                    />
                    <div style="font-size: 9px; text-align: center; color: var(--color-text-dim);">₪ לשעה</div>
                  </div>
                  <div class="mono hb-row-total" data-idx="${idx}" style="font-weight: 700; font-size: 13px; text-align: left; color: var(--color-text-primary);">
                    = ₪${rowSum.toFixed(0)}
                  </div>
                  <button type="button" class="btn btn-danger btn-remove-hb" data-idx="${idx}" style="min-height: 28px; padding: 0; width: 28px; font-size: 11px;" title="הסר תיבה">
                    ✕
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- עמודה שמאלית: תיבות שכר גלובלי / סכום קבוע (למשל שף) -->
        <div style="background: #ffffff; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); padding: var(--space-md); display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-sm);">
              <div>
                <h4 style="font-size: 14px; font-weight: 700;">👨‍🍳 שף / עובדים גלובליים (סכום שלם קבוע)</h4>
                <span style="font-size: 11px; color: var(--color-text-dim);">ללא כפל שעות — הזנת סכום יומי/משמרת ישיר ב-₪</span>
              </div>
              <button type="button" class="btn btn-secondary" id="btnAddGlobalBox" style="min-height: 30px; padding: 4px 10px; font-size: 12px;">
                ➕ הוסף סכום גלובלי
              </button>
            </div>

            <div id="globalBoxesContainer" style="display: flex; flex-direction: column; gap: 8px;">
              ${formDraft.globalBoxes.length === 0 ? `
                <div style="padding: 16px; text-align: center; color: var(--color-text-dim); font-size: 12px;">
                  אין שכר גלובלי משויך ליום זה. לחץ על "➕ הוסף סכום גלובלי" להוספה.
                </div>
              ` : formDraft.globalBoxes.map((gBox, idx) => `
                <div class="global-box-row" data-idx="${idx}" style="display: grid; grid-template-columns: 1.5fr 1fr 34px; gap: 8px; align-items: center; background: #fffbeb; padding: 8px 10px; border-radius: 6px; border: 1px solid #fde68a;">
                  <input
                    type="text"
                    class="form-input gb-role-input"
                    data-idx="${idx}"
                    value="${gBox.roleLabel}"
                    placeholder="תפקיד (למשל: שף גלובלי)"
                    style="min-height: 32px; font-size: 12px;"
                  />
                  <div>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      class="form-input gb-amount-input"
                      data-idx="${idx}"
                      value="${gBox.amount}"
                      placeholder="סכום שלם ב-₪"
                      style="min-height: 32px; font-size: 13px; font-weight: 700; text-align: center;"
                    />
                    <div style="font-size: 9px; text-align: center; color: #92400e;">סכום ברוטו שלם (₪)</div>
                  </div>
                  <button type="button" class="btn btn-danger btn-remove-gb" data-idx="${idx}" style="min-height: 28px; padding: 0; width: 28px; font-size: 11px;" title="הסר תיבה">
                    ✕
                  </button>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- תיבת סיכום מתמטי חי למשמרת -->
          <div style="margin-top: var(--space-md); background: #f8f9fa; padding: 10px 12px; border-radius: 6px; border: 1px dashed var(--color-border-interactive); font-size: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span>סה"כ שעות עובדים שעתיים:</span>
              <strong id="liveTotalHoursEl">${liveCalc.totalHours} שעות</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span>שכר שעתי ברוטו + שכר גלובלי ברוטו:</span>
              <strong id="liveGrossBreakEl">₪${liveCalc.hourlyGrossSum.toFixed(0)} + ₪${liveCalc.globalGrossSum.toFixed(0)} = ₪${liveCalc.totalGrossWages.toFixed(0)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; color: var(--color-accent-primary); font-weight: 700;">
              <span>עלות מעסיק כוללת דמי מעביד (×${formDraft.employerMultiplier}):</span>
              <span id="liveEmployerCostSmallEl">₪${liveCalc.employerCost.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- בר סיכום חי תחתון של המשמרת (הכנסה נגד הוצאה כולל דמי מעביד) -->
      <div style="display: flex; justify-content: space-between; align-items: center; background: #1e1e1e; color: #ffffff; padding: 14px 20px; border-radius: var(--radius-md); flex-wrap: wrap; gap: var(--space-md);">
        <div style="display: flex; gap: 28px; align-items: center; flex-wrap: wrap;">
          <div>
            <div style="font-size: 11px; color: #9ca3af;">הכנסה נטו (ללא מע"מ)</div>
            <div style="font-size: 19px; font-weight: 700; color: #fff;" id="liveSalesExclEl">₪${liveCalc.salesExclVat.toLocaleString("he-IL", { maximumFractionDigits: 0 })}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #9ca3af;">הוצאת לייבור + דמי מעביד</div>
            <div style="font-size: 19px; font-weight: 700; color: #fca5a5;" id="liveEmployerCostEl">₪${liveCalc.employerCost.toLocaleString("he-IL", { maximumFractionDigits: 0 })}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #9ca3af;">מאזן יום (הכנסה נגד הוצאה)</div>
            <div style="font-size: 20px; font-weight: 700; color: #10b981;" id="liveNetBalanceEl">₪${liveCalc.netBalance.toLocaleString("he-IL", { maximumFractionDigits: 0 })}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #9ca3af;">אחוז לייבור יומי</div>
            <div style="font-size: 19px; font-weight: 700; color: ${liveCalc.laborPct <= targetLabor ? '#10b981' : '#f87171'};" id="liveLaborPctEl">
              ${(liveCalc.laborPct * 100).toFixed(1)}%
            </div>
          </div>
        </div>

        <button type="button" class="btn btn-primary" id="btnSaveDailyLabor" style="min-height: 44px; padding: 0 24px; font-size: 15px;">
          💾 ${editingEntryId ? 'עדכן יום עבודה ושמור' : 'שמור יום עבודה לדוח השבועי והחודשי'}
        </button>
      </div>
    </div>

    <!-- טבלאות שבועיות מצטברות של ימי העבודה -->
    <div>
      <h3 style="font-size: 17px; font-weight: 700; margin-bottom: var(--space-sm);">
        📅 פירוט שבועי מצטבר לפי ימי עבודה (הכנסה נגד הוצאה כולל דמי מעביד)
      </h3>

      ${weekGroups.length === 0 ? `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon">📅</div>
            <div class="empty-state-title">אין ימי עבודה רשומים לתקופה זו</div>
            <div class="empty-state-desc">הזן יום עבודה במחשבון למעלה ולחץ על "שמור יום עבודה"</div>
          </div>
        </div>
      ` : weekGroups.map(week => {
        const wkLaborPct = week.totalSalesExcl > 0 ? (week.totalEmployerCost / week.totalSalesExcl) : 0;
        const wkSplh = week.totalHours > 0 ? (week.totalSalesExcl / week.totalHours) : 0;
        const isWkOk = wkLaborPct <= targetLabor;

        return `
          <div class="card" style="margin-bottom: var(--space-md);">
            <!-- כותרת שבוע וסיכום מצטבר שבועי -->
            <div style="display: flex; justify-content: space-between; align-items: center; background: #f8f9fa; padding: 10px 16px; border-radius: var(--radius-sm); border-right: 4px solid var(--color-accent-primary); margin-bottom: var(--space-sm); flex-wrap: wrap; gap: var(--space-sm);">
              <div>
                <strong style="font-size: 15px;">🗓️ ${week.weekLabel}</strong>
                <span style="font-size: 12px; color: var(--color-text-dim); margin-right: 8px;">(${week.days.length} ימי עבודה פעילים)</span>
              </div>

              <div style="display: flex; gap: 18px; align-items: center; font-size: 13px; flex-wrap: wrap;">
                <span>סה"כ שעות: <strong>${week.totalHours.toFixed(1)}</strong></span>
                <span>הכנסה נטו: <strong>₪${week.totalSalesExcl.toLocaleString("he-IL", { maximumFractionDigits: 0 })}</strong></span>
                <span>עלות כולל דמי מעביד: <strong style="color: var(--color-accent-primary);">₪${week.totalEmployerCost.toLocaleString("he-IL", { maximumFractionDigits: 0 })}</strong></span>
                <span>מאזן שבועי: <strong style="color: var(--status-success);">+₪${week.totalNetBalance.toLocaleString("he-IL", { maximumFractionDigits: 0 })}</strong></span>
                <span class="badge ${isWkOk ? 'badge-success' : 'badge-danger'}">
                  לייבור שבועי: ${(wkLaborPct * 100).toFixed(1)}%
                </span>
              </div>
            </div>

            <!-- טבלת ימי העבודה באותו שבוע -->
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>תאריך ויום</th>
                    <th>הכנסה ברוטו</th>
                    <th>הכנסה נטו (ללא מע"מ)</th>
                    <th>פירוט תיבות עובדים (שעתי + גלובלי)</th>
                    <th>סה"כ שעות</th>
                    <th>שכר ברוטו</th>
                    <th>עלות + דמי מעביד ₪</th>
                    <th>הכנסה נגד הוצאה ₪</th>
                    <th>לייבור %</th>
                    <th>SPLH ₪</th>
                    <th style="width: 110px;">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  ${week.days.map(day => {
                    const isDayOk = day.laborPct <= targetLabor;
                    const hourlyBadges = (day.hourlyBoxes || []).map(b =>
                      `<span class="badge badge-gray" style="margin-left: 3px; margin-bottom: 2px; font-size: 10px;">
                        ${b.roleLabel}: ${b.hours}ש' × ₪${b.hourlyRate} (=₪${(b.hours * b.hourlyRate).toFixed(0)})
                      </span>`
                    ).join('');
                    const globalBadges = (day.globalBoxes || []).map(g =>
                      `<span class="badge badge-wine" style="margin-left: 3px; margin-bottom: 2px; font-size: 10px;">
                        ${g.roleLabel}: ₪${g.amount} (גלובלי)
                      </span>`
                    ).join('');

                    return `
                      <tr>
                        <td>
                          <strong>${day.dayOfWeek || ''}</strong>
                          <div class="mono" style="font-size: 11px; color: var(--color-text-dim);">${day.date}</div>
                        </td>
                        <td class="mono">₪${Number(day.salesInclVat).toLocaleString()}</td>
                        <td class="mono" style="font-weight: 600;">₪${Number(day.salesExclVat).toLocaleString("he-IL", { maximumFractionDigits: 0 })}</td>
                        <td style="max-width: 340px;">
                          <div>${hourlyBadges}${globalBadges}</div>
                          ${day.notes ? `<div style="font-size: 11px; color: var(--color-text-dim); margin-top: 2px;">💬 ${day.notes}</div>` : ''}
                        </td>
                        <td class="mono"><strong>${day.totalHours}</strong></td>
                        <td class="mono">₪${Number(day.totalGrossWages).toLocaleString()}</td>
                        <td class="mono" style="font-weight: 700; color: var(--color-accent-primary);">
                          ₪${Number(day.employerCost).toLocaleString("he-IL", { maximumFractionDigits: 0 })}
                          <div style="font-size: 10px; color: var(--color-text-dim);">×${day.employerMultiplier || 1.3}</div>
                        </td>
                        <td class="mono" style="font-weight: 700; color: ${day.netBalance >= 0 ? 'var(--status-success)' : 'var(--color-danger)'};">
                          ₪${Number(day.netBalance).toLocaleString("he-IL", { maximumFractionDigits: 0 })}
                        </td>
                        <td>
                          <span class="badge ${isDayOk ? 'badge-success' : 'badge-danger'}">
                            ${(day.laborPct * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td class="mono">₪${Number(day.splh).toFixed(0)}</td>
                        <td>
                          <div style="display: flex; gap: 4px;">
                            <button class="btn btn-secondary btn-edit-daily-labor" data-id="${day.id}" style="min-height: 28px; padding: 2px 8px; font-size: 11px;">
                              ✏️ ערוך
                            </button>
                            <button class="btn btn-danger btn-delete-daily-labor" data-id="${day.id}" style="min-height: 28px; padding: 2px 8px; font-size: 11px;">
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
        `;
      }).join('')}
    </div>
  `;
}

/**
 * תצוגה 2: דוח סיכום חודשי מצטבר
 */
function renderMonthlySummaryView(monthlyLogs, targetLabor) {
  return `
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);">
        <div>
          <h3 class="card-title" style="font-size: 16px; margin-bottom: 2px;">📈 דוח לייבור חודשי מרוכז (Monthly Summary)</h3>
          <p class="card-subtitle">החודשים מתעדכנים אוטומטית מתוך ימי העבודה השבועיים שהוזנו, או שניתן להזין חודש ידנית</p>
        </div>
        <button class="btn btn-secondary" id="btnAddManualMonth" style="font-size: 12px;">
          ➕ הזן סיכום חודש ידני
        </button>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>חודש דיווח</th>
              <th>הכנסה ברוטו (כולל מע"מ)</th>
              <th>הכנסה נטו (ללא מע"מ)</th>
              <th>סה"כ שעות</th>
              <th>שכר שעתי ברוטו</th>
              <th>שכר שף / גלובלי</th>
              <th>עלות מעסיק (כולל דמי מעביד)</th>
              <th>הכנסה נגד הוצאה ₪</th>
              <th>אחוז לייבור</th>
              <th>SPLH ₪</th>
              <th>הערות</th>
            </tr>
          </thead>
          <tbody>
            ${monthlyLogs.map(l => {
              const totalH = (Number(l.serviceHours) || 0) + (Number(l.prepHours) || 0);
              const netBalance = (Number(l.salesExclVat) || 0) - (Number(l.employerCost) || 0);
              const isOk = l.laborPct <= targetLabor;

              return `
                <tr>
                  <td><strong>${l.monthId}</strong></td>
                  <td class="mono">₪${Number(l.salesInclVat).toLocaleString()}</td>
                  <td class="mono">₪${Number(l.salesExclVat).toLocaleString("he-IL", { maximumFractionDigits: 0 })}</td>
                  <td class="mono"><strong>${totalH}</strong></td>
                  <td class="mono">₪${Number(l.hourlyWagesGross).toLocaleString()}</td>
                  <td class="mono">₪${Number(l.salariedGross).toLocaleString()}</td>
                  <td class="mono" style="font-weight: 700; color: var(--color-accent-primary);">₪${Number(l.employerCost).toLocaleString()}</td>
                  <td class="mono" style="font-weight: 700; color: var(--status-success);">₪${netBalance.toLocaleString("he-IL", { maximumFractionDigits: 0 })}</td>
                  <td>
                    <span class="badge ${isOk ? 'badge-success' : 'badge-danger'}">
                      ${(l.laborPct * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td class="mono" style="font-weight: 600;">₪${Number(l.splh).toFixed(0)}</td>
                  <td style="font-size: 12px; color: var(--color-text-dim);">${l.notes || '—'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * תצוגה 3: משימות מנהל
 */
function renderTasksSection(tasks) {
  return `
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);">
        <h3 class="card-title" style="font-size: 15px; margin-bottom: 0;">📋 משימות מנהל מטבח ותפעול</h3>
        <button class="btn btn-primary" id="btnAddNewManagerTask" style="min-height: 32px; padding: 4px 12px; font-size: 12px;">
          ➕ הוסף משימה חדשה
        </button>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 40px;">בוצע</th>
              <th>מזהה</th>
              <th>תיאור משימה</th>
              <th>תחום</th>
              <th>אחראי</th>
              <th>עדיפות</th>
              <th>תאריך יעד</th>
              <th>סטטוס</th>
            </tr>
          </thead>
          <tbody>
            ${tasks.map(task => `
              <tr>
                <td>
                  <input
                    type="checkbox"
                    class="labor-task-checkbox"
                    data-id="${task.id}"
                    ${task.status === 'הושלם' ? 'checked' : ''}
                    style="width: 18px; height: 18px; cursor: pointer;"
                  />
                </td>
                <td class="mono" style="font-size: 11px; color: var(--color-text-dim);">${task.id}</td>
                <td style="${task.status === 'הושלם' ? 'text-decoration: line-through; color: var(--color-text-dim);' : 'font-weight: 600;'}">
                  ${task.title}
                </td>
                <td>${task.area}</td>
                <td>${task.assignee}</td>
                <td>
                  <span class="badge ${task.priority === 'דחופה' || task.priority === 'גבוהה' ? 'badge-danger' : 'badge-gray'}">
                    ${task.priority}
                  </span>
                </td>
                <td>${task.dueDate || '—'}</td>
                <td>
                  <span class="badge ${task.status === 'הושלם' ? 'badge-success' : 'badge-warning'}">
                    ${task.status}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function bindWeeklyDailyEvents(container, vatRate) {
  // Date change updates Day of Week and Week Label automatically
  container.querySelector("#dayDateInput")?.addEventListener("change", (e) => {
    formDraft.date = e.target.value;
    formDraft.dayOfWeek = getHebrewDayName(formDraft.date);
    formDraft.weekLabel = getWeekLabelForDate(formDraft.date);
    renderOfficeLabor(container);
  });

  container.querySelector("#dayOfWeekSelect")?.addEventListener("change", (e) => {
    formDraft.dayOfWeek = e.target.value;
  });

  container.querySelector("#dayWeekLabelInput")?.addEventListener("input", (e) => {
    formDraft.weekLabel = e.target.value;
  });

  container.querySelector("#daySalesInclInput")?.addEventListener("input", (e) => {
    formDraft.salesInclVat = Math.max(0, Number(e.target.value) || 0);
    updateLiveShiftTotals(container, vatRate);
  });

  container.querySelector("#dayEmployerMultInput")?.addEventListener("input", (e) => {
    formDraft.employerMultiplier = Math.max(1, Number(e.target.value) || 1.30);
    updateLiveShiftTotals(container, vatRate);
  });

  container.querySelector("#dayNotesInput")?.addEventListener("input", (e) => {
    formDraft.notes = e.target.value;
  });

  // Quick box count selector (user chooses how many boxes!)
  container.querySelector("#quickHourlyBoxCountSelect")?.addEventListener("change", (e) => {
    const targetCount = Number(e.target.value) || 1;
    while (formDraft.hourlyBoxes.length < targetCount) {
      const nextNum = formDraft.hourlyBoxes.length + 1;
      formDraft.hourlyBoxes.push({
        id: `HB-${Date.now()}-${nextNum}`,
        roleLabel: `עובד שעתי ${nextNum}`,
        hours: 6,
        hourlyRate: 50
      });
    }
    if (formDraft.hourlyBoxes.length > targetCount) {
      formDraft.hourlyBoxes = formDraft.hourlyBoxes.slice(0, targetCount);
    }
    renderOfficeLabor(container);
  });

  // Add single hourly box
  container.querySelector("#btnAddHourlyBox")?.addEventListener("click", () => {
    const nextNum = formDraft.hourlyBoxes.length + 1;
    formDraft.hourlyBoxes.push({
      id: `HB-${Date.now()}-${nextNum}`,
      roleLabel: `עובד שעתי ${nextNum}`,
      hours: 6,
      hourlyRate: 50
    });
    renderOfficeLabor(container);
  });

  // Remove hourly box
  container.querySelectorAll(".btn-remove-hb").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      formDraft.hourlyBoxes.splice(idx, 1);
      renderOfficeLabor(container);
    });
  });

  // Hourly box inputs
  container.querySelectorAll(".hb-role-input").forEach(inp => {
    inp.addEventListener("input", () => {
      const idx = Number(inp.dataset.idx);
      if (formDraft.hourlyBoxes[idx]) formDraft.hourlyBoxes[idx].roleLabel = inp.value;
    });
  });

  container.querySelectorAll(".hb-hours-input").forEach(inp => {
    inp.addEventListener("input", () => {
      const idx = Number(inp.dataset.idx);
      if (formDraft.hourlyBoxes[idx]) {
        formDraft.hourlyBoxes[idx].hours = Math.max(0, Number(inp.value) || 0);
        updateLiveShiftTotals(container, vatRate);
      }
    });
  });

  container.querySelectorAll(".hb-rate-input").forEach(inp => {
    inp.addEventListener("input", () => {
      const idx = Number(inp.dataset.idx);
      if (formDraft.hourlyBoxes[idx]) {
        formDraft.hourlyBoxes[idx].hourlyRate = Math.max(0, Number(inp.value) || 0);
        updateLiveShiftTotals(container, vatRate);
      }
    });
  });

  // Add global box
  container.querySelector("#btnAddGlobalBox")?.addEventListener("click", () => {
    const nextNum = formDraft.globalBoxes.length + 1;
    formDraft.globalBoxes.push({
      id: `GB-${Date.now()}-${nextNum}`,
      roleLabel: nextNum === 1 ? "שף / מנהל (סכום גלובלי)" : `עובד גלובלי ${nextNum}`,
      amount: 600
    });
    renderOfficeLabor(container);
  });

  // Remove global box
  container.querySelectorAll(".btn-remove-gb").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      formDraft.globalBoxes.splice(idx, 1);
      renderOfficeLabor(container);
    });
  });

  // Global box inputs
  container.querySelectorAll(".gb-role-input").forEach(inp => {
    inp.addEventListener("input", () => {
      const idx = Number(inp.dataset.idx);
      if (formDraft.globalBoxes[idx]) formDraft.globalBoxes[idx].roleLabel = inp.value;
    });
  });

  container.querySelectorAll(".gb-amount-input").forEach(inp => {
    inp.addEventListener("input", () => {
      const idx = Number(inp.dataset.idx);
      if (formDraft.globalBoxes[idx]) {
        formDraft.globalBoxes[idx].amount = Math.max(0, Number(inp.value) || 0);
        updateLiveShiftTotals(container, vatRate);
      }
    });
  });

  // Cancel edit
  container.querySelector("#btnCancelEditDay")?.addEventListener("click", () => {
    editingEntryId = null;
    formDraft = createDefaultDraft();
    renderOfficeLabor(container);
  });

  // Save Daily Labor Entry
  container.querySelector("#btnSaveDailyLabor")?.addEventListener("click", () => {
    const saved = store.saveDailyLaborEntry({
      id: editingEntryId || undefined,
      date: formDraft.date,
      monthId: formDraft.date.slice(0, 7),
      weekLabel: formDraft.weekLabel,
      dayOfWeek: formDraft.dayOfWeek,
      salesInclVat: formDraft.salesInclVat,
      employerMultiplier: formDraft.employerMultiplier,
      hourlyBoxes: formDraft.hourlyBoxes,
      globalBoxes: formDraft.globalBoxes,
      notes: formDraft.notes
    });

    editingEntryId = null;
    formDraft = createDefaultDraft();
    alert(`✅ יום העבודה (${saved.dayOfWeek} ${saved.date}) נשמר בהצלחה!\nעלות מעסיק כוללת: ₪${saved.employerCost.toFixed(0)} | לייבור: ${(saved.laborPct * 100).toFixed(1)}%`);
    renderOfficeLabor(container);
  });

  // Edit existing daily entry
  container.querySelectorAll(".btn-edit-daily-labor").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const entry = (store.getState().logLaborDaily || []).find(d => d.id === id);
      if (!entry) return;

      editingEntryId = entry.id;
      formDraft = {
        date: entry.date,
        weekLabel: entry.weekLabel,
        dayOfWeek: entry.dayOfWeek,
        salesInclVat: entry.salesInclVat,
        employerMultiplier: entry.employerMultiplier || 1.30,
        notes: entry.notes || "",
        hourlyBoxes: JSON.parse(JSON.stringify(entry.hourlyBoxes || [])),
        globalBoxes: JSON.parse(JSON.stringify(entry.globalBoxes || []))
      };
      renderOfficeLabor(container);
      container.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // Delete daily entry
  container.querySelectorAll(".btn-delete-daily-labor").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (confirm("האם למחוק את רישום יום העבודה הזה מהיומן השבועי והחודשי?")) {
        store.deleteDailyLaborEntry(id);
        renderOfficeLabor(container);
      }
    });
  });
}

function updateLiveShiftTotals(container, vatRate) {
  // Update individual hourly row totals
  formDraft.hourlyBoxes.forEach((box, idx) => {
    const rowSum = (Number(box.hours) || 0) * (Number(box.hourlyRate) || 0);
    const rowEl = container.querySelector(`.hb-row-total[data-idx="${idx}"]`);
    if (rowEl) rowEl.textContent = `= ₪${rowSum.toFixed(0)}`;
  });

  const calc = CalculationService.calculateDailyLaborEntry({
    salesInclVat: formDraft.salesInclVat,
    vatRate,
    employerCostMultiplier: formDraft.employerMultiplier,
    hourlyBoxes: formDraft.hourlyBoxes,
    globalBoxes: formDraft.globalBoxes
  });

  const targetLabor = store.getState().config?.targetLaborCost || 0.15;

  const hrsEl = container.querySelector("#liveTotalHoursEl");
  const grossEl = container.querySelector("#liveGrossBreakEl");
  const empSmallEl = container.querySelector("#liveEmployerCostSmallEl");
  const salesExclEl = container.querySelector("#liveSalesExclEl");
  const empEl = container.querySelector("#liveEmployerCostEl");
  const netBalEl = container.querySelector("#liveNetBalanceEl");
  const pctEl = container.querySelector("#liveLaborPctEl");

  if (hrsEl) hrsEl.textContent = `${calc.totalHours} שעות`;
  if (grossEl) grossEl.textContent = `₪${calc.hourlyGrossSum.toFixed(0)} + ₪${calc.globalGrossSum.toFixed(0)} = ₪${calc.totalGrossWages.toFixed(0)}`;
  if (empSmallEl) empSmallEl.textContent = `₪${calc.employerCost.toFixed(2)}`;
  if (salesExclEl) salesExclEl.textContent = `₪${calc.salesExclVat.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;
  if (empEl) empEl.textContent = `₪${calc.employerCost.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;
  if (netBalEl) netBalEl.textContent = `₪${calc.netBalance.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;
  if (pctEl) {
    pctEl.textContent = `${(calc.laborPct * 100).toFixed(1)}%`;
    pctEl.style.color = calc.laborPct <= targetLabor ? "#10b981" : "#f87171";
  }
}

function bindMonthlyEvents(container) {
  container.querySelector("#btnAddManualMonth")?.addEventListener("click", () => {
    showAddLaborMonthModal(container);
  });
}

function bindTasksEvents(container) {
  container.querySelectorAll(".labor-task-checkbox").forEach(box => {
    box.addEventListener("change", () => {
      store.toggleManagerTask(box.dataset.id);
      renderOfficeLabor(container);
    });
  });

  container.querySelector("#btnAddNewManagerTask")?.addEventListener("click", () => {
    showAddManagerTaskModal(container);
  });
}

/**
 * ייצוא דוח חודשי ושבועי מפורט לקובץ אקסל (CSV עם תמיכה מלאה בעברית UTF-8 BOM)
 */
function exportLaborReportToExcel(dailyLogs, monthlyLogs, monthFilter) {
  const lines = [];

  lines.push(["דוח לייבור מטבח — סיכום חודשי ופירוט שבועי לפי ימי עבודה"]);
  lines.push([`תאריך הפקה: ${new Date().toLocaleDateString("he-IL")}`, `סינון חודש: ${monthFilter}`]);
  lines.push([]);

  // חלק א': טבלת סיכום חודשי
  lines.push(["=== 1. סיכום חודשי מרוכז ==="]);
  lines.push([
    "חודש דיווח",
    "הכנסה ברוטו (כולל מעמ)",
    "הכנסה נטו (ללא מעמ)",
    "סהכ שעות עבודה",
    "שכר שעתי ברוטו",
    "שכר שף / גלובלי ברוטו",
    "עלות מעסיק כוללת דמי מעביד",
    "מאזן הכנסה נגד הוצאה",
    "אחוז לייבור %",
    "פדיון לשעה SPLH",
    "הערות"
  ]);

  monthlyLogs.forEach(m => {
    if (monthFilter !== "הכל" && m.monthId !== monthFilter) return;
    const totalH = (Number(m.serviceHours) || 0) + (Number(m.prepHours) || 0);
    const netBal = (Number(m.salesExclVat) || 0) - (Number(m.employerCost) || 0);
    lines.push([
      m.monthId,
      m.salesInclVat,
      m.salesExclVat,
      totalH,
      m.hourlyWagesGross,
      m.salariedGross,
      m.employerCost,
      netBal.toFixed(2),
      `${(m.laborPct * 100).toFixed(1)}%`,
      m.splh,
      m.notes || ""
    ]);
  });

  lines.push([]);
  lines.push(["=== 2. פירוט ימי עבודה ומשמרות לפי שבועות ==="]);
  lines.push([
    "תאריך",
    "יום בשבוע",
    "שבוע",
    "הכנסה ברוטו",
    "הכנסה נטו (ללא מעמ)",
    "סהכ שעות",
    "שכר שעתי ברוטו",
    "שכר גלובלי ברוטו",
    "סהכ שכר ברוטו",
    "מקדם מעביד",
    "עלות מעסיק כולל דמי מעביד",
    "הכנסה נגד הוצאה (נטו)",
    "אחוז לייבור %",
    "SPLH",
    "פירוט תיבות עובדים",
    "הערות"
  ]);

  dailyLogs.forEach(d => {
    const boxesDesc = [
      ...(d.hourlyBoxes || []).map(b => `${b.roleLabel}: ${b.hours}ש*${b.hourlyRate}₪`),
      ...(d.globalBoxes || []).map(g => `${g.roleLabel}: ${g.amount}₪ (גלובלי)`)
    ].join(" | ");

    lines.push([
      d.date,
      d.dayOfWeek,
      d.weekLabel,
      d.salesInclVat,
      d.salesExclVat,
      d.totalHours,
      d.hourlyGrossSum,
      d.globalGrossSum,
      d.totalGrossWages,
      d.employerMultiplier,
      d.employerCost,
      d.netBalance,
      `${(d.laborPct * 100).toFixed(1)}%`,
      d.splh,
      boxesDesc,
      d.notes || ""
    ]);
  });

  const csvContent = "\uFEFF" + lines
    .map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kitchen_labor_report_${monthFilter === "הכל" ? "all" : monthFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function showAddLaborMonthModal(container) {
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3 style="font-size: 16px; font-weight: 700;">➕ הזנת דוח חודשי ידני</h3>
        <button class="btn btn-secondary btn-close-modal">✕</button>
      </div>
      <form id="addLaborForm">
        <div class="modal-body">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm);">
            <div class="form-group">
              <label class="form-label">חודש דיווח (YYYY-MM)</label>
              <input type="text" class="form-input" id="laborMonthId" placeholder="2026-11" required />
            </div>
            <div class="form-group">
              <label class="form-label">פדיון ברוטו כולל מע"מ (₪)</label>
              <input type="number" step="any" class="form-input" id="laborSalesGross" placeholder="185000" required />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm);">
            <div class="form-group">
              <label class="form-label">שעות סרוויס בפועל</label>
              <input type="number" step="any" class="form-input" id="laborServiceHours" placeholder="220" required />
            </div>
            <div class="form-group">
              <label class="form-label">שעות הכנות וניקיון</label>
              <input type="number" step="any" class="form-input" id="laborPrepHours" placeholder="90" required />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm);">
            <div class="form-group">
              <label class="form-label">שכר שעתי ישיר ברוטו (₪)</label>
              <input type="number" step="any" class="form-input" id="laborHourlyWages" placeholder="14000" required />
            </div>
            <div class="form-group">
              <label class="form-label">שכר גלובלי (שף/מנהל ₪)</label>
              <input type="number" step="any" class="form-input" id="laborSalaried" placeholder="12000" required />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary btn-close-modal">ביטול</button>
          <button type="submit" class="btn btn-primary">שמור דוח חודשי</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelectorAll(".btn-close-modal").forEach(b => b.addEventListener("click", () => modal.remove()));

  modal.querySelector("#addLaborForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const gross = Number(modal.querySelector("#laborSalesGross").value) || 0;
    const vatRate = store.getState().config?.vatRate || 0.18;
    const net = gross / (1 + vatRate);

    store.addLaborMonth({
      monthId: modal.querySelector("#laborMonthId").value,
      salesInclVat: gross,
      salesExclVat: Number(net.toFixed(2)),
      serviceHours: Number(modal.querySelector("#laborServiceHours").value) || 0,
      prepHours: Number(modal.querySelector("#laborPrepHours").value) || 0,
      hourlyWagesGross: Number(modal.querySelector("#laborHourlyWages").value) || 0,
      salariedGross: Number(modal.querySelector("#laborSalaried").value) || 0
    });

    modal.remove();
    renderOfficeLabor(container);
  });
}

function showAddManagerTaskModal(container) {
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3 style="font-size: 16px; font-weight: 700;">➕ הוספת משימה חדשה</h3>
        <button class="btn btn-secondary btn-close-modal">✕</button>
      </div>
      <form id="addTaskForm">
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">תיאור המשימה</label>
            <input type="text" class="form-input" id="newTaskTitle" placeholder="למשל: סגירת הזמנת יינות מיוחדים..." required />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm);">
            <div class="form-group">
              <label class="form-label">תחום</label>
              <input type="text" class="form-input" id="newTaskArea" value="מטבח" required />
            </div>
            <div class="form-group">
              <label class="form-label">אחראי</label>
              <input type="text" class="form-input" id="newTaskAssignee" value="ישראל" required />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm);">
            <div class="form-group">
              <label class="form-label">עדיפות</label>
              <select class="form-select" id="newTaskPriority">
                <option value="רגילה">רגילה</option>
                <option value="גבוהה">גבוהה</option>
                <option value="דחופה">דחופה 🔥</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">תאריך יעד</label>
              <input type="date" class="form-input" id="newTaskDueDate" />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary btn-close-modal">ביטול</button>
          <button type="submit" class="btn btn-primary">שמור משימה</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelectorAll(".btn-close-modal").forEach(b => b.addEventListener("click", () => modal.remove()));

  modal.querySelector("#addTaskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    store.saveManagerTask({
      title: modal.querySelector("#newTaskTitle").value,
      area: modal.querySelector("#newTaskArea").value,
      assignee: modal.querySelector("#newTaskAssignee").value,
      priority: modal.querySelector("#newTaskPriority").value,
      dueDate: modal.querySelector("#newTaskDueDate").value
    });
    modal.remove();
    renderOfficeLabor(container);
  });
}
