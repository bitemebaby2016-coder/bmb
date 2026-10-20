// ============================================
// Bite Me Baby — dbRestoreDrill logic tests (2026-10-20)
// inspectDump ต้องจับ dump เสียได้จริง (fail closed) — ส่วน download/verify
// รันจริงผ่าน node scripts/dbRestoreDrill.mjs (ต้องมี service-role secret)
// ============================================

import { describe, it, expect } from 'vitest'
import { inspectDump } from '../../scripts/dbRestoreDrill.mjs'

const GOOD_DUMP = `--
-- PostgreSQL database dump
--
SET statement_timeout = 0;

CREATE TABLE public.orders (
    order_number text NOT NULL
);

COPY public.orders (order_number) FROM stdin;
BMB-20261020-001
\\.
`

describe('inspectDump (restore drill)', () => {
  it('dump ปกติ → ผ่าน (มี header + CREATE TABLE + COPY)', () => {
    const r = inspectDump(GOOD_DUMP)
    expect(r.ok).toBe(true)
    expect(r.tables).toBe(1)
    expect(r.copies).toBe(1)
    expect(r.hasHeader).toBe(true)
  })

  it('ไฟล์ว่าง/พัง → ไม่ผ่าน (fail closed)', () => {
    expect(inspectDump('').ok).toBe(false)
    expect(inspectDump('not a sql dump at all').ok).toBe(false)
  })

  it('dump ที่ไม่มี COPY (ข้อมูลหาย) → ไม่ผ่าน', () => {
    const r = inspectDump('SET x = 1;\nCREATE TABLE public.a (id int);')
    expect(r.ok).toBe(false)
    expect(r.copies).toBe(0)
  })
})