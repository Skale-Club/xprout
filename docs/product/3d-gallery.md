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

1. Pick a `backlog` row (or add one, plus its sizes in
   `scripts/ar/dishes/gallery.json`) and check the Rodin balance (free:
   `GET https://api.hyper3d.com/api/v2/check_balance`).
2. Put the square source photo at `$AR_MODELS_DIR/gallery/photos/<id>.png` and
   run `npx tsx scripts/ar/gallery-photo.ts <id>`: it writes the optimized WebP
   (media policy photo profile) used as the Rodin reference and the card photo.
3. Generate with Rodin through the Hyper3D MCP from that WebP: Gen-2.5-High,
   Raw, 80k faces, 0.5 credit. Save the result as `gallery/raw/<id>.glb`.
   Rodin drops the plate or bowl even when asked to keep it, so the plate is
   drawn in step 4 (cream, dark for pizzas). Bowl dishes still need a vessel.
4. `node --env-file=.env.local scripts/ar/dish.mjs prepare gallery <id>`
   (real size, drawn plate, food grade), then the owner approves it in the
   Blender window. Hard rule.
5. `node --env-file=.env.local scripts/ar/dish.mjs publish gallery <id>`:
   uploads the GLB, USDZ and photo to R2 under `gallery/` and turns the row
   into `published` with its URLs and width. No database row is written.
