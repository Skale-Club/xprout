# SEO delivery conventions

This is Xprout's implementation contract for canonical identity, discovery,
local entities and optional publication notifications. It can be reused by
Xkedule and X-Sites; those repositories have not been changed or certified by
this delivery.

## Identity and indexing

Resolve the current host, brand, tenant and original request path once. All
metadata, robots, discovery files and cache decisions consume that authority.
Tenant indexing requires an active published non-demo tenant, a canonical
production host and public content. Explicit noindex, previews, private menus
and administrative paths deny indexing. A database outage is an honest
retryable failure, never a successful fallback to another tenant or database.

Canonical entities use `#restaurant`; branch `parentOrganization` refers to
that entity. Business details come from merchant data. Do not fabricate
opening hours, address, parking, ratings, reviews or service areas. FAQ page
content is ordinary content, with no FAQ rich-result promise.

## Discovery

The platform sitemap is an index. Tenant maps contain public menus, locations,
published website pages, eligible dish pages and entitled blog posts/tags/date
archives. Owned PostgreSQL is authoritative. Blog posts require published
status and a publication date no later than now, plus an active/trial blog
entitlement. Private and unavailable products never enter dish discovery.

Tenant maps are capped at 5,000 URLs. Extra catalog reads cap products at 4,000,
blog posts at 1,000 and menus at 1,000. Large catalogs need sitemap partitioning
before raising these limits. Named default menus are valid parents for dish
URLs even when the menu homepage is canonically shown at the tenant root.

`llms.txt` describes the current canonical site's identity and public pages.
Restaurant addresses, phone numbers and hours are factual. Brand sites link
to the existing product/pricing/blog routes. Noindex sites return 404; tenant
hosts never inherit another brand's promotional text. Text responses vary by
Host and use a short cache lifetime.

## Optional post-commit effects

All effects are off by default. They require `NODE_ENV=production`; preview
identities are denied even if credentials are present. No external calls are
made in development. A successful database mutation schedules work with
Next.js `after`, after the transaction has committed. A rollback schedules
nothing. Failures do not undo content, retry transactions, expose credentials
or remove the normal 60-second menu cache fallback.

IndexNow requires `INDEXNOW_ENABLED=true` and a valid `INDEXNOW_KEY`. The key
proof is served at `/indexnow-key.txt` on an indexable canonical host. The
official POST request includes `host`, `key`, `keyLocation` and a bounded URL
list. This is a notification, not a guarantee of crawling or indexing.
[IndexNow's official protocol](https://www.indexnow.org/documentation)
documents the verification-file and POST requirements.

Cloudflare purge requires `CLOUDFLARE_PURGE_ENABLED=true`,
`CLOUDFLARE_API_TOKEN` with cache-purge permission and `CLOUDFLARE_ZONE_ID`.
The app purges explicit public URLs for the current site, never the entire
zone. Notification batches include home/discovery files, explicitly changed
pages and a bounded current catalog sample. Renamed/deleted historical dish
URLs outside the supplied batch expire normally; a durable historical-URL
outbox is not introduced. Provider errors are logged without response bodies
or secret values. [Cloudflare's purge API](https://developers.cloudflare.com/api/resources/cache/methods/purge/)
defines the per-URL purge request.

Committed owned page/menu/product and native blog mutations register hooks.
Other write entry points must call `scheduleTenantPublish` only after their
successful commit. Cache invalidation and notifications must never run inside
a retried transaction. Enabling external effects or changing production
configuration still follows the owner's production approval rule.

## Live verification

Run the dependency-free verifier from a machine allowed to run Node:

```sh
node scripts/seo/live-check.mjs --origin https://xprout.app --tenant aurora --expect-demos-noindex --json seo-live-check.json
node scripts/seo/live-check.mjs --origin https://preview.example.com --canonical-origin https://xprout.app --tenant example --json preview-seo.json
```

It checks HTTP status, canonical metadata, robots policy, JSON-LD, document
language, OG identity/image URLs, sitemap leaves and shared-cache bypass for
cookie/query/RSC requests. Requests and body sizes are bounded. It exits with
failure when a check fails and can write a JSON artifact for CI. It does not
modify content, follow arbitrary sitemap hosts or authenticate as a customer.
Visual verification and browser guest-flow checks remain necessary on an
adequately resourced machine.

## Sibling adoption

Xkedule and X-Sites should map this contract onto their own routing and data
models: one request identity, consistent noindex authority, factual local
entities, bounded per-site discovery, safe public-cache eligibility, after-
commit notifications and a runnable live verifier. Adoption needs repository-
specific tests and a separate release; a shared document is not proof that
those products already comply.
