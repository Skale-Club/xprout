/**
 * Per-client design variants ("site isolation").
 * Contract: https://github.com/Skale-Club/skaleclub-apps/blob/main/agents/TENANT-CUSTOMIZATION.md
 * Guide: docs/product/design-variants.md
 *
 * Global is code, the client's choice is data. A restaurant's active variants are
 * stored in tenant_settings.design_variants (a { slotId: variantId } map, set by a
 * superadmin only). Never branch on a slug, host or tenant id, and never fork a
 * component per client: register a variant here and read it with designVariant().
 *
 * Add a slot (only when a client asks for its own look there): append an entry to
 * DESIGN_SLOTS with a stable id, a defaultVariant that reproduces today's look, and
 * its variants (the default included). A new variant ships OFF for everyone; a
 * superadmin turns it on for the client who asked.
 *
 * Promote a variant to global: change that slot's defaultVariant, update
 * EXPECTED_DEFAULTS in tests/unit/design-variants.test.ts, and record a Journal
 * decision. Clients that explicitly chose another variant keep their choice.
 *
 * Remove a variant: first move its clients to a named replacement in the data;
 * until then an unknown variant simply resolves to the slot default.
 */

export type DesignVariantDef = { id: string; label: string }
export type DesignSlotDef = {
  id: string
  label: string
  description?: string
  defaultVariant: string
  variants: readonly DesignVariantDef[]
}
export type DesignVariants = Record<string, string>

/** Empty until a real client asks for its own look. */
export const DESIGN_SLOTS: readonly DesignSlotDef[] = []

const MAX_KEYS = 40
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Validate a superadmin's choice. A key is a registered slot and its value one of that
 * slot's variants; the slot's current default may be chosen explicitly (it then keeps
 * that variant if the default changes later). "Use the default" is the key being absent.
 */
export function parseDesignVariants(input: unknown, registry: readonly DesignSlotDef[] = DESIGN_SLOTS): { ok: true; value: DesignVariants } | { ok: false; error: string } {
  if (!isPlainObject(input)) return { ok: false, error: 'Design variants must be an object' }
  const entries = Object.entries(input)
  if (entries.length > MAX_KEYS) return { ok: false, error: `At most ${MAX_KEYS} design slots` }
  const value: DesignVariants = {}
  for (const [slotId, variantId] of entries) {
    const slot = registry.find(candidate => candidate.id === slotId)
    if (!slot) return { ok: false, error: `Unknown design slot: ${slotId}` }
    if (typeof variantId !== 'string' || !slot.variants.some(variant => variant.id === variantId)) return { ok: false, error: `Unknown variant for ${slotId}` }
    value[slotId] = variantId
  }
  return { ok: true, value }
}

/** One entry per registered slot. Missing, unknown or removed choices fall back to the slot default; never throws. */
export function resolveDesignVariants(stored: unknown, registry: readonly DesignSlotDef[] = DESIGN_SLOTS): Record<string, string> {
  const map = isPlainObject(stored) ? stored : {}
  const resolved: Record<string, string> = {}
  for (const slot of registry) {
    const chosen = Object.prototype.hasOwnProperty.call(map, slot.id) ? map[slot.id] : undefined
    resolved[slot.id] = typeof chosen === 'string' && slot.variants.some(variant => variant.id === chosen) ? chosen : slot.defaultVariant
  }
  return resolved
}

/** The variant a client uses in one slot ('' for an unregistered slot). */
export function designVariant(stored: unknown, slotId: string, registry: readonly DesignSlotDef[] = DESIGN_SLOTS): string {
  return resolveDesignVariants(stored, registry)[slotId] ?? ''
}

/** Whether tenant_settings.design_variants exists yet (docs/owned-schema/20261118100000_tenant_design_variants.sql). */
export const DESIGN_VARIANTS_READY_SQL = `SELECT count(*) = 1 AS ready FROM information_schema.columns
  WHERE table_schema='public' AND table_name='tenant_settings' AND column_name='design_variants'`
