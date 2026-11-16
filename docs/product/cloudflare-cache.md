# Reviewed Cloudflare cache operator

`scripts/ops/xprout-cloudflare-cache.py` prepares, applies and rolls back Cache
Rules for the exact `xprout.app` zone and hostname. It uses Python's standard
library. It has no DNS, SSL, billing, account-wide ruleset or purge endpoints.
Unrelated rules in the cache phase are preserved; three stable managed refs
are appended in order so the final bypass wins over the two eligibility rules.

The currently available token returned HTTP 403 for ruleset access. No rule
expressions have been accepted by Cloudflare's API in this session. Generated
templates explicitly carry `server_validated: false`; fake-HTTP tests are not
server validation or production evidence.

## Reviewable rules

1. Anonymous GET/HEAD pretty HTML on `xprout.app`, with no cookie, query,
   authorization, RSC or Next prefetch/state headers, is eligible for cache.
   Private/global routes and nested customer/private paths are excluded.
2. `/_next/image` is eligible with its normal complete query string in the
   default cache key. Its Vary policy retains raw origin-declared header values,
   including Next Image's Accept variant, so an incompatible format is never
   reused across clients. Source URL, width and quality must never share a key with
   another image derivative. No custom cache key or paid regex operator is used.
3. A final rule bypasses cache for cookies, authorization/RSC/prefetch headers,
   private paths, methods other than GET/HEAD and queries except image queries.

Eligibility respects origin Cache-Control for both edge and browser TTL. The
operator does not override private/no-store, Set-Cookie behavior or freshness
with an unconditional TTL. Anonymous HTML's application policy is 60 seconds
plus 60 seconds stale-while-revalidate; private responses are no-store. Media
uses versioned/immutable asset identities and its own origin policy. These rules
do not prove that every pre-existing asset is immutable or optimized.

## Credentials and plan

The token needs zone read plus Cache Rules/Rulesets read and edit permissions
scoped to the one zone. DNS-only permission is insufficient. Use the owner's
approved token through `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_TOKEN`. An explicit
`--env-file` may provide only those literal values; the operator never evaluates
the file or reads other named values into configuration. Tokens and raw API
error bodies are never printed. HTTP redirects are refused.

Prepare a template without credentials or network access:

```sh
python scripts/ops/xprout-cloudflare-cache.py --mode template --output-dir cache-template-review
```

With approved read access, use a new local output directory:

```sh
python scripts/ops/xprout-cloudflare-cache.py --mode plan --zone-id ZONE_ID --host xprout.app --output-dir cache-review
```

The operator verifies the zone ID/name and reads the
`http_request_cache_settings` entrypoint. It writes `backup.json` (the exact
previous response, or null for an explicitly absent entrypoint),
`candidate.json` (the proposed writable definition) and `plan.json` with SHA-256
fingerprints. Keep these artifacts private and outside Git; unrelated existing
rules can contain organization-specific information. Existing files are never
overwritten by a plan. HTTP 403 never means an empty ruleset. Creation is only
allowed following HTTP 404 with the recognized ruleset-not-found code 10003.
Other 404/error forms require investigation.

## Apply and rollback

Inspect the backup and candidate before obtaining the owner's production OK.
Freeze competing cache-rule edits while applying: the operator rechecks the
complete fingerprint immediately before writing, but the API update is not a
transaction with other dashboard users.

```sh
python scripts/ops/xprout-cloudflare-cache.py --mode apply --zone-id ZONE_ID --plan cache-review/plan.json --confirm-host xprout.app
python scripts/ops/xprout-cloudflare-cache.py --mode rollback --zone-id ZONE_ID --plan cache-review/plan.json --confirm-host xprout.app
```

Apply verifies artifact scope/integrity, rereads current rules, then updates
that entrypoint or creates the previously absent zone entrypoint. It reads back
the result and records `applied.json` with the current version/fingerprint.
Readback differences fail visibly. Rollback refuses if anything changed since
the recorded result; otherwise it restores the previous rule definitions. If
no entrypoint existed, rollback removes only the three managed rules and leaves
an empty zone entrypoint instead of deleting an object or unrelated content.
Cloudflare versions advance during restoration; prior behavior is restored,
not an old numeric version. A readback/network failure after a write needs
manual inspection of the retained backup before retrying.

## Evidence required

Run `python -B scripts/ops/test_xprout_cloudflare_cache.py` on an authorized
runner, inspect the candidate expressions and obtain actual API acceptance.
Then run the application live SEO verifier and confirm two independent cookie
requests plus query/RSC requests bypass cache, anonymous HTML can hit cache,
and different image query parameters return their own assets. Retain the API
readback, version fingerprints and verifier JSON. This operator was prepared
without performing any Cloudflare mutation.

Primary references: [Cache Rules settings](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/),
[view rulesets](https://developers.cloudflare.com/ruleset-engine/rulesets-api/view/),
[update rulesets](https://developers.cloudflare.com/ruleset-engine/rulesets-api/update/),
[create rulesets](https://developers.cloudflare.com/ruleset-engine/rulesets-api/create/).
