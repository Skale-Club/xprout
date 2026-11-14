# Premium Xprout experience release

Owner authorized consolidation and production publication on 14 November 2026.
Baseline production image: `5336b99ecde06d9bb03d7abcb1d7716e9654bd05`.
Deployment is gated by the existing CI pipeline; final status and deployed SHA
are recorded in the Journal and `/api/health/ready`, not inferred from a push.

## Scope

- Premium editorial landing/pricing, forest header, approved proportional logo,
  wine/rosewood platform accents and updated visual-menu/3D narrative.
- Photographed table with three optimized interactive dishes, native mobile
  camera entry, same-row Morse controls, shaded title, anonymous demo-store
  section and a separate silent looping food film without player controls.
- Customer-menu typography, spacing, pills and predefined product-tag catalog;
  dish detail remains open with quantity/cart controls; optional suggestions
  live in the cart; tenant metadata and phone-first contact presentation.
- No schema migrations or destructive database changes. Tenant colors,
  capability/ordering gates, prices, native model URLs and webhook guards remain.

## Validation and rollout

Local: 1,633 unit passes, six skips, TypeScript pass; full lint passed with
existing warnings after scoping React overrides correctly for CommonJS scripts.
Legacy suites and blocked-slug checks pass. CI performs the production build,
SQL rehearsals, Playwright and Lighthouse before production deployment.
Source review found no secrets or destructive schema/data operations.

Publish the validated image, confirm readiness reports its exact SHA, then merge
the reviewed 17 landing paths from `src/lib/marketing/landing-copy.json` and the
ivory hero profile into freshly read production settings. A snapshot and
timestamp compare-and-swap preserve all unrelated fields, media references,
identity, SEO overrides and integration settings. Never replay an entire
development database or execute the development-only contact seed in production.
Rollback uses the baseline image and an exact-path configuration rollback;
production business data remains on the owned PostgreSQL.

Current pending legacy branches: all eight `archive/2026-11-10/*` refs conflict.
They retain their ten patch-unique commits under the owner's earlier decision
to review conflicts after deployment. None is silently treated as superseded
or deleted. Full hashes, subjects, branch membership, merge/stash tips and
conflict paths are recorded in the release inventory.

Evidence, settings snapshots/plans and final branch inventory:
`output/releases/2026-11-14`; owner delivery:
`N:/My Drive/Xprout/Releases/2026-11-14`.
