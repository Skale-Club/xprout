import Image from 'next/image'
import { ctaStyle, ui } from '@/components/menu/menu-ui'
import { formatWeekday, getMenuCopy, localeFor } from '@/components/menu/menu-i18n'
import PageContactForm from './PageContactForm'
import PageLinksMenu from './PageLinksMenu'
import type { PublicLocation, PublicPage } from '@/lib/data/tenant-pages'
import { splitParagraphs, type PageSection } from '@/lib/pages/sections'
import { BRAND_PRIMARY } from '@/lib/brand'
import { computePrimaryForeground, safeCssColor } from '@/lib/color-utils'

/* eslint-disable @next/next/no-img-element -- section images are already-optimized uploads from any https host; next/image would refuse unlisted hosts */

const WEEK = [{ key: 'mon', index: 1 }, { key: 'tue', index: 2 }, { key: 'wed', index: 3 }, { key: 'thu', index: 4 }, { key: 'fri', index: 5 }, { key: 'sat', index: 6 }, { key: 'sun', index: 0 }]

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('')
const phoneHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`
const mapsHref = (location: PublicLocation) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([location.address, location.city].filter(Boolean).join(', '))}`

function Heading({ text }: { text?: string }) {
  return text ? <h2 className={`mb-5 text-zinc-900 ${ui.sectionTitle}`}>{text}</h2> : null
}

function Paragraphs({ body }: { body: string }) {
  return <div className="space-y-4 text-[16px] leading-relaxed text-zinc-700">{splitParagraphs(body).map((part, index) => <p key={index} className="whitespace-pre-line">{part}</p>)}</div>
}

