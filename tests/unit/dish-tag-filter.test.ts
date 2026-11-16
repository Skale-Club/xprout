import { describe, expect, it } from 'vitest'
import { dishTagOptions, filterByDishTags } from '@/lib/menu/dish-tags'

const dishes = [
  { id: 1, tags: ['Vegan'] },
  { id: 2, tags: ['Vegetarian', 'Gluten-Free'] },
  { id: 3, tags: [] },
  { id: 4, tags: null },
  { id: 5, tags: ['gluten-free'] },
]

describe('diet filter', () => {
  it('offers only tags present in the menu, in priority order', () => {
    expect(dishTagOptions(dishes)).toEqual(['Vegan', 'Vegetarian', 'Gluten-Free'])
    expect(dishTagOptions([{ tags: [] }])).toEqual([])
  })

  it('keeps everything with no selection', () => {
    expect(filterByDishTags(dishes, [])).toHaveLength(5)
  })

  it('matches one tag case-insensitively', () => {
    expect(filterByDishTags(dishes, ['Gluten-Free']).map(d => d.id)).toEqual([2, 5])
  })

  it('requires every selected tag (AND)', () => {
    expect(filterByDishTags(dishes, ['Vegetarian', 'Gluten-Free']).map(d => d.id)).toEqual([2])
    expect(filterByDishTags(dishes, ['Vegan', 'Gluten-Free'])).toEqual([])
  })
})
