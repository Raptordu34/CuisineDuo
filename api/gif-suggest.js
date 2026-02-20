import { GoogleGenerativeAI } from '@google/generative-ai'

const GIPHY_SEARCH_URL = 'https://api.giphy.com/v1/gifs/search'

const SYSTEM_PROMPTS = {
  fr: "Tu es un expert en GIFs et reactions visuelles. Ton but est de generer des mots-cles de recherche (1-3 mots en anglais) qui capturent parfaitement l'emotion, le ton ou la reponse ideale au dernier message de la conversation. Sois créatif et varie les styles (humour, mignon, sarcastique, etc.) en fonction du contexte. Reponds uniquement avec les requetes, une par ligne, sans numerotation ni ponctuation.",
  en: "You are a GIF and visual reaction expert. Your goal is to generate search keywords (1-3 words in English) that perfectly capture the emotion, tone, or ideal response to the last message in the conversation. Be creative and vary styles (humorous, cute, sarcastic, etc.) based on context. Respond only with queries, one per line, no numbering or punctuation.",
  zh: "你是GIF和视觉反应专家。你的目标是生成搜索关键词（1-3个英文单词），完美捕捉对话中最后一条消息的情绪、语调或理想回应。根据语境发挥创意并变换风格（幽默、可爱、讽刺等）。只回复查询，每行一个，不要编号或标点。",
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Verification auth basique
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { messages, gifHistory, recentGifs, lang = 'fr' } = req.body

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  const giphyKey = process.env.GIPHY_API_KEY
  if (!giphyKey) return res.status(500).json({ error: 'Giphy API key not configured' })

  try {
    // Construire le contexte conversation (ignorer les messages GIF)
    const safeMessages = (Array.isArray(messages) ? messages : [])
      .filter(m => m.content && m.content.trim())

    const conversationContext = safeMessages
      .map((m, i) => {
        const isLast = i === safeMessages.length - 1
        const prefix = isLast ? '>>> DERNIER MESSAGE (PRIORITÉ)' : (m.is_ai ? 'AI' : 'User')
        return `${prefix}: ${m.content}`
      })
      .join('\n')

    // Construire les preferences GIF de l'utilisateur
    const safeGifHistory = Array.isArray(gifHistory) ? gifHistory : []
    const gifPreferences = safeGifHistory
      .map(g => `"${g.title}" (${g.count}x)`)
      .join(', ')

    const safeRecentGifs = Array.isArray(recentGifs) ? recentGifs : []
    const recentContext = safeRecentGifs.length > 0 ? `GIFs recents de l'utilisateur: ${safeRecentGifs.join(', ')}` : ''

    const prompt = `CONTEXTE DE LA CONVERSATION:
${conversationContext || '(pas de conversation recente)'}

${recentContext}
GIFs les plus utilisés par l'utilisateur: ${gifPreferences || 'Aucun historique'}

INSTRUCTIONS:
1. Analyse le DERNIER MESSAGE pour comprendre l'emotion immédiate et le besoin de réaction.
2. Regarde les GIFs récents et les plus utilisés pour comprendre le style visuel de l'utilisateur (humour, anime, animaux, minimaliste, etc.).
3. Génère 5 requêtes de recherche Giphy (en ANGLAIS obligatoire) très courtes :
   - 2 requêtes pour réagir directement au dernier message.
   - 1 requête pour l'ambiance globale de la discussion.
   - 1 requête basée sur le style habituel de l'utilisateur adapté au contexte actuel.
   - 1 requête créative ou inattendue mais pertinente.`

    // Appel Gemini pour generer les requetes
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM_PROMPTS[lang] || SYSTEM_PROMPTS.fr,
    })

    const result = await model.generateContent(prompt)
    const queries = result.response.text()
      .split('\n')
      .map(q => q.replace(/^[\d\-.)*]+\s*/, '').trim())
      .filter(q => q && q.length > 0 && q.length < 40)
      .slice(0, 5)

    if (queries.length === 0) {
      return res.status(200).json({ gifs: [], queries_used: [] })
    }

    // Rechercher les GIFs sur Giphy en parallele
    const searchPromises = queries.map(async (query) => {
      const params = new URLSearchParams({
        api_key: giphyKey,
        q: query,
        limit: '8',
        rating: 'g',
        lang: lang === 'zh' ? 'zh-CN' : lang,
      })

      const response = await fetch(`${GIPHY_SEARCH_URL}?${params}`)
      if (!response.ok) return []

      const data = await response.json()
      return data.data || []
    })

    const results = await Promise.all(searchPromises)

    // Deduplication et formatage
    const seenIds = new Set()
    const allGifs = []

    for (const giphyGifs of results) {
      for (const gif of giphyGifs) {
        if (!seenIds.has(gif.id)) {
          seenIds.add(gif.id)
          allGifs.push({
            id: gif.id,
            title: gif.title || '',
            preview_url: gif.images.fixed_width_small?.url || gif.images.fixed_width?.url,
            url: gif.images.fixed_width?.url,
            width: parseInt(gif.images.fixed_width?.width) || 200,
            height: parseInt(gif.images.fixed_width?.height) || 200,
          })
        }
      }
    }

    return res.status(200).json({
      gifs: allGifs.slice(0, 20),
      queries_used: queries,
    })
  } catch (error) {
    console.error('GIF suggestion error:', error)
    return res.status(500).json({ error: 'Failed to generate suggestions' })
  }
}
