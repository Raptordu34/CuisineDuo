export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { recipeName, recipeDescription } = req.body
  if (!recipeName) return res.status(400).json({ error: 'Recipe name required' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

  try {
    // Generate image with Imagen 4.0
    const prompt = `A professional appetizing food photograph of "${recipeName}"${recipeDescription ? `, ${recipeDescription}` : ''}. Close-up, warm natural lighting, shallow depth of field, on a nice plate, restaurant quality. No text, no watermark.`

    const imagenResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            outputOptions: { mimeType: 'image/jpeg' },
          },
        }),
      }
    )

    if (!imagenResp.ok) {
      const errText = await imagenResp.text()
      console.error(`[generate-recipe-image] Imagen error (${imagenResp.status}):`, errText)
      return res.status(200).json({ image_url: null, found: false })
    }

    const imagenData = await imagenResp.json()
    const prediction = imagenData.predictions?.[0]

    if (!prediction?.bytesBase64Encoded) {
      console.error('[generate-recipe-image] No image in Imagen response')
      return res.status(200).json({ image_url: null, found: false })
    }

    // Upload to Supabase Storage
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
    const imageBuffer = Buffer.from(prediction.bytesBase64Encoded, 'base64')

    const uploadResp = await fetch(
      `${supabaseUrl}/storage/v1/object/recipe-images/${fileName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'image/jpeg',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: imageBuffer,
      }
    )

    if (!uploadResp.ok) {
      console.error('[generate-recipe-image] Storage upload failed:', await uploadResp.text())
      return res.status(200).json({ image_url: null, found: false })
    }

    const image_url = `${supabaseUrl}/storage/v1/object/public/recipe-images/${fileName}`
    return res.status(200).json({ image_url, found: true })
  } catch (error) {
    console.error('[generate-recipe-image] Error:', error.message)
    return res.status(200).json({ image_url: null, found: false })
  }
}
