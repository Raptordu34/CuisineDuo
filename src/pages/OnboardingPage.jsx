import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function OnboardingPage() {
  const { user, profile, refreshProfile } = useAuth()
  const [mode, setMode] = useState(null) // 'create' | 'join'
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [createdCode, setCreatedCode] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  if (!user) return <Navigate to="/login" replace />
  if (profile?.household_id) return <Navigate to="/" replace />

  const handleCreate = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data: household, error: createErr } = await supabase
      .from('households')
      .insert({ name: householdName })
      .select()
      .single()

    if (createErr) {
      setError(createErr.message)
      setLoading(false)
      return
    }

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ household_id: household.id })
      .eq('id', user.id)

    if (updateErr) {
      setError(updateErr.message)
    } else {
      setCreatedCode(household.invite_code)
      await refreshProfile()
    }
    setLoading(false)
  }

  const handleJoin = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data: household, error: findErr } = await supabase
      .from('households')
      .select('id')
      .eq('invite_code', inviteCode.trim().toLowerCase())
      .single()

    if (findErr || !household) {
      setError('Code introuvable. Verifiez et reessayez.')
      setLoading(false)
      return
    }

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ household_id: household.id })
      .eq('id', user.id)

    if (updateErr) {
      setError(updateErr.message)
    } else {
      await refreshProfile()
    }
    setLoading(false)
  }

  // After household creation, show invite code
  if (createdCode) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-6">
          <span className="text-5xl">🎉</span>
          <h1 className="text-2xl font-bold text-gray-900">Foyer cree !</h1>
          <p className="text-gray-500">
            Partagez ce code avec votre partenaire pour qu'il/elle rejoigne le foyer :
          </p>
          <div className="bg-white border-2 border-dashed border-orange-300 rounded-xl p-6">
            <p className="text-3xl font-mono font-bold text-orange-600 tracking-widest">
              {createdCode}
            </p>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(createdCode)}
            className="text-sm text-orange-500 hover:text-orange-600 font-medium cursor-pointer"
          >
            Copier le code
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="text-4xl">🏠</span>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Configurez votre foyer</h1>
          <p className="text-sm text-gray-500">Creez un nouveau foyer ou rejoignez-en un.</p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>
        )}

        {!mode && (
          <div className="space-y-3">
            <button
              onClick={() => setMode('create')}
              className="w-full p-4 bg-white rounded-xl border-2 border-gray-200 hover:border-orange-400 text-left transition-colors cursor-pointer"
            >
              <p className="font-semibold text-gray-900">Creer un foyer</p>
              <p className="text-sm text-gray-500">Vous etes le premier ? Creez le foyer et invitez votre partenaire.</p>
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full p-4 bg-white rounded-xl border-2 border-gray-200 hover:border-blue-400 text-left transition-colors cursor-pointer"
            >
              <p className="font-semibold text-gray-900">Rejoindre un foyer</p>
              <p className="text-sm text-gray-500">Vous avez un code d'invitation ? Entrez-le ici.</p>
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div>
              <label htmlFor="householdName" className="block text-sm font-medium text-gray-700 mb-1">
                Nom du foyer
              </label>
              <input
                id="householdName"
                type="text"
                required
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="ex: Chez nous"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Creation...' : 'Creer le foyer'}
            </button>
            <button
              type="button"
              onClick={() => setMode(null)}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
            >
              Retour
            </button>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div>
              <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-700 mb-1">
                Code d'invitation
              </label>
              <input
                id="inviteCode"
                type="text"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-mono text-lg tracking-widest"
                placeholder="abc12345"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Recherche...' : 'Rejoindre'}
            </button>
            <button
              type="button"
              onClick={() => setMode(null)}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
            >
              Retour
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
