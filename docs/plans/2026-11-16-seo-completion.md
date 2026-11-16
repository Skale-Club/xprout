# SEO completion checkpoint

Owner instruction: finish the SEO execution plan end to end (2026-11-16).
Authorization covers implementation, CI and the reviewed SEO release. No unrelated
production data, customer information, billing or credentials may change.

Working branch: `feat/seo-site-resolution`, starting from local `a690a45`.
Surface: critical memory; one delegate at a time, focused serial tests only;
full application/schema/browser checks run in GitHub Actions.

- [x] Phase 0: discovery defects (released before this continuation).
- [x] Phase 1a: shared identity/indexability and tenant metadata/discovery.
- [x] Phase 1b implementation: request context, HTML language/header and brand outputs.
- [x] Phase 2 implementation: local fields/schema, entities, branch/dish pages, factual footers, navigation and launch checks.
- [x] Phase 3 implementation: tenant/blog discovery, host-scoped feeds, llms.txt and optional IndexNow; real multilingual paths remain conditional.
- [ ] Phase 4: anonymous cache contract, bounded TTL/purge and reviewed Cloudflare rules.
- [x] Phase 5 implementation: partner routing/branding, optional brand apex and page-by-page fallback.
- [x] Phase 6 tooling/shared contract: strict live verifier and skaleclub-apps c96f258; production evidence remains below.
- [ ] Full CI and disposable PostgreSQL migration/idempotence checks.
- [ ] Release, owned schema apply, public smoke/cache/indexing evidence, Journal readback.

Delegation: gpt-6.1-sol owns local SEO builder/settings/API/schema/checklist work;
the session model owns integration, routing/cache/security/release and final checks.
Sibling repository implementations remain separate sessions as specified by the plan.

## Release evidence in progress

All source checks, TypeScript/production build and disposable PostgreSQL 17 jobs
passed in CI a5bfa53 and ab683e8. The earlier run included 2,078 passing unit tests
(six environment-dependent skips) and 115 passing browser/API tests; synthetic
fixture failures were corrected. Do not treat those runs as a green full CI.

The Cloudflare dashboard showed zero existing Cache Rules. With the owner's
authenticated browser, three reviewed rules were saved disabled in order:
HTML `4086f4a40e894f59bcc37da9e8a6167f`, image
`135c9aeb7f55404bb871294a13d47ff8`, final bypass
`5be78f128a2544049639eb582ce71fe7`. The image rule respects raw Vary values.
Activation awaits the verified application release. The local DNS token has no
ruleset permission; future CLI adoption refuses duplicate dashboard rules.

The pre-release live verifier recorded 30 pass/6 fail: demo indexing/maps and
cookie/query/RSC cache policy still reflect the old release. Eight unsigned/
forged production webhook probes returned 400/401. Stripe's webhook signing
secret is absent in the existing production environment (fail-closed); no
credentials or billing configuration were changed. Genuine provider event
delivery remains a separate readiness check, not established by negative probes.

Search Console currently reports the root sitemap Success, submitted November 13
and last read November 14. This is prior-release evidence, not proof of new
indexing. Final code deploy, schema plan/apply, cache HIT/bypass, image variants,
Google inspection and Journal readback remain required.
