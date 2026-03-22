'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { MapPin, Loader2, X } from 'lucide-react'

interface Suggestion {
  placeId: string
  description: string
}

interface Props {
  value: string
  onChange: (address: string, lat?: number, lng?: number) => void
  placeholder?: string
  className?: string
}

declare global {
  interface Window {
    google: any
    _mapsLoaded?: boolean
    _mapsLoading?: boolean
    _mapsCallbacks?: (() => void)[]
  }
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  return new Promise((resolve) => {
    if (window._mapsLoaded) { resolve(); return }
    if (!window._mapsCallbacks) window._mapsCallbacks = []
    window._mapsCallbacks.push(resolve)
    if (window._mapsLoading) return
    window._mapsLoading = true
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=lt`
    script.async = true
    script.defer = true
    script.onload = () => {
      window._mapsLoaded = true
      window._mapsLoading = false
      window._mapsCallbacks?.forEach(cb => cb())
      window._mapsCallbacks = []
    }
    document.head.appendChild(script)
  })
}

export default function AddressAutocomplete({ value, onChange, placeholder = 'Pvz.: Pilaitė, Vilnius', className }: Props) {
  const [input, setInput] = useState(value)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const autocompleteService = useRef<any>(null)
  const geocoder = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setInput(value)
  }, [value])

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!key) return
    loadGoogleMaps(key).then(() => {
      autocompleteService.current = new window.google.maps.places.AutocompleteService()
      geocoder.current = new window.google.maps.Geocoder()
      setReady(true)
    })
  }, [])

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const fetchSuggestions = useCallback((val: string) => {
    if (!ready || !autocompleteService.current || val.length < 2) {
      setSuggestions([])
      return
    }
    setLoading(true)
    autocompleteService.current.getPlacePredictions(
      { input: val, language: 'lt', componentRestrictions: { country: 'lt' } },
      (predictions: any[], status: string) => {
        setLoading(false)
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestions(predictions.map((p: any) => ({ placeId: p.place_id, description: p.description })))
          setOpen(true)
        } else {
          setSuggestions([])
        }
      }
    )
  }, [ready])

  function handleInput(val: string) {
    setInput(val)
    onChange(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300)
  }

  function selectSuggestion(s: Suggestion) {
    setInput(s.description)
    setSuggestions([])
    setOpen(false)

    if (geocoder.current) {
      geocoder.current.geocode({ placeId: s.placeId }, (results: any[], status: string) => {
        if (status === 'OK' && results[0]) {
          const loc = results[0].geometry.location
          onChange(s.description, loc.lat(), loc.lng())
        } else {
          onChange(s.description)
        }
      })
    } else {
      onChange(s.description)
    }
  }

  function clear() {
    setInput('')
    setSuggestions([])
    setOpen(false)
    onChange('')
  }

  return (
    <div ref={containerRef} className="relative">
      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={18} />
      <input
        type="text"
        value={input}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className={className || 'w-full border border-[var(--border-subtle)] rounded-xl pl-11 pr-10 py-2.5 text-[var(--text-primary)] bg-[var(--bg-input)] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-colors placeholder:text-[var(--text-tertiary)]'}
        autoComplete="off"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {loading && <Loader2 size={15} className="animate-spin text-gray-400" />}
        {input && !loading && (
          <button onClick={clear} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={15} />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl shadow-lg overflow-hidden">
          {suggestions.map(s => (
            <li key={s.placeId}>
              <button
                onMouseDown={() => selectSuggestion(s)}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-blue-500/10 text-left transition-colors"
              >
                <MapPin size={14} className="text-[var(--text-secondary)] mt-0.5 shrink-0" />
                <span className="text-sm text-[var(--text-primary)]">{s.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
