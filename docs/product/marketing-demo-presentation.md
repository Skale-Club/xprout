# Anonymous marketing demonstrations

Owner direction, 14 November 2026: internal restaurant names do not belong in the
landing's selling copy, particularly when the restaurants are demonstrations.

Use generic, descriptive choices: **Photo menu**, **Italian menu**, **Dessert
feed**. Labels, captions, descriptions, buttons and image alternatives describe
the experience. The hero uses **3D preview** and an anonymous carousel label.
Menu links are labeled **Visit the demo store**; internal route identifiers remain
implementation details. Demonstrations are not represented as customer references.

The marketing images reuse previously verified, anonymous photo-feed captures:
dishes, descriptions and prices, without restaurant names or logos. Tenant
records, menus, logos, real pages and link destinations are unchanged. Captures
are illustrative and labeled as demonstrations in the LP.

Screenshots use the ordinary image budget: WebP, maximum 1200px long edge and
100 KiB actual encoded output. Encode/check all three privately before replacing
local public derivatives. No image input, encoder or runtime budget is enlarged.
Sources/receipts: `output/anonymous-demos/2026-11-14`. A fresh browser capture was
interrupted when free memory fell below 1 GiB; existing verified captures avoid
new browser/render work. No browser validation is claimed for this final revision.
Scoped lint passed before the final image-alt wording; final source/asset checks
verify generic labels and all three actual WebP byte/dimension budgets.

This is a local review, not a production release. Delivery belongs under
`N:/My Drive/Xprout/Reviews/2026-11-14 Anonymous Demos`.

## Shared AR-style position display

The hero replaces numbered selectors with the AR panel's centered Morse-style
display. `MorsePositionIndicator` is shared by the hero and WebXrDishViewer:
80px viewport, 16px slots, 6px height, a 14px active dash and 6px neighbor dots,
distance-based opacity/scale and reduced-motion-aware transitions. AR retains
white marks and its existing shadow; marketing uses the wine accent. Previous
and next buttons remain 44px navigation targets; the indicator exposes the
current position accessibly. Direct numbered jumps are replaced by the same
display-only indicator used in AR. Hero wrapping and AR endpoint behavior stay
unchanged. Store invitations are consistent across hero, showcase and footer.

Lightweight syntax checks and six server-rendered indicator states pass. A full
typecheck/browser check was not run while the machine remained at critical RAM.
Evidence: `output/hero-morse/2026-11-14`. No media, tenant capability, camera or
native launch changes. This follow-up remains local, not deployed.
