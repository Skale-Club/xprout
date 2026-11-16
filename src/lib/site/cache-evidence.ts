type EvidenceHeaders = Record<string, string>

/** A cacheable origin header alone cannot establish an actual, isolated CDN hit. */
export function edgeCacheEvidence(anonymous: EvidenceHeaders, cookie: EvidenceHeaders): { ok: boolean; evidence: string } {
  const hit = (anonymous['cf-cache-status'] ?? '').toUpperCase()
  const bypass = (cookie['cf-cache-status'] ?? '').toUpperCase()
  const policy = cookie['cache-control'] ?? ''
  const ok = hit === 'HIT' && ['BYPASS', 'DYNAMIC', 'MISS'].includes(bypass)
    && /private|no-store/i.test(policy) && !anonymous['set-cookie']
  return { ok, evidence: `anonymous=${hit || 'no CDN evidence'}; cookie=${bypass || 'no CDN evidence'}; cookie policy=${policy || 'missing'}` }
}
