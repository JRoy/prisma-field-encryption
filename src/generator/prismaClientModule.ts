import type { GeneratorConfig } from '@prisma/generator-helper'
import path from 'path/posix'

type PrismaClientGenerator = Pick<GeneratorConfig, 'output' | 'provider'>

export function getPrismaClientModule(
  prismaClient: PrismaClientGenerator,
  outputDir: string
): string {
  const prismaClientOutput =
    prismaClient.output?.value ?? 'node_modules/@prisma/client'

  if (prismaClientOutput.endsWith('node_modules/@prisma/client')) {
    return '@prisma/client'
  }

  const prismaClientModule =
    prismaClient.provider.value === 'prisma-client'
      ? path.join(prismaClientOutput, 'client')
      : prismaClientOutput

  return path.relative(outputDir, prismaClientModule)
}
