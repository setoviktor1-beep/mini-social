import sharp from 'sharp'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_IMAGE_PIXELS = 40_000_000
const MAX_IMAGE_PAGES = 100

const formatByContentType = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
} as const

type AllowedContentType = keyof typeof formatByContentType

export const allowedImageContentTypes = new Set<AllowedContentType>(
  Object.keys(formatByContentType) as AllowedContentType[],
)

export async function sanitizeImageUpload(
  input: Uint8Array | Buffer,
  contentType: string,
) {
  if (
    !allowedImageContentTypes.has(contentType as AllowedContentType) ||
    input.byteLength === 0 ||
    input.byteLength > MAX_IMAGE_BYTES
  ) {
    throw new Error('INVALID_IMAGE')
  }

  const expectedFormat =
    formatByContentType[contentType as AllowedContentType]
  const image = sharp(input, {
    animated: true,
    failOn: 'warning',
    limitInputPixels: MAX_IMAGE_PIXELS,
  })
  const metadata = await image.metadata()

  if (
    metadata.format !== expectedFormat ||
    !metadata.width ||
    !metadata.height ||
    (metadata.pages || 1) > MAX_IMAGE_PAGES
  ) {
    throw new Error('INVALID_IMAGE')
  }

  const rotated = image.rotate()
  let output: Buffer

  switch (expectedFormat) {
    case 'jpeg':
      output = await rotated.jpeg({ quality: 88, mozjpeg: true }).toBuffer()
      break
    case 'png':
      output = await rotated.png({ compressionLevel: 9 }).toBuffer()
      break
    case 'webp':
      output = await rotated.webp({ quality: 86 }).toBuffer()
      break
    case 'gif':
      output = await rotated.gif({ effort: 5 }).toBuffer()
      break
  }

  if (output.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('IMAGE_TOO_LARGE')
  }

  return {
    body: output,
    contentType: contentType as AllowedContentType,
    extension: expectedFormat === 'jpeg' ? 'jpg' : expectedFormat,
  }
}
