# Local discovery and dish pages

Public branch URLs keep their existing menu behavior and add a factual landing
section: restaurant/branch/city heading, the branch's stored address and phone,
opening hours, a directions link and a menu anchor. Missing parking or travel
details are never invented. Private menus retain their server access gate.

Dish pages live at `/<tenant>/<menu>/<dish-name>-<id-suffix>` on a platform host,
or `/<menu>/<dish-name>-<id-suffix>` on the tenant's canonical host. A normalized
name and twelve hexadecimal ID characters provide deterministic paths without
new columns. Unknown, ambiguous, unavailable, private and incomplete dishes
return 404. Eligibility requires an available product with a photo, a nonempty
description different from its name, and a valid price. Short factual
descriptions remain eligible. Renaming a dish changes its URL; no historical
slug registry is introduced.

Pages show the same menu price multiplier, size-dependent minimum/from price,
currency formatter, tenant colors and labels as the menu. They contain
MenuItem/BreadcrumbList JSON-LD and link back to the real menu. They introduce
no cart action, preserving read-only restaurant capabilities. They never
return private products, even when a guest has an authenticated private-menu
session.

Eligible `?dish=<product UUID>` links on menu pages redirect permanently to the
canonical dish URL. Preview/feed-preview and table-service requests keep their
menu context; redirects require the site to be indexable. Private and incomplete
dishes stay in the existing menu flow.

Menu footers contain normal crawlable anchors to public active menus, public
branches, published navigation pages and up to 100 eligible dishes from the
current menu. The existing published-page navigation preference remains
authoritative. Queries for menus/branches are tenant-scoped and limited to 100
rows each. Navigation failures omit optional links without breaking a cached
guest menu. The sitemap is responsible for complete catalog discovery.

`localPageTemplate` provides location, catering, private-event and FAQ section
templates using the existing section contract. Services and answers come from
merchant-provided facts. FAQ sections are ordinary page content, with no FAQ
rich-result markup. Templates are reusable helpers; the editor must explicitly
select and save them before they become public.

Validation: run `tests/unit/local-discovery.test.ts` with the focused metadata,
public-menu, tenant-page and pricing tests. Visual browser checks and production
rollout require a machine with sufficient resources and the existing release
authorization.
