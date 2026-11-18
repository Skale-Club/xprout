import { getPublicLocale } from '@/lib/marketing/public-locale-server'
import {nativeBlogSelected} from '@/lib/blog/native/selected'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { createServiceClient } from '@/lib/supabase/server'
import { BlogPostList, monthName } from '@/components/blog/post-list'
import { listArchive, listPostsByMonth, listTags } from '@/lib/blog/public-queries'

export const revalidate = 300

type Props = { params: Promise<{ year: string; month: string }> }

function parseYearMonth(rawYear: string, rawMonth: string): { year: number; month: number } | null {
  const year = Number(rawYear)
  const month = Number(rawMonth)
  if (!Number.isInteger(year) || year < 2000 || year > 3000) return null
  if (!Number.isInteger(month) || month < 1 || month > 12) return null
  return { year, month }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await getPublicLocale()
  const { year: rawYear, month: rawMonth } = await params
  const parsed = parseYearMonth(rawYear, rawMonth)
  if (!parsed) return {}

  // O caminho canónico leva o mês com dois dígitos, sempre. /2026/3 e /2026/03
  // responderiam os dois, e o mesmo arquivo teria dois URLs indexáveis.
  const path = `/blog/archive/${parsed.year}/${String(parsed.month).padStart(2, '0')}`
  return {
    title: `${monthName(parsed.month, locale)} · ${parsed.year} | Blog Xprout`,
    alternates: { canonical: path },
  }
}

export default async function PlatformBlogMonthPage({ params }: Props) {
  const locale = await getPublicLocale()
  const { year: rawYear, month: rawMonth } = await params
  const parsed = parseYearMonth(rawYear, rawMonth)
  if (!parsed) notFound()

  const svc = (nativeBlogSelected()?null:createServiceClient())
  const archive = await listArchive(svc, null)
  if (!archive.some((e) => e.year === parsed.year && e.month === parsed.month)) notFound()

  const [posts, tags] = await Promise.all([
    listPostsByMonth(svc, null, parsed.year, parsed.month),
    listTags(svc, null),
  ])
  if (posts.length === 0) notFound()

  return (
    <BlogPostList
      locale={locale}
      heading={`${monthName(parsed.month, locale)} · ${parsed.year}`}
      posts={posts}
      basePath="/blog"
      archive={archive}
      tags={tags}
    />
  )
}
