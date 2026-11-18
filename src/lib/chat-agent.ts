/**
 * The AI menu assistant: what it knows (menu catalog → prompt context), what
 * it remembers (server-side history), and what it can do (addToCart, validated
 * and priced on the server).
 *
 * Everything here except loadMenuCatalog is pure or takes the model as a
 * parameter, so it is unit-tested without Supabase or a real LLM.
 */
import { generateText, stepCountIs, tool, type LanguageModel, type ModelMessage, type ToolSet } from 'ai'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CartEditorState } from '@/components/menu/menu-utils'
import { OptionSelectionError, resolveOptionSelection } from '@/lib/menu/option-pricing'
import { parseTableParam } from '@/lib/service-modes'

// ── Catalog ────────────────────────────────────────────────────────────────

export interface CatalogOption {
  id: string
  name: string
  base_price: number | null
  price_modifier: number
}

export interface CatalogGroup {
  id: string
  name: string
  type: string // 'single' | 'multiple' | 'half_and_half'
  required: boolean
  min_selections: number
  max_selections: number | null
  options: CatalogOption[]
}

export interface CatalogIngredient {
  name: string
  is_default: boolean
}

export interface CatalogProduct {
  id: string
  category_id: string | null
  name: string
  description: string | null
  price: number
  original_price: number | null
  tags: string[] | null
  groups: CatalogGroup[]
  ingredients: CatalogIngredient[]
}

export interface MenuCatalog {
  menuName: string
  currency: string | null
  /**
   * Applied on top of every catalog price, exactly as checkout applies it
   * (catalog prices stay as stored; see applyMultiplier).
   */
  priceMultiplier: number
  categories: Array<{ id: string; name: string; description: string | null }>
  products: CatalogProduct[]
}

/**
 * The multiplier checkout honours for an anonymous customer: an active,
 * non-private menu's price_multiplier. A private (in-store/staff) menu's
 * multiplier never applies to a public order — /api/orders enforces the same.
 */
export function effectiveMultiplier(menu: { is_active?: boolean | null; is_private?: boolean | null; price_multiplier?: number | null }): number {
  const usable = menu.is_active !== false && menu.is_private !== true
  const m = Number(menu.price_multiplier ?? 1)
  return usable && m > 0 ? m : 1
}

/** Same rounding as checkout: the unit is rounded to cents, then multiplied and rounded again. */
export function applyMultiplier(amount: number, multiplier: number): number {
  const base = Math.max(0, Number(amount.toFixed(2)))
  return multiplier !== 1 ? Math.round(base * multiplier * 100) / 100 : base
}

/**
 * Loads the menu the customer is looking at (menuId, when it is one of the
 * tenant's active menus) or else the default/first active one, with everything
 * the assistant needs: available products, their option groups (available
 * options only) and their ingredients. The same catalog backs the prompt
 * context and the addToCart validation, so the model can't be told about an
 * option the server would then refuse.
 */
