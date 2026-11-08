/**
 * Office Mode — System Settings, Targets & Backup Management (מסך הגדרות מערכת ויעדים)
 * Configures financial targets (Food Cost %, Labor %, VAT %, Employer Cost Multiplier),
 * Cloud Sync status, and full JSON state Export / Import / Reset.
 */

import { store } from "../store.js";
import { SyncService } from "../services/syncService.js";

export function renderOfficeSettings(container) {
  const state = store.getState();
  const config = state.config || {};
  const syncStatus = SyncService.getStatus();

  const targetFcPct = ((Number(config.targetFoodCost) || 0.30) * 100).toFixed(1).replace(/\.0$/, "");
  const targetLaborPct = ((Number(config.targetLaborCost) || 0.15) * 100).toFixed(1).replace(/\.0$/, "");
  const vatPct = ((Number(config.vatRate) || 0.18) * 100).toFixed(1).replace(/\.0$/, "");
  const employerMult = Number(config.employerCostMultiplier) || 1.30;
  const kitchenName = config.kitchenName || "מרכז מבקרים יקב בוטיק";

  container.innerHTML = `
    <div class="office-settings">
      <!-- כותרת עליונה -->
      <div style="margin-bottom: var(--space-lg);">
        <h1 style="font-size: 22px; font-weight: 700;">⚙️ הגדרות מערכת, יעדים פיננסיים וגיבוי נתונים</h1>
        <p style="font-size: 13px; color: var(--color-text-dim);">
          ניהול פרמטרים לחישוב פוד-קוסט ולייבור בכל רחבי המערכת, סנכרון ענן וניהול גיבויים מקומיים.
        </p>
      </div>

      <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: var(--space-lg);">
        <!-- כרטיס 1: יעדים פיננסיים ופרמטרי חישוב -->
        <div class="card">
          <h3 class="card-title" style="font-size: 16px;">🎯 יעדים תפעוליים ופרמטרים פיננסיים</h3>
          <p class="card-subtitle" style="margin-bottom: var(--space-md);">
            שינוי ערכים אלו מעדכן אוטומטית את כל חישובי הרווחיות בסטודיו המתכונים, בדאשבורד ובבקרת הלייבור.
          </p>

          <form id="settingsConfigForm">
            <div class="form-group">
              <label class="form-label">שם המטבח / היחידה העסקית (מופיע בהודעות הרכש לספקים)</label>
              <input type="text" class="form-input" id="cfgKitchenName" value="${kitchenName}" required />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);">
              <div class="form-group">
                <label class="form-label">יעד פוד-קוסט תפריט מקסימלי (%)</label>
                <input type="number" step="0.5" min="5" max="90" class="form-input" id="cfgTargetFoodCost" value="${targetFcPct}" required />
                <div style="font-size: 11px; color: var(--color-text-dim); margin-top: 3px;">ברירת מחדל: 30% (מנות מעל יעד זה יסומנו באדום)</div>
              </div>

              <div class="form-group">
                <label class="form-label">יעד עלות לייבור מטבח מקסימלי (%)</label>
                <input type="number" step="0.5" min="5" max="90" class="form-input" id="cfgTargetLaborCost" value="${targetLaborPct}" required />
                <div style="font-size: 11px; color: var(--color-text-dim); margin-top: 3px;">ברירת מחדל: 15% מהפדיון החודשי נטו</div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);">
              <div class="form-group">
                <label class="form-label">שיעור מע"מ חוקי (%)</label>
                <input type="number" step="0.5" min="0" max="50" class="form-input" id="cfgVatRate" value="${vatPct}" required />
                <div style="font-size: 11px; color: var(--color-text-dim); margin-top: 3px;">משמש להפשטת מע"מ ממחירי התפריט לצרכן (18%)</div>
              </div>

              <div class="form-group">
                <label class="form-label">מקדם עלות מעסיק (Employer Multiplier)</label>
                <input type="number" step="0.01" min="1.00" max="2.50" class="form-input" id="cfgEmployerMult" value="${employerMult}" required />
                <div style="font-size: 11px; color: var(--color-text-dim); margin-top: 3px;">כולל סוציאליות ופנסיה (למשל 1.30 = תוספת 30% על הברוטו)</div>
              </div>
            </div>

            <div style="margin-top: var(--space-md); display: flex; justify-content: flex-end;">
              <button type="submit" class="btn btn-primary" style="min-height: 42px; padding: 0 24px;">
                💾 שמור הגדרות וחשב מחדש את המערכת
              </button>
            </div>
          </form>
        </div>

        <!-- עמודה שמאלית: גיבוי, שחזור וסנכרון -->
        <div style="display: flex; flex-direction: column; gap: var(--space-lg);">
          <!-- כרטיס 2: גיבוי ושחזור מסד הנתונים -->
          <div class="card">
            <h3 class="card-title" style="font-size: 16px;">💾 גיבוי, ייצוא ושחזור נתונים (Backup & Restore)</h3>
            <p class="card-subtitle" style="margin-bottom: var(--space-md);">
              הורד עותק מלא של כל מסד הנתונים (קטלוג, מתכונים, ספקים ולוגים) לקובץ JSON או שחזר מגיבוי קיים.
            </p>

            <div style="display: flex; flex-direction: column; gap: var(--space-sm);">
              <button type="button" class="btn btn-secondary" id="btnExportFullBackup" style="justify-content: space-between; width: 100%; padding: 12px 16px;">
                <span>📤 ייצא גיבוי מערכת מלא (JSON)</span>
                <span class="mono" style="font-size: 11px; color: var(--color-text-dim);">kitchen_os_backup.json</span>
              </button>

              <label class="btn btn-secondary" style="justify-content: space-between; width: 100%; padding: 12px 16px; cursor: pointer;">
                <span>📥 שחזר / ייבא מסד נתונים מקובץ גיבוי</span>
                <span style="font-size: 11px; color: var(--color-accent-primary); font-weight: 700;">בחר קובץ...</span>
                <input type="file" id="inputImportBackupFile" accept=".json,application/json" style="display: none;" />
              </label>
            </div>

            <div style="margin-top: var(--space-md); padding-top: var(--space-md); border-top: 1px solid var(--color-border-subtle); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 13px; font-weight: 600; color: var(--color-danger);">איפוס לברירת מחדל (Factory Reset)</div>
                <div style="font-size: 11px; color: var(--color-text-dim);">מוחק שינויים מקומיים וטוען מחדש את נתוני הבסיס של היקב</div>
              </div>
              <button type="button" class="btn btn-danger" id="btnFactoryReset" style="font-size: 12px;">
                🔄 אפס נתונים
              </button>
            </div>
          </div>

          <!-- כרטיס 3: סטטוס סנכרון, ענן 24/7 ותור אופליין -->
          <div class="card">
            <h3 class="card-title" style="font-size: 16px;">☁️ סנכרון ענן 24/7 (iPhone & Google Sheets)</h3>
            <p class="card-subtitle" style="margin-bottom: var(--space-md);">
              עבודה רציפה מהאייפון גם כשהמחשב כבוי מול גיליון Google Sheets ומסד הנתונים בענן.
            </p>

            <div style="background: #f8f9fa; padding: 12px 16px; border-radius: var(--radius-md); border: 1px solid var(--color-border-subtle); margin-bottom: var(--space-md);">
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;">
                <span>מצב חיבור רשת:</span>
                <strong style="color: ${syncStatus.isOnline ? 'var(--status-success)' : 'var(--color-danger)'};">
                  ${syncStatus.isOnline ? 'מחובר (Online) 🟢' : 'לא מקוון (Offline) 🔴'}
                </strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;">
                <span>מצב עבודה פעיל:</span>
                <strong style="color: var(--color-accent-primary);">${syncStatus.modeLabel || 'ענן + אחסון מכשיר 📱'}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px;">
                <span>פעולות ממתינות בתור אופליין:</span>
                <strong>${syncStatus.pendingCount} פעולות</strong>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 13px;">
                <span>סך ישויות במסד הפעיל:</span>
                <span>${state.catalog.length} פריטים | ${state.dishes.length} מתכונים | ${state.suppliers.length} ספקים</span>
              </div>
            </div>

            <div class="form-group" style="margin-bottom: var(--space-md);">
              <label class="form-label" style="font-size: 12px;">🔗 כתובת גשר ענן חי 24/7 ל-Google Sheets (Google Apps Script Web App URL)</label>
              <div style="display: flex; gap: var(--space-xs);">
                <input
                  type="url"
                  class="form-input mono"
                  id="cfgCloudBridgeUrl"
                  dir="ltr"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value="${syncStatus.cloudBridgeUrl || ''}"
                  style="font-size: 12px;"
                />
                <button type="button" class="btn btn-secondary" id="btnSaveCloudBridgeUrl" style="white-space: nowrap;">
                  שמור קישור
                </button>
              </div>
              <div style="font-size: 11px; color: var(--color-text-dim); margin-top: 4px;">
                מאפשר שמירה ומשיכה דו-כיוונית ישירות מהאייפון ל-Google Sheets ללא צורך במחשב דולק.
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: var(--space-xs);">
              <button type="button" class="btn btn-primary" id="btnPullFromGoogleSheets" style="width: 100%;">
                🔄 משוך נתונים עדכניים מ-Google Sheets / מהענן (Pull)
              </button>
              <button type="button" class="btn btn-secondary" id="btnForceFlushSync" style="width: 100%;">
                ☁️ דחוף את כל נתוני האפליקציה ל-Google Sheets (Push)
              </button>
              <a href="https://docs.google.com/spreadsheets/d/16ToeULQNGXZuYi7Jt08jkLrYbV28h1ad1Vg1tiHVVF4/edit#gid=1591781798" target="_blank" class="btn btn-secondary" style="width: 100%; text-decoration: none;">
                📊 פתח את גיליון Kitchen OS v2.0 ב-Google Sheets ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Save financial targets form
  container.querySelector("#settingsConfigForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fcVal = (Number(container.querySelector("#cfgTargetFoodCost").value) || 30) / 100;
    const laborVal = (Number(container.querySelector("#cfgTargetLaborCost").value) || 15) / 100;
    const vatVal = (Number(container.querySelector("#cfgVatRate").value) || 18) / 100;
    const multVal = Number(container.querySelector("#cfgEmployerMult").value) || 1.30;
    const kName = container.querySelector("#cfgKitchenName").value.trim() || "מרכז מבקרים יקב בוטיק";

    store.updateConfig({
      kitchenName: kName,
      targetFoodCost: Number(fcVal.toFixed(4)),
      targetLaborCost: Number(laborVal.toFixed(4)),
      vatRate: Number(vatVal.toFixed(4)),
      employerCostMultiplier: Number(multVal.toFixed(2))
    });

    alert("✅ הגדרות המערכת והיעדים הפיננסיים נשמרו ועודכנו בכל המודולים!");
    renderOfficeSettings(container);
  });

  // Export JSON backup
  container.querySelector("#btnExportFullBackup")?.addEventListener("click", () => {
    const dataStr = JSON.stringify(store.getState(), null, 2);
    const blob = new Blob([dataStr], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kitchen_os_v3_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  // Import JSON backup
  container.querySelector("#inputImportBackupFile")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || "{}"));
        if (confirm(`האם לשחזר את המערכת מתוך הקובץ "${file.name}"? הנתונים הנוכחיים יוחלפו.`)) {
          store.importFullState(parsed);
          alert("✅ מסד הנתונים שוחזר בהצלחה מקובץ הגיבוי!");
          renderOfficeSettings(container);
        }
      } catch (err) {
        alert("שגיאה בקריאת קובץ הגיבוי: " + err.message);
      }
    };
    reader.readAsText(file, "utf-8");
  });

  // Factory reset
  container.querySelector("#btnFactoryReset")?.addEventListener("click", () => {
    if (confirm("האם לאפס את כל נתוני המערכת לברירת המחדל הראשונית של היקב?")) {
      store.resetToDefaults();
      alert("✅ הנתונים אופסו לברירת המחדל בהצלחה!");
      renderOfficeSettings(container);
    }
  });

  // Save Cloud Bridge URL
  container.querySelector("#btnSaveCloudBridgeUrl")?.addEventListener("click", () => {
    const urlInput = container.querySelector("#cfgCloudBridgeUrl");
    const urlVal = urlInput ? urlInput.value.trim() : "";
    SyncService.setCloudBridgeUrl(urlVal);
    alert(urlVal
      ? "✅ כתובת גשר הענן נשמרה! מעכשיו האפליקציה מסנכרנת ישירות ל-Google Sheets גם כשהמחשב כבוי."
      : "ℹ️ כתובת גשר הענן הוסרה.");
    renderOfficeSettings(container);
  });

  // Pull live data from Google Sheets
  container.querySelector("#btnPullFromGoogleSheets")?.addEventListener("click", async () => {
    const btn = container.querySelector("#btnPullFromGoogleSheets");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "⏳ מושך נתונים מ-Google Sheets / מהענן...";
    }
    const ok = await store.hydrateFromServer(true);
    if (ok) {
      const s = store.getState();
      alert(`✅ הנתונים נמשכו בהצלחה!\nנטענו: ${s.catalog.length} חומרי גלם, ${s.suppliers.length} ספקים, ${s.dishes.length} מתכונים ו-${s.prepChecklist.length} משימות הכנה.`);
    } else {
      alert("⚠️ לא ניתן היה למשוך מהשרת. ודא שהגדרת גשר ענן או ש-run.bat פועל ברקע.");
    }
    renderOfficeSettings(container);
  });

  // Force flush sync (Push to Google Sheets)
  container.querySelector("#btnForceFlushSync")?.addEventListener("click", async () => {
    const btn = container.querySelector("#btnForceFlushSync");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "⏳ מסנכרן ל-Google Sheets...";
    }
    const ok = await SyncService.flushQueue(store.getState());
    renderOfficeSettings(container);
    if (ok) {
      alert("✅ כל הנתונים סונכרנו ונדחפו בהצלחה ל-Google Sheets!");
    } else {
      alert("ℹ️ הנתונים נשמרו בזיכרון המכשיר (LocalStorage). כדי לדחוף ל-Google Sheets כשהמחשב כבוי, הזן את כתובת גשר הענן (Apps Script URL) למעלה.");
    }
  });
}

