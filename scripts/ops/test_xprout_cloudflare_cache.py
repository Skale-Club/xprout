"""Pure operator tests. No real Cloudflare requests or credentials."""
import copy
import importlib.util
import io
import json
import tempfile
import unittest
import urllib.error
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('cache_ops', Path(__file__).with_name('xprout-cloudflare-cache.py'))
ops = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ops)
ZONE = 'a' * 32
RULESET = 'b' * 32


class FakeApi:
    def __init__(self, current=None):
        self.current, self.calls = copy.deepcopy(current), []

    def call(self, method, path, body=None):
        self.calls.append((method, path, copy.deepcopy(body)))
        if method == 'GET' and path == '/zones/' + ZONE:
            return {'id': ZONE, 'name': ops.HOST}
        if method == 'GET':
            return copy.deepcopy(self.current)
        if method in ('POST', 'PUT'):
            version = int((self.current or {}).get('version', '0')) + 1
            self.current = {**copy.deepcopy(body), 'id': RULESET, 'version': str(version)}
            for index, rule in enumerate(self.current['rules']):
                rule.setdefault('id', f'{index + 1:032x}')
            return copy.deepcopy(self.current)
        raise AssertionError('Unexpected mutation')


class CacheOperatorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.output = Path(self.temp.name) / 'review'

    def existing(self):
        return {'id': RULESET, 'name': 'Existing cache rules', 'kind': 'zone', 'phase': ops.PHASE, 'version': '4',
                'rules': [{'id': 'c' * 32, 'ref': 'unrelated', 'action': 'set_cache_settings', 'expression': 'http.host eq "other.example.org"', 'action_parameters': {'cache': False}, 'enabled': True}]}

    def test_template_requires_no_credentials_and_never_calls_api(self):
        with patch.object(ops.urllib.request.OpenerDirector, 'open', side_effect=AssertionError('No HTTP')), redirect_stdout(io.StringIO()):
            ops.main(['--mode', 'template', '--output-dir', str(self.output)])
        template = json.loads((self.output / 'template.json').read_text())
        self.assertFalse(template['server_validated'])
        self.assertEqual([rule['ref'] for rule in template['rules']], list(ops.REFS))
        for rule in template['rules']:
            self.assertIn('http.host eq "xprout.app"', rule['expression'])
            self.assertNotIn(' matches ', rule['expression'])
            self.assertNotIn('cache_key', rule['action_parameters'])
            self.assertLess(len(rule['expression']), 4096)

    def test_plan_preserves_unrelated_rules_and_writes_exact_backup_and_hashes(self):
        before = self.existing(); api = FakeApi(before)
        plan = ops.Operator(api, ZONE).plan(self.output)
        backup = json.loads((self.output / 'backup.json').read_text())
        proposed = json.loads((self.output / 'candidate.json').read_text())
        self.assertEqual(backup, before)
        self.assertEqual(plan['backup_sha256'], ops.digest(before))
        self.assertEqual(proposed['rules'][0], before['rules'][0])
        self.assertTrue(all(call[0] == 'GET' for call in api.calls))

    def test_apply_rechecks_fingerprint_and_readback_then_rollback_restores_prior_definitions(self):
        before = self.existing(); api = FakeApi(before); operator = ops.Operator(api, ZONE)
        operator.plan(self.output)
        applied = operator.apply(self.output / 'plan.json', ops.HOST)
        self.assertEqual(applied['current_sha256'], ops.digest(api.current))
        self.assertEqual(len(api.current['rules']), 4)
        operator.rollback(self.output / 'plan.json', ops.HOST)
        self.assertEqual(api.current['rules'], before['rules'])
        self.assertEqual(api.current['name'], before['name'])

    def test_empty_entrypoint_is_created_then_rollback_removes_only_managed_rules(self):
        api = FakeApi(); operator = ops.Operator(api, ZONE); operator.plan(self.output)
        operator.apply(self.output / 'plan.json', ops.HOST)
        self.assertTrue(any(method == 'POST' for method, _, _ in api.calls))
        operator.rollback(self.output / 'plan.json', ops.HOST)
        self.assertEqual(api.current['rules'], [])
        self.assertFalse(any(method == 'DELETE' for method, _, _ in api.calls))

    def test_stale_plan_or_changed_post_apply_version_refuses_to_overwrite(self):
        api = FakeApi(self.existing()); operator = ops.Operator(api, ZONE); operator.plan(self.output)
        api.current['version'] = '5'
        with self.assertRaisesRegex(ops.Refused, 'changed since plan'):
            operator.apply(self.output / 'plan.json', ops.HOST)
        self.assertFalse(any(method in ('PUT', 'POST') for method, _, _ in api.calls))
        api.current['version'] = '4'; operator.apply(self.output / 'plan.json', ops.HOST)
        api.current['version'] = '99'
        with self.assertRaisesRegex(ops.Refused, 'changed since apply'):
            operator.rollback(self.output / 'plan.json', ops.HOST)

    def test_exact_scope_confirmation_and_artifact_integrity_are_required(self):
        for zone, host in [(ZONE, 'other.example.org'), ('not-a-zone', ops.HOST)]:
            with self.assertRaises(ops.Refused): ops.Operator(FakeApi(), zone, host)
        api = FakeApi(self.existing()); operator = ops.Operator(api, ZONE); operator.plan(self.output)
        with self.assertRaises(ops.Refused): operator.apply(self.output / 'plan.json', 'other.example.org')
        proposed = json.loads((self.output / 'candidate.json').read_text()); proposed['rules'] = []
        (self.output / 'candidate.json').write_text(json.dumps(proposed))
        with self.assertRaisesRegex(ops.Refused, 'changed'):
            operator.apply(self.output / 'plan.json', ops.HOST)

    def test_actual_zone_name_is_verified_before_reading_or_writing_rules(self):
        api = FakeApi()
        with patch.object(api, 'call', return_value={'id': ZONE, 'name': 'other.example.org'}) as call:
            with self.assertRaisesRegex(ops.Refused, 'Zone identity mismatch'):
                ops.Operator(api, ZONE).plan(self.output)
        self.assertEqual(call.call_count, 1)

    def test_only_named_literal_env_values_are_read_and_never_printed(self):
        path = Path(self.temp.name) / 'input.env'
        path.write_text('UNRELATED_SECRET=do-not-read\nCLOUDFLARE_TOKEN="fixture-token"\n')
        self.assertEqual(ops.token_from({}, path), 'fixture-token')
        self.assertEqual(ops.token_from({'CLOUDFLARE_API_TOKEN': 'env-token'}, path), 'env-token')
        output = io.StringIO()
        with redirect_stdout(output):
            ops.main(['--mode', 'template', '--output-dir', str(self.output)])
        self.assertNotIn('fixture-token', output.getvalue())
        self.assertNotIn('do-not-read', output.getvalue())

    def test_forbidden_is_never_treated_as_an_empty_ruleset_and_error_body_stays_private(self):
        failure = urllib.error.HTTPError('https://api.cloudflare.com', 403, 'Forbidden', {}, io.BytesIO(b'{"success":false,"errors":[{"message":"secret-token"}]}'))
        with patch.object(ops.urllib.request.OpenerDirector, 'open', side_effect=failure):
            with self.assertRaisesRegex(ops.Refused, 'HTTP 403') as caught:
                ops.Api('secret-token').call('GET', '/zones/' + ZONE)
        self.assertNotIn('secret-token', str(caught.exception))

    def test_final_bypass_preserves_image_query_keys_and_origin_privacy(self):
        html, image, bypass = ops.desired_rules()
        self.assertEqual(html['action_parameters']['edge_ttl'], {'mode': 'respect_origin'})
        self.assertEqual(image['action_parameters']['browser_ttl'], {'mode': 'respect_origin'})
        self.assertNotIn('cache_key', image['action_parameters'])
        self.assertEqual(image['action_parameters']['vary'], {'default': {'action': 'passthrough'}})
        self.assertEqual(bypass['action_parameters'], {'cache': False})
        for name in ['authorization', 'rsc', 'next-router-state-tree', 'next-router-prefetch']:
            self.assertIn(f'any(http.request.headers["{name}"][*] ne "")', bypass['expression'])

    def test_dashboard_managed_rules_cannot_be_duplicated_silently(self):
        dashboard = {**ops.desired_rules()[0], 'ref': 'dashboard-generated-id'}
        with self.assertRaisesRegex(ops.Refused, 'reviewed adoption'):
            ops.candidate({'rules': [dashboard]})


if __name__ == '__main__':
    unittest.main()
