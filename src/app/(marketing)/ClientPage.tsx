'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Globe, QrCode, Sparkles, ShoppingCart, ChevronDown, MessageCircle, UserPlus, UtensilsCrossed, ArrowRight, Sandwich, CupSoda, Zap, Star, ChefHat, CreditCard, BookOpen, Coffee, BarChart2, Search, Palette, ClipboardList, Link2, ArrowUpRight, Box } from 'lucide-react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { DeliveryImage } from '@/components/delivery-image'
import { Nav, Footer, type FooterData } from '@/components/marketing/MarketingChrome'
import MenuShowcase from '@/components/marketing/MenuShowcase'
import { useMarketingMotionPreference } from '@/components/marketing/MarketingMotion'
import { PROJECTS, PLANS, PRICING_PATH, formatUsd } from '@/lib/marketing/pricing'
import { contrastRatio, readableTextColor, safeCssColor } from '@/lib/color-utils'

const AdminLoginModal = dynamic(() => import('@/components/auth/AdminLoginModal'), { ssr: false })

interface HeroSettings {
  badge?: string
  heading?: string
  heading_highlight?: string
  subheading?: string
  cta_primary?: string
  cta_secondary?: string
  bg_type?: 'color' | 'image' | 'video'
  bg_color?: string
  bg_image_url?: string
  bg_video_url?: string
}
interface HowItWorksData {
  title?: string
  subtitle?: string
  steps?: Array<{ step?: string; icon?: string; title: string; desc: string }>
}
interface FeaturesData {
  title?: string
  subtitle?: string
  items?: Array<{ icon?: string; title: string; desc: string }>
}
interface CtaData {
  heading?: string
  text?: string
  button?: string
  bg_image_url?: string
}
interface LandingData {
  hero?: HeroSettings | null
  how_it_works?: HowItWorksData | null
  features?: FeaturesData | null
  cta?: CtaData | null
  footer?: FooterData | null
}

const steps = [
  { step: '01', icon: ClipboardList, title: 'Bring your menu', body: 'Start with the dishes, prices and photos you already have. We help you choose the right setup.' },
  { step: '02', icon: UtensilsCrossed, title: 'Make it your own', body: 'Your food, your logo, your languages. Add your own dishes or have our team put it together.' },
  { step: '03', icon: QrCode, title: 'Set the table', body: 'Share your menu link or place a QR code at the table. Guests open it right in their browser.' },
]
const features = [
  { icon: BookOpen, title: 'A menu with your character', body: 'Bring together your dishes, photography, descriptions and prices in a menu that feels like your restaurant.' },
  { icon: Globe, title: 'A warmer welcome', body: 'Offer your menu in your chosen languages, so more guests can feel at home at your table.' },
  { icon: QrCode, title: 'One small code. Your whole menu.', body: 'Share a link, print a QR code or add NFC stands. Guests open the menu without downloading an app.' },
  { icon: ShoppingCart, title: 'More ways to serve', body: 'Start with a menu. Add table ordering or payments when they suit your service and selected plan.' },
]
const faqs = [
  { q: 'What does it cost?', a: `Menu projects start at ${formatUsd(PROJECTS.diy.launch)}, with ongoing plans from ${formatUsd(PLANS.menu.monthly)}/month. Choose to add the items yourself or have our team build the menu. The pricing page explains both.` },
  { q: 'Can you build the menu for me?', a: 'Yes. Send us your menu and dish photos, and our team can put it together. Prefer to add your own items? There is a project option for that, too.' },
  { q: 'Can my menu be in multiple languages?', a: 'Yes. Choose the languages you need. Additional languages are available, with the options and prices explained on our pricing page.' },
  { q: 'Do guests need to download an app?', a: 'No. Guests scan a QR code, tap an NFC stand or open your link. The menu opens in their phone browser. NFC stands and plates are sold separately.' },
  { q: 'Can guests order and pay from the menu?', a: 'Table ordering and menu payments are available on the relevant plans. You can start with a read-only menu and choose the service that fits your restaurant.' },
  { q: 'What happens to my data if I leave?', a: 'Your menu content is yours. Contact us and we can help you export it before you leave.' },
]

