import { describe, expect, it } from 'vitest'
import { renamedMenuSlug } from '@/lib/menu/renamed-menu-slugs'

describe('renamed menu slugs', () => {
  it('maps a renamed menu to its new slug', () => {
    expect(renamedMenuSlug('aurora', 'cardapio-principal')).toBe('main-menu')
    expect(renamedMenuSlug('Aurora', 'Cardapio-Principal')).toBe('main-menu')
  })
  it('leaves every other menu alone', () => {
    expect(renamedMenuSlug('aurora', 'main-menu')).toBeNull()
    expect(renamedMenuSlug('bella-vista', 'cardapio-principal')).toBeNull()
  })
})
