# Handoff: photos and 3D for the new demo dishes (2026-11-15)

Owner goal: Aurora and Bella Vista are the two public showcases, and they must not share dishes. Bella Vista becomes an authentic Italian trattoria. Aurora stays a contemporary kitchen & bar with a Brazilian touch and gains a real bar section. The menu data is already in production. Your job is the photos, the 3D models, and then turning the new dishes on.

## Current state in production (owned PostgreSQL, verified 2026-11-15)

- 20 new products were created with `is_available=false`, so the public menu does not show them yet. They have no `image_url`, `image_urls`, `feed_image_url`, `product_media` or `product_ar_models` rows.
- **They are hidden only because they have no photos yet. They are meant to go live.** The rule "never generate 3D for a hidden dish" ([memory: AR only visible dishes]) does not apply to the list below. The owner approved these dishes on 2026-11-15.
- Live changes already applied: Bella Vista "Eggplant Parmigiana" renamed to "Parmigiana di Melanzane" (same dish, same photo). Aurora has a new category "Bar Bites" (pt: "Petiscos de Bar", main menu, position 4), and "Ham & Cheese Sandwich with Crisps" moved into it with its 3D model intact.
- Currency is USD for both tenants.

### Bella Vista (tenant `0e62fa0c-b4c6-460c-bf29-f2d1f93fa2db`, English only, no 3D today)

| Product id | Name | Category (menu) | Replaces, once live |
|---|---|---|---|
| 09e49c8d-4fbc-44df-9edb-ce4d50518075 | Arancini Siciliani | Antipasti (main-menu) | Bruschetta al Pomodoro |
| 575f1a29-aa6d-4b03-a15e-bdab523c8770 | Vitello Tonnato | Antipasti | Beef Carpaccio |
| 250b8bb7-0c2a-4106-a189-798d1207aa2e | Cacio e Pepe | Pasta | (new, replaces nothing) |
| cb3264f9-ab00-4434-abc9-cddc584a08bd | Ossobuco alla Milanese | Main Courses | Filetto al Madeira |
| 9d1c8667-a1f3-4047-97e3-8fed67f5616c | Branzino al Forno | Main Courses | Grilled Salmon |
| a3fcb51e-95c8-4bf9-8997-e56dba100ca9 | Cotoletta alla Milanese | Main Courses | Chicken Milanese |
| d29a20e0-e3b3-4b15-b929-56653da0da76 | Affogato al Caffè | Desserts | Tiramisu |
| e4bf8748-e37f-4e7f-88a1-a961da9f5be1 | Torta della Nonna | Desserts | Molten Chocolate Cake |
| bc6cdfa3-df77-4b06-ac75-1d706ed7b5c6 | Chianti Classico (glass) | Drinks (drinks-bar menu) | Fresh Orange Juice |
| cecc3701-744b-467b-9c02-461e9c473ebb | Prosecco (glass) | Drinks (drinks-bar) | (new) |
| 15855586-355e-45d4-8893-ab82ae0a3038 | Espresso | Drinks (drinks-bar) | (new) |
| 56795770-7aa6-404c-8dde-26d01f24dd71 | San Pellegrino 500ml | Drinks (drinks-bar) | (new) |

Each replacement got the `position` and `is_featured` of the dish it replaces, so the order stays the same after the swap. Names and descriptions are already written; read them from the database.

### Aurora (tenant `b5f74b1e-4d7f-4d17-8ea0-c3a1a42ae808`, en + pt translations, 16 dishes with 3D)

| Product id | Name | Category |
|---|---|---|
| 9b73274f-bc5b-4932-9cba-14b5a9f70511 | Truffle Parmesan Fries | Bar Bites |
| e94062af-1897-4150-8783-850628a0aefd | Pão de Queijo | Bar Bites |
| fc29487c-526d-4f63-a5d4-8e737c251185 | Crispy Chicken Wings | Bar Bites |
| 49c0d90d-ddca-447e-a532-1f2016fbda45 | Caipirinha | Drinks |
| 2ecdbe6a-312d-4c7b-a2b3-e5c7c7c4cb50 | Gin & Tonic | Drinks |
| 9ae68c54-c131-4289-ae77-a7425979ea13 | Old Fashioned | Drinks |
| fb6ed817-e4ea-471d-adf2-6a85b5052230 | Craft IPA Draft | Drinks |
| 69f612fe-7163-4912-93cc-510d0bc0eb0b | House Red Wine (glass) | Drinks |

Nothing in Aurora is removed. Aurora prices are still at the old scale (Picanha 89.90 USD). The new items match that scale. The owner has not yet decided whether to bring all Aurora prices down to US levels, so don't change prices.

## 1. Photos

