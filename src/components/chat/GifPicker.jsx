import { useState, useEffect, useRef, useCallback } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

export default function GifPicker({ onSelect, onClose }) {
  const { t, lang } = useLanguage()
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const debounceRef = useRef(null)
  const inputRef = useRef(null)

  const fetchGifs = useCallback(async (searchQuery, newOffset = 0, append = false) => {
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    try {
      const res = await fetch('/api/gif-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery || undefined,
          lang,
          offset: newOffset,
        }),
      })

      if (!res.ok) throw new Error('Search failed')

      const data = await res.json()

      if (append) {
        setGifs((prev) => [...prev, ...data.gifs])
      } else {
        setGifs(data.gifs)
      }

      setOffset(data.next_offset)
      setHasMore(data.gifs.length >= 20)
    } catch {
      if (!append) setGifs([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [lang])

  // Charger les tendances au montage
  useEffect(() => {
    fetchGifs('')
  }, [fetchGifs])

  // Focus sur l'input au montage
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleQueryChange = (e) => {
    const value = e.target.value
    setQuery(value)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setOffset(0)
      setHasMore(true)
      fetchGifs(value, 0, false)
    }, 300)
  }

  const handleLoadMore = () => {
    if (loadingMore) return
    fetchGifs(query, offset, true)
  }

  const handleSelect = (gif) => {
    onSelect(gif.url)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-lg flex flex-col max-h-[70vh] md:max-w-2xl md:mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder={t('chat.gifSearch')}
            className="flex-1 border border-gray-200 rounded-full px-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
        </div>

        {/* Label */}
        <div className="px-4 py-1.5 shrink-0">
          <span className="text-xs font-medium text-gray-500">
            {query.trim() ? query : t('chat.gifTrending')}
          </span>
        </div>

        {/* GIF Grid */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {loading ? (
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square bg-gray-100 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : gifs.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              {query.trim() ? t('chat.gifNoResults') : t('chat.gifTrending')}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-1">
                {gifs.map((gif) => (
                  <button
                    key={gif.id}
                    type="button"
                    onClick={() => handleSelect(gif)}
                    className="relative overflow-hidden rounded-lg bg-gray-100 cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ aspectRatio: `${gif.width} / ${gif.height}` }}
                  >
                    <img
                      src={gif.preview_url}
                      alt={gif.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>

              {hasMore && (
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="w-full py-2 mt-2 text-sm text-orange-500 font-medium hover:text-orange-600 cursor-pointer disabled:opacity-50"
                >
                  {loadingMore ? '...' : t('chat.gifLoadMore')}
                </button>
              )}
            </>
          )}
        </div>

        {/* Attribution */}
        <div className="px-4 py-2 border-t border-gray-100 text-center shrink-0">
          <span className="text-[10px] text-gray-400">
            {t('chat.gifPoweredBy', { source: 'GIPHY' })}
          </span>
        </div>
      </div>
    </>
  )
}
