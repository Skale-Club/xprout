# Observability

One **request id** ties everything together. The middleware gives every request
an id (or keeps the one from the proxy) and returns it in the `x-request-id`
response header. The same id shows up in:

- **logs**: the `request_id` field on every line of that request;
- **Sentry**: the `request_id` tag;
- **audit trail**: the `request_id` column of each change the request made;
- **API error bodies**: `{"error": "...", "request_id": "..."}`.

So a user report ("it failed at 14:32") → the response's `x-request-id` (browser
devtools, or the error body) → the logs, the Sentry event and the database
changes of that exact request.

## Logs

Code: `src/lib/observability/log.ts`. Each line is one JSON object on
stdout/stderr, which Coolify collects:

```json
{"ts":"2026-10-25T20:52:31.825Z","level":"info","event":"http.request","request_id":"723da9df-…","route":"GET /api/health/ready","tenant_id":"…","actor_id":"…","method":"GET","status":200,"duration_ms":882}
```

- API routes wrapped with `withApi('POST /api/orders', handler)` log one
  `http.request` line per call, with status and duration. All admin,
  superadmin, order, payment, chat and analytics routes are wrapped. An
  unexpected throw is logged as `http.unhandled_error`, sent to Sentry and
  answered as a 500 that includes the `request_id`.
- `log.info|warn|error('event.name', { ...fields, err })` adds the current
  request, restaurant and user on its own.
- Secret-looking fields (key, token, password, secret, cookie, authorization)
  are redacted. Use `maskPhoneForLog()` for phone numbers.
- `LOG_LEVEL=debug|info|warn|error` (default `info`).

**Searching in Coolify:** open the app → Logs, and search for a `request_id`, an
`event` (`orders.create_error`) or a `tenant_id`.

## Sentry

On in production (`skale-club/xmartmenu`). The SDK stays **off until a DSN is
set**, so a new environment needs these steps:

1. Create a Next.js project at sentry.io.
2. **Coolify (runtime env):** `SENTRY_DSN`. Optional:
   `SENTRY_ENVIRONMENT=production` and `SENTRY_TRACES_SAMPLE_RATE` (default 0.1).
3. **GitHub → Settings → Variables:** `NEXT_PUBLIC_SENTRY_DSN` (the same DSN,
   baked into the browser bundle), plus `SENTRY_ORG` and `SENTRY_PROJECT`.
4. **GitHub → Secrets:** `SENTRY_AUTH_TOKEN`, so source maps are uploaded and
   stack traces point at the real code.

**Rotating `SENTRY_AUTH_TOKEN`:** the next deploy must include a new commit.
BuildKit secrets are not part of the cache key, so redeploying the same commit
reuses the cached `npm run build` layer and uploads nothing. Upload failures do
not fail the build: look for `@sentry/nextjs` errors in the build log.

What it records:

- **Release:** every event carries the git sha of the deploy (`GIT_SHA` →
  `NEXT_PUBLIC_RELEASE`).
- **Tags:** `request_id`, `route`, `tenant_id`, `role`, plus the user id.
- **Scrubbing** before sending (`sentry-scrub.ts`): cookies, auth headers and
  keys are removed, phones and e-mails are masked, and only the user id is kept.

## Audit trail

Migration `20261025180000_audit_trail.sql`. Triggers record every
insert/update/delete on restaurants, settings, subscriptions, plans, users,
menus, categories, dishes, options, media, ingredients, tables, locations,
delivery zones, chat and Stripe settings, and QR codes. For orders, only
status changes are recorded.

Each change records:

- **who** (`actor_id`);
- **from where** (`via`):
  - `browser`: the admin's own token;
  - `server`: an API route, with the user taken from the `x-actor-id` header
    our server sends;
  - `sql`: migrations or the dashboard;
- **what changed**: `{"price": [20, 24]}`, with secrets redacted;
- **the request id**.

Where to see it:

- **Superadmin → Audit trail** (`/audit`): filter by restaurant, kind of
  change, person, period or request id.
- **Owners** can read their own restaurant's history via RLS (no screen yet).
  Staff can't read it.

