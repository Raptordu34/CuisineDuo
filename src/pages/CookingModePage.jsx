import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import CookingTimer from '../components/recipes/CookingTimer'
import RecipeChat from '../components/recipes/RecipeChat'
import CookingCompleteModal from '../components/cooking/CookingCompleteModal'
import { useTasteProfile } from '../hooks/useTasteProfile'
import { useCookingHistory } from '../hooks/useCookingHistory'

export default function CookingModePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { t } = useLanguage()
  const { householdTasteProfiles } = useTasteProfile(profile?.id, profile?.household_id)
  const [recipe, setRecipe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState(new Set())
  const [showChat, setShowChat] = useState(false)
  const [showTimer, setShowTimer] = useState(false)
  const [showIngredients, setShowIngredients] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const { logCook } = useCookingHistory(profile?.household_id)

  // Wake Lock
  useEffect(() => {
    let wakeLock = null
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen')
        }
      } catch {
        // Wake Lock not available
      }
    }
    requestWakeLock()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (wakeLock) wakeLock.release()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Fetch recipe
  useEffect(() => {
    const fetchRecipe = async () => {
      const { data } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', id)
        .single()
      if (data) setRecipe(data)
      setLoading(false)
    }
    fetchRecipe()
  }, [id])

  const handleChatRecipeUpdate = async (updates) => {
    // Update local state immediately
    setRecipe((prev) => prev ? { ...prev, ...updates, updated_at: new Date().toISOString() } : prev)
    // Persist to Supabase
    await supabase.from('recipes').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
  }

  const sortedSteps = recipe?.steps
    ? [...recipe.steps].sort((a, b) => (a.order || 0) - (b.order || 0))
    : []

  const sortedIngredients = recipe?.ingredients
    ? [...recipe.ingredients].sort((a, b) => (a.order || 0) - (b.order || 0))
    : []

  const totalSteps = sortedSteps.length
  const step = sortedSteps[currentStep]

  const toggleCompleted = useCallback(() => {
    setCompletedSteps(prev => {
      const next = new Set(prev)
      if (next.has(currentStep)) next.delete(currentStep)
      else next.add(currentStep)
      return next
    })
  }, [currentStep])

  const goNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1)
      setShowTimer(false)
    }
  }, [currentStep, totalSteps])

  const goPrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
      setShowTimer(false)
    }
  }, [currentStep])

  const handleExit = useCallback(() => {
    navigate(`/recipes/${id}`)
  }, [navigate, id])

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400">{t('common.loading')}</p>
      </div>
    )
  }

  if (!recipe || totalSteps === 0) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center gap-3">
        <p className="text-gray-400">{t('recipes.back')}</p>
        <button onClick={handleExit} className="text-orange-400 hover:text-orange-300 text-sm cursor-pointer">
          {t('recipes.exitCooking')}
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col z-50">
      {/* Top bar */}
      <div className="shrink-0 px-4 py-3 flex items-center justify-between bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleExit}
            className="shrink-0 w-8 h-8 rounded-full bg-gray-700 text-gray-300 hover:bg-gray-600 flex items-center justify-center cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
          <h1 className="text-sm font-medium text-white truncate">{recipe.name}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Ingredients toggle */}
          {sortedIngredients.length > 0 && (
            <button
              onClick={() => setShowIngredients(!showIngredients)}
              className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                showIngredients ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title={t('recipes.showIngredients')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
            </button>
          )}
          <span className="text-xs text-gray-400">
            {t('recipes.stepOf', { current: currentStep + 1, total: totalSteps })}
          </span>
        </div>
      </div>

      {/* Ingredients panel */}
      {showIngredients && sortedIngredients.length > 0 && (
        <div className="shrink-0 bg-gray-800 border-b border-gray-700 px-4 py-3 max-h-[30vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {sortedIngredients.map((ing, i) => (
              <div key={i} className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-white truncate">
                  {ing.name}
                  {ing.optional && <span className="text-gray-500 text-xs ml-1">(opt.)</span>}
                </span>
                <span className="text-xs text-gray-400 shrink-0">
                  {ing.quantity && <>{ing.quantity}{ing.unit && ing.unit !== 'none' ? ` ${ing.unit}` : ''}</>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className={`flex-1 flex flex-col items-center justify-center px-6 overflow-y-auto ${showChat ? 'max-h-[50vh]' : ''}`}>
        {/* Step instruction */}
        <div className="w-full max-w-lg text-center space-y-6">
          {/* Step number badge */}
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-500 text-white text-lg font-bold">
            {step.order || currentStep + 1}
          </div>

          {/* Instruction */}
          <p className="text-lg text-white leading-relaxed">{step.instruction}</p>

          {/* Duration & timer */}
          {step.duration && (
            <div className="space-y-3">
              <button
                onClick={() => setShowTimer(!showTimer)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-full text-sm font-medium transition-colors cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                {t('recipes.startTimer')} ({step.duration} min)
              </button>

              {showTimer && (
                <CookingTimer durationMinutes={step.duration} />
              )}
            </div>
          )}

          {/* Done checkbox */}
          <button
            onClick={toggleCompleted}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
              completedSteps.has(currentStep)
                ? 'bg-green-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {completedSteps.has(currentStep) && (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            )}
            {t('recipes.markDone')}
          </button>
        </div>
      </div>

      {/* Progress dots */}
      <div className="shrink-0 flex justify-center gap-1.5 py-3">
        {sortedSteps.map((_, i) => (
          <button
            key={i}
            onClick={() => { setCurrentStep(i); setShowTimer(false) }}
            className={`w-2.5 h-2.5 rounded-full transition-colors cursor-pointer ${
              i === currentStep
                ? 'bg-orange-500'
                : completedSteps.has(i)
                  ? 'bg-green-500'
                  : 'bg-gray-600'
            }`}
          />
        ))}
      </div>

      {/* Bottom navigation */}
      <div className="shrink-0 px-4 py-3 flex items-center justify-between bg-gray-800 border-t border-gray-700">
        <button
          onClick={goPrev}
          disabled={currentStep === 0}
          className="px-4 py-2 bg-gray-700 text-gray-300 rounded-full text-sm font-medium hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          {t('recipes.previousStep')}
        </button>

        <button
          onClick={() => setShowChat(true)}
          className="w-10 h-10 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center cursor-pointer transition-colors"
        >
          <span className="text-lg">🤖</span>
        </button>

        {currentStep === totalSteps - 1 ? (
          <button
            onClick={() => setShowComplete(true)}
            className="px-4 py-2 bg-green-500 text-white rounded-full text-sm font-medium hover:bg-green-600 cursor-pointer transition-colors"
          >
            {t('cooking.finish')}
          </button>
        ) : (
          <button
            onClick={goNext}
            className="px-4 py-2 bg-orange-500 text-white rounded-full text-sm font-medium hover:bg-orange-600 cursor-pointer transition-colors"
          >
            {t('recipes.nextStep')}
          </button>
        )}
      </div>

      {/* Chat panel */}
      {showChat && (
        <RecipeChat
          recipe={recipe}
          onClose={() => setShowChat(false)}
          mode="cooking"
          currentStep={currentStep}
          onRecipeUpdate={handleChatRecipeUpdate}
          householdTasteProfiles={householdTasteProfiles}
        />
      )}

      {/* Cooking complete modal */}
      {showComplete && (
        <CookingCompleteModal
          recipe={recipe}
          onClose={() => { setShowComplete(false); handleExit() }}
          onSave={async ({ notes, servingsCooked }) => {
            await logCook({
              recipeId: recipe.id,
              cookedBy: profile.id,
              notes,
              servingsCooked,
            })
            setShowComplete(false)
            handleExit()
          }}
        />
      )}
    </div>
  )
}
