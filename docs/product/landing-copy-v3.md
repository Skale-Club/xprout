# Xprout landing copy revision

14 November 2026. Local implementation and development settings only; not published.

## Positioning

Lead with visual discovery: guests browse dishes, explore selected 3D models and
use a supported phone to see a dish on their table. Present the restaurant's
identity and the way it serves as part of the experience. QR codes, NFC and links
are access methods rather than the main product promise.

Hero: **Let guests explore. Before the first bite.**

Supporting copy: “Bring your dishes to life with photography and interactive 3D.
Let guests see selected dishes on their own table, then choose the ordering tools
that fit your service.” The adjacent note qualifies selected dishes and supported
phones. The primary action starts a project; the secondary action opens the
experience section. No free trial, instant launch or guaranteed revenue claim.

## Review and changes

| Previous message | Revised role |
| --- | --- |
| Menu on the customer's phone; QR codes and WhatsApp ordering | A visual menu, selected 3D dishes and a camera view on the table |
| Build, customize, generate/print QR | Bring dishes, choose the experience, choose how to serve |
| Unique link, WhatsApp, scan counter, no app | Six concrete capabilities: photos/feed, selected 3D, branding, languages, service tools, optional AI |
| Generic digitization closing invitation | Bring food, identity and service into a visual menu |
| One generic “View in 3D” action | “See it on your table” on compatible phones; “Explore in 3D” elsewhere |
| QR-focused search description; free beta software offer | Visual-menu/3D metadata; obsolete zero-price beta offer removed |

Revised hero, feature ribbon, showcase introduction/example description, film
supporting copy, process, features, FAQ, navigation/footer actions, closing CTA,
search/social metadata and organization/software structured descriptions.
The FAQ covers the 3D experience, device/model requirements, service tiers,
languages, setup options and existing prices. Removed an unverified export promise.

## Capability evidence and claim limits

| Capability | Code evidence | Public qualification |
| --- | --- | --- |
| Photo-led feed, dish details and branding | `MenuPage.tsx`, `MenuFeed.tsx`, `lib/data/public-menu.ts` | Content and enabled view depend on the restaurant |
| Camera/table view and desktop 3D | `components/ar/ArButton.tsx`, `ProductModal.tsx`, `lib/ar/launch.ts` | Selected dishes need prepared models; phone/browser compatibility applies |
| Staff/table/kitchen tools | `lib/service-modes.ts`, `api/orders/route.ts` | Waiter or Payments entitlement plus enabled services |
| Guest ordering | `lib/service-modes.ts:resolveServiceCapabilities` | Payments entitlement and restaurant enablement |
| Online payment | `lib/stripe.ts`, checkout form | Connected Stripe account and enabled service; no universal wallet promise |
| Menu languages | `menu-i18n.ts`, `menu-translations.ts` | Chosen languages; no unlimited/automatic translation promise |
| Menu assistant | `lib/chat-agent.ts`, public chat session, `MenuPage.tsx` | Optional enabled add-on; currently exposed in list view |

Two misleading Waiter pricing descriptions were corrected from guest ordering to
staff ordering. The comparison now lists guest ordering separately under Payments.
Prices, calculations, fees, plan keys and billing behavior were not changed.
The Growth add-on's existing “unlimited languages” phrase was outside this narrow
landing revision; it remains a commercial-copy follow-up rather than a verified
global language claim. Physical native camera placement was not retested here.

## Configuration authority and release

`src/lib/marketing/landing-copy.json` is the default source for configurable hero,
process, feature and closing copy, plus metadata defaults. Explicit saved strings
retain precedence; existing nonempty-array and empty-array fallback semantics stay
the same. Changes do not reinterpret saved text or colors at render time.

The guarded development operation changed fourteen existing copy paths, after a
before snapshot and a timestamp compare-and-swap. Only hero text, process text and
steps, feature text and items, and closing heading/body changed. Existing closing
button already matched. Read-back confirms all other landing fields, media URLs,
backgrounds, identity, SEO overrides and footer are preserved. Development SEO
overrides were null, so the new code defaults apply. Evidence and exact before/
after path plan: `output/landing-copy/2026-11-14`.

For a future owner-authorized release, merge the reviewed sections from the
canonical JSON into freshly read production settings; never replace the whole
landing object or blindly replay development IDs/timestamps. Compare current
values, preserve unrelated fields and configured SEO overrides, and verify the
stored and public result. This supplements the earlier four-path visual settings
plan in `marketing-design-v2.md`. No production query/write or deployment occurred.

## Verification

Thirty focused unit tests passed, including saved copy/identity authority,
metadata overrides, no free software offer, pricing and native launch URLs.
TypeScript and scoped ESLint passed. Actual browser checks cover 320/390/768/1440px:
HTTP 200, one correct H1, current metadata/structured data, six feature cards,
working FAQ, experience anchor, no old QR/WhatsApp-first claims, no page errors or
horizontal overflow. An emulated compatible Android phone shows the camera/table
label; the pricing comparison restricts guest ordering to Payments. Reviewed hero
and six-feature screenshots for readable wrapping on mobile and desktop.

Delivery: `N:/My Drive/Xprout/Reviews/2026-11-14 Landing Copy`.
Preview: http://127.0.0.1:3255/ . Evidence captures are WebP, at most 1200px and
180 KiB; no source media assets were regenerated.
