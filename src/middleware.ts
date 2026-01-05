import { debug } from './debugger'
import { analyseSchemaFile, analyseSchemaFiles, ASTModels } from './ast'
import { configureKeys, decryptOnRead, encryptOnWrite } from './encryption'
import type { Configuration, Middleware, MiddlewareParams } from './types'

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

export function fieldEncryptionMiddleware<
  Models extends string = any,
  Actions extends string = any
>(config: Configuration = {}): Middleware<Models, Actions> {
  // This will throw if the encryption key is missing
  // or if anything is invalid.
  const keys = configureKeys(config)
  debug.setup('Keys: %O', keys)

  const models = loadSchemaModels(config)
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
