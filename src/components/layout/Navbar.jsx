import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export default function Navbar() {
  const { profile, signOut } = useAuth()

  const initial = profile?.display_name?.charAt(0)?.toUpperCase() || '?'

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl">🍳</span>
          <span className="text-xl font-bold text-gray-900">CuisineDuo</span>
        </Link>

        <div className="flex items-center gap-6 text-sm font-medium text-gray-600">
          <Link to="/" className="hover:text-orange-500 transition-colors">Inventaire</Link>
          <Link to="/" className="hover:text-orange-500 transition-colors">Budget</Link>
          <Link to="/" className="hover:text-orange-500 transition-colors">Recettes</Link>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{profile?.display_name}</span>
          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold">
            {initial}
          </div>
          <button
            onClick={signOut}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
          >
            Deconnexion
          </button>
        </div>
      </div>
    </nav>
  )
}
