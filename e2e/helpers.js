import { expect } from '@playwright/test'

export async function waitForBackend(request) {
  await expect.poll(async () => {
    const response = await request.get('/api/health').catch(() => null)
    return response?.ok() || false
  }).toBe(true)
}

function escapePdfText(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

export function pdfBufferFromText(text) {
  const lines = Array.isArray(text) ? text : String(text).split('\n')
  const textCommands = lines
    .map((line, index) => `1 0 0 1 72 ${720 - index * 18} Tm\n(${escapePdfText(line)}) Tj`)
    .join('\n')
  const content = `BT
/F1 12 Tf
${textCommands}
ET`

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content)} >>
stream
${content}
endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  }

  const xrefOffset = Buffer.byteLength(pdf)
  pdf += `xref
0 ${objects.length + 1}
0000000000 65535 f 
${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}
trailer
<< /Size ${objects.length + 1} /Root 1 0 R >>
startxref
${xrefOffset}
%%EOF`

  return Buffer.from(pdf)
}
