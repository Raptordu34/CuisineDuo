import { useState, useEffect, useRef, useCallback } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { supabase } from '../../lib/supabase'

// Agreger l'historique GIF par titre pour l'IA
function aggregateGifHistory(messages) {
  const counts = {}
  for (const msg of messages) {
    const title = msg.gif_title?.trim()
    if (!title) continue
    if (!counts[title]) {
      counts[title] = { title, count: 0, lastUsed: msg.created_at }
    }
    counts[title].count++
    if (new Date(msg.created_at) > new Date(counts[title].lastUsed)) {
      counts[title].lastUsed = msg.created_at
    }
  }
  return Object.values(counts)
    .sort((a, b) => b.count - a.count || new Date(b.lastUsed) - new Date(a.lastUsed))
    .slice(0, 10)
}

export default function GifPicker({ onSelect, onClose, messages, profile }) {
  const { t, lang } = useLanguage()

  // Onglets
  const [activeTab, setActiveTab] = useState('suggestions')

  // Recherche
  const [query, setQuery] = useState('')
  const [searchGifs, setSearchGifs] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchOffset, setSearchOffset] = useState(0)
  const [searchHasMore, setSearchHasMore] = useState(true)
  const [searchLoadingMore, setSearchLoadingMore] = useState(false)
  const isSearching = query.trim().length > 0

  // Suggestions de recherche (localStorage)
  const [searchHistory, setSearchHistory] = useState([])
  const [showSearchHistory, setShowSearchHistory] = useState(false)

  // Suggestions IA
  const [suggestedGifs, setSuggestedGifs] = useState([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  // Historique
  const [historyGifs, setHistoryGifs] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Trending
  const [trendingGifs, setTrendingGifs] = useState([])
  const [trendingLoading, setTrendingLoading] = useState(false)
  const [trendingOffset, setTrendingOffset] = useState(0)
  const [trendingHasMore, setTrendingHasMore] = useState(true)
  const [trendingLoadingMore, setTrendingLoadingMore] = useState(false)

  const debounceRef = useRef(null)
  const inputRef = useRef(null)

  // Charger l'historique de recherche depuis localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`gifSearchHistory_${profile?.id}`)
    if (stored) {
      try { setSearchHistory(JSON.parse(stored)) } catch { /* ignore */ }
    }
  }, [profile?.id])

  // Focus sur l'input au montage
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // --- Recherche Giphy ---
  const fetchSearch = useCallback(async (searchQuery, newOffset = 0, append = false) => {
    if (append) {
      setSearchLoadingMore(true)
    } else {
      setSearchLoading(true)
    }
    try {
      const res = await fetch('/api/gif-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, lang, offset: newOffset }),
      })
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      if (append) {
        setSearchGifs(prev => [...prev, ...data.gifs])
      } else {
        setSearchGifs(data.gifs)
      }
      setSearchOffset(data.next_offset)
      setSearchHasMore(data.gifs.length >= 20)
    } catch {
      if (!append) setSearchGifs([])
    } finally {
      setSearchLoading(false)
      setSearchLoadingMore(false)
    }
  }, [lang])

  // --- Suggestions IA ---
  const fetchSuggestions = useCallback(async () => {
    setSuggestionsLoading(true)
    try {
      // Recuperer l'historique GIF de l'utilisateur
      const { data: gifHistoryData } = await supabase
        .from('messages')
        .select('gif_title, created_at')
        .eq('household_id', profile.household_id)
        .eq('profile_id', profile.id)
        .eq('message_type', 'gif')
        .not('gif_title', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50)

      const aggregated = aggregateGifHistory(gifHistoryData || [])
      const recentGifs = (gifHistoryData || [])
        .slice(0, 5)
        .map(g => g.gif_title)
        .filter(Boolean)

      // Preparer le contexte conversation
      const safeMessages = Array.isArray(messages) ? messages : []
      const contextMessages = safeMessages
        .filter(m => m.content && m.content.trim())
        .slice(-15)
        .map(m => ({ content: m.content, is_ai: m.is_ai || false }))

      const res = await fetch('/api/gif-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: contextMessages,
          gifHistory: aggregated,
          recentGifs,
          lang,
        }),
      })

      if (!res.ok) throw new Error('Suggestion failed')
      const data = await res.json()
      setSuggestedGifs(data.gifs || [])
    } catch {
      setSuggestedGifs([])
    } finally {
      setSuggestionsLoading(false)
    }
  }, [messages, profile, lang])

  // --- Historique GIF ---
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const { data } = await supabase
        .from('messages')
        .select('id, media_url, gif_title, giphy_id, created_at')
        .eq('household_id', profile.household_id)
        .eq('profile_id', profile.id)
        .eq('message_type', 'gif')
        .order('created_at', { ascending: false })
        .limit(50)

      // Deduplication par URL
      const seen = new Set()
      const gifs = []
      for (const msg of data || []) {
        if (!msg.media_url || seen.has(msg.media_url)) continue
        seen.add(msg.media_url)
        gifs.push({
          id: msg.giphy_id || msg.id,
          title: msg.gif_title || 'GIF',
          url: msg.media_url,
          preview_url: msg.media_url,
          width: 200,
          height: 200,
        })
      }
      setHistoryGifs(gifs)
    } catch {
      setHistoryGifs([])
    } finally {
      setHistoryLoading(false)
    }
  }, [profile])

  // --- Trending ---
  const fetchTrending = useCallback(async (newOffset = 0, append = false) => {
    if (append) {
      setTrendingLoadingMore(true)
    } else {
      setTrendingLoading(true)
    }
    try {
      const res = await fetch('/api/gif-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang, offset: newOffset }),
      })
      if (!res.ok) throw new Error('Trending failed')
      const data = await res.json()
      if (append) {
        setTrendingGifs(prev => [...prev, ...data.gifs])
      } else {
        setTrendingGifs(data.gifs)
      }
      setTrendingOffset(data.next_offset)
      setTrendingHasMore(data.gifs.length >= 20)
    } catch {
      if (!append) setTrendingGifs([])
    } finally {
      setTrendingLoading(false)
      setTrendingLoadingMore(false)
    }
  }, [lang])

  // Charger suggestions + historique au montage
  useEffect(() => {
    fetchSuggestions()
    fetchHistory()
  }, [fetchSuggestions, fetchHistory])

  // Charger trending quand on clique sur l'onglet (lazy)
  useEffect(() => {
    if (activeTab === 'trending' && trendingGifs.length === 0 && !trendingLoading) {
      fetchTrending()
    }
  }, [activeTab, trendingGifs.length, trendingLoading, fetchTrending])

  // --- Handlers ---
  const handleQueryChange = (e) => {
    const value = e.target.value
    setQuery(value)
    setShowSearchHistory(false)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim()) {
      debounceRef.current = setTimeout(() => {
        setSearchOffset(0)
        setSearchHasMore(true)
        fetchSearch(value, 0, false)
      }, 300)
    }
  }

  const saveSearchToHistory = (term) => {
    if (!term.trim() || !profile?.id) return
    const updated = [term.trim(), ...searchHistory.filter(s => s !== term.trim())].slice(0, 10)
    setSearchHistory(updated)
    localStorage.setItem(`gifSearchHistory_${profile.id}`, JSON.stringify(updated))
  }

  const handleSearchSubmit = (term) => {
    setQuery(term)
    setShowSearchHistory(false)
    saveSearchToHistory(term)
    setSearchOffset(0)
    setSearchHasMore(true)
    fetchSearch(term, 0, false)
  }

  const clearSearchHistory = () => {
    setSearchHistory([])
    localStorage.removeItem(`gifSearchHistory_${profile?.id}`)
    setShowSearchHistory(false)
  }

  const handleSelect = (gif) => {
    if (isSearching) {
      saveSearchToHistory(query)
    }
    onSelect({ url: gif.url, title: gif.title, id: gif.id })
  }

  // --- Rendu ---
  const renderSkeleton = (color = 'bg-gray-100') => (
    <div className="grid grid-cols-3 gap-1">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className={`aspect-square ${color} rounded-lg animate-pulse`} />
      ))}
    </div>
  )

  const renderGifGrid = (gifs) => (
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
  )

  const renderEmpty = (message) => (
    <div className="text-center py-8 text-gray-400 text-sm">{message}</div>
  )

  const renderTabContent = () => {
    if (activeTab === 'suggestions') {
      if (suggestionsLoading) return renderSkeleton('bg-indigo-50')
      if (suggestedGifs.length === 0) return renderEmpty(t('chat.gifNoSuggestions'))
      return renderGifGrid(suggestedGifs)
    }

    if (activeTab === 'history') {
      if (historyLoading) return renderSkeleton('bg-orange-50')
      if (historyGifs.length === 0) return renderEmpty(t('chat.gifNoHistory'))
      return renderGifGrid(historyGifs)
    }

    // trending
    if (trendingLoading) return renderSkeleton()
    if (trendingGifs.length === 0) return renderEmpty(t('chat.gifTrending'))
    return (
      <>
        {renderGifGrid(trendingGifs)}
        {trendingHasMore && (
          <button
            type="button"
            onClick={() => fetchTrending(trendingOffset, true)}
            disabled={trendingLoadingMore}
            className="w-full py-2 mt-2 text-sm text-orange-500 font-medium hover:text-orange-600 cursor-pointer disabled:opacity-50"
          >
            {trendingLoadingMore ? '...' : t('chat.gifLoadMore')}
          </button>
        )}
      </>
    )
  }

  const renderSearchContent = () => {
    if (searchLoading) return renderSkeleton()
    if (searchGifs.length === 0) return renderEmpty(t('chat.gifNoResults'))
    return (
      <>
        {renderGifGrid(searchGifs)}
        {searchHasMore && (
          <button
            type="button"
            onClick={() => fetchSearch(query, searchOffset, true)}
            disabled={searchLoadingMore}
            className="w-full py-2 mt-2 text-sm text-orange-500 font-medium hover:text-orange-600 cursor-pointer disabled:opacity-50"
          >
            {searchLoadingMore ? '...' : t('chat.gifLoadMore')}
          </button>
        )}
      </>
    )
  }

  const tabs = [
    { key: 'suggestions', label: t('chat.gifSuggestions'), activeClass: 'bg-indigo-100 text-indigo-600' },
    { key: 'history', label: t('chat.gifHistory'), activeClass: 'bg-orange-100 text-orange-600' },
    { key: 'trending', label: t('chat.gifTrending'), activeClass: 'bg-gray-200 text-gray-800' },
  ]

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Bottom sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-lg flex flex-col max-h-[70vh] md:max-w-2xl md:mx-auto">
        {/* Header avec recherche */}
        <div className="relative flex items-center gap-2 px-4 pt-3 pb-2 border-b border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleQueryChange}
              onFocus={() => { if (!query.trim() && searchHistory.length > 0) setShowSearchHistory(true) }}
              onBlur={() => setTimeout(() => setShowSearchHistory(false), 150)}
              placeholder={t('chat.gifSearch')}
              className="w-full border border-gray-200 rounded-full px-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />

            {/* Dropdown suggestions de recherche */}
            {showSearchHistory && searchHistory.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                {searchHistory.map((term, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSearchSubmit(term)}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    {term}
                  </button>
                ))}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={clearSearchHistory}
                  className="w-full px-4 py-2 text-left text-xs text-red-400 hover:bg-red-50 cursor-pointer border-t border-gray-100"
                >
                  {t('chat.gifClearSearch')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Onglets (masques pendant la recherche) */}
        {!isSearching && (
          <div className="flex gap-1 px-4 py-2 border-b border-gray-100 shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === tab.key ? tab.activeClass : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Label contextuel */}
        {isSearching && (
          <div className="px-4 py-1.5 shrink-0">
            <span className="text-xs font-medium text-gray-500">{query}</span>
          </div>
        )}

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {isSearching ? renderSearchContent() : renderTabContent()}
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
