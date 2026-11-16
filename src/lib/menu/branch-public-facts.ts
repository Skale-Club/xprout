import type { Location } from '@/types/database'

type BranchFacts = Partial<Pick<Location, 'address' | 'city' | 'region' | 'postal_code' | 'country' | 'latitude' | 'longitude' | 'phone' | 'business_hours'>>

/** Public branch contact facts never inherit a different location's NAP or hours. */
export function withBranchPublicFacts<T extends { tenant_settings: object | null }>(tenant: T, branch: BranchFacts): T {
  return { ...tenant, tenant_settings: {
    ...tenant.tenant_settings,
    address: branch.address ?? null, city: branch.city ?? null, region: branch.region ?? null,
    postal_code: branch.postal_code ?? null, country: branch.country ?? null,
    latitude: branch.latitude ?? null, longitude: branch.longitude ?? null, phone: branch.phone ?? null,
    business_hours: branch.business_hours ? { ...branch.business_hours } : null,
  } }
}
