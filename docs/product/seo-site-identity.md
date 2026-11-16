# SEO site identity

Status: Phase 1 foundation, local implementation on `feat/seo-site-resolution`.
This is part of [the SEO execution plan](../plans/2026-11-16-seo-local-white-label-plan.md).

## Identity and indexing

`src/lib/site/resolve-site.ts` is a pure resolver over validated request authority,
path, tenant identity and brand identity. It wraps the existing custom-domain
routing and canonical precedence: verified domain, configured subdomain, then
brand origin plus the tenant slug. It returns the canonical origin/base/URL,
language, brand, site kind, and the indexability decision with a stable reason.
Hosts never become canonical merely because a request supplied them.

`indexability.ts` denies inactive, unpublished, demo, opted-out, private and preview
sites, brand mismatches, protected routes and noncanonical hosts. Publication must
be a valid date that is not in the future. Global back-office names such as
`/menu` remain usable for a public restaurant menu at `/<slug>/menu`.

`runtime.ts` loads only public identity fields. The owned database uses the existing
bounded, read-only shared transaction pool. Owned failures never query Supabase.
Identity is deduplicated within a React request; the current Host is resolved
outside that identity cache. Legacy development reads distinguish an absent schema
from a database outage and do not require the owned-only subdomain column.

Tenant layout, home, menus/branches, website pages and blog metadata use the gate.
Private menu metadata denies indexing even when the visitor is authenticated.
Canonical URLs in tenant JSON-LD use the same resolved identity. Platform and
tenant robots/sitemaps reject noncanonical hosts; unknown tenants return 404,
temporary discovery failures return 503 with retry instructions. A denied tenant
robots file has no Sitemap line. Discovery responses that vary by authority use
`Vary: Host`. Sitemap privacy uses the renderer's menu/branch selection helpers.

## Prepared schema

`docs/owned-schema/20261116200000_site_identity.sql` and its Supabase counterpart
add `brands` plus `tenants.brand_id`, `is_demo` and `published_at`. The Xprout brand
is seeded with its current identity. No new partner route or UI is activated.

The first application backfills existing publication dates, marking the known
Aurora and Bella Vista demos unpublished/demo. Existing active restaurant creation
remains published by default, preserving onboarding; an explicit NULL publication
date creates a draft. A rerun never republishes a subsequently unpublished site.
Runtime can read brands but cannot edit them. Browser roles have no RLS policy.

Before the schema exists, old tenants retain their existing publication semantics
(created date and existing `seo_noindex`). After the schema exists, a NULL
`published_at` is authoritative. An assigned unavailable brand is an error, never
a silent Xprout fallback. Neither schema file was applied by this task.

## Validation and limits

Focused Vitest covers six resolver modes, malicious/alias/preview hosts, lifecycle
flags, private menus and branches, metadata, robots and sitemaps, owned/legacy
boundaries and schema-before-code compatibility. Tests run serially with one worker
and bounded Node heap on the Surface. Scoped ESLint and `git diff --check` also run.
Final validation: 197 tests passed across 11 focused files in 9.4 seconds, using
one worker and a 256 MiB parent heap. Scoped ESLint finished with zero errors
(19 pre-existing warnings across older menu/test code); the final changed-core
lint run had no warnings. `git diff --check` passed. Estimated delivery was 12:25
(about 45 minutes); implementation and local verification finished around 12:02
(about 28 minutes), followed by Journal recording.

The schema operator's offline tests passed (five); six database tests, including
the new identity migration test, require the disposable PostgreSQL CI fixture and
were skipped locally. The new database test applies the migration twice, verifies
demo/publication backfill, preserves a later unpublish, checks the existing
onboarding default, runtime privileges and the brand foreign key.

Full TypeScript/build, browser, PostgreSQL and full-suite validation must run in CI
or on the desktop. No server/build/browser was started on the critical-memory
Surface. This task does not prove a deployed SHA or indexing in Search Console.

## Remaining Phase 1 work

- Set root HTML `lang` without accidentally making all marketing pages dynamic.
- Add the corresponding dynamic HTML `X-Robots-Tag` contract.
- Migrate brand-wide icons, manifests, OG generation and analytics to site identity.
- Activate partner-host routing only with the later white-label integration.
- Add tenant blog posts to sitemaps with plan and native/legacy publication gates.
- Validate the prepared schema and full application in CI before release; apply
  schema/backfill and verify public responses only with release authorization.

Local SEO enhancements, dish pages, edge caching and company-as-tenant rendering
remain separate later phases. Nothing here changes Cloudflare or production data.
