import { R2_PATHS, type UploadPurpose } from './r2-paths'

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const CANVAS_IMAGE_TYPES = new Set([...IMAGE_TYPES, 'image/svg+xml'])
const DESIGN_TYPES = new Set([
  'application/pdf', 'image/svg+xml', 'application/postscript', 'application/eps',
  'application/x-eps', 'application/illustrator', 'application/vnd.adobe.illustrator', 'image/png',
])
const TEMPLATE_TYPES = new Set(['image/svg+xml', ...IMAGE_TYPES])
const MAX_IMAGE_SIZE = 20 * 1024 * 1024
const MAX_CANVAS_IMAGE_SIZE = 10 * 1024 * 1024
const MAX_ARTWORK_SIZE = 100 * 1024 * 1024
const MAX_TEMPLATE_SIZE = 50 * 1024 * 1024

export interface UploadRequest {
  filename: string
  contentType: string
  size: number
  purpose: UploadPurpose
  designId?: string
  destination?: string
}

export class UploadValidationError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

export const DESIGN_UPLOAD_ERROR = 'Unsupported file type. Please upload only supported formats: PDF, SVG, EPS, AI, PNG.'
export const IMAGE_UPLOAD_ERROR = 'Unsupported image type. Please upload only PNG, JPG, JPEG, or WebP.'
export const CANVAS_IMAGE_UPLOAD_ERROR = 'Unsupported file type. Please upload PNG, JPEG, WEBP, or SVG files only.'
export const CANVAS_IMAGE_SIZE_ERROR = 'File size exceeds 10 MB limit.'

export function sanitizeFilename(filename: string) {
  const parts = filename.toLowerCase().split('.')
  const extension = parts.length > 1 ? `.${parts.pop()?.replace(/[^a-z0-9]/g, '')}` : ''
  const base = parts.join('.').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
  return `${base || 'asset'}${extension}`
}

export function validateUpload(input: UploadRequest) {
  if (!input.filename || !input.contentType || !Number.isFinite(input.size) || input.size <= 0) {
    throw new UploadValidationError('INVALID_UPLOAD', 'Filename, content type, and file size are required.')
  }

  const allowedTypes =
    input.purpose === 'template'
      ? TEMPLATE_TYPES
      : input.purpose === 'logo'
        ? CANVAS_IMAGE_TYPES
      : input.purpose === 'design-artwork'
        ? DESIGN_TYPES
      : input.purpose === 'design-draft'
        ? new Set(['application/json'])
        : input.purpose === 'design-production'
          ? new Set(['application/pdf', 'image/svg+xml'])
        : input.purpose === 'order-document'
          ? new Set(['application/pdf'])
        : IMAGE_TYPES
  if (!allowedTypes.has(input.contentType)) {
    throw new UploadValidationError('INVALID_FILE_TYPE', input.purpose === 'design-artwork' ? DESIGN_UPLOAD_ERROR : input.purpose === 'logo' ? CANVAS_IMAGE_UPLOAD_ERROR : IMAGE_UPLOAD_ERROR)
  }

  const maxSize =
    input.purpose === 'logo'
      ? MAX_CANVAS_IMAGE_SIZE
      : input.purpose === 'design-artwork'
      ? MAX_ARTWORK_SIZE
      : input.purpose === 'template'
        ? MAX_TEMPLATE_SIZE
        : MAX_IMAGE_SIZE

  if (input.size > maxSize) {
    throw new UploadValidationError('FILE_TOO_LARGE', input.purpose === 'logo' ? CANVAS_IMAGE_SIZE_ERROR : `The maximum file size is ${Math.round(maxSize / 1024 / 1024)} MB.`)
  }

  const extension = sanitizeFilename(input.filename).split('.').pop()
  const expected: Record<string, string[]> = {
    'image/png': ['png'],
    'image/jpeg': ['jpg', 'jpeg'],
    'image/webp': ['webp'],
    'image/svg+xml': ['svg'],
    'application/json': ['json'],
    'application/pdf': input.purpose === 'design-artwork' ? ['pdf', 'ai'] : ['pdf'],
    'application/postscript': ['eps', 'ai'],
    'application/eps': ['eps'],
    'application/x-eps': ['eps'],
    'application/illustrator': ['ai'],
    'application/vnd.adobe.illustrator': ['ai'],
  }
  if (!extension || !expected[input.contentType]?.includes(extension)) {
    throw new UploadValidationError('INVALID_FILE_TYPE', input.purpose === 'design-artwork' ? DESIGN_UPLOAD_ERROR : input.purpose === 'logo' ? CANVAS_IMAGE_UPLOAD_ERROR : 'The filename extension does not match the file type.')
  }
}

export function createUploadKey(input: UploadRequest, identity: string) {
  const filename = `${crypto.randomUUID()}-${sanitizeFilename(input.filename)}`
  const safeIdentity = identity.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)
  const safeDesignId = input.designId?.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)

  switch (input.purpose) {
    case 'design-artwork':
    case 'logo':
      return [R2_PATHS.userUploads, safeIdentity, safeDesignId || 'temporary', filename].join('/')
    case 'design-draft':
      return [R2_PATHS.designUploads, safeIdentity, safeDesignId || 'drafts', filename].join('/')
    case 'design-preview':
      return [R2_PATHS.designPreviews, safeIdentity, safeDesignId || 'drafts', filename].join('/')
    case 'design-production':
      return [R2_PATHS.printFiles, safeIdentity, safeDesignId || 'drafts', filename].join('/')
    case 'template':
      return `${R2_PATHS.editorTemplates}/vinyl-banners/${input.contentType === 'image/svg+xml' ? 'source' : 'previews'}/${filename}`
    case 'homepage':
      return `${([
        R2_PATHS.homepageHeroDesktop,
        R2_PATHS.homepageHeroMobile,
        R2_PATHS.homepageCategories,
        R2_PATHS.homepagePromotionsDesktop,
        R2_PATHS.homepagePromotionsMobile,
      ] as string[]).includes(input.destination ?? '') ? input.destination : R2_PATHS.homepageHeroDesktop}/${filename}`
    case 'offer-image':
      return `${R2_PATHS.offers}/${input.destination === 'mobile' ? 'mobile' : 'hero'}/${filename}`
    case 'product-image':
      return `${input.destination === R2_PATHS.products ? input.destination : `${R2_PATHS.products}/uncategorized`}/${filename}`
    case 'order-document':
      return `${R2_PATHS.orderDocuments}/${(input.destination || 'unassigned').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)}/documents/${filename}`
  }
}
