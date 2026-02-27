import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Enregistrement du Service Worker avec gestion des mises a jour
if ('serviceWorker' in navigator) {
  // Ecouter les messages du SW (ex: rechargement necessaire apres deploiement)
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'RELOAD_NEEDED') {
      console.warn('SW detected stale assets, reloading...')
      // Vider tous les caches avant de recharger
      caches.keys().then((names) => {
        return Promise.all(names.map((name) => caches.delete(name)))
      }).then(() => {
        window.location.reload()
      })
    }
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Verifier les mises a jour regulierement (toutes les 60 secondes)
      setInterval(() => {
        registration.update().catch(() => {})
      }, 60 * 1000)

      // Quand un nouveau SW est pret, recharger la page pour utiliser la nouvelle version
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
            console.log('New service worker activated, reloading...')
            window.location.reload()
          }
        })
      })
    }).catch((error) => {
      console.error('SW registration failed:', error)
    })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
