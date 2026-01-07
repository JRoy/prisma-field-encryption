#!/usr/bin/env node

import { generatorHandler } from '@prisma/generator-helper'
import fs from 'node:fs/promises'
import path from 'path/posix'
import { analyseDMMF } from '../dmmf'
import { generateIndex } from './generateIndex'
import { generateModel } from './generateModel'

export interface Config {
  concurrently?: boolean
  generateMigrations?: boolean
}

generatorHandler({
  onManifest() {
    return {
      prettyName: 'field-level encryption',
      version: require('../../package.json').version,
      defaultOutput: './prisma/field-encryption'
    }
  },
  async onGenerate(options) {
    const models = analyseDMMF(options.dmmf)
    const outputDir = options.generator.output?.value!
    const generateMigrations =
      options.generator.config?.generateMigrations === 'true'
    const concurrently = options.generator.config?.concurrently === 'true'

    // Write the encrypted fields config to the output directory
    try {
      await fs.mkdir(outputDir, { recursive: true })
    } catch {}
    await fs.writeFile(
      path.join(outputDir, 'config.json'),
      JSON.stringify(models, null, 2)
    )

    // Migration files are opt-in via generateMigrations = true
    if (!generateMigrations) {
      return
    }

    const prismaClient = options.otherGenerators.find(
      each =>
        each.provider.value === 'prisma-client-js' ||
        each.provider.value === 'prisma-client'
    )

    if (!prismaClient) {
      return
    }

    // Keep only models with encrypted fields & a valid cursor
    const validModels = Object.fromEntries(
      Object.entries(models).filter(
        ([, model]) =>
          Object.keys(model.fields).length > 0 && Boolean(model.cursor)
      )
    )
    const prismaClientOutput =
      prismaClient.output?.value ?? 'node_modules/@prisma/client'

    const prismaClientModule = prismaClientOutput.endsWith(
      'node_modules/@prisma/client'
    )
      ? '@prisma/client'
      : path.relative(outputDir, prismaClientOutput)

    const longestModelNameLength = Object.keys(validModels).reduce(
      (max, model) => Math.max(max, model.length),
      0
    )

    await Promise.all(
      Object.entries(validModels).map(([modelName, model]) =>
        generateModel({
          modelName,
          model,
          outputDir,
          prismaClientModule
        })
      )
    )
    await generateIndex({
      concurrently,
      models: validModels,
      outputDir,
      prismaClientModule,
      modelNamePad: longestModelNameLength
    })
  }
})
