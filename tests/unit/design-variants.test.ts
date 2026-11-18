import { describe, expect, it } from 'vitest'
import { DESIGN_SLOTS, designVariant, parseDesignVariants, resolveDesignVariants, type DesignSlotDef } from '@/lib/design-variants'

const fixture: readonly DesignSlotDef[] = [
  { id: 'card', label: 'Dish card', defaultVariant: 'classic', variants: [{ id: 'classic', label: 'Classic' }, { id: 'wide', label: 'Wide' }] },
  { id: 'hero', label: 'Hero', defaultVariant: 'plain', variants: [{ id: 'plain', label: 'Plain' }, { id: 'split', label: 'Split' }] },
]

describe('parseDesignVariants', () => {
  it('rejects anything that is not a plain object', () => {
    for (const input of [null, undefined, 'x', 3, [], [['card', 'wide']]]) expect(parseDesignVariants(input, fixture).ok).toBe(false)
  })
  it('rejects unknown slots and unknown variants', () => {
    expect(parseDesignVariants({ nope: 'wide' }, fixture)).toEqual({ ok: false, error: 'Unknown design slot: nope' })
    expect(parseDesignVariants({ card: 'nope' }, fixture).ok).toBe(false)
    expect(parseDesignVariants({ card: 5 }, fixture).ok).toBe(false)
    expect(parseDesignVariants({ card: 'split' }, fixture).ok).toBe(false)
  })
  it('rejects more than 40 keys', () => {
    const many = Object.fromEntries(Array.from({ length: 41 }, (_, index) => [`slot${index}`, 'a']))
    const registry = Object.keys(many).map(id => ({ id, label: id, defaultVariant: 'a', variants: [{ id: 'a', label: 'A' }] }))
    expect(parseDesignVariants(many, registry).ok).toBe(false)
  })
  it('accepts valid variants, the explicit default and an empty map', () => {
    expect(parseDesignVariants({ card: 'wide', hero: 'plain' }, fixture)).toEqual({ ok: true, value: { card: 'wide', hero: 'plain' } })
    expect(parseDesignVariants({}, fixture)).toEqual({ ok: true, value: {} })
  })
})

describe('resolveDesignVariants', () => {
  const defaults = { card: 'classic', hero: 'plain' }
  it('gives every slot its default for empty or garbage data', () => {
    for (const stored of [{}, null, undefined, 'x', 7, [], ['card']]) expect(resolveDesignVariants(stored, fixture)).toEqual(defaults)
  })
  it('uses a valid choice and falls back for a removed variant', () => {
    expect(resolveDesignVariants({ card: 'wide' }, fixture)).toEqual({ card: 'wide', hero: 'plain' })
    expect(resolveDesignVariants({ card: 'removed', hero: 7 }, fixture)).toEqual(defaults)
  })
  it('ignores unknown slots and prototype keys', () => {
    expect(resolveDesignVariants({ ghost: 'x', constructor: 'x' }, fixture)).toEqual(defaults)
  })
  it('designVariant returns one slot', () => {
    expect(designVariant({ hero: 'split' }, 'hero', fixture)).toBe('split')
    expect(designVariant({}, 'card', fixture)).toBe('classic')
    expect(designVariant({}, 'unregistered', fixture)).toBe('')
  })
})

describe('registry compatibility (contract rule 4)', () => {
  // Changing a slot default is a global change: edit this snapshot and record a Journal decision.
  const EXPECTED_DEFAULTS: Record<string, string> = {}

  it('every slot default is one of its variants and ids are unique', () => {
    const slotIds = DESIGN_SLOTS.map(slot => slot.id)
    expect(new Set(slotIds).size).toBe(slotIds.length)
    for (const slot of DESIGN_SLOTS) {
      const variantIds = slot.variants.map(variant => variant.id)
      expect(new Set(variantIds).size).toBe(variantIds.length)
      expect(variantIds).toContain(slot.defaultVariant)
    }
  })
  it('defaults match the checked-in snapshot', () => {
    expect(Object.fromEntries(DESIGN_SLOTS.map(slot => [slot.id, slot.defaultVariant]))).toEqual(EXPECTED_DEFAULTS)
  })
  it('adding a slot changes nothing for existing stored maps', () => {
    const extended: readonly DesignSlotDef[] = [...fixture, { id: 'footer', label: 'Footer', defaultVariant: 'a', variants: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] }]
    for (const stored of [{}, { card: 'wide' }, { hero: 'split', card: 'removed' }]) {
      const before = resolveDesignVariants(stored, fixture)
      const after = resolveDesignVariants(stored, extended)
      for (const slot of fixture) expect(after[slot.id]).toBe(before[slot.id])
      expect(after.footer).toBe('a')
    }
  })
})
