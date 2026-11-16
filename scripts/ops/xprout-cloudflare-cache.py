#!/usr/bin/env python3
"""Reviewable Xprout cache-rules operator. No DNS, SSL, billing or token output."""
import argparse
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

HOST = 'xprout.app'
PHASE = 'http_request_cache_settings'
REFS = ('xprout_public_html_v1', 'xprout_next_image_v1', 'xprout_private_bypass_v1')


class Refused(Exception):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise Refused('Cloudflare redirects are not permitted')


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def token_from(env, env_file=None):
    names = ('CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_TOKEN')
    token = next((env[name] for name in names if env.get(name)), None)
    if not token and env_file:
        # Parse only the two permitted literal values; never evaluate a dotenv file.
        for line in Path(env_file).read_text(encoding='utf-8-sig').splitlines():
            match = re.fullmatch(r'\s*(?:export\s+)?(CLOUDFLARE_API_TOKEN|CLOUDFLARE_TOKEN)\s*=\s*(.*?)\s*', line)
            if match and match[2]:
                token = match[2].strip('"\'')
                break
    if not token or any(char.isspace() for char in token):
        raise Refused('A valid explicit Cloudflare token is required')
    return token


def desired_rules():
    scope = '(http.host eq "xprout.app")'
    methods = '(http.request.method in {"GET" "HEAD"})'
    headers = ['authorization', 'rsc', 'next-router-prefetch', 'next-router-state-tree', 'next-router-segment-prefetch']
    sensitive = '(' + ' or '.join(f'any(http.request.headers["{name}"][*] ne "")' for name in headers) + ')'
    prefixes = ['/api', '/auth', '/oauth', '/identity', '/checkout', '/onboarding', '/admin', '/superadmin', '/dashboard',
                '/settings', '/menu', '/menus', '/orders', '/tenants', '/overview', '/users', '/staff-access', '/plans', '/chat-inbox', '/monitoring', '/.well-known']
    private = '(' + ' or '.join(f'(http.request.uri.path eq "{path}" or starts_with(http.request.uri.path, "{path}/"))' for path in prefixes) + ')'
    nested = '(' + ' or '.join(f'(ends_with(http.request.uri.path, "/{part}") or http.request.uri.path contains "/{part}/")' for part in ['me', 'waiter', 'preview', 'staging']) + ')'
    image = '(http.request.uri.path eq "/_next/image")'
    framework = '(starts_with(http.request.uri.path, "/_next/") and not starts_with(http.request.uri.path, "/_next/static/") and not ' + image + ')'
    clean = f'({methods} and http.cookie eq "" and not {sensitive})'
    origin = {'cache': True, 'edge_ttl': {'mode': 'respect_origin'}, 'browser_ttl': {'mode': 'respect_origin'}}
    return [
        {'ref': REFS[0], 'description': 'Xprout anonymous pretty HTML: honor origin policy', 'enabled': True,
         'action': 'set_cache_settings', 'action_parameters': origin,
         'expression': f'{scope} and {clean} and http.request.uri.query eq "" and not {private} and not {nested} and not {framework} and not (http.request.uri.path contains ".")'},
        {'ref': REFS[1], 'description': 'Xprout Next image: preserve complete default query key', 'enabled': True,
         'action': 'set_cache_settings', 'action_parameters': {**origin, 'vary': {'default': {'action': 'passthrough'}}}, 'expression': f'{scope} and {image} and {clean}'},
        {'ref': REFS[2], 'description': 'Xprout final private/session/RSC/query bypass', 'enabled': True,
         'action': 'set_cache_settings', 'action_parameters': {'cache': False},
         'expression': f'{scope} and (not {methods} or http.cookie ne "" or {sensitive} or {private} or {nested} or {framework} or (http.request.uri.query ne "" and not {image}))'},
    ]


def writable(ruleset):
    return {key: value for key, value in ruleset.items() if key in ('name', 'description', 'kind', 'phase', 'rules')}