function LocationCard({ location, tenantSlug, lang, copy, primary, foreground }: {
  location: PublicLocation; tenantSlug: string; lang: string; copy: ReturnType<typeof getMenuCopy>; primary: string; foreground: string
}) {
  const hours = location.business_hours
  const hasHours = !!hours && Object.values(hours).some(Boolean)
  const address = [location.address, location.city].filter(Boolean).join(', ')
  return (
    <li className="rounded-2xl bg-white p-5 shadow-card">
      {location.name && <h3 className="text-[18px] font-bold tracking-tight text-zinc-900">{location.name}</h3>}
      {address && <p className="mt-1 text-[15px] text-zinc-600">{address}</p>}
      {location.phone && <p className="mt-1 text-[15px] tabular-nums"><a href={phoneHref(location.phone)} className="font-medium text-zinc-900 underline-offset-2 hover:underline">{location.phone}</a></p>}
      {hasHours && (
        <dl className="mt-4 text-[14px]">
          <dt className={`mb-1 text-zinc-500 ${ui.label}`}>{copy.hoursTitle}</dt>
          {WEEK.map(({ key, index }) => (
            <div key={key} className="flex justify-between gap-4 border-b border-zinc-100 py-1.5 last:border-0">
              <dd className="capitalize text-zinc-600">{formatWeekday(index, lang)}</dd>
              <dd className="text-right tabular-nums text-zinc-900">{hours?.[key] || copy.closed}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        {address && (
          <a href={mapsHref(location)} target="_blank" rel="noopener noreferrer" className={`${ui.ctaQuiet} h-11 bg-zinc-100 text-zinc-900`}>{copy.pageOpenMaps}</a>
        )}
        <a href={location.slug ? `/${tenantSlug}/${location.slug}` : `/${tenantSlug}`} className={`${ui.cta} h-11`} style={ctaStyle(primary, foreground)}>{copy.pageViewMenu}</a>
      </div>
    </li>
  )
}

function Section({ section, page, tenant, locations, lang, primary, foreground }: {
  section: PageSection
  page: PublicPage
  tenant: { slug: string }
  locations: PublicLocation[]
  lang: string
  primary: string
  foreground: string
}) {
  const copy = getMenuCopy(lang)
  switch (section.type) {
    case 'text_image': {
      const image = section.image
      return (
        <section>
          <Heading text={section.heading} />
          <div className={`grid items-center gap-6 ${image ? 'md:grid-cols-2' : ''}`}>
            <Paragraphs body={section.body} />
            {image && (
              <img src={image} alt="" loading="lazy" decoding="async" className={`aspect-[4/3] w-full rounded-2xl object-cover shadow-card ${section.imageSide === 'left' ? 'md:order-first' : ''}`} />
            )}
          </div>
        </section>
      )
    }
    case 'cards':
      return (
        <section>
          <Heading text={section.heading} />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.items.map((item, index) => (
              <li key={index} className="overflow-hidden rounded-2xl bg-white shadow-card">
                {item.image && <img src={item.image} alt="" loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover" />}
                <div className="p-4">
                  <h3 className="text-[17px] font-bold tracking-tight text-zinc-900">{item.title}</h3>
                  {item.subtitle && <p className="mt-0.5 text-[14px] font-medium text-zinc-500">{item.subtitle}</p>}
                  {item.text && <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-zinc-700">{item.text}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )
    case 'faq':
      return (
        <section>
          <Heading text={section.heading} />
          <div className="divide-y divide-zinc-200/70 overflow-hidden rounded-2xl bg-white shadow-card">
            {section.items.map((item, index) => (
              <details key={index} className="group px-5 py-4">
                <summary className="cursor-pointer list-none text-[16px] font-semibold text-zinc-900 marker:hidden [&::-webkit-details-marker]:hidden">{item.question}</summary>
                <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-zinc-700">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )
    case 'locations':
      return locations.length === 0 ? null : (
        <section>
          <Heading text={section.heading} />
          <ul className="grid gap-4 md:grid-cols-2">
            {locations.map((location, index) => (
              <LocationCard key={`${location.slug ?? 'main'}-${index}`} location={location} tenantSlug={tenant.slug} lang={lang} copy={copy} primary={primary} foreground={foreground} />
            ))}
          </ul>
        </section>
      )
    case 'contact_form':
      return (
        <section>
          <Heading text={section.heading} />
          {section.intro && <p className="mb-4 whitespace-pre-line text-[16px] leading-relaxed text-zinc-700">{section.intro}</p>}
          <PageContactForm
            tenantSlug={tenant.slug}
            pageSlug={page.slug}
            primaryColor={primary}
            primaryForeground={foreground}
            copy={{ name: copy.pageName, email: copy.pageEmail, phone: copy.pagePhone, message: copy.pageMessage, send: copy.pageSend, sending: copy.pageSending, sent: copy.pageSent, error: copy.pageSendError }}
          />
        </section>
      )
    case 'button_link':
      return (
        <section className="rounded-2xl bg-white p-6 text-center shadow-card">
          {section.heading && <h2 className={`text-zinc-900 ${ui.sectionTitle}`}>{section.heading}</h2>}
          {section.text && <p className="mx-auto mt-2 max-w-xl whitespace-pre-line text-[16px] leading-relaxed text-zinc-700">{section.text}</p>}
          <a href={section.url} target="_blank" rel="noopener noreferrer" className={`${ui.cta} mt-5 h-12`} style={ctaStyle(primary, foreground)}>{section.label}</a>
        </section>
      )
  }
}

/**
 * A restaurant's website page: the same look as the public menu (tenant colours,
 * Inter, card and spacing styles), a header that links back to the menu, the
 * page's sections, and the other pages in the footer. Text is always rendered
 * escaped; nothing is embedded.
 */
export default function TenantPageView({ tenant, settings, page, nav, lang, baseUrl }: {
  tenant: { name: string; slug: string }
  settings: { logo_url?: string | null; primary_color?: string | null; accent_color?: string | null } | null
  page: PublicPage
  nav: ReadonlyArray<{ slug: string; title: string }>
  lang: string
  baseUrl?: string
}) {
  const base = (baseUrl ?? `/${tenant.slug}`).replace(/\/$/, '')
  const copy = getMenuCopy(lang)
  const primary = safeCssColor(settings?.primary_color ?? BRAND_PRIMARY)
  const foreground = computePrimaryForeground(settings?.primary_color ?? BRAND_PRIMARY)
  return (
    <div className="menu-root min-h-screen bg-menu text-zinc-900" lang={localeFor(lang)}>
      <style>{`:root{--primary:${primary};--primary-foreground:${foreground};}`}</style>
      <header className="border-b border-zinc-200/70 bg-white/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <a href={base || '/'} className="flex min-w-0 items-center gap-3" aria-label={tenant.name}>
            <span className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-white shadow-card ring-1 ring-black/5">
              {settings?.logo_url
                ? <Image src={settings.logo_url} alt="" fill sizes="44px" className="object-contain p-1.5" />
                : <span className="flex size-full items-center justify-center text-sm font-semibold text-zinc-700">{initials(tenant.name)}</span>}
            </span>
            <span className="truncate text-[17px] font-bold tracking-tight text-zinc-900">{tenant.name}</span>
          </a>
          <div className="flex shrink-0 items-center gap-2">
            <a href={base || '/'} className="hidden h-10 items-center rounded-full bg-white px-4 text-[14px] font-medium text-zinc-900 shadow-card ring-1 ring-black/5 sm:flex">{baseUrl !== undefined ? tenant.name : copy.pageViewMenu}</a>
            <PageLinksMenu tenantSlug={tenant.slug} links={nav} label={copy.pagesMore} variant="bar" baseUrl={base} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-zinc-900 sm:text-[36px]">{page.title}</h1>
        <div className="mt-8 space-y-10 sm:mt-10 sm:space-y-12">
          {page.sections.map(section => (
            <Section key={section.id} section={section} page={page} tenant={tenant} locations={page.locations} lang={lang} primary={primary} foreground={foreground} />
          ))}
        </div>
      </main>

      <footer className="mt-8 border-t border-zinc-200/70">
        <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
          <nav aria-label={tenant.name}>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[15px] font-medium">
              <li><a href={base || '/'} className="text-zinc-900 underline-offset-2 hover:underline">{baseUrl !== undefined ? tenant.name : copy.pageViewMenu}</a></li>
              {nav.map(link => (
                <li key={link.slug}><a href={`${base}/${link.slug}`} className="text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline" {...(link.slug === page.slug ? { 'aria-current': 'page' as const } : {})}>{link.title}</a></li>
              ))}
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  )
}
