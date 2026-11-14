# Premium marketing review — Xprout

Date: 2026-11-14. Status: implemented locally for owner review, not published.
Direction chosen by the owner: ivory and forest with contrasting dark sections.

## Findings and changes

| Finding | Result in the local version |
| --- | --- |
| Black backgrounds and glass cards made most sections look alike | Ivory editorial ground, deep forest product/service sections, restrained panels and dividers |
| The approved identity did not extend to the typography | Licensed, self-hosted Fraunces 600 for display type; Inter for body, controls and prices; SVG logo untouched |
| The landing described the product without showing much of it | Owned food imagery, real mobile menu captures and a working three-restaurant selector with live menu/feed destinations |
| Pricing presented setup and subscription costs as a long dense page | Two-step introduction, three setup choices, three readable plan summaries and an expandable complete comparison |
| Controls and spacing differed between pages | One MarketingFrame, nav/footer and scoped token system shared by root and grouped routes |
| Feature cards became too narrow on phones | Single-column mobile sections and verified layouts from 320 to 1440 px |
| Saved CTA copy was resolved but not actually rendered | Saved labels now render; development labels explicitly aligned with the paid-project offer |
| A background video was stored in the old hero configuration | Explicit development migration to an ivory color background; original media references retained |
| Navigation loaded an animation library for an entrance effect | Visible initial content and CSS transitions; unnecessary eager animation wrappers removed |

## Product and commercial accuracy

The monetary source remains src/lib/marketing/pricing.ts, unchanged by this work.
Project prices, monthly/yearly prices, add-ons, volume tiers, limits, first month,
payment split, minimum period, launch offer, NFC note and Stripe fee distinction
remain. No billing tables, checkout logic, Stripe configuration or production
data changed. The estimator retains its original calculation and state handlers.

The showcase identifies its screenshots as captured guest-menu previews; it does
not pretend the image is a live embedded application. Its restaurant selection
and links work. 3D copy points guests to selected dishes in the live menu; there
is no invented direct-to-dish URL, automatic 3D generation or fake activation.

Configured name, logo, hero copy/media, steps/icons, features/icons, closing CTA
and footer remain supported. Pricing now receives the same configured identity.
Customer-menu typography and palette ownership remain outside the marketing scope.

## Reference and next resource ideas

[Menu3D](https://menu3d.net/) and [its pricing page](https://menu3d.net/pricing)
were useful references for visible demonstrations, product grouping and plan
comparison. No competitor imagery, code, testimonials or customer counts were
copied. The result uses Xprout's identity and owned product captures.

| Resource idea | Current result / next step |
| --- | --- |
| Browsable examples | Implemented selector, real captures and links to three existing menus/feed views |
| Clear project estimate | Existing calculator redesigned; monthly/yearly plan comparison remains functional |
| Theme playground | Future: isolated color/layout experimentation before saving a menu |
| Photo before/after | Future: a comparison using approved paired originals and processed images, with truthful provenance |
| On-demand 3D product demo | Future: lazy verified model/poster assets, native phone behavior and real-device tests; current links open the real menu |
| Reservations, voice AI and universal POS integration | Not advertised as shipped capabilities; require separate product decisions and implementation |

## Evidence

- 19 focused tests passed, including saved-content/theme/identity contracts and pricing logic.
- TypeScript passed; scoped ESLint has no errors or warnings.
- Eight page/viewport states passed at 320/390/768/1440 px: images load, fonts apply,
  one root document, no horizontal overflow or browser page errors.
- Browser interactions passed: mobile navigation/Escape/focus return, example
  selection, FAQ, original sign-in modal, yearly/monthly values, comparison,
  default estimate $1,119 / $3,088, DIY photos/payment fee and the 3D count clamp.
- Local Aurora returns 200, retains Inter and has no marketing scope.
- Four automated WCAG 2 A/AA checks detected no violations. Incomplete contrast
  and table/icon findings remain manual-review limits, not a certification.
- Approved font derivative 25,956 B, three 390×844 screenshots of 27,978–49,446 B; actual
  bytes, dimensions, hashes, licenses and capture provenance are recorded.
- No production build/Lighthouse or production deployment ran in this task.

Screenshots and verification: output/premium-marketing/2026-11-14. Owner delivery
belongs under N:/My Drive/Xprout/Reviews/2026-11-14 Premium Marketing.

## Release boundary

Preview: http://127.0.0.1:3255/ and /pricing, running through the guarded
development launcher. Production remains release 5336b99.

The four explicit configuration edits are documented in
docs/product/marketing-design-v2.md. A read-only production plan confirms the
old values and preserves all other fields. Publication must include that merge,
normal CI/performance checks and production visual verification after approval.

## Follow-up: stronger color and motion

The owner found the first preview too static. A second local pass adds supporting
sage/olive tones, a curved hero backplate, a feature ribbon, distinct setup-card
surfaces, changing demo backgrounds, layered shadows and richer forest gradients.
The exact logo, configured content and commercial calculations remain intact.

Native CSS animations handle the hero/QR label, example swaps, subtle hover depth,
section fades, a sliding monthly/yearly selector and exact amount changes. A small
shared client controller gates this progressive enhancement, reveals focused
content and persists Pause/Resume. System reduced motion, data saving and missing
JavaScript preserve a fully visible static presentation. The live announcement
container for example copy stays mounted while its animated child changes.

Verification for this pass:

- Nineteen focused unit tests passed; TypeScript and scoped ESLint passed.
- Eight responsive states and all ten existing browser behavior checks passed.
- Normal-motion browser checks passed: section reveal, actual example transition,
  exact annual values, pause stopping animations, cross-page preference, system
  reduced motion, data saving and no-JavaScript content visibility.
- A temporary local fixture verified configured video playback, Pause/Resume,
  offscreen pause and no video-source request under reduced motion. The fixture
  route was removed after verification and is not part of the application.
- Four axe WCAG 2 A/AA states report no detected violations after correcting the
  preview caption contrast; incomplete gradient/table/icon checks remain limits.
- No new image/font assets or animation dependencies enter the application.
- A silent 13.42-second review recording is H.264 / 1200×900 / 24 fps / 830,332 B;
  its 5 MiB / 30 s cap and optimized poster are checked before review delivery.

Evidence: `output/premium-motion/2026-11-14`, including JSON results, optimized
captures, recording and poster. Delivery: `N:/My Drive/Xprout/Reviews/2026-11-14
Premium Motion`. This follow-up remains on the local feature branch. Production
continues on 5336b99; no production data write, push or deployment occurred.

## Follow-up: forest header and a shorter hero

The owner approved the premium direction and requested a green header plus less
vertical hero space. Both pages now use the forest header with the existing
approved ivory signature, light navigation/CTA and visible focus. Landing uses
smaller responsive headings, tighter spacing, a shorter photo composition and
tablet columns; pricing's hero padding and display size are reduced as well.
The screenshot source and exact logo shapes remain unchanged.

Measured at 1440px, landing hero height is 585.14px instead of 900.69px (~35%
shorter), ending at y=658.14 including the header. Tablet hero is 549.67px and
390px mobile is 963.67px, with content flowing naturally. Pricing's desktop
hero is 432.14px instead of 558.11px. There is no horizontal overflow in any of
the eight measured page/viewport states and no browser page error.

Nine focused unit tests, TypeScript, scoped ESLint, ten browser behaviors and
four axe states pass (zero detected violations; incomplete findings retained).
Evidence and optimized before/after captures: output/compact-hero/2026-11-14.
Local preview only; no push, deployment or configuration write.
