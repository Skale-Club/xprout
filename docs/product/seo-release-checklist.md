# SEO release evidence checklist

This checklist records the evidence required before releasing site resolution,
local SEO, dish discovery, white-label identity and public HTML caching. An
unchecked item is outstanding work, not an implied pass. Tests in this change
were authored on the memory-constrained Surface; authoring them does not prove
they have run.

## CI and isolated fixtures

- [ ] Focused unit tests pass, including site identity/request context,
  `site-middleware`, metadata, local SEO/discovery, discovery extras and existing
  public menu/private-menu/pricing tests.
- [ ] The owned schema PostgreSQL 17 job applies identity 20, local SEO 21 and
  brand apex 22 twice. A deliberately unpublished restaurant remains a draft;
  no partner/apex assignment is seeded automatically.
- [ ] Schema fixtures verify URL/token/JSON shape and size checks, brand apex
  foreign keys/business kinds and runtime column grants. Full special-date,
  clock-time and duplicate-date validation is enforced by the API parser;
  the database's special-hours constraint validates array shape/count.
- [ ] `tests/e2e/api/seo-site.spec.ts` passes against the local Supabase and app
  only. `assertLocalSupabase` must remain enabled; never substitute production
  connection details to make this suite run.
- [ ] Existing custom-domain, public-menu cache and private-menu API tests still
  pass, with any deliberate preview-host fixture changes reviewed.

Commands for a sufficiently resourced development computer or CI runner:

```sh
npm test -- --run tests/unit/site-middleware.test.ts tests/unit/site-request-context.test.ts tests/unit/site-metadata.test.ts tests/unit/local-seo.test.ts tests/unit/local-discovery.test.ts tests/unit/seo-discovery-extras.test.ts
python3 -B scripts/ops/test_xprout_owned_schema.py
npm run test:e2e -- --project=api tests/e2e/api/seo-site.spec.ts
node --check scripts/seo/live-check.mjs
```

The Python PostgreSQL cases require `XM_TEST_PG_CONTAINER` pointing to the
disposable CI container. Without it only the offline operator cases run; that
is not a substitute for schema execution evidence.

## What the API fixture proves

The fixture creates an isolated public restaurant, private menu, unpublished
demo and independent partner brand, then removes its rows. Requests still go
to the local app base URL: a synthetic `*.example.org` Host header exercises
tenant authority without external DNS. It checks raw SSR canonical/language,
Restaurant and MenuItem markup, real dish URLs, private content exclusion,
demo sitemap exclusion, partner metadata/robots/sitemap/manifest identity,
spoofed context rejection and the public/proxied internal-endpoint boundary.

Two different cookie markers plus table/language/view query parameters and
RSC requests must be private/no-store. Marker values must not appear in HTML
or RSC bodies. Anonymous HTML without a session refresh may carry the short
shared cache policy. Framework chunk IDs and complete serialized HTML are
intentionally not snapshot assertions.

## Preview and production evidence

- [ ] Run the live verifier against the CI preview with the expected canonical
  production origin and retain its JSON report.
- [ ] Review branch and dish pages on mobile/desktop: typography, from-price
  semantics, tenant colors, readable labels and links back to the menu.
- [ ] Confirm read-only menus gained no cart actions and private products are
  absent from raw HTML, RSC, metadata, JSON-LD, maps and discovery text.
- [ ] Exercise the platform, slug tenant, custom domain, subdomain, partner
  brand, partner tenant and company-as-tenant apex with correct host authority.
- [ ] Verify customer login, order/payment/auth callbacks and legal routes
  retain their global paths on tenant and partner hosts.
- [ ] Confirm cookie/authorization/query/RSC responses bypass the configured
  Cloudflare cache, with two visitors receiving isolated responses.

## Release gates

- [ ] Owner authorizes the production release, schema application and any
  production DNS/Cloudflare configuration separately where required.
- [ ] Owned schema workflow plan shows only expected pending immutable files;
  retain the workflow's schema-only backup and rollback evidence.
- [ ] Code is deployed before optional schema fields are applied; legacy reads
  and old SEO saves remain available during that interval.
- [ ] Apply schema 20→21→22 using the existing owned operator after green CI;
  confirm sentinels and repeat plan show no unexpected changes.
- [ ] Run the production live verifier, record actual statuses and inspect
  Search Console/Rich Results Test results without claiming indexing is instant.
- [ ] Leave IndexNow/Cloudflare publish-effect flags off unless the owner
  explicitly authorizes activation. Prove key-host ownership and scoped cache
  credentials before enabling them; development must never send notifications.
- [ ] Write and read back one English Journal entry with commits, CI/preview/
  production evidence, actual remaining gaps and release timing.

Sibling repositories need their own tests and release records before adopting
the shared conventions. This checklist does not certify Xkedule or X-Sites.
