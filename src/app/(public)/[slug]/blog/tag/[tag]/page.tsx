import {nativeBlogSelected} from '@/lib/blog/native/selected'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { createServiceClient } from '@/lib/supabase/server'
import { BlogPostList } from '@/components/blog/post-list'
import { listArchive, listPostsByTag, listTags } from '@/lib/blog/public-queries'
import { resolveTenantBlog } from '@/lib/blog/tenant-blog-gate'
import { loadTenantSite } from '@/lib/site/runtime'
import { siteRobots } from '@/lib/site/indexability'

export const revalidate = 300

type Props = { params: Promise<{ slug: string; tag: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, tag: tagSlugParam } = await params
  const blog = await resolveTenantBlog(slug)
  if (!blog) return { robots: { index: false, follow: false } }

  const tag = (await listTags((nativeBlogSelected()?null:createServiceClient()), blog.tenantId)).find(
    (t) => t.slug === tagSlugParam,
  )
  if (!tag) return { robots: { index: false, follow: false } }
  const site = await loadTenantSite(slug, `/${slug}/blog/tag/${tagSlugParam}`)
  const title = `${tag.name} | Blog ${blog.name}`
  const description = `Posts sobre ${tag.name}.`

  return {
    title, description,
    robots: siteRobots(site ?? { indexable: false }),
    ...(site ? { metadataBase: new URL(site.origin), alternates: { canonical: site.canonicalUrl },
      openGraph: { type: 'website', title, description, siteName: blog.name, url: site.canonicalUrl, locale: site.lang.replace('-', '_') },
      twitter: { card: 'summary_large_image', title, description } } : {}),
  }
}

export default async function TenantBlogTagPage({ params }: Props) {
  const { slug, tag: tagSlugParam } = await params

  // O gate de plano vem PRIMEIRO, antes de qualquer leitura de posts: um
  // restaurante sem a capacidade não tem blog, e responder-lhe com uma listagem
  // vazia seria servir a página de uma funcionalidade que ele não comprou.
  const blog = await resolveTenantBlog(slug)
  if (!blog) notFound()

  const svc = (nativeBlogSelected()?null:createServiceClient())
  const tags = await listTags(svc, blog.tenantId)
  const tag = tags.find((t) => t.slug === tagSlugParam)
  if (!tag) notFound()

  const [posts, archive] = await Promise.all([
    listPostsByTag(svc, blog.tenantId, tagSlugParam),
    listArchive(svc, blog.tenantId),
  ])
  if (posts.length === 0) notFound()

  return (
    <BlogPostList
      heading={`#${tag.name}`}
      posts={posts}
      basePath={`/${slug}/blog`}
      archive={archive}
      tags={tags}
    />
  )
}
