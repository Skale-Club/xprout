import Image from 'next/image'
import PageLinksMenu from './PageLinksMenu'

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('')

/**
 * The header every restaurant page shares (its website pages and its dish pages): the logo and
 * name back to the restaurant's home, a button back to the menu, and the restaurant's other pages.
 */
export default function TenantSiteHeader({ tenant, logoUrl, base, nav, menuLabel, menuHref, pagesLabel }: {
  tenant: { name: string; slug: string }
  logoUrl?: string | null
  /** The restaurant's home on this host ("" on its own domain). */
  base: string
  nav: ReadonlyArray<{ slug: string; title: string }>
  /** The button back to the menu. */
  menuLabel: string
  menuHref?: string
  pagesLabel: string
}) {
  const home = base || '/'
  return (
    <header className="border-b border-zinc-200/70 bg-white/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
        <a href={home} className="flex min-w-0 items-center gap-3" aria-label={tenant.name}>
          <span className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-white shadow-card ring-1 ring-black/5">
            {logoUrl
              ? <Image src={logoUrl} alt="" fill sizes="44px" className="object-contain p-1.5" />
              : <span className="flex size-full items-center justify-center text-sm font-semibold text-zinc-700">{initials(tenant.name)}</span>}
          </span>
          <span className="truncate text-[17px] font-bold tracking-tight text-zinc-900">{tenant.name}</span>
        </a>
        <div className="flex shrink-0 items-center gap-2">
          <a href={menuHref ?? home} className="hidden h-10 items-center rounded-full bg-white px-4 text-[14px] font-medium text-zinc-900 shadow-card ring-1 ring-black/5 sm:flex">{menuLabel}</a>
          <PageLinksMenu tenantSlug={tenant.slug} links={nav} label={pagesLabel} variant="bar" baseUrl={base} />
        </div>
      </div>
    </header>
  )
}
