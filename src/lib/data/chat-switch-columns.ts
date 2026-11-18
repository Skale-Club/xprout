/**
 * The assistant's per-restaurant switches arrive with one schema step
 * (docs/owned-schema/20261118100000_chat_feature_switches.sql), applied to the
 * owned database minutes AFTER the code that reads them deploys. Until then an
 * owned read that names a missing column would fail (and inside a transaction,
 * abort it), so each read asks first which of the columns exist and names only
 * those. A missing switch means "on" (today's behaviour).
 *
 * information_schema.columns lists only columns the role can use. Only found
 * columns are remembered: a column that was missing is looked for again on the
 * next read, so a migration applied after deploy is picked up with no restart.
 * No read is retried after an error.
 */
import type { AdminMenuQuery } from './admin-menus'

export const CHAT_SWITCH_COLUMNS = ['ordering_help_enabled', 'staff_call_enabled', 'suggestions_enabled', 'history_enabled'] as const
export type ChatSwitchColumn = (typeof CHAT_SWITCH_COLUMNS)[number]

const FROM = `FROM information_schema.columns WHERE table_schema='public' AND table_name='chat_addon_settings' AND column_name = ANY($1::text[])`
/** Plain rows: one { column_name } per column that exists. */
export const CHAT_SWITCH_PROBE_SQL = `SELECT column_name ${FROM}`
/** For readers that wrap every row as { row } (public menu): { columns: [...] }. */
export const CHAT_SWITCH_PROBE_JSON_SQL = `SELECT jsonb_build_object('columns', COALESCE(jsonb_agg(column_name), '[]'::jsonb)) AS row ${FROM}`

const seen = new Set<ChatSwitchColumn>()

/** Test hook: forget what the module remembered. */
export function resetChatSwitchProbe() { seen.clear() }

/** The switch columns that exist now; `fetchPresent` runs only while some are still unseen. */
export async function presentChatSwitchColumns(fetchPresent: (columns: readonly ChatSwitchColumn[]) => Promise<readonly unknown[]>): Promise<ReadonlySet<ChatSwitchColumn>> {
  if (seen.size < CHAT_SWITCH_COLUMNS.length) {
    const found = await fetchPresent(CHAT_SWITCH_COLUMNS)
    for (const column of CHAT_SWITCH_COLUMNS) if (found.includes(column)) seen.add(column)
  }
  return new Set(seen)
}

/** Probe through a plain-rows query (AdminMenuQuery). */
export const presentChatSwitchColumnsFor = (query: AdminMenuQuery) =>
  presentChatSwitchColumns(async columns => (await query(CHAT_SWITCH_PROBE_SQL, [columns])).rows.map(row => row.column_name))

/** `base` plus the optional switch columns that exist, as a SELECT list. */
export function chatSelectColumns(base: string, present: ReadonlySet<ChatSwitchColumn>, optional: readonly ChatSwitchColumn[] = CHAT_SWITCH_COLUMNS): string {
  return [base, ...optional.filter(column => present.has(column))].join(',')
}

/** A switch that is absent (column missing or null) is on. */
export const switchOn = (value: unknown): boolean => value !== false
