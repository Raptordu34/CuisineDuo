import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useNotifications } from '../hooks/useNotifications'
import { useTasteProfile } from '../hooks/useTasteProfile'
import TasteProfileDisplay from '../components/recipes/TasteProfileDisplay'
import StartSessionModal from '../components/swipe/StartSessionModal'

export default function HomePage() {
  const { profile } = useAuth()
  const { t, lang } = useLanguage()
  const navigate = useNavigate()
  const { supported, permission, subscribed, subscribe } = useNotifications()
  const { userTasteProfile, householdTasteProfiles, ratingsCount, loading: tasteLoading } = useTasteProfile(profile?.id, profile?.household_id)
  const [stats, setStats] = useState({ inStock: 0, expenses: 0, expiringSoon: 0, recipeCount: 0 })
  const [showStartSession, setShowStartSession] = useState(false)
  const [activeSession, setActiveSession] = useState(null)

  const showBanner = supported && permission !== 'denied' && !subscribed

  useEffect(() => {
    if (!profile?.household_id) return

    const fetchStats = async () => {
      try {
        const { data: items } = await supabase
          .from('inventory_items')
          .select('id, price, estimated_expiry_date')
          .eq('household_id', profile.household_id)

        if (!items) return

        const now = new Date()
        const threeDays = 3 * 24 * 60 * 60 * 1000
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

        const expiringSoon = items.filter(
          (i) => i.estimated_expiry_date && new Date(i.estimated_expiry_date) > now && (new Date(i.estimated_expiry_date) - now) < threeDays
        ).length

        const { data: consumed } = await supabase
          .from('consumed_items')
          .select('price')
          .eq('household_id', profile.household_id)
          .gte('consumption_date', monthStart)

        const purchaseTotal = items.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0)
        const consumedTotal = consumed ? consumed.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0) : 0

        const { count: recipeCount } = await supabase
          .from('recipes')
          .select('*', { count: 'exact', head: true })
          .eq('household_id', profile.household_id)

        setStats({
          inStock: items.length,
          expenses: (purchaseTotal + consumedTotal).toFixed(2),
          expiringSoon,
          recipeCount: recipeCount || 0,
        })
      } catch {
        // Tables may not exist yet
      }
    }

    // Check for active swipe session
    const checkActiveSession = async () => {
      try {
        const { data } = await supabase
          .from('swipe_sessions')
          .select('id, title, status')
          .eq('household_id', profile.household_id)
          .in('status', ['generating', 'voting'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        setActiveSession(data)
      } catch {
        // Table may not exist
      }
    }

    fetchStats()
    checkActiveSession()
  }, [profile?.household_id])

  const handleCreateSession = async ({ mealCount, mealTypes }) => {
    if (!profile?.household_id) return

    const title = `${t('swipe.planTitle')} ${new Date().toLocaleDateString()}`

    // Create the session
    const { data: session, error } = await supabase
      .from('swipe_sessions')
      .insert({
        household_id: profile.household_id,
        created_by: profile.id,
        title,
        meal_count: mealCount,
        meal_types: mealTypes,
        status: 'generating',
      })
      .select()
      .single()

    if (error || !session) return

    setShowStartSession(false)

    // Navigate to swipe page
    navigate(`/swipe/${session.id}`)

    // Fetch context data for AI
    const [recipesResult, inventoryResult, historyResult, prefsResult] = await Promise.all([
      supabase.from('recipes').select('id, name, category, description, image_url').eq('household_id', profile.household_id),
      supabase.from('inventory_items').select('name, quantity, unit, estimated_expiry_date, category').eq('household_id', profile.household_id),
      supabase.from('cooking_history').select('recipe_id, cooked_at, recipes(name)').eq('household_id', profile.household_id).order('cooked_at', { ascending: false }).limit(20),
      supabase.from('taste_preferences').select('profile_id, notes, profiles(display_name)').in('profile_id', (householdTasteProfiles || []).map(p => p.profileId)),
    ])

    // Fire and forget the AI generation
    fetch('/api/generate-swipe-recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.id,
        household_id: profile.household_id,
        meal_count: mealCount,
        meal_types: mealTypes,
        lang,
        existing_recipes: recipesResult.data || [],
        household_taste_profiles: householdTasteProfiles || [],
        taste_preferences: (prefsResult.data || []).map(p => ({
          displayName: p.profiles?.display_name || '',
          notes: p.notes || '',
        })),
        cooking_history: (historyResult.data || []).map(h => ({
          recipe_name: h.recipes?.name || '',
          cooked_at: h.cooked_at,
        })),
        inventory_items: inventoryResult.data || [],
      }),
    }).catch(() => {})
  }

  return (
    <div className="space-y-8">
      {/* Notification banner */}
      {showBanner && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-gray-900">{t('notifications.title')}</p>
            <p className="text-sm text-gray-500">{t('notifications.description')}</p>
          </div>
          <button
            onClick={subscribe}
            className="shrink-0 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-full transition-colors cursor-pointer"
          >
            {t('notifications.enable')}
          </button>
        </div>
      )}

      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">
          {t('home.greeting', { name: profile?.display_name })}
        </h1>
        <p className="text-gray-500">
          {t('home.subtitle')}
        </p>
      </div>

      {/* Quick actions grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <DashboardCard
          icon="🍽️"
          title={t('home.planMeals')}
          description={t('home.planMealsDesc')}
          color="green"
          onClick={() => activeSession
            ? navigate(`/swipe/${activeSession.id}${activeSession.status === 'completed' ? '/results' : ''}`)
            : setShowStartSession(true)
          }
        />
        <DashboardCard
          icon="📸"
          title={t('home.scanReceipt')}
          description={t('home.scanReceiptDesc')}
          color="orange"
          onClick={() => navigate('/inventory')}
        />
        <DashboardCard
          icon="🛒"
          title={t('home.shopping')}
          description={t('home.shoppingDesc')}
          color="blue"
          onClick={() => navigate('/shopping')}
        />
      </div>

      {/* Active session banner */}
      {activeSession && (
        <div className="relative w-full p-4 bg-green-50 border-2 border-green-200 rounded-xl">
          <button
            onClick={() => navigate(`/swipe/${activeSession.id}${activeSession.status === 'completed' ? '/results' : ''}`)}
            className="w-full text-left cursor-pointer"
          >
            <div className="flex items-center gap-3 pr-8">
              <span className="text-2xl">🔥</span>
              <div>
                <p className="font-semibold text-gray-900">{t('swipe.activeSession')}</p>
                <p className="text-sm text-gray-500">{activeSession.title}</p>
              </div>
            </div>
          </button>
          <button
            onClick={async (e) => {
              e.stopPropagation()
              await supabase
                .from('swipe_sessions')
                .update({ status: 'cancelled', updated_at: new Date().toISOString() })
                .eq('id', activeSession.id)
              setActiveSession(null)
            }}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-gray-200 hover:bg-red-100 text-gray-500 hover:text-red-500 flex items-center justify-center transition-colors cursor-pointer"
            title={t('common.cancel')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('home.productsInStock')} value={stats.inStock} />
        <StatCard label={t('home.expensesThisMonth')} value={`${stats.expenses}\u00A0\u20AC`} />
        <StatCard label={t('home.expiringNear')} value={stats.expiringSoon} />
        <StatCard label={t('home.recipesCooked')} value={stats.recipeCount} />
      </div>

      {/* Taste profile */}
      {!tasteLoading && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">{t('taste.title')}</h2>
          {userTasteProfile ? (
            <>
              <TasteProfileDisplay profile={userTasteProfile} mode="user" />
              <p className="text-xs text-gray-400">{t('recipes.recipesRated', { count: ratingsCount })}</p>
            </>
          ) : (
            <p className="text-sm text-gray-400">{t('recipes.tasteProfileHint')}</p>
          )}
        </div>
      )}

      {/* Start session modal */}
      {showStartSession && (
        <StartSessionModal
          onClose={() => setShowStartSession(false)}
          onCreate={handleCreateSession}
        />
      )}
    </div>
  )
}

function DashboardCard({ icon, title, description, color, onClick }) {
  const colorMap = {
    orange: 'bg-orange-50 border-orange-200 hover:border-orange-400',
    blue: 'bg-blue-50 border-blue-200 hover:border-blue-400',
    green: 'bg-green-50 border-green-200 hover:border-green-400',
  }

  return (
    <button onClick={onClick} className={`p-6 rounded-xl border-2 text-left transition-colors cursor-pointer ${colorMap[color]}`}>
      <span className="text-3xl">{icon}</span>
      <h3 className="mt-3 font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </button>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )
}
