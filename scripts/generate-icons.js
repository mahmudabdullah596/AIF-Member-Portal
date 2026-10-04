import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(width, height, isMaskable = false) {
  // Simple uncompressed/deflated raw RGBA PNG generator
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
  // Each scanline begins with filter byte (0) followed by width * 4 bytes RGBA
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineLength);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * (isMaskable ? 0.48 : 0.42);
  const innerRadius = width * (isMaskable ? 0.36 : 0.32);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter 0 (None)

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Emerald background: #059669 -> #047857
      const bgR = Math.round(5 + (4 - 5) * (y / height));
      const bgG = Math.round(150 + (120 - 150) * (y / height));
      const bgB = Math.round(105 + (87 - 105) * (y / height));

      if (isMaskable) {
        // Full bleed background
        // Center icon (white stylized chart / crescent upward arrow)
        if (dist <= innerRadius) {
          // Inside emblem circle - lighter emerald
          const inEmblem = (dx > -innerRadius * 0.5 && dx < innerRadius * 0.5 && dy > -innerRadius * 0.5 && dy < innerRadius * 0.5);
          if (inEmblem && (Math.abs(dx + dy * 0.5) < innerRadius * 0.2 || (dy < -innerRadius * 0.1 && Math.abs(dx) < innerRadius * 0.3))) {
            // White icon
            rawData[pixelOffset] = 255;
            rawData[pixelOffset + 1] = 255;
            rawData[pixelOffset + 2] = 255;
            rawData[pixelOffset + 3] = 255;
          } else {
            // Emerald emblem
            rawData[pixelOffset] = 16;
            rawData[pixelOffset + 1] = 185;
            rawData[pixelOffset + 2] = 129;
            rawData[pixelOffset + 3] = 255;
          }
        } else {
          rawData[pixelOffset] = bgR;
          rawData[pixelOffset + 1] = bgG;
          rawData[pixelOffset + 2] = bgB;
          rawData[pixelOffset + 3] = 255;
        }
      } else {
        // Rounded app icon with safe margin
        const cornerRadius = width * 0.22;
        const inRoundedRect = isInsideRoundedRect(x, y, width, height, cornerRadius);

        if (inRoundedRect) {
          // Inside rounded rect
          if (dist <= innerRadius && (Math.abs(dx + dy * 0.5) < innerRadius * 0.25 || (dy < -innerRadius * 0.1 && Math.abs(dx) < innerRadius * 0.35))) {
            // White symbol
            rawData[pixelOffset] = 255;
            rawData[pixelOffset + 1] = 255;
            rawData[pixelOffset + 2] = 255;
            rawData[pixelOffset + 3] = 255;
          } else {
            rawData[pixelOffset] = bgR;
            rawData[pixelOffset + 1] = bgG;
            rawData[pixelOffset + 2] = bgB;
            rawData[pixelOffset + 3] = 255;
          }
        } else {
          // Transparent
          rawData[pixelOffset] = 0;
          rawData[pixelOffset + 1] = 0;
          rawData[pixelOffset + 2] = 0;
          rawData[pixelOffset + 3] = 0;
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
  const pad = w * 0.04;
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

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPNG(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPNG(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPNG(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPNG(180, 180, false));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPNG(64, 64, false));

console.log('All PWA PNG icons generated successfully in /public!');
