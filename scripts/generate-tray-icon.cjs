// Generates the menu-bar / tray icons as proper PNG files, with no external
// dependencies. The icons are a monochrome silhouette of the real app artwork:
// build/icon-master.png (the same source of truth as build/icon.png) is decoded,
// downscaled and reduced to its alpha channel, so tray and Dock show the same
// duck-plane. If the master art is missing, a procedural placeholder duck is
// drawn instead, so a fresh checkout still gets a working tray icon.
//
// Usage: node scripts/generate-tray-icon.cjs [outDir] [masterPath]
const zlib = require('node:zlib')
const fs = require('node:fs')
const path = require('node:path')

const TRAY_SIZES = [18, 36] // 1x and @2x menu-bar sizes

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type RGBA
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

/** Decodes an 8-bit, non-interlaced RGBA (colour type 6) PNG into pixels. */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG file')
  let off = 8
  let width = 0
  let height = 0
  const idats = []
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('ascii', off + 4, off + 8)
    const data = buf.subarray(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0)
        throw new Error(`unsupported PNG (bit depth ${data[8]}, colour type ${data[9]}, interlace ${data[12]})`)
    } else if (type === 'IDAT') {
      idats.push(data)
    } else if (type === 'IEND') {
      break
    }
    off += 12 + len
  }
  if (!width || !height || !idats.length) throw new Error('PNG is missing IHDR or IDAT chunks')

  const stride = width * 4
  const raw = zlib.inflateSync(Buffer.concat(idats))
  const px = Buffer.alloc(stride * height)
  let inOff = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[inOff]
    inOff++
    const rowStart = y * stride
    for (let x = 0; x < stride; x++) {
      const cur = raw[inOff + x]
      const left = x >= 4 ? px[rowStart + x - 4] : 0
      const up = y > 0 ? px[rowStart - stride + x] : 0
      const upLeft = y > 0 && x >= 4 ? px[rowStart - stride + x - 4] : 0
      let val
      if (filter === 0) val = cur
      else if (filter === 1) val = cur + left // Sub
      else if (filter === 2) val = cur + up // Up
      else if (filter === 3) val = cur + ((left + up) >> 1) // Average
      else val = cur + paeth(left, up, upLeft) // Paeth
      px[rowStart + x] = val & 255
    }
    inOff += stride
  }
  return { width, height, rgba: px }
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

/** Strips colour: every pixel becomes black, the alpha channel is kept as-is. */
function alphaSilhouette(rgba) {
  const out = Buffer.from(rgba)
  for (let i = 0; i < out.length; i += 4) {
    out[i] = 0
    out[i + 1] = 0
    out[i + 2] = 0
  }
  return out
}

/**
 * The master artwork paints the duck on an opaque sky-blue tile (with painted
 * clouds), so its plain alpha is just the tile's rounded square. Key out that
 * background: anything distinctly bluish (blue far above red) is sky/cloud and
 * becomes transparent, leaving only the warm-coloured duck itself.
 */
function keyOutBackground(rgba, threshold = 32) {
  const out = Buffer.from(rgba)
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] > 0 && out[i + 2] - out[i] > threshold) out[i + 3] = 0
  }
  return out
}

/** Box-filter downscale to a size×size black RGBA silhouette. */
function downscaleAlpha(rgba, width, height, size) {
  const out = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    const y0 = Math.floor((y * height) / size)
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * height) / size))
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor((x * width) / size)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * width) / size))
      let sum = 0
      let n = 0
      for (let sy = y0; sy < y1 && sy < height; sy++) {
        for (let sx = x0; sx < x1 && sx < width; sx++) {
          sum += rgba[(sy * width + sx) * 4 + 3]
          n++
        }
      }
      const i = (y * size + x) * 4
      out[i + 3] = n ? Math.round(sum / n) : 0
    }
  }
  return out
}

function inEllipse(u, v, cx, cy, rx, ry) {
  const dx = (u - cx) / rx
  const dy = (v - cy) / ry
  return dx * dx + dy * dy <= 1
}

// Placeholder only: used when build/icon-master.png is absent.
function drawDuck(size) {
  const buf = Buffer.alloc(size * size * 4) // transparent
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size
      const v = (y + 0.5) / size
      const inside =
        inEllipse(u, v, 0.45, 0.66, 0.34, 0.23) || // body
        inEllipse(u, v, 0.69, 0.4, 0.17, 0.17) || // head
        inEllipse(u, v, 0.87, 0.42, 0.07, 0.04) // beak
      if (inside) {
        const i = (y * size + x) * 4
        buf[i + 3] = 255
      }
    }
  }
  return buf
}

/** Tray PNGs derived from the master artwork (duck silhouette on the sky tile). */
function iconsFromMaster(masterPath) {
  const master = decodePng(fs.readFileSync(masterPath))
  const duck = alphaSilhouette(keyOutBackground(master.rgba))
  const icons = new Map()
  for (const size of TRAY_SIZES) {
    icons.set(size, encodePNG(size, downscaleAlpha(duck, master.width, master.height, size)))
  }
  return icons
}

/** Placeholder icons when there is no master artwork to trace. */
function fallbackIcons() {
  const icons = new Map()
  for (const size of TRAY_SIZES) icons.set(size, encodePNG(size, drawDuck(size)))
  return icons
}

function generateIcons(masterPath, outDir) {
  let icons
  if (fs.existsSync(masterPath)) {
    try {
      icons = iconsFromMaster(masterPath)
      console.log(`Wrote tray icons from ${masterPath}`)
    } catch (err) {
      console.warn(`Could not use ${masterPath} (${err.message}); drawing placeholder`)
      icons = fallbackIcons()
    }
  } else {
    console.log('No master artwork found; drawing the placeholder duck')
    icons = fallbackIcons()
  }
  fs.mkdirSync(outDir, { recursive: true })
  for (const [size, png] of icons) {
    const name = size === TRAY_SIZES[0] ? 'iconTemplate.png' : `iconTemplate@${size / TRAY_SIZES[0]}x.png`
    fs.writeFileSync(path.join(outDir, name), png)
  }
}

module.exports = { alphaSilhouette, decodePng, downscaleAlpha, encodePNG, keyOutBackground }

if (require.main === module) {
  const outDir = process.argv[2] || path.join(__dirname, '..', 'build')
  const masterPath = process.argv[3] || path.join(__dirname, '..', 'build', 'icon-master.png')
  generateIcons(masterPath, outDir)
}
