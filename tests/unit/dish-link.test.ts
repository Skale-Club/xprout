import { describe, expect, it } from 'vitest'
import { dishShareUrl, findDishByParam, readDishParam, withDishParam } from '@/lib/menu/dish-link'

const TABLE = '0b9a7a4e-1c2d-4e3f-8a9b-0c1d2e3f4a5b'

describe('dish links', () => {
  it('adds and removes ?dish= while keeping table, lang and custom-domain paths', () => {
    const base = `https://menu.aurora.test/drinks?table=${TABLE}&lang=pt`
    const open = withDishParam(base, 'p1')
    expect(new URL(open).pathname).toBe('/drinks')
    expect(new URL(open).searchParams.get('dish')).toBe('p1')
    expect(new URL(open).searchParams.get('table')).toBe(TABLE)
    expect(new URL(open).searchParams.get('lang')).toBe('pt')
    expect(withDishParam(open, null)).toBe(base)
    expect(withDishParam(withDishParam(base, 'p1'), 'p2')).toContain('dish=p2')
  })

  it('reads the param and ignores unknown or empty values', () => {
    expect(readDishParam('?dish=p1&lang=en')).toBe('p1')
    expect(readDishParam('?dish=')).toBeNull()
    expect(readDishParam('')).toBeNull()
    const products = [{ id: 'p1' }, { id: 'p2' }]
    expect(findDishByParam(products, 'p2')).toBe(products[1])
    expect(findDishByParam(products, 'nope')).toBeNull()
    expect(findDishByParam(products, null)).toBeNull()
  })

  it('builds a share link without the guest table or hash', () => {
    const shared = new URL(dishShareUrl(`https://xprout.app/aurora?table=${TABLE}&lang=es#featured`, 'p1'))
    expect(shared.pathname).toBe('/aurora')
    expect(shared.searchParams.get('dish')).toBe('p1')
    expect(shared.searchParams.get('lang')).toBe('es')
    expect(shared.searchParams.has('table')).toBe(false)
    expect(shared.hash).toBe('')
  })
})
