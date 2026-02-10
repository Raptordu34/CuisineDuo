import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import RecipeCategoryFilter from '../components/recipes/RecipeCategoryFilter'
import RecipeList from '../components/recipes/RecipeList'
import AddRecipeModal from '../components/recipes/AddRecipeModal'
import DictationButton from '../components/DictationButton'
import DictationTrace from '../components/DictationTrace'
import RecipeSearchResultsModal from '../components/recipes/RecipeSearchResultsModal'
import { useTasteProfile } from '../hooks/useTasteProfile'

export default function RecipesPage() {
  const { profile } = useAuth()
  const { t, lang } = useLanguage()
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState([])
  const [ratings, setRatings] = useState({})
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

  const { householdTasteProfiles } = useTasteProfile(profile?.id, profile?.household_id)

  // AI search states
  const [dictationCorrecting, setDictationCorrecting] = useState(false)
  const [dictationTrace, setDictationTrace] = useState(null)
  const [showCommandInput, setShowCommandInput] = useState(false)
  const [commandText, setCommandText] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [generatingSuggestion, setGeneratingSuggestion] = useState(false)
  const [prefillRecipe, setPrefillRecipe] = useState(null)
  const commandInputRef = useRef(null)

  const fetchRecipes = useCallback(async () => {
    if (!profile?.household_id) return
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('household_id', profile.household_id)
      .order('created_at', { ascending: false })
    if (data) setRecipes(data)
  }, [profile?.household_id])

  const fetchRatings = useCallback(async () => {
    if (!profile?.id) return
    try {
      const { data } = await supabase
        .from('recipe_ratings')
        .select('recipe_id, rating')
        .eq('profile_id', profile.id)
      if (data) {
        const map = {}
        for (const r of data) map[r.recipe_id] = r.rating
        setRatings(map)
      }
    } catch {
      // Table may not exist yet
    }
  }, [profile?.id])

  const handleRate = useCallback(async (recipeId, value) => {
    if (!profile?.id) return
    setRatings((prev) => ({ ...prev, [recipeId]: value }))
    try {
      await supabase.from('recipe_ratings').upsert({
        recipe_id: recipeId,
        profile_id: profile.id,
        rating: value,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'recipe_id,profile_id' })
    } catch {
      // Table may not exist yet
    }
  }, [profile?.id])

  useEffect(() => {
    if (!profile?.household_id) return

    fetchRecipes()
    fetchRatings()

    const channel = supabase
      .channel(`recipes:${profile.household_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recipes',
          filter: `household_id=eq.${profile.household_id}`,
        },
        () => fetchRecipes()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.household_id, fetchRecipes, fetchRatings])

  const handleAdd = async (recipeData) => {
    const { _tasteParams, ...rest } = recipeData
    const { data } = await supabase.from('recipes').insert({
      ...rest,
      household_id: profile.household_id,
      created_by: profile.id,
    }).select().single()
    setShowAddModal(false)
    setPrefillRecipe(null)
    if (data) {
      // Insert taste params if any values are set
      if (_tasteParams && Object.values(_tasteParams).some(v => v != null)) {
        await supabase.from('recipe_taste_params').upsert({
          recipe_id: data.id,
          ..._tasteParams,
        }, { onConflict: 'recipe_id' })
      }
      navigate(`/recipes/${data.id}`)
    }
  }

  const handleRecipeClick = (recipe) => {
    navigate(`/recipes/${recipe.id}`)
  }

  const handleDelete = useCallback(async (id) => {
    await supabase.from('recipes').delete().eq('id', id)
    fetchRecipes()
  }, [fetchRecipes])

  // AI search handler
  const handleRecipeCommand = useCallback(async (text, cmdLang) => {
    if (!text.trim()) return
    setDictationCorrecting(true)

    const recipeSummaries = recipes.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      description: r.description,
      ingredients_summary: r.ingredients?.map(i => i.name).join(', ') || '',
    }))

    try {
      const res = await fetch('/api/recipe-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'search',
          text,
          lang: cmdLang || lang,
          recipes: recipeSummaries,
          householdTasteProfiles,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setDictationTrace({
          rawTranscript: text,
          correctedResult: data.summary || JSON.stringify(data),
          timestamp: Date.now(),
        })
        setSearchResults(data)
      }
    } catch {
      // silently fail
    } finally {
      setDictationCorrecting(false)
    }
  }, [recipes, lang, householdTasteProfiles])

  // Dictation handler
  const handleDictation = useCallback(async (text, dictLang) => {
    await handleRecipeCommand(text, dictLang)
  }, [handleRecipeCommand])

  // Select existing recipe from search results
  const handleSelectExisting = useCallback((recipeId) => {
    setSearchResults(null)
    navigate(`/recipes/${recipeId}`)
  }, [navigate])

  // Select a suggestion -> generate full recipe
  const handleSelectSuggestion = useCallback(async (suggestion) => {
    setGeneratingSuggestion(true)
    try {
      const res = await fetch('/api/recipe-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          text: suggestion.name,
          lang,
          description: suggestion.description,
          householdTasteProfiles,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.recipe) {
          setPrefillRecipe(data.recipe)
          setSearchResults(null)
          setShowAddModal(true)
        }
      }
    } catch {
      // silently fail
    } finally {
      setGeneratingSuggestion(false)
    }
  }, [lang, householdTasteProfiles])

  // Text command submission
  const handleCommandSubmit = useCallback(() => {
    if (!commandText.trim()) return
    const text = commandText.trim()
    setCommandText('')
    setShowCommandInput(false)
    handleRecipeCommand(text, lang)
  }, [commandText, lang, handleRecipeCommand])

  // Toggle command input
  const toggleCommandInput = useCallback(() => {
    setShowCommandInput((prev) => {
      if (!prev) {
        setTimeout(() => commandInputRef.current?.focus(), 50)
      }
      return !prev
    })
  }, [])

  const isBusy = dictationCorrecting || generatingSuggestion

  return (
    <div className="fixed top-14 bottom-16 left-0 right-0 z-40 flex flex-col bg-gray-50 md:static md:z-auto md:max-w-5xl md:mx-auto md:-mt-8 md:-mb-8 md:h-[calc(100dvh-4rem)]">
      {/* Header */}
      <div className="shrink-0 px-3 pt-3 pb-2 flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0 shrink">
          <h1 className="text-lg font-bold text-gray-900 truncate">{t('recipes.title')}</h1>
          <DictationButton
            onResult={handleDictation}
            disabled={isBusy}
            color="orange"
          />
          <button
            onClick={toggleCommandInput}
            disabled={isBusy}
            className="p-1.5 text-gray-500 hover:text-orange-500 disabled:opacity-40 transition-colors cursor-pointer"
            title={t('recipes.aiSearchHint')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
            </svg>
          </button>
          {dictationCorrecting && (
            <span className="text-xs text-gray-400 animate-pulse shrink-0">{t('dictation.correcting')}</span>
          )}
        </div>
        <button
          onClick={() => { setPrefillRecipe(null); setShowAddModal(true) }}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-xs font-medium transition-colors cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t('recipes.add')}
        </button>
      </div>

      {/* Text command input */}
      {showCommandInput && (
        <div className="shrink-0 px-3 pb-2">
          <form
            onSubmit={(e) => { e.preventDefault(); handleCommandSubmit() }}
            className="flex gap-2 items-end"
          >
            <textarea
              ref={commandInputRef}
              value={commandText}
              onChange={(e) => setCommandText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleCommandSubmit()
                }
              }}
              placeholder={t('recipes.commandPlaceholder')}
              rows={1}
              className="flex-1 resize-none border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
              style={{ maxHeight: '80px' }}
            />
            <button
              type="submit"
              disabled={!commandText.trim() || isBusy}
              className="shrink-0 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {t('chat.send')}
            </button>
          </form>
        </div>
      )}

      {/* Dictation trace */}
      {dictationTrace && (
        <div className="shrink-0 px-3">
          <DictationTrace trace={dictationTrace} />
        </div>
      )}

      {/* Search */}
      <div className="shrink-0 px-3 pb-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('recipes.search')}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
        />
      </div>

      {/* Category filter */}
      <div className="shrink-0 px-3 pb-2">
        <RecipeCategoryFilter selected={category} onSelect={setCategory} />
      </div>

      {/* Recipe list */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <RecipeList
          recipes={recipes}
          category={category}
          search={search}
          onClick={handleRecipeClick}
          onDelete={handleDelete}
          ratings={ratings}
          onRate={handleRate}
        />
      </div>

      {/* Add modal */}
      {showAddModal && (
        <AddRecipeModal
          onClose={() => { setShowAddModal(false); setPrefillRecipe(null) }}
          onAdd={handleAdd}
          initialData={prefillRecipe}
        />
      )}

      {/* Search results modal */}
      {searchResults && (
        <RecipeSearchResultsModal
          results={searchResults}
          onSelectExisting={handleSelectExisting}
          onSelectSuggestion={handleSelectSuggestion}
          onClose={() => setSearchResults(null)}
          generatingSuggestion={generatingSuggestion}
        />
      )}
    </div>
  )
}
