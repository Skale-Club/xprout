#!/usr/bin/env node
/**
 * "Limpa o cache": makes production show the latest release and data right now.
 *
 *   node scripts/ops/flush-cache.mjs [--slug=aurora ...] [--all]
 *
 * 1. Release: compares the live SHA (/api/health/ready) with origin/main.
 * 2. App cache: drops the cached public menus (60 s TTL) through /api/internal/revalidate-menu
 *    when production has MENU_REVALIDATE_SECRET.
 * 3. Cloudflare: purges the xprout.app zone (HTML is edge-cached 60 s + 60 s stale) when production has
 *    CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID.
 * 4. Prints fresh links: any query string bypasses Cloudflare and the browser (cf-cache-status DYNAMIC,
 *    no-store), so `?fresh=<time>` always shows the origin's current page.
 *
 * Secrets are read from Coolify with COOLIFY_TOKEN (.env.local) and never printed. Read-only except the
 * two cache drops, which only make the next request rebuild a page.
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const ORIGIN = 'https://xprout.app'
const COOLIFY = 'https://coolify.skale.club/api/v1/applications/gmaayluj11x1m6j7baogonfn/envs'
const args = process.argv.slice(2)
const slugs = args.filter(a => a.startsWith('--slug=')).map(a => a.slice(7)).filter(Boolean)
const all = args.includes('--all') || slugs.length === 0
const UA = { 'User-Agent': 'xprout-ops-flush' }

function localEnv(name) {
  try { return readFileSync('.env.local', 'utf8').match(new RegExp(`^${name}="?([^"\\r\\n]+)`, 'm'))?.[1] } catch { return undefined }
}

async function productionEnv() {
  const token = localEnv('COOLIFY_TOKEN')
  if (!token) return {}
  const response = await fetch(COOLIFY, { headers: { ...UA, Authorization: `Bearer ${token}` } })
  if (!response.ok) { console.log(`coolify: unreadable (${response.status})`); return {} }
  const env = {}
  for (const item of await response.json()) if (!item.is_preview) env[item.key] = item.real_value ?? item.value ?? ''
  return env
}

async function release() {
  const live = await fetch(`${ORIGIN}/api/health/ready?fresh=${Date.now()}`, { headers: UA }).then(r => r.json()).catch(() => null)
  let expected = ''
  try { execSync('git fetch -q origin main', { stdio: 'ignore' }); expected = execSync('git rev-parse origin/main').toString().trim() } catch {}
  const sha = live?.release ?? 'unknown'
  console.log(`release: live ${sha.slice(0, 7)} · origin/main ${expected.slice(0, 7) || '?'} · ${sha === expected ? 'UP TO DATE' : 'DIFFERENT (deploy still running or not released)'}`)
}

async function revalidateMenus(env) {
  const secret = env.MENU_REVALIDATE_SECRET
  if (!secret) { console.log('app menu cache: not configured (MENU_REVALIDATE_SECRET missing) · expires by itself in up to 60 s'); return }
  const bodies = all ? [{ all: true }] : slugs.map(slug => ({ slug }))
  for (const body of bodies) {
    const response = await fetch(`${ORIGIN}/api/internal/revalidate-menu`, {
      method: 'POST', headers: { ...UA, 'Content-Type': 'application/json', 'x-revalidate-secret': secret }, body: JSON.stringify(body),
    })
    console.log(`app menu cache: ${body.all ? 'all menus' : body.slug} → ${response.ok ? 'dropped' : `failed (${response.status})`}`)
  }
}

async function purgeCloudflare(env) {
  const token = env.CLOUDFLARE_API_TOKEN, zone = env.CLOUDFLARE_ZONE_ID
  if (!token || !/^[a-f0-9]{32}$/i.test(zone ?? '')) { console.log('cloudflare: not configured (CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID missing) · edge HTML expires by itself in up to 2 min'); return }
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`, {
    method: 'POST', headers: { ...UA, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ purge_everything: true }),
  })
  const body = await response.json().catch(() => null)
  console.log(`cloudflare: ${response.ok && body?.success ? 'zone purged' : `failed (${response.status})`}`)
}

async function verify() {
  const pages = ['', ...(all ? ['aurora'] : slugs)]
  for (const page of pages) {
    const response = await fetch(`${ORIGIN}/${page}`, { headers: UA, redirect: 'manual' }).catch(() => null)
    console.log(`check /${page}: ${response?.status ?? 'error'} · cf-cache-status ${response?.headers.get('cf-cache-status') ?? '?'}`)
  }
  const stamp = Date.now().toString(36)
  console.log('fresh links (always bypass every cache):')
  for (const page of pages) console.log(`  ${ORIGIN}/${page}?fresh=${stamp}`)
}

const env = await productionEnv()
await release()
await revalidateMenus(env)
await purgeCloudflare(env)
await verify()
