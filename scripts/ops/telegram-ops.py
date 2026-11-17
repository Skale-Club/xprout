#!/usr/bin/env python3
"""Production-only outbound ops notifications and external probes; stdlib only."""
import argparse
import json
import math
import os
from pathlib import Path
import re
import time
import urllib.error
import urllib.request

MAX_BYTES = 65536
TIMEOUT = 10
BASE = "https://xprout.app"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def transport(url, payload=None):
    """Bound reads, timeout and redirects; callers never print exception URLs."""
    headers = {"User-Agent": "Xprout-Production-Ops/1", "Cache-Control": "no-cache"}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=payload, headers=headers)
    try:
        response = urllib.request.build_opener(NoRedirect()).open(request, timeout=TIMEOUT)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        body = response.read(MAX_BYTES + 1)
        # The public Next.js document can exceed 64 KiB; its bounded prefix is
        # sufficient for the HTML marker. JSON/Telegram must be complete.
        if len(body) > MAX_BYTES and url != BASE + "/":
            raise ValueError("response too large")
        return response.status, body[:MAX_BYTES]


def notify(env=os.environ, send=transport):
    """Best effort; returns delivery result without changing a job's outcome."""
    if (env.get("OPS_TELEGRAM_ENABLED") != "true"
            or env.get("GITHUB_ACTIONS") != "true"
            or env.get("GITHUB_REF") != "refs/heads/main"):
        return False
    lines = ["Xprout production | " + env.get("OPS_EVENT", "notification")[:80]]
    for key in ("OPS_DETAIL", "OPS_SHA", "OPS_RUN_URL"):
        if env.get(key):
            lines.append(env[key][:1000])
    return send_message("\n".join(lines), env, send)


def send_message(text, env=None, send=transport):
    """Dedicated host timer/API; disabled unless explicitly enabled in its environment."""
    env = os.environ if env is None else env
    if env.get("OPS_TELEGRAM_ENABLED") != "true":
        return False
    token = env.get("OPS_TELEGRAM_BOT_TOKEN", "").replace("\r", "").strip()
    chat = env.get("OPS_TELEGRAM_CHAT_ID", "").strip()
    thread = env.get("OPS_TELEGRAM_THREAD_ID", "").strip()
    try:
        if not re.fullmatch(r"[0-9]+:[A-Za-z0-9_-]+", token):
            raise ValueError("invalid bot configuration")
        if not re.fullmatch(r"-?[0-9]+", chat) or (thread and not re.fullmatch(r"[1-9][0-9]*", thread)):
            raise ValueError("invalid destination configuration")
        # Plain text: no HTML/Markdown parser, mentions or response bodies.
        payload = {"chat_id": chat, "text": text[:3500],
                   "disable_web_page_preview": True}
        if thread:
            payload["message_thread_id"] = int(thread)
        code, body = send("https://api.telegram.org/bot" + token + "/sendMessage",
                          json.dumps(payload).encode())
        result = json.loads(body)
        if code != 200 or not isinstance(result, dict) or result.get("ok") is not True:
            raise ValueError("delivery rejected")
        return True
    except Exception:
        # Never log exception strings: urllib exceptions can contain the bot token.
        print("::warning::Ops Telegram notification was not delivered; check dedicated ops configuration/network.")
        return False


def json_object(body):
    value = json.loads(body)
    if not isinstance(value, dict):
        raise ValueError("expected object")
    return value


def number(value):
    return type(value) in (int, float) and math.isfinite(value) and value >= 0


def probe_once(fetch=transport):
    """Probe only the fixed production origin; no auth/tenant/customer data."""
    failures = []
    ready = None
    elapsed = 0
    for path, label in (("/api/health", "liveness"), ("/api/health/ready", "readiness"), ("/", "public page")):
        try:
            started = time.monotonic()
            code, body = fetch(BASE + path)
            duration = (time.monotonic() - started) * 1000
            if code != 200:
                failures.append(label + " HTTP " + str(code))
                continue
            if label == "liveness":
                if json_object(body).get("ok") is not True:
                    raise ValueError("invalid liveness")
            elif label == "readiness":
                ready = json_object(body)
                database = ready.get("checks", {}).get("database", {})
                if (ready.get("status") not in ("ok", "degraded", "down")
                        or not isinstance(ready.get("release"), str) or not ready["release"]
                        or not number(ready.get("uptime_s"))
                        or type(database.get("ok")) is not bool
                        or not number(database.get("latency_ms"))):
                    raise ValueError("invalid readiness")
                if database["ok"] is not True or ready["status"] == "down":
                    failures.append("readiness database unavailable")
                elapsed = max(duration, database["latency_ms"])
            elif b"<html" not in body.lower():
                raise ValueError("invalid public page")
        except Exception:
            failures.append(label + " invalid response or unreachable")
    if failures:
        return "down", "; ".join(failures)
    if ready["status"] == "degraded" or elapsed > 1500:
        return "degraded", "Readiness/database latency above 1500 ms"
    return "healthy", "Liveness, readiness/database and public page passed"


def probe(state_path, env=os.environ, fetch=transport, send=transport, pause=time.sleep):
    try:
        state = json.loads(Path(state_path).read_text())
        if not isinstance(state, dict) or state.get("version") != 1:
            state = {}
    except (OSError, ValueError):
        state = {}
    status, detail = probe_once(fetch)
    for _ in range(2):
        if status != "down":
            break
        pause(5)
        status, detail = probe_once(fetch)
    prior_streak = state.get("slow_streak", 0)
    if type(prior_streak) is not int or prior_streak < 0:
        prior_streak = 0
    streak = min(prior_streak, 100) + 1 if status == "degraded" else 0
    notified = state.get("last_notified")
    if notified not in ("healthy", "degraded", "down"):
        notified = None
    # A cold healthy run establishes a baseline, never announces a false recovery.
    if status == "healthy" and notified is None:
        notified = "healthy"
    elif status != notified and (status != "degraded" or streak >= 2):
        event = {"down": "uptime-down", "degraded": "uptime-degraded", "healthy": "uptime-recovered"}[status]
        if notify(dict(env, OPS_EVENT=event, OPS_DETAIL=detail), send):
            notified = status
    # Keep successful delivery separate: failed incident/recovery sends retry next run.
    Path(state_path).parent.mkdir(parents=True, exist_ok=True)
    Path(state_path).write_text(json.dumps({"version": 1, "observed": status,
                                          "last_notified": notified, "slow_streak": streak}) + "\n")
    print("Production probe: " + status + " — " + detail)
    summary = env.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as output:
            output.write("## Production uptime: " + status + "\n" + detail + "\n")
    return 0 if status == "healthy" else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("notify", "probe"))
    parser.add_argument("--state", default=".ops-state/uptime.json")
    args = parser.parse_args()
    if args.command == "notify":
        notify()
        return 0
    return probe(args.state)


if __name__ == "__main__":
    raise SystemExit(main())
