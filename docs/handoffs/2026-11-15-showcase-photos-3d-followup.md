# Showcase photos and deferred 3D — follow-up, 2026-11-15

Continues [the original handoff](2026-11-15-demo-menus-photos-and-3d.md).
This handoff records the revised owner scope and remaining 3D work.

**CURRENT STATUS: photos published and verified on 2026-11-15. 3D is deferred to Claude.**

The guarded transactions updated 31 Bella Vista products and eight Aurora products.
All 20 new products are available; exactly eight replaced Bella Vista products are
hidden, not deleted. Bella Vista has 23 visible items and Aurora 28. Readback
confirmed all 16 Aurora AR records and other product fields, including prices and
translations, were preserved. No new model was assigned.

## Decisions and prepared work

- The owner approved 3D for Bella Vista as well as Aurora. The original question
  about whether Bella Vista should receive 3D is resolved.
- The owner excluded wine/champagne glasses and similar drinks because transparent
  vessels do not work well in 3D. The current conservative implementation scope
  excludes all eight new transparent glass/bottle drinks listed below. Do not
  restart procedural glass authoring under the old handoff.
- Publish the approved photos even when 3D is unavailable. Claude will handle the
  remaining 3D later; model availability must not delay the photo publication.
- All 20 new identity photos were saved locally. The final photo batch covers
  **39 products / 78 role images**: 19 existing Bella Vista dishes plus the 20 new
  products (12 Bella Vista, eight Aurora). Each product needs a main and a feed
  derivative. The final 78 WebP images total 6,633,966 bytes; each is at most
  1200px and 102,400 bytes. Local component review captured 195 final screenshots
  and 117 feed viewports; the corrected orange-juice portrait was recaptured.
- Food model scope is **11 dishes**: eight Bella Vista, including Affogato, and
  three Aurora. Use the final approved main image for the matching product only.
- An opaque ceramic espresso prototype script and README were authored at
  `output/demo-menus-2026-11-15/build-showcase-drinks.py` and
  `output/demo-menus-2026-11-15/README-showcase-drinks.md`. They were syntax checked,
  **not executed**. No `.blend`, GLB, USDZ or rendered model artifact is claimed.

Local working sources and logs are under
`C:/Users/Vanildo/Dev/xprout/output/demo-menus-2026-11-15/`.
`jobs.json` is the scoped 39-product working manifest. New identity sources are
under `<tenant>/identity/`; final candidates are under
`<tenant>/{main,feed}/<slug>.webp`. These paths describe local staging, not public
assets. Do not treat raw identity images as publishable derivatives.

The durable photo source of truth is
`docs/media/menu-photo-batches/2026-11-15.json`, finalized after successful guest verification
with product IDs, prompts, source roles, URLs and hashes. Resolve
each model's input by product ID to that manifest's final **main** image after it
is verified; do not use a feed portrait, another product's image, or a stale local
candidate. Private source/evidence archive destination:
`N:/My Drive/Xprout/Media/2026-11-15-showcase-photos`.

## Rodin and machine state

The last free Rodin balance check returned **29 credits**. The REST generation
request was rejected with `API_NO_ACTIVE_SUBSCRIPTION`; there was **no accepted
generation task and no paid model**. A balance response does not establish an
active API subscription. Check the provider connection and current costs before
trying again. The owner already authorized Rodin and local Blender use; do not
ask for that use permission again. Do not purchase a new subscription.

Claude already has an existing Hyper3D MCP configuration using the official
endpoint. The attempted Codex login/setup was cancelled and removed. Continue
through the existing authorized Claude integration rather than assuming a Codex
connection was successfully installed. Keep credentials out of handoff files.

Blender was not executed because available memory was initially critical. The
latest handoff reported normal mode with approximately **2.6 GB free**; that is a
point-in-time observation, not permission to skip a fresh machine check. Run one
bounded model operation at a time on this machine. Preserve unrelated sessions.

## Remaining food models

All IDs below come from this batch's `jobs.json`. These main photos were published
and hash verified; resolve the exact public URL and hash from the final manifest.

