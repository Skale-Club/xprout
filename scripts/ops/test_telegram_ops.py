"""Offline tests: never contact production or Telegram."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("telegram_ops", Path(__file__).with_name("telegram-ops.py"))
ops = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ops)
ENV = {"GITHUB_ACTIONS": "true", "GITHUB_REF": "refs/heads/main", "OPS_TELEGRAM_ENABLED": "true",
       "OPS_TELEGRAM_BOT_TOKEN": "123:offline_TOKEN\r\n", "OPS_TELEGRAM_CHAT_ID": "-100123",
       "OPS_TELEGRAM_THREAD_ID": "3", "OPS_EVENT": "ci-failed", "OPS_DETAIL": "<b>plain & safe</b>"}


def readiness(status="ok", db=True, latency=5):
    return {"status": status, "release": "a" * 40, "uptime_s": 10,
            "checks": {"database": {"ok": db, "latency_ms": latency}}}


def fetcher(report=None, overrides=None):
    responses = {"/api/health": (200, b'{"ok":true}'),
                 "/api/health/ready": (200, json.dumps(report or readiness()).encode()),
                 "/": (200, b'<!doctype html><html><body>Xprout</body></html>')}
    responses.update(overrides or {})
    def fetch(url):
        assert url.startswith(ops.BASE + "/"), url
        return responses[url[len(ops.BASE):]]
    return fetch


class OpsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.state = str(Path(self.temp.name) / "state.json")
        self.sent = []

    def send(self, url, body):
        self.sent.append((url, json.loads(body)))
        return 200, b'{"ok":true}'

    def probe(self, fetch=None, send=None):
        with contextlib.redirect_stdout(io.StringIO()):
            return ops.probe(self.state, ENV, fetch or fetcher(), send or self.send, lambda _: None)

    def test_disabled_local_and_dev_do_not_send(self):
        for change in ({"OPS_TELEGRAM_ENABLED": "false"}, {"GITHUB_ACTIONS": "false"},
                       {"GITHUB_REF": "refs/heads/dev"}):
            self.assertFalse(ops.notify(dict(ENV, **change), self.send))
        self.assertEqual(self.sent, [])

    def test_plain_text_token_normalization_and_thread(self):
        self.assertTrue(ops.notify(ENV, self.send))
        url, body = self.sent[0]
        self.assertNotIn("\r", url)
        self.assertNotIn("\n", url)
        self.assertNotIn("parse_mode", body)
        self.assertIn("<b>plain & safe</b>", body["text"])
        self.assertEqual(body["message_thread_id"], 3)

    def test_bounded_message_and_invalid_config(self):
        self.assertTrue(ops.send_message("x" * 9000, ENV, self.send))
        self.assertEqual(len(self.sent[0][1]["text"]), 3500)
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertFalse(ops.send_message("x", dict(ENV, OPS_TELEGRAM_CHAT_ID="@bad"), self.send))
        self.assertEqual(len(self.sent), 1)

    def test_rejected_responses_and_exceptions_sanitized(self):
        for code, body in ((403, b'{"ok":true}'), (200, b'{"ok":false}'), (200, b'not-json')):
            with contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertFalse(ops.notify(ENV, lambda *_: (code, body)))
            self.assertNotIn("offline_TOKEN", output.getvalue())
        def broken(*_):
            raise OSError("https://api.telegram.org/bot123:offline_TOKEN")
        with contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertFalse(ops.notify(ENV, broken))
        self.assertNotIn("offline_TOKEN", output.getvalue())

    def test_cold_healthy_is_silent(self):
        self.assertEqual(self.probe(), 0)
        self.assertEqual(self.sent, [])

    def test_incident_duplicate_and_recovery(self):
        down = fetcher(overrides={"/": (503, b'bad')})
        self.assertEqual(self.probe(down), 1)
        self.probe(down)
        self.assertEqual(len(self.sent), 1)
        self.assertIn("public page HTTP 503", self.sent[0][1]["text"])
        self.assertEqual(self.probe(), 0)
        self.assertIn("uptime-recovered", self.sent[1][1]["text"])
        self.probe()
        self.assertEqual(len(self.sent), 2)

    def test_failed_delivery_retries_incident_and_recovery(self):
        down = fetcher(readiness("down", False))
        reject = lambda *_: (200, b'{"ok":false}')
        self.probe(down, reject)
        self.assertIsNone(json.loads(Path(self.state).read_text())["last_notified"])
        self.probe(down)
        self.probe(send=reject)
        self.assertEqual(json.loads(Path(self.state).read_text())["last_notified"], "down")
        self.probe()
        self.assertEqual(len(self.sent), 2)
        self.assertIn("uptime-recovered", self.sent[1][1]["text"])

    def test_sustained_slow_only_alerts_second_run(self):
        slow = fetcher(readiness("degraded", True, 1800))
        self.assertEqual(self.probe(slow), 1)
        self.assertEqual(self.sent, [])
        self.probe(slow)
        self.assertEqual(len(self.sent), 1)
        self.assertIn("uptime-degraded", self.sent[0][1]["text"])

    def test_corrupt_cache_streak_does_not_break_probe(self):
        Path(self.state).write_text(json.dumps({"version": 1, "slow_streak": "invalid"}))
        self.assertEqual(self.probe(fetcher(readiness("degraded", True, 1800))), 1)
        self.assertEqual(json.loads(Path(self.state).read_text())["slow_streak"], 1)

    def test_undelivered_incident_does_not_claim_recovery(self):
        self.probe(fetcher(readiness("down", False)), lambda *_: (500, b'{}'))
        self.assertEqual(self.probe(), 0)
        self.assertEqual(self.sent, [])

    def test_bad_200_payloads_and_dependency_failures(self):
        for path, body in (("/api/health", b'{}'), ("/api/health/ready", b'{}'),
                           ("/api/health/ready", b'no-json'), ("/", b'not-html')):
            status, _ = ops.probe_once(fetcher(overrides={path: (200, body)}))
            self.assertEqual(status, "down")
        self.assertEqual(ops.probe_once(fetcher(readiness(db=False)))[0], "down")

    def test_transient_down_retries_and_becomes_healthy_silently(self):
        calls = []
        healthy = fetcher()
        def fetch(url):
            calls.append(url)
            if len(calls) == 1:
                raise OSError("offline")
            return healthy(url)
        self.assertEqual(self.probe(fetch), 0)
        self.assertEqual(len(calls), 6)
        self.assertEqual(self.sent, [])

    def test_transport_bounds_reads_and_disables_redirects(self):
        class Response:
            status = 200
            def __enter__(self): return self
            def __exit__(self, *_): pass
            def read(self, count):
                self.count = count
                return b'x' * count
        response = Response()
        class Opener:
            def open(self, request, timeout):
                self.timeout = timeout
                return response
        opener = Opener()
        with patch.object(ops.urllib.request, "build_opener", return_value=opener) as build:
            with self.assertRaises(ValueError):
                ops.transport("https://example.invalid")
            self.assertIsInstance(build.call_args.args[0], ops.NoRedirect)
        self.assertEqual(response.count, ops.MAX_BYTES + 1)
        self.assertEqual(opener.timeout, 10)

    def test_oversized_homepage_uses_bounded_html_prefix(self):
        class Response:
            status = 200
            def __enter__(self): return self
            def __exit__(self, *_): pass
            def read(self, count): return b'<html>' + b'x' * (count - 6)
        class Opener:
            def open(self, *_args, **_kwargs): return Response()
        with patch.object(ops.urllib.request, "build_opener", return_value=Opener()):
            code, body = ops.transport(ops.BASE + "/")
        self.assertEqual(code, 200)
        self.assertEqual(len(body), ops.MAX_BYTES)
        self.assertIn(b'<html>', body)


if __name__ == "__main__":
    unittest.main()
