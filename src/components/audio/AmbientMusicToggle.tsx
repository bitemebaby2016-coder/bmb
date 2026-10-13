// ============================================
// Bite Me Baby — Ambient music control (compact floating pill)
// Play/stop + volume + clear playing state. Renders once from Layout —
// state lives in the AmbientMusicManager singleton (survives route changes).
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

  useEffect(() => {
    const onMusic = () => setState(manager.getState())
    window.addEventListener(MUSIC_EVENT, onMusic)
    // sync in case another instance changed state while we were unmounted
    onMusic()
    return () => window.removeEventListener(MUSIC_EVENT, onMusic)
  }, [manager])

  async function handleToggle() {
    await manager.toggle() // user gesture — engine start/stop inside
  }

  return (
    <div
      className="fixed right-3 z-40 flex items-center gap-2 rounded-2xl glass-surface border border-brand-border px-3 py-2 shadow-lg no-print"
      style={{ bottom: 'calc(var(--bmb-bottom-nav-h, 0px) + var(--bmb-sticky-h, 0px) + 12px)' }}
      data-testid="ambient-music"
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={state.playing}
        aria-label={state.playing ? 'หยุดเพลงบรรเลง' : 'เปิดเพลงบรรเลง'}
        title={state.playing ? 'หยุดเพลง' : 'เปิดเพลงบรรเลง'}
        className={`w-9 h-9 rounded-full flex items-center justify-center text-lg transition-colors focus-visible:outline-2 focus-visible:outline-brand-primary ${
          state.playing
            ? 'bg-brand-primary text-white'
            : 'bg-brand-bg text-brand-muted hover:text-brand-primary'
        }`}
        data-testid="ambient-music-toggle"
      >
        <span aria-hidden="true">{state.playing ? '⏸' : '♪'}</span>
      </button>
      <div className="flex flex-col gap-0.5">
        <span
          className="text-[10px] font-semibold text-brand-muted leading-none"
          data-testid="ambient-music-status"
        >
          {state.playing ? (state.ducked ? 'ลดเสียง (Bite กำลังพูด)' : 'กำลังเล่น') : 'เพลงปิด'}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(state.volume * 100)}
          onChange={(e) => manager.setVolume(Number(e.target.value) / 100)}
          aria-label="ระดับเสียงเพลงบรรเลง"
          className="w-20 h-1 accent-[var(--color-brand-primary)] cursor-pointer"
          data-testid="ambient-music-volume"
        />
      </div>
    </div>
  )
}