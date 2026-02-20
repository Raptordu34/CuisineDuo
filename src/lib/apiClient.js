import { supabase } from './supabase'

/**
 * Recupere les headers d'authentification avec le JWT Supabase.
 */
async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession()

  const headers = {
    'Content-Type': 'application/json',
  }

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  return headers
}

/**
 * Effectue un appel POST authentifie vers une API serverless.
 */
export async function apiPost(url, body) {
  const headers = await getAuthHeaders()
  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

/**
 * Effectue un appel DELETE authentifie vers une API serverless.
 */
export async function apiDelete(url, body) {
  const headers = await getAuthHeaders()
  return fetch(url, {
    method: 'DELETE',
    headers,
    body: JSON.stringify(body),
  })
}
