import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // Verification du JWT
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const token = authHeader.split(' ')[1]

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Verifier l'identite de l'utilisateur
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  // Recuperer le profil pour le household_id
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, household_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return res.status(403).json({ error: 'Profile not found' })
  }

  if (req.method === 'POST') {
    const { subscription, action } = req.body
    if (!subscription) {
      return res.status(400).json({ error: 'Missing subscription' })
    }

    const endpoint = subscription?.endpoint
    if (!endpoint) {
      return res.status(400).json({ error: 'Missing subscription endpoint' })
    }

    if (action === 'verify') {
      const { data: existing, error: verifyError } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('profile_id', user.id)
        .eq('household_id', profile.household_id)
        .eq('subscription->>endpoint', endpoint)
        .limit(1)

      if (verifyError) {
        console.error('Supabase verify error:', verifyError.message)
        return res.status(500).json({ error: 'Failed to verify subscription' })
      }

      return res.status(200).json({ subscribed: (existing?.length || 0) > 0 })
    }

    const { error: cleanupError } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('profile_id', user.id)
      .eq('subscription->>endpoint', endpoint)

    if (cleanupError) {
      console.error('Supabase cleanup error:', cleanupError.message)
      return res.status(500).json({ error: 'Failed to save subscription' })
    }

    const { error: insertError } = await supabase
      .from('push_subscriptions')
      .insert({
        profile_id: user.id,
        household_id: profile.household_id,
        subscription,
      })

    if (insertError) {
      console.error('Supabase insert error:', insertError.message)
      return res.status(500).json({ error: 'Failed to save subscription' })
    }

    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const { subscription } = req.body
    if (!subscription) {
      return res.status(400).json({ error: 'Missing subscription' })
    }

    const { error: deleteError } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('profile_id', user.id)
      .eq('subscription->>endpoint', subscription.endpoint)

    if (deleteError) {
      console.error('Supabase delete error:', deleteError.message)
      return res.status(500).json({ error: 'Failed to delete subscription' })
    }

    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
