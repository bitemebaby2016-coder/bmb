// ============================================
// ROUND-14 / P0-2 — รอบค้าง "ลบไม่ได้" → archive + เหตุผลจริงใน UI
// (Owner 2026-10-24: "บางอันลบไม่ได้ ที่ค้างทั้งหมดเป็นพวกลบไม่ได้")
//
// root cause พิสูจน์แล้วด้วย probe จริง (e2e/p14ProbeRounds.json):
//   orders/products → delivery_rounds = FK NO ACTION → DELETE ล้มเสมอเมื่อมีออเดอร์
// ทางแก้ = archive (รูปแบบเดียวกับ products) + cleanup รอบที่ไม่มีใครอ้างอิง
// + ข้อความใน UI ต้องบอกเหตุผลจริงเสมอ (กฎ "ให้เหตุผลที่ UI แสดงเป็นจริงเสมอ")
// ============================================

import { describe, expect, it } from 'vitest'
import { roundDeleteErrorText } from '@/lib/bmbAdminApi_rounds'
import roundsApiSrc from '../lib/bmbAdminApi_rounds.ts?raw'
import adminRoundsSrc from '../pages/admin/AdminRounds.tsx?raw'
import migration149Src from '../../supabase/migrations/149_round_archive_cleanup.sql?raw'

describe('roundDeleteErrorText — เหตุผลที่ UI แสดงต้องเป็นความจริง', () => {
  it('FK violation (23503) = บอกตรง ๆ ว่ามีออเดอร์อ้างอิงและชี้ไปที่ "เก็บ"', () => {
    const msg = roundDeleteErrorText({
      code: '23503',
      message: 'update or delete on table "delivery_rounds" violates foreign key constraint',
    })
    expect(msg).toContain('ลบถาวรไม่ได้')
    expect(msg).toContain('มีออเดอร์')
    expect(msg).toContain('เก็บ')
  })

  it('error อื่น ๆ = คงข้อความต้นเหตุไว้ (ไม่กลืน)', () => {
    expect(roundDeleteErrorText({ code: '42501', message: 'permission denied for table delivery_rounds' }))
      .toContain('permission denied')
    expect(roundDeleteErrorText({})).toContain('ไม่ทราบสาเหตุ')
  })
})

describe('source guards — archive path ต้องมีจริงในโค้ด', () => {
  it('bmbAdminApi_rounds: archive/restore/delete + กรอง archived ครบทุก query', () => {
    expect(roundsApiSrc).toContain('export async function archiveRound')
    expect(roundsApiSrc).toContain('export async function restoreRound')
    expect(roundsApiSrc).toContain('export async function deleteRound')
    expect(roundsApiSrc).toContain('export async function getArchivedRoundsAdmin')
    // รายการที่แอดมิน/ลูกค้าเห็นต้องไม่เอาแถว archive ขึ้นมาแสดง
    expect(roundsApiSrc).toContain(".eq('archived', false)")
    // archive ต้องปิดสถานะรอบด้วย (RLS public read กรอง status='active')
    expect(roundsApiSrc).toContain('archived: true, status: \'closed\'')
  })

  it('AdminRounds: มีปุ่มเก็บ/กู้คืน + ลิสต์รอบเก็บ + ไม่ยิง .delete() ตรงเอง', () => {
    expect(adminRoundsSrc).toContain('data-testid={`round-archive-${r.id}`}')
    expect(adminRoundsSrc).toContain('data-testid={`round-restore-${r.id}`}')
    expect(adminRoundsSrc).toContain('data-testid="round-archived-panel"')
    expect(adminRoundsSrc).toContain('handleArchive')
    expect(adminRoundsSrc).toContain('handleRestore')
    // การลบต้องผ่าน deleteRound (คืนเหตุผลจริง) — ห้ามเรียก supabase.delete() ตรง ๆ ในหน้า
    expect(adminRoundsSrc).toContain('await deleteRound(round.id)')
    expect(adminRoundsSrc).not.toContain("supabase.from('delivery_rounds').delete()")
  })
})

describe('migration 149 — archive + cleanup ตามที่ contract 149 สัญญา', () => {
  it('มีคอลัมน์ archived + cleanup รอบเก่าที่ไม่มีใครอ้าง + archive รอบที่มีออเดอร์ (มี audit)', () => {
    expect(migration149Src).toContain('ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false')
    expect(migration149Src).toContain('DELETE FROM public.delivery_rounds r')
    expect(migration149Src).toContain('NOT EXISTS (SELECT 1 FROM public.orders o')
    expect(migration149Src).toContain('SET archived = true, status = \'closed\'')
    expect(migration149Src).toContain('append_audit_log')
    expect(migration149Src.trimEnd().endsWith('COMMIT;')).toBe(true)
  })
})