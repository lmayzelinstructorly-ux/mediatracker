export async function mockApi(page) {
  const media = []

  await page.route('**/api/health', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        tmdbConfigured: false,
        geminiConfigured: false,
        geminiModel: 'test-mock',
        geminiFallbacks: [],
      }),
    })
  })

  await page.route('**/api/media', async (route) => {
    const request = route.request()

    if (request.method() === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(media) })
      return
    }

    if (request.method() === 'POST') {
      const payload = JSON.parse(request.postData() || '{}')
      const saved = {
        id: media.length + 1,
        tmdb_id: payload.tmdb_id || null,
        title: payload.title,
        type: payload.type || 'custom',
        cover_art: payload.cover_art || '',
        genres: payload.genres || [],
        tags: payload.tags || [],
        description: payload.description || 'A custom local entry.',
        runtime: payload.runtime || 45,
        release_year: payload.release_year || '',
        tmdb_rating: payload.tmdb_rating || null,
        status: payload.status || 'Want to Watch',
        priority: payload.priority || 0,
        personal_rating: payload.personal_rating || null,
        reflection: payload.reflection || '',
        season: payload.season || 1,
        episode: payload.episode || 0,
        completed_at: payload.completed_at || null,
        reminder_at: payload.reminder_at || null,
      }
      media.unshift(saved)
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(saved) })
      return
    }

    await route.fallback()
  })

  await page.route('**/api/import/pdf', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        model: 'playwright-mock-parser',
        fallbackCount: 0,
        attemptedModels: [],
        extractedCharacters: 72,
        extractedItems: 2,
        created: [
          {
            id: media.length + 1,
            title: 'Spirited Away',
            type: 'movie',
            status: 'Want to Watch',
            tags: ['PDF import'],
            genres: ['PDF import'],
            description: 'Imported from a mocked PDF watchlist.',
          },
        ],
        skipped: [],
      }),
    })
  })

  await page.route('**/api/search/tmdb**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) })
  })

  return { media }
}

export function pdfBufferFromText(text) {
  const escaped = text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')

  return Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 85 >>
stream
BT
/F1 12 Tf
72 720 Td
(${escaped}) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000250 00000 n 
0000000385 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
455
%%EOF`)
}
