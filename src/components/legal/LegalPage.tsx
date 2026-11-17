/**
 * Shared shell for /terms and /privacy, inside the marketing site's own header
 * and footer.
 *
 * Content comes from `platform_settings.legal`, edited in the superadmin
 * Platform Settings panel. While a document is unpublished the page keeps the
 * original placeholder instead of rendering an empty shell — a legal page that
 * silently goes blank is worse than one that says it is being prepared.
 */
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'
import { legalOutline, pickLegalDoc, renderLegalBody, type LegalDoc } from '@/lib/marketing/legal-doc'
import { platformSettingsOwned } from '@/lib/data/platform-settings'
import { getMarketingChrome } from '@/lib/marketing/marketing-chrome'
import { Footer, Nav } from '@/components/marketing/MarketingChrome'

export type LegalKey = 'terms' | 'privacy'

const FALLBACK_TITLE: Record<LegalKey, string> = {
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
}

const SUMMARY: Record<LegalKey, string> = {
  privacy: 'What we collect when restaurants and their guests use Xprout, why, and the choices you have.',
  terms: 'The rules for using Xprout, for the restaurants that run their menus on it and the guests who visit them.',
}

const DOCUMENTS: { key: LegalKey; href: string; label: string }[] = [
  { key: 'privacy', href: '/privacy', label: 'Privacy policy' },
  { key: 'terms', href: '/terms', label: 'Terms of service' },
]

export async function getLegalDoc(key: LegalKey): Promise<LegalDoc | null> {
  try {
    if (platformSettingsOwned()) {
      // Own PostgreSQL only: a failure shows the placeholder, never the stale Supabase copy.
      const { readOwnedPlatformSettings } = await import('@/lib/data/platform-settings-runtime')
      return pickLegalDoc((await readOwnedPlatformSettings(['legal']))?.legal, key)
    }
    const service = createServiceClient()
    const { data } = await service.from('platform_settings').select('legal').single()
    return pickLegalDoc(data?.legal, key)
  } catch {
    // Settings unreachable: fall back to the placeholder rather than 500ing a
    // page that legal/compliance links point at.
    return null
  }
}

export function legalTitle(key: LegalKey, doc: LegalDoc | null): string {
  return doc?.title ?? FALLBACK_TITLE[key]
}

export default async function LegalPage({ docKey }: { docKey: LegalKey }) {
  const [doc, chrome] = await Promise.all([getLegalDoc(docKey), getMarketingChrome()])
  const title = legalTitle(docKey, doc)
  const outline = doc?.body ? legalOutline(doc.body) : []

  return (
    <div className="min-h-screen bg-[var(--mk-paper)] text-[var(--mk-ink)]">
      {/* "Get started" opens the same sign-in popup as the home page. */}
      <Nav appName={chrome.appName} logoUrl={chrome.logoUrl} startHref="/?signin=1" />
      <main className="mk-legal">
        <header className="mk-legal-hero">
          <div className="mk-container">
            <nav aria-label="Legal documents" className="mk-legal-switch">
              {DOCUMENTS.map(item => <Link key={item.key} href={item.href} aria-current={item.key === docKey ? 'page' : undefined}>{item.label}</Link>)}
            </nav>
            <h1 className="mk-display mt-8 max-w-3xl">{title}</h1>
            <p className="mk-lead mt-5 max-w-2xl">{SUMMARY[docKey]}</p>
            {doc?.updated_at ? <p className="mk-legal-updated">Last updated {doc.updated_at}</p> : null}
          </div>
        </header>

        <div className="mk-container mk-legal-grid">
          {outline.length > 1 ? (
            <nav aria-label="On this page" className="mk-legal-toc">
              <p className="mk-eyebrow mb-4">On this page</p>
              <ol>
                {outline.map(section => <li key={section.id}>
                  <a href={`#${section.id}`}>
                    {section.number ? <span className="mk-legal-num" aria-hidden="true">{section.number.padStart(2, '0')}</span> : null}
                    <span>{section.label}</span>
                  </a>
                </li>)}
              </ol>
            </nav>
          ) : <div aria-hidden="true" />}

          <article className="mk-legal-body">
            {doc?.body ? renderLegalBody(doc.body) : (
              <p>Coming soon: our legal documents are being prepared.</p>
            )}
            <aside className="mk-legal-next">
              {DOCUMENTS.filter(item => item.key !== docKey).map(item => <Link key={item.key} href={item.href}>
                <span className="mk-eyebrow">Also read</span>
                <span className="mk-legal-next-title">{item.label} <span aria-hidden="true">→</span></span>
              </Link>)}
            </aside>
          </article>
        </div>
      </main>
      <Footer data={chrome.footerData} appName={chrome.appName} logoUrl={chrome.logoUrl} />
    </div>
  )
}
