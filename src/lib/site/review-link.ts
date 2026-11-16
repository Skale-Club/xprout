/** A merchant-provided destination, not evidence of ownership or a review rating. */
export function googleReviewLink(value: unknown, language?: string | null): { href: string; label: string } | null {
  if (typeof value !== 'string' || !value.trim()) return null
  let url: URL
  try { url = new URL(value.trim()) } catch { return null }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null
  const lang = language?.toLowerCase().split(/[-_]/)[0]
  const label = lang === 'pt' ? 'Avaliar no Google' : lang === 'es' ? 'Escribir una reseña en Google' : 'Review us on Google'
  return { href: url.href, label }
}
