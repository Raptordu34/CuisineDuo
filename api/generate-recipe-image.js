export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { name, description, ingredients, styleHint } = req.body
  if (!name) return res.status(400).json({ error: 'Recipe name required' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  try {
    const ingredientNames = (ingredients || []).map(i => i.name || i).join(', ')

    const prompt = `Generate a single appetizing food photo of a dish called "${name}". ` +
      `Description: ${description || 'A delicious dish'}. ` +
      `Key ingredients: ${ingredientNames || 'various'}. ` +
      (styleHint ? `Style: ${styleHint}. ` : '') +
      `Show a beautifully plated dish with natural lighting, top-down or 45-degree angle. ` +
      `Only output the image, no text.`

    // Modeles Gemini avec generation d'images native (Nano Banana)
    // Ref: https://ai.google.dev/gemini-api/docs/image-generation (fev 2026)
    const modelsToTry = [
      'gemini-2.5-flash-image',            // Nano Banana — rapide, optimise volume
      'gemini-3.1-flash-image-preview',     // Nano Banana 2 — haute efficacite
    ]

    let lastError = null

    for (const modelName of modelsToTry) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseModalities: ['IMAGE', 'TEXT'],
              },
            }),
          }
        )

        if (!response.ok) {
          const errText = await response.text().catch(() => 'no body')
          lastError = `${modelName}: HTTP ${response.status} — ${errText.slice(0, 200)}`
          console.error('Gemini image API error:', lastError)
          continue // Essayer le modele suivant
        }

        const data = await response.json()
        const parts = data.candidates?.[0]?.content?.parts || []
        const imagePart = parts.find(p => p.inlineData)

        if (!imagePart?.inlineData?.data) {
          lastError = `${modelName}: no image in response (parts: ${parts.map(p => Object.keys(p)).join(',')})`
          console.error('No image:', lastError)
          continue // Essayer le modele suivant
        }

        const { data: base64Data, mimeType } = imagePart.inlineData
        const dataUrl = `data:${mimeType || 'image/png'};base64,${base64Data}`

        return res.status(200).json({ imageUrl: dataUrl, model: modelName })
      } catch (err) {
        lastError = `${modelName}: ${err.message}`
        console.error('Model attempt failed:', lastError)
        continue
      }
    }

    // Tous les modeles ont echoue
    return res.status(500).json({ error: 'All image generation models failed', details: lastError })
  } catch (error) {
    console.error('Generate recipe image error:', error)
    return res.status(500).json({ error: 'Image generation failed', details: error.message })
  }
}
