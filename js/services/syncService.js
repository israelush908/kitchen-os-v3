/**
 * SyncService — Two-Way Hybrid Cloud & Local Sync Engine
 * Supports:
 *   1. Google Apps Script Serverless Web App Bridge (24/7 Cloud Mode from iPhone without PC)
 *   2. Local Python Proxy Server (http://localhost:8090/api) when working on PC
 *   3. Offline Action Queue in LocalStorage (for cold-room / walk-in cooler offline operation)
 */

const STORAGE_KEY_QUEUE = "kitchen_os_offline_queue";
const STORAGE_KEY_CLOUD_URL = "kitchen_os_cloud_bridge_url";
const API_BASE_URL = typeof window !== "undefined" ? (window.location.origin + "/api") : "http://localhost:8090/api";

export const SyncService = {
  listeners: [],
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,

  init() {
    if (typeof window !== "undefined") {
      // Allow setting cloud bridge URL via URL query parameter ?bridge=https://script.google.com/... for 1-click iPhone setup!
      try {
        const params = new URLSearchParams(window.location.search);
        const bridgeParam = params.get("bridge");
        if (bridgeParam && bridgeParam.startsWith("https://")) {
          this.setCloudBridgeUrl(bridgeParam.trim());
        }
      } catch (e) {
        // Ignore URL parse issues
      }

      window.addEventListener("online", () => {
        this.isOnline = true;
        this.notifyListeners();
        this.flushQueue();
      });
      window.addEventListener("offline", () => {
        this.isOnline = false;
        this.notifyListeners();
      });
    }
  },

  getCloudBridgeUrl() {
    try {
      if (typeof localStorage !== "undefined") {
        return localStorage.getItem(STORAGE_KEY_CLOUD_URL) || "";
      }
    } catch (e) {
      return "";
    }
    return "";
  },

  setCloudBridgeUrl(url) {
    try {
      if (typeof localStorage !== "undefined") {
        if (url) {
          localStorage.setItem(STORAGE_KEY_CLOUD_URL, url.trim());
        } else {
          localStorage.removeItem(STORAGE_KEY_CLOUD_URL);
        }
        this.notifyListeners();
      }
    } catch (e) {
      console.error("[SyncService] Failed to save cloud bridge URL:", e);
    }
  },

  isLocalServerOrigin() {
    if (typeof window === "undefined") return false;
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1";
  },

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  },

  notifyListeners() {
    const status = this.getStatus();
    this.listeners.forEach(l => {
      try { l(status); } catch (e) { console.error(e); }
    });
  },

  getQueue() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_QUEUE);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("[SyncService] Failed to read queue:", e);
      return [];
    }
  },

  saveQueue(queue) {
    try {
      localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(queue));
    } catch (e) {
      console.error("[SyncService] Failed to save queue:", e);
    }
  },

  enqueue(actionType, payload) {
    const queue = this.getQueue();
    const action = {
      id: `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: actionType,
      payload,
      timestamp: new Date().toISOString(),
      retryCount: 0
    };
    queue.push(action);
    this.saveQueue(queue);
    this.notifyListeners();

    // נסה לשגר מיד אם מחובר
    if (this.isOnline) {
      this.flushQueue();
    }
    return action;
  },

  async flushQueue(currentState = null) {
    const queue = this.getQueue();
    if (queue.length === 0 && !currentState) return false;

    let stateToSend = currentState;
    if (!stateToSend && typeof localStorage !== "undefined") {
      const rawState = localStorage.getItem("kitchen_os_v3_state_clean_v2");
      if (rawState) stateToSend = JSON.parse(rawState);
    }

    const cloudUrl = this.getCloudBridgeUrl();

    // 1. אם קיים גשר ענן (Google Apps Script Web App), נסנכרן אליו ישירות 24/7 (עובד מהאייפון גם כשהמחשב כבוי!)
    if (cloudUrl) {
      try {
        // שימוש ב-text/plain מונע בעיות CORS Preflight מול Google Apps Script
        const res = await fetch(cloudUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ actions: queue, state: stateToSend })
        });
        if (res.ok) {
          this.saveQueue([]);
          this.notifyListeners();
          return true;
        }
      } catch (cloudErr) {
        console.warn("[SyncService] Cloud Bridge sync deferred:", cloudErr);
      }
    }

    // 2. אם אנחנו על המחשב המקומי (localhost), נסנכרן דרך שרת הפייתון המקומי
    if (this.isLocalServerOrigin()) {
      try {
        const res = await fetch(`${API_BASE_URL}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actions: queue, state: stateToSend })
        });

        if (res.ok) {
          this.saveQueue([]);
          this.notifyListeners();
          return true;
        }
      } catch (err) {
        console.info("[SyncService] Local server sync pending (Offline queue active):", queue.length, "actions pending");
      }
    }

    return false;
  },

  getStatus() {
    const queue = this.getQueue();
    const cloudUrl = this.getCloudBridgeUrl();
    return {
      isOnline: this.isOnline,
      pendingCount: queue.length,
      cloudBridgeConfigured: Boolean(cloudUrl),
      cloudBridgeUrl: cloudUrl,
      modeLabel: cloudUrl ? "ענן ישיר 24/7 ☁️" : (this.isLocalServerOrigin() ? "שרת מקומי 🖥️" : "ענן + אחסון מכשיר 📱"),
      lastSync: new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
    };
  }
};

SyncService.init();
