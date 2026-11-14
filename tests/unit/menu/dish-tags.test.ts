import { describe, expect, it } from 'vitest'
import { dishFeature, normalizeTags, primaryTag, sortTags, tagColor, validateDishTags, MAX_DISH_TAG_LENGTH, PREDEFINED_DISH_TAGS } from '@/lib/menu/dish-tags'

describe('dish tags', () => {
  it('shows the highest-ranked known tag', () => {
    expect(primaryTag(['Vegetarian', "Chef's special"])).toBe("Chef's special")
    expect(primaryTag(['Gluten-Free', 'Vegetarian'])).toBe('Vegetarian')
    expect(primaryTag(['Spicy', 'Vegan'])).toBe('Spicy')
  })

  it('prefers a known tag over free text, discards unsupported text', () => {
    expect(primaryTag(['House favourite', 'Vegan'])).toBe('Vegan')
    expect(primaryTag(['House favourite', 'Local'])).toBeNull()
  })

  it('returns null when there is nothing to show', () => {
    expect(primaryTag([])).toBeNull()
    expect(primaryTag(null)).toBeNull()
    expect(primaryTag(['  '])).toBeNull()
  })

  it('matches known tags regardless of case', () => {
    expect(primaryTag(['gluten-free', 'vegan'])).toBe('Vegan')
    expect(tagColor('VEGAN')).toEqual(tagColor('Vegan'))
  })

  it('gives free-text tags the neutral colour', () => {
    expect(tagColor('House favourite')).toEqual({ background: '#f4f4f5', text: '#52525b' })
    expect(tagColor('Spicy')).not.toEqual(tagColor('House favourite'))
  })

  it('sorts known tags by priority and keeps free text after them in order', () => {
    expect(sortTags(['Local', 'Vegetarian', "Chef's special", 'Organic'])).toEqual(["Chef's special", 'Vegetarian', 'Local', 'Organic'])
  })

  it('saves at most one tag, the most important', () => {
    expect(normalizeTags(['Vegetarian', 'Gluten-Free', "Chef's special"])).toEqual(["Chef's special"])
    expect(normalizeTags([' House favourite '])).toEqual([])
    expect(normalizeTags([])).toEqual([])
    expect(normalizeTags(undefined)).toEqual([])
  })
})

describe('one feature per dish', () => {
  it('shows the tag, never the tag and the featured flag together', () => {
    expect(dishFeature({ tags: ['Spicy'], is_featured: true })).toBe('Spicy')
    expect(dishFeature({ tags: ['Vegan', "Chef's special"], is_featured: false })).toBe("Chef's special")
  })

  it("marks a featured dish without a tag as the chef's special", () => {
    expect(dishFeature({ tags: [], is_featured: true })).toBe("Chef's special")
    expect(dishFeature({ tags: null, is_featured: false })).toBeNull()
  })
})

describe('strict feature writes', () => {
  it('accepts clearing and canonical predefined values', () => {
    expect(validateDishTags([])).toEqual([])
    expect(validateDishTags([' vegan '])).toEqual(['Vegan'])
    expect(validateDishTags(['New'])).toEqual(['New'])
    expect(PREDEFINED_DISH_TAGS).toHaveLength(7)
  })
  it.each([null, 'Vegan', [1], ['Unknown'], ['Vegan', 'Spicy'], ['x'.repeat(MAX_DISH_TAG_LENGTH + 1)]])('rejects invalid tags %j', input => {
    expect(() => validateDishTags(input)).toThrow('Invalid product tags')
  })
  it('enforces the input limit even when trimming would produce a valid tag', () => {
    expect(() => validateDishTags(['Vegan'.padEnd(MAX_DISH_TAG_LENGTH + 1)])).toThrow('Invalid product tags')
    expect(PREDEFINED_DISH_TAGS.every(tag => tag.length <= MAX_DISH_TAG_LENGTH)).toBe(true)
  })
})
