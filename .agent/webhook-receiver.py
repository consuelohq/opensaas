#!/usr/bin/env python3
"""
Linear Agent Webhook Receiver

Two modes:
  @mention in comment → kiro-cli chat (non-interactive, per turn)
  assign/delegate     → run-tasks.sh in tmux session "dev"

POST /webhook/linear  — AgentSessionEvent
GET  /oauth/callback   — OAuth code exchange
GET  /health           — health check

No external deps — stdlib only.
"""

import hashlib, hmac, json, os, re, subprocess, sys, threading, time
import urllib.parse, urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_DIR = "/Users/kokayi/Dev/opensaas"

# ── config ───────────────────────────────────────────────────────────────────

def _load_config():
    r = subprocess.run(
        ["bash", "-c", f"set -a && source {SCRIPT_DIR}/config.sh && env"],
        capture_output=True, text=True,
    )
    env = {}
    for line in r.stdout.splitlines():
        if "=" in line:
            k, _, v = line.partition("=")
            env[k] = v
    return env

_cfg = _load_config()
def _c(key): return os.getenv(key, _cfg.get(key, ""))

PORT = int(_c("WEBHOOK_PORT") or "8848")
WEBHOOK_SECRET = _c("LINEAR_WEBHOOK_SECRET")
OAUTH_CLIENT_ID = _c("LINEAR_OAUTH_CLIENT_ID")
OAUTH_CLIENT_SECRET = _c("LINEAR_OAUTH_CLIENT_SECRET")
OAUTH_CALLBACK_URL = _c("LINEAR_OAUTH_CALLBACK_URL")
TOKEN_FILE = os.path.join(SCRIPT_DIR, ".oauth-token.json")
KIRO_CLI = "/Users/kokayi/.local/bin/kiro-cli"
TMUX_SESSION = "dev"
_running: dict = {}  # session_id -> subprocess.Popen

# ── linear API ───────────────────────────────────────────────────────────────

def _get_token():
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE) as f:
            t = json.load(f).get("access_token")
            if t: return t
    return _c("LINEAR_API_KEY")

def _gql(query, variables=None):
    token = _get_token()
    if not token: raise RuntimeError("no linear token")
    payload = json.dumps({"query": query, "variables": variables or {}}).encode()
    req = urllib.request.Request(
        "https://api.linear.app/graphql", data=payload,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())

def send_thought(sid, body, ephemeral=False):
    _send_activity(sid, {"type": "thought", "body": body}, ephemeral)

def send_response(sid, body):
    _send_activity(sid, {"type": "response", "body": body})

def send_error(sid, body):
    _send_activity(sid, {"type": "error", "body": body})

def _send_activity(sid, content, ephemeral=False):
    m = """mutation($input: AgentActivityCreateInput!) {
        agentActivityCreate(input: $input) { success agentActivity { id } }
    }"""
    inp = {"agentSessionId": sid, "content": content}
    if ephemeral: inp["ephemeral"] = True
    try:
        r = _gql(m, {"input": inp})
        if r.get("errors"):
            print(f"[activity-err] {r['errors']}", flush=True)
    except Exception as e:
        print(f"[activity-err] {e}", flush=True)

# ── conversation history ─────────────────────────────────────────────────────

def fetch_history(session_id):
    """rebuild conversation from agent activities for multi-turn context."""
    q = """query($id: String!) {
        agentSession(id: $id) {
            activities { edges { node {
                content {
                    ... on AgentActivityThoughtContent { __typename body }
                    ... on AgentActivityResponseContent { __typename body }
                    ... on AgentActivityPromptContent { __typename body }
                    ... on AgentActivityErrorContent { __typename body }
                }
            }}}
        }
    }"""
    try:
        r = _gql(q, {"id": session_id})
        edges = r.get("data", {}).get("agentSession", {}).get("activities", {}).get("edges", [])
        parts = []
        for e in edges:
            c = (e.get("node") or {}).get("content") or {}
            typename = c.get("__typename", "")
            body = c.get("body", "")
            if not body: continue
            if "Prompt" in typename:
                parts.append(f"[user]: {body}")
            elif "Response" in typename:
                parts.append(f"[assistant]: {body}")
        return "\n\n".join(parts)
    except Exception as e:
        print(f"[history-err] {e}", flush=True)
        return ""

