'use client'

import { BRAND_NAME, BRAND_PRIMARY } from '@/lib/brand'
import { googleReviewLink } from '@/lib/site/review-link'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { idempotencyKeyFor, type IdempotencySlot } from '@/lib/orders/idempotency-client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { DeliveryImage } from '@/components/delivery-image'
import { prefetchImage, whenIdle } from '@/lib/media/prefetch-image'
import DishPhoto from './DishPhoto'
import { getInitials } from '@/lib/utils'
import { MenuAnalyticsTracker } from '@/lib/analytics/client'
import type { Category, Product, TenantWithSettings, ProductIngredientWithIngredient, IngredientModifications, DeliveryZone, ProductMedia, PublicProductArModel } from '@/types/database'
import type { GroupWithOptions } from '@/app/(admin)/menu/products/[id]/page'
import { type CartItem, type CartAddedVia, type CartEditorState, buildCartKey, getProductImages, isProductVisibleInFeed, summarizeOptions } from './menu-utils'
import { arOrderSummary, dishQuantity, lineToDecrement } from './ar-cart'
import { getGuestCopy } from './guest-copy'
import WaiterCallButtons from './WaiterCallButtons'
import { fill, formatMoney, formatWeekday, getMenuCopy, localeFor, matchDeviceLanguage } from './menu-i18n'
import { computeOpenState, resolveTimeZone } from '@/lib/chat-context'
import NoticePill from './NoticePill'
import { NO_CAPABILITIES, type TenantCapabilities } from '@/lib/service-modes'
import { contactLinks, displayPrice, phoneLabel, whatsappUrl } from './showcase'
import { dishSlug, isIndexableDish } from '@/lib/menu/dish-pages'
import { resolveMenuActionLinks, visibleFooterBrand } from '@/lib/menu-action-links'
import FeaturedCarousel from './FeaturedCarousel'
import { GuestAccountButton } from './GuestSignIn'
import { feedSizes } from './feed-sizes'
import { contactEmailFor } from '@/lib/public-contacts'
import PageLinksMenu from '@/components/pages/PageLinksMenu'
import { dishDetailsFor } from '@/lib/public-dish-details'
import { extraDishImagesFor } from '@/lib/public-dish-media'
import { describeOpenState, menuTimeZone, type OpenLabel } from './open-label'
import { computePrimaryForeground, readableTextColor, safeCssColor } from '@/lib/color-utils'
import { ArBadge, type ArSequenceItem } from '@/components/ar/ArButton'
import { baseName, localizeGroups, localizeItem } from '@/lib/menu-translations'
import {
  CART_TTL_MS,
  browserStorage,
  cartStorageKey,
  checkoutFields,
  defaultOrderTypeFor,
  isDraftEmpty,
  normalizeScreenState,
  readStored,
  removeStored,
  resolveInitialView,
  restoreCart,
  sanitizeScreenState,
  serializeCart,
  sessionStorageKey,
  urlWithView,
  writeStored,
  type MenuView,
  type StoredCartItem,
} from './menu-session'
import BottomSheet from '@/components/ui/BottomSheet'
import LanguagePicker from './LanguagePicker'
import { findDishByParam, readDishParam, withDishParam } from '@/lib/menu/dish-link'
import { dishFeature } from '@/lib/menu/dish-tags'
import DishFeaturePill from './DishFeaturePill'
import { ui } from './menu-ui'
import { buildCartSuggestions, canQuickAdd } from './upsell'
import {
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  X,
  Sparkles,
  Plus,
  Minus,
  UtensilsCrossed,
  Clapperboard,
  ShoppingBag,
  CalendarCheck,
} from 'lucide-react'
import type { AppliedPromo, LoyaltyInfo } from './CheckoutModal'
import { DishPageCartContext, type DishPageCart } from './DishCartButton'

const ProductModal = dynamic(() => import('./ProductModal'), { ssr: false })
const CartPanel = dynamic(() => import('./CartPanel'), { ssr: false })
const CheckoutModal = dynamic(() => import('./CheckoutModal'), { ssr: false })
const AiChatWidget = dynamic(() => import('./AiChatWidget'), { ssr: false })
const MenuFeed = dynamic(() => import('./MenuFeed'))
const AnalyticsDebugPanel = dynamic(() => import('./AnalyticsDebugPanel'), { ssr: false })

const MOBILE_VIEWPORT_QUERY = '(max-width: 767px)'

function subscribeToMobileViewport(onChange: () => void) {
  const mediaQuery = window.matchMedia(MOBILE_VIEWPORT_QUERY)
  mediaQuery.addEventListener('change', onChange)
  return () => mediaQuery.removeEventListener('change', onChange)
}

function getMobileViewportSnapshot() {
  return window.matchMedia(MOBILE_VIEWPORT_QUERY).matches
}

function getServerMobileViewportSnapshot() {
  return false
}

interface Props {
  tenant: TenantWithSettings
  categories: Category[]
  products: Product[]
  menu?: {
    id?: string
    slug?: string | null
    is_private?: boolean
    name: string
    description?: string | null
    language: string
    supported_languages?: string[]
    translations?: Record<string, { name?: string; description?: string }>
  } | null
  location?: { id: string; name: string } | null
  initialLanguage?: string
  initialView?: 'list' | 'feed'
  footerBrand?: string
  /** The restaurant's published website pages that show in the navigation ("More" menu and footer links). */
  pageLinks?: ReadonlyArray<{ slug: string; title: string }>
  navigationLinks?: ReadonlyArray<{ title: string; href: string; kind?: 'menu' | 'branch' }>
  canonicalBaseUrl?: string
  dishDiscoveryEnabled?: boolean
  publicNap?: { name: string; address?: string | null; city?: string | null; phone?: string | null }
  optionGroupsByProductId?: Record<string, GroupWithOptions[]>
  productIngredientsByProductId?: Record<string, ProductIngredientWithIngredient[]>
  deliveryZones?: DeliveryZone[]
  productMediaByProductId?: Record<string, ProductMedia[]>
  /** Dishes with a 3D model: "See it on your table" (AR) in the dish detail, a cube on the card and in the feed. */
  productArModelByProductId?: Record<string, PublicProductArModel>
  chatAddonEnabled?: boolean
  chatAddonAudioEnabled?: boolean
  /** Typed messages in the AI chat (the restaurant can allow voice notes only). */
  chatAddonTextEnabled?: boolean
  /**
   * What the plan and the restaurant allow right now (service-modes.ts
   * TenantCapabilities): guest ordering, order types, tips, notes, ingredients,
   * WhatsApp orders. Without it the menu is a showcase.
   */
  capabilities?: TenantCapabilities
  /** The table this link belongs to (QR code / NFC tag ?table=), when guests can order. */
  table?: { id: string; name: string } | null
  /** The table this link belongs to, when the restaurant serves at the table: guests can call a waiter or ask for the bill. */
  waiterCallTable?: { id: string; name: string } | null
  /**
   * A dish page (/<slug>/<menu>/<dish>): its content, rendered on the server, takes the place of the
   * dish list, inside the menu's own header, footer, order bar, cart and checkout. Its h1 is the
   * dish, so the restaurant's name is not a heading here; no category bar, featured row or feed.
   * DishCartButton inside it reaches this menu's order.
   */
  dishPage?: ReactNode
}

function getTranslatedMenuField(
  menu: Props['menu'],
  lang: string,
  field: 'name' | 'description',
  fallback: string
) {
  if (!menu?.translations) return fallback
  const value = menu.translations?.[lang]?.[field]
  return typeof value === 'string' && value.trim() ? value : fallback
}

