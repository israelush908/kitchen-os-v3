/**
 * Kitchen OS v3.0 — Google Apps Script Serverless 24/7 Cloud Bridge
 * Spreadsheet ID: 16ToeULQNGXZuYi7Jt08jkLrYbV28h1ad1Vg1tiHVVF4
 *
 * הוראות הפעלה חד-פעמיות (דקה אחת):
 * 1. פתח את הגיליון שלך ב-Google Sheets:
 *    https://docs.google.com/spreadsheets/d/16ToeULQNGXZuYi7Jt08jkLrYbV28h1ad1Vg1tiHVVF4/edit
 * 2. בתפריט העליון לחץ על: תוספים (Extensions) -> Apps Script.
 * 3. מחק את הקוד הקיים, הדבק את כל הקובץ הזה ושמור (Ctrl+S).
 * 4. לחץ למעלה בצד שמאל על "פריסה" (Deploy) -> "פריסה חדשה" (New deployment).
 * 5. בחר בסוג: "אפליקציית אינטרנט" (Web app):
 *    - הפעלה בתור (Execute as): "אני" (Me)
 *    - למי יש גישה (Who has access): "כל אחד" (Anyone)
 * 6. לחץ על "פריסה" (Deploy), העתק את כתובת ה-URL שמתקבלת (מסיימת ב-/exec),
 *    והדבק אותה באפליקציה תחת "הגדרות ויעדים" -> "כתובת גשר ענן 24/7".
 */

var SPREADSHEET_ID = "16ToeULQNGXZuYi7Jt08jkLrYbV28h1ad1Vg1tiHVVF4";

function getSpreadsheet() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (e) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

