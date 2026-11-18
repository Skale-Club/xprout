import { getPublicLocale } from '@/lib/marketing/public-locale-server'
import { translatePublic } from '@/lib/marketing/public-translate'
import { publicIntlLocale } from '@/lib/marketing/public-locale'
import {nativeBlogSelected} from '@/lib/blog/native/selected'
/**
 * O blog da PLATAFORMA (autoblog-parity XM-18).
 *
 * `/blog` na Xprout. O de cada restaurante vive em `/<slug>/blog` e partilha
 * a mesma camada de consultas e o mesmo componente de listagem — o que muda é o
 * escopo e o `basePath`.
 */
import type { Metadata } from 'next'
import { cache } from 'react'

import { createServiceClient } from '@/lib/supabase/server'
import { PLATFORM_BASE } from '@/lib/seo'
import { BlogPostList } from '@/components/blog/post-list'
import { listArchive, listPublishedPosts, listTags } from '@/lib/blog/public-queries'

export const revalidate = 300

const BLOG_TITLE = 'Blog | Xprout'
const BLOG_DESCRIPTION =
  'Menus, margins, delivery and operations — what we learn helping restaurants sell more.'

const BLOG_METADATA: Metadata = {
  title: BLOG_TITLE,
  description: BLOG_DESCRIPTION,
  alternates: { canonical: `${PLATFORM_BASE}/blog` },
  openGraph: { title: BLOG_TITLE, description: BLOG_DESCRIPTION, url: `${PLATFORM_BASE}/blog`, type: 'website' },
  twitter: { card: 'summary_large_image', title: BLOG_TITLE, description: BLOG_DESCRIPTION },
}

const loadBlogIndex = cache(async () => {
  const svc = (nativeBlogSelected()?null:createServiceClient())
  const [posts, archive, tags] = await Promise.all([
    listPublishedPosts(svc, null),
    listArchive(svc, null),
    listTags(svc, null),
  ])
  return { posts, archive: posts.length ? archive : [], tags: posts.length ? tags : [] }
})

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getPublicLocale()
  const t = (source: string) => translatePublic(locale, source)
  const { posts } = await loadBlogIndex()
  return { ...BLOG_METADATA, description: t(BLOG_DESCRIPTION), alternates: { canonical: '/blog' }, openGraph: { ...BLOG_METADATA.openGraph, description: t(BLOG_DESCRIPTION), locale: publicIntlLocale(locale).replace('-', '_') }, twitter: { ...BLOG_METADATA.twitter, description: t(BLOG_DESCRIPTION) }, ...(!posts.length ? { robots: { index: false, follow: false } } : {}) }
}

export default async function BlogIndexPage() {
  const locale = await getPublicLocale()
  const t = (source: string) => translatePublic(locale, source)
  const { posts, archive, tags } = await loadBlogIndex()

  return (
    <BlogPostList
      locale={locale}
      heading="Blog"
      lead={t('Menus, margins, delivery and operations — what we learn helping restaurants sell more.')}
      posts={posts}
      basePath="/blog"
      archive={archive}
      tags={tags}
    />
  )
}
