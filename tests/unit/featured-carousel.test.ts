import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import FeaturedCarousel from '../../src/components/menu/FeaturedCarousel'

describe('featured carousel exposes one copy', () => {
  it('server-renders every dish exactly once, with no aria-hidden clones', () => {
    const calls: boolean[] = []
    const html = renderToStaticMarkup(createElement(FeaturedCarousel, {
      items: (clone: boolean) => {
        calls.push(clone)
        return ['Pizza', 'Salad'].map(name => createElement('button', { key: name }, name))
      },
    }))
    expect(html.match(/Pizza/g)).toHaveLength(1)
    expect(html.match(/Salad/g)).toHaveLength(1)
    expect(html).not.toContain('aria-hidden')
    expect(calls.every(clone => clone === false)).toBe(true)
  })
})
