import { Prisma } from '@prisma/client/extension'
import { debug } from './debugger'
import { analyseDMMF, DMMFModels } from './dmmf'
import { configureKeys, decryptOnRead, encryptOnWrite } from './encryption'
import { Configuration, MiddlewareParams } from './types'

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

Add the generator to your schema.prisma and specify the configPath:

  generator fieldEncryption {
    provider = "prisma-field-encryption"
    output   = "./prisma/field-encryption"
  }

Then run \`prisma generate\` and pass the config path:

  fieldEncryptionExtension({
    encryptionKey: '...',
    configPath: './prisma/field-encryption/config.json'
  })
`
  )
}

export function fieldEncryptionExtension<
  Models extends string = any,
  Actions extends string = any
>(config: Configuration = {}) {
  const keys = configureKeys(config)
  debug.setup('Keys: %O', keys)
  const models = getModels(config)
  debug.setup('Models: %O', models)

  return Prisma.defineExtension({
    name: 'prisma-field-encryption',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model) {
            // Unsupported operation
            debug.runtime(
              'Unsupported operation %s (missing model): %O',
              operation,
              args
            )
            return await query(args)
          }
          const params: MiddlewareParams<Models, Actions> = {
            args,
            model: model as Models,
            action: operation as Actions,
            dataPath: [],
            runInTransaction: false
          }
          const encryptedParams = encryptOnWrite(
            params,
            keys,
            models,
            operation
          )
          let result = await query(encryptedParams.args)
          decryptOnRead(encryptedParams, result, keys, models, operation)
          return result
        }
      }
    }
  })
}
