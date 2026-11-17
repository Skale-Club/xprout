/**
 * Menu slugs renamed after their links were public (search results, shared dish links, QR codes).
 * The old address redirects to the new one, but only when no menu answers to the old slug any
 * more, so the code can ship before or after the rename in the database without a broken step.
 */
const RENAMED_MENU_SLUGS: Record<string, Record<string, string>> = {
  // Aurora's main menu, to English (2026-11-17).
  aurora: { 'cardapio-principal': 'main-menu' },
}

export function renamedMenuSlug(slug: string, menuSlug: string): string | null {
  return RENAMED_MENU_SLUGS[slug.toLowerCase()]?.[menuSlug.toLowerCase()] ?? null
}
