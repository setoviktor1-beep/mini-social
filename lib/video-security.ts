// Server-side video upload validation.
//
// Unlike images (lib/image-security.ts), we do not re-encode/re-mux video
// server-side — there is no ffmpeg (or any video-processing) dependency in
// this project, and adding one is a production Docker-image/infra change
// outside the scope of "validate an upload," so it's deliberately not done
// here. What we *do* is the practical equivalent of image-security's
// "decode and check it's really what it claims to be": read each format's
// real container signature (magic bytes) instead of trusting the client's
// declared Content-Type, and — for MP4, the primary supported format —
// parse the actual container duration out of the moov/mvhd box rather than
// trusting anything the client sends. This catches MIME-spoofed and
// arbitrarily-relabeled files without needing to fully decode video frames.

const MAX_VIDEO_BYTES = 50 * 1024 * 1024 // 50MB
const MAX_VIDEO_DURATION_SECONDS = 120 // 2 minutes

export const allowedVideoContentTypes = new Set(['video/mp4', 'video/webm'] as const)
export type AllowedVideoContentType = 'video/mp4' | 'video/webm'

class InvalidVideoError extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'InvalidVideoError'
  }
}

function bytesEqual(buf: Uint8Array, offset: number, expected: number[]): boolean {
  if (offset + expected.length > buf.length) return false
  for (let i = 0; i < expected.length; i++) {
    if (buf[offset + i] !== expected[i]) return false
  }
  return true
}

// MP4/ISO-BMFF: the file starts with a box whose 4-byte size is followed by
// a 4-byte type. A real MP4 always has an 'ftyp' box at (or very near) the
// start — ftyp's ASCII bytes at offset 4 is the standard signature check
// used by file-type sniffers.
function isMp4Signature(buf: Uint8Array): boolean {
  return bytesEqual(buf, 4, [0x66, 0x74, 0x79, 0x70]) // "ftyp"
}

// WebM (Matroska/EBML) always starts with the EBML magic number.
function isWebmSignature(buf: Uint8Array): boolean {
  return bytesEqual(buf, 0, [0x1a, 0x45, 0xdf, 0xa3])
}

// Minimal ISO-BMFF box walker: every box is [4-byte big-endian size][4-byte
// type][payload]. A size of 0 means "rest of file"; a size of 1 means a
// 64-bit size follows (the "largesize" extension) — both are handled so a
// deliberately malformed box can't desync the walk into an infinite loop.
function walkBoxes(buf: Uint8Array, start: number, end: number): { type: string; start: number; end: number }[] {
  const boxes: { type: string; start: number; end: number }[] = []
  let offset = start
  while (offset + 8 <= end) {
    const size32 = new DataView(buf.buffer, buf.byteOffset + offset, 4).getUint32(0)
    const type = String.fromCharCode(buf[offset + 4], buf[offset + 5], buf[offset + 6], buf[offset + 7])
    let headerSize = 8
    let boxSize: number
    if (size32 === 1) {
      if (offset + 16 > end) break
      const high = new DataView(buf.buffer, buf.byteOffset + offset + 8, 4).getUint32(0)
      const low = new DataView(buf.buffer, buf.byteOffset + offset + 12, 4).getUint32(0)
      boxSize = high * 2 ** 32 + low
      headerSize = 16
    } else if (size32 === 0) {
      boxSize = end - offset
    } else {
      boxSize = size32
    }
    if (boxSize < headerSize || offset + boxSize > end) break
    boxes.push({ type, start: offset + headerSize, end: offset + boxSize })
    offset += boxSize
  }
  return boxes
}

// Walks moov -> mvhd to read the container's declared duration. Returns
// null (not a hard failure) if the structure isn't found within the
// scanned prefix — some encoders place moov at the end of the file after
// mdat, and we deliberately only scan a bounded prefix (see
// MAX_SCAN_BYTES below) rather than buffering/seeking through an entire
// up-to-50MB upload just to find a trailing moov. In that case duration is
// simply not enforced for this specific file layout — signature and size
// limits still apply regardless.
function readMp4DurationSeconds(buf: Uint8Array): number | null {
  for (const top of walkBoxes(buf, 0, buf.length)) {
    if (top.type !== 'moov') continue
    for (const child of walkBoxes(buf, top.start, top.end)) {
      if (child.type !== 'mvhd') continue
      const view = new DataView(buf.buffer, buf.byteOffset + child.start, child.end - child.start)
      const version = view.getUint8(0)
      if (version === 1) {
        // version(1) + flags(3) + creation(8) + modification(8) = 20, then
        // timescale(4) + duration(8)
        if (view.byteLength < 32) return null
        const timescale = view.getUint32(20)
        const high = view.getUint32(24)
        const low = view.getUint32(28)
        const duration = high * 2 ** 32 + low
        if (!timescale) return null
        return duration / timescale
      }
      // version 0: version(1)+flags(3)+creation(4)+modification(4) = 12,
      // then timescale(4) + duration(4)
      if (view.byteLength < 20) return null
      const timescale = view.getUint32(12)
      const duration = view.getUint32(16)
      if (!timescale) return null
      return duration / timescale
    }
    return null
  }
  return null
}

// Bounded prefix scan for moov/mvhd — see readMp4DurationSeconds's comment.
// Applied to a copy of at most this many bytes so a pathological box-size
// value can't make the walker scan past what's actually been read either.
const MAX_SCAN_BYTES = 8 * 1024 * 1024

export async function sanitizeVideoUpload(
  input: Uint8Array | Buffer,
  contentType: string,
): Promise<{ body: Uint8Array | Buffer; contentType: AllowedVideoContentType; extension: string }> {
  if (!allowedVideoContentTypes.has(contentType as AllowedVideoContentType)) {
    throw new InvalidVideoError('UNSUPPORTED_CONTENT_TYPE')
  }
  if (input.byteLength === 0 || input.byteLength > MAX_VIDEO_BYTES) {
    throw new InvalidVideoError('INVALID_SIZE')
  }

  const buf = input instanceof Uint8Array ? input : new Uint8Array(input)

  if (contentType === 'video/mp4') {
    if (!isMp4Signature(buf)) throw new InvalidVideoError('SIGNATURE_MISMATCH')
    const scanBuf = buf.length > MAX_SCAN_BYTES ? buf.subarray(0, MAX_SCAN_BYTES) : buf
    const duration = readMp4DurationSeconds(scanBuf)
    if (duration !== null && duration > MAX_VIDEO_DURATION_SECONDS) {
      throw new InvalidVideoError('VIDEO_TOO_LONG')
    }
    return { body: input, contentType: 'video/mp4', extension: 'mp4' }
  }

  // video/webm: signature-only. A full EBML walk to the Segment/Info
  // Duration element is meaningfully more complex than ISO-BMFF's flat box
  // structure (variable-length IDs and sizes) — not implemented here.
  // Still gated by the signature check and the shared size limit; duration
  // is enforced client-side (see PostComposer's addVideo) as a UX
  // safeguard, not a security boundary, for this format specifically.
  if (!isWebmSignature(buf)) throw new InvalidVideoError('SIGNATURE_MISMATCH')
  return { body: input, contentType: 'video/webm', extension: 'webm' }
}

export { MAX_VIDEO_BYTES, MAX_VIDEO_DURATION_SECONDS, InvalidVideoError }
