/**
 * Service Worker — Kitchen OS v3.0 Cloud & Offline PWA
 * Caches core assets and data/kitchen_db.json so the app works 24/7 on iPhone
 * even inside walk-in coolers without reception or when the PC is turned off.
 */

const CACHE_NAME = "kitchen-os-v3-cloud-v5";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./design/tokens.css",
  "./css/base.css",
  "./css/layout.css",
  "./css/components.css",
  "./css/views.css",
  "./js/app.js",
  "./js/store.js",
  "./js/seedData.js",
  "./js/services/calculationService.js",
  "./js/services/inventoryService.js",
  "./js/services/syncService.js",
  "./js/services/orderDispatcher.js",
  "./js/views/fieldInventory.js",
  "./js/views/fieldPrep.js",
  "./js/views/fieldOrders.js",
  "./js/views/fieldReceiving.js",
  "./js/views/fieldWaste.js",
  "./js/views/officeDashboard.js",
  "./js/views/officeStudio.js",
  "./js/views/officeCatalog.js",
  "./js/views/officeDeliveries.js",
  "./js/views/officePrepManager.js",
  "./js/views/officeLabor.js",
  "./js/views/officeLogs.js",
  "./js/views/officeSettings.js",
  "./data/kitchen_db.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Network-first for HTML, JS, CSS, JSON and API so cloud updates appear immediately on refresh
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});

