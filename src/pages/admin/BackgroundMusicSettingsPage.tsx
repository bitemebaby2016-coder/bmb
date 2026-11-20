// ============================================
// Bite Me Baby — Admin Background Music Settings
// Owner manages playlist from Supabase bucket `background_music`:
// ① preview files in bucket (audio controls) ② upload local/cloud files (auto-compress) ③ import external URL ④ enable/disable
// ============================================

import { useEffect, useState } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { showToast } from '@/components/ui/ToastContainer'
import {
  listBackgroundMusicFiles,
  uploadBackgroundMusicAsset,
  deleteBackgroundMusicAsset,
  validateMusicFile,
  compressAudioForMusic,
  MUSIC_BUCKET,
} from '@/lib/backgroundMusic'
import { supabase } from '@/lib/supabase'

type FileStatus = { kind: 'idle' | 'ok' | 'error'; text: string }
type PreviewState = 'none' | 'loading' | 'ok' | 'error'

interface MusicConfig {
  enabled: boolean
}

export function BackgroundMusicSettingsPage() {
  const [files, setFiles] = useState<{ name: string; url: string; path: string; updated_at: string }[]>([])
  const [config, setConfig] = useState<MusicConfig>({ enabled: false })
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [importingUrl, setImportingUrl] = useState(false)
  const [externalUrl, setExternalUrl] = useState('')
  const [status, setStatus] = useState<Record<string, FileStatus>>({})
  const [preview, setPreview] = useState<Record<string, PreviewState>>({})

  async function loadConfig() {
    try {
      const { data } = await supabase.from('business_settings').select('value').eq('key', 'ambient_music').maybeSingle()
      if (data?.value) {
        setConfig(typeof data.value === 'object' ? data.value : { enabled: false })
      }
    } catch {
      // ignore
    }
  }

  async function saveConfig(next: Partial<MusicConfig>) {
    const merged = { ...config, ...next }
    setConfig(merged)
    try {
      await supabase.from('business_settings').upsert({ key: 'ambient_music', value: merged }, { onConflict: 'key' })
      showToast(merged.enabled ? 'เปิดใช้งานเพลงพื้นหลังแล้ว' : 'ปิดเพลงพื้นหลังแล้ว', 'success')
    } catch {
      showToast('บันทึกไม่สำเร็จ — ตรวจสอบสิทธิ์แอดมิน', 'error')
    }
  }

  async function refresh() {
    setLoading(true)
    try {
      const list = await listBackgroundMusicFiles()
      setFiles(list)
      const nextPreview: Record<string, PreviewState> = {}
      for (const f of list) nextPreview[f.name] = 'loading'
      setPreview(nextPreview)
    } catch {
      showToast('โหลดรายการเพลงไม่ได้ — ตรวจ bucket policies', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadConfig()
    void refresh()
  }, [])

  async function onFileUpload(file?: File) {
    if (!file) return
    const v = validateMusicFile(file)
    if (!v.ok) {
      showToast(`❌ ${v.error}`, 'error')
      return
    }
    setUploading(file.name)
    setStatus((p) => ({ ...p, [file.name]: { kind: 'idle', text: '' } }))
    const url = await uploadBackgroundMusicAsset(file)
    setUploading(null)
    if (!url) {
      showToast(`❌ อัปโหลดไม่สำเร็จ — ตรวจว่า bucket ${MUSIC_BUCKET} มี policy และล็อกอินเป็นแอดมิน`, 'error')
      return
    }
    showToast('✅ อัปโหลดแล้ว — กำลังรีเฟชรายการ…', 'success')
    await refresh()
  }

  async function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) await onFileUpload(file)
  }

  async function onImportUrl() {
    const url = externalUrl.trim()
    if (!url) {
      showToast('วาง URL ก่อน', 'error')
      return
    }
    try {
      setImportingUrl(true)
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const file = new File([blob], url.split('/').pop() || 'music.webm', { type: blob.type || 'audio/webm' })
      await onFileUpload(file)
      setExternalUrl('')
    } catch {
      showToast('❌ นำเข้าไม่สำเร็จ — ตรวจ URL/CORS/ขนาดไฟล์', 'error')
    } finally {
      setImportingUrl(false)
    }
  }

  async function onDelete(path: string, name: string) {
    if (!confirm(`ลบ "${name}" ออกจาก bucket?`)) return
    const ok = await deleteBackgroundMusicAsset(path)
    if (ok) {
      showToast('✅ ลบแล้ว', 'success')
      await refresh()
    } else {
      showToast('❌ ลบไม่สำเร็จ', 'error')
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-accent">🎵 เพลงพื้นหลัง (Background Music)</h1>
        <button
          className="btn btn-outline text-sm"
          data-testid="music-refresh"
          aria-label="รีเฟชรายการเพลง"
          onClick={() => void refresh()}
        >
          🔄
        </button>
      </div>

      <p className="text-sm text-slate-500">
        Bucket: <code>{MUSIC_BUCKET}</code> (Public read) · รองรับ MP3/WAV/OGG/WebM/AAC · อัปโหลดแล้วลดขนาดอัตโนมัติ (Opus 128kbps mono ≤2MB)
        · เล่นสุ่ม (shuffle queue) ใช้หมดทุกเพลงก่อนวน · Bite พูด → ลดเสียงอัตโนมัติ
      </p>

      {/* Enable Toggle */}
      <GlassCard className="p-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => void saveConfig({ enabled: e.target.checked })}
            className="w-5 h-5 accent-brand-primary"
            data-testid="music-enabled-toggle"
          />
          <span className="font-medium text-slate-700">เปิดใช้งานเพลงพื้นหลัง</span>
        </label>
        <p className="text-xs text-slate-500 mt-1">ปิด = ไม่เล่นเพลงแม้จะมีไฟล์ใน bucket (ใช้ค่า enabled ใน business_settings.ambient_music)</p>
      </GlassCard>

      {/* Upload / Import */}
      <GlassCard className="p-4">
        <h3 className="font-bold text-slate-700 text-sm mb-2">📤 เพิ่มเพลงใหม่</h3>

        <div className="space-y-2">
          {/* File upload */}
          <label className="btn btn-outline text-xs cursor-pointer block text-center border-2 border-dashed border-brand-border hover:border-brand-primary transition-colors p-4"
            onDragOver={onDragOver}
            onDrop={onDrop}
          >
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              data-testid="music-file-upload"
              disabled={uploading !== null}
              onChange={(e) => void onFileUpload(e.target.files?.[0] ?? undefined)}
            />
            {uploading ? (
              <span className="flex items-center justify-center gap-2 text-brand-primary">
                <span className="animate-spin">⏳</span> กำลังอัปโหลด <span className="truncate max-w-xs">{uploading}</span>…
              </span>
            ) : (
              <span className="flex flex-col items-center gap-1">
                <span>📁 ลากไฟล์เพลงมาวาง หรือคลิกเพื่อเลือก (จากคอมพิวเตอร์/Drive)</span>
                <span className="text-xs text-slate-400">รองรับ: MP3, WAV, OGG, WebM, AAC · สูงสุด 20MB ต้นฉบับ</span>
              </span>
            )}
          </label>

          {/* URL Import */}
          <div className="flex gap-2">
            <input
              type="url"
              className="input text-xs flex-1"
              placeholder="https://… (ลิงก์ไฟล์เสียงภายนอก — จะดาวน์โหลด+บีบอัด+อัปโหลดเข้า bucket)"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              data-testid="music-url-import"
            />
            <button
              className="btn btn-primary text-xs whitespace-nowrap"
              disabled={importingUrl || !externalUrl.trim()}
              data-testid="music-url-import-btn"
              onClick={() => void onImportUrl()}
            >
              {importingUrl ? '⏳ นำเข้า…' : '📥 นำเข้า'}
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Bucket File List */}
      <GlassCard className="p-4">
        <h3 className="font-bold text-slate-700 text-sm mb-2">🗂 ไฟล์ใน bucket <code>{MUSIC_BUCKET}</code> (ล่าสุดก่อน)</h3>
        {loading ? (
          <p className="text-xs text-slate-400 animate-pulse" data-testid="music-bucket-loading">กำลังโหลด…</p>
        ) : files.length === 0 ? (
          <p className="text-xs text-slate-400" data-testid="music-bucket-empty">
            ยังไม่มีไฟล์ — อัปโหลดจากด้านบน หรือตรวจ policy ของ bucket (public read, admin write)
          </p>
        ) : (
          <ul className="space-y-1" data-testid="music-bucket-files">
            {files.map((f) => (
              <li key={f.name} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs p-2 bg-slate-50 rounded">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <audio controls className="w-full sm:w-48 h-8" src={f.url} data-testid={`music-preview-${f.name}`} />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate font-medium">{f.name}</span>
                    <span className="text-slate-400">{f.updated_at ? new Date(f.updated_at).toLocaleString('th-TH') : ''}</span>
                  </div>
                </div>
                <div className="flex gap-1 sm:ml-2">
                  <button
                    className="btn btn-outline text-xs py-0.5 px-2"
                    onClick={() => void navigator.clipboard?.writeText(f.url)}
                    title="คัดลอก URL"
                    data-testid={`music-copy-${f.name}`}
                  >
                    📋 คัดลอก URL
                  </button>
                  <button
                    className="btn btn-outline text-xs py-0.5 px-2 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => void onDelete(f.path, f.name)}
                    title="ลบไฟล์"
                    data-testid={`music-delete-${f.name}`}
                  >
                    🗑️ ลบ
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      {/* Status Messages */}
      {Object.entries(status).map(([name, s]) => (
        <p key={name} className={`text-xs mt-1 ${s.kind === 'ok' ? 'text-green-700' : s.kind === 'error' ? 'text-red-600' : 'text-slate-500'}`} data-testid={`music-msg-${name}`}>
          {s.text}
        </p>
      ))}
    </div>
  )
}