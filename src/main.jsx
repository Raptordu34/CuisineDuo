import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Enregistrement du Service Worker avec gestion des mises a jour
if ('serviceWorker' in navigator) {
  // Ecouter les messages du SW (ex: rechargement necessaire apres deploiement)
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'RELOAD_NEEDED') {
      if (sessionStorage.getItem('sw_reload_attempted')) {
        console.error('SW reload already attempted to fix stale assets. Stopping to prevent infinite loop.')
        return
      }
      sessionStorage.setItem('sw_reload_attempted', '1')
      console.warn('SW detected stale assets, reloading...')
      // Vider tous les caches Service Worker avant de recharger
      caches.keys().then((names) => {
        return Promise.all(names.map((name) => caches.delete(name)))
      }).then(() => {
        // Ajouter un timestamp unique pour contourner le cache HTTP du navigateur sur la navigation
        const url = new URL(window.location.href)
        url.searchParams.set('_sw', Date.now())
        window.location.replace(url.toString())
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

// Réinitialiser les flags antiflipping si l'application a bien pu démarrer après 3 secondes (signifie pas de crash immédiat)
setTimeout(() => {
  sessionStorage.removeItem('sw_reload_attempted')
  sessionStorage.removeItem('reload_attempted')
}, 3000)
