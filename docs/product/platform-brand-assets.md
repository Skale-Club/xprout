# Platform brand assets

Runtime edition `v1` publishes the owner-approved Xprout v7 symbol and outlined
wordmark from `docs/brand/xprout/v1`. No paths, letters, proportions, or fonts are
redrawn. `node scripts/generate-xprout-runtime-assets.mjs` reproduces the assets
with the installed Sharp dependency, using only versioned canonical SVGs,
geometry and layouts. It does not depend on ignored `output/` source files.

The script checks the canonical SVG paths against versioned geometry and the
approved symbol path SHA-256 before rendering. Horizontal and symbol signatures
retain the exact SVG content with LF line endings, independent of the checkout
platform. Raster placements match the approved brand-pack build:
ivory symbol on forest square, symbol width 328 of 512 for app icons, 288 for
maskable icons. The maskable symbol's bounding rectangle fits inside the central
40%-radius safe circle (conservative corner-radius test); no symbol points move.
Apple touch icon uses the same approved tile at 180px.

## Published profiles

| Consumer | Format and dimensions | Actual encoded maximum | Reason |
| --- | --- | --- | --- |
| Header/auth signatures | SVG, original canonical viewBox | 40 KiB | Exact outlined vector paths, resolution-independent |
| App/PWA icon | PNG 192 or 512 square | 40 KiB | PWA consumers require PNG; approved tile and alpha semantics |
| Maskable icon | PNG 192 or 512 square | 40 KiB | Approved safe-zone tile for OS masks |
| Apple touch icon | PNG 180 square | 40 KiB | Native platform metadata format |
| Favicons | PNG 16/32; ICO with 16/32/48 PNG entries | PNG 40 KiB; ICO 16 KiB | Browser compatibility |
| General social card | WebP 1200×630 | 100 KiB | Optimized approved horizontal artwork |
| Static Open Graph response | PNG 1200×630 | 180 KiB | Metadata consumers and Next static image route support; format-specific exception to icon dimensions, within wide-image byte budget |

These are explicit format profiles under the application media policy. Every
encoded output is checked before writing; SVG/PNG assets stay within their
consumer-specific budget. Sharp concurrency is one; the local build processes
only bounded checked-in vectors, with no guest-triggered conversion or remote
fetch. Runtime paths are versioned under `/brand/xprout/v1/` and are static,
cacheable assets. Deploying a new edition should use a new versioned directory.

## Compatibility paths

The generator also updates `public/icon.png`, `public/icons/{icon-192.png,
icon-512.png,icon-maskable-192.png,icon-maskable-512.png,apple-touch-icon.png}`,
`src/app/icon.png` and `src/app/apple-icon.png`. Older cached manifest and icon
references therefore resolve to the approved forest/ivory tile after deployment.
The versioned ICO is available for explicit metadata; no legacy source favicon
existed to overwrite.

The horizontal signature is the monogram (2026-11-16): the v7 symbol replaces the
capital X, scaled from the removed X's cap top to baseline, followed by the unchanged
p, r, o, u, t outlines. Its viewBox is `0 0 901.8794539094855 314.0554789427838`;
preserve this aspect ratio. The lettering body (symbol top to baseline) spans
y = 44.199 to 220.997, so its center sits 24.429 units (7.7787% of the height) above
the artwork box center because of the p descender. SVG image sizing must not stretch
it into a square tile.
The marketing header shows it at 176px total width (126px below 768px), with a 44px
link target, and shifts it down by `translateY(7.7787%)` so the lettering body, not
the descender, is centered in the bar (owner request 2026-11-16, 10% smaller than the
previous 195px/140px). These sizes sit slightly under the manual's 160px visible
minimum; this display role does not resize the vector masters.

Internal panels (2026-11-17) use `src/components/branding/PanelPlatformBrand.tsx`:

| Placement | Where | Artwork | Size |
| --- | --- | --- | --- |
| `header` | Super admin sidebar (dark rail, desktop and phone drawer) | Ivory signature | 177px box = 160px visible, left clear space pulled back to align with the text |
| `bar` | Super admin phone top bar (white) | Forest signature | 126px, lettering body centred like the marketing header |
| `credit` | Restaurant panel sidebar footer, "Powered by" | Ivory signature | 126px |

A restaurant's panel leads with the restaurant's name: no platform mark above it in the
sidebar and none in its phone bar (`DashboardShell` shows one only with `platformBrandInBar`,
set by the super admin layout). A configured white-label name or icon keeps that icon and
name in every placement instead of the signature.

## Verification

`output/branding/runtime-v1/verification.json` records actual bytes, decoded
dimensions, MIME expectations, SHA-256 for every artifact and symbol-path hash
preservation. This edition measured app PNGs at most 13,491 bytes, favicon ICO
2,390 bytes, social WebP 16,162 bytes and social PNG 28,581 bytes. App 512,
maskable 512, favicon ICO and social WebP were also compared byte-for-byte with
the approved pack and matched. Signature paths and lettering are direct canonical
copies; only Windows CRLF endings are normalized to the repository's LF bytes.

Platform components and metadata use the versioned assets; custom platform logos stay explicit. The default horizontal signature renders only for the Xprout name and default icon. Restaurant colors, tenant logos and menu typography stay unchanged.

The operator `scripts/ops/update-xprout-platform-brand.mjs` is read-only by default. It records a public configuration backup and tenant palette digest. After deploy, `--apply --expected-release <full SHA>` verifies the published icon bytes, production container/release/database identity, singleton and original favicon under the existing advisory lock, then changes only `favicon_url` and its timestamp. Read-back proves the palette digest is unchanged. `--rollback --expected-release <full SHA>` restores the backed-up reference. Receipts are ignored operational evidence, never secrets.

A browser refresh fetches the new HTML and versioned assets. An existing installed PWA may refresh its OS icon on its platform schedule. The Journal records actual deployment and visual validation; generated files alone are not deployment proof.

Horizontal alignment uses the initial capital X cap-to-baseline body bounds, excluding the p descender and any diacritics. Both the symbol and typographic body centers are y=101; the descender extends below naturally.
