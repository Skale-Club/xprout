# Xprout marketing design v2

Status: local implementation and review; not deployed. Owner chose the ivory/forest
editorial direction with contrasting dark sections on 2026-11-14.

## Direction

Premium hospitality, generous editorial typography and real food/product imagery.
Keep the approved v7 Xprout signature unchanged. Warm ivory #F3EFE5 is the main
ground, burnt forest #283F32 anchors text/actions, and deep forest sections create
rhythm. No new brand accent, glass-card wallpaper, decorative fake dashboards,
invented client counts, testimonials or unsupported revenue claims.

Fraunces Semibold is the approved editorial face; retain Inter for body, controls
and tabular price figures. Fonts and styles are scoped to marketing, leaving
customer menus and auth/admin typography unchanged. Preserve explicit platform
CTA colors, app name, custom logo and configurable landing content/media.
The shared header uses forest with the approved ivory signature, ivory navigation
and an ivory CTA as an explicit contrast role; stored CTA colors are not rewritten.

## Shared contract

The shared MarketingFrame supplies the `marketing-site` scope and display font
to both the root landing wrapper and the grouped marketing layout.
Shared CSS lives in marketing.css. Pages use these shared roles:

- `mk-container`: max-width 1200px, gutters 20px/32px; no nested gutters.
- `mk-section`: 64px mobile / 96px desktop section rhythm.
- `mk-display`, `mk-h2`, `mk-eyebrow`, `mk-lead`, `mk-muted`: editorial hierarchy.
- `mk-button`, `mk-button--outline`, `mk-button--light`: consistent 48px controls,
  visible keyboard focus, no scaling or layout jumps. Nav controls may be 44px.
- `mk-dark`: deep forest, ivory type and role-specific borders/muted text.
- `mk-panel`, `mk-pill`, `mk-price`: restrained surfaces and tabular figures.

Hero headings use 40–68px with responsive scaling; section titles 32–52px. UI/body
copy uses 16–18px. Cards use16–24px radii, fields12px, buttons pill. One-column
content at 320px; no hidden page overflow used to conceal broken layouts. Respect
reduced motion and keep primary content visible without an entrance animation.

## Pages

Landing: editorial hero with an owned food/menu composition; a usable live-demo
selection linking to Aurora, Bella Vista and Celes; a clear setup process; a
contrasting product-capabilities section; a concise pricing entry; FAQ; closing
invitation. Existing login-modal behavior and configured text/media remain.

Pricing: brief explanation of one-time setup plus ongoing service; three project
options; monthly/annual plan comparison; grouped extras; a useful estimator;
process and complete commercial terms. Shared nav/footer/type/control system.

The source of monetary truth remains src/lib/marketing/pricing.ts. No amounts,
fees, caps, discounts, payment split, minimum period or billing behavior change.
Preserve estimator calculations, limits, labels and live announcements. Current
registration and login destinations stay explicit; no simulated checkout.

## Reference and feature boundaries

