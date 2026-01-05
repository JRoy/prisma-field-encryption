/**
 * Prisma types --
 *
 * We're copying just what we need for local type safety
 * without importing Prisma-generated types, as the location
 * of the generated client can be unknown (when using custom
 * or multiple client locations).
 */

import type { Encoding } from '@47ng/codec'

/**
 * Not ideal to use `any` on model & action, but Prisma's
 * strong typing there actually prevents using the correct
 * type without excessive generics wizardry.
 */
export type MiddlewareParams<Models extends string, Actions extends string> = {
  model?: Models
  action: Actions
  args: any
  dataPath: string[]
  runInTransaction: boolean
}

export type Middleware<
  Models extends string,
  Actions extends string,
  Result = any
> = (
  params: MiddlewareParams<Models, Actions>,
  next: (params: MiddlewareParams<Models, Actions>) => Promise<Result>
) => Promise<Result>

// Internal types --

export interface Configuration {
  encryptionKey?: string
  decryptionKeys?: string[]
  /**
   * Path to the Prisma schema file or directory containing schema files.
   * 
   * For single-file schemas (traditional): './prisma/schema.prisma'
   * For multi-file schemas (Prisma 7+): './prisma/schema/' (directory)
   * 
   * You can also use `schemaPaths` to specify multiple individual files.
   */
  schemaPath?: string
  /**
   * Array of paths to individual Prisma schema files.
   * Use this when you have multiple schema files in different locations.
   * 
   * If both schemaPath and schemaPaths are provided, schemaPaths takes precedence.
   */
  schemaPaths?: string[]
}

export type HashFieldConfiguration = {
  sourceField: string
  targetField: string
  algorithm: string
  salt?: string
  inputEncoding: Encoding
  outputEncoding: Encoding
  normalize?: HashFieldNormalizeOptions[]
}

export enum HashFieldNormalizeOptions {
  lowercase = 'lowercase',
  uppercase = 'uppercase',
  trim = 'trim',
  spaces = 'spaces',
  diacritics = 'diacritics'
}

export interface FieldConfiguration {
  encrypt: boolean
  strictDecryption: boolean
  hash?: Omit<HashFieldConfiguration, 'sourceField'>
}
