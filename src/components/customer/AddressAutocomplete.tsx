// ============================================
// Bite Me Baby — Address Autocomplete with Google Places API
// Real-time suggestions as user types → click → fill lat/lng
// ============================================

import { useState, useRef, useEffect, useCallback } from 'react'
import { getPlaceAutocomplete, getPlaceDetails, isGoogleMapsConfigured } from '@/lib/googleMaps'
import { GlassCard } from '@/components/ui/GlassCard'

export interface AddressResult {
  address: string
  lat: number
  lng: number
  placeId?: string
}

export interface AddressAutocompleteProps {
  value: string
  onChange: (result: AddressResult) => void
  placeholder?: string
  label?: string
  required?: boolean
}

export function AddressAutocomplete({ value, onChange, placeholder = 'พิมพ์ที่อยู่...', label = 'ที่อยู่จัดส่ง', required = false }: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined as any)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = useCallback(async (query: string) => {
    if (!isGoogleMapsConfigured()) { setShowSuggestions(false); return }
    clearTimeout(timerRef.current)
    setLoading(true)
    try {
      const results = await getPlaceAutocomplete(query)
      setSuggestions(results.map(r => r.description).slice(0, 5))
      setShowSuggestions(true)
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  const selectSuggestion = useCallback(async (desc: string) => {
    const result = suggestions.find(s => s === desc)
    if (!result) return
    // We need placeId first, so re-query to get it
    const predictions = await getPlaceAutocomplete(desc)
    const match = predictions.find(p => p.description === desc)
    if (!match || !match.placeId) { setShowSuggestions(false); return }
    const details = await getPlaceDetails(match.placeId)
    if (details) {
      onChange({ address: details.formattedAddress, lat: details.lat, lng: details.lng, placeId: match.placeId })
    }
    setShowSuggestions(false)
  }, [suggestions, onChange])

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-semibold text-brand-accent mb-1">{label}{required && <span className="text-red-500">*</span>}</label>
      <input
        type="text" value={value} onChange={e => { onChange({ address: e.target.value, lat: 0, lng: 0 }); search(e.target.value) }}
        onFocus={() => showSuggestions && setSuggestions(prev => prev)}
        placeholder={placeholder}
        className="input w-full rounded-xl"
      />
      {showSuggestions && suggestions.length > 0 && (
        <GlassCard className="absolute z-50 w-full max-w-md -left-0 mt-1 overflow-hidden">
          <ul className="divide-y divide-white/10 max-h-48 overflow-y-auto">
            {suggestions.map((s, i) => (
              <li key={i} onClick={() => selectSuggestion(s)} className="px-3 py-2 text-sm cursor-pointer hover:bg-brand-primary/10 hover:text-brand-primary transition-colors">
                📍 {s}
              </li>
            ))}
            {loading && <li className="px-3 py-2 text-sm text-brand-muted animate-pulse">⏳ กำลังค้นหา...</li>}
          </ul>
        </GlassCard>
      )}
    </div>
  )
}