# Marketing and public-menu release

The owner authorized consolidation and production publication with “zere o git
aqui” on 16 November 2026. The checkout was clean, without stashes, extra
worktrees or open PRs. Remote main and dev already included the marketing,
legal-page, dish-page, phone-formatting and signature changes through 6afe0de.
The previous healthy production image was b059f417.

## Integration corrections

- `20ad7e7`: the staging isolation test always changes the preview token. The
  old final-character replacement could leave a token ending in x unchanged
  (1/64 probability), causing a false failure. All 64 base64url suffixes were
  checked locally; the real PostgreSQL suite subsequently passed 362 tests.
- `6b79c67`: public dish card links retain the complete canonical base URL.
  Keeping only its pathname could send a modified click from a platform alias
  to the wrong host. Canonical custom-host, platform-path and trailing-slash
  cases were checked locally; the existing browser assertion remains intact.
- `f22440b`: a concurrent owner-authored correction updates the branch phone
  browser assertion for the intentional national phone format.
- `81f2053`: reuse the three existing hero poster nodes for sequential opacity
  transitions instead of inserting a duplicate outgoing image. Prioritize the
  initial poster and leave the other posters lazy and low priority. The failed
  home audit had a 12.7–13.0s LCP, including about nine seconds of render delay;
  a duplicate Picanha image request appeared within 43ms of the first run's LCP.
  The report did not serialize an exact LCP DOM selector. A browser regression
  check detects newly inserted poster images during a dish switch. The 88-point
  threshold, autoplay, capability detection and native AR behavior are retained.
  See [Google's carousel guidance](https://web.dev/articles/carousel-best-practices).
- `5ea798b`: keep the hero entrance at its final geometry with a nonzero opacity
  fade, replacing translation/scaling. The next report identified the Burger
  poster as the late LCP node (11.6–11.8s); removing duplicates alone did not
  resolve the performance gate. An autoplay frame must not become a larger
  paint simply because the entrance transform has finished.
- `59b5d5c`: remove two newly introduced Aurora redirects to an absent
  `main-menu` slug. Live verification showed the published cards correctly
  linked to the existing `cardapio-principal` menu, but the new configuration
  redirected these links to 404. Restore routing without rewriting live data.

The owner explicitly chose the remote phone correction over the duplicate
local test (`42c8e90`, integration `46b6819`); its temporary branch was removed.
No branch or stash work remains outside dev.

The changes introduce no production schema migration, data rewrite, credential
or billing change. No webhook implementation changed.

## Verification

Verified production runtime: `6441adefbff67c4cf698ed10ea592358cde081f0`.
Production CI: https://github.com/Skale-Club/xprout/actions/runs/44016691387.

Unit tests: 2,110 passed, six skipped; lint, route guards, legacy suites and
Xphere contracts passed. PostgreSQL identity/public repository: 362 passed.
Schema, cutover, offsite backup and database-copy rehearsals passed.
All 130 browser flows and 36 preview SEO checks passed. Home Lighthouse median
is 97, with LCP about 1.93s (three scores: 92, 97, 97; LCP 2.11s, 1.93s, 1.93s).
The other pages have median 96 and 97. The minimum remains 88, without audit or
user-agent branches or benchmark-specific feature gates. Local checks passed:
64 token suffixes, three canonical URL cases, 19 automatic-3D/native-AR tests
(5.28s), config syntax and committed diff checks.

The CI/deploy run succeeded. Readiness returned the exact runtime SHA and a
healthy database. Eight public routes returned 200: /, /pricing, /privacy,
/terms, /aurora, /bella-vista, /3d-gallery and /sitemap.xml. Aurora's existing
/aurora/cardapio-principal menu and the Italian Bruschetta dish URL now return
200 directly. The bounded live SEO verifier passed 54/54 checks; evidence is
[2026-11-16-site-polish-seo.json](2026-11-16-site-polish-seo.json). It verifies
identity, demo noindex, discovery and shared-cache bypass; no new CDN HIT claim
is made by this release.

Production probes before and after rollout rejected unsigned and forged Stripe requests
with 400, and Telegram and CRM queue requests with 401. Source review confirmed
raw-body SDK signature checks for Stripe/QStash and Telegram secret checks
before business parsing. Real signed provider events were not replayed in this
task; no live payment or publishing event was initiated.

## Timing and machine

Work started at approximately 22:16 America/New_York on 16 November. The initial
estimate was ten minutes; successive CI failures and a concurrent edit required
revalidation. The first complete Lighthouse run took 7m37s and rejected the home
page. The poster correction required another full CI; estimate revised to 23:05.
After the remaining late Burger paint was identified, estimate revised to 23:20.
Runtime 34a75c4: CI 12 minutes to completed E2E; Lighthouse 7m31s; image build
3m03s, Coolify deployment 45s, complete deployment job 4m11s. Eight public pages
returned 200 and readiness confirmed the exact SHA. The additional dish-link
check found the incorrect new redirects; estimate revised to 23:40 for the fix.
Final runtime 6441ade: image build 2m49s, Coolify deployment 44s, complete deploy
job 4m00s. Runtime verification finished at 23:39, about 82 minutes after the
22:16 start (initial estimate: ten minutes; revised final estimate: 23:40).
Documentation closure follows with [skip ci]; it does not change runtime code.

The Surface had only 0.3 GB free RAM. Full checks, production builds and browser
automation ran on GitHub runners. Codex handled integration and verification;
one gpt-6-luna read-only agent triaged the failing assertions.