function FoodDrinkCombo({ className }: { className?: string }) {
  return <span className={`inline-flex items-center gap-0.5 ${className ?? ''}`}><Sandwich className="size-4" /><CupSoda className="size-4" /></span>
}
function getIcon(name: string): React.ComponentType<{ className?: string }> {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    Globe, Globe2: Globe, QrCode, Sparkles, ShoppingCart, UserPlus, UtensilsCrossed, MessageCircle, Zap, Star, ChefHat,
    CreditCard, BookOpen, Coffee, BarChart2, Search, Sandwich, CupSoda, FoodDrink: FoodDrinkCombo, Palette, ClipboardList, Link2,
  }
  return icons[name] ?? Globe
}

/** Keep configured video deferred; mobile, reduced-motion and data-saving visitors keep the poster. */
function DeferredHeroVideo({ src, poster, onError }: { src: string; poster?: string; onError: () => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const playing = useMarketingMotionPreference() === 'playing'
  useEffect(() => {
    if (!playing || window.innerWidth < 768) return
    let cancelled = false
    const idle = (cb: () => void) => {
      const browser = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }
      if (browser.requestIdleCallback) browser.requestIdleCallback(cb, { timeout: 4000 })
      else setTimeout(cb, 2000)
    }
    const start = () => idle(() => { if (!cancelled) setReady(true) })
    if (document.readyState === 'complete') start()
    else window.addEventListener('load', start, { once: true })
    return () => { cancelled = true; window.removeEventListener('load', start) }
  }, [playing])
  useEffect(() => {
    const video = ref.current
    if (!video) return
    if (!ready || !playing) { video.pause(); return }
    let visible = video.getBoundingClientRect().bottom > 0 && video.getBoundingClientRect().top < innerHeight
    const sync = () => {
      if (visible && !document.hidden) video.play().catch(() => { /* Keep the configured poster when autoplay is refused. */ })
      else video.pause()
    }
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting === true; sync()
    }) : null
    observer?.observe(video)
    document.addEventListener('visibilitychange', sync)
    sync()
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', sync); video.pause() }
  }, [ready, playing])
  return <video ref={ref} muted loop playsInline preload="none" className="absolute inset-0 size-full object-cover"
    src={ready ? src : undefined} poster={poster} onError={onError} />
}

