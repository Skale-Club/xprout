import type { AdminMenuQuery } from '../data/admin-menus'
import type { ResolvedSite } from './resolve-site'
import type { SitemapUrl } from '../sitemap-xml'
import { dishPath, isIndexableDish, type DishProduct } from '../menu/dish-pages'
import { parseTags, tagSlug } from '../blog/public-queries'
import { ownedModeActive } from '../data/owned-mode'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const validSlug = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)
const iso = (value: unknown) => value instanceof Date ? value.toISOString() : typeof value === 'string' ? value : undefined

export function discoveryExtraEntries(baseUrl: string, dishes: Record<string, unknown>[], posts: Record<string, unknown>[], blogAllowed: boolean, now = Date.now()): SitemapUrl[] {
  const entries: SitemapUrl[] = [], root = baseUrl.replace(/\/$/u, '')
  for (const row of dishes.slice(0, 4000)) {
    const product = { id: String(row.id), name: String(row.name), description: row.description as string | null,
      image_url: row.image_url as string | null, price: Number(row.price), is_available: row.is_available === true,
      tags: Array.isArray(row.tags) ? row.tags : [] } as DishProduct
    if (row.is_private !== false || row.menu_active !== true || !validSlug(row.menu_slug) || !isIndexableDish(product)) continue
    entries.push({ url: `${root}${dishPath(row.menu_slug, product)}`, lastModified: iso(row.updated_at) })
  }
  if (blogAllowed) {
    entries.push({ url: `${root}/blog` })
    const tags = new Set<string>(), years = new Set<number>(), months = new Set<string>()
    for (const post of posts.slice(0, 1000)) {
      const published = Date.parse(iso(post.published_at) ?? '')
      if (!validSlug(post.slug) || !Number.isFinite(published) || published > now) continue
      entries.push({ url: `${root}/blog/${post.slug}`, lastModified: iso(post.updated_at) ?? iso(post.published_at) })
      for (const tag of parseTags(typeof post.tags === 'string' ? post.tags.slice(0, 2000) : null).slice(0, 50)) { const slug = tagSlug(tag); if (validSlug(slug) && tags.size < 2000) tags.add(slug) }
      const date = new Date(published), year = date.getUTCFullYear(), month = String(date.getUTCMonth() + 1).padStart(2, '0')
      years.add(year); months.add(`${year}/${month}`)
    }
    for (const tag of tags) entries.push({ url: `${root}/blog/tag/${tag}` })
    for (const year of years) entries.push({ url: `${root}/blog/archive/${year}` })
    for (const month of months) entries.push({ url: `${root}/blog/archive/${month}` })
  }
  const seen = new Set<string>()
  return entries.filter(item => { if (seen.has(item.url)) return false; seen.add(item.url); return true }).slice(0, 5000)
}

export async function readDiscoveryExtras(query: AdminMenuQuery, tenantId: string, baseUrl: string): Promise<SitemapUrl[]> {
  if (!UUID.test(tenantId)) return []
  const dishes = await query(`SELECT p.id,p.name,p.description,p.image_url,p.price,p.tags,p.is_available,p.updated_at,m.slug AS menu_slug,
    m.is_private,m.is_active AS menu_active FROM public.products p JOIN public.menus m ON m.id=p.menu_id AND m.tenant_id=p.tenant_id
    WHERE p.tenant_id=$1 AND p.is_available=true AND m.is_active=true AND m.is_private=false ORDER BY m.position,p.position,p.id LIMIT 4000`, [tenantId])
  const plan = (await query(`SELECT s.status,p.features FROM public.tenant_subscriptions s JOIN public.plans p ON p.id=s.plan_id WHERE s.tenant_id=$1 LIMIT 2`, [tenantId])).rows
  const blogAllowed = plan.length === 1 && ['active', 'trial'].includes(String(plan[0].status)) && Array.isArray(plan[0].features) && plan[0].features.includes('blog')
  const posts = blogAllowed ? (await query(`SELECT slug,tags,published_at,updated_at FROM public.blog_posts
    WHERE tenant_id=$1 AND status='published' AND published_at<=clock_timestamp() ORDER BY published_at DESC,id LIMIT 1000`, [tenantId])).rows : []
  return discoveryExtraEntries(baseUrl, dishes.rows, posts, blogAllowed)
}

