import { describe, expect, it } from 'vitest'
import { edgeCacheEvidence } from '@/lib/site/cache-evidence'

describe('live edge-cache evidence', () => {
  it('requires a real anonymous HIT and a private cookie bypass', () => {
    expect(edgeCacheEvidence({ 'cf-cache-status': 'HIT' }, { 'cf-cache-status': 'BYPASS', 'cache-control': 'private, no-store' }).ok).toBe(true)
    expect(edgeCacheEvidence({ 'cache-control': 'public, s-maxage=60' }, { 'cache-control': 'private, no-store' }).ok).toBe(false)
  })
  it('rejects personalized hits, missing cookie policy and anonymous Set-Cookie', () => {
    expect(edgeCacheEvidence({ 'cf-cache-status': 'HIT' }, { 'cf-cache-status': 'HIT', 'cache-control': 'private, no-store' }).ok).toBe(false)
    expect(edgeCacheEvidence({ 'cf-cache-status': 'HIT' }, { 'cf-cache-status': 'DYNAMIC' }).ok).toBe(false)
    expect(edgeCacheEvidence({ 'cf-cache-status': 'HIT', 'set-cookie': 'session=opaque' }, { 'cf-cache-status': 'BYPASS', 'cache-control': 'no-store' }).ok).toBe(false)
  })
})
