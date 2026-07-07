import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const testDbFiles = [
  'data/e2e-test.sqlite',
  'data/e2e-test.sqlite-wal',
  'data/e2e-test.sqlite-shm',
]

async function removeFile(file, { ignoreLocked = false } = {}) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.rmSync(file, { force: true })
      return
    } catch (error) {
      if (!['EBUSY', 'EPERM'].includes(error.code) || attempt === 4) {
        if (ignoreLocked && ['EBUSY', 'EPERM'].includes(error.code)) {
          return
        }
        throw error
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 250)
      })
    }
  }
}

export async function cleanE2eDatabase(options) {
  for (const file of testDbFiles) {
    await removeFile(file, options)
  }
}

export default async function globalSetup() {
  await cleanE2eDatabase({ ignoreLocked: true })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await cleanE2eDatabase()
}
