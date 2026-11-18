import { publicHref, publicIntlLocale, type PublicLocale } from '@/lib/marketing/public-locale'
import { translatePublic } from '@/lib/marketing/public-translate'
import { DeliveryImage } from '@/components/delivery-image'
import Link from 'next/link'

import type { ArchiveEntry, PublicPostCard } from '@/lib/blog/public-queries'

export function monthName(month: number, locale: PublicLocale = 'pt'): string {
  if (month < 1 || month > 12) return String(month)
  return new Intl.DateTimeFormat(publicIntlLocale(locale), { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, month - 1, 1)))
}

export function formatDate(value: string | null, locale: PublicLocale = 'pt'): string {
  if (!value) return ''
  return new Intl.DateTimeFormat(publicIntlLocale(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value))
}

/**
 * A listagem que o índice, as etiquetas e os arquivos partilham — nos DOIS
 * blogs, o da plataforma e o de cada restaurante.
 *
 * `basePath` é o que os distingue: `/blog` para a plataforma,
 * `/<slug>/blog` para um restaurante. Um componente só porque seis vistas
 * copiadas seriam seis sítios onde o cartão, o aviso de vazio ou a barra
 * lateral podem divergir sem ninguém reparar.
 */
export function BlogPostList({
  heading,
  lead,
  posts,
  basePath,
  archive = [],
  tags = [],
  emptyMessage,
  locale = 'pt',
}: {
  heading: string
  lead?: string | null
  posts: PublicPostCard[]
  basePath: string
  archive?: ArchiveEntry[]
  tags?: Array<{ slug: string; name: string; count: number }>
  locale?: PublicLocale
  emptyMessage?: string
}) {
  const t = (source: string) => translatePublic(locale, source)
  const href = (path: string) => basePath === '/blog' ? publicHref(path, locale) : path
  const byYear = new Map<number, ArchiveEntry[]>()
  for (const entry of archive) {
    const list = byYear.get(entry.year) ?? []
    list.push(entry)
    byYear.set(entry.year, list)
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
      <header className="mb-12">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{heading}</h1>
        {lead && <p className="mt-3 text-base text-muted-foreground">{lead}</p>}
      </header>

      <div className="flex flex-col gap-12 lg:flex-row">
        <div className="flex-1">
          {posts.length === 0 ? (
            <p className="text-muted-foreground">{emptyMessage ?? t('No posts published yet.')}</p>
          ) : (
            <ul className="space-y-10">
              {posts.map((post) => (
                <li key={post.slug}>
                  <article>
                    {post.cover_image_url && (
                      <Link href={href(`${basePath}/${post.slug}`)} className="mb-4 block">
                        <DeliveryImage
                          src={post.cover_image_url}
                          width={1200} height={675} sizes={tags.length > 0 || byYear.size > 0
                            ? "(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) calc(100vw - 48px), 704px"
                            : "(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) calc(100vw - 48px), 976px"} alt=""
                          loading="lazy"
                          className="aspect-video h-auto w-full rounded-xl object-cover"
                        />
                      </Link>
                    )}
                    <h2 className="text-xl font-medium tracking-tight">
                      <Link href={href(`${basePath}/${post.slug}`)} className="hover:underline">
                        {post.title}
                      </Link>
                    </h2>
                    {post.excerpt && <p className="mt-2 text-muted-foreground">{post.excerpt}</p>}
                    <p className="mt-2 text-sm text-muted-foreground">
                      {formatDate(post.published_at, locale)}
                      {post.reading_time_minutes
                        ? ` · ${post.reading_time_minutes} ${t('min read')}`
                        : ''}
                    </p>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>

        {(tags.length > 0 || byYear.size > 0) && (
          <aside className="flex w-full flex-col gap-8 lg:w-56 lg:shrink-0">
            {tags.length > 0 && (
              <nav aria-label={t('Topics')} className="flex flex-col gap-2">
                <h2 className="font-medium">{t('Topics')}</h2>
                <ul className="flex flex-wrap gap-x-3 gap-y-1">
                  {tags.map((tag) => (
                    <li key={tag.slug}>
                      <Link
                        href={href(`${basePath}/tag/${tag.slug}`)}
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        #{tag.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            {byYear.size > 0 && (
              <nav aria-label={t('Archive')} className="flex flex-col gap-4">
                <h2 className="font-medium">{t('Archive')}</h2>
                {Array.from(byYear.entries())
                  .sort((a, b) => b[0] - a[0])
                  .map(([year, months]) => (
                    <div key={year} className="flex flex-col gap-1">
                      <Link href={href(`${basePath}/archive/${year}`)} className="font-medium hover:underline">
                        {year}
                      </Link>
                      <ul className="flex flex-col gap-0.5 pl-3">
                        {months
                          .sort((a, b) => b.month - a.month)
                          .map((entry) => (
                            <li key={entry.month}>
                              <Link
                                href={href(`${basePath}/archive/${entry.year}/${String(entry.month).padStart(2, '0')}`)}
                                className="text-sm text-muted-foreground hover:text-foreground"
                              >
                                {monthName(entry.month, locale)}{' '}
                                <span className="opacity-60">({entry.count})</span>
                              </Link>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
              </nav>
            )}
          </aside>
        )}
      </div>
    </main>
  )
}
