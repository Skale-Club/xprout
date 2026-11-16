export type FooterSettings = { address?: string | null; city?: string | null; phone?: string | null }
export type FooterLink = { title: string; href: string }

/** Merchant-provided facts and public links; no inferred location or business type. */
export default function TenantPublicFooter({ name, settings, links }: {
  name: string; settings: FooterSettings | null; links: readonly FooterLink[]
}) {
  const address = [settings?.address?.trim(), settings?.city?.trim()].filter(Boolean).join(', ')
  const phone = settings?.phone?.trim()
  const dial = phone?.replace(/[^\d+]/g, '')
  const unique = links.filter((link, index) => links.findIndex(other => other.href === link.href) === index).slice(0, 300)
  return <footer className="mt-8 border-t border-zinc-200/70">
    <div className="mx-auto max-w-5xl space-y-4 px-5 py-8 text-[14px] leading-6 text-zinc-600 sm:px-8">
      <address className="not-italic">
        <p className="font-semibold text-zinc-900">{name}</p>
        {address && <p>{address}</p>}
        {phone && <p>{dial ? <a href={`tel:${dial}`} className="underline-offset-2 hover:underline">{phone}</a> : phone}</p>}
      </address>
      {unique.length > 0 && <nav aria-label={name}><ul className="flex flex-wrap gap-x-5 gap-y-2">
        {unique.map(link => <li key={link.href}><a href={link.href} className="inline-flex min-h-11 items-center font-medium underline-offset-2 hover:text-zinc-900 hover:underline">{link.title}</a></li>)}
      </ul></nav>}
    </div>
  </footer>
}
