#!/usr/bin/env node
import { writeFile } from 'node:fs/promises'

const args = process.argv.slice(2), options = { tenants: [] }
for (let i = 0; i < args.length; i++) {
  const key = args[i]
  if (key === '--origin') options.origin = args[++i]
  else if (key === '--canonical-origin') options.canonicalOrigin = args[++i]
  else if (key === '--tenant') options.tenants.push(...args[++i].split(','))
  else if (key === '--expect-demos-noindex') options.demos = true
  else if (key === '--preview') options.preview = true
  else if (key === '--expect-edge-cache') options.edgeCache = true
  else if (key === '--json') options.json = args[++i]
  else throw new Error(`Unknown option: ${key}`)
}
if (!options.origin) throw new Error('Use --origin https://your-host [--tenant slug] [--canonical-origin https://production-host] [--preview] [--expect-demos-noindex] [--json file]')
const origin = new URL(options.origin).origin, canonicalOrigin = new URL(options.canonicalOrigin ?? origin).origin
const hostname = new URL(origin).hostname
const preview = options.preview || hostname === 'localhost' || hostname === '[::1]' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
  || hostname.split('.').some(label => /(?:^|-)(?:dev|stage|staging|preview|test|localhost)(?:-|$)/.test(label))
  || hostname.endsWith('.vercel.app') || hostname.endsWith('.netlify.app')
