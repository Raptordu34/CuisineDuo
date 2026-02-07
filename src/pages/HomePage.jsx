import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useNotifications } from '../hooks/useNotifications'

export default function HomePage() {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { supported, permission, subscribed, subscribe } = useNotifications()
  const [stats, setStats] = useState({ inStock: 0, expenses: 0, expiringSoon: 0 })

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

        setStats({
          inStock: items.length,
          expenses: (purchaseTotal + consumedTotal).toFixed(2),
          expiringSoon,
        })
      } catch {
        // Tables may not exist yet
      }
    }

    fetchStats()
  }, [profile?.household_id])

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
          icon="📸"
          title={t('home.scanReceipt')}
          description={t('home.scanReceiptDesc')}
          color="orange"
          onClick={() => navigate('/inventory')}
        />
        <DashboardCard
          icon="📦"
          title={t('home.inventory')}
          description={t('home.inventoryDesc')}
          color="blue"
          onClick={() => navigate('/inventory')}
        />
        <DashboardCard
          icon="💰"
          title={t('home.budget')}
          description={t('home.budgetDesc')}
          color="green"
        />
      </div>

      {/* Stats placeholder */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('home.productsInStock')} value={stats.inStock} />
        <StatCard label={t('home.expensesThisMonth')} value={`${stats.expenses}\u00A0\u20AC`} />
        <StatCard label={t('home.expiringNear')} value={stats.expiringSoon} />
        <StatCard label={t('home.recipesCooked')} value="--" />
      </div>
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