| Tenant | Product / ID | Expected local main source under the working directory |
| --- | --- | --- |
| Bella Vista | Arancini Siciliani — `09e49c8d-4fbc-44df-9edb-ce4d50518075` | `bella-vista/main/arancini-siciliani.webp` |
| Bella Vista | Vitello Tonnato — `575f1a29-aa6d-4b03-a15e-bdab523c8770` | `bella-vista/main/vitello-tonnato.webp` |
| Bella Vista | Cacio e Pepe — `250b8bb7-0c2a-4106-a189-798d1207aa2e` | `bella-vista/main/cacio-e-pepe.webp` |
| Bella Vista | Ossobuco alla Milanese — `cb3264f9-ab00-4434-abc9-cddc584a08bd` | `bella-vista/main/ossobuco-alla-milanese.webp` |
| Bella Vista | Branzino al Forno — `9d1c8667-a1f3-4047-97e3-8fed67f5616c` | `bella-vista/main/branzino-al-forno.webp` |
| Bella Vista | Cotoletta alla Milanese — `a3fcb51e-95c8-4bf9-8997-e56dba100ca9` | `bella-vista/main/cotoletta-alla-milanese.webp` |
| Bella Vista | Affogato al Caffè — `d29a20e0-e3b3-4b15-b929-56653da0da76` | `bella-vista/main/affogato-al-caffe.webp` |
| Bella Vista | Torta della Nonna — `e4bf8748-e37f-4e7f-88a1-a961da9f5be1` | `bella-vista/main/torta-della-nonna.webp` |
| Aurora | Truffle Parmesan Fries — `9b73274f-bc5b-4932-9cba-14b5a9f70511` | `aurora/main/truffle-parmesan-fries.webp` |
| Aurora | Pão de Queijo — `e94062af-1897-4150-8783-850628a0aefd` | `aurora/main/pao-de-queijo.webp` |
| Aurora | Crispy Chicken Wings — `fc29487c-526d-4f63-a5d4-8e737c251185` | `aurora/main/crispy-chicken-wings.webp` |

Follow `docs/product/augmented-reality.md` and the existing
`scripts/ar/dish.mjs prepare|publish` pipeline. Preserve separate editable food
and vessel parts, use real metre scale, and verify the physical serving size.
Affogato includes a ceramic dessert cup: keep that serving identity while
inspecting Rodin output instead of silently replacing it with a plate.

Separate ceramic prototype follow-up: Espresso,
`15855586-355e-45d4-8893-ab82ae0a3038`, source
`bella-vista/main/espresso.webp`. The unexecuted script provides a reproducible
starting point only. Its appearance and exports still require actual validation.

**Before publishing or assigning any model, open each dish in the Blender GUI
for the owner's visual approval.** A generated file, successful exporter exit,
contact sheet or agent review does not replace that physical Blender review.
Use `scripts/ar/review-scene.py` and preserve the established AR export checks.

## Excluded glass/bottle models

These products remain in the photo batch. The exclusion concerns 3D only.

| Tenant | Product | Product ID |
| --- | --- | --- |
| Bella Vista | Chianti Classico (glass) | `bc6cdfa3-df77-4b06-ac75-1d706ed7b5c6` |
| Bella Vista | Prosecco (glass) | `cecc3701-744b-467b-9c02-461e9c473ebb` |
| Bella Vista | San Pellegrino 500ml | `56795770-7aa6-404c-8dde-26d01f24dd71` |
| Aurora | Caipirinha | `49c0d90d-ddca-447e-a532-1f2016fbda45` |
| Aurora | Gin & Tonic | `2ecdbe6a-312d-4c7b-a2b3-e5c7c7c4cb50` |
| Aurora | Old Fashioned | `9ae68c54-c131-4289-ae77-a7425979ea13` |
| Aurora | Craft IPA Draft | `fb6ed817-e4ea-471d-adf2-6a85b5052230` |
| Aurora | House Red Wine (glass) | `69f612fe-7163-4912-93cc-510d0bc0eb0b` |

## Publication ownership and preservation

The photo task owns the guarded production writer, media upload, tests,
publication/rollback evidence and guest verification. Its photo-only transactions
assigned the 78 approved derivatives, enabled the 20 new products and hid exactly
the eight replaced Bella Vista dishes from the original handoff.
Do not delete those products. No Aurora products are retired.

Preserve all **16 existing Aurora AR models**, prices, currencies, product IDs,
translations, unrelated galleries/media and other tenant data. Aurora's price
scale remains an open owner decision; do not normalize it. Its empty second menu
and `teste` category remain untouched pending an owner decision.

Photo review must cover the feed at 360×640, 390×844 and 430×932, normal crops and
actual product detail, followed by public delivery/guest checks. Follow the shared
media policy and source recipe; local staging or component screenshots alone do
not establish production publication. Public verification passed across Aurora,
Bella Vista and Bella Vista Drinks & Bar: all 31 visible assigned products use
the intended portrait source and full-screen crop; eight retired products are
absent. All 39 responsive thumbnails are 256px WebP, 4,794–11,722 bytes; three real
dish sheets use the centered main image. Fresh catalog readback verifies 23
visible Bella items, 28 Aurora items and the same 16 Aurora AR records.

Sources, exact prompts and hashes are in the finalized manifest; snapshots,
guarded publication/rollback receipts and guest evidence remain under the working
directory. Journal: https://app.notion.com/p/41ab7a68612181d7bd71f50ff1da487e.
Later 3D work needs its own evidence and Journal entry.
