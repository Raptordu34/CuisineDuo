import { supabase } from './supabase'

/**
 * Log une interaction IA dans la table ai_logs de Supabase.
 * Silencieux — ne lève jamais d'erreur pour ne pas bloquer l'app.
 *
 * @param {object} opts
 * @param {string} opts.householdId
 * @param {string} opts.profileId
 * @param {string} opts.endpoint  - ex: 'miam-orchestrator', 'correct-transcription', 'scan-receipt'
 * @param {object} opts.input     - données envoyées à l'IA (sans binaires)
 * @param {object} opts.output    - réponse reçue de l'IA
 * @param {number} opts.durationMs - durée en ms
 * @param {string} [opts.error]   - message d'erreur si échec
 */
export async function logAI({ householdId, profileId, endpoint, input, output, durationMs, error }) {
  try {
    await supabase.from('ai_logs').insert({
      household_id: householdId || null,
      profile_id: profileId || null,
      endpoint,
      input: input || null,
      output: output || null,
      duration_ms: durationMs ?? null,
      error: error || null,
    })
  } catch {
    // Silencieux — les logs ne doivent jamais casser l'app
  }
}
