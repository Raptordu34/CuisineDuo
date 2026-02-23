import { supabase } from './supabase'

const DEFAULT_TIMEOUT_MS = 30000 // 30 secondes

/**
 * Recupere les headers d'authentification avec le JWT Supabase.
 * Timeout de 3s pour ne pas bloquer si le reseau est instable.
 */
async function getAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  }

  try {
    const sessionPromise = supabase.auth.getSession()
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 3000))
    const result = await Promise.race([sessionPromise, timeoutPromise])

    if (result?.data?.session?.access_token) {
      headers['Authorization'] = `Bearer ${result.data.session.access_token}`
    }
  } catch {
    // Pas de session disponible — on continue sans token
  }

  return headers
}

/**
 * Effectue un appel POST authentifie vers une API serverless.
 * Inclut un timeout pour eviter les requetes pendantes.
 */
export async function apiPost(url, body, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const headers = await getAuthHeaders()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Effectue un appel DELETE authentifie vers une API serverless.
 */
export async function apiDelete(url, body, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const headers = await getAuthHeaders()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      method: 'DELETE',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}