if (new URL(options.origin).username || new URL(options.origin).password) throw new Error('Origin must not contain credentials')
if (options.demos) options.tenants.push('aurora', 'bella-vista')
const checks = [], check = (name, ok, evidence = '') => checks.push({ name, ok: Boolean(ok), evidence })
const xmlUrls = text => [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1].replace(/&amp;/g, '&')).slice(0, 50)
const meta = (html, key) => (html.match(/<meta\b[^>]*>/gi) ?? []).find(tag => new RegExp(`(?:name|property)=["']${key}["']`, 'i').test(tag))?.match(/content=["']([^"']*)/i)?.[1]
const canonical = html => (html.match(/<link\b[^>]*>/gi) ?? []).find(tag => /rel=["']canonical["']/i.test(tag))?.match(/href=["']([^"']*)/i)?.[1]
async function get(path, headers = {}) {
  const url = new URL(path, origin)
  try {
    const response = await fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(15000) })
    const reader = response.body?.getReader(), decoder = new TextDecoder(); let text = '', bytes = 0
    if (reader) while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > 2000000) { await reader.cancel(); break } text += decoder.decode(part.value, { stream: true }) }
    return { status: response.status, text, headers: response.headers, path: url.pathname }
  } catch (error) { check(`fetch ${url.pathname}`, false, error.name); return { status: 0, text: '', headers: new Headers(), path: url.pathname } }
}
function inspectPage(label, page, expectedRoot = false, demo = false) {
  check(`${label}: status`, page.status === 200, String(page.status))
  const href = canonical(page.text), robots = meta(page.text, 'robots') ?? page.headers.get('x-robots-tag') ?? ''
  check(`${label}: canonical`, href && /^https?:\/\//.test(href) && (!expectedRoot || href.replace(/\/$/, '') === canonicalOrigin), href ?? 'missing')
  check(`${label}: document language`, /<html[^>]+lang=["'][a-z]{2,3}(?:-[a-z0-9]+)*["']/i.test(page.text))
  check(`${label}: JSON-LD`, /application\/ld\+json/i.test(page.text))
  const image = meta(page.text, 'og:image'), ogUrl = meta(page.text, 'og:url')
  let sameHost = false
  try { sameHost = Boolean(ogUrl && href && new URL(ogUrl).hostname === new URL(href).hostname) } catch {}
  check(`${label}: OG identity`, sameHost, ogUrl ?? 'missing')
  check(`${label}: OG image absolute`, image && /^https?:\/\//.test(image), image ? 'absolute image found' : 'missing')
  if (demo || preview || origin !== canonicalOrigin) check(`${label}: noindex`, /noindex/i.test(robots), robots)
}
const home = await get('/')
inspectPage('home', home, true)
if (options.edgeCache) {
  if (preview) throw new Error('Edge cache proof requires the canonical public host')
  const repeated = await get('/')
  check('home: repeated anonymous edge HIT', repeated.headers.get('cf-cache-status')?.toUpperCase() === 'HIT', repeated.headers.get('cf-cache-status') ?? 'missing')
}
const sitemap = await get('/sitemap.xml'), robots = await get('/robots.txt')
const publicHost = !preview && origin === canonicalOrigin
check('robots reachable', robots.status === 200)
check('sitemap host policy', sitemap.status === (publicHost ? 200 : 404), String(sitemap.status))
if (publicHost) {
  check('robots advertises sitemap', robots.text.includes(`${canonicalOrigin}/sitemap.xml`))
  const leaves = xmlUrls(sitemap.text)
  check('sitemap contains locations', leaves.length > 0)
  for (const loc of leaves.slice(0, 5)) {
    const url = new URL(loc)
    if (/sitemap|\.xml$/.test(url.pathname) && url.origin === canonicalOrigin) {
      const leaf = await get(url.pathname)
      check(`sitemap leaf ${url.pathname}`, leaf.status === 200 && /<(?:urlset|sitemapindex)\b/.test(leaf.text), String(leaf.status))
    }
  }
} else check('preview robots blocks crawl', /Disallow:\s*\//i.test(robots.text))
for (const slug of [...new Set(options.tenants)].slice(0, 20)) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Invalid tenant slug')
  const page = await get(`/${slug}`), demo = options.demos && ['aurora', 'bella-vista'].includes(slug)
  inspectPage(slug, page, false, demo)
  if (options.edgeCache) {
    const repeated = await get(`/${slug}`)
    check(`${slug}: repeated anonymous edge HIT`, repeated.headers.get('cf-cache-status')?.toUpperCase() === 'HIT', repeated.headers.get('cf-cache-status') ?? 'missing')
  }
  const map = await get(`/${slug}/sitemap.xml`)
  check(`${slug}: sitemap policy`, demo || preview || origin !== canonicalOrigin ? map.status === 404 : [200, 404].includes(map.status), String(map.status))
}
for (const [label, path, headers] of [
  ['cookie first visitor', '/', { Cookie: 'seo-live-check=visitor-one' }],
  ['cookie second visitor', '/', { Cookie: 'seo-live-check=visitor-two' }],
  ['authorization', '/', { Authorization: 'Bearer seo-live-check-invalid' }],
  ['table query', '/?table=seo-live-check', {}], ['language query', '/?lang=pt', {}], ['view query', '/?view=feed', {}],
  ['RSC', '/', { RSC: '1', 'Next-Router-Prefetch': '1' }],
  ['RSC navigation', '/', { RSC: '1' }],
  ['prefetch', '/', { 'Next-Router-Prefetch': '1' }],
  ['router state', '/', { 'Next-Router-State-Tree': '[]' }],
  ['segment prefetch', '/', { 'Next-Router-Segment-Prefetch': '/' }],
  ['RSC query', '/?_rsc=seo-live-check', {}],
]) {
  const page = await get(path, headers)
  const cache = `${page.headers.get('cache-control') ?? ''} ${page.headers.get('cdn-cache-control') ?? ''}`
  const cf = page.headers.get('cf-cache-status') ?? ''
  check(`${label}: no shared cache hit`, !['HIT', 'STALE', 'UPDATING', 'REVALIDATED'].includes(cf.toUpperCase()), cf || 'no CDN hit header')
  check(`${label}: response bypass policy`, /private/i.test(cache) && /no-store/i.test(cache), cache || 'missing cache policy')
  if (label.startsWith('cookie')) {
    check(`${label}: isolated public identity`, canonical(page.text) === canonical(home.text)
      && !/seo-live-check=visitor-(?:one|two)/.test(page.text))
  }
}
const report = { origin, canonicalOrigin, preview: Boolean(preview), checkedAt: new Date().toISOString(), passed: checks.filter(item => item.ok).length, failed: checks.filter(item => !item.ok).length, checks }
if (options.json) await writeFile(options.json, JSON.stringify(report, null, 2) + '\n')
for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}${item.evidence ? `: ${item.evidence}` : ''}`)
console.log(`${report.passed} passed, ${report.failed} failed`)
process.exitCode = report.failed ? 1 : 0