def clean_rule(rule):
    return {key: value for key, value in rule.items() if key not in ('version', 'last_updated')}


def candidate(previous):
    managed_names = {rule['description'] for rule in desired_rules()}
    if any(rule.get('description') in managed_names and rule.get('ref') not in REFS for rule in (previous or {}).get('rules', [])):
        raise Refused('Existing dashboard rules require explicit reviewed adoption; refusing duplicate rules')
    body = writable(previous) if previous else {'name': 'Xprout cache settings', 'kind': 'zone', 'phase': PHASE}
    body['rules'] = [clean_rule(rule) for rule in (previous or {}).get('rules', []) if rule.get('ref') not in REFS] + desired_rules()
    return body


class Api:
    def __init__(self, token):
        self.token = token

    def call(self, method, path, body=None):
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request('https://api.cloudflare.com/client/v4' + path, data=data, method=method,
                                         headers={'Authorization': 'Bearer ' + self.token, 'Content-Type': 'application/json'})
        try:
            with urllib.request.build_opener(NoRedirect()).open(request, timeout=30) as response:
                status, raw = response.status, response.read(4_000_001)
        except urllib.error.HTTPError as error:
            status, raw = error.code, error.read(4_000_001)
        except Exception:
            raise Refused('Cloudflare request failed') from None
        if len(raw) > 4_000_000:
            raise Refused('Cloudflare response exceeds budget')
        try:
            value = json.loads(raw)
        except Exception:
            raise Refused('Cloudflare response is not JSON') from None
        if status == 404 and value.get('errors') and all(error.get('code') == 10003 for error in value['errors']):
            return None
        if status >= 400 or value.get('success') is not True:
            raise Refused(f'Cloudflare request refused: HTTP {status}')
        return value.get('result')


