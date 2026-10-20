// Type declarations for scripts/dbRestoreDrill.mjs (imported by src/__tests__/dbRestoreDrill.test.ts)
// tsconfig has allowJs:false → TS needs this sibling .d.mts for the .mjs module (fixes TS7016 in CI build)
export function inspectDump(sqlText: string): { ok: boolean; tables: number; copies: number; hasHeader: boolean }
export function fail(msg: string): never
export function main(argv?: string[]): Promise<void>