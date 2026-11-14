# Xprout wine accent review

Local implementation, 14 November 2026. No push, deployment or production settings update.

## Approved palette and roles

Forest `#283F32` and ivory `#F3EFE5` remain the foundation. Owner-requested wine
`#602021` is the main accent; rosewood `#57373B` is used less frequently.
Shared platform accent tokens do not replace configurable action or tenant colors.
Wine/ivory contrast is 10.60:1; rosewood/ivory is 9.08:1. Wine/forest is only
1.07:1, so dark surfaces retain ivory essential text. Decorative dark lines/glows
are nonessential. Error/status colors retain their semantic roles.

## Applied scope

- Landing and pricing: light editorial labels/focus, active menu and dish choices,
  selected billing text, alternating feature icons, DIY top detail; rosewood only
  on the 3D setup border and scroll progress line.
- Auth: existing decorative line/glow, with tenant guest/link identity excluded.
- Onboarding and default access requests: thin wine frame details.
- Admin and superadmin: shared header details; configured active navigation and
  primary actions retain their colors.
- Manual edition 1.2: palette JSON, editable SVG swatches, page 5 and pack sources.
  All 79 logo/icon exports retain their prior hashes and approved geometry.

This does not claim a complete rollout through every legacy module, e-mail or
notification. Restaurant customer views are outside the platform accent scope.

## Evidence

- 31 targeted unit tests passed across seven suites: platform colors, public
  colors, runtime identity, tenant identity, marketing content/layout and pricing.
- TypeScript passed. Scoped ESLint: zero errors; one existing
  `react-hooks/set-state-in-effect` warning in AdminSidebar (line 124).
- Browser: landing/pricing at 320, 390, 768 and 1440px; eight HTTP 200 states,
  no page errors or horizontal overflow. Default primary CTA remains forest.
- Four isolated platform fixtures verified wine details while deliberately
  overriding primary to blue, demonstrating separate ownership. Temporary review
  routes were removed after capture; no authentication flow was submitted.
  The removed route responds HTTP 404; landing and pricing remain HTTP 200.
- Aurora customer menu: HTTP 200, primary `#1a1a2e`, no marketing scope or
  platform accent classes.
- Four axe runs: zero automated violations; incomplete checks remain for complex
  contrast/ARIA/table cases. This is not a blanket accessibility certification.
- Brand finalizer verifies exact paths, cap/body alignment excluding descenders,
  0.86 wordmark scale, 79 asset hashes, 10-page manual and four vector plates;
  delivered files are verified by SHA256. Palette SVG is 1,275 bytes, 960x300,
  within its 8 KiB / 1200px budget.

Captures and JSON evidence: `output/wine-palette/2026-11-14`.
Owner delivery: `N:/My Drive/Xprout/Reviews/2026-11-14 Wine Palette`.
Brand pack/manual: `N:/My Drive/Xprout/Brand`.
Preview: http://127.0.0.1:3255/ and /pricing.