function Hero({ s, onLoginOpen }: { s: HeroSettings; onLoginOpen: () => void }) {
  const [videoError, setVideoError] = useState(false)
  const bgType = s.bg_type ?? 'color'
  const bgImage = s.bg_image_url ?? ''
  const bgVideo = s.bg_video_url ?? ''
  const color = bgType === 'color' ? safeCssColor(s.bg_color, '#F3EFE5') : '#F3EFE5'
  const hasMedia = (bgType === 'image' && !!bgImage) || (bgType === 'video' && !!(bgVideo || bgImage))
  const dark = hasMedia || contrastRatio('#F3EFE5', color) >= 4.5
  const style = !hasMedia ? {
    backgroundColor: color,
    color: dark ? '#F3EFE5' : readableTextColor('#20372b', color),
    '--mk-ink': dark ? '#F3EFE5' : readableTextColor('#20372b', color),
    '--mk-muted': readableTextColor(dark ? '#d5ddcf' : '#59675e', color),
    '--mk-line': dark ? '#718174' : '#d4d9cd',
  } as React.CSSProperties : undefined

  return <section className={`mk-hero relative isolate py-10 md:py-12 ${!hasMedia && color.toLowerCase() === '#f3efe5' ? 'mk-hero-paper' : ''} ${dark ? 'mk-dark' : ''}`} style={style} aria-labelledby="hero-title">
    {bgType === 'video' && bgVideo && !videoError ? <DeferredHeroVideo src={bgVideo} poster={bgImage || undefined} onError={() => setVideoError(true)} /> : null}
    {bgImage && (bgType === 'image' || (bgType === 'video' && (!bgVideo || videoError))) ?
      <DeliveryImage src={bgImage} alt="" aria-hidden="true" fill sizes="100vw" className="object-cover" /> : null}
    {hasMedia ? <div className="absolute inset-0 bg-[#14271d]/85" aria-hidden="true" /> : null}
    <div className="mk-container relative grid min-w-0 items-center gap-8 md:grid-cols-[1.1fr_1fr] md:gap-10 lg:gap-12">
      <div className="mk-hero-copy min-w-0">
        <p className="mk-eyebrow mb-4">{s.badge ?? 'Digital menus, thoughtfully served'}</p>
        <h1 id="hero-title" className="mk-display max-w-2xl">
          {s.heading ?? 'Your food has a story.'}{' '}
          <span className="block">{s.heading_highlight ?? 'Give it a menu to match.'}</span>
        </h1>
        <p className="mk-lead mt-5 max-w-lg">{s.subheading ?? 'A digital menu that feels like your restaurant. Beautiful dishes, clear choices and a little more time to enjoy the table.'}</p>
        <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <button type="button" onClick={onLoginOpen} className={`mk-button ${dark ? 'mk-button--light' : ''}`}>
            {s.cta_primary ?? 'Start'} <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
          </button>
          <a href="#how-it-works" className="mk-button mk-button--outline">{s.cta_secondary ?? 'See how it works'}</a>
        </div>
        <p className="mk-muted mt-4 text-sm leading-relaxed">Your own identity. A link to share.<br className="sm:hidden" /> No app for guests to download.</p>
      </div>
      <figure className="mk-hero-art relative m-0 min-w-0 pb-12 sm:pb-8">
        <div className="mk-hero-halo" aria-hidden="true" />
        <div className="mk-hero-photo relative aspect-square overflow-hidden rounded-t-[5rem] rounded-b-3xl border border-[var(--mk-line)] md:aspect-[6/5]">
          <DeliveryImage src="/brands/bella-vista/tagliatelle-al-ragu.webp" alt="Tagliatelle al ragù with parmesan and basil, from the Bella Vista menu" fill preload
            sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1239px) 45vw, 549px" className="object-cover" />
        </div>
        <div className="mk-hero-label absolute -top-4 right-3 z-10 inline-flex max-w-[calc(100%_-_1.5rem)] items-center gap-2 rounded-full border border-[#d4d9cd] bg-[#F3EFE5] px-4 py-3 text-xs font-semibold text-[#20372b]">
          <QrCode className="size-4 shrink-0" aria-hidden="true" />
          <span>One scan. A whole experience.</span>
        </div>
        <figcaption className="mk-hero-caption absolute bottom-0 left-3 right-3 rounded-2xl border border-[#d4d9cd] bg-[#fbf8f0] p-4 text-[#20372b] lg:-left-6 lg:right-8 lg:p-6">
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-[#d4d9cd] pb-3">
            <span className="text-xs font-semibold uppercase tracking-[0.12em]">A taste of Bella Vista</span>
            <UtensilsCrossed className="size-4 shrink-0" aria-hidden="true" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0"><p className="text-lg font-semibold">Tagliatelle al ragù</p><p className="mt-1 text-sm text-[#59675e]">A dish worth a closer look.</p></div>
            <Link href="/bella-vista" prefetch={false} aria-label="Explore the Bella Vista menu example" className="grid size-12 shrink-0 place-items-center rounded-full border border-[#d4d9cd] transition-colors hover:bg-[#F3EFE5] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#283F32]">
              <ArrowUpRight className="size-5" aria-hidden="true" />
            </Link>
          </div>
        </figcaption>
      </figure>
    </div>
  </section>
}

function FeatureRibbon() {
  const items = [
    { icon: QrCode, label: 'QR menus' },
    { icon: BookOpen, label: 'Photo feeds' },
    { icon: Box, label: 'Selected 3D' },
    { icon: Palette, label: 'Your identity' },
  ]
  return <div className="mk-feature-ribbon">
    <ul aria-label="Ways to experience your menu" className="mk-container grid grid-cols-2 gap-5 py-7 lg:grid-cols-4">
      {items.map(({ icon: Icon, label }) => <li key={label} className="flex min-w-0 items-center justify-center gap-3 text-sm font-semibold sm:text-base">
        <Icon className="size-5 shrink-0" aria-hidden="true" /><span>{label}</span>
      </li>)}
    </ul>
  </div>
}

function HowItWorks({ data }: { data?: HowItWorksData | null }) {
  const resolved = data?.steps?.length ? data.steps.map((step, index) => ({
    step: step.step ?? String(index + 1).padStart(2, '0'), icon: getIcon(step.icon ?? ''), title: step.title, body: step.desc,
  })) : steps
  return <section id="how-it-works" className="mk-process mk-section scroll-mt-24 border-t border-[var(--mk-line)]" aria-labelledby="process-title">
    <div className="mk-container">
      <div className="mb-10 grid gap-5 md:mb-14 md:grid-cols-2 md:items-end">
        <div><p className="mk-eyebrow mb-4">From your kitchen to their screen</p><h2 id="process-title" className="mk-h2 max-w-xl">{data?.title ?? 'Good service starts with a simple setup.'}</h2></div>
        <p className="mk-lead max-w-md md:justify-self-end">{data?.subtitle ?? 'We make room for the way you work, whether you want to add the dishes yourself or leave the setup to us.'}</p>
      </div>
      <ol className="grid gap-8 md:grid-cols-3 md:gap-10">
        {resolved.map(({ step, icon: Icon, title, body }, index) => <li key={`${step}-${index}`} className="min-w-0 border-t border-[var(--mk-line)] pt-6">
          <div className="mb-7 flex items-center justify-between"><span className="mk-eyebrow">{step}</span><Icon className="size-6" aria-hidden="true" /></div>
          <h3 className="mb-3 text-xl font-semibold">{title}</h3><p className="mk-muted text-base leading-relaxed">{body}</p>
        </li>)}
      </ol>
    </div>
  </section>
}

function FeatureBlocks({ data }: { data?: FeaturesData | null }) {
  const resolved = data?.items?.length ? data.items.map(item => ({ icon: getIcon(item.icon ?? ''), title: item.title, body: item.desc })) : features
  return <section className="mk-dark mk-section" aria-labelledby="features-title">
    <div className="mk-container">
      <div className="mb-12 grid gap-6 md:grid-cols-[1.15fr_1fr] md:items-end">
        <div><p className="mk-eyebrow mb-4">Made around your service</p><h2 id="features-title" className="mk-h2 max-w-xl">{data?.title ?? 'More than a menu. A better welcome.'}</h2></div>
        <p className="mk-lead max-w-md md:justify-self-end">{data?.subtitle ?? 'Make the first look inviting, the choices clear and the next step easy. Choose the tools your restaurant needs.'}</p>
      </div>
      <div className="grid grid-cols-1 gap-x-12 gap-y-9 sm:grid-cols-2">
        {resolved.map(({ icon: Icon, title, body }, index) => <article key={`${title}-${index}`} className="grid min-w-0 grid-cols-[40px_1fr] gap-4 border-t border-[var(--mk-line)] pt-7 sm:gap-5">
          <Icon className="mt-1 size-7" aria-hidden="true" />
          <div className="min-w-0"><h3 className="mb-3 text-xl font-semibold">{title}</h3><p className="mk-muted text-base leading-relaxed">{body}</p></div>
        </article>)}
      </div>
      <p className="mk-muted mt-12 max-w-2xl border-t border-[var(--mk-line)] pt-6 text-sm leading-relaxed">Ordering, payments, selected 3D dishes and optional AI services depend on your plan and setup. Start with what your restaurant needs today.</p>
    </div>
  </section>
}

function PricingTeaser() {
  return <section className="mk-pricing-teaser mk-section" aria-labelledby="pricing-title">
    <div className="mk-container grid gap-10 md:grid-cols-[1.15fr_1fr] md:items-center">
      <div><p className="mk-eyebrow mb-4">A place to start</p><h2 id="pricing-title" className="mk-h2 max-w-xl">A clear price.<br />Room to grow.</h2>
        <p className="mk-lead mt-6 max-w-lg">A one-time project to get your menu ready, then a plan to keep it running. Choose how much you want our team to take care of.</p>
        <a href={PRICING_PATH} className="mk-button mk-button--outline mt-8">Explore pricing <ArrowRight className="size-4" aria-hidden="true" /></a>
      </div>
      <div className="mk-panel min-w-0 p-7 sm:p-10">
        <p className="mk-eyebrow mb-5">Menu project · from</p>
        <p className="mk-price text-5xl sm:text-6xl">{formatUsd(PROJECTS.diy.launch)}</p>
        <p className="mk-muted mt-3 text-base">One-time setup · you add the items</p>
        <div className="mt-8 border-t border-[var(--mk-line)] pt-6"><p className="text-lg font-semibold">Then from {formatUsd(PLANS.menu.monthly)} / month</p><p className="mk-muted mt-2 text-sm leading-relaxed">The first month is included in the project. Full options, add-ons and terms are on our pricing page.</p></div>
      </div>
    </div>
  </section>
}

function FAQ() {
  return <section className="mk-section border-t border-[var(--mk-line)]" aria-labelledby="faq-title">
    <div className="mk-container grid items-start gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
      <div><p className="mk-eyebrow mb-4">A few things to know</p><h2 id="faq-title" className="mk-h2">Before we<br className="hidden lg:block" /> set the table.</h2><p className="mk-lead mt-5 max-w-sm">Straight answers, so you can get back to what you do best.</p></div>
      <div className="min-w-0 border-t border-[var(--mk-line)]">
        {faqs.map(({ q, a }) => <details key={q} className="group border-b border-[var(--mk-line)] [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-5 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--mk-forest)] sm:text-lg">
            {q}<ChevronDown className="size-5 shrink-0 transition-transform motion-reduce:transition-none group-open:rotate-180" aria-hidden="true" />
          </summary>
          <p className="mk-muted max-w-xl pb-6 pr-8 text-base leading-relaxed">{a}</p>
        </details>)}
      </div>
    </div>
  </section>
}

function FooterCTABand({ data, onLoginOpen }: { data?: CtaData | null; onLoginOpen: () => void }) {
  return <section className="mk-invitation mk-dark mk-section relative isolate" aria-labelledby="invitation-title">
    {data?.bg_image_url ? <><DeliveryImage src={data.bg_image_url} alt="" aria-hidden="true" fill sizes="100vw" className="object-cover" /><div className="absolute inset-0 bg-[#14271d]/90" aria-hidden="true" /></> : null}
    <div className="mk-container relative grid gap-8 md:grid-cols-[1.2fr_0.8fr] md:items-end">
      <div><p className="mk-eyebrow mb-5">Your next chapter</p><h2 id="invitation-title" className="mk-h2 max-w-2xl whitespace-pre-line">{data?.heading ?? 'Something good is taking shape.'}</h2>
        <p className="mk-lead mt-6 max-w-xl">{data?.text ?? 'Bring your menu, your ideas and your appetite for what comes next. We will help you put them on the table.'}</p>
      </div>
      <div className="md:justify-self-end"><button type="button" onClick={onLoginOpen} className="mk-button mk-button--light w-full sm:w-auto">{data?.button ?? 'Start'} <ArrowRight className="size-4" aria-hidden="true" /></button></div>
    </div>
  </section>
}

export default function ClientLandingPage({ platformLanding, appName, logoUrl }: { platformLanding?: unknown; appName?: string | null; logoUrl?: string | null }) {
  const landing = platformLanding && typeof platformLanding === 'object' ? platformLanding as LandingData : null
  const [loginOpen, setLoginOpen] = useState(false)
  return <div className="min-h-screen bg-[var(--mk-paper)] text-[var(--mk-ink)]">
      <Nav appName={appName} logoUrl={logoUrl} onLoginOpen={() => setLoginOpen(true)} />
      <main>
        <Hero s={landing?.hero ?? {}} onLoginOpen={() => setLoginOpen(true)} />
        <FeatureRibbon />
        <MenuShowcase />
        <HowItWorks data={landing?.how_it_works} />
        <FeatureBlocks data={landing?.features} />
        <PricingTeaser />
        <FAQ />
        <FooterCTABand data={landing?.cta} onLoginOpen={() => setLoginOpen(true)} />
      </main>
      <Footer data={landing?.footer} appName={appName} logoUrl={logoUrl} />
      <AdminLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} logoUrl={logoUrl} />
    </div>
}
