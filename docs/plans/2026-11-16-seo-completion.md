# SEO completion checkpoint

Owner instruction: finish the SEO execution plan end to end (2026-11-16).
Authorization covers implementation, CI and the reviewed SEO release. No unrelated
production data, customer information, billing or credentials may change.

Working branch: `feat/seo-site-resolution`, starting from local `a690a45`.
Surface: critical memory; one delegate at a time, focused serial tests only;
full application/schema/browser checks run in GitHub Actions.

- [x] Phase 0: discovery defects (released before this continuation).
- [x] Phase 1a: shared identity/indexability and tenant metadata/discovery.
- [ ] Phase 1b: request site context, HTML language/header, brand outputs.
- [ ] Phase 2: local fields, schema, structured data, branch/dish pages, navigation/checklist.
- [ ] Phase 3: tenant/blog discovery, llms.txt, optional IndexNow; multilingual paths only when activated by a real multilingual site.
- [ ] Phase 4: anonymous cache contract, bounded TTL/purge and reviewed Cloudflare rules.
- [ ] Phase 5: partner routing/branding and optional brand apex tenant pages.
- [ ] Phase 6: live verifier, shared contract and rollout evidence.
- [ ] Full CI and disposable PostgreSQL migration/idempotence checks.
- [ ] Release, owned schema apply, public smoke/cache/indexing evidence, Journal readback.

Delegation: gpt-6.1-sol owns local SEO builder/settings/API/schema/checklist work;
the session model owns integration, routing/cache/security/release and final checks.
Sibling repository implementations remain separate sessions as specified by the plan.
