# SEO release evidence checklist

Core release acceptance is complete on runtime
`5ad1e9466916e788d3eb9699611cfa55638ac007`. Evidence is recorded in
`output/seo/2026-11-16/release-final.json` and the
[completion checkpoint](../plans/2026-11-16-seo-completion.md).
Checked items describe observed results, not test authoring or assumed behavior.

## CI and isolated fixtures

- [x] [Dev CI 43958112288](https://github.com/Skale-Club/xprout/actions/runs/43958112288) and [main CI/deploy 43960325122](https://github.com/Skale-Club/xprout/actions/runs/43960325122) passed.
- [x] Unit tests: 2,110 passed/6 environment-dependent skips. Browser/API: 129 passed/0 failed/0 skipped. Preview verifier: 36/0.
- [x] Owned PostgreSQL fixtures apply identity20/localSEO21/apex22 twice, preserve drafts, validate constraints/grants and seed no partner assignment.
- [x] Public/private menu, pricing, identity, metadata, discovery, cache and canonical non-rewrite root Flight regression tests passed.
- [x] Synthetic SEO fixtures use local Supabase with `assertLocalSupabase`; no production credentials or external DNS.
- [x] Actual home/branch/dish SSR, partner PNG byte/dimension evidence and 375/1440px menu/branch/dish screenshots were retained/reviewed. Read-only menus gained no cart actions.
- [x] Dev mobile Lighthouse medians: home/self/menu 97/97/97.

Independent fixtures include public/private menus, branch NAP/hours/geo, demo,
partner tenant and company apex. Assertions inspect real canonical/language and
JSON-LD, crawlable links, private exclusion, partner identity and spoofed-context
rejection rather than framework chunk snapshots. Audit tests scope their tenant
through the actual UI filter so unrelated recent fixtures cannot hide its rows.

## Production release and schema

- [x] Owner-authorized reviewed release deployed; concurrent galleries `822de33` and `9977ac4` were preserved.
- [x] Public readiness verified final runtime at 21:43:52 UTC November 16.
- [x] Main pipeline 21:27:46→21:43:11 UTC (15m25s); deploy job 21:39:38→21:43:11 (3m33s).
- [x] Healthy rollback image `9977ac4cbbb9f92897051d6f0bd9d44fff7af728` preserves 67 dishes.
- [x] Schema plan [43949009317](https://github.com/Skale-Club/xprout/actions/runs/43949009317) showed exactly 3 pending/0 changed; compatible code preceded optional fields.
- [x] Apply [43952028079](https://github.com/Skale-Club/xprout/actions/runs/43952028079) completed 20→21→22 at 20:39:37 UTC after a 361,166-byte schema-only backup.
- [x] Backup SHA-256: `d77bd99fbbbdda7fab234b7788a8d932f781b102a6c4e2c491d5cca90f539738`.
- [x] Replan [43952110264](https://github.com/Skale-Club/xprout/actions/runs/43952110264): 16 files/0 pending/0 changed/ready true. Applied hashes match Git LF blobs; Windows CRLF differences are line endings. No later SQL changes.

## Origin, edge and media

- [x] Final origin verifier: 61 passed/0 failed.
- [x] Canonical-root Flight privacy defect fixed using documented `skipProxyUrlNormalize=true`; signals reach middleware before rendering.
- [x] Three reviewed dashboard rules compiled/read back, enabled in order and verified active at 21:48 UTC; exact scope/rules/rollback in the [cache runbook](cloudflare-cache.md).
- [x] Final edge verifier: 65 passed/0 failed. Anonymous HTML HIT at root, Celes, Aurora and Bella Vista.
- [x] Two cookies, authorization, table/lang/view queries and all Flight variants are DYNAMIC plus private/no-store; no cross-visitor markers leaked.
- [x] Media verifier: 4/0; separate 256px WebP/PNG and 640px WebP variants MISS→HIT with correct MIME/width, plus immutable JS MISS→HIT.
- [x] Eight negative public webhook probes returned 400/401. This proves rejection only; genuine provider delivery is not established.

The API token remains DNS-only/403 for rulesets; dashboard activation is not an
API version claim. The final receipt records three active rules and successful
traffic acceptance, with the earlier expression review named separately.

## Google and closure

- [x] Actual CI code-input tests: [home 4 valid](https://search.google.com/test/rich-results/result?id=nRqz3oGshB4ZQQTzDGZVGA), [branch 3 valid/0 critical](https://search.google.com/test/rich-results/result?id=bQf5aOBctH9TOCRnwa2piA), [dish 1 valid Breadcrumb](https://search.google.com/test/rich-results/result?id=FyNG-PjiVa6b0GrBdMV9Tg).
- [x] [Final live Celes](https://search.google.com/test/rich-results/result?id=j1Tz_XQXr8c8ScWQS4mCFw), crawled Nov16 16:44:40 EST: 2 valid items/0 critical errors on the final runtime.
- [x] Celes graph SHA-256 unchanged: `e97435b464487493b3dda9212bafa0d480ee2be04ad7e944a4965f0462fc9dad`.
- [x] Sitemap resubmission accepted Nov16; indexed root Request indexing accepted into the priority queue.
- [x] [XMM-151](https://app.notion.com/p/41ab7a686121815e8753c42f20e9f60f) marked Done and read back with final evidence and limits.

Google last-read/discovery counters remain Nov14/prior 6 URLs; successful
submission does not mean instant recrawl or rankings. MenuItem is semantic
markup, not Google Product/review enhancement eligibility. Optional fields
remain factual; no fabricated ratings, ownership or merchant facts.

IndexNow and publish-effect purge stay off/unconfigured. Hreflang depends on a
real multilingual tenant. Partner DNS/email remains onboarding work; no real
partner was activated. Existing media-policy gaps and historical dish-slug
redirects are not resolved here. Stripe's pre-existing absent secret stays
fail-closed; genuine provider delivery remains a separate readiness check.
Shared conventions `c96f258` and their SKA Journal record are separately complete;
sibling applications require their own tests and releases.
