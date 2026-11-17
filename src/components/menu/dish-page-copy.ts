/**
 * The few words only the public dish page uses (/<slug>/<menu>/<dish>), in every language the
 * menu speaks. Everything else on that page comes from menu-i18n and guest-copy.
 */
export interface DishPageCopy {
  /** Heading over the other dishes at the foot of the page. */
  moreDishes: string
}

const COPY: Record<string, DishPageCopy> = {
  en: { moreDishes: 'More dishes' },
  pt: { moreDishes: 'Mais pratos' },
  es: { moreDishes: 'Más platos' },
  fr: { moreDishes: 'Plus de plats' },
  de: { moreDishes: 'Weitere Gerichte' },
  it: { moreDishes: 'Altri piatti' },
  nl: { moreDishes: 'Meer gerechten' },
  pl: { moreDishes: 'Więcej dań' },
  tr: { moreDishes: 'Diğer yemekler' },
  ru: { moreDishes: 'Другие блюда' },
  hi: { moreDishes: 'और व्यंजन' },
  ja: { moreDishes: 'ほかの料理' },
  ko: { moreDishes: '다른 메뉴' },
  zh: { moreDishes: '更多菜品' },
  'zh-TW': { moreDishes: '更多菜色' },
}

export function getDishPageCopy(lang: string | null | undefined): DishPageCopy {
  if (!lang) return COPY.en
  if (COPY[lang]) return COPY[lang]
  const lower = lang.toLowerCase()
  if (lower === 'zh-tw' || lower === 'zh-hant' || lower === 'zh-hk') return COPY['zh-TW']
  return COPY[lower.split('-')[0]] ?? COPY.en
}
