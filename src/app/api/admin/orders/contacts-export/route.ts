/**
 * GET /api/admin/orders/contacts-export
 * CSV of this restaurant's guests who opted in to offers: name, phone (only with an
 * SMS opt-in), email (only with an email opt-in) and the date of their last order.
 * Owners and admins only (staff are blocked like the other admin exports); the
 * tenant always comes from the session, never from the request.
 */
import { NextResponse } from 'next/server'
import { getEffectiveTenant } from '@/lib/get-effective-tenant'
import { createServiceClient } from '@/lib/supabase/server'
import { getTenantCapabilities } from '@/lib/tenant-plan'
import { withApi } from '@/lib/observability/with-api'
import { log } from '@/lib/observability/log'
import { ordersDataOwned, OrderDataError } from '@/lib/data/orders'
import { withOwnedOrders } from '@/lib/data/orders-runtime'
import { buildOptedInContacts, contactsCsv, type OptedInContact, type OptInOrderRow } from '@/lib/orders/order-contact'

function csvResponse(contacts: OptedInContact[]) {
  return new Response(contactsCsv(contacts), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="opted-in-contacts.csv"',
      'Cache-Control': 'no-store',
    },
  })
}

async function handleGET() {
  try {
    const effective = await getEffectiveTenant()
    if (!effective) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (effective.role === 'store-staff' || effective.role === 'customer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (ordersDataOwned()) {
      return await withOwnedOrders(effective.tenantId, false, async owned => {
        if (!(await owned.capabilities()).kds) return NextResponse.json({ error: 'The kitchen display is part of the Menu + Orders plan' }, { status: 403 })
        return csvResponse(await owned.optedInContacts(effective))
      })
    }

    const service = await createServiceClient()
    if (!(await getTenantCapabilities(effective.tenantId, undefined, service)).kds) {
      return NextResponse.json({ error: 'The kitchen display is part of the Menu + Orders plan' }, { status: 403 })
    }
    // Before the schema step the columns do not exist: the export is simply empty.
    const { data, error } = await service.from('orders')
      .select('tenant_id, customer_name, customer_phone, customer_email, marketing_sms_opt_in, marketing_email_opt_in, created_at')
      .eq('tenant_id', effective.tenantId)
      .or('marketing_sms_opt_in.eq.true,marketing_email_opt_in.eq.true')
      .order('created_at', { ascending: false })
      .limit(5000)
    if (error) log.warn('orders.contacts_export_unavailable', { err: error })
    return csvResponse(buildOptedInContacts(error ? [] : ((data ?? []) as OptInOrderRow[]), effective.tenantId))
  } catch (error) {
    if (error instanceof OrderDataError) return NextResponse.json({ error: error.message }, { status: error.status })
    log.error('orders.contacts_export_error', { err: error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const GET = withApi('GET /api/admin/orders/contacts-export', handleGET)
