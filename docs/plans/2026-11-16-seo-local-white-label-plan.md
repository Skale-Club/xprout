# SEO execution plan: discovery, local SEO, edge caching, white label (2026-11-16)

Status: **proposed**. Decision ID: XMM-D-20261116-seo-conventions. Based on the audit
"SEO audit — Xprout vs Xkedule vs X-Sites (2026-11-16)" (Notion, Projects / Xprout).
Nothing here runs in production or Cloudflare without the owner's OK at the gate marked 🔒.

## Execution status — 2026-11-16

- Phase 0 is present in the integration/release history through `0d0fefb` (the
  current task started from `dev` at `8e1b9c9`). This task did not release it.
- Phase 1 **foundation** is implemented locally on `feat/seo-site-resolution`:
  pure site resolution and indexability, explicit SEO identity reads, tenant/menu/
  website/blog metadata and canonicals, platform/tenant robots and sitemaps.
  Private menus and branches using them are excluded from discovery. Unknown,
  noncanonical and preview hosts are denied. Database outages remain failures,
  without fallback to the old production copy.
- The new `20261116200000_site_identity.sql` schema and its development counterpart
  are prepared, **not applied**. The one-time backfill marks Aurora and Bella Vista
  as demos; applying that policy still belongs to the owner's release approval.
- Phase 1 is **not complete**: root HTML language, per-brand icons/manifests/OG
  generation/analytics, dynamic HTML `X-Robots-Tag`, and runtime partner-host
  routing remain. The resolver's partner cases are tested inputs, not activated
  partner domains. Tenant blog sitemap inclusion is still pending.
- Focused tests and rollout details: [SEO site identity](../product/seo-site-identity.md).
- Later local SEO, edge cache and white-label phases remain planned. No push,
  merge, production schema application or deployment is part of this task.

## Goals

1. Every public page of every site is discoverable, canonical and fast.
2. **Strong local SEO** for every restaurant, in both modes:
   - **Platform mode:** `xprout.app/<slug>`, a subdomain or a custom domain.
   - **White-label mode:** a partner brand on its own host, with its own restaurants.
