// Prendre le contrôle immédiatement lors de l'installation/mise à jour
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
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
