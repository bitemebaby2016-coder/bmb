// ============================================
// Bite Me Baby — BackgroundMusicSettingsPage source contract tests
// ============================================

import { describe, it, expect } from 'vitest'
import pageSrc from '../pages/admin/BackgroundMusicSettingsPage.tsx?raw'

describe('BackgroundMusicSettingsPage — source contract', () => {
  it('imports required libs (backgroundMusic, supabase)', () => {
    expect(pageSrc).toContain("from '@/lib/backgroundMusic'")
    expect(pageSrc).toContain("from '@/lib/supabase'")
  })

  it('uses MUSIC_BUCKET constant', () => {
    expect(pageSrc).toContain('MUSIC_BUCKET')
    expect(pageSrc).toContain('background_music')
  })

  it('has enable/disable toggle bound to business_settings.ambient_music', () => {
    expect(pageSrc).toContain('ambient_music')
    expect(pageSrc).toContain('business_settings')
    expect(pageSrc).toContain('enabled')
    expect(pageSrc).toContain('music-enabled-toggle')
  })

  it('has file upload with accept="audio/*"', () => {
    expect(pageSrc).toContain('accept="audio/*"')
    expect(pageSrc).toContain('music-file-upload')
  })

  it('has drag-and-drop support', () => {
    expect(pageSrc).toContain('onDragOver')
    expect(pageSrc).toContain('onDrop')
  })

  it('has URL import (paste external URL → fetch+compress+upload)', () => {
    expect(pageSrc).toContain('externalUrl')
    expect(pageSrc).toContain('music-url-import')
    expect(pageSrc).toContain('music-url-import-btn')
    expect(pageSrc).toContain('fetch(')
  })

  it('uses validateMusicFile and compressAudioForMusic', () => {
    expect(pageSrc).toContain('validateMusicFile')
    expect(pageSrc).toContain('compressAudioForMusic')
    expect(pageSrc).toContain('uploadBackgroundMusicAsset')
  })

  it('lists bucket files with audio preview', () => {
    expect(pageSrc).toContain('listBackgroundMusicFiles')
    expect(pageSrc).toContain('<audio controls')
    expect(pageSrc).toContain('music-bucket-files')
    expect(pageSrc).toContain('music-preview-')
  })

  it('has delete button per file', () => {
    expect(pageSrc).toContain('deleteBackgroundMusicAsset')
    expect(pageSrc).toContain('music-delete-')
  })

  it('has copy URL button', () => {
    expect(pageSrc).toContain('navigator.clipboard')
    expect(pageSrc).toContain('music-copy-')
  })

  it('has refresh button with testid', () => {
    expect(pageSrc).toContain('music-refresh')
  })

  it('shows loading/empty states', () => {
    expect(pageSrc).toContain('music-bucket-loading')
    expect(pageSrc).toContain('music-bucket-empty')
  })

  it('uses GlassCard and showToast', () => {
    expect(pageSrc).toContain('GlassCard')
    expect(pageSrc).toContain('showToast')
  })
})