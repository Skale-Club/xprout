/**
 * The few words only the public dish page uses (/<slug>/<menu>/<dish>), in every language the
 * menu speaks. Everything else on that page comes from menu-i18n and guest-copy.
 */
export interface DishPageCopy {
  /** Heading over the other dishes at the foot of the page. */
  moreDishes: string
  /** Caption over the restaurant's name in its card. */
  servedAt: string
  directions: string
  call: string
}

const COPY: Record<string, DishPageCopy> = {
  en: { moreDishes: 'More dishes', servedAt: 'Served at', directions: 'Directions', call: 'Call' },
  pt: { moreDishes: 'Mais pratos', servedAt: 'Servido em', directions: 'Como chegar', call: 'Ligar' },
  es: { moreDishes: 'Más platos', servedAt: 'Se sirve en', directions: 'Cómo llegar', call: 'Llamar' },
  fr: { moreDishes: 'Plus de plats', servedAt: 'Servi chez', directions: 'Itinéraire', call: 'Appeler' },
  de: { moreDishes: 'Weitere Gerichte', servedAt: 'Serviert bei', directions: 'Route', call: 'Anrufen' },
  it: { moreDishes: 'Altri piatti', servedAt: 'Servito da', directions: 'Indicazioni', call: 'Chiama' },
  nl: { moreDishes: 'Meer gerechten', servedAt: 'Geserveerd bij', directions: 'Route', call: 'Bellen' },
  pl: { moreDishes: 'Więcej dań', servedAt: 'Podawane w', directions: 'Dojazd', call: 'Zadzwoń' },
  tr: { moreDishes: 'Diğer yemekler', servedAt: 'Servis edildiği yer', directions: 'Yol tarifi', call: 'Ara' },
  ru: { moreDishes: 'Другие блюда', servedAt: 'Подают в', directions: 'Маршрут', call: 'Позвонить' },
  hi: { moreDishes: 'और व्यंजन', servedAt: 'यहाँ परोसा जाता है', directions: 'रास्ता देखें', call: 'कॉल करें' },
  ja: { moreDishes: 'ほかの料理', servedAt: '提供店舗', directions: '経路', call: '電話する' },
  ko: { moreDishes: '다른 메뉴', servedAt: '제공 매장', directions: '길찾기', call: '전화하기' },
  zh: { moreDishes: '更多菜品', servedAt: '供应餐厅', directions: '路线', call: '致电' },
  'zh-TW': { moreDishes: '更多菜色', servedAt: '供應餐廳', directions: '路線', call: '撥打電話' },
}

export function getDishPageCopy(lang: string | null | undefined): DishPageCopy {
  if (!lang) return COPY.en
  if (COPY[lang]) return COPY[lang]
  const lower = lang.toLowerCase()
  if (lower === 'zh-tw' || lower === 'zh-hant' || lower === 'zh-hk') return COPY['zh-TW']
  return COPY[lower.split('-')[0]] ?? COPY.en
}
