const GIPHY_SEARCH_URL = 'https://api.giphy.com/v1/gifs/search'
const GIPHY_TRENDING_URL = 'https://api.giphy.com/v1/gifs/trending'
const LIMIT = 20

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

  const { query, lang = 'fr', offset = 0 } = req.body

  const apiKey = process.env.GIPHY_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Giphy API key not configured' })

  try {
    const isSearch = query && query.trim().length > 0
    const baseUrl = isSearch ? GIPHY_SEARCH_URL : GIPHY_TRENDING_URL

    const params = new URLSearchParams({
      api_key: apiKey,
      limit: String(LIMIT),
      offset: String(offset),
      lang: lang === 'zh' ? 'zh-CN' : lang,
      rating: 'g',
    })

    if (isSearch) {
      params.set('q', query.trim())
    }

    const response = await fetch(`${baseUrl}?${params}`)
    if (!response.ok) throw new Error(`Giphy API error: ${response.status}`)

    const data = await response.json()

    const gifs = data.data.map((gif) => ({
      id: gif.id,
      title: gif.title || '',
      preview_url: gif.images.fixed_width_small?.url || gif.images.fixed_width?.url,
      url: gif.images.fixed_width?.url,
      width: parseInt(gif.images.fixed_width?.width) || 200,
      height: parseInt(gif.images.fixed_width?.height) || 200,
    }))

    return res.status(200).json({
      gifs,
      next_offset: offset + LIMIT,
    })
  } catch (error) {
    console.error('Giphy search error:', error)
    return res.status(500).json({ error: 'GIF search failed' })
  }
}
