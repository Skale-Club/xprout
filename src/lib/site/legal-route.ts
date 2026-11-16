import { notFound, redirect } from 'next/navigation'
import { requestSite } from './request-runtime'

/** A partner must supply its own legal destination; never display another company's terms. */
export async function partnerLegalRoute(kind: 'privacy'|'terms'): Promise<void> {
  const site = await requestSite()
  if (site.brand.id === '00000000-0000-4000-8000-000000000001') return
  const configured = kind === 'privacy' ? site.brand.privacy_url : site.brand.terms_url
  if (configured) {
    try {
      const url = new URL(configured)
      if (url.protocol === 'https:' && !url.username && !url.password && `${url.origin}${url.pathname}` !== `${site.origin}/${kind}`) redirect(url.href)
    } catch (error) {
      if (error instanceof Error && 'digest' in error) throw error
    }
  }
  notFound()
}
