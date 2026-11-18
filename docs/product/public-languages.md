# Public platform languages

The platform's public interface supports English, Brazilian Portuguese and
Spanish (`en`, `pt`, `es`). This includes the landing page, pricing and estimator,
shared navigation/footer, marketing demonstrations, blog navigation, legal page
shells, platform sign-in and registration. Restaurant menus retain their existing
language system and are not governed by the platform preference.

## Selection and rendering

`?lang=pt` and `?lang=es` select a language explicitly. Explicit language wins
over the `xprout_public_lang` cookie saved by the language selector. English is
the deterministic default. An English link includes `lang=en` so it can override
a previous saved preference. Internal links retain other query parameters and
fragments. The selector keeps the current path, query and fragment.

Middleware removes incoming locale headers, resolves the preference only for
the platform's public routes, and forwards a trusted locale plus a copy of the
request site identity. It never mutates the cached identity object. The root
document language, server-rendered content, client context and localized
marketing metadata use the same request locale. Cookie/query responses remain
private and uncached under the existing cache contract. Anonymous English HTML
without query parameters or cookies retains the existing shared cache behavior.

Prices remain in USD; language affects number/date formatting, not financial
calculations. The fixed source amounts still live in `marketing/pricing.ts`.

## Copy and authored content

`public-copy.json` contains marketing translations; `public-shell-copy.json`
contains navigation, legal/blog/authentication interface translations. English
source sentences are catalog keys. Interpolated values use named `{tokens}`.
Lookup accepts only own properties and preserves unknown authored copy.

Optional authored translations use the existing settings JSON without a schema
migration:

```json
{
  "landing": {
    "hero": { "heading": "Original heading" },
    "translations": {
      "pt": { "hero": { "heading": "Título traduzido" } },
      "es": { "hero": { "heading": "Título traducido" } }
    }
  },
  "legal": {
    "privacy": {
      "title": "Privacy Policy",
      "body": "Original published document",
      "language": "en",
      "translations": {
        "pt": { "title": "Política de Privacidade", "body": "Translated document" }
      }
    }
  }
}
```

These structures are supported by readers. The settings editor does not yet
provide dedicated translation fields. No persisted settings were changed by
this implementation. Missing/blank legal translations retain the original
document with an original-language notice. Blog articles retain their published
source text and display an original-language notice; translating stored article
bodies is separate editorial work. Editorial/legal fallback pages do not
advertise hreflang alternatives as if their bodies had been translated.
Marketing page alternatives are declared for the translated public interface.

## Verification

Run the focused locale, marketing metadata/content/pricing, middleware and
identity presentation tests with one Vitest worker on a Surface. The initial
five-file run took 15 seconds; a three-file render/layout/AR check took 7 seconds
on 2026-11-18. Scope lint to changed files. Full build and browser verification
require a machine with sufficient free memory or CI; these were not run on the
memory-constrained Surface during implementation.