# ── mention flow: kiro-cli per turn ─────────────────────────────────────────

ANSI_RE = re.compile(r'\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?\x07|\x1b\[\d*;?\d*m')

def handle_mention(session_id, prompt_context, user_message=None, is_followup=False):
    """run kiro-cli non-interactive for one turn, post output to linear."""
    def _run():
        try:
            send_thought(session_id, "thinking...")

            # build the prompt
            if is_followup:
                history = fetch_history(session_id)
                prompt = ""
                if history:
                    prompt += f"<conversation_history>\n{history}\n</conversation_history>\n\n"
                prompt += f"[user]: {user_message}"
            else:
                prompt = prompt_context

            # run kiro-cli non-interactive
            proc = subprocess.Popen(
                [KIRO_CLI, "chat", "--no-interactive", "--trust-all-tools", "--agent", "orchestrator"],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                cwd=REPO_DIR, text=True,
                env={**os.environ, "NO_COLOR": "1"},
            )
            _running[session_id] = proc

            stdout, stderr = proc.communicate(input=prompt, timeout=600)
            _running.pop(session_id, None)

            output = ANSI_RE.sub('', stdout).strip()
            if output:
                send_response(session_id, output)
            else:
                err = stderr.strip()[:500] if stderr else "no output"
                send_error(session_id, f"kiro returned empty. stderr: {err}")

        except subprocess.TimeoutExpired:
            proc.kill()
            _running.pop(session_id, None)
            send_error(session_id, "timed out after 10 minutes")
        except Exception as e:
            _running.pop(session_id, None)
            print(f"[mention-err] {e}", flush=True)
            send_error(session_id, f"failed: {e}")

    threading.Thread(target=_run, daemon=True).start()

# ── assign flow: run-tasks.sh in tmux ────────────────────────────────────────

def handle_assign(session_id, issue):
    """send run-tasks.sh to tmux dev session, monitor completion."""
    identifier = issue.get("identifier", "UNKNOWN")

    def _run():
        try:
            # check tmux session exists
            check = subprocess.run(
                ["tmux", "has-session", "-t", TMUX_SESSION],
                capture_output=True,
            )
            if check.returncode != 0:
                send_error(session_id, f"tmux session '{TMUX_SESSION}' not found. start it first.")
                return

            send_thought(session_id, f"starting run-tasks.sh for {identifier} in tmux:{TMUX_SESSION}")

            # create a marker file to detect completion
            marker = f"/tmp/agent-task-{session_id[:8]}.done"
            cmd = (
                f"bash {SCRIPT_DIR}/run-tasks.sh --linear --issue {identifier}; "
                f"echo $? > {marker}"
            )

            subprocess.run(
                ["tmux", "send-keys", "-t", TMUX_SESSION, cmd, "Enter"],
                capture_output=True,
            )

            # poll for completion (check every 30s, max 2 hours)
            for _ in range(240):
                time.sleep(30)
                if os.path.exists(marker):
                    with open(marker) as f:
                        exit_code = f.read().strip()
                    os.remove(marker)
                    if exit_code == "0":
                        send_response(session_id, f"✅ run-tasks.sh completed for {identifier}")
                    else:
                        send_error(session_id, f"run-tasks.sh exited with code {exit_code} for {identifier}")
                    return

            send_error(session_id, f"run-tasks.sh timed out after 2 hours for {identifier}")

        except Exception as e:
            print(f"[assign-err] {e}", flush=True)
            send_error(session_id, f"failed to start: {e}")

    threading.Thread(target=_run, daemon=True).start()

# ── stop handling ────────────────────────────────────────────────────────────

