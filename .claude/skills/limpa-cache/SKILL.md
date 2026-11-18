---
name: limpa-cache
description: Flush Xprout's production caches on demand so the owner sees the latest release and data right away. Use when the owner says "limpa o cache", "flush", "zera o cache", "não estou vendo a mudança", "está tudo igual" after a deploy or data edit, or asks for a fresh link to test.
---

# Limpa o cache (Xprout)

The owner tests on the live site (xprout.app), often on a phone. After a deploy or a data change the page can look unchanged. Find which layer holds the old version, clear what can be cleared, and give a link that is guaranteed fresh. Answer in Portuguese, short.

## The cache layers (what can be stale, and for how long)

| Layer | Holds | Stale for | How it is cleared |
|---|---|---|---|
| Deploy not live yet | old release | until CI + deploy finish (~17 min after a push to main) | wait; `release` line shows live vs origin/main |
| App menu cache (`src/lib/menu/public-menu-cache.ts`) | menu data per restaurant | up to 60 s | `/api/internal/revalidate-menu` with `MENU_REVALIDATE_SECRET` |
| Cloudflare edge (xprout.app zone) | public HTML | 60 s + 60 s stale-while-revalidate | zone purge with `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ZONE_ID` |
| The open page / installed app on the phone | old JavaScript in memory | until a real reload | reload the tab; close and reopen the installed app |
| Service worker (`public/sw.js`) | only hashed `/_next/static` files and the offline page | never stale (new build = new file names) | nothing to do |
| Dish images (R2, `*.skale.club`) | immutable files | forever by design | a new image is a new file name; never purge |

Any URL with a query string bypasses Cloudflare and the browser cache (`cf-cache-status: DYNAMIC`, `private, no-store`). A `?fresh=<anything>` link is therefore always the origin's current page; only the 60 s app menu cache can still apply to data.

## Steps

1. Run from the repository root (light: two HTTP calls and a git fetch):
   ```bash
   node scripts/ops/flush-cache.mjs                 # all menus + whole zone
   node scripts/ops/flush-cache.mjs --slug=aurora   # one restaurant
   ```
   It reads production secrets from Coolify with `COOLIFY_TOKEN` (.env.local) and never prints them.
2. Read the output:
   - `release ... DIFFERENT` → the deploy is not live yet. Say when it should be (check `gh run list --branch main --limit 1`). A cache flush will not help.
   - `app menu cache: dropped` / `cloudflare: zone purged` → done. `not configured` → that layer expires by itself (60 s / 2 min); mention the one-time setup below once, not every time.
3. Give the owner the `fresh links` from the output, and tell them: on the phone, reload the tab (or close and reopen the installed app) so the old JavaScript is dropped.
4. If the owner still sees the old version on a fresh link after the release is UP TO DATE, it is not a cache: look at the change itself (is it on main? is it behind a plan/capability or a per-restaurant switch?).

## One-time setup (owner's OK; production configuration)

Both are optional. Without them the skill still works: fresh links and natural expiry within 2 min.

- **MENU_REVALIDATE_SECRET.** Production app env in Coolify (app `gmaayluj11x1m6j7baogonfn`). Use a random 32+ character value, generated locally and never shown in chat. It takes effect on the next deploy or restart. It also enables `POST /api/internal/image-variants`.
- **CLOUDFLARE_API_TOKEN + CLOUDFLARE_ZONE_ID + CLOUDFLARE_PURGE_ENABLED=true.** The owner creates the token in the Cloudflare dashboard with only the *Zone → Cache Purge* permission, scoped to the xprout.app zone. They paste it into Coolify themselves; it never goes in chat. `src/lib/site/publish-effects.ts` already uses the same three variables to purge after a site publish.

Never purge the `skale.club` zone (it serves every client site and the R2 image domains) and never print a secret.
