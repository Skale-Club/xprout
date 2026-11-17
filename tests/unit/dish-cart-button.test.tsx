import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import DishCartButton, { DishPageCartContext, type DishPageCart } from '@/components/menu/DishCartButton'

const cart = (overrides: Partial<DishPageCart> = {}): DishPageCart => ({
  enabled: true, needsChoices: () => false, quantity: () => 0,
  add: vi.fn(), decrease: vi.fn(), choose: vi.fn(), openCart: vi.fn(),
  primaryColor: '#283f32', onPrimary: '#ffffff',
  copy: { addToOrder: 'Add', decrease: 'Decrease', increase: 'Increase', viewOrder: 'View order', addNamed: 'Add {name}' },
  ...overrides,
})
const render = (value: DishPageCart | null) =>
  renderToStaticMarkup(createElement(DishPageCartContext.Provider, { value }, createElement(DishCartButton, { productId: 'soup', name: 'Soup' })))

describe('dish page add-to-order button', () => {
  it('shows nothing outside a menu or when guests cannot order', () => {
    expect(render(null)).toBe('')
    expect(render(cart({ enabled: false }))).toBe('')
  })
  it('offers Add in the restaurant colour, named for screen readers', () => {
    const html = render(cart())
    expect(html).toContain('aria-label="Add Soup"')
    expect(html).toContain('background-color:#283f32')
    expect(html).toContain('>Add</span>')
  })
  it('turns into the − quantity + stepper with the order button once the plain dish is in the order', () => {
    const html = render(cart({ quantity: () => 2 }))
    expect(html).toContain('data-dish-cart-controls')
    expect(html).toMatch(/>2<\/span>/)
    expect(html).toContain('aria-label="View order"')
  })
  it('keeps Add for a dish with choices, whatever is already in the order', () => {
    const html = render(cart({ needsChoices: () => true, quantity: () => 3 }))
    expect(html).toContain('aria-label="Add Soup"')
    expect(html).not.toContain('data-dish-cart-controls')
  })
})
