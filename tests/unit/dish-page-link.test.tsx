import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import DishPageLink from '@/components/menu/DishPageLink'

const href = 'https://xprout.app/aurora/main-menu/cod-fritters-111111111111'
const render = (props: { href?: string | null; lang: string }) => renderToStaticMarkup(createElement(DishPageLink, props))

describe('dish window arrow to the dish page', () => {
  it('is a quiet same-tab arrow with no visible text', () => {
    const html = render({ href, lang: 'en' })
    expect(html).toContain(`href="${href}"`)
    expect(html).toContain('aria-label="Open dish page"')
    expect(html).toContain('text-zinc-400')
    expect(html).toContain('<svg')
    expect(html.replace(/<[^>]+>/g, '')).toBe('')
    expect(html).not.toContain('target=')
  })
  it('names itself in the menu language', () => {
    expect(render({ href, lang: 'pt' })).toContain('aria-label="Abrir página do prato"')
    expect(render({ href, lang: 'es' })).toContain('aria-label="Abrir página del plato"')
    expect(render({ href, lang: 'pt-BR' })).toContain('title="Abrir página do prato"')
  })
  it('shows nothing when the dish has no public page', () => {
    expect(render({ href: undefined, lang: 'en' })).toBe('')
    expect(render({ href: null, lang: 'pt' })).toBe('')
  })
})
