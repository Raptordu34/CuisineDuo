import { GoogleGenerativeAI } from '@google/generative-ai'

const GIPHY_SEARCH_URL = 'https://api.giphy.com/v1/gifs/search'

const SYSTEM_PROMPTS = {
  fr: "Tu es un expert en GIFs et reactions visuelles. Genere des requetes de recherche courtes (1-3 mots en anglais) pour trouver des GIFs pertinents. Reponds uniquement avec les requetes, une par ligne, sans numerotation ni ponctuation.",
  en: "You are a GIF and visual reaction expert. Generate short search queries (1-3 words in English) to find relevant GIFs. Respond only with the queries, one per line, no numbering or punctuation.",
  zh: "你是GIF和视觉反应专家。生成简短的搜索查询（1-3个英文单词）来找到相关的GIF。只回复查询，每行一个，不要编号或标点。",
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { messages, gifHistory, lang = 'fr' } = req.body

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  const giphyKey = process.env.GIPHY_API_KEY
  if (!giphyKey) return res.status(500).json({ error: 'Giphy API key not configured' })

  try {
    // Construire le contexte conversation (ignorer les messages GIF)
    const safeMessages = Array.isArray(messages) ? messages : []
    const conversationContext = safeMessages
      .filter(m => m.content && m.content.trim())
      .slice(0, 15)
      .map(m => `${m.is_ai ? 'AI' : 'User'}: ${m.content}`)
      .join('\n')

    // Construire les preferences GIF de l'utilisateur
    const safeGifHistory = Array.isArray(gifHistory) ? gifHistory : []
    const gifPreferences = safeGifHistory
      .map(g => `"${g.title}" (${g.count}x)`)
      .join(', ')

    const prompt = `Conversation recente du chat:
${conversationContext || '(pas de conversation recente)'}

GIFs preferes de l'utilisateur: ${gifPreferences || 'Aucun historique'}

En te basant sur le ton et le sujet de la conversation, et sur les preferences GIF de l'utilisateur (style, personnages, themes recurrents), genere 4 requetes de recherche GIF courtes et pertinentes.
Si l'utilisateur a des personnages ou styles preferes (ex: grenouille, chat, anime), incorpore-les dans les requetes en les adaptant au contexte de la conversation.`

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
