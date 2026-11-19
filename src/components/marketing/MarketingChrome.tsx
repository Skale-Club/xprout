'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { BRAND_NAME } from '@/lib/brand'
import { DeliveryImage } from '@/components/delivery-image'
import PlatformSignature from '@/components/branding/PlatformSignature'
import { isDefaultPlatformLogo, platformLogoUrl } from '@/lib/platform-brand'
import { PublicLanguagePicker, usePublicLocale } from './PublicLocale'
import { PRICING_PATH } from '@/lib/marketing/pricing'

export interface FooterData { copyright?: string }

function Brand({ appName, logoUrl, tone }: { appName?: string | null; logoUrl?: string | null; tone: 'forest' | 'ivory' }) {
  const name = appName ?? BRAND_NAME
  return name === BRAND_NAME && isDefaultPlatformLogo(logoUrl)
    ? <PlatformSignature tone={tone} />
    : <span className="inline-flex min-w-0 items-center gap-2"><DeliveryImage src={platformLogoUrl(logoUrl)} width={32} height={32} sizes="32px" alt="" className="size-8 shrink-0 object-contain" /><span className="truncate text-lg font-semibold">{name}</span></span>
}

export function Nav({ appName, logoUrl, onLoginOpen, startHref, activePage = 'home' }: {
  appName?: string | null; logoUrl?: string | null; onLoginOpen?: () => void; startHref?: string; activePage?: 'home' | 'pricing'
}) {
  const { t, href } = usePublicLocale()
  const [open, setOpen] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); toggle.current?.focus() } }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [open])
  const links = <>
    <Link className="mk-nav-link" href={href('/#demo-store')} onClick={() => setOpen(false)}>{t('Demo store')}</Link>
    <Link className="mk-nav-link" href={href('/#how-it-works')} onClick={() => setOpen(false)}>{t('How it works')}</Link>
    <Link className="mk-nav-link" href={href(PRICING_PATH)} aria-current={activePage === 'pricing' ? 'page' : undefined} onClick={() => setOpen(false)}>{t('Pricing')}</Link>
  </>
  return <nav className="mk-nav mk-dark" aria-label={t('Main navigation')}>
    <div className="mk-container mk-nav-inner">
      <Link href={href('/')} aria-label={`${appName ?? BRAND_NAME} ${t('home')}`} className="mk-nav-brand min-w-0"><Brand appName={appName} logoUrl={logoUrl} tone="ivory" /></Link>
      <div className="mk-nav-links">{links}</div>
      <div className="mk-nav-actions shrink-0">
        <PublicLanguagePicker align="left" />
        {startHref ? <Link href={href(startHref)} onClick={() => setOpen(false)} className="mk-button mk-button--light mk-nav-cta">{t('Get started')}</Link>
          : <button type="button" onClick={() => { setOpen(false); onLoginOpen?.() }} className="mk-button mk-button--light mk-nav-cta">{t('Get started')}</button>}
        <button ref={toggle} type="button" className="mk-nav-toggle" aria-label={open ? t('Close navigation') : t('Open navigation')} aria-expanded={open} aria-controls="marketing-mobile-navigation" onClick={() => setOpen(value => !value)}>{open ? <X size={18} /> : <Menu size={18} />}</button>
      </div>
    </div>
    {open ? <div id="marketing-mobile-navigation" className="mk-mobile-nav">{links}</div> : null}
    <div aria-hidden="true" className="mk-scroll-progress" />
  </nav>
}

export function Footer({ data, appName, logoUrl }: { data?: FooterData | null; appName?: string | null; logoUrl?: string | null }) {
  const { t, href } = usePublicLocale()
  const copyright = data?.copyright ? `© ${t(data.copyright)}` : `© 2026 ${appName ?? BRAND_NAME}. ${t('All rights reserved.')}`
  return <footer className="mk-footer mk-dark">
    <div className="mk-container">
      <div className="mk-footer-grid">
        <div>
          <Link href={href('/')} aria-label={`${appName ?? BRAND_NAME} ${t('home')}`} className="mk-footer-brand inline-block"><Brand appName={appName} logoUrl={logoUrl} tone="ivory" /></Link>
          <p className="mt-1 max-w-xs text-[15px] leading-snug text-[var(--mk-muted)]">{t('Visual menus that bring your food closer.')}</p>
        </div>
        <div><span className="mk-footer-label">{t('Explore')} {appName ?? BRAND_NAME}</span><ul className="mk-footer-links">
          <li><Link href={href('/#demo-store')}>{t('Demo store')}</Link></li>
          <li><Link href={href('/#how-it-works')}>{t('How it works')}</Link></li>
          <li><Link href={href(PRICING_PATH)}>{t('Plans & pricing')}</Link></li>
        </ul></div>
        <div><span className="mk-footer-label">{t('The essentials')}</span><ul className="mk-footer-links">
          <li><Link href={href('/privacy')}>{t('Privacy policy')}</Link></li>
          <li><Link href={href('/terms')}>{t('Terms of service')}</Link></li>
        </ul></div>
      </div>
      <div className="mk-footer-bottom"><p>{copyright}</p><p>{t('Made for the way restaurants serve.')}</p></div>
    </div>
  </footer>
}