def handle_stop(session_id):
    proc = _running.pop(session_id, None)
    if proc:
        print(f"[stop] killing kiro process for {session_id[:8]}", flush=True)
        proc.kill()
    send_response(session_id, "stopped.")

# ── signature verification ───────────────────────────────────────────────────

def verify_sig(body, sig):
    if not WEBHOOK_SECRET: return True
    expected = hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)

# ── HTTP handler ─────────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self._json(200, {
                "status": "ok",
                "running_kiro": len(_running),
            })
        elif self.path.startswith("/oauth/callback"):
            qs = urllib.parse.urlparse(self.path).query
            code = urllib.parse.parse_qs(qs).get("code", [None])[0]
            if not code:
                self._json(400, {"error": "no code"})
                return
            try:
                token_data = self._exchange_code(code)
                with open(TOKEN_FILE, "w") as f:
                    json.dump(token_data, f, indent=2)
                print(f"[oauth] token saved to {TOKEN_FILE}", flush=True)
                self._json(200, {"status": "ok", "message": "token saved"})
            except Exception as e:
                self._json(500, {"error": str(e)})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/webhook/linear":
            self._json(404, {"error": "not found"})
            return

        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if not verify_sig(body, self.headers.get("Linear-Signature", "")):
            self._json(401, {"error": "bad signature"})
            return

        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            self._json(400, {"error": "bad json"})
            return

        action = payload.get("action", "")
        ptype = payload.get("type", "")
        print(f"[webhook] type={ptype} action={action}", flush=True)

        # respond fast — linear requires <5s
        self._json(200, {"status": "accepted"})

        if ptype == "AgentSessionEvent":
            session = payload.get("agentSession") or {}
            sid = session.get("id")
            issue = session.get("issue") or {}
            comment = session.get("comment")
            prompt_context = payload.get("promptContext", "")

            if not sid:
                print("[webhook] no session id", flush=True)
                return

            if action == "created":
                if comment:
                    # @mention in a comment → chat mode
                    print(f"[webhook] mention on {issue.get('identifier', '?')}", flush=True)
                    handle_mention(sid, prompt_context)
                else:
                    # delegation/assignment → task mode
                    print(f"[webhook] assign {issue.get('identifier', '?')}", flush=True)
                    handle_assign(sid, issue)

            elif action == "prompted":
                # check for stop signal first
                activity = payload.get("agentActivity") or {}
                signal = payload.get("signal") or activity.get("signal") or ""
                if signal == "stop":
                    print(f"[webhook] stop signal for {sid[:8]}", flush=True)
                    handle_stop(sid)
                    return

                # follow-up message in existing session
                msg = activity.get("body", "")
                if not msg:
                    msg = prompt_context
                print(f"[webhook] follow-up on {issue.get('identifier', '?')}", flush=True)
                handle_mention(sid, prompt_context, user_message=msg, is_followup=True)

            elif action == "stopped":
                handle_stop(sid)

    def _json(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _exchange_code(self, code):
        data = urllib.parse.urlencode({
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": OAUTH_CALLBACK_URL,
            "client_id": OAUTH_CLIENT_ID,
            "client_secret": OAUTH_CLIENT_SECRET,
        }).encode()
        req = urllib.request.Request(
            "https://api.linear.app/oauth/token", data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())

    def log_message(self, fmt, *args):
        print(f"[http] {args[0]}", flush=True)

def main():
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"[webhook-receiver] listening on :{PORT}", flush=True)
    print(f"  POST /webhook/linear  — agent session events", flush=True)
    print(f"  GET  /oauth/callback  — oauth code exchange", flush=True)
    print(f"  GET  /health          — health check", flush=True)
    print(f"", flush=True)
    print(f"  mention → kiro-cli chat (non-interactive, per turn)", flush=True)
    print(f"  assign  → run-tasks.sh in tmux:{TMUX_SESSION}", flush=True)
    server.serve_forever()

if __name__ == "__main__":
    main()
