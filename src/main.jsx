import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { resetAuthLock } from './lib/supabase'

// Debloquer le lock auth au retour d'arriere-plan (global, protege toute l'app)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    resetAuthLock()
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
