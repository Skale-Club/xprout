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

Mobile headings use 44–48px, desktop hero 64–82px; section titles 32–52px. UI/body
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
