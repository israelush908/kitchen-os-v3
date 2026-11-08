/**
 * App.js — Main Application Controller & Dual-Mode Router for Kitchen OS v3.0
 */

import { store } from "./store.js";
import { SyncService } from "./services/syncService.js";

// Import Views
import { renderFieldInventory } from "./views/fieldInventory.js";
import { renderFieldPrep } from "./views/fieldPrep.js";
import { renderFieldOrders } from "./views/fieldOrders.js";
import { renderFieldWaste } from "./views/fieldWaste.js";

import { renderOfficeDashboard } from "./views/officeDashboard.js";
import { renderOfficeStudio } from "./views/officeStudio.js";
import { renderOfficeCatalog } from "./views/officeCatalog.js";
import { renderOfficeDeliveries } from "./views/officeDeliveries.js";
import { renderOfficePrepManager } from "./views/officePrepManager.js";
import { renderOfficeLabor } from "./views/officeLabor.js";
import { renderOfficeLogs } from "./views/officeLogs.js";
import { renderOfficeSettings } from "./views/officeSettings.js";

class KitchenApp {
  constructor() {
    this.currentMode = window.innerWidth < 768 ? "field" : "office";
    this.activeFieldView = "inventory";
    this.activeOfficeView = "dashboard";

    this.fieldRoot = document.getElementById("fieldViewRoot");
    this.officeRoot = document.getElementById("officeViewRoot");
  }

  init() {
    this.setupModeSwitcher();
    this.setupFieldNavigation();
    this.setupOfficeNavigation();
    this.setupSyncListener();

    // החל מצב התחלתי
    this.setMode(this.currentMode);

    // האזנה לשינויים בסטור ורינדור מחדש
    store.subscribe(() => {
      this.renderCurrentView();
    });
  }

  setMode(mode) {
    this.currentMode = mode;
    document.body.classList.remove("mode-field", "mode-office");
    document.body.classList.add(`mode-${mode}`);

    // עדכון כפתורי מתג מצבים
    const btnField = document.getElementById("btnModeField");
    const btnOffice = document.getElementById("btnModeOffice");

    if (btnField && btnOffice) {
      if (mode === "field") {
        btnField.classList.add("active");
        btnField.setAttribute("aria-checked", "true");
        btnOffice.classList.remove("active");
        btnOffice.setAttribute("aria-checked", "false");
      } else {
        btnOffice.classList.add("active");
        btnOffice.setAttribute("aria-checked", "true");
        btnField.classList.remove("active");
        btnField.setAttribute("aria-checked", "false");
      }
    }

    this.renderCurrentView();
  }

  setupModeSwitcher() {
    document.getElementById("btnModeField")?.addEventListener("click", () => {
      this.setMode("field");
    });
    document.getElementById("btnModeOffice")?.addEventListener("click", () => {
      this.setMode("office");
    });
  }

  setupFieldNavigation() {
    document.querySelectorAll(".field-bottom-nav .nav-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".field-bottom-nav .nav-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        this.activeFieldView = tab.dataset.view;
        this.renderCurrentView();
      });
    });
  }

  setupOfficeNavigation() {
    document.querySelectorAll(".office-sidebar .sidebar-item-btn").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".office-sidebar .sidebar-item-btn").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        this.activeOfficeView = tab.dataset.view;
        this.renderCurrentView();
      });
    });
  }

  setupSyncListener() {
    const badge = document.getElementById("syncStatusBadge");
    const updateSyncUI = (status) => {
      if (!badge) return;
      badge.classList.remove("offline", "pending");
      const dot = badge.querySelector(".sync-dot");
      const text = badge.querySelector(".sync-text");

      if (!status.isOnline) {
        badge.classList.add("offline");
        text.textContent = "שמור מקומית";
      } else if (status.pendingCount > 0) {
        badge.classList.add("pending");
        text.textContent = `מסנכרן (${status.pendingCount})`;
      } else {
        text.textContent = "מסונכרן";
      }
    };

    SyncService.subscribe(updateSyncUI);
    updateSyncUI(SyncService.getStatus());
  }

  renderCurrentView() {
    if (this.currentMode === "field") {
      if (!this.fieldRoot) return;
      switch (this.activeFieldView) {
        case "inventory":
          renderFieldInventory(this.fieldRoot);
          break;
        case "prep":
          renderFieldPrep(this.fieldRoot);
          break;
        case "orders":
          renderFieldOrders(this.fieldRoot);
          break;
        case "waste":
          renderFieldWaste(this.fieldRoot);
          break;
        default:
          renderFieldInventory(this.fieldRoot);
      }
    } else {
      if (!this.officeRoot) return;
      switch (this.activeOfficeView) {
        case "dashboard":
          renderOfficeDashboard(this.officeRoot);
          break;
        case "studio":
          renderOfficeStudio(this.officeRoot);
          break;
        case "catalog":
          renderOfficeCatalog(this.officeRoot);
          break;
        case "deliveries":
          renderOfficeDeliveries(this.officeRoot);
          break;
        case "prepManager":
          renderOfficePrepManager(this.officeRoot);
          break;
        case "labor":
          renderOfficeLabor(this.officeRoot);
          break;
        case "logs":
          renderOfficeLogs(this.officeRoot);
          break;
        case "settings":
          renderOfficeSettings(this.officeRoot);
          break;
        default:
          renderOfficeDashboard(this.officeRoot);
      }
    }
  }
}

// Bootstrapping
window.addEventListener("DOMContentLoaded", () => {
  const app = new KitchenApp();
  app.init();
  window.kitchenApp = app;
});
