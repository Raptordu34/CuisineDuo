import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

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

  // Verifier l'identite de l'utilisateur via le JWT
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  // Recuperer le profil pour obtenir le household_id verifie
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, household_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.household_id) {
    return res.status(403).json({ error: 'No household found' })
  }

  const vapidPublic = process.env.VITE_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  if (!vapidPublic || !vapidPrivate) {
    return res.status(500).json({ error: 'VAPID keys not configured' })
  }

  webpush.setVapidDetails('mailto:noreply@cuisineduo.app', vapidPublic, vapidPrivate)

  const { title, body } = req.body

  // Utiliser le household_id verifie du profil, pas celui du client
  const { data: subscriptions, error: subError } = await supabase
    .from('push_subscriptions')
    .select('id, subscription')
    .eq('household_id', profile.household_id)
    .neq('profile_id', user.id)

  if (subError) {
    console.error('Failed to fetch subscriptions:', subError.message)
    return res.status(500).json({ error: 'Failed to fetch subscriptions' })
  }

  const payload = JSON.stringify({ title: title || 'CuisineDuo', body: body || '' })

  const expiredIds = []

  await Promise.allSettled(
    (subscriptions || []).map(async (sub) => {
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

  // Nettoyer les subscriptions expirees
  if (expiredIds.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('id', expiredIds)
  }

  return res.status(200).json({ sent: (subscriptions || []).length - expiredIds.length, expired: expiredIds.length })
}
