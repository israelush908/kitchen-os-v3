/**
 * Comprehensive Unit & Integration Test Suite — Kitchen OS v3.0
 * Executed by Node.js for 100% isolated testability.
 */

import { CalculationService } from "../js/services/calculationService.js";
import { OrderDispatcher } from "../js/services/orderDispatcher.js";
import { InventoryService } from "../js/services/inventoryService.js";
import { INITIAL_DATA } from "../js/seedData.js";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName}`);
  }
}

function assertApprox(val, expected, tolerance = 0.01, testName) {
  assert(Math.abs(val - expected) <= tolerance, `${testName} (expected ~${expected}, got ${val})`);
}

console.log("==================================================");
console.log("  🧪 RUNNING KITCHEN OS v3.0 TEST SUITE");
console.log("==================================================\n");

// 1. CalculationService Tests
console.log("1. Testing CalculationService:");
assertApprox(CalculationService.calculateEffectiveCost(100, 0.20), 125, 0.01, "Effective cost with 20% loss");
assertApprox(CalculationService.calculateEffectiveCost(50, 0), 50, 0.01, "Effective cost with 0% loss");
assertApprox(CalculationService.calculateEffectiveCost("80", "0.20"), 100, 0.01, "Effective cost with string inputs");
assertApprox(CalculationService.calculateEffectiveCost(100, -0.10), 100, 0.01, "Effective cost with negative loss clamped to 0");
assert(CalculationService.calculateEffectiveCost(100, 0.99) <= 2000, "Effective cost capped at 95% loss ceiling");

assertApprox(CalculationService.calculatePriceExclVat(118, 0.18), 100, 0.01, "Stripping 18% VAT");
assert(CalculationService.calculatePriceExclVat(0) === 0, "Zero price excluding VAT");

assertApprox(CalculationService.calculateFoodCostPct(25, 100), 0.25, 0.001, "Food cost percentage calculation");
assert(CalculationService.calculateFoodCostPct(25, 0) === 0, "Food cost percentage handles zero price safely");

assertApprox(CalculationService.calculateGrossProfit(100, 35), 65, 0.01, "Gross profit calculation");

// 2. Cascading Dish Cost & Circular Dependency Protection
console.log("\n2. Testing Cascading Dish Cost & BOM Engine:");
const mockDishes = [
  { id: "D1", name: "Dish 1", dishType: "MENU_ITEM", yieldPortions: 1 },
  { id: "SUB1", name: "Sub Recipe 1", dishType: "SUB_RECIPE", yieldPortions: 4 },
  { id: "CIRC_A", name: "Circular A", dishType: "SUB_RECIPE", yieldPortions: 1 },
  { id: "CIRC_B", name: "Circular B", dishType: "SUB_RECIPE", yieldPortions: 1 }
];

const mockCatalog = [
  { id: "RAW1", name: "Raw Item 1", unitCostExclVat: 10, yieldLossPct: 0 } // cost: 10
];

const mockLines = [
  // SUB1 uses 2 units of RAW1 (total cost: 20, portions: 4 -> portion cost: 5)
  { id: "L1", parentDishId: "SUB1", componentType: "RAW_ITEM", componentId: "RAW1", quantity: 2 },
  // D1 uses 1 portion of SUB1 (cost: 5) + 1 unit of RAW1 (cost: 10) = 15
  { id: "L2", parentDishId: "D1", componentType: "SUB_RECIPE", componentId: "SUB1", quantity: 1 },
  { id: "L3", parentDishId: "D1", componentType: "RAW_ITEM", componentId: "RAW1", quantity: 1 },
  // Circular mock lines: CIRC_A -> CIRC_B -> CIRC_A
  { id: "LC1", parentDishId: "CIRC_A", componentType: "SUB_RECIPE", componentId: "CIRC_B", quantity: 1 },
  { id: "LC2", parentDishId: "CIRC_B", componentType: "SUB_RECIPE", componentId: "CIRC_A", quantity: 1 }
];

const d1Cost = CalculationService.calculateDishCost("D1", mockDishes, mockLines, mockCatalog);
assertApprox(d1Cost, 15, 0.01, "Cascading dish cost with sub-recipe BOM");

const circCost = CalculationService.calculateDishCost("CIRC_A", mockDishes, mockLines, mockCatalog);
assert(circCost === 0, "Circular dependency handled safely without infinite loop (returns 0)");

// 3. Order Quantity & SPLH
console.log("\n3. Testing Reorder Point & SPLH Calculations:");
assert(CalculationService.calculateOrderQty(2, 10, 5) === 8, "Order quantity triggered when stock <= reorder point");
assert(CalculationService.calculateOrderQty(5, 10, 5) === 5, "Order quantity triggered at exact reorder point");
assert(CalculationService.calculateOrderQty(6, 10, 5) === 0, "No order quantity when stock > reorder point");

assertApprox(CalculationService.calculateSplh(1000, 10, 10), 50, 0.01, "SPLH calculation (1000 net sales / 20 hours)");
assert(CalculationService.calculateSplh(1000, 0, 0) === 0, "SPLH handles zero hours safely");

// 4. Menu Matrix Classification
console.log("\n4. Testing Menu Engineering Classification:");
const star = CalculationService.classifyMenuMatrix(0.25, 0.30, 40, 30);
assert(star.label === "כוכב" && star.icon === "⭐", "Classified as Star (High margin, high sales)");

const plowhorse = CalculationService.classifyMenuMatrix(0.35, 0.30, 40, 30);
assert(plowhorse.label === "סוס עבודה" && plowhorse.icon === "🐴", "Classified as Plowhorse (Low margin, high sales)");

const puzzle = CalculationService.classifyMenuMatrix(0.25, 0.30, 20, 30);
assert(puzzle.label === "חידה" && puzzle.icon === "🧩", "Classified as Puzzle (High margin, low sales)");

const dog = CalculationService.classifyMenuMatrix(0.35, 0.30, 20, 30);
assert(dog.label === "כלב" && dog.icon === "🐕", "Classified as Dog (Low margin, low sales)");

// 5. OrderDispatcher Tests
console.log("\n5. Testing OrderDispatcher:");
const orders = OrderDispatcher.getSupplierOrders(INITIAL_DATA.catalog, INITIAL_DATA.suppliers);
assert(Array.isArray(orders), "Supplier orders returns array");
assert(orders.length > 0, "Deficit items identified in seed data");

const testSup = INITIAL_DATA.suppliers[0];
const testItems = [{ name: "חסה", orderQty: 5, stockUnit: "ק\"ג" }];
const waLink = OrderDispatcher.generateWhatsAppLink(testSup, testItems);
assert(waLink.startsWith("https://wa.me/"), "WhatsApp URL starts with https://wa.me/");
assert(waLink.includes(testSup.whatsappPhone.replace(/\D/g, "")), "WhatsApp URL contains cleaned phone number");
assert(waLink.includes(encodeURIComponent("הזמנת רכש מטבח")), "WhatsApp URL contains encoded Hebrew message header");

// 6. InventoryService Tests
console.log("\n6. Testing InventoryService:");
const testItem = { id: "ITM-99", name: "טסט פריט", unitCostExclVat: 50, yieldLossPct: 0.20, currentStock: 10, stockUnit: "ק\"ג" };
const countResult = InventoryService.reconcileCount(testItem, 15, "ישראל");
assert(countResult.updatedItem.currentStock === 15, "Reconcile count updates stock");
assert(countResult.logEntry.delta === 5, "Reconcile count computes correct positive delta");
assertApprox(countResult.logEntry.totalCountValue, 15 * 62.5, 0.01, "Count total value matches effective cost");

const wasteResult = InventoryService.createWasteEntry(testItem, 2, "פג תוקף", "ישראל", "בדיקה");
assert(wasteResult.updatedItem.currentStock === 8, "Waste entry deducts from current stock");
assertApprox(wasteResult.logEntry.totalWasteCost, 2 * 62.5, 0.01, "Waste total cost matches effective cost");

const totalStockVal = InventoryService.calculateTotalStockValue(INITIAL_DATA.catalog);
assert(totalStockVal > 0, `Total stock value calculated: ₪${totalStockVal.toFixed(0)}`);

// 6b. Goods Receiving (Deliveries) Tests
console.log("\n6b. Testing Goods Receiving & Delivery Reconciliation:");
const dlvCatalog = [
  { id: "ITM-001", name: "מנצ'גו", stockUnit: 'ק"ג', currentStock: 2.0, unitCostExclVat: 115.0 },
  { id: "ITM-002", name: "פקורינו", stockUnit: 'ק"ג', currentStock: 3.5, unitCostExclVat: 98.0 }
];
const dlvSupplier = { id: "SUP-02", name: "מחלבת כפר תבור" };
const dlvResult = InventoryService.receiveDelivery(dlvCatalog, dlvSupplier, {
  invoiceNumber: "INV-999",
  receivedBy: "ישראל",
  items: [
    { itemId: "ITM-001", receivedQty: 4.0, newUnitCost: 120.0, updateCatalogPrice: true },
    { itemId: "ITM-002", receivedQty: 2.0, newUnitCost: 98.0, updateCatalogPrice: true }
  ]
});
assert(dlvResult.updatedCatalog[0].currentStock === 6.0, "Delivery adds received quantity to currentStock (2 + 4 = 6)");
assert(dlvResult.updatedCatalog[0].unitCostExclVat === 120.0, "Delivery updates unitCostExclVat when price changes");
assert(dlvResult.deliveryEntry.items[0].priceChanged === true, "Delivery flags priceChanged when invoice price differs");
assert(dlvResult.deliveryEntry.items[1].priceChanged === false, "Delivery flags priceChanged=false when price is unchanged");
assertApprox(dlvResult.deliveryEntry.totalAmountExclVat, 4 * 120 + 2 * 98, 0.01, "Delivery calculates total invoice amount excluding VAT");

// 7. Seed Data Integrity
console.log("\n7. Testing Seed Data Integrity:");
assert(INITIAL_DATA.catalog.length >= 10, `Catalog has ${INITIAL_DATA.catalog.length} items`);
assert(INITIAL_DATA.suppliers.length >= 4, `Suppliers directory has ${INITIAL_DATA.suppliers.length} suppliers`);
assert(INITIAL_DATA.dishes.length >= 5, `Dishes have ${INITIAL_DATA.dishes.length} items`);
assert(INITIAL_DATA.prepChecklist.length >= 5, `Checklist has ${INITIAL_DATA.prepChecklist.length} tasks`);
assert(INITIAL_DATA.logLabor.length >= 2, `Labor history has ${INITIAL_DATA.logLabor.length} months`);
assert(Array.isArray(INITIAL_DATA.logDeliveries) && INITIAL_DATA.logDeliveries.length >= 2, `Deliveries log has ${INITIAL_DATA.logDeliveries.length} records`);

// 8. Daily/Weekly Shift Labor Calculator Tests (Dynamic Hourly + Global Boxes)
console.log("\n8. Testing Daily/Weekly Shift Labor Calculator (Hourly + Global Boxes):");
const dailyCalc = CalculationService.calculateDailyLaborEntry({
  salesInclVat: 11800, // 10,000 Excl VAT (18% VAT)
  vatRate: 0.18,
  employerCostMultiplier: 1.30,
  hourlyBoxes: [
    { roleLabel: "טבח 1", hours: 6, hourlyRate: 50 }, // 300
    { roleLabel: "טבח 2", hours: 3, hourlyRate: 80 }  // 240
  ],
  globalBoxes: [
    { roleLabel: "שף גלובלי", amount: 460 } // 460
  ]
});
assert(dailyCalc.totalHours === 9, "Daily labor sums hourly worker hours (6 + 3 = 9)");
assertApprox(dailyCalc.hourlyGrossSum, 540, 0.01, "Daily labor computes hourly boxes gross (6*50 + 3*80 = 540)");
assertApprox(dailyCalc.globalGrossSum, 460, 0.01, "Daily labor computes global/salaried boxes gross (460)");
assertApprox(dailyCalc.totalGrossWages, 1000, 0.01, "Daily labor sums total gross wages (540 + 460 = 1000)");
assertApprox(dailyCalc.employerCost, 1300, 0.01, "Daily labor computes employer cost with multiplier (1000 * 1.30 = 1300)");
assertApprox(dailyCalc.netBalance, 8700, 0.01, "Daily labor computes income vs expense net balance (10000 - 1300 = 8700)");
assertApprox(dailyCalc.laborPct, 0.13, 0.001, "Daily labor computes labor percentage (1300 / 10000 = 13%)");

console.log("\n==================================================");
console.log(`  RESULTS: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${totalTests})`);
console.log("==================================================");

if (failedTests > 0) {
  process.exit(1);
}
