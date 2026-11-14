# Dish tags

Rule set on 2026-11-12 by the owner. Code: `src/lib/menu/dish-tags.ts`.

## One tag per dish, everywhere

A dish has **one** tag, shown as **one** pill, so it never takes much space:

- the dish card in the public menu (list and grid);
- the visual feed;
- the dish sheet (ProductModal);
- the admin product list and form. The form lets the owner pick one tag:
  tapping another swaps it, tapping the chosen one clears it.

Owner clarification, 2026-11-14: pills are a platform-defined catalog, not
tenant-authored text. `PREDEFINED_DISH_TAGS` is shared by the admin selector
and backend validators. Product writes accept an empty array (clear) or one
known label, with a maximum input length of 24 characters. Unknown, oversized
or multiple values are rejected; recognized case/whitespace variants are
stored canonically. Admin APIs and native/legacy MCP product paths enforce
the rule. Tenant `custom_tags` settings can only contain a catalog subset,
and no longer define product-selector text.

Legacy reads use `primaryTag` / `normalizeTags` to choose the highest-ranked
known value and ignore unsupported text. No production data migration is
performed. Legacy browser-to-Supabase writes remain outside API validation;
the current owned production stack uses the guarded server writer.

Do not add a second pill, a tag row or a "+N" counter anywhere. New surfaces
(search results, upsell, featured, etc.) call `primaryTag(product.tags)`.

## One feature pill, one component (owner, 2026-11-12)

A dish shows at most ONE feature pill on every surface: its tag; with no
tag, a dish marked as featured (`is_featured`) shows "Chef's special".
`is_featured` is a placement (the featured row), never a second pill. The
decision is `dishFeature` in `src/lib/menu/dish-tags.ts`; the pill is
`src/components/menu/DishFeaturePill.tsx` (shape and type from the visual
feed; `glass` over photos, `solid` on light surfaces), used by the feed, the
menu cards, the dish sheet and the admin product list. Change it there and it
changes everywhere. Server writes use `validateDishTags`; a per-client exception would be a deliberate,
documented switch, not the default.

## Which tag wins

`primaryTag` picks the highest-ranked known tag:

1. Chef's special
2. Recommended
3. Spicy
4. Vegan
5. Vegetarian
6. Gluten-Free
7. New

Unsupported legacy free text is not shown. A featured dish without a valid
tag still uses the existing Chef's special fallback.

## One colour per tag

Each known tag has its own colour (soft background, dark text), used the same
way in the menu, the dish sheet and the admin (where the selected tag button
takes its colour):

| Tag | Colour |
| --- | --- |
| Chef's special | purple |
| Recommended | sky blue |
| Spicy | red |
| Vegan | emerald |
| Vegetarian | green |
| Gluten-Free | amber |
| New | neutral grey |

On the dark visual feed, the pill keeps its dark glass background and uses the
tag's light colour for the text.

Owner update, 2026-11-14: public menu cards and the dish sheet also place the
feature pill over the photo using the feed's `glass` treatment. Cards keep
the feature pill at the top and the 3D badge at bottom left; the dish
sheet places its pill at the top left, 12px from the photo edges and clear
of the close button. Its 3D action stays at bottom left, above gallery
pagination when present (owner refinement, 2026-11-14). The pill
is hidden while the interactive 3D viewer is open. A dish sheet without
media retains its solid pill in the text area; cards without a photo use a
solid pill over the placeholder for readability. Admin pills remain solid.
All pills stay on one line within the available width; long translated
labels can ellipsize instead of breaking the capsule.

## Adding a tag

1. Add it to `KNOWN_TAGS` in `src/lib/menu/dish-tags.ts` with a colour and its
   position in the priority order.
2. Add its translations to `TAG_COPY` in `src/components/menu/menu-i18n.ts`.
3. The shared `PREDEFINED_DISH_TAGS` catalog automatically offers it in the
   admin. Keep the canonical label within `MAX_DISH_TAG_LENGTH` (24).

Colours are fixed in code today. Letting each restaurant choose its own tag
colours would need a settings column and an admin screen; it is not built.
