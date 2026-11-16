import { describe, expect, it } from 'vitest'
import { deriveLocalLaunchFindings } from '@/lib/admin/local-launch-signals'

const html = (value: unknown) => `<script type="application/ld+json">${JSON.stringify(value)}</script>`
const restaurant = { '@type': 'Restaurant', openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: 'https://schema.org/Monday', opens: '09:00', closes: '21:00' }], sameAs: ['https://www.google.com/maps?cid=123456'] }

describe('local launch evidence is factual and restaurant-scoped', () => {
  it('does not add restaurant checks to company sites or malformed JSON', () => {
    expect(deriveLocalLaunchFindings(html({ '@type': 'Organization' }))).toEqual({})
    expect(deriveLocalLaunchFindings('<script type="application/ld+json">bad</script>')).toEqual({})
  })
  it('detects real hours and profile links without claiming ownership or schedule correctness', () => {
    const findings = deriveLocalLaunchFindings(html(restaurant))
    expect(findings.local_hours.ok).toBe(true)
    expect(findings.local_hours.evidence).toContain('confirm')
    expect(findings.gbp_link.ok).toBe(true)
    expect(findings.gbp_link.evidence).toContain('ownership and verification remain manual')
  })
  it('supports graph/array JSON-LD and separate script blocks', () => {
    expect(deriveLocalLaunchFindings(html({ '@graph': [{ '@type': 'WebSite' }, restaurant] })).local_hours.ok).toBe(true)
    expect(deriveLocalLaunchFindings(html([{ '@type': 'WebSite' }, restaurant])).gbp_link.ok).toBe(true)
    expect(deriveLocalLaunchFindings(html({ '@type': 'WebSite' }) + html(restaurant)).gbp_link.ok).toBe(true)
  })
  it.each([
    { dayOfWeek: 'Someday', opens: '09:00', closes: '21:00' },
    { dayOfWeek: 'Monday', opens: '25:00', closes: '21:00' },
    { dayOfWeek: 'Monday', opens: '9am', closes: '9pm' },
  ])('rejects incomplete/invalid opening specifications %j', hours => {
    expect(deriveLocalLaunchFindings(html({ ...restaurant, openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', ...hours }] })).local_hours.ok).toBe(false)
  })
  it.each(['https://www.google.com/maps/place/Independent+Restaurant', 'https://g.page/restaurant', 'https://maps.app.goo.gl/abc123'])('recognizes public Google profile/map URL %s', url => {
    expect(deriveLocalLaunchFindings(html({ ...restaurant, sameAs: [url] })).gbp_link.ok).toBe(true)
  })
  it.each(['http://google.com/maps?cid=123', 'https://evil.example/maps?cid=123', 'https://google.com.evil.example/maps?cid=123', 'https://www.google.com/maps/dir/?destination=Restaurant', 'https://www.google.com/maps/search/?query=Restaurant', 'https://g.page/restaurant/review', 'https://business.google.com', 'javascript:alert(1)'])('does not treat arbitrary/review/private URL %s as a public profile', url => {
    expect(deriveLocalLaunchFindings(html({ ...restaurant, sameAs: [url] })).gbp_link.ok).toBe(false)
  })
})
