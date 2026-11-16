# SEO site identity

Status: full SEO implementation on `feat/seo-site-resolution`; release evidence is
tracked in [the completion checkpoint](../plans/2026-11-16-seo-completion.md).
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
is seeded with its current identity. Later local-SEO and apex migrations add the
optional factual settings and brand company-site assignment; no partner or apex
tenant is assigned automatically.

The first application backfills existing publication dates, marking the known
Aurora and Bella Vista demos unpublished/demo. Existing active restaurant creation
remains published by default, preserving onboarding; an explicit NULL publication
date creates a draft. A rerun never republishes a subsequently unpublished site.
Runtime can read brands but cannot edit them. Browser roles have no RLS policy.

Before the schema exists, old tenants retain their existing publication semantics
(created date and existing `seo_noindex`). After the schema exists, a NULL
`published_at` is authoritative. An assigned unavailable brand is an error, never
a silent Xprout fallback. Neither schema file was applied by this task.

## Request context and cache

Middleware strips caller-supplied context and resolves public identity using a
bounded loopback-only endpoint. The context contains no session or credential.
Root HTML is explicitly dynamic so language, brand and robots headers cannot
cross host boundaries. Eligible anonymous HTML receives the short shared-cache
policy; cookies, authorization, parameters, RSC/prefetch, private and account
routes remain private/no-store. Context lookups have a bounded 1,000-entry cache,
60-second success TTL and short failure TTL. Configuration changes expire within
the documented context/data/edge freshness windows; they are not instant across
all processes. See [the cache runbook](cloudflare-cache.md).

Partner marketing and optional company CMS pages use their assigned canonical
origin, entities, icons, manifest, social image, analytics, login display and
public attribution. Global identity/payment/API routes retain priority. Default
platform marketing remains the fallback when its optional CMS home is absent;
a partner uses a factual generic home. Missing explicit content remains 404.

Tenant blog, menu, branch, dish and website discovery shares publication/privacy
gates and plan entitlements. Empty platform blogs are excluded from discovery.
Local fields and dish pages are documented in [local discovery](local-seo.md),
and optional production-only effects in [the delivery contract](seo-conventions.md).

## Validation and limits

Focused tests cover identity, private content, publication, metadata, discovery,
local settings, safe cache, partner attribution, company fallback and media
budgets. They run serially on the Surface with a bounded Node heap. Full build,
TypeScript, PostgreSQL 17 migration/idempotence, API/browser screenshots and the
live preview verifier run in GitHub Actions. The completion checkpoint records
actual CI and production results; authoring a test does not prove it passed.

Schema execution and public/CDN behavior must be verified after the reviewed
release. Custom-domain Search Console verification, real Rich Results Test
results and eventual search indexing remain distinct from local markup checks.
Hreflang awaits a real multilingual tenant; sibling adoption uses separate
sessions. Existing media-policy gaps and historical dish slug redirects are not
certified by this implementation.
