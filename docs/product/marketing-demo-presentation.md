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
white marks and its existing shadow; the hero now also uses white over its photo. Previous
and next buttons remain 44px navigation targets; the indicator exposes the
current position accessibly. Direct numbered jumps are replaced by the same
display-only indicator used in AR. Hero wrapping and AR endpoint behavior stay
unchanged. Store invitations are consistent across hero, showcase and footer.

Lightweight syntax checks and six server-rendered indicator states pass. A full
typecheck/browser check was not run while the machine remained at critical RAM.
Evidence: `output/hero-morse/2026-11-14`. No media, tenant capability, camera or
native launch changes. This follow-up remains local, not deployed.

## Title over the photographed table

Owner feedback places the dish name over the photo, like the AR name strip.
The hero now groups its centered Inter dish name, previous/next arrows and Morse
indicator in a nonblocking overlay below the camera/3D entry. White marks and
text shadows match the AR treatment. The overlay ignores pointer input except
on the 44px arrow controls, preserving model dragging. The footer retains the
category and demo-store link; it no longer repeats the dish name or indicators.
The photo/model sizing, native launch, wheel/idle behavior and links are unchanged.

Follow-up validation closes the earlier memory-related browser gap: TypeScript
and scoped ESLint pass; thirteen focused tests pass. Browser checks at
320/390/768/1440px verify all three titles inside the photo, centered Morse marks,
44px arrow targets, forward/backward wrapping, demo link, no page errors or
horizontal overflow. All three anonymous showcase images load and their
surrounding visible/alternative copy has no internal restaurant names. Captures
were reviewed at 320/390/1440px. Physical native camera placement was not retested.
Evidence: `output/hero-title-overlay/2026-11-14`.
