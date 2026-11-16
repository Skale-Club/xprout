# 3D gallery (/3d-gallery)

An internal sales tool. We open it on our own phone or tablet at a restaurant
to show what our dishes look like in 3D and on the table, at real size. It is
not a restaurant (no prices, no ordering) and it is not marketing: the page is
`noindex, nofollow`, it is not in any sitemap and nothing on the site links to it.

## What it shows

- One accordion per kind of dish (Starters & Small Plates, Burgers &
  Sandwiches, Pizza, Pasta & Risotto, Meat & Poultry, Fish & Seafood, Sushi &
  Asian, Mexican, Vegetarian, Breakfast & Brunch, Desserts). Empty categories
  are hidden. The first one starts open; "Open all" opens every one.
- Inside a category, dishes sit three across on a phone, four on a tablet and
  six on a computer, A to Z.
- A dish opens the viewer: the model turns in the page (model-viewer). On a
  phone, "See it on your table" is the menu's own AR button: WebXR on Android
  (with every gallery dish one swipe away inside the camera) and Quick Look on
  iPhone. Arrows and the keyboard step through dishes.

## The catalog

`src/lib/marketing/3d-gallery-dishes.ts` is the single list, kept as we go.
Each row has a status:

| Status | Meaning |
| --- | --- |
| `backlog` | Planned, no model yet. Not shown. |
| `published` | Reviewed by the owner in Blender and live. Shown. |

A published row carries the dish photo (optimized WebP), the GLB, the USDZ and
the model's real width in cm. The first 36 rows reuse the calibrated models and
photos of the Aurora and Bella Vista demo menus, so they cost no credits. The
Aurora Classic Mojito is left out (glass drink, first draft model).

## Adding a dish

1. Pick a `backlog` row (or add one) and check the Rodin balance (free:
   `GET https://api.hyper3d.com/api/v2/check_balance`).
2. Make the reference photo; it also becomes the card photo, so it follows
   docs/product/media-policy.md.
3. Generate with Rodin through the Hyper3D MCP: Gen-2.5-High, Raw, 80k faces,
   0.5 credit. Dishes in bowls (ramen, açaí, curries) are risky: Rodin tends to
   drop the bowl.
4. Prepare in Blender (scripts/ar/prepare-dish-model.py: real size, plate) and
   get the owner's approval in the Blender window. Hard rule.
5. Upload the GLB, USDZ and photo to R2, then turn the row into `published`
   with its URLs and width.

Gallery-only dishes have no menu product, so `scripts/ar/dish.mjs publish`
(which writes `product_ar_models`) does not fit step 5 yet; a gallery publish
mode is the next tooling step.
