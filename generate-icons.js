import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createAIFPNG(width, height, isMaskable = false) {
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: RGBA (6)
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Raw image scanlines
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineLength);

  const cx = width / 2;
  const cy = height / 2;
  const cornerRadius = width * (isMaskable ? 0 : 0.22);

  // Scale relative to 512 base
  const s = width / 512;

  function distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x1 - x2) ** 2 + (y1 - y2) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  // Define vector segments for 'AIF'
  // A: (125,330) -> (175,160) -> (225,330)
  const aLeft = [125 * s, 330 * s, 175 * s, 160 * s];
  const aRight = [175 * s, 160 * s, 225 * s, 330 * s];
  const aCross = [148 * s, 275 * s, 202 * s, 275 * s];

  // I: (256, 160) -> (256, 330), dot at (256, 138)
  const iStem = [256 * s, 160 * s, 256 * s, 330 * s];
  const iDot = [256 * s, 138 * s, 10 * s];

  // F: (295, 160) -> (295, 330), top (295, 174) -> (385, 174), mid (295, 242) -> (365, 242)
  const fStem = [295 * s, 160 * s, 295 * s, 330 * s];
  const fTop = [295 * s, 174 * s, 385 * s, 174 * s];
  const fMid = [295 * s, 242 * s, 365 * s, 242 * s];

  const letterThick = 13 * s;
  const thinThick = 8 * s;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter 0

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;

      const inBounds = isMaskable ? true : isInsideRoundedRect(x, y, width, height, cornerRadius);

      if (!inBounds) {
        rawData[pixelOffset] = 0;
        rawData[pixelOffset + 1] = 0;
        rawData[pixelOffset + 2] = 0;
        rawData[pixelOffset + 3] = 0;
        continue;
      }

      // Background Emerald Gradient
      const gradRatio = (x + y) / (width + height);
      const bgR = Math.round(6 + (16 - 6) * gradRatio);
      const bgG = Math.round(78 + (185 - 78) * gradRatio);
      const bgB = Math.round(59 + (129 - 59) * gradRatio);

      // Distances to AIF letters
      const dALeft = distToSegment(x, y, ...aLeft);
      const dARight = distToSegment(x, y, ...aRight);
      const dACross = distToSegment(x, y, ...aCross);

      const dIStem = distToSegment(x, y, ...iStem);
      const dIDot = Math.hypot(x - iDot[0], y - iDot[1]);

      const dFStem = distToSegment(x, y, ...fStem);
      const dFTop = distToSegment(x, y, ...fTop);
      const dFMid = distToSegment(x, y, ...fMid);

      const minWhiteDist = Math.min(dALeft, dARight, dIStem, dFStem, dFTop);
      const minGoldDist = Math.min(dACross, dFMid);

      // Gold elements: A crossbar, F middle bar, I dot
      if (dIDot <= iDot[2] || minGoldDist <= thinThick) {
        // Gold / Amber accent (#fbbf24 -> #f59e0b)
        rawData[pixelOffset] = 251;
        rawData[pixelOffset + 1] = 191;
        rawData[pixelOffset + 2] = 36;
        rawData[pixelOffset + 3] = 255;
      } else if (minWhiteDist <= letterThick) {
        // Crisp White letter stroke
        rawData[pixelOffset] = 255;
        rawData[pixelOffset + 1] = 255;
        rawData[pixelOffset + 2] = 255;
        rawData[pixelOffset + 3] = 255;
      } else {
        // Background with subtle circular halo
        const dCenter = Math.hypot(x - cx, y - cy);
        const haloRadius = 195 * s;
        if (Math.abs(dCenter - haloRadius) < 1.5 * s) {
          // Halo line
          rawData[pixelOffset] = Math.min(255, bgR + 40);
          rawData[pixelOffset + 1] = Math.min(255, bgG + 40);
          rawData[pixelOffset + 2] = Math.min(255, bgB + 40);
          rawData[pixelOffset + 3] = 255;
        } else {
          rawData[pixelOffset] = bgR;
          rawData[pixelOffset + 1] = bgG;
          rawData[pixelOffset + 2] = bgB;
          rawData[pixelOffset + 3] = 255;
        }
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function isInsideRoundedRect(x, y, w, h, r) {
  const pad = w * 0.03;
  const left = pad;
  const top = pad;
  const right = w - pad;
  const bottom = h - pad;

  if (x < left || x > right || y < top || y > bottom) return false;

  const innerLeft = left + r;
  const innerRight = right - r;
  const innerTop = top + r;
  const innerBottom = bottom - r;

  if (x >= innerLeft && x <= innerRight) return true;
  if (y >= innerTop && y <= innerBottom) return true;

  if (x < innerLeft && y < innerTop) {
    return Math.hypot(x - innerLeft, y - innerTop) <= r;
  }
  if (x > innerRight && y < innerTop) {
    return Math.hypot(x - innerRight, y - innerTop) <= r;
  }
  if (x < innerLeft && y > innerBottom) {
    return Math.hypot(x - innerLeft, y - innerBottom) <= r;
  }
  if (x > innerRight && y > innerBottom) {
    return Math.hypot(x - innerRight, y - innerBottom) <= r;
  }

  return true;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Standard CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write to public/
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createAIFPNG(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createAIFPNG(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createAIFPNG(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createAIFPNG(180, 180, false));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createAIFPNG(64, 64, false));

// Also write to root for fallback
fs.writeFileSync('pwa-192x192.png', createAIFPNG(192, 192, false));
fs.writeFileSync('pwa-512x512.png', createAIFPNG(512, 512, false));
fs.writeFileSync('pwa-maskable-512x512.png', createAIFPNG(512, 512, true));
fs.writeFileSync('apple-touch-icon.png', createAIFPNG(180, 180, false));
fs.writeFileSync('favicon.ico', createAIFPNG(64, 64, false));

console.log('All AIF PWA icons generated successfully!');
