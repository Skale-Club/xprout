import { createClient } from '@/lib/supabase/client'

/**
 * Signs the guest out of whichever sign-in the deployment uses. Returns true
 * when the sign-out is confirmed. Shared by the guest panel (/<slug>/me) and
 * the AI chat on a shared tablet (history off), which ends the guest's session
 * with the conversation.
 *
 * Owned sign-in: POST /api/identity/logout and require `signedOut: true`.
 * Legacy sign-in: Supabase `auth.signOut()`.
 * `keepalive` lets the request outlive a page that is closing.
 */
export async function signOutGuest(ownedAuth: boolean, options: { keepalive?: boolean } = {}): Promise<boolean> {
  if (ownedAuth) {
    const response = await fetch('/api/identity/logout', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error', keepalive: options.keepalive,
      headers: { 'Content-Type': 'application/json' }, body: '{}',
    }).catch(() => null)
    const result = response?.ok ? await response.json().catch(() => null) : null
    return result?.signedOut === true
  }
  await createClient().auth.signOut()
  return true
}
