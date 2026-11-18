export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getEffectiveTenant } from '@/lib/get-effective-tenant'
import { getChatAddonStatus } from '@/lib/chat-addon'
import { createServiceClient } from '@/lib/supabase/server'
import ChatAddonClient from './ChatAddonClient'
import { adminMenusOwned } from '@/lib/data/admin-menus'
import { adminChatContext } from '@/lib/admin/chat-context'
import { readOwnedAdminChatSettings } from '@/lib/data/admin-chat-runtime'
import { getTenantCapabilities } from '@/lib/tenant-plan'
import { loadPlatformAiSettings } from '@/lib/ai/access'
import { chatModelLabel, resolveChatModel } from '@/lib/ai/chat-models'

/** The model the guests' chat runs on (the restaurant's own, else the platform default), for the read-only line. */
async function activeModelLabel(tenantModel: unknown): Promise<string> {
  const platform = await loadPlatformAiSettings().then(settings => settings.chatModel, () => null)
  return chatModelLabel(resolveChatModel(typeof tenantModel === 'string' ? tenantModel : null, platform))
}

export default async function ChatAddonSettingsPage() {
  const effective = await getEffectiveTenant()
  if (!effective) redirect('/auth/login')
  if (effective.role === 'store-staff') redirect('/dashboard')
  // What the plan and the restaurant's own switches allow: decides which abilities can be switched on.
  const { guestOrdering, waiterCalls } = await getTenantCapabilities(effective.tenantId)
  const abilityAccess = { guestOrdering, waiterCalls }
  if (adminMenusOwned()) {
    const result = await readOwnedAdminChatSettings(await adminChatContext(effective))
    return <ChatAddonClient initialSettings={result.settings} status={result.status} abilityAccess={abilityAccess} modelLabel={await activeModelLabel(result.settings?.openrouter_model)} />
  }

  const supabase = createServiceClient()
  const { data: settings } = await supabase
    .from('chat_addon_settings')
    .select('*')
    .eq('tenant_id', effective.tenantId)
    .maybeSingle()

  const status = await getChatAddonStatus(effective.tenantId)

  // Keys live in Settings › AI & billing now; never send the legacy columns out.
  const masked = settings ? { ...settings, openrouter_api_key: undefined, audio_api_key: undefined } : null

  return <ChatAddonClient initialSettings={masked} status={status} abilityAccess={abilityAccess} modelLabel={await activeModelLabel(settings?.openrouter_model)} />
}
