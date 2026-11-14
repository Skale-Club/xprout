'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Menu, X, ArrowUpRight } from 'lucide-react'
import { BRAND_NAME } from '@/lib/brand'
import { DeliveryImage } from '@/components/delivery-image'
import PlatformSignature from '@/components/branding/PlatformSignature'
import { isDefaultPlatformLogo, platformLogoUrl } from '@/lib/platform-brand'
import { PRICING_PATH } from '@/lib/marketing/pricing'

export interface FooterData { copyright?: string }

function Brand({ appName, logoUrl, tone }: { appName?: string | null; logoUrl?: string | null; tone: 'forest' | 'ivory' }) {
  const name = appName ?? BRAND_NAME
  return name === BRAND_NAME && isDefaultPlatformLogo(logoUrl)
    ? <PlatformSignature tone={tone} />
    : <span className="inline-flex items-center gap-3"><DeliveryImage src={platformLogoUrl(logoUrl)} width={32} height={32} sizes="32px" alt="" className="size-8 object-contain" /><span className="text-lg font-semibold">{name}</span></span>
}

export function Nav({ appName, logoUrl, onLoginOpen, startHref, activePage = 'home' }: {
  appName?: string | null; logoUrl?: string | null; onLoginOpen?: () => void; startHref?: string; activePage?: 'home' | 'pricing'
}) {
  const [open, setOpen] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); toggle.current?.focus() } }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [open])
  const links = <>
    <Link className="mk-nav-link" href="/#experience" onClick={() => setOpen(false)}>The experience</Link>
    <Link className="mk-nav-link" href="/#how-it-works" onClick={() => setOpen(false)}>How it works</Link>
    <Link className="mk-nav-link" href={PRICING_PATH} aria-current={activePage === 'pricing' ? 'page' : undefined} onClick={() => setOpen(false)}>Pricing</Link>
  </>
  return <nav className="mk-nav mk-dark" aria-label="Main navigation">
    <div className="mk-container mk-nav-inner">
      <Link href="/" aria-label={`${appName ?? BRAND_NAME} home`} className="shrink-0"><Brand appName={appName} logoUrl={logoUrl} tone="ivory" /></Link>
      <div className="mk-nav-links">{links}</div>
      <div className="mk-nav-actions">
        {startHref ? <Link href={startHref} className="mk-button mk-button--light mk-nav-cta">Start<span className="hidden lg:inline"> your menu</span></Link>
          : <button type="button" onClick={onLoginOpen} className="mk-button mk-button--light mk-nav-cta">Start<span className="hidden lg:inline"> your menu</span></button>}
        <button ref={toggle} type="button" className="mk-nav-toggle" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="marketing-mobile-navigation" onClick={() => setOpen(value => !value)}>{open ? <X size={18} /> : <Menu size={18} />}</button>
      </div>
    </div>
    {open ? <div id="marketing-mobile-navigation" className="mk-mobile-nav">{links}</div> : null}
  </nav>
}

export function Footer({ data, appName, logoUrl }: { data?: FooterData | null; appName?: string | null; logoUrl?: string | null }) {
  const copyright = data?.copyright ? `© ${data.copyright}` : `© 2026 ${appName ?? BRAND_NAME}. All rights reserved.`
  return <footer className="mk-footer mk-dark">
    <div className="mk-container">
      <div className="mk-footer-grid">
        <div>
          <Link href="/" aria-label={`${appName ?? BRAND_NAME} home`} className="inline-block"><Brand appName={appName} logoUrl={logoUrl} tone="ivory" /></Link>
          <p className="mk-lead mt-5 max-w-xs">Good food deserves a great first impression.</p>
          <p className="mt-4 text-xs text-[var(--mk-muted)]">Digital menus. Real hospitality.</p>
        </div>
        <div><span className="mk-footer-label">Explore {appName ?? BRAND_NAME}</span><ul className="mk-footer-links">
          <li><Link href="/#experience">The menu experience</Link></li>
          <li><Link href="/#how-it-works">How it works</Link></li>
          <li><Link href={PRICING_PATH}>Plans &amp; pricing</Link></li>
          <li><Link href="/aurora" className="inline-flex items-center gap-2">Explore a live menu <ArrowUpRight size={14} /></Link></li>
        </ul></div>
        <div><span className="mk-footer-label">The essentials</span><ul className="mk-footer-links">
          <li><Link href="/privacy">Privacy policy</Link></li>
          <li><Link href="/terms">Terms of service</Link></li>
        </ul></div>
      </div>
      <div className="mk-footer-bottom"><p>{copyright}</p><p>Made for the way restaurants serve.</p></div>
    </div>
  </footer>
}