3. **The company site can itself be a tenant.** The apex of a brand host (`xprout.app`, or a partner's host) can be served by a tenant's website pages, while the global routes (`/api`, `/auth`, `/checkout`, `/pricing`…) keep working.
4. The same SEO contract as Xkedule and X-Sites (the audit's §4), implemented the Next.js way.
5. Stay lean: no new subsystem where a field or a function is enough.

## Core idea: one `resolveSite(host)`

Today, the brand (`BRAND_NAME`, `BRAND_URL`, `PLATFORM_BASE` from env) and the tenant resolution (slug path, custom domain, subdomain) are decided in different places. Both white label and company-as-tenant need **one answer per request**:

```ts
type Site = {
  origin: string              // canonical origin for this host, e.g. https://xprout.app or https://menu.partner.com
  brand: Brand                // name, logo, social image, GTM id, legal links, "powered by" on/off
  tenant: PublicTenant | null // null = brand marketing pages; set = a restaurant (or the company tenant)
  kind: 'brand' | 'tenant-path' | 'tenant-subdomain' | 'tenant-domain' | 'brand-apex-tenant'
  lang: string                // default content language → <html lang>, og:locale
  indexable: boolean          // the fail-closed gate below
}
```

Every SEO output reads it: `generateMetadata`, JSON-LD, `robots.txt`, sitemaps, `llms.txt`, the manifest, OG images, cache headers and analytics.

**Brand data, minimal.** A `brands` table with:
- id
- name
- primary_host
- extra_hosts
- logo, icon, social_image
- gtm_id
- support_email
- legal URLs
- show_powered_by
- default_lang

Tenants get a nullable `brand_id`; null means Xprout. Xprout is the seed row, and its values are today's constants. No partner UI until there is a partner: the superadmin edits the row.

**Indexability gate (fail-closed, from Xkedule).** A site is indexable only if all of these hold:
- the tenant is active
- it is published, so it is not a draft
- it is not a demo
- it is not `seo_noindex`
- the host is the site's own canonical host
- it is not a preview, staging or admin route

When not indexable, the same decision drives the robots meta, `X-Robots-Tag`, `Disallow: /` in robots.txt (with no Sitemap line), and a 404 for the sitemap.

## Phases

Estimates assume one agent and targeted tests on the Surface; full CI runs on the branch. Each phase is one branch from `dev`, merged after targeted tests, released only on the owner's word.

### Phase 0: fix live defects (`fix/seo-discovery`, ~4 h)

| # | Change | Files |
|---|---|---|
| 0.1 | Find and fix the 503 on every `/<slug>/sitemap.xml` (read the container log first, add an owned-mode unit test). On real DB failure, answer 503 + `Retry-After: 300` + `X-Robots-Tag: noindex`. | `src/app/(public)/[slug]/sitemap.xml/route.ts`, `src/lib/data/public-seo.ts`, `src/lib/data/tenant-pages.ts` |
| 0.2 | Make `/sitemap.xml` a **sitemap index**: `/sitemaps/platform.xml` (home, pricing, blog, tags, archives, posts) plus one `/<slug>/sitemap.xml` per indexable slug-only tenant. Tenant sitemaps add website pages and tenant blog posts. | `src/app/sitemap.ts` → route handler, new `src/app/sitemaps/platform.xml/route.ts` |
| 0.3 | Absolute media URLs from the site origin. Stored `xmartmenu.skale.club` and `xmartmenu-product-images.skale.club` origins are rewritten on read for og:image and twitter:image. | `src/lib/seo.ts`, tenant `generateMetadata` |
| 0.4 | Home canonical. `/blog` gets its own OG/Twitter tags. Drop the `SearchAction` from the WebSite JSON-LD. | `src/app/(marketing)/page.tsx`, `src/app/(marketing)/blog/page.tsx`, `buildWebSiteJsonLd` |
| 0.5 | `/demo` becomes a 308 (permanent). Uppercase slug paths 308 to lowercase. | `src/app/demo`, `src/middleware.ts` |
| 0.6 | `priority` (fetchpriority=high) on the first visible tenant banner/hero and the marketing hero poster only. | menu header component, marketing hero |
| 0.7 | Honest lastmod: release time for static pages, `updated_at` for content. | sitemap builders |
| 0.8 | `poweredByHeader: false`. Fix the stale "ISR-cached" comment. | `next.config.ts`, `[menuSlug]/page.tsx` |

Done when every URL in the live-check list (Phase 6) answers as expected on a CI preview build.

### Phase 1: site resolution and gate (`feat/seo-site-resolution`, ~1.5 days)

1. Build `src/lib/site/resolve-site.ts`. It is pure and unit-tested, and takes host, path and tenant lookup as input. It wraps the existing `custom-domain-routing.ts` and `tenantOwnHost`; it does not replace them.
2. Build `src/lib/site/indexability.ts`, which returns `{ indexable, reason }`.
3. Add a `brands` table with an owned schema step that seeds the Xprout row. Add `tenants.brand_id`, `tenants.is_demo` and `tenants.published_at`. Existing tenants are backfilled as published, except the demos (🔒 owner decision D2).
4. Replace hard-coded `BRAND_NAME`, `BRAND_URL` and `PLATFORM_BASE` in SEO outputs with `site.brand` / `site.origin`. This covers:
   - the title suffix and og:site_name
   - Organization JSON-LD
   - the manifest, favicon and OG image
   - robots, sitemaps and llms.txt bases
   - the GTM id
5. Set `<html lang>` and `og:locale` from `site.lang`, which is the tenant's default menu language.
6. Apply the gate to meta robots, `X-Robots-Tag`, robots.txt and the sitemaps in one place.

Done when snapshot tests cover six hosts (platform, slug tenant, subdomain tenant, custom-domain tenant, partner brand host, partner tenant) for title, canonical, robots meta, robots.txt and sitemap. Today's output must be unchanged for Xprout (no visible diff).

### Phase 2: local SEO (`feat/local-seo`, ~2 days)

The aim is that each restaurant (and each branch) has everything Google needs for a local pack and a rich listing, in both modes.

1. **Complete Restaurant JSON-LD.** Rendered on the home page and on every menu, branch and website page, with:
   - a stable `@id` (`<canonical>#restaurant`)
   - `name`, `image`, `logo`, `url`, `telephone`, `address`, `geo`
   - `openingHoursSpecification`, including special or holiday hours when present
   - `priceRange`, `servesCuisine`, `acceptsReservations` (and a reservation URL when present)
   - `hasMenu` → the menu URLs
   - `sameAs`: Google Business Profile/Maps URL, Instagram, Facebook, TripAdvisor, Yelp
   - `areaServed` for delivery when enabled

   Branches use `Restaurant` with `parentOrganization` → the main `@id`; the main entity lists its branches as `department`. **No self-served `aggregateRating`** (Google ignores and may penalize self-serving review markup for LocalBusiness). Link to the Google reviews page instead.
2. **New settings fields.** Only what JSON-LD and the page need, edited in Store settings:
   - `google_business_url`
   - `google_review_url`
   - `facebook`, `tripadvisor`, `yelp`
   - `accepts_reservations`, `reservation_url`
   - `special_hours`
   - `google_site_verification`, `bing_site_verification` (custom-domain owners verify their own Search Console)
3. **Branch landing pages** (`/<slug>/<branch>`) as real local pages. Each has:
   - an H1 with name + neighborhood/city
   - NAP in plain HTML (not only JSON-LD)
   - hours, a static map link, directions and parking text
   - the branch's menu link
   - a BreadcrumbList
   - its own title/description pattern: "`<Restaurant> – <City/Neighborhood>`: menu, hours and directions"
4. **Crawlable internal links.** The tenant header/footer links to every menu, branch and published website page with plain `<a href>` (today Aurora's HTML has no links to its other pages). The footer carries the NAP on every page.
5. **Dish pages** 🔒 (owner decision D3; recommended yes). Indexable `/<slug>/<menu>/<dish-slug>` (or `/<slug>/p/<dish-slug>`), each with:
   - title "`<Dish>` – `<Restaurant>`, `<City>`"
   - photo, description, price and diet labels
   - `MenuItem` JSON-LD
   - a link back to the menu

   `?dish=` keeps working for sharing and 308s to the dish URL. Only dishes with a photo and a description are indexable, so we don't ship thin pages. This is the strongest local long-tail lever ("picanha near me").
6. **Website page templates with local intent**: location/directions, catering, private events, FAQ (plain content). These reuse the six existing section types; there is no new builder.
7. **Launch checklist: local block.** It checks that NAP is complete, hours are set, the GBP URL is set, the Restaurant JSON-LD validates (required fields present), the sitemap is reachable and the site is indexable. Extends `src/lib/admin/launch-checklist-scan.ts`.
8. **Owner playbook (doc, no code):**
   - In Google Business Profile, set Menu link = the canonical menu URL and Order link = the order URL, with UTM `utm_source=gbp`; canonical strips the query.
   - Keep NAP identical everywhere.
   - Use Search Console per custom domain.

Done when the Rich Results Test passes for the Aurora home, a branch page and a dish page on a preview build, and the checklist shows the local block.

### Phase 3: discovery extras (`feat/seo-discovery-extras`, ~0.5 day)

1. `llms.txt` per host. On the brand host it lists the product, pricing and docs links. On a tenant host it lists name, NAP, hours, menus, branches and pages.
2. hreflang only for tenants that really publish more than one language, with path prefixes (`/pt/...`, Xkedule model), never `?lang=`. 🔒 Build only when the first multilingual tenant exists (D4).
3. IndexNow ping (Bing/Yandex) on publish of a page, menu or dish: optional, a 20-line fire-and-forget call gated by an env key.

### Phase 4: edge caching and speed (`feat/edge-cache-contract`, ~1 day + 🔒 Cloudflare)

1. **Option A** (recommended, decision D1): the middleware marks anonymous, parameter-free, cookie-free GETs of public tenant and marketing pages as `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=60`. Everything personalized stays `private, no-store`: `?table=`, `?lang=`, `?view=`, a session cookie, cart, `/me`, `/waiter`, preview. The HTML must not embed any visitor-specific data in that case; this needs a test that renders the page twice with different cookies and compares.
2. `expireTime` set to 86400 in `next.config.ts` (no more one-year stale window). `images.minimumCacheTTL` set to 31536000 (image keys are immutable).
3. 🔒 Cloudflare, xprout.app zone, after the owner's OK:
   - **"Edge cache public HTML"**: eligible, origin TTL, bypass on `/api/`, `/auth`, `/admin`-type paths, `/checkout`, the session cookie and the params above.
   - **"Edge cache media"**: `/_next/image*`, the query string in the cache key.
   - Before/after evidence with `cf-cache-status`.
   - Custom-domain zones get the same two rules (runbook).
4. Purge: on publish, `revalidateTag` keeps working for the data cache. Cloudflare purge by host only when `CLOUDFLARE_API_TOKEN` is set; otherwise the 60 s TTL is the bound (X-Sites model).
5. Later, with no date: serve fixed-width R2 variants under an immutable path to take image work off the origin.

Done when `cf-cache-status: HIT` shows on the second anonymous request to `/aurora` and `/`, `MISS`/`BYPASS` shows with a session cookie, and the launch checklist has an `edge_cache` check.

### Phase 5: white label and company site as a tenant (`feat/white-label-seo`, ~2 days, after Phase 1)

1. **Partner host.** A brand row's `primary_host` serves that brand's marketing pages. With `brand-apex-tenant`, the apex is served by one tenant's website pages instead. Its restaurants live at `<host>/<slug>`, `<label>.<host>` or their own domains, all resolved by `resolveSite`.
2. **Company site as a tenant**, for Xprout itself and any partner:
   - The brand row gets `apex_tenant_id`. When set, `/` and unknown first-level paths on the brand host render that tenant's pages.
   - Global routes keep priority (`GLOBAL_PREFIXES`); `/pricing` and `/blog` stay platform routes unless the tenant has a page with that slug and the brand opts in.
   - The tenant's `business_type` decides the JSON-LD type: `Organization` + `SoftwareApplication` for a software company, `ProfessionalService` or `LocalBusiness` for a local agency, `Restaurant` for a restaurant. So the company site gets the same local SEO pipeline as Phase 2.
   - Migration is page by page; the current coded marketing pages remain the fallback.
3. **No Xprout leakage on partner hosts:**
   - titles, og:site_name, JSON-LD publisher
   - manifest, icons, OG images, llms.txt
   - emails, the sign-in popup branding
   - "Powered by" (`show_powered_by`; when shown on Xprout tenants it is a plain branded link)
   - GTM/analytics per brand
4. **Per-brand discovery.** Each brand host has its own robots and sitemap index (its marketing pages plus its slug tenants) and its own Search Console property.
5. **Tests.** The six-host snapshot suite from Phase 1, plus a "no `Xprout` string in partner output" assertion.

Done when a seeded test brand on a `.test` host renders the partner marketing, a partner tenant and an apex tenant with correct canonical, robots, sitemap and JSON-LD, and with no Xprout strings.

### Phase 6: verification tooling and sibling alignment (~0.5 day here, separate sessions there)

1. `scripts/seo/live-check.mjs` (small, no dependencies). For a list of URLs it checks status, Cache-Control, cf-cache-status, canonical, robots meta, X-Robots-Tag, JSON-LD types, sitemap reachability and the og:image host. It runs after each release and from CI against the preview.
2. Shared convention doc: `agents/SEO-CONVENTIONS.md` in `skaleclub-apps` (the audit's §4, one page), linked from each repo's AGENTS.md. 🔒 This is a change to the owner's universal-rules repository.
3. Follow-up sessions:
   - **Xkedule:** HTML cache contract, Organization/WebSite JSON-LD.
   - **X-Sites:** staging sitemap origin leak, Organization/WebSite JSON-LD, Consent Mode v2, a 301 instead of 302 for permanent client redirects.

## Owner decisions needed

| ID | Decision | Recommendation |
|---|---|---|
| D1 | Edge-cache tenant HTML: Option A (anonymous public header via middleware) or B (move `lang`/`view`/`table` to the client) | **A**: smaller change, the same contract as X-Sites |
| D2 | Demo tenants (Aurora, Bella Vista) indexable? Their address and phone are fictional (Boston, 555). | **noindex** the demos. Fictional NAP in LocalBusiness markup hurts trust. They stay reachable for people and sales. Celes (a real prospect) is indexable only once published. |
| D3 | Indexable dish pages | **Yes**, only for dishes with a photo and a description |
| D4 | hreflang now or with the first multilingual tenant | **Later**: set `lang` correctly now |
| D5 | Cloudflare rules on xprout.app (Phase 4.3) | Approve after Phase 4.1/4.2 are live |
| D6 | Order of white label (Phase 5) vs local SEO (Phase 2) | **Phase 0 → 1 → 2 → 4 → 5**: white label needs Phase 1, and sells better with Phase 2 done |

## Order and timing

0 (~4 h) → 1 (~1.5 d) → 2 (~2 d) → 3 (~0.5 d) → 4 (~1 d + Cloudflare) → 5 (~2 d) → 6 (~0.5 d). That is about 8 working days of agent time.

Releases: after 0, after 1+2, after 4, after 5. Heavy checks (full build, e2e, Lighthouse) run in CI or on the desktop, not on the Surface.

## Not doing (lean)

- No self-served review stars.
- No FAQ rich-result markup for restaurants (Google limits FAQ results to authoritative sites).
- No AMP.
- No separate CMS.
- No partner self-service UI before a real partner.
- No per-language subdomains.
