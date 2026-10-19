// Type declarations for scripts/dbBackup.mjs (backup automation — no deps).
export declare const DAILY_KEEP_DAYS: number
export declare const MONTHLY_KEEP_MONTHS: number
export declare const MAX_BACKUP_BYTES: number

export declare function sha256Hex(data: string | Uint8Array): string
export declare function buildDbObjectName(date: Date): string
export declare function buildManifest(files: Array<{ name: string; size: number; sha256: string }>): {
  generated_at: string
  tool: string
  files: Array<{ name: string; size: number; sha256: string }>
}
export declare function checkBackupSize(bytes: number, maxBytes?: number): { ok: boolean; size: number; limit: number }
export declare function retentionCandidates(
  names: string[],
  now: Date,
  dailyKeepDays?: number,
  monthlyKeepMonths?: number,
): string[]

export interface DbBackupStorageConfig {
  base: string
  key: string
  bucket: string
}
export declare function storageConfig(): DbBackupStorageConfig
export declare function storageUpload(cfg: DbBackupStorageConfig, name: string, buffer: Uint8Array, contentType?: string): Promise<unknown>
export declare function storageDownload(cfg: DbBackupStorageConfig, name: string): Promise<Buffer>
export declare function storageList(cfg: DbBackupStorageConfig, prefix: string): Promise<Array<{ name: string; size: number }>>
export declare function storageDelete(cfg: DbBackupStorageConfig, name: string): Promise<void>
export declare function getBucketInfo(cfg: DbBackupStorageConfig): Promise<{ id: string; public: boolean; file_size_limit: number | null }>
export declare function verifyStoredObject(
  cfg: DbBackupStorageConfig,
  name: string,
  expectedSize: number,
  expectedSha: string,
): Promise<{ ok: boolean; storedSize: number; storedSha: string; expectedSize: number; expectedSha: string }>
export declare function main(argv?: string[]): Promise<void>
export declare const DAILY_KEEP_DAYS: number
export declare const MONTHLY_KEEP_MONTHS: number

export declare function sha256Hex(data: string | Uint8Array): string
export declare function buildDbObjectName(date: Date): string
export declare function buildManifest(files: Array<{ name: string; size: number; sha256: string }>): {
  generated_at: string
  tool: string
  files: Array<{ name: string; size: number; sha256: string }>
}
export declare function retentionCandidates(
  names: string[],
  now: Date,
  dailyKeepDays?: number,
  monthlyKeepMonths?: number,
): string[]

export declare function parseServiceAccount(): { client_email: string; private_key: string }
export declare function getAccessToken(sa: { client_email: string; private_key: string }): Promise<string>
export declare function gcsUpload(token: string, bucket: string, name: string, buffer: Uint8Array, contentType?: string): Promise<unknown>
export declare function gcsDownload(token: string, bucket: string, name: string): Promise<Buffer>
export declare function gcsList(token: string, bucket: string, prefix: string): Promise<Array<{ name: string; size: number }>>
export declare function gcsDelete(token: string, bucket: string, name: string): Promise<void>
export declare function main(argv?: string[]): Promise<void>