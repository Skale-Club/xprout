# Dedicated Telegram Leads destination

Sales notifications belong in **Xprout | Leads**, separate from technical **Xprout | Ops** alerts and blog approvals. The same separation applies to **Xphere | Leads**, **Xpot | Leads** and **Xtimator | Leads**. The shared **@skaleclubbot** may serve these groups, but sharing the bot does not authorize mixing destinations.

## Configuration

Configure the existing shared bot token as `ACCESS_REQUEST_TELEGRAM_BOT_TOKEN` and the dedicated sales group as `ACCESS_REQUEST_TELEGRAM_CHAT_IDS`. The latter accepts comma-separated negative numeric group IDs, optionally followed by a positive safe integer topic ID, such as `-1000000000000:42`. Values shown here are placeholders. Verify the actual group's identity and the shared bot's membership before setting production configuration.

Both variables are required. Missing credentials, invalid targets, invalid topic IDs or any target matching `OPS_TELEGRAM_CHAT_ID` disable the entire lead send. No database lookup, credential decryption or delivery is attempted to recover a fallback. The sender never reads blog `telegram_settings`, approval credentials, generic Telegram credentials or technical Ops credentials. Identical targets in the configured list are deduplicated.

Do not alter `OPS_TELEGRAM_*`, blog `telegram_settings`, approval routing or the shared bot webhook when configuring Leads. Production configuration and real provider messages require the owner's authorization. This document specifies the configuration contract and does not claim that the group or variables have been provisioned.

Activated 2026-11-21: the **Xprout | Leads** group is configured in production with the shared bot (administrator there). Set or change it with the manual workflow `.github/workflows/set-leads-telegram.yml`, which reads the GitHub secrets `ACCESS_REQUEST_TELEGRAM_CHAT_IDS` (the group) and `OPS_TELEGRAM_BOT_TOKEN` (the shared bot), checks the bot is @skaleclubbot and a member of each target, refuses the Ops chat, writes only the two keys above with readback, and redeploys the image already in production through `scripts/coolify-deploy.sh`.

## Behavior and verification

New access requests and abandoned signup drafts use this dedicated Leads destination. Existing Portuguese formatting, escaped applicant fields, WhatsApp contact links and the access-request review link are retained. Delivery is disabled outside `NODE_ENV=production`, even when credentials are configured. Provider failures return `false` and never block the applicant; exception details containing credentials or customer data are not logged.

Focused regression coverage is in `tests/unit/access-request-notify.test.ts`: submitted and abandoned messages, production-only delivery, required dedicated configuration, no database/blog/approval/Ops fallback, invalid or shared destinations, explicit topics, provider failure and sanitized exception handling. Test results and actual production delivery evidence belong in the task report and Journal. No live delivery is implied by these tests.
