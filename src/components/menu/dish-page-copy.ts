/**
 * The few words only the public dish page (/<slug>/<menu>/<dish>) and the link to it use, in
 * every language the menu speaks. Everything else on that page comes from menu-i18n and guest-copy.
 */
export interface DishPageCopy {
  /** Heading over the other dishes at the foot of the page. */
  moreDishes: string
  /** The quiet link in the dish window that opens the dish's own page. */
  openDishPage: string
}

const COPY: Record<string, DishPageCopy> = {
  en: { moreDishes: 'More dishes', openDishPage: 'Open dish page' },
  pt: { moreDishes: 'Mais pratos', openDishPage: 'Abrir página do prato' },
  es: { moreDishes: 'Más platos', openDishPage: 'Abrir página del plato' },
  fr: { moreDishes: 'Plus de plats', openDishPage: 'Ouvrir la page du plat' },
  de: { moreDishes: 'Weitere Gerichte', openDishPage: 'Seite des Gerichts öffnen' },
  it: { moreDishes: 'Altri piatti', openDishPage: 'Apri la pagina del piatto' },
  nl: { moreDishes: 'Meer gerechten', openDishPage: 'Pagina van het gerecht openen' },
  pl: { moreDishes: 'Więcej dań', openDishPage: 'Otwórz stronę dania' },
  tr: { moreDishes: 'Diğer yemekler', openDishPage: 'Yemek sayfasını aç' },
  ru: { moreDishes: 'Другие блюда', openDishPage: 'Открыть страницу блюда' },
  hi: { moreDishes: 'और व्यंजन', openDishPage: 'व्यंजन का पेज खोलें' },
  ja: { moreDishes: 'ほかの料理', openDishPage: '料理のページを開く' },
  ko: { moreDishes: '다른 메뉴', openDishPage: '메뉴 페이지 열기' },
  zh: { moreDishes: '更多菜品', openDishPage: '打开菜品页面' },
  'zh-TW': { moreDishes: '更多菜色', openDishPage: '開啟菜色頁面' },
}

export function getDishPageCopy(lang: string | null | undefined): DishPageCopy {
  if (!lang) return COPY.en
  if (COPY[lang]) return COPY[lang]
  const lower = lang.toLowerCase()
  if (lower === 'zh-tw' || lower === 'zh-hant' || lower === 'zh-hk') return COPY['zh-TW']
  return COPY[lower.split('-')[0]] ?? COPY.en
}