export async function loadMenuCatalog(
  supabase: SupabaseClient,
  tenantId: string,
  currency: string | null,
  menuId?: string | null,
): Promise<MenuCatalog | null> {
  const { data: menus } = await supabase
    .from('menus')
    .select('id, name, is_default, is_active, is_private, price_multiplier')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('position')

  // The chat is anonymous: a private menu (phone-verified guests only) is
  // never its catalog, whether it is the default or the menu_id asked for.
  const publicMenus = (menus ?? []).filter((m) => m.is_private !== true)
  const menu = (menuId && publicMenus.find((m) => m.id === menuId)) || publicMenus[0]
  if (!menu) return null

  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from('categories').select('id, name, description').eq('menu_id', menu.id).eq('is_active', true).order('position'),
    supabase.from('products').select('id, category_id, name, description, price, original_price, tags').eq('menu_id', menu.id).eq('is_available', true).order('position'),
  ])

  const productIds = (products ?? []).map((p) => p.id)
  const [{ data: groupRows }, { data: ingredientRows }] = productIds.length
    ? await Promise.all([
        supabase
          .from('product_option_groups')
          .select('id, product_id, name, type, required, min_selections, max_selections, position, options:product_options(id, name, base_price, price_modifier, is_available, position)')
          .in('product_id', productIds)
          .order('position'),
        supabase
          .from('product_ingredients')
          .select('product_id, is_default, position, ingredients(name, is_available)')
          .in('product_id', productIds)
          .order('position'),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }]

  const groupsByProduct = new Map<string, CatalogGroup[]>()
  for (const g of (groupRows ?? []) as any[]) {
    const options = ((g.options ?? []) as any[])
      .filter((o) => o.is_available !== false)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((o) => ({ id: o.id, name: o.name, base_price: o.base_price === null ? null : Number(o.base_price), price_modifier: Number(o.price_modifier ?? 0) }))
    const arr = groupsByProduct.get(g.product_id) ?? []
    arr.push({
      id: g.id,
      name: g.name,
      type: g.type,
      required: !!g.required,
      min_selections: Number(g.min_selections ?? 0),
      max_selections: g.max_selections === null || g.max_selections === undefined ? null : Number(g.max_selections),
      options,
    })
    groupsByProduct.set(g.product_id, arr)
  }

  const ingredientsByProduct = new Map<string, CatalogIngredient[]>()
  for (const pi of (ingredientRows ?? []) as any[]) {
    const ing = Array.isArray(pi.ingredients) ? pi.ingredients[0] : pi.ingredients
    if (!ing?.name || ing.is_available === false) continue
    const arr = ingredientsByProduct.get(pi.product_id) ?? []
    arr.push({ name: ing.name, is_default: !!pi.is_default })
    ingredientsByProduct.set(pi.product_id, arr)
  }

  return {
    menuName: menu.name,
    currency,
    priceMultiplier: effectiveMultiplier(menu),
    categories: (categories ?? []).map((c) => ({ id: c.id, name: c.name, description: c.description ?? null })),
    products: (products ?? []).map((p) => ({
      id: p.id,
      category_id: p.category_id ?? null,
      name: p.name,
      description: p.description ?? null,
      price: Number(p.price),
      original_price: p.original_price === null ? null : Number(p.original_price),
      tags: (p.tags as string[] | null) ?? null,
      groups: groupsByProduct.get(p.id) ?? [],
      ingredients: ingredientsByProduct.get(p.id) ?? [],
    })),
  }
}

// ── Prompt context ─────────────────────────────────────────────────────────

/** Minimum selections the cart will demand — mirrors ProductModal.canAddToCart. */
function requiredCount(g: CatalogGroup): number {
  if (!g.required) return 0
  if (g.type === 'single') return 1
  if (g.type === 'half_and_half') return 2
  return g.min_selections
}

export function describeGroupRule(g: CatalogGroup): string {
  const req = g.required ? 'REQUIRED' : 'optional'
  if (g.type === 'single') return `${req}, choose exactly 1`
  if (g.type === 'half_and_half') return `${req}, half-and-half: choose 2 flavours (one per half)`
  const min = requiredCount(g)
  if (g.max_selections !== null && min > 0) return `${req}, choose ${min} to ${g.max_selections}`
  if (g.max_selections !== null) return `${req}, choose up to ${g.max_selections}`
  if (min > 0) return `${req}, choose at least ${min}`
  return `${req}, choose any`
}

// Prices shown to the model already carry the menu multiplier, so what it
// quotes is what the page shows and checkout charges.
function formatOption(o: CatalogOption, m: number): string {
  if (o.base_price !== null) return `${o.name} @${applyMultiplier(o.base_price, m)}`
  if (o.price_modifier) return `${o.name} ${o.price_modifier > 0 ? '+' : '-'}${applyMultiplier(Math.abs(o.price_modifier), m)}`
  return o.name
}

