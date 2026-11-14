import type { Metadata } from 'next'

/** Tenant pages never inherit the platform's browser-tab identity. */
export function tenantMetadata(name: string, logoUrl?: string | null): Metadata {
  const initials = name.trim().split(/\s+/u).slice(0, 2).map(word => Array.from(word)[0] ?? '').join('').toUpperCase()
    .replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`)
  // Bounded fallback: 64px SVG, two initials, under 1 KiB. No remote fetch or raster work.
  const fallback = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#18181b"/><text x="32" y="33" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="25" font-weight="700" fill="white">${initials}</text></svg>`)}`
  const icon = logoUrl?.trim() || fallback
  return {
    title: { absolute: name, template: '%s' },
    applicationName: name,
    icons: { icon, shortcut: icon, apple: icon },
  }
}