Follow `docs/product/menu-photo-recipe.md` (recipe `feed-v2-main-v1`) and `docs/product/menu-image-framing.md`. The Notion Journal entry XMM-81 (2026-11-13, "Apply repeatable feed and main photos across all three restaurants") records how the last batch was made: the built-in image_gen tool, exact prompts, a shared encoder and a guarded publish. The versioned manifest with every prompt, URL and hash is `docs/media/menu-photo-batches/2026-11-13.json`.

Each product needs two images:

- **Main:** 1:1 square, serving centered, at most 70% wide and 58% tall. Goes to `image_url` and the primary `product_media` row (and `image_urls`).
- **Feed:** 9:20 portrait, continuous scene. Serving inside x=4–96%, y=22–56%, bottom 40% plain tabletop. Profile `plate` for food, `tall` for every glass or bottle. Goes to `feed_image_url`.

**The gap you have to solve first:** the recipe edits an existing original photo of the same dish (the "identity source"). These 20 dishes have no photo at all. Generate one clean identity photo per dish first, in the tenant's shared style. Then build main and feed from that identity photo, each from the clean source, never chained. Record the identity prompt in the new batch manifest.

Shared tenant styles (from the recipe):

- **Aurora:** evening bar, charcoal stone tabletop, warm side light, copper details, petroleum-teal linen, softly blurred bar. Style reference: https://xmartmenu-product-images.skale.club/b5f74b1e-4d7f-4d17-8ea0-c3a1a42ae808/menu-images/2026-11-13-feed-v2/classic-mojito-main-683020767628ee67.webp
- **Bella Vista:** its existing Italian trattoria setting and tabletop, warm natural light, restrained Italian styling. Style reference: https://xmartmenu-product-images.skale.club/0e62fa0c-b4c6-460c-bf29-f2d1f93fa2db/menu-images/2026-11-13-feed-v2/bruschetta-al-pomodoro-main-e73a50491fab83c6.webp
- **Never:** text, labels, logos, signs, printed menus, wine-bottle labels with readable text, or food borrowed from another dish.

Delivery limits: WebP, longest edge at most 1200px, at most 100 KiB (102,400 bytes). Use `src/lib/media/optimize-image.ts` (photo profile). Upload to R2 under `<tenantId>/menu-images/<date>-feed-v2/<slug>-main|feed-<hash>.webp` with immutable hashed keys. Use the `STORAGE_S3_*` keys from `.env.local`. Check every public URL's SHA-256 before assigning it. Add the batch to a new `docs/media/menu-photo-batches/<date>.json`.

Review each dish at 360×640, 390×844 and 430×932 (feed) plus the normal crops. Show the owner the contact sheet before publishing.

## 2. 3D models (AR)

Pipeline: `docs/product/augmented-reality.md` ("Generating models (Rodin + Blender)") and `scripts/ar/dish.mjs prepare|publish <tenant> <dish>`. Per-dish sizes live in `scripts/ar/dishes/<tenant>.json` (starter 23 cm, main 30 cm, dessert 21 cm, drinks by height). Working files go under `AR_MODELS_DIR` (the owner's Drive).

- **Hard rule:** every dish opens in the Blender GUI for the owner's approval before publishing (`scripts/ar/review-scene.py` builds one side-by-side scene).
- Food: Rodin Gen-2.5-High from the new main photo, prompt "only the food, no plate/bowl/props", plate added in Blender. Check the balance first (`/check_balance` is free; `RODIN_API_KEY` is in `.env.local`) and tell the owner the credit cost before generating. The last batch cost 0.5 credit per dish.
- Drinks in glass: Rodin fails on glass, so build them from scratch in Blender with `scripts/ar/build-drink.py` and `drink-glass.py`. Note: the Mojito rebuild (2026-11-12) was not yet realistic enough and is still unpublished.
- Scope: Aurora's 8 new items. Bella Vista has no 3D at all today. Ask the owner whether it should get 3D before you make any.

## 3. Go live (one guarded transaction per tenant)

Run SQL inside the app container: `ssh root@188.245.112.3`, then `docker exec -i <app container> node -` with `ADMIN_MENUS_DATABASE_URL`. Take the advisory lock `pg_advisory_xact_lock(hashtextextended('xmartmenu-admin-menus:<tenantId>',0))`.

1. Set the image fields and the primary `product_media` row for each new product.
2. Set `is_available=true` on the 20 new products.
3. Bella Vista only: set `is_available=false` on the 8 dishes listed in "Replaces". Hide them, don't delete them; the owner can decide later.

Then verify on https://xprout.app/aurora and https://xprout.app/bella-vista (the public cache is about 60 s). Localhost reads the legacy Supabase data and proves nothing. Finally, record a Journal entry (prefix XMM) and update the hub's Current State.

## Open owner questions

- Aurora prices: move to US levels? (Not decided.)
- 3D for Bella Vista? (Not decided.)
- Aurora has an empty second menu "Carta de Bebidas" (pt, purpose bar) holding only a category named "teste". Delete it, or move the bar drinks into it? Not touched.