function formatProduct(p: CatalogProduct, m: number): string[] {
  const price = p.original_price && p.original_price > p.price
    ? `${applyMultiplier(p.price, m)} (promo, was ${applyMultiplier(p.original_price, m)})`
    : `${applyMultiplier(p.price, m)}`
  const tags = p.tags?.length ? ` [${p.tags.join(', ')}]` : ''
  const lines = [`- ${p.name} — ${price}${tags} (product_id: ${p.id})`]
  if (p.description) lines.push(`    ${p.description}`)
  const base = p.ingredients.filter((i) => i.is_default).map((i) => i.name)
  const extra = p.ingredients.filter((i) => !i.is_default).map((i) => i.name)
  if (base.length) lines.push(`    Ingredients: ${base.join(', ')}`)
  if (extra.length) lines.push(`    Can be added on the menu: ${extra.join(', ')}`)
  for (const g of p.groups) {
    lines.push(`    • ${g.name} (${describeGroupRule(g)}): ${g.options.map((o) => formatOption(o, m)).join(', ')}`)
  }
  return lines
}

export function formatMenuContext(catalog: MenuCatalog | null): string {
  if (!catalog) return 'No menu available.'
  const lines: string[] = [`MENU: ${catalog.menuName}`]
  if (catalog.currency) lines.push(`All prices are in ${catalog.currency}.`)
  for (const cat of catalog.categories) {
    lines.push(`\n## ${cat.name}`)
    if (cat.description) lines.push(`(${cat.description})`)
    for (const p of catalog.products.filter((x) => x.category_id === cat.id)) lines.push(...formatProduct(p, catalog.priceMultiplier))
  }
  // Products whose category is missing or inactive still sell — list them so
  // the model never claims an orderable item doesn't exist.
  const known = new Set(catalog.categories.map((c) => c.id))
  const orphans = catalog.products.filter((p) => !p.category_id || !known.has(p.category_id))
  if (orphans.length) {
    lines.push('\n## Other')
    for (const p of orphans) lines.push(...formatProduct(p, catalog.priceMultiplier))
  }
  return lines.join('\n')
}

/**
 * profile and ordering are the blocks from chat-context.ts (describeProfile /
 * describeOrdering); canAddToCart says whether the addToCart tool is offered.
 */
// ── What the customer has in the cart / which language they read ─────────

export interface CartSnapshotItem {
  name: string
  quantity: number
  options?: string
  /** The widget's stable id for this cart line (its cartKey); lets the assistant change the line. */
  line_id?: string
}

const MAX_CART_ITEMS = 30
const MAX_LINE_ID_CHARS = 500

/**
 * The cart as the widget reports it. Untrusted and only used as context (the
 * assistant never prices from it), so it is bounded and stripped to text.
 */
export function parseCartSnapshot(raw: unknown): CartSnapshotItem[] {
  if (!Array.isArray(raw)) return []
  const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\r\n\t]+/g, ' ').trim().slice(0, max) : '')
  return raw.slice(0, MAX_CART_ITEMS).flatMap((item) => {
    const i = item as { name?: unknown; quantity?: unknown; options?: unknown; line_id?: unknown }
    const name = clean(i?.name, 120)
    const quantity = Math.floor(Number(i?.quantity))
    if (!name || !(quantity >= 1 && quantity <= 99)) return []
    const options = clean(i?.options, 200)
    // Opaque to the server: it is only echoed back to the same widget, never read.
    const lineId = typeof i?.line_id === 'string' && i.line_id.length > 0 && i.line_id.length <= MAX_LINE_ID_CHARS ? i.line_id : ''
    return [{ name, quantity, ...(options ? { options } : {}), ...(lineId ? { line_id: lineId } : {}) }]
  })
}

/** The short reference the model uses for the cart line at this position. */
export const cartLineRef = (index: number) => `L${index + 1}`

/** withRefs lists each changeable line (one that carries a line_id) with its ref. */
export function describeCart(items: CartSnapshotItem[], withRefs = false): string {
  if (!items.length) return 'The cart is empty.'
  return items.map((i, index) => {
    const ref = withRefs && i.line_id ? `[${cartLineRef(index)}] ` : ''
    return `- ${ref}${i.quantity}× ${i.name}${i.options ? ` (${i.options})` : ''}`
  }).join('\n')
}

