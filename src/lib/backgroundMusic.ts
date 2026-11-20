// ============================================
// Bite Me Baby — Background Music from Supabase Storage
// Bucket: background_music (Owner-created in Dashboard)
// Admin uploads audio files → auto-compress to WebM Opus ≤2MB → random shuffle playback
// ============================================

import { supabase } from './supabase'

export const MUSIC_BUCKET = 'background_music'

export const AUDIO_MIME_WHITELIST = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/aac',
] as const

export const MAX_AUDIO_BYTES = 20 * 1024 * 1024 // 20 MB raw input
export const TARGET_AUDIO_BYTES = 2 * 1024 * 1024 // 2 MB target after compression
export const TARGET_BITRATE_KBPS = 128

export interface MusicFile {
  name: string
  url: string
  path: string
  updated_at: string
}

export interface MusicValidation {
  ok: boolean
  error?: string
}

/** ตรวจสอบไฟล์เพลงก่อนอัปโหลด */
export function validateMusicFile(file: File): MusicValidation {
  const type = file.type || ''
  if (!AUDIO_MIME_WHITELIST.includes(type as typeof AUDIO_MIME_WHITELIST[number])) {
    return { ok: false, error: `ERR_INVALID_MIME (${type} — รองรับ MP3/WAV/OGG/WebM/AAC)` }
  }
  if (file.size <= 0 || file.size > MAX_AUDIO_BYTES) {
    return { ok: false, error: `ERR_INVALID_SIZE (${(file.size / 1024 / 1024).toFixed(2)} MB — สูงสุด ${MAX_AUDIO_BYTES / 1024 / 1024} MB)` }
  }
  return { ok: true }
}

/** ลดขนาดไฟล์เสียงเป็น WebM Opus 128kbps mono ≤2MB — ใช้ AudioContext + MediaRecorder */
export async function compressAudioForMusic(file: File): Promise<File> {
  if (file.size <= TARGET_AUDIO_BYTES) return file

  if (typeof window === 'undefined' || !window.AudioContext || !window.MediaRecorder) {
    console.warn('[backgroundMusic] AudioContext/MediaRecorder not available — returning original')
    return file
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()

    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

    const monoBuffer = audioCtx.createBuffer(
      1,
      audioBuffer.length,
      audioBuffer.sampleRate
    )
    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const input = audioBuffer.getChannelData(ch)
      const output = monoBuffer.getChannelData(0)
      for (let i = 0; i < audioBuffer.length; i++) {
        output[i] += input[i] / audioBuffer.numberOfChannels
      }
    }

    const dest = audioCtx.createMediaStreamDestination()
    const source = audioCtx.createBufferSource()
    source.buffer = monoBuffer
    source.connect(dest)
    source.start(0)

    const mimeType = 'audio/webm;codecs=opus'
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      console.warn('[backgroundMusic] Opus not supported — returning original')
      audioCtx.close()
      return file
    }

    const recorder = new MediaRecorder(dest.stream, { mimeType, audioBitsPerSecond: TARGET_BITRATE_KBPS * 1000 })
    const chunks: BlobPart[] = []
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

    const recordingPromise = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
      recorder.onerror = (e) => reject(e)
    })

    recorder.start()
    await new Promise((r) => setTimeout(r, (audioBuffer.duration + 0.5) * 1000))
    recorder.stop()
    await recordingPromise

    audioCtx.close()

    const compressedBlob = new Blob(chunks, { type: mimeType })
    if (compressedBlob.size > TARGET_AUDIO_BYTES * 1.5) {
      console.warn('[backgroundMusic] Compressed size > 3MB, may exceed target')
    }

    const compressedFile = new File([compressedBlob], file.name.replace(/\.[^.]+$/, '.webm'), {
      type: mimeType,
      lastModified: Date.now(),
    })

    return compressedFile
  } catch (e) {
    console.error('[backgroundMusic] Compression failed:', e)
    return file
  }
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
}

/** อัปโหลดไฟล์เพลงเข้า bucket background_music — คืน public URL (null = ล้มเหลว) */
export async function uploadBackgroundMusicAsset(file: File): Promise<string | null> {
  const v = validateMusicFile(file)
  if (!v.ok) {
    console.error('[backgroundMusic] validation error:', v.error)
    return null
  }

  const compressed = await compressAudioForMusic(file)
  const path = `${Date.now()}-${sanitizeName(compressed.name)}`

  try {
    const { error } = await supabase.storage
      .from(MUSIC_BUCKET)
      .upload(path, compressed, { cacheControl: '3600', upsert: false })
    if (error) {
      console.error('[backgroundMusic] upload error:', error.message)
      return null
    }
    const { data } = supabase.storage.from(MUSIC_BUCKET).getPublicUrl(path)
    return data?.publicUrl ?? null
  } catch {
    return null
  }
}

/** ลบไฟล์เพลงจาก bucket */
export async function deleteBackgroundMusicAsset(path: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage.from(MUSIC_BUCKET).remove([path])
    return !error
  } catch {
    return false
  }
}

/** รายการไฟล์ใน bucket background_music (root) — เรียงใหม่ก่อน */
export async function listBackgroundMusicFiles(limit = 50): Promise<MusicFile[]> {
  try {
    const { data, error } = await supabase.storage
      .from(MUSIC_BUCKET)
      .list('', { limit: Math.min(limit, 200), sortBy: { column: 'created_at', order: 'desc' } })
    if (error || !data) return []
    return (data as Array<{ name: string; updated_at?: string }>)
      .filter((f) => f.name && !f.name.startsWith('.') && !f.name.endsWith('/'))
      .slice(0, limit)
      .map((f) => ({
        name: f.name,
        path: f.name,
        url: supabase.storage.from(MUSIC_BUCKET).getPublicUrl(f.name).data.publicUrl,
        updated_at: f.updated_at ?? '',
      }))
  } catch {
    return []
  }
}

/** สร้าง shuffle queue — ใช้หมดทุกเพลงก่อนวน */
export function createShuffleQueue<T>(items: T[]): { next: () => T | null; reset: () => void } {
  let queue: T[] = []
  let index = 0

  const shuffle = () => {
    queue = [...items].sort(() => Math.random() - 0.5)
    index = 0
  }

  return {
    next: () => {
      if (items.length === 0) return null
      if (index >= queue.length) shuffle()
      return queue[index++]
    },
    reset: () => { shuffle() },
  }
}