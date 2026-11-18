/**
 * The platform's default chat model (platform_ai_settings.chat_model) arrives with the schema step
 * docs/owned-schema/20261118110000_chat_feature_switches.sql, applied to the owned database minutes AFTER the code
 * that reads it deploys. Until then a read that names the column would fail (and inside a transaction, abort it), so
 * each read asks first whether the column exists and names it only then (missing = no default set = code default).
 * Writers use the same probe to answer 409 instead of failing with a 500. The column also marks the other half of
 * that step (chat_addon_settings.openrouter_model nullable), so the per-restaurant model is writable only once it exists.
 *
 * Only a found column is remembered: a missing one is looked for again on the next read, so a migration applied after
 * deploy is picked up with no restart. No read is retried after an error.
 */
import type { AdminMenuQuery } from './admin-menus'

export const PLATFORM_CHAT_MODEL_PROBE_SQL = `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='platform_ai_settings' AND column_name='chat_model'`
export const PLATFORM_AI_BASE_COLUMNS = 'openrouter_api_key,default_billing_mode,default_markup_pct,usd_to_brl'
export const SETTINGS_NOT_AVAILABLE_YET = 'Settings not available yet, try again in a few minutes'

let seen = false

/** Test hook: forget what the module remembered. */
export function resetPlatformChatModelProbe() { seen = false }

export async function platformChatModelColumnExists(query: AdminMenuQuery): Promise<boolean> {
  if (!seen) seen = (await query(PLATFORM_CHAT_MODEL_PROBE_SQL)).rows.some(row => row.column_name === 'chat_model')
  return seen
}

/** The platform settings read: the base columns, plus chat_model once it exists. */
export const platformAiSelectSql = (hasChatModel: boolean) =>
  `SELECT ${PLATFORM_AI_BASE_COLUMNS}${hasChatModel ? ',chat_model' : ''} FROM public.platform_ai_settings WHERE id=1 LIMIT 2`
