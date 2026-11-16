# SEO site identity

Status: `5ad1e9466916e788d3eb9699611cfa55638ac007` is healthy in production,
schemas 20–22 are applied and origin/edge/media acceptance passed. Release evidence is
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
a silent Xprout fallback. Schemas 20→21→22 were applied at 20:39:37 UTC on
November 16, after a schema-only backup. Replan `43952110264` reports
16 files, 0 pending, 0 changed and ready true; hashes match Git LF blobs.

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

Branch MenuPage contact cards, header hours and factual NAP use an immutable
clone containing the branch's own stored contact fields/hours. Missing branch
facts stay absent instead of inheriting a different location. Branding, prices
and capabilities remain unchanged. Branch weekday/map/menu labels use the
effective language. Parent Restaurant relationships use `@id`-only references
to the complete parent entity. Google's code-input test accepted the corrected
branch graph with 3 valid items and zero critical errors. Final live Celes
validation reports 2 valid items/0 critical errors at 16:44:40 EST November 16;
the graph hash is unchanged after the Flight correction.

Tenant blog, menu, branch, dish and website discovery shares publication/privacy
gates and plan entitlements. Empty platform blogs are excluded from discovery.
Local fields and dish pages are documented in [local discovery](local-seo.md),
and optional production-only effects in [the delivery contract](seo-conventions.md).

## Validation and limits

Focused tests cover identity, private content, publication, metadata, discovery,
local settings, safe cache, partner attribution, company fallback and media
budgets. Heavy validation runs on CI, not the critical-memory Surface. Full build,
TypeScript, PostgreSQL 17 migration/idempotence, API/browser screenshots and the
live preview verifier run in GitHub Actions. The completion checkpoint records
actual CI and production results; authoring a test does not prove it passed.

Full dev CI `43958112288` and main CI/deploy `43960325122` passed on the final
runtime: 2,110 unit passes/6 environment skips, 129 browser passes/0 failures/0
skips, preview 36/0 and mobile Lighthouse medians 97/97/97. Both concurrent
gallery updates were preserved; healthy rollback `9977ac4` retains 67 dishes.
An earlier canonical-root RSC public-header defect was fixed with documented
`skipProxyUrlNormalize=true`, preserving Flight signals before middleware, and
canonical non-rewrite root regression coverage. Final origin61/0, edge65/0 and
media4/0 establish HTML HIT, private/cookie/auth/query/Flight bypass and sampled
image MIME/width variants plus immutable JS caching. Three Cloudflare rules are
active, dashboard-verified at 21:48 UTC; API ruleset access remains 403 and no API
version is claimed. IndexNow/purge flags remain off; partner DNS/email remains
future. Full evidence and exact timings are in the completion checkpoint. Google
code-input results are separately recorded: home 4 valid items, branch 3 valid
items with zero critical errors, dish 1 valid Breadcrumb item. No Product rich
result eligibility is inferred from MenuItem markup.

Schema execution and core origin/CDN/media acceptance are verified. Eight
unsigned/forged webhook probes returned 400/401; genuine provider delivery is
not established, and Stripe's pre-existing missing secret remains fail-closed.
Final Journal closure/readback is recorded in XMM-151. Custom-domain
Search Console verification, real Rich Results Test
results and eventual search indexing remain distinct from local markup checks.
Hreflang awaits a real multilingual tenant; sibling adoption uses separate
sessions. Existing media-policy gaps and historical dish slug redirects are not
certified by this implementation.
