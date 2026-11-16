import type { TenantCapabilities } from './service-modes'

/** Longest accepted action link; the same limit is a CHECK constraint in the schema. */
export const ACTION_LINK_MAX_LENGTH = 500

export const ACTION_LINK_COLUMNS = ['hide_platform_brand', 'order_online_url', 'reservation_url'] as const

export type ActionLinkResult = { ok: true; value: string | null } | { ok: false }

/**
 * An optional action link a restaurant pastes in: empty becomes null, anything
 * else must be an absolute https URL of at most 500 characters.
 */
export function normalizeActionUrl(input: unknown): ActionLinkResult {
  if (input === null || input === undefined) return { ok: true, value: null }
  if (typeof input !== 'string') return { ok: false }
  const value = input.trim()
  if (value === '') return { ok: true, value: null }
  if (value.length > ACTION_LINK_MAX_LENGTH || /\s/.test(value) || !/^https:\/\//i.test(value)) return { ok: false }
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !url.hostname) return { ok: false }
  } catch { return { ok: false } }
  return { ok: true, value }
}

interface ActionLinkSettings {
  hide_platform_brand?: boolean | null
  order_online_url?: string | null
  reservation_url?: string | null
}

/** The "Powered by" line shows unless the restaurant switched it off or the platform value is empty. */
export function visibleFooterBrand(footerBrand: string | undefined, settings: ActionLinkSettings | null | undefined): string {
  return settings?.hide_platform_brand === true ? '' : footerBrand ?? ''
}

/**
 * The two buttons in "Get in touch". "Order online" is for restaurants that
 * cannot take the order themselves: it disappears once guest checkout is on.
 * Values are re-validated here so a bad stored value is never rendered as a link.
 */
export function resolveMenuActionLinks(
  settings: ActionLinkSettings | null | undefined,
  capabilities: Pick<TenantCapabilities, 'guestOrdering'>,
): { orderOnlineUrl: string | null; reservationUrl: string | null } {
  const order = normalizeActionUrl(settings?.order_online_url)
  const reserve = normalizeActionUrl(settings?.reservation_url)
  return {
    orderOnlineUrl: !capabilities.guestOrdering && order.ok ? order.value : null,
    reservationUrl: reserve.ok ? reserve.value : null,
  }
}
