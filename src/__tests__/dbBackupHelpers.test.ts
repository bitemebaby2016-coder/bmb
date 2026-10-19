// ============================================
// dbBackup helper unit tests (scripts/dbBackup.mjs — Supabase Storage backup)
// Task: BACKEND-CAPABILITY-CLOSURE-2026-10-19
// ============================================
import { describe, it, expect } from 'vitest'
import {
  sha256Hex,
  buildDbObjectName,
  buildManifest,
  checkBackupSize,
  retentionCandidates,
} from '../../scripts/dbBackup.mjs'

describe('dbBackup — object naming + hashing', () => {
  it('builds deterministic db object names', () => {
    const d = new Date(Date.UTC(2026, 9, 19, 7, 30, 0))
    expect(buildDbObjectName(d)).toBe('db/bmb-db-20261019-073000.sql.gz')
  })

  it('sha256Hex is stable and content-sensitive', () => {
    expect(sha256Hex('abc')).toBe(sha256Hex('abc'))
    expect(sha256Hex('abc')).not.toBe(sha256Hex('abd'))
    expect(sha256Hex('abc')).toHaveLength(64)
  })

  it('manifest records name/size/sha256 per file', () => {
    const m = buildManifest([{ name: 'db/a.sql.gz', size: 10, sha256: 'ff' }])
    expect(m.files[0]).toEqual({ name: 'db/a.sql.gz', size: 10, sha256: 'ff' })
    expect(m.tool).toBe('bmb-db-backup/1')
  })
})

describe('dbBackup — size gate before upload', () => {
  it('accepts sizes within the bucket limit', () => {
    expect(checkBackupSize(52428800, 52428800)).toEqual({ ok: true, size: 52428800, limit: 52428800 })
    expect(checkBackupSize(1, 52428800).ok).toBe(true)
  })

  it('fails closed when the dump exceeds the limit', () => {
    const r = checkBackupSize(52428801, 52428800)
    expect(r.ok).toBe(false)
    expect(r.size).toBe(52428801)
    expect(r.limit).toBe(52428800)
  })
})

describe('dbBackup — retention policy', () => {
  const now = new Date(Date.UTC(2026, 9, 19, 0, 0, 0)) // 2026-10-19
  const names = [
    'db/bmb-db-20261018-003000.sql.gz', // 1 day old — daily keep
    'db/bmb-db-20261001-003000.sql.gz', // first of Oct — monthly keep
    'db/bmb-db-20261002-003000.sql.gz', // second of Oct — delete (beyond 30d? no — 17d old, daily keep)
    'db/bmb-db-20260905-003000.sql.gz', // first Mon? 5 Sep — monthly keep (first of Sep is 0901)
    'db/bmb-db-20260901-003000.sql.gz', // first of Sep — monthly keep
    'db/bmb-db-20260910-003000.sql.gz', // 39d old, not first of month — delete
  ]

  it('keeps daily window + first-of-month archive, deletes the rest', () => {
    const doomed = retentionCandidates(names, now, 30, 12)
    expect(doomed).toContain('db/bmb-db-20260910-003000.sql.gz')
    expect(doomed).toContain('db/bmb-db-20260905-003000.sql.gz') // not first of month
    expect(doomed).not.toContain('db/bmb-db-20261018-003000.sql.gz')
    expect(doomed).not.toContain('db/bmb-db-20261002-003000.sql.gz')
    expect(doomed).not.toContain('db/bmb-db-20261001-003000.sql.gz')
    expect(doomed).not.toContain('db/bmb-db-20260901-003000.sql.gz')
  })

  it('never touches objects outside the deterministic db/ pattern', () => {
    const doomed = retentionCandidates(['manifest.json', 'random.txt', 'db/not-a-backup.sql.gz'], now)
    expect(doomed).toEqual([])
  })

  it('respects monthly horizon', () => {
    const doomed = retentionCandidates(
      ['db/bmb-db-20250901-003000.sql.gz'], // > 12 months old
      now, 30, 12,
    )
    expect(doomed).toEqual(['db/bmb-db-20250901-003000.sql.gz'])
  })
})