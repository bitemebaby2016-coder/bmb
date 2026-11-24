// ============================================
// Bite Me Baby — Ambient music control (header compact button)
// Play/stop only. Volume controlled via manager state.
// State lives in the AmbientMusicManager singleton (survives route changes).
// Never autoplays: toggle only fires from this click (user gesture).
// ============================================

import { useEffect, useState } from 'react'
import {
  getAmbientMusic,
  MUSIC_EVENT,
  type MusicState,
} from '@/lib/ambientMusic'

export function AmbientMusicToggle() {
  const manager = getAmbientMusic()
  const [state, setState] = useState<MusicState>(() => manager.getState())
  const [emptyBucket, setEmptyBucket] = useState(false)

  useEffect(() => {
    const onMusic = () => {
      const s = manager.getState()
      setState(s)
      if (s.playing && s.volume === 0) setEmptyBucket(true)
      else setEmptyBucket(false)
    }
    window.addEventListener(MUSIC_EVENT, onMusic)
    onMusic()
    return () => window.removeEventListener(MUSIC_EVENT, onMusic)
  }, [manager])

  async function handleToggle() {
    const wasPlaying = manager.getState().playing
    const started = await manager.toggle()
    // stop สำเร็จ = started false แต่ bucket ไม่ว่าง — ห้ามโชว์ "ไม่มีเพลง"
    setEmptyBucket(!started && !wasPlaying)
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-pressed={state.playing}
      aria-label={state.playing ? 'หยุดเพลงบรรเลง' : 'เปิดเพลงบรรเลง'}
      title={state.playing ? 'หยุดเพลง' : emptyBucket ? 'ไม่มีเพลงใน bucket — โปรดอัปโหลดในแอดมิน' : 'เปิดเพลงบรรเลง'}
      className={`w-9 h-9 rounded-full flex items-center justify-center text-lg transition-colors focus-visible:outline-2 focus-visible:outline-brand-primary ${
        state.playing
          ? 'bg-brand-primary text-white'
          : emptyBucket
          ? 'bg-brand-bg text-red-500 hover:text-red-400'
          : 'bg-brand-bg text-brand-muted hover:text-brand-primary'
      }`}
      data-testid="ambient-music-toggle"
    >
      <span aria-hidden="true">{state.playing ? '⏸' : '♪'}</span>
    </button>
  )
}