class Operator:
    def __init__(self, api, zone_id, host=HOST):
        if host != HOST or not re.fullmatch(r'[a-f0-9]{32}', zone_id or ''):
            raise Refused('Exact xprout.app zone ID and host required')
        self.api, self.zone_id = api, zone_id
        self.base = '/zones/' + zone_id

    def scope(self):
        zone = self.api.call('GET', self.base)
        if not zone or zone.get('id') != self.zone_id or zone.get('name') != HOST:
            raise Refused('Zone identity mismatch')

    def current(self):
        current = self.api.call('GET', self.base + '/rulesets/phases/' + PHASE + '/entrypoint')
        if current is not None and (current.get('kind') != 'zone' or current.get('phase') != PHASE or not re.fullmatch(r'[a-f0-9]{32}', current.get('id', ''))):
            raise Refused('Unexpected entrypoint identity')
        return current

    def plan(self, output):
        self.scope()
        current = self.current()
        output = Path(output); output.mkdir(parents=True, exist_ok=True)
        backup, proposed = current, candidate(current)
        plan = {'schema': 1, 'host': HOST, 'zone_id': self.zone_id, 'phase': PHASE, 'backup': 'backup.json',
                'backup_sha256': digest(backup), 'candidate': 'candidate.json', 'candidate_sha256': digest(proposed)}
        artifacts = [('backup.json', backup), ('candidate.json', proposed), ('plan.json', plan)]
        if any((output / name).exists() for name, _ in artifacts):
            raise Refused('Output artifacts already exist; use a new directory')
        for name, value in artifacts:
            path = output / name
            path.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')
        return plan

    def load_plan(self, path):
        path = Path(path)
        plan = json.loads(path.read_text())
        if plan.get('schema') != 1 or plan.get('host') != HOST or plan.get('zone_id') != self.zone_id or plan.get('phase') != PHASE:
            raise Refused('Plan scope mismatch')
        if plan.get('backup') != 'backup.json' or plan.get('candidate') != 'candidate.json':
            raise Refused('Plan artifacts must remain adjacent named files')
        backup = json.loads((path.parent / 'backup.json').read_text())
        proposed = json.loads((path.parent / 'candidate.json').read_text())
        if digest(backup) != plan.get('backup_sha256') or digest(proposed) != plan.get('candidate_sha256') or proposed != candidate(backup):
            raise Refused('Plan artifacts changed or contain unexpected edits')
        return plan, backup, proposed

    def verify(self, expected, actual):
        if not actual or len(expected.get('rules', [])) != len(actual.get('rules', [])):
            raise Refused('Ruleset readback differs')
        if any(actual.get(key) != value for key, value in expected.items() if key != 'rules'):
            raise Refused('Ruleset readback metadata differs')
        for want, got in zip(expected.get('rules', []), actual.get('rules', [])):
            if any(got.get(key) != value for key, value in want.items()):
                raise Refused('Ruleset readback rule differs')

    def apply(self, path, confirm):
        if confirm != HOST:
            raise Refused('Explicit --confirm-host xprout.app is required')
        plan, backup, proposed = self.load_plan(path)
        self.scope()
        if digest(self.current()) != plan['backup_sha256']:
            raise Refused('Entrypoint changed since plan; re-plan')
        if backup is None:
            self.api.call('POST', self.base + '/rulesets', proposed)
        else:
            self.api.call('PUT', self.base + '/rulesets/' + backup['id'], proposed)
        result = self.current()
        if result is None:
            raise Refused('Applied entrypoint could not be read back; review backup before retry')
        applied = {'host': HOST, 'zone_id': self.zone_id, 'current_sha256': digest(result), 'version': result.get('version')}
        (Path(path).parent / 'applied.json').write_text(json.dumps(applied, indent=2) + '\n')
        self.verify(proposed, result)
        return applied

    def rollback(self, path, confirm):
        if confirm != HOST:
            raise Refused('Explicit --confirm-host xprout.app is required')
        _, backup, _ = self.load_plan(path)
        applied = json.loads((Path(path).parent / 'applied.json').read_text())
        self.scope(); current = self.current()
        if applied.get('host') != HOST or applied.get('zone_id') != self.zone_id or digest(current) != applied.get('current_sha256'):
            raise Refused('Entrypoint changed since apply; rollback requires review')
        restored = writable(backup) if backup else writable(current)
        restored['rules'] = [clean_rule(rule) for rule in backup['rules']] if backup else [clean_rule(rule) for rule in current.get('rules', []) if rule.get('ref') not in REFS]
        self.api.call('PUT', self.base + '/rulesets/' + current['id'], restored)
        self.verify(restored, self.current())


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mode', required=True, choices=['template', 'plan', 'apply', 'rollback'])
    parser.add_argument('--zone-id'); parser.add_argument('--host', default=HOST)
    parser.add_argument('--env-file'); parser.add_argument('--output-dir', default='cloudflare-cache-review')
    parser.add_argument('--plan'); parser.add_argument('--confirm-host')
    args = parser.parse_args(argv)
    if args.host != HOST:
        raise Refused('This operator only changes xprout.app')
    if args.mode == 'template':
        output = Path(args.output_dir); output.mkdir(parents=True, exist_ok=True)
        path = output / 'template.json'
        if path.exists():
            raise Refused('Template already exists; use a new directory')
        path.write_text(json.dumps({'host': HOST, 'phase': PHASE, 'rules': desired_rules(), 'server_validated': False}, indent=2) + '\n')
    else:
        operator = Operator(Api(token_from(os.environ, args.env_file)), args.zone_id, args.host)
        if args.mode == 'plan': operator.plan(args.output_dir)
        elif not args.plan: raise Refused('--plan is required')
        elif args.mode == 'apply': operator.apply(args.plan, args.confirm_host)
        else: operator.rollback(args.plan, args.confirm_host)
    print('xprout-cloudflare-cache status=ok mode=' + args.mode)


if __name__ == '__main__':
    try: main()
    except Exception as error:
        # No raw HTTP body, request headers, token, env file contents or traceback.
        message = str(error) if isinstance(error, Refused) else 'Local artifact or input failure'
        print('xprout-cloudflare-cache status=refused reason=' + message, file=sys.stderr)
        sys.exit(1)
