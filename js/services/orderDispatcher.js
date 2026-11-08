/**
 * OrderDispatcher — Smart WhatsApp & External Portal order generation, supplier aggregation & formatting.
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
      const estimatedTotalExclVat = supItems.reduce((sum, itm) => {
        return sum + ((Number(itm.orderQty) || 0) * (Number(itm.unitCostExclVat) || 0));
      }, 0);

      supplierMap[sup.id] = {
        supplier: sup,
        items: supItems,
        totalItemsCount: supItems.length,
        estimatedTotalExclVat: Number(estimatedTotalExclVat.toFixed(2))
      };
    }

    return Object.values(supplierMap);
  },

  /**
   * בניית טקסט הזמנה תקני (לוואטסאפ או להעתקה לפורטל ספק)
   */
  formatOrderText(supplier, itemsToOrder) {
    if (!supplier) return "";
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
      const skuPart = item.supplierSku ? ` [מק"ט: ${item.supplierSku}]` : "";
      msg += `${idx + 1}. ${item.name}${skuPart} — ${item.orderQty} ${item.stockUnit}\n`;
    });

    msg += `--------------------------------\n`;
    msg += `נא לאשר קבלת הזמנה ומועד אספקה.\nתודה, מטבח היקב.`;
    return msg;
  },

  /**
   * יצירת קישור וואטסאפ מעוצב בעברית תקנית
   */
  generateWhatsAppLink(supplier, itemsToOrder) {
    if (!supplier || !supplier.whatsappPhone) return "";
    const msg = this.formatOrderText(supplier, itemsToOrder);
    if (!msg) return "";

    const cleanPhone = supplier.whatsappPhone.replace(/\D/g, "");
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  },

  /**
   * תווית ידידותית לערוץ ההזמנה של הספק
   */
  getChannelLabel(orderChannel) {
    switch (orderChannel) {
      case "EXTERNAL_PORTAL":
        return "פורטל / אפליקציית ספק";
      case "PHONE":
        return "טלפון / סוכן שטח";
      case "WHATSAPP":
      default:
        return "וואטסאפ";
    }
  }
};
