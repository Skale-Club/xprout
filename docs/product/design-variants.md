# Per-client design variants

When one restaurant asks for its own look (a different card, hero or layout), we ship a registered variant that is **off for everyone** and **on only for that restaurant**. The choice is data on the client; the code is shared. Contract: [TENANT-CUSTOMIZATION.md](https://github.com/Skale-Club/skaleclub-apps/blob/main/agents/TENANT-CUSTOMIZATION.md).

Never branch on a slug, host or tenant id, and never fork a component per client.

## Pieces

- Registry: `src/lib/design-variants.ts` (`DESIGN_SLOTS`, empty until a client asks). Read a client's variant with `designVariant(settings.design_variants, 'slotId')`.
- Data: `tenant_settings.design_variants`, a `{ slotId: variantId }` object (`docs/owned-schema/20261118100000_tenant_design_variants.sql`). The public menu read exposes it as `settings.design_variants` once the column exists (absent = `{}`).
- Write path: superadmin only, `GET/PUT /api/superadmin/tenants/[id]/design-variants`, shown in the client page card. The restaurant's own settings API and the MCP tools do not accept it. A successful write drops that client's public menu cache.

## Add a slot or variant

1. Add the slot to `DESIGN_SLOTS` with a `defaultVariant` that reproduces today's look, and the variant(s). Build the variant as a component or branch selected by `designVariant(...)`, never by client.
2. Add the new default to `EXPECTED_DEFAULTS` in `tests/unit/design-variants.test.ts`.
3. A superadmin picks the variant on the client's page. Nobody else changes.

## Make it global

Change the slot's `defaultVariant`, update `EXPECTED_DEFAULTS`, and record a Journal decision. Clients that explicitly chose another variant keep it; clients that never chose follow the new default.

## Remove a variant

Move its clients to a named replacement in the data first. Until then, an unknown variant resolves to the slot default instead of breaking the page.

## Later

Design pin (freeze one client's current design to a snapshot while a global change is fixed) is rule 5 of the contract and is not built yet.
