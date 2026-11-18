import { getPublicLocale } from '@/lib/marketing/public-locale-server'
import { translatePublic } from '@/lib/marketing/public-translate'
import {nativeBlogSelected} from '@/lib/blog/native/selected'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { createServiceClient } from '@/lib/supabase/server'
import { BlogPostList } from '@/components/blog/post-list'
import { listArchive, listPostsByMonth, listTags } from '@/lib/blog/public-queries'

export const revalidate = 300

type Props = { params: Promise<{ year: string }> }

/**
 * Estreito de propósito: `/blog/archive/99999` e `/blog/archive/abc` são ambos
 * URLs que qualquer pessoa escreve, e um intervalo de datas inválido devolve o
 * blog inteiro sob um URL que promete um ano.
 */
function parseYear(raw: string): number | null {
  const year = Number(raw)
  if (!Number.isInteger(year) || year < 2000 || year > 3000) return null
  return year
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await getPublicLocale()
  const t = (source: string) => translatePublic(locale, source)
  const year = parseYear((await params).year)
  if (!year) return {}
  return {
    title: `${t('Archive')} ${year} | Blog Xprout`,
    alternates: { canonical: `/blog/archive/${year}` },
  }
}

export default async function PlatformBlogYearPage({ params }: Props) {
  const locale = await getPublicLocale()
  const t = (source: string) => translatePublic(locale, source)
  const year = parseYear((await params).year)
  if (!year) notFound()

  const svc = (nativeBlogSelected()?null:createServiceClient())
  // A contagem decide: um ano sem posts é 404, não uma página vazia.
  const archive = await listArchive(svc, null)
  if (!archive.some((entry) => entry.year === year)) notFound()

  const [posts, tags] = await Promise.all([
    listPostsByMonth(svc, null, year),
    listTags(svc, null),
  ])
  if (posts.length === 0) notFound()

  return (
    <BlogPostList
      locale={locale}
      heading={`${t('Archive')} ${year}`}
      posts={posts}
      basePath="/blog"
      archive={archive}
      tags={tags}
    />
  )
}
