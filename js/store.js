/**
 * Store — Central reactive state container for Kitchen OS v3.0.
 * Handles persistence to LocalStorage, Pub/Sub subscriptions, and synchronization enqueueing.
 */

import { INITIAL_DATA } from "./seedData.js";
import { SyncService } from "./services/syncService.js";
import { InventoryService } from "./services/inventoryService.js";
import { CalculationService } from "./services/calculationService.js";

const STATE_STORAGE_KEY = "kitchen_os_v3_state_clean_v2";

class KitchenStore {
  constructor() {
    this.state = this.loadState();
    this.subscribers = [];
    this.hydrateFromServer();
  }

  mergeRemoteState(remoteState) {
    const prevOrders = Array.isArray(this.state?.logOrders) ? this.state.logOrders : [];
    const prevDeliveries = Array.isArray(this.state?.logDeliveries) ? this.state.logDeliveries : [];
    const prevSuppliers = Array.isArray(this.state?.suppliers) ? this.state.suppliers : [];

    // שמור על הגדרות ערוץ הזמנה ופורטל ספק שנקבעו מקומית אם הגשר בענן טרם החזיר אותם
    const mergedSuppliers = Array.isArray(remoteState.suppliers)
      ? remoteState.suppliers.map(rs => {
          const localSup = prevSuppliers.find(s => s.id === rs.id || s.name === rs.name);
          const seedSup = (INITIAL_DATA.suppliers || []).find(s => s.id === rs.id || s.name === rs.name);
          return {
            ...(seedSup || {}),
            ...(localSup || {}),
            ...rs,
            orderChannel: rs.orderChannel || localSup?.orderChannel || seedSup?.orderChannel || "WHATSAPP",
            portalUrl: rs.portalUrl || localSup?.portalUrl || seedSup?.portalUrl || ""
          };
        })
      : prevSuppliers;

    // מיזוג logOrders כך שהזמנות מקומיות לא יימחקו אם גשר הענן עוד לא עודכן עם LOG_Orders
    const remoteOrders = Array.isArray(remoteState.logOrders) ? remoteState.logOrders : [];
    const orderIds = new Set(remoteOrders.map(o => o.id));
    const mergedOrders = [
      ...remoteOrders,
      ...prevOrders.filter(o => o && o.id && !orderIds.has(o.id))
    ];

    const remoteDeliveries = Array.isArray(remoteState.logDeliveries) ? remoteState.logDeliveries : [];
    const dlvIds = new Set(remoteDeliveries.map(d => d.id));
    const mergedDeliveries = [
      ...remoteDeliveries,
      ...prevDeliveries.filter(d => d && d.id && !dlvIds.has(d.id))
    ];

    return {
      ...INITIAL_DATA,
      ...remoteState,
      suppliers: mergedSuppliers,
      logOrders: mergedOrders,
      logDeliveries: mergedDeliveries
    };
  }

