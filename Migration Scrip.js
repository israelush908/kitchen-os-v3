function migrateOldKitchenData() {
  // מזהה הגיליון הישן שלך
  var oldSpreadsheetId = '1hq87-JlvaLPzP9hbil3B5Pz1sC-KyOf16-X85vddI9g';
  var oldSs = SpreadsheetApp.openById(oldSpreadsheetId);
  var newSs = SpreadsheetApp.getActiveSpreadsheet();

  // 1. מיגרציית ספקים מתוך 'G1 ספקים'
  var oldSuppliersSheet = oldSs.getSheetByName('G1 ספקים');
  if (oldSuppliersSheet) {
    var suppliersData = oldSuppliersSheet.getDataRange().getValues();
    var newSuppliersSheet = newSs.getSheetByName('DB_Config_Suppliers');
    
    // ניקוי שורת כותרת והתחלת כתיבה משורה 2
    var targetRow = 2;
    for (var i = 1; i < suppliersData.length; i++) {
      var row = suppliersData[i];
      if (row[0]) { // אם יש שם ספק
        newSuppliersSheet.getRange(targetRow, 1).setValue('SUP-' + ('0' + targetRow).slice(-2)); // מזהה SUP-01
        newSsSheetSetValue(newSuppliersSheet, targetRow, 2, row[0]); // שם ספק
        newSsSheetSetValue(newSuppliersSheet, targetRow, 3, row[2]); // קטגוריה
        newSsSheetSetValue(newSuppliersSheet, targetRow, 4, row[1]); // איש קשר
        newSsSheetSetValue(newSuppliersSheet, targetRow, 5, row[4]); // טלפון
        newSuppliersSheet.getRange(targetRow, 7).setValue(true); // פעיל
        targetRow++;
      }
    }
  }

  // 2. מיגרציית קטלוג חומרי גלם מתוך 'B1 חומרי גלם' ו-'C1 ניהול מלאי'
  var oldCatalogSheet = oldSs.getSheetByName('B1 חומרי גלם');
  var oldInventorySheet = oldSs.getSheetByName('C1 ניהול מלאי');
  
  if (oldCatalogSheet) {
    var catalogData = oldCatalogSheet.getDataRange().getValues();
    // משיון נתוני מלאי למיפוי Par ונקודת הזמנה
    var invMap = {};
    if (oldInventorySheet) {
      var invData = oldInventorySheet.getDataRange().getValues();
      for (var j = 1; j < invData.length; j++) {
        invMap[invData[j][0]] = { par: invData[j][5], reorder: invData[j][6] };
      }
    }

    var newCatalogSheet = newSs.getSheetByName('DB_Catalog');
    var catTargetRow = 2;
    
    for (var k = 1; k < catalogData.length; k++) {
      var catRow = catalogData[k];
      var itemName = catRow[0];
      if (itemName) {
        var invInfo = invMap[itemName] || { par: 20, reorder: 5 }; // ברירת מחדל אם לא נמצא
        
        // יצירת מזהה ITM
        newCatalogSheet.getRange(catTargetRow, 1).setValue('ITM-' + ('000' + catTargetRow).slice(-3));
        newCatalogSheet.getRange(catTargetRow, 2).setValue(itemName); // שם חומר גלם
        newCatalogSheet.getRange(catTargetRow, 3).setValue(catRow[1]); // קטגוריה
        newCatalogSheet.getRange(catTargetRow, 4).setValue(catRow[2]); // ספק
        newCatalogSheet.getRange(catTargetRow, 5).setValue(catRow[3]); // יחידה
        newCatalogSheet.getRange(catTargetRow, 6).setValue(catRow[4]); // מחיר ליחידה
        newCatalogSheet.getRange(catTargetRow, 7).setValue(0);        // מקדם פחת ברירת מחדל 0%
        newCatalogSheet.getRange(catTargetRow, 9).setValue(invInfo.par); // Par
        newCatalogSheet.getRange(catTargetRow, 10).setValue(invInfo.reorder); // נקודת הזמנה
        newCatalogSheet.getRange(catTargetRow, 11).setValue(true);    // פעיל
        newCatalogSheet.getRange(catTargetRow, 12).setValue(true);    // מופיע בספירה
        newCatalogSheet.getRange(catTargetRow, 13).setValue(true);    // מופיע בפחת
        
        catTargetRow++;
      }
    }
  }
}

function newSsSheetSetValue(sheet, row, col, val) {
  if (val) sheet.getRange(row, col).setValue(val);
}