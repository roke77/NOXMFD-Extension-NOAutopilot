"""Browser preview of the AP page without the game.

    python tools/preview.py [port] [path/to/NOXMFD]

Serves /ext/noap/* from this repo's src/web, /assets/shared|services/* from a NOXMFD checkout
(default: a sibling ../NOXMFD), and a mock /stream whose frames carry an ext.noap slice.
POST /ext/noap/command is answered by a rough simulation of NOAutopilot, so the controls can be
clicked through; GET /commands lists what was received. GET /scenario?s=<name>&metric=0|1 switches
the state the stream sends (names in SCENARIOS, plus "nomission").
"""
import json, sys, time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

REPO = Path(__file__).resolve().parent.parent
EXT = REPO / "src" / "web"
NOX = (Path(sys.argv[2]) if len(sys.argv) > 2 else REPO.parent / "NOXMFD") / "src" / "web"
MIME = {".css": "text/css", ".js": "text/javascript", ".html": "text/html", ".woff2": "font/woff2"}

FLYING = {
    "link": "linked", "ver": "5.5.3", "broken": False, "mp": True,
    "ap": True, "nav": True, "gcas": True, "gcasWarn": False, "gcasActive": False,
    "jam": False, "als": False, "alsText": "", "xthr": False, "fbw": False, "cycle": True, "mach": False,
    "tgt": {"alt": 6705.6, "spd": 216.07, "crs": -1, "roll": 25, "vs": 15.24},
    "air": True,
    "cur": {"alt": 5559.6, "spd": 211.95, "mach": 0.66, "crs": 47.2, "roll": 24.6, "vs": 8.1},
    "navq": {"n": 4, "next": 22965, "total": 164272, "brg": 52},
}
SCENARIOS = {
    "flying": FLYING,
    "gcas-warn": {**FLYING, "gcasWarn": True},
    "pull-up": {**FLYING, "gcasWarn": True, "gcasActive": True},
    "mach": {**FLYING, "mach": True, "tgt": {**FLYING["tgt"], "spd": 0.7}},
    "idle": {**FLYING, "ap": False, "nav": False, "mp": False, "cycle": False,
             "tgt": {"alt": -1, "spd": -1, "crs": -1, "roll": -999, "vs": 15.24},
             "navq": {"n": 0}},
    "noair": {**FLYING, "air": False, "cur": None, "navq": {"n": 0}},
    "missing": {"link": "missing", "ver": ""},
    "incompatible": {"link": "incompatible", "ver": "6.0.0"},
    "broken": {**FLYING, "broken": True},
}
state = {"s": "flying", "metric": False}
live = {}          # scenario copy the command endpoint mutates, re-seeded on /scenario
commands = []      # every command body received, for GET /commands


def seed():
    live.clear()
    live.update(json.loads(json.dumps(SCENARIOS.get(state["s"], {}))))


def simulate(c):
    """Rough stand-in for NOAutopilot's reaction, enough to see the page follow."""
    t, cur, q = live.setdefault("tgt", {}), live.get("cur") or {}, live.setdefault("navq", {"n": 0})
    cmd, what = c.get("cmd"), c.get("what")
    if cmd == "apply":
        for k in ("alt", "spd", "crs", "roll", "vs"):
            if k in c:
                t[k] = c[k]
        live["ap"] = True
    elif cmd == "engage":
        live["ap"] = True
    elif cmd == "disengage":
        live["ap"] = False
    elif cmd == "crs-hold":
        t["crs"] = cur.get("crs", 0)
    elif cmd == "crs-clear":
        t["crs"], live["nav"], t["roll"] = -1, False, 0
    elif cmd == "toggle":
        if what == "athr":
            t["spd"] = -1 if t.get("spd", -1) >= 0 else (cur.get("mach") if live.get("mach") else cur.get("spd"))
        elif what == "mach":
            live["mach"] = not live.get("mach")
            if t.get("spd", -1) >= 0:
                t["spd"] = cur.get("mach") if live["mach"] else cur.get("spd")
        else:
            key = {"gcas": "gcas", "abbrk": "xthr", "jam": "jam", "fbw": "fbw", "nav": "nav", "cycle": "cycle"}[what]
            live[key] = not live.get(key)
    elif cmd in ("nav-skip", "nav-undo"):
        q["n"] = max(0, q.get("n", 0) - 1)
        if q["n"] == 0:
            live["nav"] = False
            q.pop("next", None); q.pop("total", None)
    elif cmd == "nav-clear":
        live["navq"], live["nav"] = {"n": 0}, False
    elif cmd == "als":
        live["als"] = not live.get("als")
        live["alsText"] = "ALS: APPROACH" if live["als"] else ""


seed()


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _file(self, p):
        if not p.is_file():
            self.send_error(404); return
        self.send_response(200)
        self.send_header("Content-Type", MIME.get(p.suffix, "application/octet-stream"))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(p.read_bytes())

    def do_GET(self):
        u = urlparse(self.path)
        path = u.path
        if path in ("/", "/ext/noap"):
            return self._file(EXT / "noap.html")
        if path.startswith("/ext/noap/"):
            return self._file(EXT / path[len("/ext/noap/"):])
        if path.startswith("/assets/shared/"):
            return self._file(NOX / "shared" / path[len("/assets/shared/"):])
        if path.startswith("/assets/services/"):
            return self._file(NOX / "services" / path[len("/assets/services/"):])
        if path == "/scenario":
            q = parse_qs(u.query)
            state["s"] = q.get("s", [state["s"]])[0]
            state["metric"] = q.get("metric", ["0"])[0] == "1"
            seed()
            body = json.dumps(state).encode()
            self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers()
            self.wfile.write(body); return
        if path == "/stream":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            try:
                while True:
                    if state["s"] == "nomission":
                        frame = {"ping": True, "missionRunning": False}
                    else:
                        frame = {"metric": state["metric"], "ext": {"noap": live}}
                    self.wfile.write(("data: " + json.dumps(frame) + "\n\n").encode())
                    self.wfile.flush()
                    time.sleep(0.1)
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                return
        if path == "/commands":
            body = json.dumps(commands).encode()
            self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers()
            self.wfile.write(body); return
        self.send_error(404)

    def do_POST(self):
        if urlparse(self.path).path != "/ext/noap/command":
            self.send_error(404); return
        if self.headers.get("Content-Type") != "application/json":
            self.send_error(415); return
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        c = json.loads(body)
        commands.append(c)
        simulate(c)
        self.send_response(204); self.end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8790
    ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
