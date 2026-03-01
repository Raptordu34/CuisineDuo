import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useMiamActions } from '../hooks/useMiamActions'
import { useMiam } from '../contexts/MiamContext'
import useOfflineRecipes from '../hooks/useOfflineRecipes'
import RecipeCard from '../components/recipes/RecipeCard'
import RecipeCategoryFilter from '../components/recipes/RecipeCategoryFilter'
import AddRecipeModal from '../components/recipes/AddRecipeModal'
import EditRecipeModal from '../components/recipes/EditRecipeModal'
import SuggestPreviewModal from '../components/recipes/SuggestPreviewModal'
import SuggestConfigModal from '../components/recipes/SuggestConfigModal'
import { apiPost } from '../lib/apiClient'
import { logAI } from '../lib/aiLogger'

const SUGGEST_TIMEOUT_MS = 55000

export default function RecipesPage() {
  const { profile } = useAuth()
  const { t, lang } = useLanguage()
  const { registerContextProvider } = useMiam()
  const navigate = useNavigate()
  const {
    recipes, saveRecipe, deleteRecipe: deleteRecipeOffline,
    pendingSyncIds, isOffline, refreshFromServer,
  } = useOfflineRecipes(profile?.household_id)

  const [inventoryItems, setInventoryItems] = useState([])
  const [category, setCategory] = useState('all')
  const [difficulty, setDifficulty] = useState('all')
  const [sortBy, setSortBy] = useState('recent')
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState(null)
  const [suggestPreview, setSuggestPreview] = useState(null)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestError, setSuggestError] = useState(null)
  const [showSuggestConfig, setShowSuggestConfig] = useState(false)

  // Miam actions
  useMiamActions({
    openAddRecipe: {
      handler: () => setShowAddModal(true),
      description: 'Open add recipe modal',
    },
    filterRecipeCategory: {
      handler: ({ category: cat }) => setCategory(cat === 'all' ? 'all' : cat),
      description: 'Filter recipes by category',
    },
    suggestRecipes: {
      handler: () => setShowSuggestConfig(true),
      description: 'Open recipe suggestion config',
    },
  })

  // Provide recipes context to Miam
  useEffect(() => {
    return registerContextProvider('recipes', () =>
      recipes.map(r => ({ id: r.id, name: r.name, category: r.category, difficulty: r.difficulty }))
    )
  }, [registerContextProvider, recipes])

  // Realtime: refresh from server on recipe changes
  useEffect(() => {
    if (!profile?.household_id) return

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
        () => refreshFromServer()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.household_id, refreshFromServer])

  // Fetch inventory for "feasible" badges
  useEffect(() => {
    if (!profile?.household_id) return
    supabase
      .from('inventory_items')
      .select('name, quantity, unit, estimated_expiry_date')
      .eq('household_id', profile.household_id)
      .then(({ data }) => { if (data) setInventoryItems(data) })
  }, [profile?.household_id])

  const handleAdd = async (recipeData) => {
    await supabase.from('recipes').insert({
      ...recipeData,
      household_id: profile.household_id,
      created_by: profile.id,
    })
    setShowAddModal(false)
  }

  const handleEdit = async (id, updates) => {
    await saveRecipe(id, updates)
    setEditingRecipe(null)
  }

  const handleDelete = async (id) => {
    await deleteRecipeOffline(id)
    setEditingRecipe(null)
  }

  // Fetch aggregated taste profile for the household
  const fetchTasteProfile = useCallback(async () => {
    if (!profile?.household_id) return null
    const { data: members } = await supabase
      .from('profiles')
      .select('id')
      .eq('household_id', profile.household_id)
    if (!members?.length) return null
    const memberIds = members.map(m => m.id)
    const { data: prefs } = await supabase
      .from('taste_preferences')
      .select('*')
      .in('profile_id', memberIds)
    if (!prefs?.length) return null

    // Aggregate: min for taste axes, union for banned/restrictions
    const axes = ['sweetness', 'saltiness', 'spiciness', 'acidity', 'bitterness', 'umami', 'richness']
    const aggregated = {}
    for (const axis of axes) {
      const values = prefs.map(p => p[axis]).filter(v => v != null)
      if (values.length) aggregated[axis] = Math.min(...values)
    }
    const bannedSet = new Set()
    const restrictionsSet = new Set()
    const notes = []
    for (const p of prefs) {
      if (Array.isArray(p.banned_ingredients)) p.banned_ingredients.forEach(i => bannedSet.add(i))
      if (Array.isArray(p.dietary_restrictions)) p.dietary_restrictions.forEach(r => restrictionsSet.add(r))
      if (p.additional_notes) notes.push(p.additional_notes)
    }
    return {
      ...aggregated,
      banned_ingredients: [...bannedSet],
      dietary_restrictions: [...restrictionsSet],
      notes: notes.join(' | '),
    }
  }, [profile?.household_id])

  const handleSuggest = useCallback(async ({ inventoryCount, discoveryCount } = { inventoryCount: 2, discoveryCount: 1 }) => {
    if (suggesting) return

    // Garde : inventaire vide
    if (!inventoryItems.length) {
      setSuggestError(t('recipes.suggestEmptyInventory'))
      return
    }

    setSuggesting(true)
    setSuggestError(null)
    setShowSuggestConfig(false)
    const t0 = Date.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), SUGGEST_TIMEOUT_MS)

    try {
      // Prepare existing recipes for anti-duplicates (max 50)
      const existingRecipes = recipes.slice(0, 50).map(r => ({ name: r.name, category: r.category }))

      // Fetch taste profile
      const tasteProfile = await fetchTasteProfile()

      const res = await apiPost('/api/suggest-recipes', {
        inventory: inventoryItems,
        lang,
        inventoryCount,
        discoveryCount,
        existingRecipes,
        tasteProfile,
      }, { signal: controller.signal })

      clearTimeout(timeout)
      const durationMs = Date.now() - t0

      if (res.ok) {
        const data = await res.json()
        logAI({
          householdId: profile?.household_id,
          profileId: profile?.id,
          endpoint: 'suggest-recipes',
          input: { lang, inventoryCount, discoveryCount, inventoryItemCount: inventoryItems.length },
          output: { recipeCount: data.recipes?.length ?? 0 },
          durationMs,
        })
        if (data.recipes?.length) {
          setSuggestPreview(data.recipes)
        } else {
          setSuggestError(t('recipes.suggestNoResults'))
        }
      } else {
        const errBody = await res.json().catch(() => ({}))
        logAI({
          householdId: profile?.household_id,
          profileId: profile?.id,
          endpoint: 'suggest-recipes',
          input: { lang, inventoryCount, discoveryCount, inventoryItemCount: inventoryItems.length },
          output: { raw: errBody.raw?.slice?.(0, 300) },
          durationMs,
          error: errBody.error || `HTTP ${res.status}`,
        })
        setSuggestError(t('recipes.suggestError'))
      }
    } catch (err) {
      clearTimeout(timeout)
      const durationMs = Date.now() - t0
      const isTimeout = err.name === 'AbortError'
      logAI({
        householdId: profile?.household_id,
        profileId: profile?.id,
        endpoint: 'suggest-recipes',
        input: { lang, inventoryCount, discoveryCount, inventoryItemCount: inventoryItems.length },
        durationMs,
        error: isTimeout ? 'Client timeout' : (err.message || 'Unknown error'),
      })
      setSuggestError(isTimeout ? t('recipes.suggestTimeout') : t('recipes.suggestError'))
    } finally {
      setSuggesting(false)
    }
  }, [suggesting, inventoryItems, recipes, lang, t, profile, fetchTasteProfile])

  const handleSaveSuggestion = async (recipe) => {
    await supabase.from('recipes').insert({
      household_id: profile.household_id,
      created_by: profile.id,
      name: recipe.name,
      description: recipe.description,
      category: recipe.category || 'other',
      difficulty: recipe.difficulty || 'medium',
      prep_time: recipe.prep_time,
      cook_time: recipe.cook_time,
      servings: recipe.servings,
      ingredients: recipe.ingredients || [],
      steps: recipe.steps || [],
      equipment: recipe.equipment || [],
      tips: recipe.tips || [],
      image_url: recipe.image_url || null,
      image_source: recipe.image_url ? 'ai' : 'none',
      translations: recipe.translations || {},
    })
  }

  // Compute feasibility
  const computeFeasibility = useCallback((recipe) => {
    if (!recipe.ingredients?.length || !inventoryItems.length) return null
    const invNames = inventoryItems.map(i => i.name.toLowerCase())
    let missing = 0
    for (const ing of recipe.ingredients) {
      const ingName = (ing.name || '').toLowerCase()
      const found = invNames.some(n => n.includes(ingName) || ingName.includes(n))
      if (!found) missing++
    }
    if (missing === 0) return 'full'
    if (missing <= 2) return 'partial'
    return null
  }, [inventoryItems])

  // Filter & sort
  const filtered = recipes.filter(r => {
    if (category !== 'all' && r.category !== category) return false
    if (difficulty !== 'all' && r.difficulty !== difficulty) return false
    if (search) {
      const s = search.toLowerCase()
      if (!r.name.toLowerCase().includes(s) && !(r.description || '').toLowerCase().includes(s)) return false
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'recent') return new Date(b.created_at) - new Date(a.created_at)
    if (sortBy === 'rating') {
      const avgA = a.recipe_ratings?.length ? a.recipe_ratings.reduce((s, r) => s + r.rating, 0) / a.recipe_ratings.length : 0
      const avgB = b.recipe_ratings?.length ? b.recipe_ratings.reduce((s, r) => s + r.rating, 0) / b.recipe_ratings.length : 0
      return avgB - avgA
    }
    if (sortBy === 'fastest') {
      const tA = (a.prep_time || 0) + (a.cook_time || 0)
      const tB = (b.prep_time || 0) + (b.cook_time || 0)
      return tA - tB
    }
    return 0
  })

  return (
    <div className="fixed top-[74px] bottom-16 left-0 right-0 z-40 flex flex-col bg-gray-50 md:static md:z-auto md:max-w-5xl md:mx-auto md:-mt-8 md:-mb-8 md:h-[calc(100dvh-4rem)]">
      {/* Header */}
      <div className="shrink-0 px-3 pt-3 pb-2 flex items-center justify-between gap-2 min-w-0">
        <h1 className="text-lg font-bold text-gray-900 truncate">{t('recipes.title')}</h1>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={() => setShowSuggestConfig(true)}
            disabled={suggesting || isOffline}
            title={isOffline ? t('offline.featureDisabled') : undefined}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-full text-xs font-medium transition-colors cursor-pointer"
          >
            {suggesting ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
            )}
            {t('recipes.suggestMe')}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={isOffline}
            title={isOffline ? t('offline.createOnlineOnly') : undefined}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-full text-xs font-medium transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {t('recipes.add')}
          </button>
        </div>
      </div>

      {/* Offline banner */}
      {isOffline && (
        <div className="shrink-0 mx-3 mb-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-xl flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-orange-500 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l8.735 8.735m0 0a.374.374 0 11.53.53m-.53-.53l.53.53m0 0L21 21M14.652 9.348a3.75 3.75 0 010 5.304m2.121-7.425a6.75 6.75 0 010 9.546m2.121-11.667C21.16 7.371 22.5 9.98 22.5 12.817c0 2.837-1.34 5.446-3.606 7.217" />
          </svg>
          <span className="text-xs text-orange-700 flex-1">
            {t('offline.recipeBanner', { count: recipes.length })}
          </span>
        </div>
      )}

      {/* Suggest error banner */}
      {suggestError && (
        <div className="shrink-0 mx-3 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-red-500 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <span className="text-xs text-red-700 flex-1">{suggestError}</span>
          <button onClick={() => setSuggestError(null)} className="text-red-400 hover:text-red-600 cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Search */}
      <div className="shrink-0 px-3 pb-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('recipes.searchPlaceholder')}
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
        />
      </div>

      {/* Filters */}
      <div className="shrink-0 px-3 pb-2">
        <RecipeCategoryFilter
          category={category}
          onCategoryChange={setCategory}
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
        />
      </div>

      {/* Sort */}
      <div className="shrink-0 px-3 pb-2 flex gap-2">
        {[{ key: 'recent', label: t('recipes.sortRecent') }, { key: 'rating', label: t('recipes.sortRating') }, { key: 'fastest', label: t('recipes.sortTime') }].map(s => (
          <button
            key={s.key}
            onClick={() => setSortBy(s.key)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              sortBy === s.key ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Recipe grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {sorted.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {search || category !== 'all' || difficulty !== 'all'
              ? t('recipes.emptyFiltered')
              : t('recipes.empty')}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {sorted.map(recipe => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                feasibility={computeFeasibility(recipe)}
                pendingSync={pendingSyncIds.has(recipe.id)}
                onClick={() => navigate(`/recipes/${recipe.id}`)}
                onEdit={() => setEditingRecipe(recipe)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddRecipeModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAdd}
        />
      )}

      {editingRecipe && (
        <EditRecipeModal
          recipe={editingRecipe}
          isOffline={isOffline}
          onClose={() => setEditingRecipe(null)}
          onSave={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {showSuggestConfig && (
        <SuggestConfigModal
          onConfirm={handleSuggest}
          onClose={() => setShowSuggestConfig(false)}
        />
      )}

      {suggestPreview && (
        <SuggestPreviewModal
          recipes={suggestPreview}
          onClose={() => setSuggestPreview(null)}
          onSave={handleSaveSuggestion}
          onRetry={() => { setSuggestPreview(null); setShowSuggestConfig(true) }}
          retrying={suggesting}
        />
      )}
    </div>
  )
}
