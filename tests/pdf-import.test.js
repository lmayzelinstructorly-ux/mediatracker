import { afterEach, describe, expect, it, vi } from 'vitest'

import { createPdfImportService } from '../server/services/pdf-import.js'

function escapePdfText(text) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function tinyPdf(lines) {
  const stream = lines
    .map((line, index) => `BT\n/F1 12 Tf\n72 ${720 - index * 24} Td\n(${escapePdfText(line)}) Tj\nET`)
    .join('\n')
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]

  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf))
    pdf += object
  }

  const xrefOffset = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  return Buffer.from(pdf)
}

function createService(overrides = {}) {
  const inserted = []
  const dependencies = {
    mediaRows: vi.fn(() => []),
    mediaIdentityKey: vi.fn((item) => `${item.type}:${item.status}:${String(item.title).toLowerCase()}`),
    insertMedia: vi.fn((item) => {
      const saved = { id: inserted.length + 1, ...item }
      inserted.push(saved)
      return saved
    }),
    findBestTmdb: vi.fn(async (title, type, preferredYear) => ({
      tmdb_id: title.length,
      title,
      type,
      tags: ['TMDB genre'],
      genres: ['TMDB genre'],
      runtime: 100,
      release_year: preferredYear,
      description: `${title} from TMDB`,
    })),
    geminiJsonArray: vi.fn(async () => ({ items: [] })),
    applyKnownTitleCorrection: vi.fn((title) => title),
    findKnownCollection: vi.fn(() => null),
    selectedCollectionTitles: vi.fn(() => []),
    splitTrailingReleaseYear: vi.fn((title) => ({ title, year: '' })),
    ...overrides,
  }

  return {
    service: createPdfImportService(dependencies),
    dependencies,
    inserted,
  }
}

describe('createPdfImportService', () => {
  const originalGeminiKey = process.env.GEMINI_API_KEY

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalGeminiKey
  })

  it('imports structured PDF items, skips duplicates, expands collections, and passes type/year hints to TMDB', async () => {
    process.env.GEMINI_API_KEY = ''
    const collection = {
      label: 'The Dark Knight trilogy',
      titles: ['Batman Begins', 'The Dark Knight', 'The Dark Knight Rises'],
    }
    const { service, dependencies, inserted } = createService({
      mediaRows: vi.fn(() => [{ title: 'Already Saved', type: 'custom', status: 'Want to Watch' }]),
      findKnownCollection: vi.fn((title) => (title === 'The Dark Knight trilogy' ? collection : null)),
      selectedCollectionTitles: vi.fn(() => collection.titles),
    })

    const result = await service.importWatchlistFromPdf(
      tinyPdf([
        'PLANNING TO WATCH',
        '1. Arrival (2016) [Movie]',
        '- Already Saved',
        '- The Dark Knight trilogy',
        'HAVE WATCHED',
        '- Completed Show [TV]',
      ]),
    )

    expect(result.model).toBe('deterministic-pdf-parser')
    expect(result.skipped).toEqual([
      {
        title: 'Already Saved',
        type: 'custom',
        status: 'Want to Watch',
        reason: 'Already exists',
      },
    ])
    expect(result.created.map((item) => item.title)).toEqual([
      'Arrival',
      'Batman Begins',
      'The Dark Knight',
      'The Dark Knight Rises',
      'Completed Show',
    ])
    expect(dependencies.selectedCollectionTitles).toHaveBeenCalledWith('The Dark Knight trilogy', collection)
    expect(dependencies.findBestTmdb).toHaveBeenCalledTimes(5)
    expect(dependencies.findBestTmdb).toHaveBeenCalledWith('Arrival', 'movie', '2016')
    expect(dependencies.findBestTmdb).toHaveBeenCalledWith('Completed Show', 'show', '')
    expect(dependencies.insertMedia).toHaveBeenCalledTimes(5)
    expect(inserted.every((item) => item.tags.includes('PDF import'))).toBe(true)
    expect(inserted.find((item) => item.title === 'Arrival')).toMatchObject({ type: 'movie', release_year: '2016' })
    expect(inserted.find((item) => item.title === 'Batman Begins').tags).toEqual(
      expect.arrayContaining(['TMDB genre', 'The Dark Knight trilogy', 'Collection', 'PDF import']),
    )
  })

  it('keeps an unmatched title and marks it for review instead of attaching weak metadata', async () => {
    process.env.GEMINI_API_KEY = ''
    const { service, inserted } = createService({
      findBestTmdb: vi.fn(async () => null),
    })

    const result = await service.importWatchlistFromPdf(
      tinyPdf(['WATCHLIST', '- The Office']),
    )

    expect(result.created).toHaveLength(1)
    expect(result.created[0]).toMatchObject({ title: 'The Office', type: 'custom', matchedTmdb: false })
    expect(inserted[0].tags).toEqual(expect.arrayContaining(['PDF import', 'Needs review']))
  })
})
