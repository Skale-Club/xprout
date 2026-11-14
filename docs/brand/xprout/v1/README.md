# Xprout logo masters v1

Consolidated 13 November 2026. The owner approved the minimally cleaned v7 symbol and requested the logo text **Xprout**, without `.app`. The domain remains **xprout.app**.

These are lightweight, versioned source masters. The exact approved symbol path is retained without reshaping its bowls, center opening or handles. All SVGs are outlined and font-independent; the wordmark follows the selected serif reference.

The owner-designated delivery folder is `N:\My Drive\Xprout\Brand`. The old `N:\My Drive\XmartMenu` root was renamed to `Xprout` on 2026-11-13. The extracted pack, ZIP, standalone manual and vector print PDF are stored there. Future brand deliverables must be copied to this Drive folder as well as retained in the appropriate source/build locations.

- `xprout-horizontal-forest.svg` is the default light-background signature.
- `xprout-horizontal-ivory.svg` is the reverse signature.
- `xprout-stacked-forest.svg` and `xprout-stacked-ivory.svg` are the vertical signatures.
- `xprout-symbol-forest.svg` and `xprout-symbol-ivory.svg` are the standalone symbol.
- `xprout-wordmark-forest.svg` and `xprout-wordmark-ivory.svg` contain only the lettering.
- `geometry.json` and `layouts.json` retain the exact outlines and composition measurements.
- `brand-manual.md` is the editable text reference extracted from the verified ten-page PDF.

The complete ZIP, PDF manual, print PDF, PNGs, icons, support fonts/licenses, verification and reproducible scripts are generated in `output/branding/xprout/xprout-brand-pack-v1/`; the downloadable archive is `output/branding/xprout/xprout-brand-pack-v1.zip`. Output artifacts are ignored by Git. These canonical SVGs and JSON remain available in the repository.

Clear space is one quarter of the visible symbol height, already included in the SVG artboards. Minimum visible widths: horizontal 160px/35mm; stacked 96px/22mm; symbol 24px/6mm; favicon exception 16px. Colors: forest `#283F32`, ivory `#F3EFE5`. Supporting editorial type is Fraunces Semibold; body/UI support remains Inter. Neither typeface replaces the custom outlined wordmark or overrides tenant typography.

No runtime assets or production settings are changed by this handoff. See `docs/product/brand-identity.md` for platform-versus-tenant scope.

## Horizontal placement revision - 14 November 2026

The horizontal wordmark uses 0.86 of its previous scale. Alignment uses the actual initial capital X contour as the typographic body reference: source cap top 16.3140489858687 and baseline/body bottom 193.11198629815513. This excludes the p descender and any diacritics from alignment. The scaled body is 152.04622608856633 units high; wordmark top is 24.976886955716836. Its body center and the 202-unit symbol center are both y=101. The p descender extends naturally to y=219.04148580222773. Full wordmark ink is deliberately not centered. The 50-unit gap and all approved outline paths and colors are preserved. Artboard including clear space: 1064.1543518142191 by 320.0414858022277. Original layout and rejected full-ink-centered revision are retained in `history/`. Standalone and stacked compositions are unchanged.

Rebuild from the repository root with `node scripts/branding/build-xprout-brand-pack.cjs`, then `python scripts/branding/build-xprout-brand-manual.py`, `node scripts/generate-xprout-runtime-assets.mjs`, and `python scripts/branding/finalize-xprout-brand-pack.py --deliver`. The last command verifies exports and copies the approved local delivery to Drive. Pack builds use existing exact `source/geometry.json`; do not retrace the approved artwork or substitute fonts. The source scripts are also included in the delivered pack and run there without arguments.

## Palette revision 1.2 - 14 November 2026

Forest `#283F32` and ivory `#F3EFE5` remain the foundation and approved logo colors. Wine `#602021` is the main accent for sparse selection and editorial details on light surfaces. Rosewood `#57373B` is a less frequent secondary accent for secondary surfaces and hover details. `palette.json` is the editable palette and role source; `palette-swatches.svg` is a 960 by 300 editable color reference capped at 8 KiB. These supporting colors do not generate new logo variants.

Forest and wine have poor mutual contrast. Use ivory between or on these dark colors; never use wine text on forest. Verify actual state contrast. Keep decorative wine distinct from semantic error states with labels, icons and clear roles; color alone must not communicate errors. Tenant colors remain tenant-owned. All 79 logo/icon exports, exact paths, approved horizontal cap/body alignment, 0.86 wordmark scale and layout history remain unchanged in this palette revision.