export async function loadTenantDiscoveryExtras(tenantId: string, baseUrl: string): Promise<SitemapUrl[]> {
  if (!UUID.test(tenantId)) return []
  if (ownedModeActive()) {
    const { ownedAdminTransaction } = await import('../data/admin-menus-runtime')
    return ownedAdminTransaction(false, query => readDiscoveryExtras(query, tenantId, baseUrl))
  }
  const { createServiceClient } = await import('../supabase/server')
  const client = createServiceClient()
  const menus = await client.from('menus').select('id,slug,is_private,is_active').eq('tenant_id', tenantId).eq('is_active', true).eq('is_private', false).limit(1000)
  if (menus.error) throw menus.error
  const products = menus.data?.length ? await client.from('products').select('id,menu_id,name,description,image_url,price,tags,is_available,updated_at')
    .eq('tenant_id', tenantId).eq('is_available', true).in('menu_id', menus.data.map(menu => menu.id)).limit(4000) : { data: [], error: null }
  if (products.error) throw products.error
  const plan = await client.from('tenant_subscriptions').select('status,plans(features)').eq('tenant_id', tenantId).maybeSingle()
  if (plan.error) throw plan.error
  const joined = Array.isArray(plan.data?.plans) ? plan.data.plans[0] : plan.data?.plans
  const blogAllowed = Boolean(plan.data && ['active', 'trial'].includes(plan.data.status) && joined?.features?.includes('blog'))
  const posts = blogAllowed ? await client.from('blog_posts').select('slug,tags,published_at,updated_at').eq('tenant_id', tenantId).eq('status', 'published').lte('published_at', new Date().toISOString()).order('published_at', { ascending: false }).limit(1000) : { data: [], error: null }
  if (posts.error) throw posts.error
  const dishes = (products.data ?? []).map(product => ({ ...product, menu_slug: menus.data?.find(menu => menu.id === product.menu_id)?.slug, is_private: false, menu_active: true }))
  return discoveryExtraEntries(baseUrl, dishes, posts.data ?? [], blogAllowed)
}

export interface LlmFacts { address?: string | null; city?: string | null; phone?: string | null; business_hours?: Record<string, string | null> | null }
const line = (value: string) => value.replace(/[\r\n\[\]<>]/gu, ' ').trim().slice(0, 500)
export function llmsText(site: ResolvedSite, facts: LlmFacts = {}, links: { title: string; href: string }[] = []): string {
  if (!site.indexable) return ''
  const output = [`# ${line(site.tenant?.name ?? site.brand.name)}`, '', `Canonical website: ${site.baseUrl}`, '']
  if (!site.tenant) output.push('## Official information', `- [Product](${site.origin})`, `- [Pricing](${site.origin}/pricing)`, `- [Guides and updates](${site.origin}/blog)`)
  else {
    if (facts.address || facts.city) output.push(`Address: ${line([facts.address, facts.city].filter(Boolean).join(', '))}`)
    if (facts.phone) output.push(`Phone: ${line(facts.phone)}`)
    for (const [day, hours] of Object.entries(facts.business_hours ?? {}).slice(0, 7)) if (typeof hours === 'string' && hours.trim()) output.push(`${line(day)}: ${line(hours)}`)
    output.push('', '## Public pages', `- [Home](${site.baseUrl})`)
    for (const link of links.slice(0, 200)) if (link.href.startsWith(`${site.baseUrl}/`) || link.href === site.baseUrl) output.push(`- [${line(link.title)}](${link.href})`)
  }
  output.push('', `Sitemap: ${site.baseUrl}/sitemap.xml`, '')
  return output.join('\n')
}