Nobody can edit or delete it through the API.

Growth: one row per change. Prune old rows when needed:

```sql
DELETE FROM audit_events WHERE occurred_at < now() - interval '1 year';
```

## Health

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Liveness: the process is up. Used by Docker/Coolify. No dependencies. |
| `GET /api/health/ready` | Readiness: database reachable, latency, release, uptime. 200 `ok`/`degraded`, 503 `down`. |

Send `Authorization: Bearer $HEALTH_TOKEN` to `/ready` to also see which
integrations are configured (Sentry, OpenRouter, Stripe, rate-limit store,
storage). It shows booleans only, never values. Set `HEALTH_TOKEN` in Coolify.

## Production operations on Telegram

`scripts/ops/telegram-ops.py` sends outbound HTTPS requests to Telegram from
GitHub Actions. There is no inbound webhook or application runtime dependency.
Ops uses a dedicated destination; existing application/order bot settings and
the shared host watchdog's global recipients must remain separate.

Repository configuration (GitHub Settings → Secrets and variables → Actions):

| Setting | Kind | Purpose |
|---|---|---|
| `OPS_TELEGRAM_BOT_TOKEN` | Secret | Dedicated operations bot token |
| `OPS_TELEGRAM_CHAT_ID` | Secret | Numeric dedicated group/chat id, including a negative sign when applicable |
| `OPS_TELEGRAM_THREAD_ID` | Optional variable | Positive numeric forum topic id; omit for an ordinary group |
| `OPS_TELEGRAM_ENABLED` | Variable | Set exactly `true` to activate sends; absent/false disables them |
| `COOLIFY_TOKEN` | Existing secret | Required for deployment; missing credentials fail the pipeline |

The bot must be allowed to post in the target group/topic. Never put a token in
workflow source, command arguments or a Journal entry. The helper trims trailing
token whitespace/CR, validates numeric destinations, bounds messages, reads and
timeouts, and checks HTTP 200 plus Telegram `ok: true`. Messages use plain text;
raw service response bodies and exception URLs are never logged. Delivery
failures produce a sanitized warning and cannot turn deployment failure into
success or make a successful deployment fail.

`notify` reads `OPS_EVENT`, `OPS_DETAIL`, `OPS_SHA` and `OPS_RUN_URL` from the
environment. It also requires `GITHUB_ACTIONS=true` and
`GITHUB_REF=refs/heads/main`; local/dev runs cannot send through this CLI.
The importable `send_message(text, env=None) -> bool` is available to the
separate, explicitly enabled production host timer.

The CI workflow sends `ci-failed` when production validation blocks publication.
The release pipeline sends `build-started` before building and
`deploy-succeeded` only after Coolify finishes and readiness proves HTTP 200,
the expected SHA, `status: ok` and `checks.database.ok: true`. A matching SHA
with HTTP 503, invalid JSON, degradation or an unhealthy database is a failed
verification. `build-deploy-failed` identifies an unsuccessful pipeline without
claiming any previous version is still serving. Redeploy/rollback uses the same
verification and `rollback-started`, `rollback-succeeded` or `rollback-failed`.
Cancellation messages are best effort: a runner killed before its final step
cannot deliver one. Build/rollback workflows refuse non-main execution.

### External uptime and incident state

`.github/workflows/uptime.yml` probes the fixed HTTPS origin `xprout.app` every
10 minutes at :03/:13/:23/:33/:43/:53 and supports manual execution on main.
GitHub schedule delivery may be delayed; this is not a real-time SLA. It checks
`/api/health` (valid JSON with `ok: true`), `/api/health/ready` (valid documented
schema and database check), and `/` (HTTP 200 with HTML). Redirects fail closed.
The previous `APP_URL` override is intentionally no longer used; the external
production monitor cannot be pointed at a development origin. No health token
is needed and no privileged integration details are requested.