function cleanText(val) {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

function toNum(val, fallback) {
  if (val === null || val === undefined || val === "") return fallback !== undefined ? fallback : 0;
  if (typeof val === "number") return isNaN(val) ? (fallback || 0) : val;
  var cleaned = String(val).replace(/[₪,%\s]/g, "");
  var n = parseFloat(cleaned);
  return isNaN(n) ? (fallback !== undefined ? fallback : 0) : n;
}

/**
 * GET Endpoint — Pulls full live state from Google Sheets to iPhone / Desktop
 */
function doGet(e) {
  try {
    var state = pullFullState();
    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok", state: state, timestamp: new Date().toISOString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * POST Endpoint — Pushes actions and updated state from iPhone / Desktop into Google Sheets
 */
function doPost(e) {
  try {
    var rawBody = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    var payload = JSON.parse(rawBody);
    var actions = payload.actions || [];
    var state = payload.state || null;

    var result = pushStateToSheets(state, actions);
    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok", synced: true, details: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheetValues(ss, sheetName) {
  var sh = ss.getSheetByName(sheetName);
  if (!sh) return [];
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];
  return sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
}

function pullFullState() {
  var ss = getSpreadsheet();

  var supCfgRows = getSheetValues(ss, "DB_Config_Suppliers");
  var catRows = getSheetValues(ss, "DB_Catalog");
  var invRows = getSheetValues(ss, "OPS_Inventory_Orders");
  var recAllRows = getSheetValues(ss, "OPS_Recipes_FoodCost");
  var laborMRows = getSheetValues(ss, "OPS_Labor_Tracker");
  var tasksRows = getSheetValues(ss, "OPS_Kitchen_Tasks");
  var countsRows = getSheetValues(ss, "LOG_Counts");
  var wasteRows = getSheetValues(ss, "LOG_Waste");
  var dailyLaborRows = getSheetValues(ss, "OPS_Daily_Labor");
  var deliveriesRows = getSheetValues(ss, "LOG_Deliveries");

  var config = {
    kitchenName: "מרכז מבקרים יקב בוטיק",
    targetFoodCost: 0.30,
    targetLaborCost: 0.15,
    employerCostMultiplier: 1.30,
    vatRate: 0.18,
    currency: "₪"
  };

  var suppliers = [];
  var supplierNameToId = {};

  for (var i = 0; i < supCfgRows.length; i++) {
    var r = supCfgRows[i];
    if (r.length > 9 && cleanText(r[8])) {
      var cfgKey = cleanText(r[8]);
      var cfgVal = toNum(r[9], null);
      if (cfgVal !== null) {
        if (cfgKey.indexOf("Target_FoodCost") >= 0 || cfgKey.indexOf("פוד קוסט") >= 0) config.targetFoodCost = cfgVal;
        else if (cfgKey.indexOf("Target_LaborCost") >= 0 || cfgKey.indexOf("לייבור") >= 0) config.targetLaborCost = cfgVal;
        else if (cfgKey.indexOf("Employer_Cost") >= 0 || cfgKey.indexOf("מעסיק") >= 0) config.employerCostMultiplier = cfgVal;
        else if (cfgKey.indexOf("VAT") >= 0 || cfgKey.indexOf('מע"מ') >= 0) config.vatRate = cfgVal;
      }
    }

    var supName = cleanText(r[1]);
    if (supName) {
      var supId = cleanText(r[0]) || ("SUP-" + ("0" + (i + 1)).slice(-2));
      var daysRaw = cleanText(r[5]);
      var daysList = daysRaw ? daysRaw.split(",").map(function(d) { return d.trim(); }).filter(Boolean) : ["ראשון", "שלישי", "חמישי"];
      suppliers.push({
        id: supId,
        name: supName,
        category: cleanText(r[2]) || "כללי",
        contactName: cleanText(r[3]),
        whatsappPhone: cleanText(r[4]),
        deliveryDays: daysList,
        isActive: r[6] === false ? false : true
      });
      supplierNameToId[supName] = supId;
    }
  }

  var itemStockMap = {};
  for (var j = 0; j < invRows.length; j++) {
    var ir = invRows[j];
    var iname = cleanText(ir[1]);
    if (iname) {
      itemStockMap[iname] = toNum(ir[7], 0);
    }
  }

  var catalog = [];
  var itemNameToId = {};
  for (var k = 0; k < catRows.length; k++) {
    var cr = catRows[k];
    var cname = cleanText(cr[1]);
    if (!cname) continue;
    var cid = cleanText(cr[0]) || ("ITM-" + ("00" + (k + 1)).slice(-3));
    var cSupName = cleanText(cr[3]);
    var cSupId = supplierNameToId[cSupName] || (suppliers[0] ? suppliers[0].id : "SUP-01");
    catalog.push({
      id: cid,
      name: cname,
      category: cleanText(cr[2]) || "כללי",
      supplierId: cSupId,
      supplierName: cSupName,
      stockUnit: cleanText(cr[4]) || 'ק"ג',
      unitCostExclVat: toNum(cr[5], 0),
      yieldLossPct: toNum(cr[6], 0),
      parLevelWeekend: toNum(cr[8], 10),
      reorderPoint: toNum(cr[9], 2),
      currentStock: itemStockMap[cname] !== undefined ? itemStockMap[cname] : 0,
      isActive: cr[10] === false ? false : true,
      inCountForm: cr[11] === false ? false : true,
      inWasteForm: cr[12] === false ? false : true,
      notes: cleanText(cr[13])
    });
    itemNameToId[cname] = cid;
  }

  var dishes = [];
  var dishNameToId = {};
  var recipeLines = [];

  for (var m = 0; m < recAllRows.length; m++) {
    var rr = recAllRows[m];
    var dname = cleanText(rr[0]);
    if (dname) {
      var dcat = cleanText(rr[1]) || "כללי";
      var priceInc = toNum(rr[5], 0);
      var isSub = dcat.indexOf("הכנה") >= 0 || priceInc === 0;
      var did = "DSH-" + ("0" + (dishes.length + 1)).slice(-2);
      dishes.push({
        id: did,
        name: dname,
        dishType: isSub ? "SUB_RECIPE" : "MENU_ITEM",
        category: dcat,
        yieldPortions: toNum(rr[2], 1) || 1,
        priceInclVat: priceInc,
        weeklySalesQty: toNum(rr[11], 35),
        prepInstructions: ""
      });
      dishNameToId[dname] = did;
    }
  }

  for (var n = 0; n < recAllRows.length; n++) {
    var rb = recAllRows[n];
    var parentName = cleanText(rb[13]);
    var ingName = cleanText(rb[14]);
    if (!parentName || !ingName) continue;
    var parentId = dishNameToId[parentName] || "DSH-01";
    var isSubComp = Boolean(dishNameToId[ingName]);
    recipeLines.push({
      id: "RL-" + ("00" + (recipeLines.length + 1)).slice(-3),
      parentDishId: parentId,
      parentDishName: parentName,
      componentType: isSubComp ? "SUB_RECIPE" : "RAW_ITEM",
      componentId: isSubComp ? dishNameToId[ingName] : (itemNameToId[ingName] || ingName),
      componentName: ingName,
      quantity: toNum(rb[15], 1),
      unit: cleanText(rb[16]) || 'ק"ג',
      notes: cleanText(rb[18])
    });
  }

  var managerTasks = [];
  var prepChecklist = [];
  for (var t = 0; t < tasksRows.length; t++) {
    var tr = tasksRows[t];
    var tid = cleanText(tr[0]);
    var ttitle = cleanText(tr[1]);
    if (tid || ttitle) {
      var rawStatus = cleanText(tr[7]);
      managerTasks.push({
        id: tid || ("TSK-" + (t + 1)),
        title: ttitle || cleanText(tr[8]) || ("משימה " + tid),
        area: cleanText(tr[2]) || "מטבח",
        assignee: cleanText(tr[3]) || "ישראל",
        priority: cleanText(tr[4]) || "רגילה",
        frequency: cleanText(tr[5]) || "חד-פעמי",
        dueDate: cleanText(tr[6]),
        status: rawStatus.indexOf("הושלם") >= 0 ? "הושלם" : "לביצוע",
        notes: cleanText(tr[8])
      });
    }
    if (tr.length > 11 && cleanText(tr[11])) {
      prepChecklist.push({
        id: "PREP-" + ("0" + (prepChecklist.length + 1)).slice(-2),
        station: cleanText(tr[10]) || "כללי",
        prepItem: cleanText(tr[11]),
        frequency: cleanText(tr[12]) || "יומי",
        estMinutes: toNum(tr[13], 15),
        doneToday: Boolean(tr[14]),
        instructions: cleanText(tr[15])
      });
    }
  }

  var logLabor = [];
  for (var l = 0; l < laborMRows.length; l++) {
    var lr = laborMRows[l];
    var mName = cleanText(lr[0]);
    var sInc = toNum(lr[1], null);
    if (!mName || sInc === null) continue;
    logLabor.push({
      monthId: mName,
      salesInclVat: sInc,
      salesExclVat: toNum(lr[2], sInc / 1.18),
      serviceHours: toNum(lr[3], 0),
      prepHours: toNum(lr[4], 0),
      hourlyWagesGross: toNum(lr[6], 0),
      salariedGross: toNum(lr[7], 0),
      grossWages: toNum(lr[6], 0) + toNum(lr[7], 0),
      employerCost: toNum(lr[9], 0),
      laborPct: toNum(lr[10], 0),
      splh: toNum(lr[13], 0),
      notes: cleanText(lr[15])
    });
  }

  var logLaborDaily = [];
  for (var dl = 0; dl < dailyLaborRows.length; dl++) {
    var dlr = dailyLaborRows[dl];
    var dDate = cleanText(dlr[0]);
    if (!dDate) continue;
    var parsedBoxes = { hourlyBoxes: [], globalBoxes: [] };
    try {
      if (dlr[16]) parsedBoxes = JSON.parse(String(dlr[16]));
    } catch (e) {}
    logLaborDaily.push({
      id: "LBR-DAY-" + (dl + 1),
      date: dDate,
      monthId: dDate.slice(0, 7),
      dayOfWeek: cleanText(dlr[1]),
      weekLabel: cleanText(dlr[2]) || "שבוע שוטף",
      salesInclVat: toNum(dlr[3], 0),
      salesExclVat: toNum(dlr[4], 0),
      totalHours: toNum(dlr[5], 0),
      hourlyGrossSum: toNum(dlr[6], 0),
      globalGrossSum: toNum(dlr[7], 0),
      totalGrossWages: toNum(dlr[8], 0),
      employerMultiplier: toNum(dlr[9], 1.3),
      employerCost: toNum(dlr[10], 0),
      netBalance: toNum(dlr[11], 0),
      laborPct: toNum(dlr[12], 0),
      splh: toNum(dlr[13], 0),
      notes: cleanText(dlr[15]),
      hourlyBoxes: parsedBoxes.hourlyBoxes || [],
      globalBoxes: parsedBoxes.globalBoxes || []
    });
  }

  var logCounts = [];
  for (var cIdx = countsRows.length - 1; cIdx >= 0 && logCounts.length < 150; cIdx--) {
    var cntR = countsRows[cIdx];
    var cntName = cleanText(cntR[1]);
    if (!cntName) continue;
    logCounts.push({
      id: "CNT-" + (cIdx + 1),
      timestamp: cleanText(cntR[0]),
      itemId: itemNameToId[cntName] || "",
      itemName: cntName,
      countedQty: toNum(cntR[2], 0),
      unit: cleanText(cntR[3]),
      unitCostSnapshot: toNum(cntR[4], 0),
      totalCountValue: toNum(cntR[5], 0),
      reporter: cleanText(cntR[6]) || "צוות מטבח"
    });
  }

  var logWaste = [];
  for (var wIdx = wasteRows.length - 1; wIdx >= 0; wIdx--) {
    var wstR = wasteRows[wIdx];
    var wstName = cleanText(wstR[2]);
    if (!wstName) continue;
    logWaste.push({
      id: "WST-" + (wIdx + 1),
      timestamp: cleanText(wstR[0]),
      reporter: cleanText(wstR[1]) || "ישראל",
      itemId: itemNameToId[wstName] || "",
      itemName: wstName,
      wasteQty: toNum(wstR[3], 0),
      stockUnit: cleanText(wstR[4]),
      wasteReason: cleanText(wstR[5]) || "פג תוקף / קלקול",
      unitCostSnapshot: toNum(wstR[6], 0),
      totalWasteCost: toNum(wstR[7], 0),
      notes: cleanText(wstR[8])
    });
  }

  var logDeliveries = [];
  for (var delIdx = 0; delIdx < deliveriesRows.length; delIdx++) {
    var delR = deliveriesRows[delIdx];
    if (!cleanText(delR[0])) continue;
    var delItems = [];
    try { delItems = JSON.parse(cleanText(delR[7]) || "[]"); } catch (e) {}
    logDeliveries.push({
      id: cleanText(delR[0]),
      timestamp: cleanText(delR[1]),
      supplierName: cleanText(delR[2]),
      invoiceNumber: cleanText(delR[3]),
      receivedBy: cleanText(delR[4]),
      totalAmountExclVat: toNum(delR[5], 0),
      notes: cleanText(delR[6]),
      items: delItems
    });
  }

  return {
    config: config,
    suppliers: suppliers,
    catalog: catalog,
    dishes: dishes,
    recipeLines: recipeLines,
    prepChecklist: prepChecklist,
    managerTasks: managerTasks,
    logCounts: logCounts,
    logWaste: logWaste,
    logLabor: logLabor,
    logLaborDaily: logLaborDaily,
    logDeliveries: logDeliveries
  };
}

function pushStateToSheets(state, actions) {
  var ss = getSpreadsheet();
  actions = actions || [];

  // 1. Append incremental logs (Counts, Waste, Deliveries)
  var shCounts = ss.getSheetByName("LOG_Counts");
  var shWaste = ss.getSheetByName("LOG_Waste");

  for (var i = 0; i < actions.length; i++) {
    var act = actions[i];
    var type = act.type || "";
    var p = act.payload || {};

    if (type === "COUNTS_BATCH_SAVED" && shCounts && p.logs) {
      for (var c = 0; c < p.logs.length; c++) {
        var l = p.logs[c];
        var nextRow = shCounts.getLastRow() + 1;
        var dt = String(l.timestamp || new Date().toISOString()).slice(0, 10);
        shCounts.getRange(nextRow, 1, 1, 3).setValues([[dt, l.itemName || "", Number(l.countedQty || 0)]]);
        shCounts.getRange(nextRow, 7, 1, 1).setValues([[l.reporter || "צוות מטבח"]]);
      }
    } else if (type === "WASTE_LOGGED" && shWaste) {
      var nextWRow = shWaste.getLastRow() + 1;
      var wDt = String(p.timestamp || new Date().toISOString()).slice(0, 10);
      shWaste.getRange(nextWRow, 1, 1, 4).setValues([[wDt, p.reporter || "ישראל", p.itemName || "", Number(p.wasteQty || 0)]]);
      shWaste.getRange(nextWRow, 6, 1, 1).setValues([[p.wasteReason || "פג תוקף / קלקול"]]);
      shWaste.getRange(nextWRow, 9, 1, 1).setValues([[p.notes || ""]]);
    } else if (type === "DELIVERY_RECORDED") {
      var shDel = ss.getSheetByName("LOG_Deliveries");
      if (!shDel) {
        shDel = ss.insertSheet("LOG_Deliveries");
        shDel.setRightToLeft(true);
        shDel.appendRow(["מזהה משלוח", "תאריך", "ספק", "מספר תעודה", 'נקלט ע"י', 'סכום ללא מע"מ', "הערות", "פירוט JSON"]);
      }
      shDel.appendRow([
        p.id || "",
        String(p.timestamp || "").slice(0, 16).replace("T", " "),
        p.supplierName || "",
        p.invoiceNumber || "",
        p.receivedBy || "ישראל",
        Number(p.totalAmountExclVat || 0),
        p.notes || "",
        JSON.stringify(p.items || [])
      ]);
      if (shCounts && p.items) {
        var dDt = String(p.timestamp || new Date().toISOString()).slice(0, 10);
        for (var di = 0; di < p.items.length; di++) {
          var itm = p.items[di];
          var nr = shCounts.getLastRow() + 1;
          shCounts.getRange(nr, 1, 1, 3).setValues([[dDt, itm.itemName || "", Number(itm.newStock || 0)]]);
          shCounts.getRange(nr, 7, 1, 1).setValues([["קבלת סחורה (" + (p.invoiceNumber || "") + ")"]]);
        }
      }
    }
  }

  if (!state) return { actionsProcessed: actions.length };

  // 2. Sync Prep Checklist & Manager Tasks in OPS_Kitchen_Tasks
  var shTasks = ss.getSheetByName("OPS_Kitchen_Tasks");
  if (shTasks) {
    if (state.managerTasks && state.managerTasks.length > 0) {
      var tRows = state.managerTasks.map(function(t) {
        return [
          t.id || "",
          t.title || "",
          t.area || "מטבח",
          t.assignee || "ישראל",
          t.priority || "רגילה",
          t.frequency || "חד-פעמי",
          t.dueDate || "",
          t.status === "הושלם" ? "✅ הושלם" : "⏳ לביצוע",
          t.notes || ""
        ];
      });
      shTasks.getRange(2, 1, 50, 9).clearContent();
      shTasks.getRange(2, 1, tRows.length, 9).setValues(tRows);
    }
    if (state.prepChecklist && state.prepChecklist.length > 0) {
      var pRows = state.prepChecklist.map(function(p) {
        return [
          p.station || "כללי",
          p.prepItem || "",
          p.frequency || "יומי",
          Number(p.estMinutes || 15),
          Boolean(p.doneToday),
          p.instructions || ""
        ];
      });
      shTasks.getRange(2, 11, 50, 6).clearContent();
      shTasks.getRange(2, 11, pRows.length, 6).setValues(pRows);
    }
  }

  // 3. Sync Daily/Weekly Labor in OPS_Daily_Labor
  if (state.logLaborDaily) {
    var shDaily = ss.getSheetByName("OPS_Daily_Labor");
    if (!shDaily) {
      shDaily = ss.insertSheet("OPS_Daily_Labor");
      shDaily.setRightToLeft(true);
    }
    shDaily.clearContents();
    var headers = [[
      "תאריך", "יום בשבוע", "שבוע", "הכנסה ברוטו ₪", 'הכנסה נטו (ללא מע"מ) ₪',
      'סה"כ שעות', "שכר שעתי ברוטו ₪", "שכר שף / גלובלי ₪", 'סה"כ שכר ברוטו ₪',
      "מקדם דמי מעביד", "עלות מעסיק כוללת ₪", "הכנסה נגד הוצאה (נטו) ₪",
      "אחוז לייבור %", "SPLH ₪", "פירוט תיבות עובדים", "הערות", "Boxes_JSON"
    ]];
    var dRows = state.logLaborDaily.map(function(d) {
      var boxesStr = []
        .concat((d.hourlyBoxes || []).map(function(b) { return (b.roleLabel || "") + ": " + b.hours + "ש'*₪" + b.hourlyRate; }))
        .concat((d.globalBoxes || []).map(function(g) { return (g.roleLabel || "") + ": ₪" + g.amount + " (גלובלי)"; }))
        .join(" | ");
      return [
        d.date || "",
        d.dayOfWeek || "",
        d.weekLabel || "",
        Number(d.salesInclVat || 0),
        Number(d.salesExclVat || 0),
        Number(d.totalHours || 0),
        Number(d.hourlyGrossSum || 0),
        Number(d.globalGrossSum || 0),
        Number(d.totalGrossWages || 0),
        Number(d.employerMultiplier || 1.3),
        Number(d.employerCost || 0),
        Number(d.netBalance || 0),
        Number(d.laborPct || 0),
        Number(d.splh || 0),
        boxesStr,
        d.notes || "",
        JSON.stringify({ hourlyBoxes: d.hourlyBoxes || [], globalBoxes: d.globalBoxes || [] })
      ];
    });
    var allDaily = headers.concat(dRows);
    shDaily.getRange(1, 1, allDaily.length, 17).setValues(allDaily);
  }

  return { actionsProcessed: actions.length, stateSynced: true };
}
