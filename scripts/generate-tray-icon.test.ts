import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  alphaSilhouette,
  decodePng,
  downscaleAlpha,
  encodePNG,
  keyOutBackground
} from './generate-tray-icon.cjs'

// 2x2 RGBA fixture: left column opaque (red / green — "duck" colours), right column transparent.
function masterRgba(): Buffer {
  const px = Buffer.alloc(2 * 2 * 4)
  const set = (x: number, y: number, r: number, g: number, b: number, a: number) => {
    const i = (y * 2 + x) * 4
    px[i] = r
    px[i + 1] = g
    px[i + 2] = b
    px[i + 3] = a
  }
  set(0, 0, 255, 0, 0, 255)
  set(0, 1, 0, 200, 50, 255)
  return px // x=1 stays all-zero (transparent)
}

function alphaAt(img: { width: number; rgba: Buffer }, x: number, y: number): number {
  return img.rgba[(y * img.width + x) * 4 + 3]
}

describe('png encode/decode round-trip', () => {
  it('decodes back the exact pixels it encoded', () => {
    const rgba = masterRgba()
    const decoded = decodePng(encodePNG(2, rgba))
    expect(decoded.width).toBe(2)
    expect(decoded.height).toBe(2)
    expect(Buffer.compare(decoded.rgba, rgba)).toBe(0)
  })
})

describe('alphaSilhouette', () => {
  it('turns every pixel black and keeps the alpha channel', () => {
    const out = alphaSilhouette(masterRgba())
    // left column: was coloured -> now black, alpha untouched
    expect([out[0], out[1], out[2]]).toEqual([0, 0, 0])
    expect(out[3]).toBe(255)
    expect([out[8], out[9], out[10]]).toEqual([0, 0, 0])
    expect(out[11]).toBe(255)
    // right column: untouched alpha (still transparent)
    expect([out[4], out[5], out[6], out[7]]).toEqual([0, 0, 0, 0])
  })
})

describe('keyOutBackground', () => {
  it('drops bluish sky pixels but keeps warm duck pixels', () => {
    // one sky pixel, one duck pixel, one cloud pixel (near-white, slightly blue)
    const rgba = Buffer.from([104, 184, 248, 255, 200, 104, 72, 255, 219, 234, 254, 255])
    const out = keyOutBackground(rgba)
    expect(out[3]).toBe(0) // sky blue -> removed
    expect(out[7]).toBe(255) // rust brown (duck) stays
    expect(out[11]).toBe(0) // pale blue-white (cloud) goes too
  })
})

describe('downscaleAlpha', () => {
  it('box-averages the alpha channel and outputs black pixels', () => {
    const S = 4
    const rgba = Buffer.alloc(S * S * 4)
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) rgba[(y * S + x) * 4 + 3] = x < 2 ? 255 : 0
    const out = downscaleAlpha(rgba, S, S, 2)
    expect(out.length).toBe(2 * 2 * 4)
    // every pixel is black; alpha keeps the left/right split
    for (let p = 0; p < 4; p++) expect([out[p * 4], out[p * 4 + 1], out[p * 4 + 2]]).toEqual([0, 0, 0])
    expect(out[3]).toBe(255) // (0,0)
    expect(out[7]).toBe(0) // (1,0)
    expect(out[11]).toBe(255) // (0,1)
    expect(out[15]).toBe(0) // (1,1)
  })
})

describe('tray icon generation (end-to-end)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tray-icon-'))
  const outDir = join(dir, 'out')
  const masterPath = join(dir, 'icon-master.png')

  beforeAll(() => {
    // 64x64 master shaped like the real artwork: warm "duck" on the left half,
    // sky-blue background tile everywhere else.
    const S = 64
    const px = Buffer.alloc(S * S * 4)
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4
        px[i + 3] = 255
        if (x < S / 2) {
          px[i] = 240 // warm orange duck body
          px[i + 1] = 120
          px[i + 2] = 40
        } else {
          px[i] = 104 // sky blue background tile
          px[i + 1] = 184
          px[i + 2] = 248
        }
      }
    writeFileSync(masterPath, encodePNG(S, px))
  })

  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('derives 18px + 36px silhouettes of the duck from the master art', () => {
    execFileSync('node', ['scripts/generate-tray-icon.cjs', outDir, masterPath])
    const small = decodePng(readFileSync(join(outDir, 'iconTemplate.png')))
    const big = decodePng(readFileSync(join(outDir, 'iconTemplate@2x.png')))
    expect(small.width).toBe(18)
    expect(small.height).toBe(18)
    expect(big.width).toBe(36)
    expect(big.height).toBe(36)
    // the duck half is opaque black, the sky half is fully transparent
    expect(alphaAt(small, 2, 9)).toBe(255)
    expect(small.rgba[0]).toBe(0)
    expect(small.rgba[1]).toBe(0)
    expect(small.rgba[2]).toBe(0)
    expect(alphaAt(small, 14, 9)).toBeLessThan(60)
    expect(alphaAt(big, 4, 18)).toBe(255)
    expect(alphaAt(big, 30, 18)).toBeLessThan(60)
  })

  it('falls back to the placeholder duck when the master art is unreadable', () => {
    execFileSync('node', ['scripts/generate-tray-icon.cjs', outDir, join(dir, 'nope.png')])
    expect(readFileSync(join(outDir, 'iconTemplate.png')).length).toBeGreaterThan(0)
    expect(readFileSync(join(outDir, 'iconTemplate@2x.png')).length).toBeGreaterThan(0)
  })
})