Down checks retry twice with five-second pauses before classification. A down
result distinguishes liveness, database/readiness and public-page failure.
Database latency above 1500 ms (or reported `degraded`) must persist
across two scheduled observations before a warning notification. Both degraded
and down observations fail the workflow independently of Telegram delivery.
The threshold preserves the application's database measurement, not external
network roundtrip time. A read-only production probe on 2026-11-17 measured
926 ms database latency with `status: ok` over a 1703 ms network roundtrip;
counting that roundtrip would incorrectly report database degradation. Network
unreachability remains bounded by the ten-second HTTP timeout.
Routine healthy checks are silent. Transitions send `uptime-down`,
`uptime-degraded`, and `uptime-recovered`; repeated unchanged incidents are silent.
A cold healthy run establishes a baseline without announcing recovery.
If an incident's Telegram notification was never delivered before it clears,
the healthy result is recorded silently; a recovery is only announced for an
incident the group was successfully notified about.

The Actions cache keeps observed status, slow-check streak and the last
successfully notified status separately. Failed incident and recovery deliveries
remain retryable on subsequent runs. Restore uses a versioned prefix and save
uses a unique run id plus run attempt; saving runs even after an unhealthy
probe. Uptime runs are serialized and do not cancel each other. Cache is best
effort: eviction, unavailable cache or canceled saves can lose incident history,
cause a duplicate down notification, delay a slow warning, or miss a recovery.
This limitation is acceptable for the initial monitor; a durable incident store
is needed for stronger guarantees.

### Activation and offline verification

First run the offline tests below; they fake transport and never send messages,
trigger deployments or create real outages. Configure the dedicated secrets,
verify the destination id/topic, then enable `OPS_TELEGRAM_ENABLED=true` and
manually run Uptime on main. A healthy baseline is intentionally silent; inspect
the Actions summary. A separate explicit smoke message may verify routing when
authorized, without manufacturing an outage. Set the variable to `false` to
stop GitHub notifications while probes continue.
To silence both routes, set the GitHub variable to `false` and run
`systemctl disable --now xprout-ops-watchdog.timer` on the host.

```sh
python3 -m unittest discover -s scripts/ops -p test_telegram_ops.py
node --test scripts/ops/xprout-deploy-image.test.mjs
```

Measured on Surface (2026-11-17): targeted Python tests ~0.1 s and deploy Node
fixtures ~8.3 s; no local full builds were run.

### Dedicated host watchdog

`scripts/ops/telegram-host-watchdog.py` runs outside Docker on the application
host. It checks disk (85%), memory (90%), swap (50%), and the current app
container in Compose project `gmaayluj11x1m6j7baogonfn`, service `app`. It ignores
retired stopped containers when a replacement is running and allows two minutes
for container health startup. Resident plus swapped cgroup memory at 35% of host
RAM is another signal. Thresholds match the shared watchdog's initial defaults;
they are operational warnings, not application performance guarantees.

Install the helper and watchdog at `/opt/xprout-ops/` with root-owned source
files. Install the versioned `xprout-ops-watchdog.service` and `.timer` in
`/etc/systemd/system/`. The service loads `/etc/xprout-ops.env` (root only, 0600),
which contains the dedicated `OPS_TELEGRAM_*` credentials and explicit enable
switch. The timer runs every ten minutes, with a short randomized delay.
The existing shared `/etc/skale-watchdog.env` and its recipients are unchanged.

Persistent state and a nonblocking lock live in `/var/lib/xprout-ops/` (0700).
Each problem class has a six-hour repeat window and one recovery notification.
Failed delivery is never acknowledged and is retried; recovery delivery is
retried too. Host collection failure itself becomes a signal. This watchdog
cannot report complete host failure; the independent GitHub probe covers that.

`python scripts/ops/configure-telegram-ops.py --chat-id <group-id>` prompts for
the bot token with hidden input. It validates bot/group membership, resolves a
group upgrade, saves GitHub secrets via stdin and the dedicated root environment
over SSH, and leaves both destinations disabled for review. Its ignored status
receipt contains only bot/group identity and configuration state. It never
writes a local token file. Review before enabling the variable and host timer.

Backup freshness and scheduled application job failure checks remain a later
increment. They require verified receipt/job contracts and are not claimed by
the process/database/host checks above.
