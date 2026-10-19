// Type declarations for scripts/gcsBackup.mjs (backup automation — no deps).
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