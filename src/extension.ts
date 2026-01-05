import { Prisma } from '@prisma/client/extension'
import { debug } from './debugger'
import { analyseSchemaFile, analyseSchemaFiles, ASTModels } from './ast'
import { configureKeys, decryptOnRead, encryptOnWrite } from './encryption'
import { Configuration, MiddlewareParams } from './types'

function loadSchemaModels(config: Configuration): ASTModels {
  const fs = require('fs')
  
  // If schemaPaths array is provided, use it
  if (config.schemaPaths && config.schemaPaths.length > 0) {
    debug.setup('Loading schemas from multiple paths: %O', config.schemaPaths)
    return analyseSchemaFiles(config.schemaPaths)
  }
  
  // If schemaPath is provided, use it (works with both files and directories)
  if (config.schemaPath) {
    debug.setup('Loading schema from path: %s', config.schemaPath)
    return analyseSchemaFile(config.schemaPath)
  }
  
  // Auto-detect: try multi-file schema directory first, then fallback to single file
  // Prisma 7 uses './prisma/schema/' directory for multi-file schemas
  const multiFileSchemaDir = './prisma/schema'
  const singleFileSchema = './prisma/schema.prisma'
  
  if (fs.existsSync(multiFileSchemaDir)) {
    const stats = fs.statSync(multiFileSchemaDir)
    if (stats.isDirectory()) {
      debug.setup('Auto-detected multi-file schema directory: %s', multiFileSchemaDir)
      return analyseSchemaFile(multiFileSchemaDir)
    }
  }
  
  if (fs.existsSync(singleFileSchema)) {
    debug.setup('Using single-file schema: %s', singleFileSchema)
    return analyseSchemaFile(singleFileSchema)
  }
  
  throw new Error(
    'Could not find Prisma schema. Please provide schemaPath or schemaPaths in the configuration. ' +
    'Looked for: ./prisma/schema/ (directory) and ./prisma/schema.prisma (file)'
  )
}

export function fieldEncryptionExtension<
  Models extends string = any,
  Actions extends string = any
>(config: Configuration = {}) {
  const keys = configureKeys(config)
  debug.setup('Keys: %O', keys)

  const models = loadSchemaModels(config)
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