export default function MenuPage({ tenant, categories: baseCategories, products: baseProducts, menu = null, location = null, initialLanguage, initialView, footerBrand = BRAND_NAME, pageLinks = [], navigationLinks = [], canonicalBaseUrl, publicNap, optionGroupsByProductId: baseOptionGroups = {}, productIngredientsByProductId = {}, deliveryZones = [], productMediaByProductId = {}, productArModelByProductId = {}, chatAddonEnabled = false, chatAddonAudioEnabled = false, chatAddonTextEnabled = true, capabilities = NO_CAPABILITIES, table = null, waiterCallTable = null, dishPage }: Props) {
  const router = useRouter()
  const onDishPage = dishPage !== undefined && dishPage !== null
  const [feedPreview, setFeedPreview] = useState(false)
  const feedEnabled = !onDishPage && ((tenant.tenant_settings?.visual_feed_enabled ?? true) || feedPreview)
  const [menuView, setMenuView] = useState<MenuView>(() => resolveInitialView({
    urlView: initialView,
    defaultView: tenant.tenant_settings?.menu_default_view,
    feedEnabled,
  }))
  // Switching views writes ?view= into the URL, so a reload (or a /feed link
  // the customer navigated away from) lands where they were.
  function changeView(view: MenuView) {
    setMenuView(view)
    try {
      window.history.replaceState(window.history.state, '', urlWithView(window.location.href, view))
    } catch {
      // URL sync is best-effort
    }
  }
  const isMobileViewport = useSyncExternalStore(
    subscribeToMobileViewport,
    getMobileViewportSnapshot,
    getServerMobileViewportSnapshot,
  )
  const activeMenuView = isMobileViewport && !onDishPage ? menuView : 'list'
  // Decided on the server from the plan and the restaurant's switches.
  const directOrdersEnabled = capabilities.guestOrdering
  const ingredientCustomizationEnabled = capabilities.ingredientCustomization
  const orderingTable = directOrdersEnabled ? table : null
  const atTable = !!orderingTable
  // A table link means the guest is eating here: the order goes to that table.
  const defaultOrderType: string = defaultOrderTypeFor(capabilities, atTable)
  const [search, setSearch] = useState('')
  // Tabs scroll to a section instead of filtering; the list is never narrowed to one category.
  const activeCategory: string | null = null
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedProductSource, setSelectedProductSource] = useState<'grid' | 'featured' | 'detail' | 'cart' | 'feed' | 'upsell'>('detail')
  const [selectedLanguage, setSelectedLanguage] = useState(initialLanguage ?? menu?.language ?? 'en')
  // Dish content in the guest's language (falls back to the base text). Each
  // localized item keeps `base_name`, which is what orders send the kitchen.
  const baseLanguage = menu?.language ?? null
  const products = useMemo(
    () => baseProducts.map(p => localizeItem(p, selectedLanguage, baseLanguage)),
    [baseProducts, selectedLanguage, baseLanguage],
  )
  const categories = useMemo(
    () => baseCategories.map(c => localizeItem(c, selectedLanguage, baseLanguage)),
    [baseCategories, selectedLanguage, baseLanguage],
  )
  const optionGroupsByProductId = useMemo(
    () => Object.fromEntries(Object.entries(baseOptionGroups).map(([id, groups]) => [id, localizeGroups(groups, selectedLanguage, baseLanguage)])),
    [baseOptionGroups, selectedLanguage, baseLanguage],
  )
  const [visibleCategory, setVisibleCategory] = useState<string | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [editingCartKey, setEditingCartKey] = useState<string | null>(null)
  const [showHoursModal, setShowHoursModal] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [contact, setContact] = useState({ email: '', smsOptIn: false, emailOptIn: false })
  const [submittingOrder, setSubmittingOrder] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [confirmedCart, setConfirmedCart] = useState<CartItem[]>([])
  const [orderType, setOrderType] = useState<string>(defaultOrderType)
  const [deliveryStreet, setDeliveryStreet] = useState('')
  const [deliveryComplement, setDeliveryComplement] = useState('')
  const [deliveryZipcode, setDeliveryZipcode] = useState('')
  const [deliveryCity, setDeliveryCity] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [tipCents, setTipCents] = useState(0)
  const [promo, setPromo] = useState<AppliedPromo | null>(null)
  // Loyalty: the program's switch comes with the menu; the customer's balance is per person, so it is read live.
  const [loyalty, setLoyalty] = useState<LoyaltyInfo | null>(null)
  const [useReward, setUseReward] = useState(false)
  // The time chosen for a scheduled order (epoch ms); null = as soon as possible.
  const [scheduledFor, setScheduledFor] = useState<number | null>(null)
  const [confirmedScheduledFor, setConfirmedScheduledFor] = useState<number | null>(null)
  const [analyticsTracker, setAnalyticsTracker] = useState<MenuAnalyticsTracker | null>(null)
  const [analyticsDebug, setAnalyticsDebug] = useState(false)
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({})
  const orderAttemptRef = useRef<IdempotencySlot | null>(null)
  const categoryButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const categoryFilterRef = useRef<HTMLDivElement | null>(null)

  const settings = tenant.tenant_settings
  const primaryColor = settings?.primary_color ?? BRAND_PRIMARY
  const accentColor = safeCssColor(settings?.accent_color, '#09090b')
  // Explicit price-text role, readable on both the menu ground and white sheets.
  const accentText = readableTextColor(accentColor)
  // "Order on WhatsApp" on each dish (any plan, needs a number).
  const whatsapp = capabilities.whatsappOrders ? settings?.whatsapp ?? null : null
  const currency = settings?.currency ?? 'USD'
  const deliveryFeeCents = settings?.delivery_fee_cents ?? 0
  const orderTypeConfig = atTable
    ? { dineIn: true, pickup: false, delivery: false, deliveryFeeCents }
    : { dineIn: capabilities.dineIn, pickup: capabilities.pickup, delivery: capabilities.delivery, deliveryFeeCents }
  const tipsEnabled = capabilities.tips
  // Sales tax and the promo field exist for guest checkout once the schema step ran (the rate is then a number).
  const taxPromoReady = capabilities.guestOrdering && typeof settings?.tax_rate_bps === 'number'
  const taxBps = taxPromoReady ? settings?.tax_rate_bps ?? 0 : 0
  const loyaltyOn = capabilities.guestOrdering && settings?.loyalty_enabled === true
  // Scheduled orders exist once the schema step ran (the switch is then a boolean), the restaurant turned them on
  // and its time zone is known; the dishes' notice only shows then too.
  const schedulingZone = capabilities.scheduledOrders && typeof settings?.scheduled_orders_enabled === 'boolean'
    ? resolveTimeZone({ country: settings?.country, region: settings?.region, currency: settings?.currency })
    : null
  const cartMaxNotice = Math.max(0, ...cart.map(item => item.product.min_notice_minutes ?? 0))
  const scheduling = useMemo(() => schedulingZone
    ? { hours: settings?.business_hours as Record<string, string | null | undefined> | null | undefined, timeZone: schedulingZone, prepMinutes: settings?.pickup_eta_minutes ?? 0, maxNoticeMinutes: cartMaxNotice }
    : null, [schedulingZone, settings?.business_hours, settings?.pickup_eta_minutes, cartMaxNotice])
  const noticeFor = (product: { min_notice_minutes?: number }) => capabilities.scheduledOrders ? product.min_notice_minutes ?? 0 : 0
  const analyticsEnabled = settings?.analytics_enabled ?? true
  const feedAutoplayVideos = settings?.feed_autoplay_videos ?? true
  const tipPercentages: [number, number, number] = [
    settings?.tip_percentage_1 ?? 15,
    settings?.tip_percentage_2 ?? 18,
    settings?.tip_percentage_3 ?? 20,
  ]
  const featured = products.filter(p => p.is_featured)
  const supportedLanguages = menu?.supported_languages?.length ? menu.supported_languages : [menu?.language ?? 'en']
  const copy = getMenuCopy(selectedLanguage)
  const guestCopy = getGuestCopy(selectedLanguage)
  const menuTitle = getTranslatedMenuField(menu, selectedLanguage, 'name', menu?.name ?? tenant.name)

  // The guest's language: ?lang= (also written on change, so a reload keeps
  // it), otherwise the phone's language when this menu offers it.
  function changeLanguage(lang: string) {
    // A dish page's own text is rendered on the server: it reloads in the new language.
    if (onDishPage) {
      try {
        const url = new URL(window.location.href)
        url.searchParams.set('lang', lang)
        window.location.assign(url.toString())
        return
      } catch {
        // falls through to the in-place switch
      }
    }
    setSelectedLanguage(lang)
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('lang', lang)
      window.history.replaceState(window.history.state, '', url.toString())
    } catch {
      // URL sync is best-effort
    }
  }
  useEffect(() => {
    // A dish page keeps the language its server-rendered text was written in.
    if (onDishPage || supportedLanguages.length < 2) return
    if (new URLSearchParams(window.location.search).has('lang')) return
    const match = matchDeviceLanguage(navigator.languages?.length ? navigator.languages : [navigator.language], supportedLanguages)
    if (match && match !== selectedLanguage) setSelectedLanguage(match)
    // Mount-only: a suggestion, never a fight with the guest's own choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    document.documentElement.lang = localeFor(selectedLanguage)
  }, [selectedLanguage])

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    if (new URLSearchParams(window.location.search).get('feed_preview') === '1') {
      setFeedPreview(true)
      setMenuView('feed')
    }
  }, [])

  useEffect(() => {
    if (activeMenuView !== 'feed') return
    const previousBodyOverflow = document.body.style.overflow
    const previousOverscroll = document.documentElement.style.overscrollBehavior
    const previousFeedState = document.body.dataset.menuFeed
    document.body.style.overflow = 'hidden'
    document.body.dataset.menuFeed = 'open'
    document.documentElement.style.overscrollBehavior = 'none'
    return () => {
      document.body.style.overflow = previousBodyOverflow
      if (previousFeedState === undefined) delete document.body.dataset.menuFeed
      else document.body.dataset.menuFeed = previousFeedState
      document.documentElement.style.overscrollBehavior = previousOverscroll
    }
  }, [activeMenuView])

  const narrowed = search !== ''
  const filtered = products.filter(p => {
    const matchSearch = search === '' ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description ?? '').toLowerCase().includes(search.toLowerCase())
    const matchCategory = !activeCategory || p.category_id === activeCategory
    return matchSearch && matchCategory
  })
  const feedProducts = filtered.filter(isProductVisibleInFeed)

  const categoryIds = new Set(categories.map(c => c.id))

  const groupedByCategory = categories.map(cat => ({
    category: cat,
    items: filtered.filter(p => p.category_id === cat.id),
  })).filter(g => g.items.length > 0)

  const uncategorized = filtered.filter(p => !p.category_id || !categoryIds.has(p.category_id))

  // Flat list in display order — used for prev/next navigation inside the product modal.
  const orderedProducts = [...groupedByCategory.flatMap(g => g.items), ...uncategorized]

  // Images load ahead of the guest, like a game streaming the next area (src/lib/media/prefetch-image.ts):
  // once the page is idle every list tile in display order, and the neighbours of an open dish.
  const warmOrder = [...featured, ...orderedProducts].map(p => getProductImages(p)[0]).join('|')
  useEffect(() => whenIdle(() => {
    for (const src of warmOrder.split('|').slice(0, 80)) prefetchImage(src, { variant: 'card' })
  }), [warmOrder])
  const selectedId = selectedProduct?.id
  const neighbourImages = (() => {
    const at = orderedProducts.findIndex(p => p.id === selectedId)
    return at < 0 ? '' : [at + 1, at - 1, at + 2].map(i => orderedProducts[i]).filter(Boolean).map(p => getProductImages(p)[0]).join('|')
  })()
  useEffect(() => {
    for (const src of neighbourImages.split('|')) prefetchImage(src)
  }, [neighbourImages])

  /** `item` names the dish with the choices made (ProductModal). */
  function openWhatsApp(item: string) {
    const url = whatsappUrl(whatsapp, fill(copy.whatsappMessage, { item }), settings)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  // The order type, delivery fields and tip actually sent: dine_in at a table,
  // and only what the plan and the restaurant allow (menu-session.ts).
  const orderFields = checkoutFields(
    { orderType, deliveryStreet, deliveryComplement, deliveryZipcode, deliveryCity, deliveryNotes, tipCents },
    capabilities,
    atTable,
  )
  const checkoutOrderType = orderFields.order_type

  // Suggestions belong to the cart and are expanded only by the guest.
  const [returnToCart, setReturnToCart] = useState(false)
  const cartSuggestions = useMemo(() => directOrdersEnabled && capabilities.upsell
    ? buildCartSuggestions({ cartProductIds: cart.map(item => item.product.id), products, categories })
    : [], [directOrdersEnabled, capabilities.upsell, cart, products, categories])

  function selectCartSuggestion(product: Product) {
    if (!directOrdersEnabled || !capabilities.upsell) return
    if (canQuickAdd(optionGroupsByProductId[product.id])) {
      addToCart(product, {}, product.price, undefined, null, null, 'upsell', 1)
      analyticsTracker?.track({ event_name: 'upsell_accepted', product_id: product.id, quantity: 1, source: 'cart' })
    } else {
      setReturnToCart(true)
      setCartOpen(false)
      openProduct(product, 'upsell')
    }
  }

  function openProduct(product: Product, source: 'grid' | 'featured' | 'detail' | 'cart' | 'feed' | 'upsell') {
    setSelectedProductSource(source)
    setSelectedProduct(product)
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  function addToCart(product: Product, selectedOptions: Record<string, unknown>, unitPrice: number, note?: string, ingredientModifications?: IngredientModifications | null, editorState?: CartEditorState | null, source?: 'grid' | 'featured' | 'detail' | 'cart' | 'feed' | 'upsell' | 'ar', quantity = 1, addedVia?: CartAddedVia) {
    const key = buildCartKey(product.id, selectedOptions)
    const amount = Math.max(1, Math.floor(quantity))
    const via = addedVia ?? (source === 'upsell' ? 'upsell' : undefined)
    setCart(prev => {
      const existing = prev.find(item => item.cartKey === key)
      if (existing) {
        return prev.map(item =>
          item.cartKey === key ? { ...item, quantity: item.quantity + amount, note: note ?? item.note, ingredientModifications: ingredientModifications ?? item.ingredientModifications, editorState: editorState ?? item.editorState, addedVia: item.addedVia ?? via } : item
        )
      }
      return [...prev, { product, quantity: amount, selectedOptions, unitPrice, cartKey: key, note, ingredientModifications, editorState, ...(via ? { addedVia: via } : {}) }]
    })
    analyticsTracker?.track({
      event_name: 'add_to_cart',
      product_id: product.id,
      quantity: amount,
      source: source ?? (selectedProduct?.id === product.id ? 'detail' : 'grid'),
    })
  }

  // Re-save an edited item: drop the original entry and re-insert under its new
  // cart key, preserving the original quantity. Merges into an identical existing
  // item instead of creating a duplicate.
  function replaceCartItem(oldKey: string, product: Product, selectedOptions: Record<string, unknown>, unitPrice: number, note?: string, ingredientModifications?: IngredientModifications | null, editorState?: CartEditorState | null) {
    const newKey = buildCartKey(product.id, selectedOptions)
    setCart(prev => {
      const old = prev.find(item => item.cartKey === oldKey)
      const qty = old?.quantity ?? 1
      const without = prev.filter(item => item.cartKey !== oldKey)
      const existing = without.find(item => item.cartKey === newKey)
      if (existing) {
        return without.map(item =>
          item.cartKey === newKey ? { ...item, quantity: item.quantity + qty, unitPrice, note, ingredientModifications, editorState } : item
        )
      }
      return [...without, { product, quantity: qty, selectedOptions, unitPrice, cartKey: newKey, note, ingredientModifications, editorState }]
    })
  }

  function editItem(itemCartKey: string) {
    const item = cart.find(i => i.cartKey === itemCartKey)
    if (!item) return
    setEditingCartKey(itemCartKey)
    openProduct(item.product, 'cart')
    setCartOpen(false)
  }

  function removeFromCart(itemCartKey: string) {
    const item = cart.find(cartItem => cartItem.cartKey === itemCartKey)
    if (item) {
      analyticsTracker?.track({
        event_name: 'remove_from_cart',
        product_id: item.product.id,
        quantity: item.quantity,
        source: 'cart',
      })
    }
    setCart(prev => prev.filter(item => item.cartKey !== itemCartKey))
  }

  function updateCartQuantity(itemCartKey: string, quantity: number) {
    const item = cart.find(cartItem => cartItem.cartKey === itemCartKey)
    if (quantity <= 0) {
      removeFromCart(itemCartKey)
      return
    }
    if (item && quantity !== item.quantity) {
      analyticsTracker?.track({
        event_name: quantity > item.quantity ? 'add_to_cart' : 'remove_from_cart',
        product_id: item.product.id,
        quantity: Math.abs(quantity - item.quantity),
        source: 'cart',
      })
    }
    setCart(prev =>
      prev.map(item =>
        item.cartKey === itemCartKey ? { ...item, quantity } : item
      )
    )
  }

  async function submitOrder() {
    if (!directOrdersEnabled) return
    if (!customerName.trim() || !customerPhone.trim()) {
      setOrderError(copy.errNamePhone)
      return
    }
    if (cart.length === 0) {
      setOrderError(copy.errCartEmpty)
      return
    }
    if (checkoutOrderType === 'delivery' && !deliveryStreet.trim()) {
      setOrderError(copy.errStreet)
      return
    }

    setSubmittingOrder(true)
    setOrderError(null)

    const receiptEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.email.trim()) ? contact.email.trim() : null

    // Same cart again (double tap, retry after a lost response) → same key,
    // so the server returns the order it already created.
    const orderPayload = {
      tenant_id: tenant.id,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      ...orderFields,
      ...(taxPromoReady && promo ? { promo_code: promo.code } : {}),
      ...(loyaltyOn && useReward && !promo ? { use_loyalty_reward: true } : {}),
      ...(scheduling && scheduledFor != null ? { scheduled_for: new Date(scheduledFor).toISOString() } : {}),
      // An address that is not plausible is left out rather than blocking the order.
      ...(receiptEmail ? { customer_email: receiptEmail } : {}),
      customer_language: selectedLanguage,
      marketing_sms_opt_in: contact.smsOptIn,
      marketing_email_opt_in: contact.emailOptIn && !!receiptEmail,
      location_id: location?.id ?? null,
      table_id: orderingTable ? orderingTable.id : undefined,
      menu_id: menu?.id ?? null,
      analytics_session_id: analyticsTracker?.sessionId ?? null,
      items: cart.map(item => ({
        product_id: item.product.id,
        product_name: baseName(item.product),
        quantity: item.quantity,
        unit_price: item.unitPrice,
        selected_options: item.selectedOptions,
        notes: item.note || undefined,
        ingredient_modifications: item.ingredientModifications || null,
        editor_state: item.editorState || null,
        added_via: item.addedVia,
      })),
    }
    orderAttemptRef.current = idempotencyKeyFor(orderAttemptRef.current, orderPayload)

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': orderAttemptRef.current.key },
        body: JSON.stringify(orderPayload),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data?.code === 'promo_invalid') {
          setPromo(null)
          throw new Error(copy.promoInvalid)
        }
        if (data?.code === 'schedule_invalid' && typeof data.error === 'string') throw new Error(data.error)
        throw new Error(copy.errSubmit)
      }
      // Placed: an identical cart later is a new order.
      orderAttemptRef.current = null

      // Customer (QR / public-menu) orders that require online payment skip the
      // "order placed" screen and go straight to the Stripe checkout. The order
      // already exists in 'awaiting_payment' and only reaches the kitchen once
      // the payment webhook flips it to 'paid'.
      if (data.requires_payment) {
        // The order now exists (awaiting payment): the cart and the form are
        // spent, so coming back to the menu must not offer them again.
        removeStored(browserStorage('local'), cartKey)
        removeStored(browserStorage('session'), screenKey)
        setCart([])
        router.push(`/checkout/${data.id}`)
        return
      }

      setConfirmedCart([...cart])
      setConfirmedScheduledFor(scheduling ? scheduledFor : null)
      setOrderId(data.id)
      setOrderSuccess(true)
      setCart([])
      setCustomerName('')
      setCustomerPhone('')
      setDeliveryStreet('')
      setDeliveryComplement('')
      setDeliveryZipcode('')
      setDeliveryCity('')
      setDeliveryNotes('')
      setOrderType(defaultOrderType)
      setTipCents(0)
      setPromo(null)
      setUseReward(false)
      setScheduledFor(null)
    } catch (error) {
      setOrderError(error instanceof Error && error.message ? error.message : copy.errSubmit)
    } finally {
      setSubmittingOrder(false)
    }
  }

  const hours = settings?.business_hours
  const hasHours = hours && Object.values(hours).some(Boolean)
  const email = contactEmailFor(tenant.slug)
  // Contact links normalized: "(555) 123-4567" → wa.me/5551234567, "@handle" or a URL → one Instagram link.
  const contacts = contactLinks(settings)
  const { orderOnlineUrl, reservationUrl } = resolveMenuActionLinks(settings, capabilities)
  const shownFooterBrand = visibleFooterBrand(footerBrand, settings)
  const review = googleReviewLink(settings?.google_review_url, selectedLanguage)
  const hasContact = !!(contacts.phone || contacts.instagram || contacts.whatsapp || settings?.address || email || orderOnlineUrl || reservationUrl)

  useEffect(() => {
    if (!menu?.id || !analyticsEnabled) return
    const isTest = new URLSearchParams(window.location.search).get('analytics_debug') === '1'
    setAnalyticsDebug(isTest)
    const tracker = new MenuAnalyticsTracker({
      tenantId: tenant.id,
      menuId: menu.id,
      locationId: location?.id ?? null,
      language: initialLanguage ?? menu.language,
      isTest,
    })
    setAnalyticsTracker(tracker)
    if (tracker.isNewSession) {
      tracker.track({ event_name: 'menu_session_started' })
      void tracker.flush()
    }
    return () => {
      tracker.destroy()
      setAnalyticsTracker(current => current === tracker ? null : current)
    }
  }, [tenant.id, menu?.id, menu?.language, location?.id, initialLanguage, analyticsEnabled])

  useEffect(() => {
    if (!analyticsTracker || !selectedProduct) return
    analyticsTracker.track({
      event_name: 'product_detail_opened',
      product_id: selectedProduct.id,
      source: selectedProductSource,
    })
  }, [analyticsTracker, selectedProduct, selectedProductSource])

  useEffect(() => {
    if (!analyticsTracker || !checkoutOpen) return
    analyticsTracker.track({ event_name: 'checkout_started', source: 'checkout' })
    void analyticsTracker.flush()
  }, [analyticsTracker, checkoutOpen])

  // Loyalty balance, read each time checkout opens (it changes when an order completes). Display only: the order re-checks it.
  useEffect(() => {
    if (!loyaltyOn || !checkoutOpen) return
    let cancelled = false
    fetch(`/api/loyalty?tenant_id=${encodeURIComponent(tenant.id)}`, { cache: 'no-store' })
      .then(response => (response.ok ? response.json() : null))
      .then((data: { enabled?: boolean; signed_in?: boolean; balance?: number; reward_points?: number; reward_cents?: number } | null) => {
        if (cancelled) return
        if (!data?.enabled) { setLoyalty(null); return }
        setLoyalty({ signedIn: data.signed_in === true, balance: Number(data.balance) || 0, rewardPoints: Number(data.reward_points) || 1, rewardCents: Number(data.reward_cents) || 0 })
      })
      .catch(() => { if (!cancelled) setLoyalty(null) })
    return () => { cancelled = true }
  }, [loyaltyOn, checkoutOpen, tenant.id])

  useEffect(() => {
    if (!analyticsTracker || !search.trim()) return
    const timeout = window.setTimeout(() => {
      analyticsTracker.track({
        event_name: 'search_performed',
        query_length: search.trim().length,
        source: 'search',
      })
    }, 500)
    return () => window.clearTimeout(timeout)
  }, [analyticsTracker, search])

  useEffect(() => {
    if (!analyticsTracker) return
    const timers = new Map<Element, ReturnType<typeof setTimeout>>()
    const engagement = new Map<string, {
      targets: Set<Element>
      startedAt: number | null
      accumulatedMs: number
      source: 'featured' | 'grid' | 'feed'
    }>()

    const readProduct = (element: Element) => {
      const htmlElement = element as HTMLElement
      const productId = htmlElement.dataset.analyticsProductId
      const source = htmlElement.dataset.analyticsSource === 'featured'
        ? 'featured' as const
        : htmlElement.dataset.analyticsSource === 'feed'
          ? 'feed' as const
          : 'grid' as const
      return productId ? { productId, source } : null
    }

    const pauseEngagement = (state: { startedAt: number | null; accumulatedMs: number }) => {
      if (state.startedAt === null) return
      state.accumulatedMs += performance.now() - state.startedAt
      state.startedAt = null
    }

    const emitEngagement = (productId: string, state: { startedAt: number | null; accumulatedMs: number; source: 'featured' | 'grid' | 'feed' }) => {
      pauseEngagement(state)
      const durationMs = Math.min(3_600_000, Math.round(state.accumulatedMs))
      if (durationMs >= 1_000) {
        analyticsTracker.track({
          event_name: 'product_engagement',
          product_id: productId,
          duration_ms: durationMs,
          source: state.source,
        })
      }
    }

    const startEngagement = (element: Element) => {
      const product = readProduct(element)
      if (!product) return
      const state = engagement.get(product.productId) ?? {
        targets: new Set<Element>(),
        startedAt: null,
        accumulatedMs: 0,
        source: product.source,
      }
      const wasEmpty = state.targets.size === 0
      state.targets.add(element)
      if (wasEmpty && document.visibilityState === 'visible') state.startedAt = performance.now()
      engagement.set(product.productId, state)
    }

    const stopEngagement = (element: Element) => {
      const product = readProduct(element)
      if (!product) return
      const state = engagement.get(product.productId)
      if (!state) return
      state.targets.delete(element)
      if (state.targets.size === 0) {
        emitEngagement(product.productId, state)
        engagement.delete(product.productId)
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        engagement.forEach(state => pauseEngagement(state))
        void analyticsTracker.flush(true)
      } else {
        const now = performance.now()
        engagement.forEach(state => {
          if (state.targets.size > 0 && state.startedAt === null) state.startedAt = now
        })
      }
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const existingTimer = timers.get(entry.target)
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          startEngagement(entry.target)
          if (existingTimer) continue
          const timer = setTimeout(() => {
            const product = readProduct(entry.target)
            if (product) analyticsTracker.trackProductImpression(product.productId, product.source)
            timers.delete(entry.target)
          }, 1_000)
          timers.set(entry.target, timer)
        } else {
          stopEngagement(entry.target)
          if (existingTimer) {
            clearTimeout(existingTimer)
            timers.delete(entry.target)
          }
        }
      }
    }, { threshold: [0, 0.5] })

    const elements = document.querySelectorAll('[data-analytics-product-id]')
    elements.forEach(element => observer.observe(element))
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      timers.forEach(timer => clearTimeout(timer))
      engagement.forEach((state, productId) => emitEngagement(productId, state))
      void analyticsTracker.flush(true)
    }
  }, [analyticsTracker, activeCategory, search, filtered.length, featured.length, activeMenuView])

  function selectCategory(sectionId: string) {
    const target = categoryRefs.current[sectionId]
    if (target) {
      const nav = categoryFilterRef.current?.closest('nav')
      const offset = (nav?.getBoundingClientRect().height ?? 0) + 8
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' })
    }
    setVisibleCategory(sectionId)
    if (sectionId !== FEATURED_TAB && sectionId !== OTHER_TAB) {
      analyticsTracker?.track({ event_name: 'category_selected', category_id: sectionId })
    }
  }

  // The current tab is the last section whose top has passed under the tab
  // bar — computed from the scroll position, so jumps and fast flicks agree.
  useEffect(() => {
    if (narrowed) {
      setVisibleCategory(null)
      return
    }
    let frame = 0
    const update = () => {
      frame = 0
      const nav = categoryFilterRef.current?.closest('nav')
      // At the very end of the page the last sections can't scroll up to the
      // bar; there the last one on screen is the current one.
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      const line = atEnd ? window.innerHeight * 0.85 : (nav?.getBoundingClientRect().bottom ?? 0) + 24
      let current: string | null = null
      let currentTop = -Infinity
      for (const [id, el] of Object.entries(categoryRefs.current)) {
        if (!el || !el.isConnected) continue
        const top = el.getBoundingClientRect().top
        if (top <= line && top > currentTop) {
          current = id
          currentTop = top
        }
      }
      setVisibleCategory(current)
    }
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [narrowed, groupedByCategory.length, uncategorized.length])

  useEffect(() => {
    if (!visibleCategory) return
    const button = categoryButtonRefs.current[visibleCategory]
    const container = categoryFilterRef.current
    if (!button || !container) return

    const containerRect = container.getBoundingClientRect()
    const buttonRect = button.getBoundingClientRect()

    if (buttonRect.left < containerRect.left || buttonRect.right > containerRect.right) {
      button.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [visibleCategory])

  useEffect(() => {
    const byId = new Map(products.map(p => [p.id, p]))
    setCart(prev => prev.some(item => byId.has(item.product.id) && byId.get(item.product.id) !== item.product)
      ? prev.map(item => ({ ...item, product: byId.get(item.product.id) ?? item.product }))
      : prev)
  }, [products])

  // ── Persistence across reloads (see menu-session.ts) ──────────────────────
  const cartKey = cartStorageKey(tenant.id, menu?.id)
  const screenKey = sessionStorageKey(tenant.id, menu?.id)
  const [restored, setRestored] = useState(false)
  const [feedIndex, setFeedIndex] = useState(0)

  // Restore once, after hydration (storage doesn't exist on the server).
  useEffect(() => {
    const now = Date.now()
    // Cut down to what this menu allows now: no checkout when guests can't
    // order, dine-in only at a table, no tip when tips are off.
    const screen = sanitizeScreenState(normalizeScreenState(readStored(browserStorage('session'), screenKey, now)), capabilities, atTable)
    const savedCart = directOrdersEnabled
      ? restoreCart(readStored<StoredCartItem[]>(browserStorage('local'), cartKey, now, CART_TTL_MS), products)
      : []

    if (savedCart.length) setCart(savedCart)
    if (screen.placedOrder) {
      setConfirmedCart(restoreCart(screen.placedOrder.items, products))
      setOrderId(screen.placedOrder.id)
      setOrderSuccess(true)
      setCheckoutOpen(true)
    } else if (savedCart.length) {
      setCartOpen(screen.cartOpen)
      setCheckoutOpen(screen.checkoutOpen)
    }
    if (screen.draft) {
      setCustomerName(screen.draft.customerName)
      setCustomerPhone(screen.draft.customerPhone)
      if (screen.draft.orderType) setOrderType(screen.draft.orderType)
      setDeliveryStreet(screen.draft.deliveryStreet)
      setDeliveryComplement(screen.draft.deliveryComplement)
      setDeliveryZipcode(screen.draft.deliveryZipcode)
      setDeliveryCity(screen.draft.deliveryCity)
      setDeliveryNotes(screen.draft.deliveryNotes)
      setTipCents(screen.draft.tipCents)
    }
    // A dish page shows its dish itself: a sheet left open on the menu does not reopen over it.
    const openProductAgain = screen.productId && !onDishPage ? products.find(p => p.id === screen.productId) : undefined
    if (openProductAgain) setSelectedProduct(openProductAgain)
    setFeedIndex(screen.feedIndex)
    setRestored(true)
    // Mount-only: later changes are written by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!restored) return
    if (cart.length) writeStored(browserStorage('local'), cartKey, serializeCart(cart), Date.now())
    else removeStored(browserStorage('local'), cartKey)
  }, [restored, cart, cartKey])

  useEffect(() => {
    if (!restored) return
    const draft = {
      customerName, customerPhone, orderType,
      deliveryStreet, deliveryComplement, deliveryZipcode, deliveryCity, deliveryNotes, tipCents,
    }
    writeStored(browserStorage('session'), screenKey, {
      cartOpen,
      checkoutOpen,
      productId: selectedProduct?.id ?? null,
      feedIndex,
      draft: isDraftEmpty(draft, defaultOrderType) ? null : draft,
      placedOrder: orderSuccess && orderId ? { id: orderId, items: serializeCart(confirmedCart) } : null,
    }, Date.now())
  }, [restored, screenKey, cartOpen, checkoutOpen, selectedProduct, feedIndex, customerName, customerPhone, orderType,
    deliveryStreet, deliveryComplement, deliveryZipcode, deliveryCity, deliveryNotes, tipCents, defaultOrderType,
    orderSuccess, orderId, confirmedCart])

  // Shareable dish link: ?dish=<id> opens that dish once (unknown ids are
  // ignored and dropped); while a dish is open the URL carries its id.
  const dishLinkChecked = useRef(false)
  useEffect(() => {
    if (!restored) return
    if (!dishLinkChecked.current) {
      dishLinkChecked.current = true
      const linked = findDishByParam(products, readDishParam(window.location.search))
      if (linked) {
        openProduct(linked, 'detail')
        return
      }
    }
    try {
      const next = withDishParam(window.location.href, selectedProduct?.id ?? null)
      if (next !== window.location.href) window.history.replaceState(window.history.state, '', next)
    } catch {
      // URL sync is best-effort
    }
    // openProduct only sets state; products are stable for a page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, selectedProduct])

  // The cart drawer's actual on-screen visibility (CartPanel uses the same
  // `cartOpen && !checkoutOpen`); the chat widget steps aside while it is open.
  const cartPanelVisible = directOrdersEnabled && cartOpen && !checkoutOpen
  const editingItem = editingCartKey ? cart.find(i => i.cartKey === editingCartKey) ?? null : null

  function closeProductModal() {
    if (returnToCart || editingCartKey) setCartOpen(true)
    setReturnToCart(false)
    setSelectedProduct(null)
    setSelectedProductSource('detail')
    setEditingCartKey(null)
  }

  // ── Presentation ───────────────────────────────────────────────────────────
  const onPrimary = computePrimaryForeground(primaryColor)
  const money = (value: number) => formatMoney(value, currency, selectedLanguage)
  // The AR camera's view of the cart: order sheet, this dish's count, its "−" and line total.
  const arOrder = arOrderSummary(cart, money)
  const arCartFor = (productId: string, onOpenCart: () => void) => ({
    quantity: dishQuantity(cart, productId),
    onRemove: () => {
      const line = lineToDecrement(cart, productId)
      if (line) updateCartQuantity(line.cartKey, line.quantity - 1)
    },
    lineLabel: money(cart.reduce((sum, item) => sum + (item.product.id === productId ? item.unitPrice * item.quantity : 0), 0)),
    summary: arOrder,
    onOpenCart,
  })
  // "From $15.00" for a dish whose sizes set the price (showcase.ts).
  const priceOf = (product: Product) => {
    const shown = displayPrice(product.price, optionGroupsByProductId[product.id])
    return {
      text: shown.from ? fill(guestCopy.fromPrice, { price: money(shown.amount) }) : money(shown.amount),
      from: shown.from,
      // Split for the dish card's price button: "From" on its own small line above the amount.
      amount: money(shown.amount),
      fromLabel: shown.from ? fill(guestCopy.fromPrice, { price: '' }).trim() : null,
    }
  }
  // The AR carousel: every dish with a 3D model, in menu order, with its own price, details and cart actions.
  const arSequence: ArSequenceItem[] = orderedProducts.filter(p => productArModelByProductId[p.id]).map(p => ({
    id: p.id,
    name: p.name,
    model: productArModelByProductId[p.id],
    priceLabel: priceOf(p).text,
    details: {
      description: p.description,
      ingredients: (productIngredientsByProductId[p.id] ?? []).filter(pi => pi.is_default).map(pi => pi.ingredient.name),
    },
    cart: directOrdersEnabled ? {
      ...arCartFor(p.id, () => { closeProductModal(); setCartOpen(true) }),
      // A dish with a required choice goes back to its sheet; any other is added as it is.
      mode: (optionGroupsByProductId[p.id] ?? []).some(group => group.required) ? 'choose' as const : 'add' as const,
      priceLabel: money(p.price),
      count: cartCount,
      onAdd: () => addToCart(p, {}, p.price, undefined, undefined, undefined, 'ar'),
      onChoose: () => openProduct(p, 'detail'),
    } : null,
    onMoreInfo: () => openProduct(p, 'detail'),
  }))

  // Every + (card, featured, feed, dish page) adds in one tap unless the dish has a required choice
  // (size, flavour...). Optional extras and ingredient removals stay in the dish window.
  const hasCustomization = (productId: string) => !canQuickAdd(optionGroupsByProductId[productId])

  // Open/closed is computed on the client only (it depends on "now").
  const [openInfo, setOpenInfo] = useState<{ state: ReturnType<typeof computeOpenState>['state']; todayIndex: number | null } | null>(null)
  useEffect(() => {
    // The restaurant's zone from its profile, else the guest's own.
    let deviceZone: string | null = null
    try { deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null } catch { deviceZone = null }
    const timeZone = menuTimeZone(resolveTimeZone({ country: settings?.country, region: settings?.region, currency }), deviceZone)
    const update = () => {
      const result = computeOpenState(hours as Record<string, string | null | undefined> | null | undefined, new Date(), timeZone)
      setOpenInfo({ state: result.state, todayIndex: result.todayIndex })
    }
    update()
    const timer = window.setInterval(update, 60_000)
    return () => window.clearInterval(timer)
  }, [hours, settings?.country, settings?.region, currency])
  const openLabel: OpenLabel | null = openInfo ? describeOpenState(openInfo.state, copy, guestCopy, selectedLanguage) : null

  // The price range ($$) stays in settings for SEO and the chat, but is not shown to guests.
  const contextParts = [menuTitle !== tenant.name ? menuTitle : null, settings?.business_type]
    .filter((part): part is string => !!part && !!part.trim())

  const tabs: Array<{ id: string; label: string }> = [
    ...(featured.length > 0 && !narrowed ? [{ id: FEATURED_TAB, label: copy.featured }] : []),
    ...groupedByCategory.map(({ category }) => ({ id: category.id, label: category.name })),
    ...(uncategorized.length > 0 ? [{ id: OTHER_TAB, label: copy.other }] : []),
  ]
  const activeTab = visibleCategory ?? tabs[0]?.id ?? null
  const showOrderBar = directOrdersEnabled && cart.length > 0 && !cartOpen && !checkoutOpen && activeMenuView === 'list'
  const showContactFooter = true
  // The restaurant's menus, as a switcher under its name (branches and pages stay in the footer).
  const menuLinks = navigationLinks.filter(link => link.kind === 'menu')
  // The restaurant's home as a path on this host: "/" on its own domain, "/slug" on the platform.
  const restaurantHome = (() => { try { return canonicalBaseUrl ? new URL(canonicalBaseUrl).pathname || '/' : `/${tenant.slug}` } catch { return `/${tenant.slug}` } })()
  // Each public dish card is a real link to its dish page (crawlable), opened here as the dish window.
  const dishHref = (product: Product) => !feedPreview && canonicalBaseUrl && menu?.slug && menu.is_private === false && isIndexableDish(product)
    ? `${canonicalBaseUrl.replace(/\/$/, '')}/${menu.slug}/${dishSlug(product)}` : undefined
  const menusLabel = ({ en: 'Menus', pt: 'Cardápios', es: 'Cartas' } as Record<string, string>)[selectedLanguage.split('-')[0]] ?? 'Menus'

  // The order as a dish page's DishCartButton sees it: the plain dish goes straight in, like the
  // + on a card; a dish with choices opens its sheet.
  const productById = (productId: string) => products.find(p => p.id === productId)
  const dishPageCart: DishPageCart | null = onDishPage ? {
    enabled: directOrdersEnabled,
    needsChoices: hasCustomization,
    quantity: productId => cart.find(item => item.cartKey === buildCartKey(productId, {}))?.quantity ?? 0,
    add: productId => {
      const product = productById(productId)
      if (product) addToCart(product, {}, product.price, undefined, undefined, undefined, 'detail')
    },
    decrease: productId => {
      const key = buildCartKey(productId, {})
      const quantity = cart.find(item => item.cartKey === key)?.quantity ?? 0
      if (quantity > 0) updateCartQuantity(key, quantity - 1)
    },
    choose: productId => {
      const product = productById(productId)
      if (product) openProduct(product, 'detail')
    },
    openCart: () => setCartOpen(true),
    primaryColor,
    onPrimary,
    copy: { addToOrder: copy.addToOrder, decrease: copy.decrease, increase: copy.increase, viewOrder: copy.viewOrder, addNamed: copy.addNamed },
  } : null

  return (
    <DishPageCartContext.Provider value={dishPageCart}>
    <div className="menu-root min-h-screen bg-menu text-zinc-900" lang={localeFor(selectedLanguage)}>
      {/* Header: banner, then identity with the logo overlapping its edge */}
      <header className="relative">
        <div
          className="relative h-[140px] overflow-hidden sm:h-64"
          style={!settings?.banner_url ? { background: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 26%, white), color-mix(in srgb, ${primaryColor} 8%, white))` } : undefined}
        >
          {settings?.banner_url && (
            <>
              <DeliveryImage src={settings.banner_url} alt="" fill priority sizes="100vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/10" />
            </>
          )}
        </div>
        {/* Outside the banner (which clips) so the language list can drop below it. No
            z-index here: the picker raises itself above the sticky category bar only while open. */}
        <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 flex items-center gap-2 sm:right-5 sm:top-5">
          {feedEnabled && (
            <button
              type="button"
              onClick={() => changeView('feed')}
              className="flex h-10 items-center gap-1.5 rounded-full bg-white/95 pl-3 pr-3.5 text-[14px] font-medium text-zinc-900 shadow-sm transition-[scale] active:scale-95 md:hidden"
            >
              <Clapperboard className="size-4" aria-hidden="true" />
              <span>{copy.viewFeed}</span>
            </button>
          )}
          <PageLinksMenu tenantSlug={tenant.slug} links={pageLinks} label={copy.pagesMore} />
          {supportedLanguages.length > 1 && (
            <LanguagePicker languages={supportedLanguages} value={selectedLanguage} onChange={changeLanguage} label={copy.language} />
          )}
        </div>

        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          {/* The logo and the name go back to the restaurant's home. */}
          <a href={restaurantHome} aria-label={tenant.name} className="relative -mt-9 block size-[72px] overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5 transition-[scale] active:scale-95 sm:-mt-12 sm:size-24">
            {settings?.logo_url ? (
              <DeliveryImage src={settings.logo_url} alt="" fill priority sizes="96px" className="object-contain p-2" />
            ) : (
              <div className="flex size-full items-center justify-center text-xl font-semibold text-zinc-700">{getInitials(tenant.name)}</div>
            )}
          </a>
          {(() => {
            // On a dish page the dish is the page's h1; the restaurant keeps the same look.
            const Name = onDishPage ? 'p' : 'h1'
            return <Name className="mt-3 text-[26px] font-bold leading-tight tracking-tight text-zinc-900 sm:text-[32px]"><a href={restaurantHome} className="hover:underline hover:decoration-2 hover:underline-offset-4">{tenant.name}</a></Name>
          })()}
          {(contextParts.length > 0 || openLabel || hasHours) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-zinc-500">
              {contextParts.map((part, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden="true">·</span>}
                  {part}
                </span>
              ))}
              {(openLabel || hasHours) && (
                <>
                  {contextParts.length > 0 && <span aria-hidden="true">·</span>}
                  <button
                    type="button"
                    onClick={() => setShowHoursModal(true)}
                    disabled={!hasHours}
                    className={`inline-flex min-w-0 items-center gap-1.5 text-left font-medium ${openLabel?.tone === 'open' ? 'text-emerald-700' : 'text-zinc-600'} enabled:hover:underline`}
                  >
                    {openLabel && openLabel.tone !== 'info' && <span aria-hidden="true" className={`size-[7px] shrink-0 rounded-full ${openLabel.tone === 'open' ? 'bg-emerald-500' : 'bg-zinc-400'}`} />}
                    {openLabel ? openLabel.text : copy.hoursTitle}
                  </button>
                </>
              )}
            </div>
          )}
          {(orderingTable ?? waiterCallTable) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <p className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[14px] font-semibold text-zinc-900 shadow-card">
                <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: primaryColor }} />
                <span className="font-medium text-zinc-500">{copy.yourTable}</span>
                {(orderingTable ?? waiterCallTable)!.name}
              </p>
              {waiterCallTable && (
                <WaiterCallButtons slug={tenant.slug} tableId={waiterCallTable.id} copy={getGuestCopy(selectedLanguage)} primaryColor={primaryColor} />
              )}
            </div>
          )}
          {settings?.tagline && (
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-zinc-600">{settings.tagline}</p>
          )}
          {menuLinks.length > 1 && (
            <nav aria-label={menusLabel} className="-mx-5 mt-2 overflow-x-auto px-5 py-2 [scrollbar-width:none] sm:-mx-2 sm:px-2 [&::-webkit-scrollbar]:hidden">
              <ul className="flex w-max gap-2">
                {menuLinks.map(link => {
                  const current = link.title === menu?.name
                  return <li key={link.href}>
                    <a href={link.href} aria-current={current ? 'page' : undefined}
                      className={`inline-flex h-10 items-center whitespace-nowrap rounded-full px-4 text-[14px] font-semibold transition-[background-color,box-shadow,scale] active:scale-[0.97] ${current ? 'shadow-[0_2px_8px_rgb(0_0_0/0.12)]' : 'bg-white text-zinc-800 shadow-[0_1px_4px_rgb(0_0_0/0.08)] ring-1 ring-black/[0.06] hover:bg-zinc-50'}`}
                      style={current ? { backgroundColor: primaryColor, color: onPrimary } : undefined}>
                      {link.title}
                    </a>
                  </li>
                })}
              </ul>
            </nav>
          )}
        </div>
      </header>

      {/* Sticky category tabs */}
      {activeMenuView === 'list' && !onDishPage && (tabs.length > 0 || showSearch) && (
        <nav className="sticky top-0 z-30 mt-5 border-b border-zinc-200/70 bg-menu/90 backdrop-blur-md" aria-label={copy.viewMenu}>
          <div className="mx-auto flex max-w-5xl items-center px-2 sm:px-6">
            {showSearch ? (
              <div className="flex h-14 min-w-0 flex-1 items-center gap-2 px-3">
                <Search className="size-[18px] shrink-0 text-zinc-500" aria-hidden="true" />
                <input
                  autoFocus
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  // The keyboard's Search key puts the keyboard away so the results can be seen.
                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                  placeholder={copy.search}
                  aria-label={copy.search}
                  className="h-10 min-w-0 flex-1 bg-transparent text-[16px] text-zinc-900 outline-none placeholder:text-zinc-500"
                />
              </div>
            ) : (
              <div ref={categoryFilterRef} className="scrollbar-hide flex h-14 min-w-0 flex-1 items-stretch gap-6 overflow-x-auto px-3">
                {tabs.map(tab => {
                  const active = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      ref={el => { categoryButtonRefs.current[tab.id] = el }}
                      onClick={() => selectCategory(tab.id)}
                      aria-current={active ? 'true' : undefined}
                      className={`relative flex shrink-0 items-center whitespace-nowrap text-[15px] font-medium transition-colors ${active ? 'text-zinc-900' : 'text-zinc-600 hover:text-zinc-900'}`}
                    >
                      {tab.label}
                      {active && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2.5px] rounded-full" style={{ backgroundColor: primaryColor }} />}
                    </button>
                  )
                })}
              </div>
            )}
            <button
              type="button"
              onClick={() => { if (showSearch) { setShowSearch(false); setSearch('') } else { setShowSearch(true) } }}
              aria-label={showSearch ? copy.searchClose : copy.searchOpen}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-zinc-700 transition-colors hover:bg-zinc-200/60"
            >
              {showSearch ? <X className="size-5" /> : <Search className="size-5" />}
            </button>
            <GuestAccountButton slug={tenant.slug} primaryColor={primaryColor} copy={copy} lang={selectedLanguage} locale={localeFor(selectedLanguage)} phoneContext={{ country: settings?.country, currency }} bannerUrl={settings?.banner_url} logoUrl={settings?.logo_url} restaurantName={tenant.name} />
          </div>
        </nav>
      )}

      {/* Featured: a quiet row you swipe yourself */}
      {activeMenuView === 'list' && !onDishPage && featured.length > 0 && !narrowed && (
        <section
          ref={el => { categoryRefs.current[FEATURED_TAB] = el }}
          data-category-id={FEATURED_TAB}
          className="w-full scroll-mt-16 pt-6 sm:pt-8"
        >
          <h2 className={`mx-auto max-w-5xl px-5 text-zinc-900 sm:px-8 ${ui.sectionTitle}`}>{copy.featured}</h2>
          <FeaturedCarousel
            className="mt-3 px-5 pb-2 sm:px-8"
            items={clone => featured.map(p => {
              const image = getProductImages(p)[0]
              const feature = dishFeature(p)
              const key = buildCartKey(p.id, {})
              const needsChoice = hasCustomization(p.id)
              const qty = needsChoice ? 0 : cart.find(i => i.cartKey === key)?.quantity ?? 0
              return (
                // Same pieces as the grid card: the photo carries the tag pill and the
                // 3D cube, and the + sits beside the price, off the photo.
                <div
                  key={p.id}
                  {...(clone ? {} : { 'data-analytics-product-id': p.id, 'data-analytics-source': 'featured' })}
                  className="relative w-[156px] shrink-0 sm:w-[220px]"
                  onPointerEnter={() => prefetchImage(image, { urgent: true })}
                >
                  <button
                    type="button"
                    tabIndex={clone ? -1 : undefined}
                    aria-label={p.name}
                    onClick={() => openProduct(p, 'featured')}
                    className="absolute inset-0 z-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/30"
                  />
                  <div className="pointer-events-none relative aspect-[4/3] overflow-hidden rounded-2xl bg-zinc-100">
                    {image
                      ? <DishPhoto variant="card" src={image} alt="" fit="cover" sizes="(max-width: 640px) 156px, 220px" />
                      : <DishPlaceholder />}
                    {feature && (
                      <div className="absolute inset-x-2 top-2 flex">
                        <DishFeaturePill tag={feature} lang={selectedLanguage} tone={image ? 'glass' : 'solid'} className="max-w-full" />
                      </div>
                    )}
                    {productArModelByProductId[p.id] && (
                      <ArBadge lang={selectedLanguage} className="absolute bottom-2 left-2 flex size-6 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm" />
                    )}
                  </div>
                  <p className={`pointer-events-none mt-2 line-clamp-2 text-[14px] text-zinc-900 sm:text-[15px] ${ui.dishTitleCompact}`}>{p.name}</p>
                  <div className="pointer-events-none mt-0.5 flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[14px] font-bold tabular-nums" style={{ color: accentText }}>{priceOf(p).text}</p>
                    {directOrdersEnabled && (
                      <button
                        type="button"
                        tabIndex={clone ? -1 : undefined}
                        // A dish with a required choice opens its sheet instead of
                        // going into the order without them.
                        onClick={() => needsChoice ? openProduct(p, 'featured') : addToCart(p, {}, p.price, undefined, undefined, undefined, 'featured')}
                        aria-label={fill(copy.addNamed, { name: p.name })}
                        className="pointer-events-auto relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-900 transition-colors hover:bg-zinc-200 active:bg-zinc-200"
                      >
                        <Plus className="size-[18px] shrink-0" strokeWidth={2.5} aria-hidden="true" />
                        {qty > 0 && (
                          <span
                            className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums"
                            style={{ backgroundColor: primaryColor, color: onPrimary }}
                            aria-hidden="true"
                          >
                            {qty}
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          />
        </section>
      )}

      {onDishPage ? (
        <main className="mx-auto max-w-5xl px-5 pt-6 sm:px-8 sm:pt-8">{dishPage}</main>
      ) : <main
        className="mx-auto max-w-5xl space-y-8 px-4 pt-6 sm:px-8 sm:pt-8"
        style={{ paddingBottom: showContactFooter ? 0 : showOrderBar ? 112 : 48 }}
      >
        {activeMenuView === 'list' && filtered.length === 0 && (
          <div className="py-20 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-zinc-100">
              <Search className="size-6 text-zinc-400" />
            </div>
            <p className="mt-4 text-[17px] font-semibold text-zinc-900">{copy.noItems}</p>
            <p className="mt-1 text-[15px] text-zinc-500">{copy.tryAnother}</p>
          </div>
        )}

        {activeMenuView === 'feed' && feedProducts.length > 0 && restored ? (
          <MenuFeed
            products={feedProducts}
            productMediaByProductId={productMediaByProductId}
            currency={currency}
            lang={selectedLanguage}
            primaryColor={primaryColor}
            accentColor={accentColor}
            autoplayVideos={feedAutoplayVideos}
            directOrdersEnabled={directOrdersEnabled}
            cartCount={cartCount}
            arOrder={arOrder}
            arSequence={arSequence}
            onAddFromAr={product => addToCart(product, {}, product.price, undefined, undefined, undefined, 'ar')}
            exitLabel={copy.viewMenu}
            onExit={() => changeView('list')}
            initialIndex={feedIndex}
            onIndexChange={setFeedIndex}
            onOpenCart={() => setCartOpen(true)}
            hasCustomization={hasCustomization}
            detailsFor={product => dishDetailsFor(tenant.slug, product)}
            extraImagesFor={product => extraDishImagesFor(tenant.slug, product)}
            sizesFor={product => feedSizes(product.price, optionGroupsByProductId[product.id])}
            quantityFor={productId => cart.find(item => item.cartKey === buildCartKey(productId, {}))?.quantity ?? 0}
            onOpen={product => openProduct(product, 'feed')}
            onAdd={(product, size) => {
              if (size) addToCart(product, size.selectedOptions, size.price, undefined, undefined, size.editorState, 'feed')
              else addToCart(product, {}, product.price, undefined, undefined, undefined, 'feed')
            }}
            onIncrement={product => {
              const key = buildCartKey(product.id, {})
              const quantity = cart.find(item => item.cartKey === key)?.quantity ?? 0
              updateCartQuantity(key, quantity + 1)
            }}
            onDecrement={product => {
              const key = buildCartKey(product.id, {})
              const quantity = cart.find(item => item.cartKey === key)?.quantity ?? 0
              updateCartQuantity(key, quantity - 1)
            }}
            priceLabel={product => priceOf(product).text}
            arModelFor={product => productArModelByProductId[product.id] ?? null}
            onArOpened={product => analyticsTracker?.track({ event_name: 'model_viewer_opened', product_id: product.id, source: 'feed' })}
            onArLaunched={product => analyticsTracker?.track({ event_name: 'ar_launched', product_id: product.id, source: 'feed' })}
            onMediaEvent={(eventName, product, mediaType, mediaIndex) => analyticsTracker?.track({
              event_name: eventName,
              product_id: product.id,
              source: 'feed',
              media_type: mediaType,
              media_index: mediaIndex,
            })}
          />
        ) : activeMenuView === 'feed' ? (
          <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-zinc-950 px-6 text-center text-white md:hidden" role="status">
            <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-white/10">
              <Sparkles className="size-7 text-white/70" />
            </div>
            <h3 className="text-xl font-semibold tracking-tight">{copy.feedEmptyTitle}</h3>
            <p className="mx-auto mt-2 max-w-sm text-[15px] text-white/60">{copy.feedEmptyDescription}</p>
            <button
              type="button"
              onClick={() => changeView('list')}
              style={{ backgroundColor: primaryColor, color: onPrimary }}
              className="mt-6 h-12 rounded-2xl px-6 text-[15px] font-semibold transition-[scale] active:scale-95"
            >
              {copy.viewMenu}
            </button>
          </div>
        ) : activeMenuView === 'list' ? (
          <>
            {[...groupedByCategory.map(({ category, items }) => ({ id: category.id, title: category.name, description: category.description, items })),
              ...(uncategorized.length > 0 ? [{ id: OTHER_TAB, title: copy.other, description: null as string | null, items: uncategorized }] : []),
            ].map(section => (
              <section
                key={section.id}
                ref={el => { categoryRefs.current[section.id] = el }}
                data-category-id={section.id}
                className="scroll-mt-16"
              >
                <h2 className={`px-1 text-zinc-900 ${ui.sectionTitle}`}>{section.title}</h2>
                {section.description && <p className="mt-0.5 px-1 text-[14px] text-zinc-500">{section.description}</p>}
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                  {section.items.map(p => {
                    const key = buildCartKey(p.id, {})
                    const qty = cart.find(i => i.cartKey === key)?.quantity ?? 0
                    const needsChoice = hasCustomization(p.id)
                    return (
                      <ProductCard
                        key={p.id}
                        product={p}
                        lang={selectedLanguage}
                        currency={currency}
                        primaryColor={primaryColor}
                        accentColor={accentColor}
                        accentText={accentText}
                        price={priceOf(p)}
                        hasArModel={!!productArModelByProductId[p.id]}
                        noticeMinutes={noticeFor(p)}
                        href={dishHref(p)}
                        onOpen={() => openProduct(p, 'grid')}
                        {...(directOrdersEnabled ? {
                          cartQuantity: needsChoice ? 0 : qty,
                          // A dish with a required choice opens its sheet instead of
                          // going into the order without them.
                          onAdd: needsChoice ? () => openProduct(p, 'grid') : () => addToCart(p, {}, p.price),
                          onIncrement: () => updateCartQuantity(key, qty + 1),
                          onDecrement: () => updateCartQuantity(key, qty - 1),
                        } : {})}
                      />
                    )
                  })}
                </div>
              </section>
            ))}
          </>
        ) : null}
      </main>}

      {/* Contact and credits: tappable cards (call, WhatsApp, Instagram, email, map), then the credit line */}
      {showContactFooter && (
        <footer className="mt-8 border-t border-zinc-200/70" style={{ marginBottom: showOrderBar ? 88 : 0 }}>
          <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
            {hasContact && (
              <>
                <h2 className={`text-zinc-900 ${ui.sectionTitle}`}>{copy.contactTitle}</h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {orderOnlineUrl && (
                    <ContactCard href={orderOnlineUrl} external icon={<ShoppingBag className="size-[18px]" />} caption={copy.contactOrderOnline} value={linkHost(orderOnlineUrl)} color={primaryColor} />
                  )}
                  {reservationUrl && (
                    <ContactCard href={reservationUrl} external icon={<CalendarCheck className="size-[18px]" />} caption={copy.contactReserve} value={linkHost(reservationUrl)} color={primaryColor} />
                  )}
                  {contacts.phone && (
                    <ContactCard href={contacts.phone.url} icon={<Phone className="size-[18px]" />} caption={copy.contactPhone} value={contacts.phone.label} color={primaryColor} numeric />
                  )}
                  {contacts.whatsapp && contacts.whatsappLabel && (
                    <ContactCard href={contacts.whatsapp} external icon={<MessageCircle className="size-[18px]" />} caption="WhatsApp" value={contacts.whatsappLabel} color={primaryColor} numeric />
                  )}
                  {contacts.instagram && (
                    <ContactCard href={contacts.instagram.url} external icon={<Instagram className="size-[18px]" />} caption="Instagram" value={contacts.instagram.handle} color={primaryColor} />
                  )}
                  {email && (
                    <ContactCard href={`mailto:${email}`} icon={<Mail className="size-[18px]" />} caption={copy.contactEmail} value={email} color={primaryColor} />
                  )}
                  {settings?.address && (
                    <ContactCard href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`} external icon={<MapPin className="size-[18px]" />} caption={copy.contactAddress} value={settings.address} color={primaryColor} wrap />
                  )}
                </ul>
              </>
            )}
            <address className="mt-6 space-y-1 text-sm not-italic text-zinc-600">
              <p className="font-medium text-zinc-800">{publicNap?.name ?? tenant.name}</p>
              <p>{[publicNap ? publicNap.address : settings?.address, publicNap ? publicNap.city : settings?.city].filter(Boolean).join(', ')}</p>
              {(publicNap ? publicNap.phone : settings?.phone) && <p>{phoneLabel(publicNap ? publicNap.phone : settings?.phone, { country: settings?.country, currency })}</p>}
            </address>
            {review && <a href={review.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-medium text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline">{review.label}</a>}
            {(pageLinks.length > 0 || navigationLinks.some(link => link.kind !== 'menu')) && (
              <nav aria-label={copy.pagesMore} className={hasContact ? 'mt-6' : ''}>
                <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[15px] font-medium">
                  {navigationLinks.filter(link => link.kind !== 'menu' && !(canonicalBaseUrl && menu?.slug && link.href.startsWith(`${canonicalBaseUrl}/${menu.slug}/`))).map(link => <li key={link.href}><a href={link.href} className="text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline">{link.title}</a></li>)}
                  {pageLinks.map(link => (
                    <li key={link.slug}><a href={`${canonicalBaseUrl ?? `/${tenant.slug}`}/${link.slug}`} className="text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline">{link.title}</a></li>
                  ))}
                </ul>
              </nav>
            )}
            {shownFooterBrand && (
              <p className={`flex items-center gap-1 text-[12px] text-zinc-500 ${hasContact || pageLinks.length > 0 ? 'mt-8' : ''}`}>
                {copy.poweredBy}
                <a href="/" className="inline-flex items-center gap-1 font-semibold text-zinc-600 hover:text-zinc-900">
                  {/* The platform symbol only sits beside the platform's own name. */}
                  {shownFooterBrand === BRAND_NAME && (
                    <Image src="/brand/xprout/v1/icon-192.png" alt="" width={15} height={15} className="size-[15px] shrink-0 rounded-[4px]" />
                  )}
                  {shownFooterBrand}
                </a>
              </p>
            )}
          </div>
        </footer>
      )}

      {/* Order bar: floating, in the restaurant's colour */}
      {showOrderBar && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          style={{ backgroundColor: primaryColor, color: onPrimary }}
          className="menu-order-bar-in fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex h-14 items-center justify-between rounded-2xl px-4 shadow-float transition-[scale] active:scale-[0.98] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:min-w-[320px]"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-black/15 px-1.5 text-[13px] font-bold tabular-nums">{cartCount}</span>
            <span className="text-[15px] font-semibold">{copy.viewOrder}</span>
          </span>
          <span className="text-[15px] font-semibold tabular-nums">{money(cartTotal)}</span>
        </button>
      )}

      {/* Modals */}
      {selectedProduct && (() => {
        const shownProduct = products.find(p => p.id === selectedProduct.id) ?? selectedProduct
        const navIndex = orderedProducts.findIndex(p => p.id === selectedProduct.id)
        const prevProduct = navIndex > 0 ? orderedProducts[navIndex - 1] : null
        const nextProduct = navIndex >= 0 && navIndex < orderedProducts.length - 1 ? orderedProducts[navIndex + 1] : null
        return (
        <ProductModal
          product={shownProduct}          details={dishDetailsFor(tenant.slug, shownProduct)}
          extraImages={extraDishImagesFor(tenant.slug, shownProduct)}
          onPrevProduct={!editingCartKey && !returnToCart && prevProduct ? () => openProduct(prevProduct, 'detail') : undefined}
          onNextProduct={!editingCartKey && !returnToCart && nextProduct ? () => openProduct(nextProduct, 'detail') : undefined}
          primaryColor={primaryColor}
          accentColor={accentColor}
          priceColor={accentText}
          currency={currency}
          whatsapp={whatsapp}
          lang={selectedLanguage}
          onClose={closeProductModal}
          onWhatsApp={openWhatsApp}
          showcase={!directOrdersEnabled}
          optionGroups={optionGroupsByProductId[selectedProduct.id] ?? []}
          itemNotesEnabled={capabilities.itemNotes}
          ingredientCustomizationEnabled={ingredientCustomizationEnabled}
          productIngredients={productIngredientsByProductId[selectedProduct.id] ?? []}
          productMedia={productMediaByProductId[selectedProduct.id] ?? []}
          arModel={productArModelByProductId[selectedProduct.id] ?? null}
          noticeMinutes={noticeFor(shownProduct)}
          cartCount={cartCount}
          arCart={directOrdersEnabled ? arCartFor(selectedProduct.id, () => { closeProductModal(); setCartOpen(true) }) : undefined}
          arSequence={arSequence}
          onAddToCartFromAr={directOrdersEnabled
            // The camera stays open: no closing the sheet, no "Complete your order".
            ? (selectedOptions, unitPrice, note, ingredientModifications, editorState) =>
                addToCart(selectedProduct, selectedOptions, unitPrice, note, ingredientModifications, editorState, 'ar')
            : undefined}
          onModelViewerOpened={() => analyticsTracker?.track({
            event_name: 'model_viewer_opened',
            product_id: selectedProduct.id,
            source: 'detail',
          })}
          onArLaunched={() => analyticsTracker?.track({
            event_name: 'ar_launched',
            product_id: selectedProduct.id,
            source: 'detail',
          })}
          initialEditorState={editingItem?.editorState ?? null}
          cartQuantityFor={directOrdersEnabled ? options => cart.find(item => item.cartKey === buildCartKey(selectedProduct.id, options))?.quantity ?? 0 : undefined}
          onDecreaseCartQuantity={directOrdersEnabled ? options => {
            const key = buildCartKey(selectedProduct.id, options)
            const item = cart.find(line => line.cartKey === key)
            if (item) updateCartQuantity(key, item.quantity - 1)
          } : undefined}
          onOpenCart={directOrdersEnabled ? () => { closeProductModal(); setCartOpen(true) } : undefined}
          onCustomizationStarted={directOrdersEnabled ? () => analyticsTracker?.track({
            event_name: 'product_customization_started',
            product_id: selectedProduct.id,
            source: selectedProductSource === 'feed' ? 'feed' : 'detail',
          }) : undefined}
          onAddToCart={directOrdersEnabled
            ? (selectedOptions, unitPrice, note, ingredientModifications, editorState, quantity) => {
                if (editingCartKey) {
                  replaceCartItem(editingCartKey, selectedProduct, selectedOptions, unitPrice, note, ingredientModifications, editorState)
                  closeProductModal()
                } else if (selectedProductSource === 'upsell') {
                  addToCart(selectedProduct, selectedOptions, unitPrice, note, ingredientModifications, editorState, 'upsell', quantity ?? 1)
                  analyticsTracker?.track({ event_name: 'upsell_accepted', product_id: selectedProduct.id, quantity: quantity ?? 1, source: 'cart' })
                } else {
                  addToCart(selectedProduct, selectedOptions, unitPrice, note, ingredientModifications, editorState, undefined, quantity ?? 1)
                }
              }
            : undefined}
        />
        )
      })()}

      {chatAddonEnabled && activeMenuView === 'list' && (
        <AiChatWidget
          tenantSlug={tenant.slug}
          tenantName={tenant.name}
          primaryColor={primaryColor}
          audioEnabled={chatAddonAudioEnabled}
          textEnabled={chatAddonTextEnabled}
          products={baseProducts}
          onAddToCart={(product, options, unitPrice, note, mods, editorState) => { if (directOrdersEnabled) addToCart(product, options, unitPrice, note, mods, editorState, undefined, 1, 'chat') }}
          menuId={menu?.id ?? null}
          locationId={location?.id ?? null}
          cartOpen={cartPanelVisible}
          orderBarVisible={showOrderBar}
          onOpenCart={directOrdersEnabled ? () => setCartOpen(true) : undefined}
          language={selectedLanguage}
          phoneContext={{ country: settings?.country, currency }}
          locale={localeFor(selectedLanguage)}
          cart={directOrdersEnabled ? cart.map(i => ({ name: i.product.name, quantity: i.quantity, options: summarizeOptions(i.selectedOptions) || undefined })) : null}
          canOrder={directOrdersEnabled}
          tableId={waiterCallTable?.id ?? orderingTable?.id ?? null}
        />
      )}

      {analyticsDebug ? (
        <AnalyticsDebugPanel
          sessionId={analyticsTracker?.sessionId ?? null}
          onClose={() => setAnalyticsDebug(false)}
        />
      ) : null}

      {/* Opening hours: a bottom sheet like the order and checkout (drag down, Escape or a tap outside closes it). */}
      <BottomSheet open={showHoursModal} onClose={() => setShowHoursModal(false)} ariaLabel={copy.hoursTitle} widthClassName="sm:max-w-[420px]">
        <div lang={localeFor(selectedLanguage)} className="flex min-h-0 flex-1 flex-col bg-white">
          <div data-sheet-grip className="flex shrink-0 touch-none items-center justify-between px-5 pt-1 pb-2">
            <h2 className="text-[17px] font-semibold text-zinc-900">{copy.hoursTitle}</h2>
            <button type="button" onClick={() => setShowHoursModal(false)} aria-label={copy.close} className="flex size-10 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900">
              <X className="size-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {openLabel && (
              <p className={`mx-5 mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium ${openLabel.tone === 'open' ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-600'}`}>
                {openLabel.tone !== 'info' && <span aria-hidden="true" className={`size-[7px] rounded-full ${openLabel.tone === 'open' ? 'bg-emerald-500' : 'bg-zinc-400'}`} />}
                {openLabel.text}
              </p>
            )}
            <ul className="px-5">
              {WEEK_KEYS.map(({ key, index }) => {
                const value = hours?.[key as keyof typeof hours]
                const isToday = openInfo?.todayIndex === index
                return (
                  <li key={key} className={`flex items-center justify-between gap-4 border-b border-zinc-100 py-3 text-[15px] last:border-0 ${isToday ? 'font-semibold text-zinc-900' : 'text-zinc-600'}`}>
                    <span className="shrink-0 capitalize">{formatWeekday(index, selectedLanguage)}{isToday && <span className="ml-2 text-[12px] font-medium text-zinc-400">{copy.today}</span>}</span>
                    <span className="min-w-0 break-words text-right tabular-nums">{value || copy.closed}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </BottomSheet>

      {directOrdersEnabled && (
        <CartPanel
          cart={cart}
          currency={currency}
          lang={selectedLanguage}
          primaryColor={primaryColor}
          open={cartOpen && !checkoutOpen}
          suggestions={cartSuggestions}
          priceColor={accentText}
          canQuickAddSuggestion={product => canQuickAdd(optionGroupsByProductId[product.id])}
          onSelectSuggestion={selectCartSuggestion}
          onSuggestionsOpen={() => {
            if (cart[0]) analyticsTracker?.track({ event_name: 'upsell_shown', product_id: cart[0].product.id, source: 'cart' })
          }}
          onClose={() => setCartOpen(false)}
          onCheckout={() => setCheckoutOpen(true)}
          onEdit={editItem}
          onRemove={removeFromCart}
          onUpdateQuantity={updateCartQuantity}
        />
      )}

      {directOrdersEnabled && checkoutOpen && (
        <CheckoutModal
          cart={cart}
          confirmedCart={confirmedCart}
          currency={currency}
          lang={selectedLanguage}
          customerName={customerName}
          customerPhone={customerPhone}
          phoneContext={{ country: settings?.country, currency }}
          locale={localeFor(selectedLanguage)}
          submittingOrder={submittingOrder}
          orderSuccess={orderSuccess}
          orderError={orderError}
          orderId={orderId}
          primaryColor={primaryColor}
          onClose={() => {
            setCheckoutOpen(false)
            setOrderSuccess(false)
            setOrderId(null)
          }}
          onBack={() => {
            setCheckoutOpen(false)
            setCartOpen(true)
          }}
          onCustomerNameChange={setCustomerName}
          onCustomerPhoneChange={setCustomerPhone}
          restaurantName={tenant.name}
          contact={contact}
          onContactChange={patch => setContact(prev => ({ ...prev, ...patch }))}
          onSubmit={submitOrder}
          orderTypeConfig={orderTypeConfig}
          tableName={orderingTable?.name ?? null}
          orderType={checkoutOrderType}
          deliveryStreet={deliveryStreet}
          deliveryComplement={deliveryComplement}
          deliveryZipcode={deliveryZipcode}
          deliveryCity={deliveryCity}
          deliveryNotes={deliveryNotes}
          deliveryZones={deliveryZones}
          deliveryZonesOnly={settings?.delivery_zones_only === true}
          onOrderTypeChange={setOrderType}
          onDeliveryFieldChange={(field, value) => {
            if (field === 'street') setDeliveryStreet(value)
            else if (field === 'complement') setDeliveryComplement(value)
            else if (field === 'zipcode') setDeliveryZipcode(value)
            else if (field === 'city') setDeliveryCity(value)
            else if (field === 'notes') setDeliveryNotes(value)
          }}
          tipsEnabled={tipsEnabled}
          tipPercentages={tipPercentages}
          tipCents={tipCents}
          onTipChange={setTipCents}
          tenantId={tenant.id}
          taxBps={taxBps}
          promoEnabled={taxPromoReady}
          promo={taxPromoReady ? promo : null}
          onPromoChange={(next) => { setPromo(next); if (next) setUseReward(false) }}
          loyalty={loyaltyOn ? loyalty : null}
          useReward={useReward}
          onUseRewardChange={setUseReward}
          signInHref={`/${tenant.slug}/me`}
          scheduling={scheduling}
          scheduledFor={scheduledFor}
          onScheduledForChange={setScheduledFor}
          confirmedScheduledFor={confirmedScheduledFor}
        />
      )}
    </div>
    </DishPageCartContext.Provider>
  )
}

const FEATURED_TAB = '__featured'
const OTHER_TAB = '__other'
// Monday first; index = JS weekday (0 = Sunday).
const WEEK_KEYS = [
  { key: 'mon', index: 1 }, { key: 'tue', index: 2 }, { key: 'wed', index: 3 }, { key: 'thu', index: 4 },
  { key: 'fri', index: 5 }, { key: 'sat', index: 6 }, { key: 'sun', index: 0 },
]

function DishPlaceholder() {
  return (
    <div className="flex size-full items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200/70">
      <UtensilsCrossed className="size-6 text-zinc-300" aria-hidden="true" />
    </div>
  )
}

/** The address a link goes to, shown under its caption ("www." dropped). */
function linkHost(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

/** One way to reach the restaurant: the whole card is the link (call, chat, open the map). */
function ContactCard({ href, icon, caption, value, color, external, numeric, wrap }: {
  href: string; icon: ReactNode; caption: string; value: string; color: string
  external?: boolean; numeric?: boolean; wrap?: boolean
}) {
  return (
    <li>
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="flex h-full items-center gap-3 rounded-2xl bg-white p-3.5 shadow-card transition-shadow hover:shadow-[0_2px_6px_rgb(0_0_0/0.06),0_12px_32px_rgb(0_0_0/0.08)]"
      >
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, white)`, color }}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-medium text-zinc-500">{caption}</span>
          <span className={`block text-[15px] font-semibold text-zinc-900 ${numeric ? 'tabular-nums' : ''} ${wrap ? 'break-words' : 'truncate'}`}>{value}</span>
        </span>
      </a>
    </li>
  )
}

/**
 * One dish. Phones: a row, text left and photo right, the photo flush with the card's right, top and bottom
 * edges (square at least, taller with long text; it crops, never squashes). The text column pairs the
 * plain-text price with a quiet +, keeping controls off the food photo. Its reserved slot also fits the
 * quantity stepper; narrow columns wrap the slot below the price before adding, so it stays put.
 * Larger screens put the photo on top. Choices still open the dish sheet. Controls are 44px high.
 */
function ProductCard({ product, lang, currency, accentText, price, onOpen, cartQuantity, onAdd, onIncrement, onDecrement, hasArModel = false, noticeMinutes = 0, href }: {
  /** Notice the dish needs, in minutes (0 = none); shown as a small pill. */
  noticeMinutes?: number
  /** The dish page, when it has one: the card is then a link (search engines follow it; a click opens the dish window). */
  href?: string
  product: Product; lang: string; currency: string; primaryColor: string; onOpen: () => void
  /** The dish has a 3D model: a small cube in the photo's corner says it can be seen on the table. */
  hasArModel?: boolean
  /** The restaurant's secondary colour (tags) and the same colour made readable as text (price). */
  accentColor: string; accentText: string
  /** The price as shown ("From $15.00" for a dish with sizes); amount and fromLabel split it for the price line. */
  price: { text: string; from: boolean; amount: string; fromLabel: string | null }
  cartQuantity?: number; onAdd?: () => void; onIncrement?: () => void; onDecrement?: () => void
}) {
  const copy = getMenuCopy(lang)
  const image = getProductImages(product)[0]
  const quantity = cartQuantity ?? 0
  const promo = !price.from && product.original_price && product.original_price > product.price ? product.original_price : null
  const showStepper = !!onIncrement && !!onDecrement && quantity > 0
  const showAdd = !!onAdd && !showStepper
  const cardFeature = dishFeature(product)
  return (
    <article
      data-analytics-product-id={product.id}
      data-analytics-source="grid"
      // A finger landing on the card starts the dish window's photo before the tap ends.
      onPointerEnter={() => prefetchImage(image, { urgent: true })}
      className="group relative grid grid-cols-[minmax(0,1fr)_clamp(8rem,28vw,10rem)] grid-rows-[1fr_auto] overflow-hidden rounded-2xl bg-white shadow-card transition-shadow hover:shadow-[0_2px_6px_rgb(0_0_0/0.06),0_12px_32px_rgb(0_0_0/0.08)] sm:flex sm:flex-col"
    >
      {href ? (
        <a
          href={href}
          onClick={event => {
            // Ctrl/Cmd/middle click keeps the browser's new tab; a plain click opens the dish window.
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
            event.preventDefault()
            onOpen()
          }}
          aria-label={product.name}
          className="absolute inset-0 z-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/30"
        />
      ) : (
        <button
          type="button"
          onClick={onOpen}
          aria-label={product.name}
          className="absolute inset-0 z-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/30"
        />
      )}
      <div className="pointer-events-none col-start-1 row-start-1 flex min-w-0 flex-col px-5 pt-5 sm:order-2">
        <h3 className={`line-clamp-2 text-[16px] text-zinc-900 ${ui.dishTitleCompact}`}>{product.name}</h3>
        {product.description && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-zinc-500">{product.description}</p>
        )}
        {noticeMinutes > 0 && <div className="mt-2 flex"><NoticePill minutes={noticeMinutes} lang={lang} /></div>}
      </div>
      {/* Unit price and ordering controls share a footer, never the photo. */}
      <div className="pointer-events-none col-start-1 row-start-2 flex min-w-0 flex-wrap items-end gap-x-3 gap-y-2 px-5 pt-3 pb-5 sm:order-3 sm:mt-auto">
        <div className="shrink-0">
          {(price.fromLabel || promo) && (
            <p className="mb-0.5 text-[11px] font-medium leading-tight text-zinc-500">
              {price.fromLabel ?? <span className="tabular-nums text-zinc-500 line-through">{formatMoney(promo as number, currency, lang)}</span>}
            </p>
          )}
          {/* Block + trimmed to the baseline, so the digits (not an invisible line box whose size depends on each
              platform's font metrics) sit on the add button's bottom edge on Android and iOS alike. */}
          <span className="block whitespace-nowrap text-[17px] leading-none font-extrabold tracking-tight tabular-nums [text-box:trim-end_cap_alphabetic]" style={{ color: accentText }}>{price.amount}</span>
        </div>
        {(showAdd || showStepper) && (
          <div className="pointer-events-auto relative z-10 ml-auto flex w-[104px] shrink-0 justify-end">
            {showStepper ? (
              <div className="flex h-11 w-full items-center justify-between rounded-full bg-zinc-100 text-zinc-900">
                <button type="button" onClick={onDecrement} aria-label={fill(copy.removeNamed, { name: product.name })} className="flex size-11 shrink-0 items-center justify-center rounded-full active:bg-zinc-200">
                  <Minus className="size-4" strokeWidth={2.5} />
                </button>
                <span className="min-w-4 text-center text-[14px] font-semibold tabular-nums" aria-live="polite">{quantity}</span>
                <button type="button" onClick={onIncrement} aria-label={fill(copy.addNamed, { name: product.name })} className="flex size-11 shrink-0 items-center justify-center rounded-full active:bg-zinc-200">
                  <Plus className="size-4" strokeWidth={2.5} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={onAdd} aria-label={fill(copy.addNamed, { name: product.name })}
                className="flex size-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-900 transition-colors hover:bg-zinc-200 active:bg-zinc-200">
                <Plus className="size-[18px] shrink-0" strokeWidth={2.5} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="pointer-events-none relative col-start-2 row-span-2 row-start-1 min-h-[clamp(8rem,28vw,10rem)] bg-zinc-100 sm:order-1 sm:aspect-[4/3] sm:min-h-0 sm:w-full">
        {image
          ? <DeliveryImage variant="card" src={image} alt="" fill sizes="(max-width: 639px) clamp(128px, 28vw, 160px), (max-width: 1024px) 50vw, 33vw" className="object-cover object-center transition-transform duration-500 sm:group-hover:scale-[1.03]" />
          : <DishPlaceholder />}
        {cardFeature && (
          <div className="absolute inset-x-2 top-2 flex sm:inset-x-3 sm:top-3">
            <DishFeaturePill tag={cardFeature} lang={lang} tone={image ? 'glass' : 'solid'} className="max-w-full" />
          </div>
        )}
        {hasArModel && (
          <ArBadge lang={lang} className="absolute bottom-2 left-2 flex size-6 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm sm:bottom-3 sm:left-3" />
        )}
      </div>
    </article>
  )
}
