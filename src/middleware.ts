import { debug } from './debugger'
import { analyseDMMF, DMMFModels } from './dmmf'
import { configureKeys, decryptOnRead, encryptOnWrite } from './encryption'
import type { Configuration, Middleware, MiddlewareParams } from './types'

function getModels(config: Configuration): DMMFModels {
  // 1. If models config is directly provided (pre-analysed), use it
  if (config.models) {
    return config.models as DMMFModels
  }

  // 2. If configPath is provided, load from that path
  if (config.configPath) {
    const fs = require('fs')
    const path = require('path')
    const fullPath = path.resolve(process.cwd(), config.configPath)
    const generatedConfig = JSON.parse(fs.readFileSync(fullPath, 'utf-8'))
    debug.setup('Loaded encrypted fields config from %s', fullPath)
    return generatedConfig as DMMFModels
  }

  // 3. If DMMF is provided, analyse it
  if (config.dmmf) {
    return analyseDMMF(config.dmmf)
  }

  // 4. Try to get DMMF from @prisma/client (works in Prisma < 7)
  try {
    const { Prisma } = require('@prisma/client')
    if (Prisma?.dmmf) {
      return analyseDMMF(Prisma.dmmf)
    }
  } catch {
    // @prisma/client not available or doesn't export dmmf
  }

  throw new Error(
    `prisma-field-encryption: Could not find encrypted fields configuration.
Note: The middleware API ($use) was removed in Prisma 7.
Use fieldEncryptionExtension with $extends instead.
`
  )
}

/**
 * @deprecated The middleware API was removed in Prisma 7.
 * Use `fieldEncryptionExtension` with `$extends` instead.
 */
export function fieldEncryptionMiddleware<
  Models extends string = any,
  Actions extends string = any
>(config: Configuration = {}): Middleware<Models, Actions> {
  // This will throw if the encryption key is missing
  // or if anything is invalid.
  const keys = configureKeys(config)
  debug.setup('Keys: %O', keys)
  const models = getModels(config)
  debug.setup('Models: %O', models)

  return async function fieldEncryptionMiddleware(
    params: MiddlewareParams<Models, Actions>,
    next: (params: MiddlewareParams<Models, Actions>) => Promise<any>
  ) {
    if (!params.model) {
      // Unsupported operation
      debug.runtime('Unsupported operation (missing model): %O', params)
      return await next(params)
    }
    const operation = `${params.model}.${params.action}`
    // Params are mutated in-place for modifications to occur.
    // See https://github.com/prisma/prisma/issues/9522
    const encryptedParams = encryptOnWrite(params, keys, models, operation)
    let result = await next(encryptedParams)
    decryptOnRead(encryptedParams, result, keys, models, operation)
    return result
  }
}
