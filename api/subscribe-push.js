export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  if (req.method === 'POST') {
    const { profile_id, household_id, subscription } = req.body
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

  if (req.method === 'DELETE') {
    const { profile_id, subscription } = req.body
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

  return res.status(405).json({ error: 'Method not allowed' })
}
