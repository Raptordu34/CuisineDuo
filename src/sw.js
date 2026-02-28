import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { createHandlerBoundToURL } from 'workbox-precaching'

// Precache et route tous les assets generes par Vite (injecte automatiquement par workbox)
precacheAndRoute(self.__WB_MANIFEST)

// Nettoyer les anciens caches des versions precedentes
cleanupOutdatedCaches()

// SPA fallback : toutes les navigations renvoient index.html
const handler = createHandlerBoundToURL('/index.html')
const navigationRoute = new NavigationRoute(handler, {
  denylist: [/^\/api\//],
})
registerRoute(navigationRoute)

// Ecouter les messages (skip waiting pour activer le nouveau SW)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// --- Push notifications ---

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
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
