import { useAuth } from '../contexts/AuthContext'

export default function HomePage() {
  const { profile } = useAuth()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">
          Bonjour {profile?.display_name} !
        </h1>
        <p className="text-gray-500">
          Gestion de courses, recettes et budget pour votre foyer.
        </p>
      </div>

      {/* Quick actions grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <DashboardCard
          icon="📸"
          title="Scanner un ticket"
          description="Scannez votre ticket de caisse pour mettre a jour l'inventaire."
          color="orange"
        />
        <DashboardCard
          icon="📦"
          title="Inventaire"
          description="Consultez et gerez votre stock de produits."
          color="blue"
        />
        <DashboardCard
          icon="💰"
          title="Budget"
          description="Suivez vos depenses et votre budget mensuel."
          color="green"
        />
      </div>

      {/* Stats placeholder */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Produits en stock" value="--" />
        <StatCard label="Depenses ce mois" value="--" />
        <StatCard label="Peremptions proches" value="--" />
        <StatCard label="Recettes cuisinees" value="--" />
      </div>
    </div>
  )
}

function DashboardCard({ icon, title, description, color }) {
  const colorMap = {
    orange: 'bg-orange-50 border-orange-200 hover:border-orange-400',
    blue: 'bg-blue-50 border-blue-200 hover:border-blue-400',
    green: 'bg-green-50 border-green-200 hover:border-green-400',
  }

  return (
    <button className={`p-6 rounded-xl border-2 text-left transition-colors cursor-pointer ${colorMap[color]}`}>
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
