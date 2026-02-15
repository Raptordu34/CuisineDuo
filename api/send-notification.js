import webpush from 'web-push'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const vapidPublic = process.env.VITE_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  if (!vapidPublic || !vapidPrivate) {
    return res.status(500).json({ error: 'VAPID keys not configured' })
  }

  webpush.setVapidDetails('mailto:noreply@cuisineduo.app', vapidPublic, vapidPrivate)

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

  const { household_id, sender_profile_id, title, body } = req.body
  if (!household_id || !sender_profile_id) {
    return res.status(400).json({ error: 'Missing fields' })
  }

  // Fetch all subscriptions for this household except sender
  const response = await fetch(
    `${supabaseUrl}/rest/v1/push_subscriptions?household_id=eq.${encodeURIComponent(household_id)}&profile_id=neq.${encodeURIComponent(sender_profile_id)}&select=id,subscription`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  )

  if (!response.ok) {
    console.error('Failed to fetch subscriptions')
    return res.status(500).json({ error: 'Failed to fetch subscriptions' })
  }

  const subscriptions = await response.json()
  const payload = JSON.stringify({ title: title || 'CuisineDuo', body: body || '' })

  const expiredIds = []

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub.subscription, payload, {
          urgency: 'high',
          TTL: 3600,
        })
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          expiredIds.push(sub.id)
        } else {
          console.error('Push send error:', err.statusCode, err.message)
        }
      }
    })
  )

  // Clean up expired subscriptions
  if (expiredIds.length > 0) {
    const idsParam = expiredIds.map((id) => `"${encodeURIComponent(id)}"`).join(',')
    await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?id=in.(${idsParam})`,
      {
        method: 'DELETE',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    )
  }

  return res.status(200).json({ sent: subscriptions.length - expiredIds.length, expired: expiredIds.length })
}
