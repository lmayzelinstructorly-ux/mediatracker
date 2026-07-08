function uniqueList(items) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))]
}

export function geminiModelQueue() {
  return uniqueList([
    process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
    ...(process.env.GEMINI_MODEL_FALLBACKS || '').split(','),
    'gemini-2.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.1-flash-lite',
    'gemini-3.1-flash-lite-preview',
    'gemma-4-26b-a4b-it',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash',
  ])
}

export function geminiHeaders() {
  const referer = process.env.GEMINI_HTTP_REFERER || 'http://localhost:5173/'
  return {
    'Content-Type': 'application/json',
    Referer: referer,
    Origin: referer.replace(/\/$/, ''),
  }
}

export function parseGeminiText(text, model, mode) {
  const cleaned = text.replace(/```json|```/g, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) {
      throw new Error('Gemini returned JSON that was not an array')
    }
    return parsed.map((item) => ({ ...item, sourceModel: model }))
  } catch (error) {
    throw new Error(`${model} returned unusable recommendation JSON: ${error.message}. Raw: ${cleaned.slice(0, 180) || 'empty response'} (${mode})`, { cause: error })
  }
}

export async function tryGeminiModel(model, prompt, mode) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: geminiHeaders(),
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 900,
        responseMimeType: 'application/json',
      },
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data.error?.message || `Gemini request failed with ${response.status}`
    throw new Error(`${model}: ${message}`)
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  return parseGeminiText(text, model, mode)
}

export async function geminiJsonArray(prompt, mode, maxOutputTokens = 1600) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY')
  }

  const errors = []
  for (const model of geminiModelQueue()) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: geminiHeaders(),
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens,
            responseMimeType: 'application/json',
          },
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error?.message || `Gemini request failed with ${response.status}`)
      }
      return {
        model,
        fallbackCount: errors.length,
        attemptedModels: geminiModelQueue(),
        items: parseGeminiText(data.candidates?.[0]?.content?.parts?.[0]?.text || '', model, mode),
      }
    } catch (error) {
      errors.push(`${model}: ${error.message}`)
    }
  }

  throw new Error(`No Gemini model could interpret the PDF. ${errors[0] || ''}`.trim())
}

export async function geminiRecommendations(mode, context, {
  librarySnapshot,
  useE2eGeminiFixtures,
  e2eGeminiFixtureRecommendations,
}) {
  if (useE2eGeminiFixtures) {
    return {
      model: 'e2e-gemini-fixture',
      attemptedModels: ['e2e-gemini-fixture'],
      fallbackCount: 0,
      suggestions: e2eGeminiFixtureRecommendations,
    }
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY')
  }

  const prompt = `
Return JSON only. Recommend 6 media titles for a personal tracker.
Schema: [{"title":"string","type":"movie|show|anime","reason":"string","mood":"string","confidence":1-100}]
Mode: ${mode}
User context:
${librarySnapshot() || 'No saved media yet.'}
Request:
${context || 'Make balanced cinematic recommendations.'}
Keep reasons brief and avoid titles already in the library.
  `.trim()

  const errors = []
  for (const model of geminiModelQueue()) {
    try {
      const suggestions = await tryGeminiModel(model, prompt, mode)
      return {
        model,
        attemptedModels: geminiModelQueue(),
        fallbackCount: errors.length,
        suggestions,
      }
    } catch (error) {
      errors.push(error.message)
    }
  }

  return {
    model: null,
    attemptedModels: geminiModelQueue(),
    fallbackCount: errors.length,
    errors,
    suggestions: [{
      title: 'Gemini is configured, but every model is unavailable',
      type: 'custom',
      reason: `${errors[0] || 'No Gemini model responded.'} The app tried ${errors.length} models automatically. Check quota, billing, model access, or referrer restrictions in .env.`,
      mood: mode,
      confidence: 0,
      sourceModel: 'none',
    }],
  }
}
