import { getPublicLocale } from '@/lib/marketing/public-locale-server'
import { translatePublic } from '@/lib/marketing/public-translate'
import {nativeBlogSelected} from '@/lib/blog/native/selected'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { createServiceClient } from '@/lib/supabase/server'
import { BlogPostList } from '@/components/blog/post-list'
import { listArchive, listPostsByTag, listTags } from '@/lib/blog/public-queries'

export const revalidate = 300

type Props = { params: Promise<{ tag: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await getPublicLocale()
  const t = (source: string) => translatePublic(locale, source)
  const { tag: slug } = await params
  const tag = (await listTags((nativeBlogSelected()?null:createServiceClient()), null)).find((t) => t.slug === slug)
  if (!tag) return {}

  return {
    title: `${tag.name} | Blog Xprout`,
    description: `${t('Posts tagged')} ${tag.name}.`,
    alternates: { canonical: `/blog/tag/${slug}` },
  }
}

export default async function PlatformBlogTagPage({ params }: Props) {
  const locale = await getPublicLocale()
  const { tag: slug } = await params
  const svc = (nativeBlogSelected()?null:createServiceClient())

  const tags = await listTags(svc, null)
  // Uma etiqueta que não existe é 404, não uma listagem vazia: senão qualquer
  // palavra escrita no URL passa a ser uma página indexável sem nada dentro.
  const tag = tags.find((t) => t.slug === slug)
  if (!tag) notFound()

  const [posts, archive] = await Promise.all([
    listPostsByTag(svc, null, slug),
    listArchive(svc, null),
  ])
  if (posts.length === 0) notFound()

  return (
    <BlogPostList
      locale={locale}
      heading={`#${tag.name}`}
      posts={posts}
      basePath="/blog"
      archive={archive}
      tags={tags}
    />
  )
}
