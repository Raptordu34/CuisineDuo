import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const ENDPOINT_COLORS = {
  'miam-orchestrator': 'bg-indigo-500',
  'correct-transcription': 'bg-orange-500',
  'scan-receipt': 'bg-emerald-500',
  'chat-ai': 'bg-blue-500',
}

const ENDPOINTS = ['all', 'miam-orchestrator', 'correct-transcription', 'scan-receipt', 'chat-ai']

function JsonBlock({ data, label }) {
  const [collapsed, setCollapsed] = useState(true)

  if (!data) return null

  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  const isLong = content.length > 200

  return (
    <div className="mt-2">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="text-xs font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
      >
        <span className={`transition-transform ${collapsed ? '' : 'rotate-90'}`}>▶</span>
        {label}
        <span className="text-slate-600">({content.length} chars)</span>
      </button>
      {!collapsed && (
        <pre className="mt-1 p-3 bg-slate-950 rounded text-xs font-mono text-green-400 overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-words">
          {isLong ? content : content}
        </pre>
      )}
    </div>
  )
}

function ActionBadge({ action }) {
  const success = action.result?.success !== false
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono ${
      success ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'
    }`}>
      {success ? '✓' : '✗'} {action.name}
      {action.args && Object.keys(action.args).length > 0 && (
        <span className="text-slate-500">({Object.entries(action.args).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')})</span>
      )}
    </span>
  )
}

function buildCopyPayload(log) {
  const input = log.input || {}
  const output = log.output || {}
  return {
    id: log.id,
    timestamp: log.created_at,
    endpoint: log.endpoint,
    duration_ms: log.duration_ms,
    error: log.error || null,
    input: {
      message: input.message || input.text || null,
      currentPage: input.currentPage || null,
      availableActions: input.availableActions || null,
      model: input.model || null,
      generationConfig: input.generationConfig || null,
      toolDeclarations: input.toolDeclarations || null,
      conversationHistory: input.conversationHistory || null,
      systemPrompt: input.systemPrompt || null,
    },
    output: {
      response: output.response || null,
      actions: output.actions || null,
      executedActions: output.executedActions || null,
      rawResponse: output.rawResponse || null,
    },
  }
}

function CopyButton({ log }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e) => {
    e.stopPropagation()
    const payload = JSON.stringify(buildCopyPayload(log), null, 2)
    navigator.clipboard.writeText(payload).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleCopy}
      title="Copier toutes les données du log"
      className={`shrink-0 px-2 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
        copied
          ? 'bg-emerald-700 text-emerald-100'
          : 'bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-200'
      }`}
    >
      {copied ? '✓ Copié' : '⎘ Copier'}
    </button>
  )
}

function LogEntry({ log }) {
  const [expanded, setExpanded] = useState(false)
  const endpointColor = ENDPOINT_COLORS[log.endpoint] || 'bg-gray-500'
  const hasError = !!log.error
  const date = new Date(log.created_at)
  const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })

  const input = log.input || {}
  const output = log.output || {}

  return (
    <div className={`border rounded-lg overflow-hidden ${
      hasError ? 'border-red-800 bg-red-950/30' : 'border-slate-700 bg-slate-800/50'
    }`}>
      {/* Header — always visible */}
      <div className="px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-3 text-left flex-1 min-w-0 cursor-pointer"
        >
          <span className={`shrink-0 w-2 h-2 rounded-full ${endpointColor}`} />
          <span className="text-xs text-slate-500 font-mono w-20 shrink-0">{dateStr} {timeStr}</span>
          <span className="text-xs font-mono text-slate-300 shrink-0">{log.endpoint}</span>
          {log.duration_ms && (
            <span className="text-xs text-slate-500 font-mono shrink-0">{log.duration_ms}ms</span>
          )}
          <span className="text-sm text-slate-200 truncate flex-1">
            {input.message || input.text || '—'}
          </span>
          {hasError && <span className="text-xs text-red-400 shrink-0">ERREUR</span>}
        </button>
        <CopyButton log={log} />
        <button
          onClick={() => setExpanded(!expanded)}
          className={`text-slate-500 hover:text-slate-300 transition-transform cursor-pointer shrink-0 ${expanded ? 'rotate-90' : ''}`}
        >
          ▶
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700 space-y-3">
          {/* Response text */}
          {output.response && (
            <div className="mt-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Reponse</span>
              <p className="mt-1 text-sm text-slate-200 bg-slate-900 rounded p-3">{output.response}</p>
            </div>
          )}

          {/* Actions executed */}
          {output.actions?.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions appelees</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {(output.executedActions || output.actions).map((a, i) => (
                  <ActionBadge key={i} action={a} />
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {hasError && (
            <div>
              <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Erreur</span>
              <pre className="mt-1 p-3 bg-red-950 rounded text-xs font-mono text-red-300 whitespace-pre-wrap">{log.error}</pre>
            </div>
          )}

          {/* Debug sections */}
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mt-3">Donnees detaillees</span>
            <JsonBlock label="Prompt systeme" data={input.systemPrompt} />
            <JsonBlock label="Outils declares" data={input.toolDeclarations} />
            <JsonBlock label="Historique conversation" data={input.conversationHistory} />
            <JsonBlock label="Config generation" data={input.generationConfig} />
            <JsonBlock label="Reponse brute Gemini" data={output.rawResponse} />
            <JsonBlock label="Input complet" data={input} />
            <JsonBlock label="Output complet" data={output} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function AILogsPage() {
  const { profile } = useAuth()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [limit, setLimit] = useState(50)

  const householdId = profile?.household_id

  const fetchLogs = useCallback(async () => {
    if (!householdId) return
    setLoading(true)
    let query = supabase
      .from('ai_logs')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (filter !== 'all') {
      query = query.eq('endpoint', filter)
    }

    const { data } = await query
    if (data) setLogs(data)
    setLoading(false)
  }, [householdId, filter, limit])

  // Initial fetch + refetch on filter/limit change
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!householdId) return
      setLoading(true)
      let query = supabase
        .from('ai_logs')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (filter !== 'all') query = query.eq('endpoint', filter)
      const { data } = await query
      if (!cancelled && data) setLogs(data)
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [householdId, filter, limit])

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-100">AI Debug Logs</h1>
            <p className="text-sm text-slate-400 mt-1">{logs.length} entrees</p>
          </div>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? '...' : 'Rafraichir'}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {ENDPOINTS.map(ep => (
            <button
              key={ep}
              onClick={() => setFilter(ep)}
              className={`px-3 py-1 rounded-full text-xs font-mono transition-colors cursor-pointer ${
                filter === ep
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {ep}
            </button>
          ))}
        </div>

        {/* Logs list */}
        <div className="space-y-2">
          {logs.map(log => (
            <LogEntry key={log.id} log={log} />
          ))}
        </div>

        {/* Load more */}
        {logs.length >= limit && (
          <div className="text-center mt-4">
            <button
              onClick={() => setLimit(prev => prev + 50)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm text-slate-300 transition-colors cursor-pointer"
            >
              Charger plus
            </button>
          </div>
        )}

        {logs.length === 0 && !loading && (
          <div className="text-center py-12 text-slate-500">
            Aucun log pour le moment. Interagissez avec Miam pour generer des logs.
          </div>
        )}
      </div>
    </div>
  )
}
