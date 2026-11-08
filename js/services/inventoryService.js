/**
 * InventoryService — Inventory reconciliation, waste logging, and stock checks.
 */

import { CalculationService } from "./calculationService.js";

export const InventoryService = {
  /**
   * ביצוע ספירת מלאי לפריט יחיד או קבוצת פריטים
   */
  reconcileCount(catalogItem, newCount, reporterName = "צוות מטבח") {
    const qty = Math.max(0, Number(newCount) || 0);
    const prevStock = Number(catalogItem.currentStock) || 0;
    const effectiveCost = CalculationService.calculateEffectiveCost(
      catalogItem.unitCostExclVat,
      catalogItem.yieldLossPct
    );

    const logEntry = {
      id: `CNT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      itemId: catalogItem.id,
      itemName: catalogItem.name,
      previousStock: prevStock,
      countedQty: qty,
      delta: qty - prevStock,
      unit: catalogItem.stockUnit,
      unitCostSnapshot: catalogItem.unitCostExclVat,
      effectiveCostSnapshot: effectiveCost,
      totalCountValue: qty * effectiveCost,
      reporter: reporterName
    };

    return {
      updatedItem: {
        ...catalogItem,
        currentStock: qty,
        lastCountDate: new Date().toISOString()
      },
      logEntry
    };
  },

  /**
   * רישום פחת מיידי וגריעה ממלאי
   */
  createWasteEntry(catalogItem, wasteQty, wasteReason, reporterName = "צוות מטבח", notes = "") {
    const qty = Math.max(0, Number(wasteQty) || 0);
    const effectiveCost = CalculationService.calculateEffectiveCost(
      catalogItem.unitCostExclVat,
      catalogItem.yieldLossPct
    );
    const totalWasteCost = qty * effectiveCost;
    const currentStock = Number(catalogItem.currentStock) || 0;
    const newStock = Math.max(0, currentStock - qty);

    const logEntry = {
      id: `WST-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      reporter: reporterName,
      itemId: catalogItem.id,
      itemName: catalogItem.name,
      wasteQty: qty,
      stockUnit: catalogItem.stockUnit,
      wasteReason,
      unitCostSnapshot: catalogItem.unitCostExclVat,
      totalWasteCost: Number(totalWasteCost.toFixed(2)),
      notes
    };

    return {
      updatedItem: {
        ...catalogItem,
        currentStock: newStock
      },
      logEntry
    };
  },

  /**
   * סינון פריטים בחוסר מתחת לנקודת ההזמנה
   */
  getDeficitItems(catalog) {
    return catalog.filter(item => {
      if (!item.isActive) return false;
      const stock = Number(item.currentStock) || 0;
      const reorder = Number(item.reorderPoint) || 0;
      return stock <= reorder;
    });
  },

  /**
   * שווי מלאי נוכחי כולל במטבח
   */
  calculateTotalStockValue(catalog) {
    return catalog.reduce((sum, item) => {
      if (!item.isActive) return sum;
      const stock = Number(item.currentStock) || 0;
      const effectiveCost = CalculationService.calculateEffectiveCost(
        item.unitCostExclVat,
        item.yieldLossPct
      );
      return sum + (stock * effectiveCost);
    }, 0);
  },

  /**
   * קליטת תעודת משלוח / חשבונית ספק ועדכון מלאי ומחירי רכש
   */
  receiveDelivery(catalog, supplier, deliveryData) {
    const {
      invoiceNumber = "",
      receivedBy = "צוות מטבח",
      notes = "",
      items = [], // [{ itemId, receivedQty, newUnitCost, updateCatalogPrice }]
      timestamp = new Date().toISOString()
    } = deliveryData;

    const validLines = items.filter(l => (Number(l.receivedQty) || 0) > 0);
    const processedItems = [];
    let totalAmountExclVat = 0;

    const updatedCatalog = catalog.map(catItem => {
      const line = validLines.find(l => l.itemId === catItem.id);
      if (!line) return catItem;

      const receivedQty = Math.max(0, Number(line.receivedQty) || 0);
      const prevCost = Number(catItem.unitCostExclVat) || 0;
      const incomingCost = line.newUnitCost !== undefined && line.newUnitCost !== ""
        ? Math.max(0, Number(line.newUnitCost))
        : prevCost;
      const shouldUpdatePrice = line.updateCatalogPrice !== false;
      const finalUnitCost = shouldUpdatePrice ? incomingCost : prevCost;
      const priceChanged = Math.abs(incomingCost - prevCost) >= 0.01;
      const lineTotal = Number((receivedQty * incomingCost).toFixed(2));

      totalAmountExclVat += lineTotal;

      processedItems.push({
        itemId: catItem.id,
        itemName: catItem.name,
        unit: catItem.stockUnit,
        receivedQty,
        previousStock: Number(catItem.currentStock) || 0,
        newStock: Number(((Number(catItem.currentStock) || 0) + receivedQty).toFixed(3)),
        previousUnitCost: prevCost,
        newUnitCost: incomingCost,
        priceChanged,
        lineTotal
      });

      return {
        ...catItem,
        currentStock: Number(((Number(catItem.currentStock) || 0) + receivedQty).toFixed(3)),
        unitCostExclVat: finalUnitCost,
        lastDeliveryDate: timestamp
      };
    });

    const deliveryEntry = {
      id: `DLV-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp,
      supplierId: supplier ? supplier.id : "",
      supplierName: supplier ? supplier.name : "ספק כללי",
      invoiceNumber,
      receivedBy,
      notes,
      totalAmountExclVat: Number(totalAmountExclVat.toFixed(2)),
      items: processedItems
    };

    return {
      updatedCatalog,
      deliveryEntry
    };
  }
};
