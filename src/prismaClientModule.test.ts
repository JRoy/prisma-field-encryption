import type { GeneratorConfig } from '@prisma/generator-helper'
import { getPrismaClientModule } from './generator/prismaClientModule'

type PrismaClientGenerator = Pick<GeneratorConfig, 'output' | 'provider'>

function generator(
  provider: string,
  output: string | null
): PrismaClientGenerator {
  return {
    output:
      output === null
        ? null
        : {
            fromEnvVar: null,
            value: output
          },
    provider: {
      fromEnvVar: null,
      value: provider
    }
  }
}

describe('getPrismaClientModule', () => {
  test('uses the package import for the default prisma-client-js output', () => {
    expect(
      getPrismaClientModule(
        generator('prisma-client-js', 'node_modules/@prisma/client'),
        '/repo/prisma/migrations'
      )
    ).toEqual('@prisma/client')
  })

  test('uses a custom prisma-client-js output directly', () => {
    expect(
      getPrismaClientModule(
        generator('prisma-client-js', '/repo/generated/client'),
        '/repo/prisma/migrations'
      )
    ).toEqual('../../generated/client')
  })

  test('targets the client module inside a prisma-client output', () => {
    expect(
      getPrismaClientModule(
        generator('prisma-client', '/repo/generated/client'),
        '/repo/prisma/migrations'
      )
    ).toEqual('../../generated/client/client')
  })
})