  async hydrateFromServer(forcePullSheets = false) {
    if (typeof window === "undefined" || typeof fetch === "undefined") return false;

    const cloudUrl = SyncService.getCloudBridgeUrl();

    // 1. אם מוגדר גשר ענן חי (Google Apps Script Web App), משוך ישירות מ-Google Sheets בענן 24/7
    if (cloudUrl) {
      try {
        const sep = cloudUrl.includes("?") ? "&" : "?";
        const res = await fetch(`${cloudUrl}${sep}action=pull&t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          const remoteState = data.state || data;
          if (remoteState && Array.isArray(remoteState.catalog)) {
            this.state = this.mergeRemoteState(remoteState);
            localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(this.state));
            this.notify();
            return true;
          }
        }
      } catch (cloudErr) {
        console.warn("[Store] Cloud Bridge pull fallback:", cloudErr);
      }
    }

    // 2. אם רץ מול השרת המקומי (localhost:8090), משוך מ-/api/state או מ-/api/sheets/pull
    if (SyncService.isLocalServerOrigin()) {
      try {
        const endpoint = forcePullSheets ? "/api/sheets/pull" : "/api/state";
        const res = await fetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          if (data.state) {
            this.state = this.mergeRemoteState(data.state);
            localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(this.state));
            this.notify();
            return true;
          }
        }
      } catch (e) {
        // Continue to static cloud snapshot fallback
      }
    }

    // 3. מצב ענן סטטי (GitHub Pages / iPhone 24/7): טען את מסד הנתונים המלא מתוך ./data/kitchen_db.json
    // אם המשתמש לחץ על "משוך נתונים" או אם ה-state הנוכחי עדיין מכיל רק את נתוני ה-seed הראשוניים (פחות מ-50 פריטים)
    const needsInitialCloudHydration = !this.state.catalog || this.state.catalog.length < 50;
    if (forcePullSheets || needsInitialCloudHydration) {
      try {
        const res = await fetch(`./data/kitchen_db.json?t=${Date.now()}`);
        if (res.ok) {
          const snapshot = await res.json();
          const remoteState = snapshot.state || snapshot;
          if (remoteState && Array.isArray(remoteState.catalog)) {
            this.state = this.mergeRemoteState(remoteState);
            localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(this.state));
            this.notify();
            return true;
          }
        }
      } catch (err) {
        console.warn("[Store] Static cloud DB fetch fallback:", err);
      }
    }

    return false;
  }

  loadState() {
        try {
          const saved = localStorage.getItem(STATE_STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            // Ensure all entities exist
            return {
              ...INITIAL_DATA,
              ...parsed
            };
          }
        } catch (e) {
          console.warn("[Store] Could not load saved state, using seed defaults:", e);
        }
        return JSON.parse(JSON.stringify(INITIAL_DATA));
      }

      saveState() {
        try {
          localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(this.state));
        } catch (e) {
          console.error("[Store] Failed to save state to LocalStorage:", e);
        }
        this.notify();
      }

      async resetToDefaults() {
        const cleanBase = {
          ...JSON.parse(JSON.stringify(INITIAL_DATA)),
          logCounts: [],
          logWaste: [],
          logOrders: [],
          logDeliveries: [],
          logLabor: [],
          logLaborDaily: []
        };
        this.state = cleanBase;
        this.saveState();
        await this.hydrateFromServer(true);
        SyncService.enqueue("STATE_RESET", { timestamp: new Date().toISOString() });
      }

      subscribe(callback) {
        this.subscribers.push(callback);
        // Fire immediately with current state
        try { callback(this.state); } catch (e) { console.error(e); }
        return () => {
          this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
      }

      notify() {
        this.subscribers.forEach(cb => {
          try { cb(this.state); } catch (e) { console.error(e); }
        });
      }

      getState() {
        return this.state;
      }

      // ================= ACTIONS =================

      /**
       * שמירת אצווה של ספירת מלאי (Field Mode)
       */
      saveCountsBatch(countsMap, reporter = "צוות מטבח") {
        const newLogs = [];
        const updatedCatalog = this.state.catalog.map(item => {
          if (countsMap[item.id] !== undefined) {
            const { updatedItem, logEntry } = InventoryService.reconcileCount(
              item,
              countsMap[item.id],
              reporter
            );
            newLogs.push(logEntry);
            return updatedItem;
          }
          return item;
        });

        this.state.catalog = updatedCatalog;
        this.state.logCounts = [...newLogs, ...(this.state.logCounts || [])];
        this.saveState();

        SyncService.enqueue("COUNTS_BATCH_SAVED", {
          countsCount: newLogs.length,
          reporter,
          logs: newLogs
        });
      }

      /**
       * דיווח פחת מהיר (Field Mode)
       */
      logWaste({ itemId, wasteQty, wasteReason, reporter = "צוות מטבח", notes = "" }) {
        const item = this.state.catalog.find(c => c.id === itemId);
        if (!item) throw new Error("חומר גלם לא נמצא בקטלוג");

        const { updatedItem, logEntry } = InventoryService.createWasteEntry(
          item,
          wasteQty,
          wasteReason,
          reporter,
          notes
        );

        this.state.catalog = this.state.catalog.map(c => c.id === itemId ? updatedItem : c);
        this.state.logWaste = [logEntry, ...(this.state.logWaste || [])];
        this.saveState();

        SyncService.enqueue("WASTE_LOGGED", logEntry);
        return logEntry;
      }

      /**
       * סימון משימת הכנה בעמדה כהושלמה / פתוחה (Field Mode)
       */
      togglePrepTask(taskId) {
        this.state.prepChecklist = this.state.prepChecklist.map(task => {
          if (task.id === taskId) {
            const nextDone = !task.doneToday;
            SyncService.enqueue("PREP_TASK_TOGGLED", { taskId, doneToday: nextDone });
            return { ...task, doneToday: nextDone };
          }
          return task;
        });
        this.saveState();
      }

      /**
       * עדכון או הוספת מנה בסטודיו (Office Mode)
       */
      saveDish(dishData) {
        if (!dishData.id) {
          dishData.id = `DSH-${(this.state.dishes.length + 1).toString().padStart(2, "0")}`;
          this.state.dishes.push(dishData);
          SyncService.enqueue("DISH_CREATED", dishData);
        } else {
          this.state.dishes = this.state.dishes.map(d => d.id === dishData.id ? { ...d, ...dishData } : d);
          SyncService.enqueue("DISH_UPDATED", dishData);
        }
        this.saveState();
        return dishData;
      }

      deleteDish(dishId) {
        this.state.dishes = this.state.dishes.filter(d => d.id !== dishId);
        this.state.recipeLines = this.state.recipeLines.filter(l => l.parentDishId !== dishId);
        this.saveState();
        SyncService.enqueue("DISH_DELETED", { dishId });
      }

      /**
       * הוספת או עריכת שורת מרכיב ב-BOM (Office Mode)
       */
      saveRecipeLine(lineData) {
        if (!lineData.id) {
          lineData.id = `RL-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
          this.state.recipeLines.push(lineData);
          SyncService.enqueue("RECIPE_LINE_ADDED", lineData);
        } else {
          this.state.recipeLines = this.state.recipeLines.map(l => l.id === lineData.id ? { ...l, ...lineData } : l);
          SyncService.enqueue("RECIPE_LINE_UPDATED", lineData);
        }
        this.saveState();
        return lineData;
      }

      deleteRecipeLine(lineId) {
        this.state.recipeLines = this.state.recipeLines.filter(l => l.id !== lineId);
        this.saveState();
        SyncService.enqueue("RECIPE_LINE_DELETED", { lineId });
      }

      /**
       * שמירת חומר גלם בקטלוג (Office Mode)
       */
      saveCatalogItem(itemData) {
        if (!itemData.id) {
          const nextNum = (this.state.catalog.length + 1).toString().padStart(3, "0");
          itemData.id = `ITM-${nextNum}`;
          itemData.isActive = itemData.isActive ?? true;
          itemData.inCountForm = itemData.inCountForm ?? true;
          itemData.inWasteForm = itemData.inWasteForm ?? true;
          itemData.currentStock = Number(itemData.currentStock) || 0;
          this.state.catalog.push(itemData);
          SyncService.enqueue("CATALOG_ITEM_CREATED", itemData);
        } else {
          this.state.catalog = this.state.catalog.map(c => c.id === itemData.id ? { ...c, ...itemData } : c);
          SyncService.enqueue("CATALOG_ITEM_UPDATED", itemData);
        }
        this.saveState();
        return itemData;
      }

      /**
       * שמירת ספק (Office Mode)
       */
      saveSupplier(supData) {
        if (!supData.id) {
          const nextNum = (this.state.suppliers.length + 1).toString().padStart(2, "0");
          supData.id = `SUP-${nextNum}`;
          supData.isActive = supData.isActive ?? true;
          this.state.suppliers.push(supData);
          SyncService.enqueue("SUPPLIER_CREATED", supData);
        } else {
          this.state.suppliers = this.state.suppliers.map(s => s.id === supData.id ? { ...s, ...supData } : s);
          SyncService.enqueue("SUPPLIER_UPDATED", supData);
        }
        this.saveState();
        return supData;
      }

      /**
       * הוספת דיווח לייבור חודשי (Office Mode)
       */
      addLaborMonth(monthData) {
        const grossWages = (Number(monthData.hourlyWagesGross) || 0) + (Number(monthData.salariedGross) || 0);
        const multiplier = this.state.config.employerCostMultiplier || 1.30;
        const employerCost = grossWages * multiplier;
        const netSales = Number(monthData.salesExclVat) || 0;
        const laborPct = netSales > 0 ? (employerCost / netSales) : 0;
        const splh = CalculationService.calculateSplh(
          netSales,
          monthData.serviceHours,
          monthData.prepHours
        );

        const record = {
          ...monthData,
          grossWages,
          employerCost: Number(employerCost.toFixed(2)),
          laborPct: Number(laborPct.toFixed(4)),
          splh: Number(splh.toFixed(2))
        };

        // אם קיים חודש כזה – עדכן, אחרת הוסף
        const existingIdx = this.state.logLabor.findIndex(l => l.monthId === record.monthId);
        if (existingIdx >= 0) {
          this.state.logLabor[existingIdx] = record;
        } else {
          this.state.logLabor = [record, ...this.state.logLabor];
        }

        this.saveState();
        SyncService.enqueue("LABOR_MONTH_SAVED", record);
        return record;
      }

      /**
       * שמירה או עדכון של יום עבודה/משמרת בלייבור היומי/שבועי (Office Mode)
       * מעדכן אוטומטית גם את הסיכום החודשי של אותו חודש!
       */
      saveDailyLaborEntry(entryData) {
        if (!this.state.logLaborDaily) this.state.logLaborDaily = [];

        const vatRate = this.state.config?.vatRate || 0.18;
        const employerMult = entryData.employerMultiplier || this.state.config?.employerCostMultiplier || 1.30;

        const calc = CalculationService.calculateDailyLaborEntry({
          salesInclVat: entryData.salesInclVat,
          vatRate,
          employerCostMultiplier: employerMult,
          hourlyBoxes: entryData.hourlyBoxes || [],
          globalBoxes: entryData.globalBoxes || []
        });

        const dateStr = entryData.date || new Date().toISOString().slice(0, 10);
        const monthId = entryData.monthId || dateStr.slice(0, 7);

        const record = {
          id: entryData.id || `LBR-DAY-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          date: dateStr,
          monthId,
          weekLabel: entryData.weekLabel || "שבוע שוטף",
          dayOfWeek: entryData.dayOfWeek || "",
          hourlyBoxes: (entryData.hourlyBoxes || []).map((b, i) => ({
            id: b.id || `HB-${i + 1}`,
            roleLabel: b.roleLabel || `עובד שעתי #${i + 1}`,
            hours: Number(b.hours) || 0,
            hourlyRate: Number(b.hourlyRate) || 0
          })),
          globalBoxes: (entryData.globalBoxes || []).map((g, i) => ({
            id: g.id || `GB-${i + 1}`,
            roleLabel: g.roleLabel || `שף / גלובלי #${i + 1}`,
            amount: Number(g.amount) || 0
          })),
          ...calc,
          notes: entryData.notes || ""
        };

