import { cache } from 'react'
import { ownedModeActive } from '@/lib/data/owned-mode'
import { pickDefaultMenu, pickSectionMenu } from './public-menu-model'
import type { AdminMenuQuery } from '@/lib/data/admin-menus'

export interface LocalNavigationLink { title: string; href: string; kind?: 'menu' | 'branch' }
type Menu = { id: string; slug: string; name: string; is_default: boolean; is_private: boolean }
type Branch = { name: string; slug: string; menu_id: string | null }
const validSlug = (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)

export function localNavigationLinks(menus: Menu[], branches: Branch[], baseUrl: string): LocalNavigationLink[] {
  const root = baseUrl.replace(/\/$/u, ''), defaultMenu = pickDefaultMenu(menus)
  const links: LocalNavigationLink[] = menus.filter(menu => menu.is_private === false && validSlug(menu.slug))
    .map(menu => ({ title: menu.name, href: menu === defaultMenu && branches.length < 2 ? root : `${root}/${menu.slug}`, kind: 'menu' as const }))
  for (const branch of branches) {
    const menu = pickSectionMenu(menus, branch.slug, branch)
    if (validSlug(branch.slug) && menu?.is_private === false) links.push({ title: branch.name, href: `${root}/${branch.slug}`, kind: 'branch' })
  }
  return links.filter((link, index) => links.findIndex(other => other.href === link.href) === index)
}

export async function readLocalNavigation(query: AdminMenuQuery, tenantId: string) {
  const [menus, branches] = await Promise.all([
    query('SELECT id,slug,name,is_default,is_private FROM public.menus WHERE tenant_id=$1 AND is_active=true ORDER BY position,id LIMIT 100', [tenantId]),
    query('SELECT name,slug,menu_id FROM public.locations WHERE tenant_id=$1 AND is_active=true ORDER BY created_at,id LIMIT 100', [tenantId]),
  ])
  return { menus: menus.rows as unknown as Menu[], branches: branches.rows as unknown as Branch[] }
}

const readNavigation = cache(async (tenantId: string) => {
  if (ownedModeActive()) {
    const { ownedAdminTransaction } = await import('@/lib/data/admin-menus-runtime')
    return ownedAdminTransaction(false, query => readLocalNavigation(query, tenantId))
  }
  const { createServiceClient } = await import('@/lib/supabase/server')
  const service = createServiceClient()
  const [menus, branches] = await Promise.all([
    service.from('menus').select('id,slug,name,is_default,is_private').eq('tenant_id', tenantId).eq('is_active', true).order('position').limit(100),
    service.from('locations').select('name,slug,menu_id').eq('tenant_id', tenantId).eq('is_active', true).order('created_at').limit(100),
  ])
  if (menus.error) throw menus.error
  if (branches.error) throw branches.error
  return { menus: (menus.data ?? []) as Menu[], branches: (branches.data ?? []) as Branch[] }
})

/** Optional navigation never prevents the cached guest menu from rendering. */
export async function loadLocalNavigation(tenantId: string, baseUrl: string): Promise<LocalNavigationLink[]> {
  if (!/^[0-9a-f-]{36}$/iu.test(tenantId)) return []
  try { const { menus, branches } = await readNavigation(tenantId); return localNavigationLinks(menus, branches, baseUrl) }
  catch { return [] }
}
