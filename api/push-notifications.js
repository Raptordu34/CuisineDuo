import webpush from 'web-push'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  const { action, ...data } = req.body

  // --- SUBSCRIBE ---
  if (action === 'subscribe') {
    const { profile_id, household_id, subscription } = data
    if (!profile_id || !household_id || !subscription) {
      return res.status(400).json({ error: 'Missing fields' })
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ profile_id, household_id, subscription }),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('Supabase insert error:', text)
      return res.status(500).json({ error: 'Failed to save subscription' })
    }

    return res.status(200).json({ ok: true })
  }

  // --- UNSUBSCRIBE ---
  if (action === 'unsubscribe') {
    const { profile_id, subscription } = data
    if (!profile_id || !subscription) {
      return res.status(400).json({ error: 'Missing fields' })
    }

    const endpoint = encodeURIComponent(subscription.endpoint)
    const response = await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?profile_id=eq.${profile_id}&subscription->>endpoint=eq.${endpoint}`,
      {
        method: 'DELETE',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    )

    if (!response.ok) {
      const text = await response.text()
      console.error('Supabase delete error:', text)
      return res.status(500).json({ error: 'Failed to delete subscription' })
    }

    return res.status(200).json({ ok: true })
  }

  // --- SEND ---
  if (action === 'send') {
    const vapidPublic = process.env.VITE_VAPID_PUBLIC_KEY
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY
    if (!vapidPublic || !vapidPrivate) {
      return res.status(500).json({ error: 'VAPID keys not configured' })
    }

    webpush.setVapidDetails('mailto:noreply@cuisineduo.app', vapidPublic, vapidPrivate)

    const { household_id, sender_profile_id, title, body } = data
    if (!household_id || !sender_profile_id) {
      return res.status(400).json({ error: 'Missing fields' })
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?household_id=eq.${household_id}&profile_id=neq.${sender_profile_id}&select=id,subscription`,
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
          await webpush.sendNotification(sub.subscription, payload)
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            expiredIds.push(sub.id)
          } else {
            console.error('Push send error:', err.statusCode, err.message)
          }
        }
      })
    )

    if (expiredIds.length > 0) {
      const idsParam = expiredIds.map((id) => `"${id}"`).join(',')
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

  return res.status(400).json({ error: 'Invalid action. Use: subscribe, unsubscribe, send' })
}