// ── What the assistant may do (per restaurant) ─────────────────────────────

export interface ChatAbilities {
  /** addToCart / updateCartItem are offered. */
  orderingHelp: boolean
  /** callStaff is offered. */
  staffCall: boolean
}

/**
 * The plan and the guest's situation decide first, then the restaurant's own
 * switches (chat_addon_settings.ordering_help_enabled / staff_call_enabled,
 * both default on). Everything comes from the tenant capabilities.
 */
export function resolveChatAbilities(input: {
  /** Guest ordering exists (the cart): resolveOrderingMode(...) === 'cart'. */
  canAddToCart: boolean
  /** TenantCapabilities.waiterCalls. */
  waiterCalls: boolean
  /** The ?table= the guest opened, as the widget sent it. */
  tableId: unknown
  orderingHelpEnabled?: boolean | null
  staffCallEnabled?: boolean | null
}): ChatAbilities {
  return {
    orderingHelp: input.canAddToCart && input.orderingHelpEnabled !== false,
    staffCall: input.waiterCalls && parseTableParam(input.tableId) !== null && input.staffCallEnabled !== false,
  }
}

export interface CartLineChangeRequest { ref: string; quantity: number }
export interface ResolvedCartLineChange { line_id: string; name: string; quantity: number }
export interface RejectedCartLineChange { ref: string; problem: string }

/**
 * Turns the model's updateCartItem call into changes the widget can apply:
 * every ref must name a line of the cart snapshot the widget sent (a quantity
 * of 0 removes the line). Unknown refs come back rejected so the model says so.
 */
export function resolveCartLineChanges(snapshot: CartSnapshotItem[], requests: CartLineChangeRequest[]) {
  const byLine = new Map<string, ResolvedCartLineChange>()
  const rejected: RejectedCartLineChange[] = []
  for (const req of requests) {
    const ref = req.ref.trim().toUpperCase()
    const index = snapshot.findIndex((_, i) => cartLineRef(i) === ref)
    const line = index >= 0 ? snapshot[index] : undefined
    if (!line?.line_id) { rejected.push({ ref: req.ref, problem: 'There is no such line in the cart. Use a ref listed under the customer\'s cart.' }); continue }
    if (!Number.isInteger(req.quantity) || req.quantity < 0 || req.quantity > 99) { rejected.push({ ref: req.ref, problem: 'Quantity must be a whole number from 0 (remove) to 99.' }); continue }
    byLine.set(line.line_id, { line_id: line.line_id, name: line.name, quantity: req.quantity })
  }
  return { changes: [...byLine.values()], rejected }
}

