import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import './App.css'

// ⚠️ REMPLACE CECI PAR TES CLÉS SUPABASE (Settings -> API)
const SUPABASE_URL = 'https://epetmszgnigdeccjqfve.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_VXQ9Yl_g1HBgiOku3kS3Iw_5f0SHpEn'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

function App() {
  const [recettes, setRecettes] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Formulaire
  const [titre, setTitre] = useState('')
  const [noteMoi, setNoteMoi] = useState(5)
  const [noteElle, setNoteElle] = useState(5)

  // 1. Charger les recettes au démarrage
  useEffect(() => {
    fetchRecettes()
  }, [])

  async function fetchRecettes() {
    setLoading(true)
    const { data, error } = await supabase
      .from('recettes')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) console.error('Erreur chargement:', error)
    else setRecettes(data)
    setLoading(false)
  }

  // 2. Ajouter une recette
  async function ajouterRecette(e) {
    e.preventDefault() // Empêche la page de recharger
    
    const { error } = await supabase
      .from('recettes')
      .insert([
        { 
          titre: titre, 
          note_moi: noteMoi, 
          note_elle: noteElle,
          tags: ['test'] // On met un tag par défaut pour l'instant
        }
      ])

    if (error) {
      alert('Erreur lors de l\'ajout !')
      console.error(error)
    } else {
      // Reset du formulaire et rechargement de la liste
      setTitre('')
      fetchRecettes()
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h1>👨‍🍳 Cuisine Duo 👩‍🍳</h1>

      {/* --- FORMULAIRE D'AJOUT --- */}
      <div style={{ background: '#f0f0f0', padding: '20px', borderRadius: '10px', marginBottom: '20px' }}>
        <h3>Ajouter un souvenir</h3>
        <form onSubmit={ajouterRecette} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input 
            type="text" 
            placeholder="Nom du plat (ex: Poulet Curry)" 
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            style={{ padding: '10px', fontSize: '16px' }}
            required
          />
          
          <div style={{ display: 'flex', gap: '20px' }}>
            <label>
              Ma Note: <strong>{noteMoi}/5</strong><br/>
              <input type="range" min="1" max="5" value={noteMoi} onChange={e => setNoteMoi(e.target.value)} />
            </label>
            <label>
              Sa Note: <strong>{noteElle}/5</strong><br/>
              <input type="range" min="1" max="5" value={noteElle} onChange={e => setNoteElle(e.target.value)} />
            </label>
          </div>

          <button type="submit" style={{ padding: '10px', background: '#24b47e', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            Enregistrer le plat
          </button>
        </form>
      </div>

      {/* --- LISTE DES RECETTES --- */}
      <div>
        {loading ? <p>Chargement...</p> : (
          recettes.length === 0 ? <p>Aucun plat enregistré. Lance-toi !</p> : 
          recettes.map(recette => (
            <div key={recette.id} style={{ border: '1px solid #ddd', padding: '15px', marginBottom: '10px', borderRadius: '8px', background: 'white', color: 'black' }}>
              <h3 style={{ margin: '0 0 10px 0' }}>{recette.titre}</h3>
              <div style={{ display: 'flex', gap: '15px', fontSize: '14px' }}>
                <span>👦 Moi: {recette.note_moi}/5</span>
                <span>👩 Elle: {recette.note_elle}/5</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default App