        const existingIdx = this.state.logLaborDaily.findIndex(d => d.id === record.id);
        if (existingIdx >= 0) {
          this.state.logLaborDaily[existingIdx] = record;
        } else {
          this.state.logLaborDaily = [record, ...this.state.logLaborDaily];
        }

        // סדר לפי תאריך יורד
        this.state.logLaborDaily.sort((a, b) => String(b.date).localeCompare(String(a.date)));

        // סנכרן ועדכן את הסיכום החודשי עבור חודש זה מתוך כלל ימי העבודה שלו (אם רלוונטי)
        this.recalculateMonthFromDaily(monthId);

        this.saveState();
        SyncService.enqueue("DAILY_LABOR_SAVED", record);
        return record;
      }

      deleteDailyLaborEntry(entryId) {
        const target = (this.state.logLaborDaily || []).find(d => d.id === entryId);
        this.state.logLaborDaily = (this.state.logLaborDaily || []).filter(d => d.id !== entryId);
        if (target && target.monthId) {
          this.recalculateMonthFromDaily(target.monthId);
        }
        this.saveState();
        SyncService.enqueue("DAILY_LABOR_DELETED", { entryId });
      }

      /**
       * אגרגציה אוטומטית של ימי העבודה בחודש מסוים לתוך טבלת הסיכום החודשית (logLabor)
       */
      recalculateMonthFromDaily(monthId) {
        const daysInMonth = (this.state.logLaborDaily || []).filter(d => d.monthId === monthId);
        if (daysInMonth.length === 0) return;

        let salesInclVat = 0;
        let salesExclVat = 0;
        let totalHours = 0;
        let hourlyWagesGross = 0;
        let salariedGross = 0;
        let employerCost = 0;

        daysInMonth.forEach(d => {
          salesInclVat += Number(d.salesInclVat) || 0;
          salesExclVat += Number(d.salesExclVat) || 0;
          totalHours += Number(d.totalHours) || 0;
          hourlyWagesGross += Number(d.hourlyGrossSum) || 0;
          salariedGross += Number(d.globalGrossSum) || 0;
          employerCost += Number(d.employerCost) || 0;
        });

        const laborPct = salesExclVat > 0 ? (employerCost / salesExclVat) : 0;
        const splh = totalHours > 0 ? (salesExclVat / totalHours) : 0;

        const aggregatedMonth = {
          monthId,
          salesInclVat: Number(salesInclVat.toFixed(2)),
          salesExclVat: Number(salesExclVat.toFixed(2)),
          serviceHours: Number(totalHours.toFixed(1)),
          prepHours: 0,
          hourlyWagesGross: Number(hourlyWagesGross.toFixed(2)),
          salariedGross: Number(salariedGross.toFixed(2)),
          grossWages: Number((hourlyWagesGross + salariedGross).toFixed(2)),
          employerCost: Number(employerCost.toFixed(2)),
          laborPct: Number(laborPct.toFixed(4)),
          splh: Number(splh.toFixed(2)),
          notes: `מחושב אוטומטית מ-${daysInMonth.length} ימי עבודה רשומים`
        };

        if (!this.state.logLabor) this.state.logLabor = [];
        const idx = this.state.logLabor.findIndex(m => m.monthId === monthId);
        if (idx >= 0) {
          this.state.logLabor[idx] = aggregatedMonth;
        } else {
          this.state.logLabor.unshift(aggregatedMonth);
        }
      }

      /**
       * ניהול משימות מנהל
       */
      toggleManagerTask(taskId) {
        this.state.managerTasks = this.state.managerTasks.map(t => {
          if (t.id === taskId) {
            const nextStatus = t.status === "הושלם" ? "לביצוע" : "הושלם";
            return { ...t, status: nextStatus };
          }
          return t;
        });
        this.saveState();
      }

      saveManagerTask(taskData) {
        if (!taskData.id) {
          taskData.id = `TSK-${(this.state.managerTasks.length + 1).toString().padStart(2, "0")}`;
          taskData.status = taskData.status || "לביצוע";
          this.state.managerTasks.unshift(taskData);
          SyncService.enqueue("MANAGER_TASK_CREATED", taskData);
        } else {
          this.state.managerTasks = this.state.managerTasks.map(t => t.id === taskData.id ? { ...t, ...taskData } : t);
          SyncService.enqueue("MANAGER_TASK_UPDATED", taskData);
        }
        this.saveState();
        return taskData;
      }

      deleteManagerTask(taskId) {
        this.state.managerTasks = (this.state.managerTasks || []).filter(t => t.id !== taskId);
        this.saveState();
        SyncService.enqueue("MANAGER_TASK_DELETED", { taskId });
      }

      // ================= PURCHASE ORDERS & DELIVERIES (הזמנות רכש וקבלת סחורה) =================

      /**
       * תיעוד הזמנת רכש שיצאה לספק (וואטסאפ / מערכת הזמנות חיצונית של הספק / סוכן)
       */
      recordPurchaseOrder({
        supplierId,
        orderChannel = "WHATSAPP",
        externalOrderRef = "",
        orderedBy = "ישראל - שטח",
        notes = "",
        items = []
      }) {
        const supplier = (this.state.suppliers || []).find(s => s.id === supplierId);
        const validItems = (items || [])
          .filter(i => (Number(i.orderedQty) || 0) > 0)
          .map(i => {
            const catItem = (this.state.catalog || []).find(c => c.id === i.itemId);
            const qty = Number(i.orderedQty) || 0;
            const unitCost = Number(i.unitCostSnapshot ?? catItem?.unitCostExclVat) || 0;
            return {
              itemId: i.itemId,
              itemName: i.itemName || catItem?.name || i.itemId,
              supplierSku: i.supplierSku || catItem?.supplierSku || "",
              unit: i.unit || catItem?.stockUnit || 'ק"ג',
              orderedQty: qty,
              unitCostSnapshot: unitCost,
              estimatedLineTotal: Number((qty * unitCost).toFixed(2))
            };
          });

        if (validItems.length === 0) {
          throw new Error("לא נבחרו פריטים עם כמות חיובית לתיעוד ההזמנה");
        }

        const estimatedTotalExclVat = validItems.reduce((sum, l) => sum + l.estimatedLineTotal, 0);

        const orderEntry = {
          id: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          timestamp: new Date().toISOString(),
          supplierId: supplier ? supplier.id : supplierId,
          supplierName: supplier ? supplier.name : "ספק",
          orderChannel: orderChannel || supplier?.orderChannel || "WHATSAPP",
          externalOrderRef: externalOrderRef.trim(),
          orderedBy: orderedBy.trim() || "ישראל",
          status: "ORDERED", // ORDERED | RECEIVED
          estimatedTotalExclVat: Number(estimatedTotalExclVat.toFixed(2)),
          notes: notes.trim(),
          items: validItems
        };

        if (!this.state.logOrders) this.state.logOrders = [];
        this.state.logOrders = [orderEntry, ...this.state.logOrders];
        this.saveState();

        SyncService.enqueue("ORDER_RECORDED", orderEntry);
        return orderEntry;
      }

      /**
       * מחיקת / ביטול הזמנת רכש מיומן ההזמנות
       */
      deleteOrderLog(orderId) {
        this.state.logOrders = (this.state.logOrders || []).filter(o => o.id !== orderId);
        this.saveState();
        SyncService.enqueue("ORDER_LOG_DELETED", { orderId });
      }

      /**
       * קליטת משלוח ספק, הוספת כמויות למלאי, עדכון מחירי קנייה בקטלוג וסגירת הזמנת רכש פתוחה
       */
      recordDelivery(deliveryData) {
        const supplier = this.state.suppliers.find(s => s.id === deliveryData.supplierId);
        const { updatedCatalog, deliveryEntry } = InventoryService.receiveDelivery(
          this.state.catalog,
          supplier,
          deliveryData
        );

        if (deliveryEntry.items.length === 0) {
          throw new Error("לא הוזנו פריטים עם כמות חיובית לקליטה במשלוח");
        }

        // קישור וסגירה אוטומטית של הזמנה פתוחה עבור ספק זה (או לפי orderId מפורש)
        if (!this.state.logOrders) this.state.logOrders = [];
        const targetOrderId = deliveryData.orderId || (
          this.state.logOrders.find(o => o.supplierId === deliveryData.supplierId && o.status === "ORDERED")?.id
        );

        if (targetOrderId) {
          deliveryEntry.linkedOrderId = targetOrderId;
          this.state.logOrders = this.state.logOrders.map(o => {
            if (o.id === targetOrderId) {
              return {
                ...o,
                status: "RECEIVED",
                receivedAt: deliveryEntry.timestamp,
                linkedDeliveryId: deliveryEntry.id,
                invoiceNumber: deliveryEntry.invoiceNumber
              };
            }
            return o;
          });
        }

        this.state.catalog = updatedCatalog;
        this.state.logDeliveries = [deliveryEntry, ...(this.state.logDeliveries || [])];
        this.saveState();

        SyncService.enqueue("DELIVERY_RECORDED", deliveryEntry);
        return deliveryEntry;
      }

      /**
       * ביטול / מחיקת משלוח מרשימת הלוגים (עם אפשרות לגרוע חזרה מהמלאי ולהחזיר את ההזמנה לסטטוס פתוחה)
       */
      deleteDeliveryLog(deliveryId, revertStock = true) {
        const list = this.state.logDeliveries || [];
        const target = list.find(d => d.id === deliveryId);
        if (!target) return;

        if (revertStock && Array.isArray(target.items)) {
          this.state.catalog = this.state.catalog.map(catItem => {
            const line = target.items.find(i => i.itemId === catItem.id);
            if (!line) return catItem;
            const nextStock = Math.max(0, (Number(catItem.currentStock) || 0) - (Number(line.receivedQty) || 0));
            return {
              ...catItem,
              currentStock: Number(nextStock.toFixed(3))
            };
          });
        }

        if (target.linkedOrderId && Array.isArray(this.state.logOrders)) {
          this.state.logOrders = this.state.logOrders.map(o => {
            if (o.id === target.linkedOrderId) {
              return {
                ...o,
                status: "ORDERED",
                receivedAt: undefined,
                linkedDeliveryId: undefined
              };
            }
            return o;
          });
        }

        this.state.logDeliveries = list.filter(d => d.id !== deliveryId);
        this.saveState();
        SyncService.enqueue("DELIVERY_LOG_DELETED", { deliveryId, revertStock });
      }

      // ================= PREP CHECKLIST BANK (ניהול בנק הכנות וצ'קליסטים) =================

      savePrepTask(taskData) {
        if (!this.state.prepChecklist) this.state.prepChecklist = [];
        if (!taskData.id) {
          const nextNum = (this.state.prepChecklist.length + 1).toString().padStart(2, "0");
          taskData.id = `PREP-${nextNum}-${Math.random().toString(36).substr(2, 3)}`;
          taskData.doneToday = taskData.doneToday ?? false;
          taskData.estMinutes = Number(taskData.estMinutes) || 15;
          this.state.prepChecklist.push(taskData);
          SyncService.enqueue("PREP_TASK_CREATED", taskData);
        } else {
          this.state.prepChecklist = this.state.prepChecklist.map(t =>
            t.id === taskData.id ? { ...t, ...taskData, estMinutes: Number(taskData.estMinutes) || 15 } : t
          );
          SyncService.enqueue("PREP_TASK_UPDATED", taskData);
        }
        this.saveState();
        return taskData;
      }

      deletePrepTask(taskId) {
        this.state.prepChecklist = (this.state.prepChecklist || []).filter(t => t.id !== taskId);
        this.saveState();
        SyncService.enqueue("PREP_TASK_DELETED", { taskId });
      }

      resetAllPrepTasks(stationFilter = "הכל") {
        this.state.prepChecklist = (this.state.prepChecklist || []).map(task => {
          if (stationFilter === "הכל" || task.station === stationFilter) {
            return { ...task, doneToday: false };
          }
          return task;
        });
        this.saveState();
        SyncService.enqueue("PREP_CHECKLIST_RESET", { stationFilter, timestamp: new Date().toISOString() });
      }

      markAllPrepTasksDone(stationFilter = "הכל") {
        this.state.prepChecklist = (this.state.prepChecklist || []).map(task => {
          if (stationFilter === "הכל" || task.station === stationFilter) {
            return { ...task, doneToday: true };
          }
          return task;
        });
        this.saveState();
        SyncService.enqueue("PREP_CHECKLIST_MARKED_DONE", { stationFilter });
      }

      // ================= LOGS & AUDIT MANAGEMENT (מרכז לוגים והיסטוריה) =================

      deleteWasteLog(wasteId, revertStock = true) {
        const list = this.state.logWaste || [];
        const target = list.find(w => (w.id || w.wasteId) === wasteId);
        if (!target) return;

        if (revertStock && target.itemId) {
          this.state.catalog = this.state.catalog.map(catItem => {
            if (catItem.id !== target.itemId) return catItem;
            const restored = (Number(catItem.currentStock) || 0) + (Number(target.wasteQty) || 0);
            return {
              ...catItem,
              currentStock: Number(restored.toFixed(3))
            };
          });
        }

        this.state.logWaste = list.filter(w => (w.id || w.wasteId) !== wasteId);
        this.saveState();
        SyncService.enqueue("WASTE_LOG_DELETED", { wasteId, revertStock });
      }

      deleteCountLog(countId) {
        this.state.logCounts = (this.state.logCounts || []).filter(c => (c.id || c.countId) !== countId);
        this.saveState();
        SyncService.enqueue("COUNT_LOG_DELETED", { countId });
      }

      // ================= SYSTEM SETTINGS & BACKUP (הגדרות מערכת ויעדים) =================

      updateConfig(newConfig) {
        this.state.config = {
          ...this.state.config,
          ...newConfig
        };
        this.saveState();
        SyncService.enqueue("CONFIG_UPDATED", this.state.config);
        return this.state.config;
      }

      importFullState(importedState) {
        if (!importedState || typeof importedState !== "object" || !Array.isArray(importedState.catalog)) {
          throw new Error("קובץ הגיבוי אינו תקין או שחסרה בו טבלת קטלוג (catalog)");
        }
        this.state = {
          ...JSON.parse(JSON.stringify(INITIAL_DATA)),
          ...importedState
        };
        this.saveState();
        SyncService.enqueue("FULL_STATE_IMPORTED", { timestamp: new Date().toISOString() });
      }
    }

    export const store = new KitchenStore();
