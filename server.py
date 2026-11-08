"""
Kitchen OS v3.0 — Local Server, Persistent Database & Two-Way Google Sheets Sync Bridge.
- Serves static SPA files
- Pulls live winery data from Google Sheets (`16ToeULQNGXZuYi7Jt08jkLrYbV28h1ad1Vg1tiHVVF4`)
- Persists state in local `data/kitchen_db.json`
- Pushes incremental actions and full state back to Google Sheets without breaking dynamic array formulas
"""

import os
import sys
import json
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

PORT = int(os.environ.get("PORT", 8090))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(DIRECTORY, "data")
DB_FILE = os.path.join(DATA_DIR, "kitchen_db.json")

SCRIPTS_DIR = os.path.join(DIRECTORY, "scripts")
if SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, SCRIPTS_DIR)

try:
    from sheets_sync import pull_full_state_from_sheets, push_state_to_sheets
    from common import NEW_SPREADSHEET_ID
    SHEETS_AVAILABLE = True
except Exception as e:
    print(f"[Sheets Bridge] Note: Google Sheets adapter not loaded in current Python env ({e}). Local JSON persistence is active.")
    SHEETS_AVAILABLE = False
    NEW_SPREADSHEET_ID = "16ToeULQNGXZuYi7Jt08jkLrYbV28h1ad1Vg1tiHVVF4"


def ensure_data_dir():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR, exist_ok=True)


def load_local_db():
    ensure_data_dir()
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[DB] Failed to read {DB_FILE}: {e}")
    return None


def save_local_db(state_data):
    ensure_data_dir()
    try:
        with open(DB_FILE, "w", encoding="utf-8") as f:
            json.dump(state_data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"[DB] Failed to write {DB_FILE}: {e}")
        return False


def get_initial_or_synced_state(force_pull_sheets=False):
    """Returns state from Google Sheets (if force_pull or first boot) merged with local daily logs."""
    local_state = load_local_db()

    if SHEETS_AVAILABLE and (force_pull_sheets or local_state is None):
        try:
            print(f"[Sheets Sync] Pulling live state from Google Sheets ({NEW_SPREADSHEET_ID})...")
            sheets_state = pull_full_state_from_sheets()
            if local_state:
                # Preserve local daily labor or deliveries if Sheets doesn't have them yet
                if not sheets_state.get("logLaborDaily") and local_state.get("logLaborDaily"):
                    sheets_state["logLaborDaily"] = local_state["logLaborDaily"]
                if not sheets_state.get("logDeliveries") and local_state.get("logDeliveries"):
                    sheets_state["logDeliveries"] = local_state["logDeliveries"]
            save_local_db(sheets_state)
            print(f"[Sheets Sync] Pulled {len(sheets_state.get('catalog', []))} items, {len(sheets_state.get('suppliers', []))} suppliers, {len(sheets_state.get('dishes', []))} dishes.")
            return sheets_state
        except Exception as e:
            print(f"[Sheets Pull Warning] Could not pull from Google Sheets ({e}), using local DB.")

    return local_state


class KitchenHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/state":
            db_data = get_initial_or_synced_state(force_pull_sheets=False)
            payload = json.dumps({
                "status": "ok",
                "hasState": db_data is not None,
                "sheetsConnected": SHEETS_AVAILABLE,
                "spreadsheetId": NEW_SPREADSHEET_ID,
                "state": db_data
            }, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        if self.path == "/api/sheets/pull":
            db_data = get_initial_or_synced_state(force_pull_sheets=True)
            payload = json.dumps({
                "status": "ok" if db_data else "error",
                "sheetsConnected": SHEETS_AVAILABLE,
                "spreadsheetId": NEW_SPREADSHEET_ID,
                "state": db_data
            }, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        return super().do_GET()

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else b"{}"

        if self.path == "/api/sync":
            try:
                data = json.loads(body.decode("utf-8"))
                actions = data.get("actions", [])
                full_state = data.get("state")

                print(f"[Sync Bridge] Received {len(actions)} actions at {datetime.now().strftime('%H:%M:%S')}")
                if full_state:
                    save_local_db(full_state)
                    if SHEETS_AVAILABLE:
                        sheets_res = push_state_to_sheets(full_state, actions=actions)
                    else:
                        sheets_res = {"synced": False, "reason": "Google Sheets library not loaded"}
                else:
                    sheets_res = {"synced": False}

                res = json.dumps({
                    "status": "ok",
                    "syncedCount": len(actions),
                    "savedToDisk": bool(full_state),
                    "googleSheets": sheets_res
                }, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
            except Exception as e:
                err_res = json.dumps({"status": "error", "message": str(e)}).encode("utf-8")
                self.send_response(500)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(err_res)))
                self.end_headers()
                self.wfile.write(err_res)

        elif self.path == "/api/sheets/push":
            try:
                data = json.loads(body.decode("utf-8"))
                state = data.get("state") or load_local_db()
                if state:
                    save_local_db(state)
                if SHEETS_AVAILABLE and state:
                    sheets_res = push_state_to_sheets(state, actions=[])
                else:
                    sheets_res = {"synced": False, "reason": "Google Sheets library not loaded"}
                res = json.dumps({
                    "status": "ok" if sheets_res.get("synced") else "local_only",
                    "googleSheets": sheets_res,
                    "message": "Synced to Google Sheets" if sheets_res.get("synced") else sheets_res.get("reason", "")
                }, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(res)))
                self.end_headers()
                self.wfile.write(res)
            except Exception as e:
                err_res = json.dumps({"status": "error", "message": str(e)}).encode("utf-8")
                self.send_response(500)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(err_res)))
                self.end_headers()
                self.wfile.write(err_res)
        else:
            self.send_error(404, "API endpoint not found")

    def guess_type(self, path):
        if path.endswith(".js"):
            return "application/javascript; charset=utf-8"
        if path.endswith(".css"):
            return "text/css; charset=utf-8"
        if path.endswith(".json"):
            return "application/json; charset=utf-8"
        return super().guess_type(path)


def run():
    ensure_data_dir()
    # Pre-warm local DB from Google Sheets on server startup
    get_initial_or_synced_state(force_pull_sheets=True)

    server_address = ("", PORT)
    httpd = HTTPServer(server_address, KitchenHandler)
    print(f"=" * 65)
    print(f"  🍷 Kitchen OS v3.0 Server is LIVE on http://localhost:{PORT}")
    print(f"  📁 Local Database File: {DB_FILE}")
    print(f"  ☁️  Google Sheets Two-Way Sync: {'ACTIVE (' + NEW_SPREADSHEET_ID + ')' if SHEETS_AVAILABLE else 'LOCAL FALLBACK'}")
    print(f"=" * 65)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        httpd.server_close()


if __name__ == "__main__":
    run()