[Menu3D](https://menu3d.net/) and its [pricing page](https://menu3d.net/pricing)
inform product demonstrations, modular storytelling and readable comparisons.
Their artwork, code, customer evidence and commercial claims are not reused.

Demonstrate existing Xprout capabilities accurately: configurable menus, feed,
selected 3D dishes, QR/NFC access, enabled languages and plan-dependent ordering.
AI features remain optional/controlled. Do not imply universal POS integration,
reservation scheduling, AI telephone service or guaranteed sales growth.

Possible later features: a live theme playground, approved photo before/after
viewer, guided plan recommendation and lazy interactive 3D demo. Each requires
its own verified implementation and acceptance; marketing decoration does not
establish a shipped feature.

## Verification and delivery

Use existing owner-approved food derivatives and verify actual byte/dimension
budgets under docs/product/media-policy.md. Lazy-load below-fold media; avoid
automatic heavy video/3D downloads. Check both pages together at 320/390/768/1440px,
keyboard, reduced motion, contrast, image loading, anchors, demo selection,
annual/monthly toggle, estimator and existing configured content paths.

Deliver review captures and findings under N:/My Drive/Xprout/Reviews. Record one
Journal entry and distinguish local review from publication. This new design is
a separate release decision from the previously completed brand rollout.

## Explicit settings migration

The development project was aligned with the selected direction using a guarded
compare-and-swap and before snapshots. The production settings remain untouched.
A future approved release must merge these four paths into the existing landing
object, preserving every other field and the original image/video references:

| Path | Previous default | Reviewed value |
| --- | --- | --- |
| landing.hero.bg_type | video | color |
| landing.hero.bg_color | #09090b | #F3EFE5 |
| landing.hero.cta_primary | Get started free | Start your menu |
| landing.cta.button | Create free account | Start your project |

These are explicit configuration edits, not CSS substitutions of stored colors.
The original media URLs remain available for rollback; the new default hero uses
an optimized owned food image instead of requesting the old background video.

## Color and motion refinement — 2026-11-14

Owner feedback requested more color differences, movement and effects. Add sage
`#DCE6CD`, light olive `#D1DFAB` and olive `#A9BD7D` as supporting marketing roles;
forest and ivory remain the brand anchors. The ivory hero receives a curved
green backplate; explicit custom hero colors/media retain their configured
background. A feature ribbon, differentiated project cards, tinted previews,
dark plan gradients and a sage estimator give sections distinct visual rhythms.
Small text in preview panels uses `#435541` for sufficient contrast.

MarketingMotion progressively enables an entrance for the hero artwork, a subtle
floating QR label, section opacity reveals, preview transitions, card/photo hover
effects, a sliding billing selector and exact-price transitions. Prices never
count through invented intermediate values. Section reveals do not move controls
under a pointer, and keyboard focus immediately makes the relevant section visible.
An optional CSS scroll progress indicator uses a supported scroll timeline with
a static fallback. No animation library or new media download is added.

The visible Pause motion / Resume motion control persists a local preference
across marketing pages (`xprout.marketing.motion.v1`). System reduced motion and
data saving disable decorative animation and omit that control. Server-rendered
content is visible before JavaScript, and pausing reveals all pending sections.
An explicitly configured legacy hero video also obeys Pause/Resume and pauses
offscreen or when the document is hidden; reduced motion avoids its source request.
These controls and normal-motion behavior are verified in a real Chromium run;
older browsers retain visible content when IntersectionObserver is unavailable.

Review evidence: `output/premium-motion/2026-11-14`. The private UI recording is
delivered as a 1200×900, 24 fps, silent H.264 MP4 with fast-start metadata, capped
at 5 MiB / 30 s, with a WebP poster capped at 180 KiB / 1200 px. This review-only
profile does not change guest video-upload budgets or resolve their known gaps.
The measured recording is 13.42 s / 830,332 B. Publication remains a separate
release step; production settings and source release are unchanged by this round.

## Green header and compact hero refinement

Owner feedback on 2026-11-14 requests a forest header and less hero height.
The shared header now uses #283F32 with ivory logo, navigation, button and focus
rings on both landing and pricing; inner height is 64px mobile / 72px desktop.
The landing reduces vertical spacing, display size and photo aspect, using a
square on mobile and 6:5 from tablet. Two columns begin at 768px. Image sizes
reflect the revised layout, and the caption remains a contained overlay.
Pricing receives the same reduced display range and 40/48px hero padding.
Natural content flow is retained; no fixed viewport height or clipped copy.

At 1440px, measured landing hero height changes from 900.69 to 585.14px (35%);
at 390px from 1185.39 to 963.67px; at 768px from 1297.64 to 549.67px. Pricing
hero at 1440px changes from 558.11 to 432.14px. Eight responsive states, nine
focused unit tests, ten existing browser behaviors, TypeScript and scoped lint
pass. Four axe states detect no violations, retaining incomplete findings.
Evidence: output/compact-hero/2026-11-14. This remains a local review.
