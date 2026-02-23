const CACHE_NAME = 'cuisineduo-v1'

// Assets statiques a pre-cacher
const PRECACHE_URLS = [
  '/',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// Installation : pre-cacher les assets essentiels
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

// Activation : nettoyer les anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

// Strategie de fetch
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorer les requetes non-GET et les appels API/Supabase
  if (request.method !== 'GET') return
  if (url.pathname.startsWith('/api/')) return
  if (url.hostname.includes('supabase')) return

  // Navigation (pages HTML) : Network First avec fallback cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    )
    return
  }

  // Assets statiques (JS, CSS, images, fonts) : Cache First avec update reseau
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|webp|woff2?|ico)$/) ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        }).catch(() => cached)

        return cached || fetchPromise
      })
    )
    return
  }
})

// Push notifications (existant)
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
