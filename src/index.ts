export { fieldEncryptionExtension } from './extension' // Prisma >= 4.7.0

/**
 * @deprecated The middleware API was removed in Prisma 7.
 * Use `fieldEncryptionExtension` with `$extends` instead.
 * This export is kept for backward compatibility with Prisma 3.8 - 6.x.
 */
export { fieldEncryptionMiddleware } from './middleware' // Prisma 3.8 - 6.x (removed in Prisma 7)
