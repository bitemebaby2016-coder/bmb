import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getTheme,
  applyTheme,
  cycleTheme,
  migrateTheme,
  THEME_STORAGE_KEY,
  THEME_LABELS,
  THEME_CHANGE_EVENT,
  type ThemeName,
} from '@/lib/theme'

// ============================================
// Stage B — TWO-THEME THEME MANAGER
// - legacy 3-theme values (orange/gray/dark) ต้อง migrate deterministic
// - cycle มีแค่ light <-> dark
// - applyTheme เขียน attribute + localStorage + meta theme-color + dispatch event
// ============================================

describe('theme manager (3 themes: light / dark / graphite)', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('migrateTheme — deterministic legacy migration', () => {
    it("maps legacy 'orange' -> 'light'", () => {
      expect(migrateTheme('orange')).toBe('light')
    })
    it("maps legacy 'gray' -> 'dark' (Owner 2026-10-10: gray ถูกยกเลิก)", () => {
      expect(migrateTheme('gray')).toBe('dark')
    })
    it("keeps 'dark' -> 'dark'", () => {
      expect(migrateTheme('dark')).toBe('dark')
    })
    it("keeps 'light' -> 'light'", () => {
      expect(migrateTheme('light')).toBe('light')
    })
    it("maps 'graphite' -> 'graphite' (theme 3 stays)", () => {
      expect(migrateTheme('graphite')).toBe('graphite')
    })
    it('falls back to light for null/unknown values', () => {
      expect(migrateTheme(null)).toBe('light')
      expect(migrateTheme(undefined)).toBe('light')
      expect(migrateTheme('purple')).toBe('light')
    })
  })

  describe('getTheme', () => {
    it('defaults to light when storage is empty', () => {
      expect(getTheme()).toBe('light')
    })
    it('reads legacy gray as dark (migration applied on read)', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'gray')
      expect(getTheme()).toBe('dark')
    })
    it('reads legacy orange as light', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'orange')
      expect(getTheme()).toBe('light')
    })
    it('reads graphite as graphite', () => {
      localStorage.setItem(THEME_STORAGE_KEY, 'graphite')
      expect(getTheme()).toBe('graphite')
    })
    it('only returns one of the 3 valid themes', () => {
      for (const v of ['orange', 'gray', 'dark', 'light', 'blue', '']) {
        localStorage.setItem(THEME_STORAGE_KEY, v)
        const t: ThemeName = getTheme()
        expect(['light', 'dark', 'graphite']).toContain(t)
      }
    })
  })

  describe('applyTheme', () => {
    it('sets data-theme + persists + updates meta theme-color', () => {
      const meta = document.createElement('meta')
      meta.setAttribute('name', 'theme-color')
      document.head.appendChild(meta)

      applyTheme('dark')
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
      expect(meta.content).toBe('#121214')

      applyTheme('light')
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
      expect(meta.content).toBe('#FF5E1E')

      meta.remove()
    })

    it('dispatches THEME_CHANGE_EVENT so non-state components can react', () => {
      const spy = vi.fn()
      window.addEventListener(THEME_CHANGE_EVENT, spy)
      applyTheme('dark')
      expect(spy).toHaveBeenCalledTimes(1)
      window.removeEventListener(THEME_CHANGE_EVENT, spy)
    })

    it('applyTheme(graphite) sets data-theme + persists + graphite theme-color', () => {
      const meta = document.createElement('meta')
      meta.setAttribute('name', 'theme-color')
      document.head.appendChild(meta)

      applyTheme('graphite')
      expect(document.documentElement.getAttribute('data-theme')).toBe('graphite')
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('graphite')
      expect(meta.content).toBe('#1B1B20')

      meta.remove()
    })
  })

  describe('cycleTheme - 3 themes round-robin', () => {
    it('light -> dark -> graphite -> light', () => {
      expect(cycleTheme('light')).toBe('dark')
      expect(cycleTheme('dark')).toBe('graphite')
      expect(cycleTheme('graphite')).toBe('light')
    })
  })

  describe('THEME_LABELS - labels for all 3 themes', () => {
    it('has labels for exactly light + dark + graphite', () => {
      expect(Object.keys(THEME_LABELS).sort()).toEqual(['dark', 'graphite', 'light'])
      expect(THEME_LABELS.light).toContain('Light Minimal')
      expect(THEME_LABELS.dark).toContain('Dark Glass')
      expect(THEME_LABELS.graphite).toContain('Graphite Theatre')
    })
  })
})