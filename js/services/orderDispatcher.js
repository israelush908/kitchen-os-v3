/**
 * OrderDispatcher — Smart WhatsApp order generation & supplier aggregation.
 */

import { CalculationService } from "./calculationService.js";

export const OrderDispatcher = {
  /**
   * איתור כל החוסרים וקיבוצם לפי ספקים
   */
  getSupplierOrders(catalogItems, suppliers, manualOverrides = {}) {
    const deficits = [];

    for (const item of catalogItems) {
      if (!item.isActive) continue;
      const stock = Number(item.currentStock) || 0;
      const reorder = Number(item.reorderPoint) || 0;
      const par = Number(item.parLevelWeekend) || 0;

      if (stock <= reorder) {
        // כמות מומלצת, אלא אם המשתמש התאים ידנית
        const recommended = CalculationService.calculateOrderQty(stock, par, reorder);
        const overrideQty = manualOverrides[item.id];
        const finalQty = overrideQty !== undefined ? Number(overrideQty) : recommended;

        deficits.push({
          ...item,
          recommendedQty: recommended,
          orderQty: Math.max(0, finalQty)
        });
      }
    }

    // קיבוץ לפי ספק
    const supplierMap = {};
    for (const sup of suppliers) {
      if (!sup.isActive) continue;
      const supItems = deficits.filter(d => d.supplierId === sup.id);
      supplierMap[sup.id] = {
        supplier: sup,
        items: supItems,
        totalItemsCount: supItems.length
      };
    }

    return Object.values(supplierMap);
  },

  /**
   * יצירת קישור וואטסאפ מעוצב בעברית תקנית
   */
  generateWhatsAppLink(supplier, itemsToOrder) {
    if (!supplier || !supplier.whatsappPhone) return "";

    const activeOrders = itemsToOrder.filter(i => (Number(i.orderQty) || 0) > 0);
    if (activeOrders.length === 0) return "";

    const dateStr = new Date().toLocaleDateString("he-IL", {
      weekday: "long",
      year: "numeric",
      month: "numeric",
      day: "numeric"
    });

    let msg = `שלום ${supplier.contactName || supplier.name},\n`;
    msg += `הזמנת רכש מטבח — מרכז מבקרים יקב\n`;
    msg += `תאריך: ${dateStr}\n`;
    msg += `--------------------------------\n`;

    activeOrders.forEach((item, idx) => {
      msg += `${idx + 1}. ${item.name} — ${item.orderQty} ${item.stockUnit}\n`;
    });

    msg += `--------------------------------\n`;
    msg += `נא לאשר קבלת הזמנה ומועד אספקה.\nתודה, מטבח היקב.`;

    const cleanPhone = supplier.whatsappPhone.replace(/\D/g, "");
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  }
};
