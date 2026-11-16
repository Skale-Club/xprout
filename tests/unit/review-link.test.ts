import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { googleReviewLink } from '@/lib/site/review-link'
import TenantPublicFooter from '@/components/pages/TenantPublicFooter'

const destination = 'https://search.google.com/local/writereview?placeid=merchant-place'

describe('merchant Google review links', () => {
  it.each([undefined, null, '', 'not a URL', 'http://g.page/merchant/review', 'javascript:alert(1)', 'https://user:secret@g.page/merchant/review'])('omits absent or unsafe destinations (%s)', value => {
    expect(googleReviewLink(value)).toBeNull()
  })
  it.each([
    ['en', 'Review us on Google'], ['pt-BR', 'Avaliar no Google'], ['es', 'Escribir una reseña en Google'], ['de', 'Review us on Google'],
  ])('keeps the configured destination and localizes %s', (language, label) => {
    expect(googleReviewLink(destination, language)).toEqual({ href: destination, label })
  })
  it('renders a plain crawlable review anchor in the shared footer without rating markup', () => {
    const html = renderToStaticMarkup(createElement(TenantPublicFooter, { name: 'Merchant', links: [], settings: { google_review_url: destination, language: 'pt' } }))
    expect(html).toContain(`href="${destination}"`)
    expect(html).toContain('Avaliar no Google</a>')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).not.toContain('aggregateRating')
    expect(html).not.toContain('application/ld+json')
  })
  it('does not render a review invitation when its configured URL is invalid', () => {
    const html = renderToStaticMarkup(createElement(TenantPublicFooter, { name: 'Merchant', links: [], settings: { google_review_url: 'http://g.page/merchant/review' } }))
    expect(html).not.toContain('Review us')
    expect(html).not.toContain('g.page')
  })
})
