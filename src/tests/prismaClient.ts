import { PrismaLibSql } from '@prisma/adapter-libsql'
import path from 'node:path'
import { fieldEncryptionExtension } from '../index'
import { Configuration } from '../types'
import { PrismaClient } from './.generated/client/client'

const TEST_ENCRYPTION_KEY =
  'k1.aesgcm256.__________________________________________8='

const dbPath = path.resolve(process.cwd(), 'prisma', 'db.integration.sqlite')

export function makeExtensionClient() {
  const config: Configuration = {
    encryptionKey: TEST_ENCRYPTION_KEY,
    configPath: './src/tests/migrations/config.json'
  }
  const adapter = new PrismaLibSql({ url: `file:${dbPath}` })
  const client = new PrismaClient({ adapter })
  return client.$extends(fieldEncryptionExtension(config)) as PrismaClient
}
