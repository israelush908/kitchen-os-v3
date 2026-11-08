/**
 * SyncService — Real-Time Two-Way Hybrid Cloud & Local Sync Engine
 * Supports:
 *   1. Instant Cross-Tab BroadcastChannel (0ms sync between Field & Office tabs)
 *   2. Immediate Push on every click + Revision / Timestamp versioning
 *   3. Firebase Realtime Database REST endpoint (optional <100ms cloud sync)
 *   4. Google Apps Script Serverless Web App Bridge (24/7 Cloud Mode from iPhone without PC)
 *   5. Local Python Proxy Server (http://localhost:8090/api) when working on PC
 *   6. Offline Action Queue in LocalStorage (for cold-room / walk-in cooler offline operation)
 */

const STORAGE_KEY_QUEUE = "kitchen_os_offline_queue";
const STORAGE_KEY_CLOUD_URL = "kitchen_os_cloud_bridge_url";
const STORAGE_KEY_FIREBASE_URL = "kitchen_os_firebase_rtdb_url";
const STORAGE_KEY_CLIENT_ID = "kitchen_os_client_id";
const API_BASE_URL = typeof window !== "undefined" ? (window.location.origin + "/api") : "http://localhost:8090/api";

export const SyncService = {
  listeners: [],
  remoteStateListeners: [],
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  isSyncingNow: false,
  lastActionLabel: "",
  lastSyncTimestamp: 0,
  lastKnownRevision: 0,
  channel: null,
  pollTimer: null,
  flushDebounceTimer: null,

  getClientId() {
    try {
      if (typeof localStorage !== "undefined") {
        let cid = localStorage.getItem(STORAGE_KEY_CLIENT_ID);
        if (!cid) {
          cid = `DEV-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
          localStorage.setItem(STORAGE_KEY_CLIENT_ID, cid);
        }
        return cid;
      }
    } catch (e) {}
    return "DEV-LOCAL";
  },

  init() {
    if (typeof window !== "undefined") {
      // Allow setting cloud bridge URL or firebase URL via query parameters (?bridge=... or ?firebase=...)
      try {
        const params = new URLSearchParams(window.location.search);
        const bridgeParam = params.get("bridge");
        if (bridgeParam && bridgeParam.startsWith("https://")) {
          this.setCloudBridgeUrl(bridgeParam.trim());
        }
        const fbParam = params.get("firebase");
        if (fbParam && fbParam.startsWith("https://")) {
          this.setFirebaseUrl(fbParam.trim());
        }
      } catch (e) {
        // Ignore URL parse issues
      }

      // 1. Setup BroadcastChannel for 0ms cross-tab real-time sync
      if (typeof BroadcastChannel !== "undefined") {
        try {
          this.channel = new BroadcastChannel("kitchen_os_v3_realtime_bus");
          this.channel.onmessage = (ev) => {
            const msg = ev.data;
            if (!msg || msg.senderId === this.getClientId()) return;
            if (msg.type === "STATE_UPDATED" && msg.state) {
              this.lastKnownRevision = Math.max(this.lastKnownRevision, Number(msg.state._revision) || 0);
              this.lastSyncTimestamp = Date.now();
              this.lastActionLabel = msg.actionType || "סונכרן מטאב מקביל";
              this.notifyRemoteStateListeners(msg.state, "BROADCAST");
              this.notifyListeners();
            }
          };
        } catch (e) {
          console.warn("[SyncService] BroadcastChannel init warning:", e);
        }
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

      // Wakeup / Focus instant pull
      window.addEventListener("focus", () => {
        this.checkRemoteUpdates();
      });
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          this.checkRemoteUpdates();
        }
      });

      // Start background real-time heartbeat (every 4 seconds)
      this.startRealtimeHeartbeat();
    }
  },

  startRealtimeHeartbeat() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (!this.isOnline || this.isSyncingNow) return;
      this.checkRemoteUpdates();
    }, 4000);
  },

  onRemoteStateUpdate(callback) {
    this.remoteStateListeners.push(callback);
    return () => {
      this.remoteStateListeners = this.remoteStateListeners.filter(cb => cb !== callback);
    };
  },

  notifyRemoteStateListeners(remoteState, source = "REMOTE") {
    this.remoteStateListeners.forEach(cb => {
      try { cb(remoteState, source); } catch (e) { console.error(e); }
    });
  },

  broadcastLocalState(state, actionType = "") {
    if (this.channel) {
      try {
        this.channel.postMessage({
          type: "STATE_UPDATED",
          senderId: this.getClientId(),
          actionType,
          timestamp: Date.now(),
          state
        });
      } catch (e) {}
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

  getFirebaseUrl() {
    try {
      if (typeof localStorage !== "undefined") {
        return localStorage.getItem(STORAGE_KEY_FIREBASE_URL) || "";
      }
    } catch (e) {
      return "";
    }
    return "";
  },

  setFirebaseUrl(url) {
    try {
      if (typeof localStorage !== "undefined") {
        if (url) {
          const clean = url.trim().replace(/\/+$/, "");
          localStorage.setItem(STORAGE_KEY_FIREBASE_URL, clean);
        } else {
          localStorage.removeItem(STORAGE_KEY_FIREBASE_URL);
        }
        this.notifyListeners();
      }
    } catch (e) {
      console.error("[SyncService] Failed to save Firebase URL:", e);
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

  enqueue(actionType, payload, currentState = null) {
    const queue = this.getQueue();
    const action = {
      id: `ACT-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: actionType,
      payload,
      clientId: this.getClientId(),
      timestamp: new Date().toISOString(),
      retryCount: 0
    };
    queue.push(action);
    this.saveQueue(queue);
    this.lastActionLabel = actionType;
    this.notifyListeners();

    // שדר מיד ב-0ms לכל שאר הטאבים והמסכים הפתוחים
    if (currentState) {
      this.broadcastLocalState(currentState, actionType);
    }

    // נסה לשגר מיד לבק-אנד (עם Debounce קצרצר של 120ms אם לוחצים מהר על + / -)
    if (this.isOnline) {
      if (this.flushDebounceTimer) clearTimeout(this.flushDebounceTimer);
      this.flushDebounceTimer = setTimeout(() => {
        this.flushQueue(currentState);
      }, 120);
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

    if (stateToSend) {
      this.lastKnownRevision = Math.max(this.lastKnownRevision, Number(stateToSend._revision) || 0);
    }

    const firebaseUrl = this.getFirebaseUrl();
    const cloudUrl = this.getCloudBridgeUrl();
    let anySuccess = false;

    this.isSyncingNow = true;
    this.notifyListeners();

    try {
      // 1. אם מוגדר Firebase Realtime Database — עדכון מיידי בענן (<100ms)
      if (firebaseUrl && stateToSend) {
        try {
          const fbRes = await fetch(`${firebaseUrl}/kitchen_os_v3.json`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              revision: Number(stateToSend._revision) || Date.now(),
              lastModified: stateToSend._lastModified || new Date().toISOString(),
              updatedByClient: this.getClientId(),
              state: stateToSend
            })
          });
          if (fbRes.ok) {
            anySuccess = true;
          }
        } catch (fbErr) {
          console.warn("[SyncService] Firebase RTDB push warning:", fbErr);
        }
      }

      // 2. אם קיים גשר ענן (Google Apps Script Web App), נסנכרן אליו ישירות 24/7
      if (cloudUrl) {
        try {
          const res = await fetch(cloudUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
              actions: queue,
              state: stateToSend,
              revision: Number(stateToSend?._revision) || Date.now(),
              clientId: this.getClientId()
            })
          });
          if (res.ok) {
            anySuccess = true;
          }
        } catch (cloudErr) {
          console.warn("[SyncService] Cloud Bridge sync deferred:", cloudErr);
        }
      }

      // 3. אם אנחנו על המחשב המקומי (localhost), נסנכרן דרך שרת הפייתון המקומי
      if (this.isLocalServerOrigin()) {
        try {
          const res = await fetch(`${API_BASE_URL}/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              actions: queue,
              state: stateToSend,
              revision: Number(stateToSend?._revision) || Date.now(),
              clientId: this.getClientId()
            })
          });

          if (res.ok) {
            anySuccess = true;
          }
        } catch (err) {
          console.info("[SyncService] Local server sync pending:", queue.length, "actions");
        }
      }

      if (anySuccess) {
        this.saveQueue([]);
        this.lastSyncTimestamp = Date.now();
      }
    } finally {
      this.isSyncingNow = false;
      this.notifyListeners();
    }

    return anySuccess;
  },

  /**
   * בדיקה שקטה ברקע אם מכשיר אחר עדכן את הבק-אנד, ומשיכה אוטומטית רק כשיש שינוי חדש
   */
  async checkRemoteUpdates() {
    if (!this.isOnline || this.isSyncingNow || this.getQueue().length > 0) return false;

    const firebaseUrl = this.getFirebaseUrl();
    const cloudUrl = this.getCloudBridgeUrl();

    // 1. בדיקה מהירה מול Firebase RTDB אם הוגדר
    if (firebaseUrl) {
      try {
        const res = await fetch(`${firebaseUrl}/kitchen_os_v3.json?t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.state && data.updatedByClient !== this.getClientId()) {
            const remoteRev = Number(data.revision || data.state._revision) || 0;
            if (remoteRev > this.lastKnownRevision) {
              this.lastKnownRevision = remoteRev;
              this.lastSyncTimestamp = Date.now();
              this.notifyRemoteStateListeners(data.state, "FIREBASE");
              this.notifyListeners();
              return true;
            }
          }
        }
      } catch (e) {}
    }

    // 2. בדיקה מול השרת המקומי אם רץ על localhost
    if (this.isLocalServerOrigin()) {
      try {
        const res = await fetch(`${API_BASE_URL}/state?t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          const remoteState = data.state;
          if (remoteState && remoteState._updatedByClient !== this.getClientId()) {
            const remoteRev = Number(remoteState._revision) || 0;
            if (remoteRev > this.lastKnownRevision) {
              this.lastKnownRevision = remoteRev;
              this.lastSyncTimestamp = Date.now();
              this.notifyRemoteStateListeners(remoteState, "LOCAL_SERVER");
              this.notifyListeners();
              return true;
            }
          }
        }
      } catch (e) {}
    }

    // 3. בדיקה מול Google Apps Script Cloud Bridge
    if (cloudUrl) {
      try {
        const sep = cloudUrl.includes("?") ? "&" : "?";
        const res = await fetch(`${cloudUrl}${sep}action=check&since=${this.lastKnownRevision}&t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          const remoteState = data.state || null;
          const remoteRev = Number(data.revision || remoteState?._revision) || 0;
          if (remoteState && remoteRev > this.lastKnownRevision && remoteState._updatedByClient !== this.getClientId()) {
            this.lastKnownRevision = remoteRev;
            this.lastSyncTimestamp = Date.now();
            this.notifyRemoteStateListeners(remoteState, "CLOUD_BRIDGE");
            this.notifyListeners();
            return true;
          }
        }
      } catch (e) {}
    }

    return false;
  },

  getStatus() {
    const queue = this.getQueue();
    const cloudUrl = this.getCloudBridgeUrl();
    const firebaseUrl = this.getFirebaseUrl();
    let modeLabel = "ענן + אחסון מכשיר 📱";
    if (firebaseUrl) modeLabel = "Firebase Realtime ⚡";
    else if (cloudUrl) modeLabel = "ענן חי 24/7 (Sheets) ☁️";
    else if (this.isLocalServerOrigin()) modeLabel = "שרת מקומי חי 🖥️";

    return {
      isOnline: this.isOnline,
      isSyncingNow: this.isSyncingNow,
      pendingCount: queue.length,
      cloudBridgeConfigured: Boolean(cloudUrl),
      cloudBridgeUrl: cloudUrl,
      firebaseConfigured: Boolean(firebaseUrl),
      firebaseUrl,
      revision: this.lastKnownRevision,
      lastActionLabel: this.lastActionLabel,
      modeLabel,
      lastSync: new Date(this.lastSyncTimestamp || Date.now()).toLocaleTimeString("he-IL", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      })
    };
  }
};

SyncService.init();
