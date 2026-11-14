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
white marks and its existing shadow; the hero also uses white over the photo. Previous
and next buttons remain 44px navigation targets; the indicator exposes the
current position accessibly. Direct numbered jumps are replaced by the same
display-only indicator used in AR. Hero wrapping and AR endpoint behavior stay
unchanged. Store visits are offered in the dedicated demo section; navigation
and footer lead to that section.

Lightweight syntax checks and six server-rendered indicator states pass. A full
typecheck/browser check was not run while the machine remained at critical RAM.
Evidence: `output/hero-morse/2026-11-14`. No media, tenant capability, camera or
native launch changes. This follow-up remains local, not deployed.

## Title over the photographed table

Owner feedback places the dish name over the photo, like the AR name strip.
The hero groups its centered Inter dish name and previous/next arrows in a
nonblocking overlay at the top of the photo. White text and shadows match the
AR treatment. The overlay ignores pointer input except
on the 44px arrow controls, preserving model dragging. The card ends at the
photograph: the extra category label and demo-store footer have been removed.
The photo/model sizing, native launch, wheel/idle behavior and links are unchanged.

Follow-up validation closes the earlier memory-related browser gap: TypeScript
and scoped ESLint pass; thirteen focused tests pass. Browser checks at
320/390/768/1440px verify all three titles inside the photo, centered Morse marks,
44px arrow targets, forward/backward wrapping, demo link, no page errors or
horizontal overflow. All three anonymous showcase images load and their
surrounding visible/alternative copy has no internal restaurant names. Captures
were reviewed at 320/390/1440px. Physical native camera placement was not retested.
Evidence: `output/hero-title-overlay/2026-11-14`.

## Controls at the base

Owner refinement places Morse marks and the single camera/3D entry on the same
bottom row inside the photo: marks on the left, action on the right, with 12px
edge insets and a shared vertical center. The top title strip remains on the
photo. Marks use the AR-style white/shadow treatment. The compact row prevents
indicator/button overlap, including camera wording at 320px. Removed the duplicate inline Explore button: the always-visible entry
already enables inline 3D on desktop and native camera viewing on supported
phones. Autoplay refusal/reduced-motion visitors retain this explicit entry.
Notices appear above the button; Retry is separated above it on failure.

Browser checks at 320/390/768/1440px confirm the 12px bottom/right placement,
indicators aligned with the button inside the image, one entry, navigation/position updates, real inline
activation, no page errors and no overflow. Emulated Android retains camera
wording, bottom-right placement and no overlap at 320/390px. Nine focused tests and scoped ESLint pass.
Reviewed 320/390/1440px captures. Evidence: `output/hero-controls-base/2026-11-14`.

## Dedicated demo-store section

The owner removed the meaningless “3D preview / Main” label and store invitation
from the hero. Its frame now contains only the photographed scene, dish name,
navigation, position marks and camera/3D entry. Unused category data and footer
styles are removed. The photo/model behavior and dimensions are unchanged.

The existing anonymous demonstration block is the dedicated **Demo store**
section, with `#demo-store`, heading **Visit the demo store.**, an explanation
of the guest experience and the three existing illustrative styles/links. The
navigation, footer and secondary hero action lead to this section; external
store visits originate inside it. `#experience` remains as an inner anchor for
existing links. No redundant second demo block or customer claims are added.

Four browser widths (320/390/768/1440px) verify no hero footer/link/category label,
a working section anchor, the old anchor, three demo destinations/new-tab
behavior, no page errors and no overflow. Scoped ESLint and four existing
marketing content/layout tests pass. Reviewed mobile hero and desktop section
captures; no new public media assets or settings writes. Evidence:
`output/demo-store-section/2026-11-14`. Local review only; no deployment.

## Top readability gradient

Owner feedback adds a dark-to-transparent lens behind the hero's title/arrows.
A pointer-transparent scene pseudo-element sits above the photo/model at z1,
below the title at z2 and bottom controls at z3. Black alpha fades from 0.8 to
approximately 0.667 at 48%, then to zero. Its height is capped at 140px and 65%
of the scene, leaving the lower image clear. Scene clipping preserves its corners.
No public media, geometry or camera behavior changes.

Browser checks at 320/390/1440px verify the rendered gradient stops, bounds,
pointer-events:none, title stacking, working arrow selection, no page errors
and no overflow; the burger capture was visually reviewed. Diff check passes.
No new unit test for this reversible CSS detail. This is not a blanket contrast
certification across photographic content. Evidence:
`output/hero-title-gradient/2026-11-14`. Local only.