export function buildSystemPrompt(params: {
  name: string
  profile: string
  menuContext: string
  ordering: string
  canAddToCart: boolean
  /** What is already in the customer's cart (only when the cart exists). */
  cart?: CartSnapshotItem[] | null
  /** The language the customer reads the menu in (English name). */
  guestLanguage?: string | null
  /** The restaurant lets the assistant change the cart (default: whenever the cart exists). */
  orderingHelp?: boolean
  /** callStaff is offered (table link, plan and restaurant switch all allow it). */
  staffCall?: boolean
}): string {
  const { name, profile, menuContext, ordering, canAddToCart, cart, guestLanguage } = params
  const orderingHelp = canAddToCart && (params.orderingHelp ?? true)
  const cartSection = canAddToCart && cart
    ? orderingHelp
      ? `

CUSTOMER'S CART RIGHT NOW (reported by their screen):
${describeCart(cart, true)}
- Use it: do not add again what is already there unless the customer asks for more, and when it fits suggest what is missing (a drink, a side, a dessert) from MENU CONTEXT.
- To change or remove a line that has a ref like [L1], call updateCartItem with that ref and the new quantity (0 removes it).`
      : `

CUSTOMER'S CART RIGHT NOW (reported by their screen):
${describeCart(cart)}
- You cannot change the order: if the customer wants to add, remove or change something, tell them to do it on the menu screen or in their cart.`
    : ''
  const cartRules = canAddToCart && !orderingHelp
    ? `
- You cannot add, remove or change items in the cart. Help the customer choose and point them to the menu screen to add the dishes.`
    : orderingHelp
    ? `
- Call addToCart when the customer explicitly asks to add or order items.
- Pass every choice the customer made in "options", using the group and option names exactly as listed in MENU CONTEXT.
- Before calling it, make sure every REQUIRED group of that item has a choice. If one is missing, ask the customer first (list the available options).
- The tool returns "added" and "rejected". Only tell the customer an item was added if it appears in "added", with the price the tool returned. For each rejected item, explain what is missing and ask for it.
- The cart cannot add or remove ingredients. If the customer wants that, tell them to customize the item from the menu screen.
- Call updateCartItem only for lines listed in the customer's cart, using the ref shown there. Set the new quantity (0 removes the line). To swap a dish, set the old line to 0 and call addToCart for the new one. Only tell the customer a change was made if it appears in "changed".`
    : ''
  const staffRules = params.staffCall
    ? `
- Call callStaff only when the customer asks for a person, a waiter, help at the table or the bill. Never call it on your own and never to answer a menu question. Use reason "bill" for the bill, otherwise "waiter". Only tell the customer the team was notified if the tool says so.`
    : ''

  return `You are a friendly restaurant assistant for ${name}.
You help customers explore the menu, understand dishes, discover great combinations,
and order when the restaurant allows it.

RESTAURANT PROFILE:
${profile}

MENU CONTEXT (the menu the customer is looking at):
${menuContext}

ORDERING:
${ordering}${cartRules}${staffRules}${cartSection}

ALLERGIES AND DIETARY NEEDS:
- Answer only from the ingredients and descriptions listed above. The restaurant's lists may be incomplete and cross-contamination is possible.
- Never state or imply that a dish is free of an allergen, safe for an allergy, gluten-free, vegan, etc. unless that exact claim is written in MENU CONTEXT.
- Whenever a customer mentions an allergy or intolerance, tell them to confirm with the restaurant staff before ordering.

GUARDRAILS — STRICT:
- Only discuss: the menu, ingredients, prices, promotions, dish combinations, food/drink harmonization, allergen questions, and this restaurant's own information above (hours, location, contact, ordering, delivery, payment).
- For any other topic (politics, weather, jokes, general knowledge, competitors, personal advice), politely say you can only help with the menu and the restaurant, and offer to help with the food.
- Never invent menu items, prices, options, ingredients, hours, fees or payment methods not listed above.
- Never discuss competitor restaurants.
- Be warm, concise, and helpful. Maximum 3 sentences per response unless listing items.
- Always respond in the language the customer uses.${guestLanguage ? ` Until they write, use ${guestLanguage} (the language their menu is shown in).` : ''}`
}

// ── Conversation history ───────────────────────────────────────────────────

export const HISTORY_LIMIT = 20
export const MAX_USER_MESSAGE_CHARS = 1000
const MAX_HISTORY_MESSAGE_CHARS = 2000

export interface StoredMessage {
  role: string
  content: string | null
}

/**
 * History comes from chat_messages (what the server itself stored), never from
 * the client, so a customer can neither forge assistant turns nor pad the
 * prompt to burn the restaurant's tokens. Bounded in count and size.
 */
export function buildModelMessages(history: StoredMessage[], userMessage: string): ModelMessage[] {
  const prior = history
    .filter((m): m is { role: 'user' | 'assistant'; content: string } =>
      (m.role === 'user' || m.role === 'assistant') && !!m.content?.trim())
    .slice(-HISTORY_LIMIT)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_HISTORY_MESSAGE_CHARS) }))
  return [...prior, { role: 'user', content: userMessage.slice(0, MAX_USER_MESSAGE_CHARS) }]
}

// ── addToCart: validation and pricing ──────────────────────────────────────

