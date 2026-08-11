// Unit tests for lib/video-security.ts's sanitizeVideoUpload().
//
// Run with: npx tsx --test tests/unit/video-security.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeVideoUpload, MAX_VIDEO_BYTES } from '../../lib/video-security'

function u32be(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]
}

function asciiBytes(s: string): number[] {
  return Array.from(s).map((c) => c.charCodeAt(0))
}

// Builds a minimal (not spec-complete, but structurally valid for our
// parser) MP4 buffer: an 'ftyp' box followed by a 'moov' box containing an
// 'mvhd' (version 0) box with the given timescale/duration.
function buildMp4(opts: { timescale: number; duration: number; extraTail?: number[] }): Uint8Array {
  const ftyp = [...u32be(16), ...asciiBytes('ftyp'), ...asciiBytes('isom'), 0, 0, 0, 0]
  const mvhdPayload = [
    0, 0, 0, 0, // version(0) + flags(3)
    ...u32be(0), // creation_time
    ...u32be(0), // modification_time
    ...u32be(opts.timescale),
    ...u32be(opts.duration),
  ]
  const mvhd = [...u32be(8 + mvhdPayload.length), ...asciiBytes('mvhd'), ...mvhdPayload]
  const moov = [...u32be(8 + mvhd.length), ...asciiBytes('moov'), ...mvhd]
  return new Uint8Array([...ftyp, ...moov, ...(opts.extraTail || [])])
}

function buildWebm(): Uint8Array {
  return new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 1, 2, 3, 4])
}

test('accepts a valid MP4 within the duration limit', async () => {
  const buf = buildMp4({ timescale: 1000, duration: 30_000 }) // 30s
  const result = await sanitizeVideoUpload(buf, 'video/mp4')
  assert.equal(result.contentType, 'video/mp4')
  assert.equal(result.extension, 'mp4')
});

test('rejects an MP4 longer than the duration limit', async () => {
  const buf = buildMp4({ timescale: 1000, duration: 121_000 }) // 121s > 120s cap
  await assert.rejects(() => sanitizeVideoUpload(buf, 'video/mp4'), /InvalidVideoError|VIDEO_TOO_LONG/);
});

test('rejects a file with no ftyp signature even when labeled video/mp4 (spoofed MIME)', async () => {
  // A PNG signature, not an MP4 one — same "declared type doesn't match
  // actual bytes" spoofing this module exists to catch.
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(20).fill(0)]);
  await assert.rejects(() => sanitizeVideoUpload(png, 'video/mp4'), /InvalidVideoError|SIGNATURE_MISMATCH/);
});

test('rejects an unsupported content type', async () => {
  const buf = buildMp4({ timescale: 1000, duration: 1000 });
  await assert.rejects(() => sanitizeVideoUpload(buf, 'video/quicktime'), /InvalidVideoError|UNSUPPORTED_CONTENT_TYPE/);
});

test('rejects an oversized file', async () => {
  const big = new Uint8Array(MAX_VIDEO_BYTES + 1);
  await assert.rejects(() => sanitizeVideoUpload(big, 'video/mp4'), /InvalidVideoError|INVALID_SIZE/);
});

test('rejects an empty file', async () => {
  await assert.rejects(() => sanitizeVideoUpload(new Uint8Array(0), 'video/mp4'), /InvalidVideoError|INVALID_SIZE/);
});

test('accepts a valid WebM signature', async () => {
  const result = await sanitizeVideoUpload(buildWebm(), 'video/webm');
  assert.equal(result.contentType, 'video/webm');
  assert.equal(result.extension, 'webm');
});

test('rejects a file with no EBML signature even when labeled video/webm (spoofed MIME)', async () => {
  const notWebm = new Uint8Array([0, 0, 0, 0, 1, 2, 3, 4]);
  await assert.rejects(() => sanitizeVideoUpload(notWebm, 'video/webm'), /InvalidVideoError|SIGNATURE_MISMATCH/);
});

test('a malformed/truncated MP4 box does not hang or crash the parser (bounded walk)', async () => {
  // ftyp claims a huge box size that extends past the actual buffer —
  // the box walker must stop rather than read out of bounds or loop.
  const malformed = new Uint8Array([...u32be(0xffffffff), ...asciiBytes('ftyp'), 1, 2, 3, 4]);
  // No mvhd found within the malformed structure -> duration simply isn't
  // enforced for this file, but validation must complete (not hang) and
  // must not throw an unrelated (e.g. out-of-bounds) error.
  const result = await sanitizeVideoUpload(malformed, 'video/mp4');
  assert.equal(result.contentType, 'video/mp4');
});
