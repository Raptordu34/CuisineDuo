const CACHE_NAME = 'cuisineduo-v2'

// Assets statiques a pre-cacher (app shell)
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// Installation : pre-cacher l'app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS)
    }).then(() => self.skipWaiting())
  )
})

// Activation : nettoyer les anciens caches + prendre le controle
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    }).then(() => self.clients.claim())
  )
})

// Verifier si le content-type est valide pour un asset JS/CSS
function isValidAssetResponse(response) {
  const contentType = response.headers.get('content-type') || ''
  return contentType.includes('javascript') ||
    contentType.includes('css') ||
    contentType.includes('wasm') ||
    contentType.includes('font') ||
    contentType.includes('image')
}

// Strategie de fetch
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorer les requetes non-GET
  if (request.method !== 'GET') return

  // Ignorer les requetes API
  if (url.pathname.startsWith('/api/')) return

  // Ignorer les requetes Supabase / externes
  if (url.origin !== self.location.origin) return

  // Assets Vite avec hash (ex: /assets/index-abc123.js) → Cache-first
  // IMPORTANT : valider le content-type pour eviter de cacher du HTML
  // (Vercel retourne index.html pour les fichiers inexistants via SPA rewrite)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          // Verifier que c'est bien un asset JS/CSS et pas du HTML (SPA fallback)
          if (response.ok && isValidAssetResponse(response)) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
            return response
          }
          // Si Vercel a retourne du HTML au lieu du JS → cache HTTP empoisonné ou asset manquant
          if (response.ok && !isValidAssetResponse(response)) {
            // Tenter de contourner le cache HTTP du navigateur qui aurait pu garder l'index.html
            return fetch(new Request(request.url, { cache: 'reload' })).then((bypassResponse) => {
              if (bypassResponse.ok && isValidAssetResponse(bypassResponse)) {
                 const clone = bypassResponse.clone()
                 caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
                 return bypassResponse
              }
              // Si meme bypassResponse n'est pas valide, l'asset n'existe vraiment plus (ex: vieux hash apres deploiement)
              self.clients.matchAll().then((clients) => {
                clients.forEach((client) => client.postMessage({ type: 'RELOAD_NEEDED' }))
              })
              return response
            }).catch(() => {
               self.clients.matchAll().then((clients) => {
                 clients.forEach((client) => client.postMessage({ type: 'RELOAD_NEEDED' }))
               })
               return response
            });
          }
          return response
        }).catch(() => {
          return new Response('Asset not available offline', { status: 503 })
        })
      })
    )
    return
  }

  // Navigation (HTML) et autres fichiers statiques → Network-first avec fallback cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached
          if (request.mode === 'navigate') {
            return caches.match('/')
          }
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
        })
      })
  )
})

// Recevoir un message pour forcer le nettoyage du cache
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('push', (event) => {
  let title = 'CuisineDuo'
  let options = {
    body: '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'chat-message',
    renotify: true,
    vibrate: [200, 100, 200],
    requireInteraction: false,
    data: { url: '/chat' },
  }

  try {
    const data = event.data ? event.data.json() : {}
    title = data.title || title
    options.body = data.body || ''
  } catch {
    // Fallback si le JSON est invalide
    options.body = event.data ? event.data.text() : ''
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/chat'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
