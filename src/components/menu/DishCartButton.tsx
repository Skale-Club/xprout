'use client'

import { createContext, useContext } from 'react'
import { Minus, Plus, ShoppingBag } from 'lucide-react'
import { ui, ctaStyle } from './menu-ui'
import { fill } from './menu-i18n'

/**
 * The menu's order, for a dish page drawn inside the menu (MenuPage `dishPage`): the page's own
 * content is rendered on the server, and this button reaches the same cart, dish sheet and
 * order bar as the menu cards. Null outside a MenuPage.
 */
export interface DishPageCart {
  /** Guests can order on this menu (plan and restaurant switches). */
  enabled: boolean
  /** The dish has choices (sizes, options, ingredients): the button opens its sheet. */
  needsChoices: (productId: string) => boolean
  /** How many of the plain dish (no choices) are in the order. */
  quantity: (productId: string) => number
  add: (productId: string) => void
  decrease: (productId: string) => void
  choose: (productId: string) => void
  openCart: () => void
  primaryColor: string
  onPrimary: string
  copy: { addToOrder: string; decrease: string; increase: string; viewOrder: string; addNamed: string }
}

export const DishPageCartContext = createContext<DishPageCart | null>(null)

/** "Add to order" for the dish of a dish page, then the same − qty + stepper and order button as the dish sheet. */
export default function DishCartButton({ productId, name }: { productId: string; name: string }) {
  const cart = useContext(DishPageCartContext)
  if (!cart?.enabled) return null
  const choices = cart.needsChoices(productId)
  const quantity = choices ? 0 : cart.quantity(productId)

  if (quantity > 0) {
    return (
      <div data-dish-cart-controls className="flex items-center gap-2">
        <div className="flex h-12 w-32 items-center justify-between rounded-full border border-zinc-200 bg-white px-1">
          <button type="button" onClick={() => cart.decrease(productId)} aria-label={cart.copy.decrease}
            className="flex size-11 items-center justify-center rounded-full text-zinc-800 transition-colors hover:bg-zinc-100 active:bg-zinc-200">
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <span className="min-w-5 text-center text-[15px] font-semibold tabular-nums text-zinc-900" aria-live="polite">{quantity}</span>
          <button type="button" onClick={() => cart.add(productId)} aria-label={cart.copy.increase}
            className="flex size-11 items-center justify-center rounded-full text-zinc-800 transition-colors hover:bg-zinc-100 active:bg-zinc-200">
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
        <button type="button" onClick={cart.openCart} aria-label={cart.copy.viewOrder}
          className="flex size-12 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-800 transition-colors hover:bg-zinc-100 active:bg-zinc-200">
          <ShoppingBag className="size-5" aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <button type="button" onClick={() => choices ? cart.choose(productId) : cart.add(productId)}
      aria-label={fill(cart.copy.addNamed, { name })}
      style={ctaStyle(cart.primaryColor, cart.onPrimary)}
      className={`${ui.cta} h-12 min-w-[180px]`}>
      <Plus className="size-5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
      <span>{cart.copy.addToOrder}</span>
    </button>
  )
}
