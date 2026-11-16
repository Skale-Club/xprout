import { describe, expect, it } from 'vitest'
import { OPTION_IMAGE_READY_SQL, optionColumns, optionPhotoUrl, validOptionImageUrl } from '@/lib/menu/option-images'
import { optionFields, optionImageColumnReady, readProductGroups } from '@/lib/data/admin-product-detail'
import { buildOptionGroupsByProductId } from '@/lib/menu/public-menu-model'
import { PUBLIC_MENU_COLUMNS } from '@/lib/data/public-menu'
import type { GroupWithOptions } from '@/app/(admin)/menu/products/[id]/page'

const URL_OK = 'https://cdn.example.com/product-images/t/1.webp'
const base = { name: 'Large', base_price: 12, price_modifier: 0, is_available: true }

describe('option photo URL', () => {
  it('accepts only bounded http(s) URLs without credentials', () => {
    expect(validOptionImageUrl(URL_OK)).toBe(true)
    for (const bad of ['', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'https://u:p@x.com/a.webp', `https://x.com/${'a'.repeat(2100)}`, 42, null, undefined]) {
      expect(validOptionImageUrl(bad)).toBe(false)
    }
  })

  it('shows a photo only when the option has a usable one', () => {
    expect(optionPhotoUrl({ image_url: URL_OK })).toBe(URL_OK)
    expect(optionPhotoUrl({ image_url: null })).toBeNull()
    expect(optionPhotoUrl({})).toBeNull()
    expect(optionPhotoUrl({ image_url: 'ftp://x/y' })).toBeNull()
  })
})

describe('option data mapping', () => {
  const group = (options: Array<Record<string, unknown>>) => ({ id: 'g1', product_id: 'p1', options }) as unknown as GroupWithOptions

  it('keeps the photo on options that have one and leaves the others as they were', () => {
    const grouped = buildOptionGroupsByProductId([group([
      { id: 'o1', is_available: true, name: 'With', image_url: URL_OK },
      { id: 'o2', is_available: true, name: 'Without' },
      { id: 'o3', is_available: false, name: 'Hidden', image_url: URL_OK },
    ])])
    const options = grouped.p1[0].options as unknown as Array<{ id: string; image_url?: string }>
    expect(options.map(o => o.id)).toEqual(['o1', 'o2'])
    expect(options[0].image_url).toBe(URL_OK)
    expect('image_url' in options[1]).toBe(false)
  })

  it('admin accepts a photo URL, null to remove it, and rejects junk', () => {
    expect(optionFields({ ...base, image_url: URL_OK }, true).image_url).toBe(URL_OK)
    expect(optionFields({ image_url: null }, false).image_url).toBeNull()
    expect(() => optionFields({ ...base, image_url: 'javascript:alert(1)' }, true)).toThrow()
    expect('image_url' in optionFields(base, true)).toBe(false)
  })
})

describe('readiness fallback', () => {
  it('refuses a photo and ignores "no photo" until the schema step ran', () => {
    expect(() => optionFields({ ...base, image_url: URL_OK }, true, false)).toThrow(/not available yet/)
    expect('image_url' in optionFields({ ...base, image_url: null }, false, false)).toBe(false)
  })

  it('reads the photo column only once it exists', async () => {
    expect(optionColumns(PUBLIC_MENU_COLUMNS.option, false)).toBe(PUBLIC_MENU_COLUMNS.option)
    expect(optionColumns(PUBLIC_MENU_COLUMNS.option, true)).toBe(`${PUBLIC_MENU_COLUMNS.option} image_url`)
    expect(OPTION_IMAGE_READY_SQL).toContain("column_name='image_url'")

    for (const ready of [false, true]) {
      const seen: string[] = []
      const query = async (text: string) => {
        seen.push(text)
        if (text.includes('information_schema')) return { rows: [{ ready }] }
        return { rows: [] }
      }
      expect(await optionImageColumnReady(query as never)).toBe(ready)
      await readProductGroups(query as never, { tenantId: '11111111-1111-4111-8111-111111111111', role: 'store-admin' }, '22222222-2222-4222-8222-222222222222')
      const optionsQuery = seen.find(text => text.includes('FROM public.product_options'))!
      expect(optionsQuery.includes('o.image_url')).toBe(ready)
    }
  })
})
