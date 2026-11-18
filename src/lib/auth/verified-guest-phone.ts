import { createClient } from '@/lib/supabase/server'
import { ownedAuthSelected } from '@/lib/auth/owned-principal'
import { getOwnedCustomer } from '@/lib/auth/owned-customer-runtime'

/**
 * The E.164 phone (+digits) of the guest signed in on this request, or null.
 * Only a phone confirmed by an SMS code ever appears here: the owned identity
 * keeps `phoneE164` for phone bindings only, and Supabase Auth sets `user.phone`
 * only after the OTP is verified. Read per request, never cached across guests.
 */
export async function getVerifiedGuestPhone(): Promise<string | null> {
  let raw: string | null | undefined
  if (ownedAuthSelected()) raw = (await getOwnedCustomer())?.phoneE164
  else {
    const client = await createClient()
    const { data: { user } } = await client.auth.getUser()
    raw = user?.phone
  }
  const digits = typeof raw === 'string' ? raw.replace(/\D/g, '') : ''
  return digits ? `+${digits}` : null
}