export const cartRequestSchema = z.object({
  product_id: z.string().describe('product_id from MENU CONTEXT'),
  quantity: z.number().int().min(1).max(20).default(1),
  options: z.array(z.object({
    group: z.string().describe('Option group name, exactly as in MENU CONTEXT'),
    choices: z.array(z.string()).min(1).describe('Chosen option names from that group'),
  })).optional().describe('One entry per option group the customer chose'),
  note: z.string().max(140).optional().describe('Short note for the kitchen, e.g. "well done"'),
})

export type CartRequest = z.infer<typeof cartRequestSchema>

export interface ResolvedCartItem {
  product_id: string
  name: string
  quantity: number
  unit_price: number
  selected_options: Record<string, string>
  editor_state: CartEditorState
  note?: string
}

export interface RejectedCartItem {
  product_id: string
  name: string | null
  problems: string[]
  missing_groups: Array<{ group: string; rule: string; options: string[] }>
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

function findByIdOrName<T extends { id: string; name: string }>(list: T[], ref: string): T | undefined {
  return list.find((x) => x.id === ref) ?? list.find((x) => normalize(x.name) === normalize(ref))
}

function resolveOne(catalog: MenuCatalog, req: CartRequest): ResolvedCartItem | RejectedCartItem {
  const product = catalog.products.find((p) => p.id === req.product_id)
  if (!product) {
    return { product_id: req.product_id, name: null, problems: ['This product is not on the menu or is unavailable.'], missing_groups: [] }
  }

  const problems: string[] = []
  const single: Record<string, string> = {}
  const half: Record<string, { half1: string | null; half2: string | null }> = {}
  const multi: Record<string, string[]> = {}
  const labels: Record<string, string> = {}

  for (const sel of req.options ?? []) {
    const group = findByIdOrName(product.groups, sel.group)
    if (!group) {
      problems.push(`"${sel.group}" is not an option group of ${product.name}.`)
      continue
    }
    const chosen: CatalogOption[] = []
    for (const ref of sel.choices) {
      const opt = findByIdOrName(group.options, ref)
      if (!opt) problems.push(`"${ref}" is not an available option of ${group.name}. Available: ${group.options.map((o) => o.name).join(', ')}.`)
      else chosen.push(opt)
    }
    if (chosen.length !== sel.choices.length) continue

    if (group.type === 'single') {
      if (chosen.length !== 1) { problems.push(`${group.name}: choose exactly 1.`); continue }
      single[group.id] = chosen[0].id
      labels[group.name] = chosen[0].name
    } else if (group.type === 'half_and_half') {
      if (chosen.length > 2) { problems.push(`${group.name}: choose at most 2 flavours.`); continue }
      // One flavour means the whole item in that flavour: both halves the same.
      const [h1, h2 = h1] = chosen
      half[group.id] = { half1: h1.id, half2: h2.id }
      labels[group.name] = h1.id === h2.id ? h1.name : `${h1.name} / ${h2.name}`
    } else {
      const unique = [...new Map(chosen.map((o) => [o.id, o])).values()]
      if (group.max_selections !== null && unique.length > group.max_selections) {
        problems.push(`${group.name}: choose at most ${group.max_selections}.`)
        continue
      }
      multi[group.id] = unique.map((o) => o.id)
      labels[group.name] = unique.map((o) => o.name).join(', ')
    }
  }

  const missing = product.groups.filter((g) => {
    const need = requiredCount(g)
    if (need === 0) return false
    if (g.type === 'single') return !single[g.id]
    if (g.type === 'half_and_half') return !half[g.id]
    return (multi[g.id]?.length ?? 0) < need
  })

  if (problems.length || missing.length) {
    return {
      product_id: product.id,
      name: product.name,
      problems,
      missing_groups: missing.map((g) => ({ group: g.name, rule: describeGroupRule(g), options: g.options.map((o) => o.name) })),
    }
  }

  const note = req.note?.trim().slice(0, 140) || undefined
  const editorState: CartEditorState = {
    singleSelections: single,
    halfSelections: half,
    multiSelections: multi,
    ingredientSteppers: {},
    addedIngredients: [],
    note: note ?? '',
  }
  // Same strict resolver as checkout: what the chat puts in the cart is what
  // /api/orders will accept and charge.
  let unit: number
  try {
    unit = resolveOptionSelection(product.price, editorState, product.groups).unit
  } catch (e) {
    if (!(e instanceof OptionSelectionError)) throw e
    return { product_id: product.id, name: product.name, problems: [e.message], missing_groups: [] }
  }
  return {
    product_id: product.id,
    name: product.name,
    quantity: req.quantity,
    unit_price: applyMultiplier(unit, catalog.priceMultiplier),
    selected_options: labels,
    editor_state: editorState,
    note,
  }
}

/**
 * Turns the model's addToCart call into cart items the server trusts: product
 * and options resolved against the catalog, required groups enforced, price
 * computed with the same function checkout uses. Anything incomplete comes
 * back as rejected, with what's missing, so the model asks the customer.
 */
export function resolveCartRequest(catalog: MenuCatalog, requests: CartRequest[]) {
  const added: ResolvedCartItem[] = []
  const rejected: RejectedCartItem[] = []
  for (const req of requests) {
    const r = resolveOne(catalog, req)
    if ('problems' in r) rejected.push(r)
    else added.push(r)
  }
  return { added, rejected }
}

/**
 * What the assistant turn is stored as: its reply plus a marker of what it put
 * in the cart, so the next turn (history is rebuilt from storage) and the
 * owner's inbox both know the cart changed.
 */
export function assistantTurnForHistory(
  text: string,
  items: ResolvedCartItem[],
  changes: ResolvedCartLineChange[] = [],
  staffCalled: 'waiter' | 'bill' | null = null,
): string {
  const notes: string[] = []
  if (items.length) {
    const summary = items.map((i) => {
      const opts = Object.values(i.selected_options).filter(Boolean).join(', ')
      return `${i.quantity}× ${i.name}${opts ? ` (${opts})` : ''} @${i.unit_price}`
    }).join('; ')
    notes.push(`[Added to cart: ${summary}]`)
  }
  if (changes.length) notes.push(`[Changed cart: ${changes.map((c) => `${c.name} → ${c.quantity === 0 ? 'removed' : `${c.quantity}×`}`).join('; ')}]`)
  if (staffCalled) notes.push(`[Called staff: ${staffCalled}]`)
  if (!notes.length) return text
  return `${text}${text ? '\n' : ''}${notes.join('\n')}`
}

// One trailing annotation line per change; loop so several can be stripped.
const CART_MARKER = /\n?\[(?:Added to cart|Changed cart|Called staff): [^\n]*\]\s*$/
function stripAnnotations(content: string): string {
  let current = content
  for (;;) {
    const next = current.replace(CART_MARKER, '')
    if (next === current) return current
    current = next
  }
}

export interface DisplayMessage { role: 'user' | 'assistant'; content: string }

/**
 * Stored rows (newest first, as the history queries return them) as the
 * widget shows them: oldest first, only the human text (the internal
 * "[Added to cart: ...]" annotation is dropped), nothing empty.
 */
export function historyForDisplay(rowsNewestFirst: StoredMessage[]): DisplayMessage[] {
  const out: DisplayMessage[] = []
  for (const row of [...rowsNewestFirst].reverse()) {
    if (row.role !== 'user' && row.role !== 'assistant') continue
    const content = (row.role === 'assistant' ? stripAnnotations(row.content ?? '') : row.content ?? '').trim()
    if (content) out.push({ role: row.role, content })
  }
  return out.slice(-HISTORY_LIMIT)
}

// ── Running the agent ──────────────────────────────────────────────────────

/** Room for: addToCart → (rejected) retry → final answer. */
export const MAX_AGENT_STEPS = 4

/** Outcome of a callStaff attempt (the route creates the waiter call). */
export type StaffCallOutcome = { ok: true } | { ok: false; reason: 'limited' | 'unavailable' }
export type StaffCallReason = 'waiter' | 'bill'

export interface ChatAgentResult {
  text: string
  cartItems: ResolvedCartItem[]
  /** Quantity changes for lines already in the guest's cart (0 = remove). */
  cartChanges: ResolvedCartLineChange[]
  /** The reason of the staff call this turn made, or null. */
  staffCalled: StaffCallReason | null
  totalTokens: number | null
}

export async function runChatAgent(params: {
  model: LanguageModel
  system: string
  messages: ModelMessage[]
  catalog: MenuCatalog | null
  /** addToCart is offered (guest ordering exists AND the restaurant allows ordering help). */
  ordersEnabled: boolean
  /** The cart the widget reported (updateCartItem resolves refs against it). */
  cart?: CartSnapshotItem[] | null
  /** callStaff is offered; performs the call (undefined = not offered). */
  callStaff?: (reason: StaffCallReason) => Promise<StaffCallOutcome>
}): Promise<ChatAgentResult> {
  const { model, system, messages, catalog, ordersEnabled, cart, callStaff } = params
  const cartItems: ResolvedCartItem[] = []
  const cartChanges: ResolvedCartLineChange[] = []
  let staffCalled: StaffCallReason | null = null

  const tools: ToolSet = {}
  if (ordersEnabled && catalog) {
    tools.addToCart = tool({
      description: 'Add menu items to the customer cart. The server validates the options and sets the price; read "added" and "rejected" in the result before answering.',
      inputSchema: z.object({ items: z.array(cartRequestSchema).min(1).max(20) }),
      execute: async ({ items }) => {
        const { added, rejected } = resolveCartRequest(catalog, items)
        cartItems.push(...added)
        return {
          added: added.map((i) => ({ name: i.name, quantity: i.quantity, unit_price: i.unit_price, options: i.selected_options })),
          rejected,
        }
      },
    })
    tools.updateCartItem = tool({
      description: 'Set the quantity of lines already in the customer cart (0 removes a line). Use the refs (L1, L2...) listed under the customer cart. Read "changed" and "rejected" before answering.',
      inputSchema: z.object({
        changes: z.array(z.object({
          ref: z.string().describe('Cart line ref from the customer cart, e.g. L1'),
          quantity: z.number().int().min(0).max(20).describe('New quantity; 0 removes the line'),
        })).min(1).max(10),
      }),
      execute: async ({ changes }) => {
        const resolved = resolveCartLineChanges(cart ?? [], changes)
        for (const change of resolved.changes) {
          const at = cartChanges.findIndex((c) => c.line_id === change.line_id)
          if (at >= 0) cartChanges[at] = change
          else cartChanges.push(change)
        }
        return { changed: resolved.changes.map((c) => ({ name: c.name, quantity: c.quantity })), rejected: resolved.rejected }
      },
    })
  }
  if (callStaff) {
    tools.callStaff = tool({
      description: 'Notify the restaurant staff that the customer at this table wants a waiter or the bill. Only when the customer asked for it.',
      inputSchema: z.object({ reason: z.enum(['waiter', 'bill']).describe('"bill" when they want the bill, otherwise "waiter"') }),
      execute: async ({ reason }) => {
        // One call per turn: a repeated tool call must not ping the staff twice.
        if (staffCalled) return { ok: true, note: 'The staff was already notified.' }
        const outcome = await callStaff(reason)
        if (outcome.ok) { staffCalled = reason; return { ok: true } }
        return { ok: false, problem: outcome.reason === 'limited' ? 'The staff was notified a moment ago; ask the customer to wait.' : 'The staff could not be notified; ask the customer to call a waiter in person.' }
      },
    })
  }

  // Without stopWhen the SDK stops after the first step, so a turn that calls
  // addToCart would end before the model writes its reply.
  const result = await generateText({
    model,
    system,
    messages,
    tools: Object.keys(tools).length ? tools : undefined,
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
    maxRetries: 1,
  })

  return {
    text: result.text.trim(),
    cartItems,
    cartChanges,
    staffCalled,
    totalTokens: result.totalUsage?.totalTokens ?? null,
  }
}
