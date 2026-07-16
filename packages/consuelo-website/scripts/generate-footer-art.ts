import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = join(packageRoot, 'public/images/home/holding-world.svg');
const outputPath = join(packageRoot, 'public/images/home/holding-world-editorial.png');
const badgePath = join(packageRoot, 'public/images/home/consuelo-footer-badge.png');
const renderSize = 1200;
const outputScale = 2;
const alphaThreshold = 8;
const closureRadius = 1;
const interiorRadius = 2;
const outputMargin = 12;

const render = await sharp(sourcePath)
  .resize(renderSize, renderSize, { fit: 'contain' })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = render.info;
if (channels !== 4) {
  throw new Error(`Expected RGBA source, received ${channels} channels`);
}

const ink = new Uint8Array(width * height);
let minX = width;
let minY = height;
let maxX = -1;
let maxY = -1;

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const pixelIndex = y * width + x;
    const alpha = render.data[pixelIndex * channels + 3];
    if (alpha <= alphaThreshold) {
      continue;
    }

    ink[pixelIndex] = 1;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
}

if (maxX < minX || maxY < minY) {
  throw new Error('The source artwork contains no visible pixels');
}

const dilate = (source: Uint8Array, radius: number) => {
  const horizontal = new Uint8Array(source.length);
  const output = new Uint8Array(source.length);

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    let count = 0;
    for (let sampleX = 0; sampleX <= radius && sampleX < width; sampleX += 1) {
      count += source[row + sampleX];
    }
    for (let x = 0; x < width; x += 1) {
      horizontal[row + x] = count > 0 ? 1 : 0;
      const removeX = x - radius;
      const addX = x + radius + 1;
      if (removeX >= 0) count -= source[row + removeX];
      if (addX < width) count += source[row + addX];
    }
  }

  for (let x = 0; x < width; x += 1) {
    let count = 0;
    for (let sampleY = 0; sampleY <= radius && sampleY < height; sampleY += 1) {
      count += horizontal[sampleY * width + x];
    }
    for (let y = 0; y < height; y += 1) {
      output[y * width + x] = count > 0 ? 1 : 0;
      const removeY = y - radius;
      const addY = y + radius + 1;
      if (removeY >= 0) count -= horizontal[removeY * width + x];
      if (addY < height) count += horizontal[addY * width + x];
    }
  }

  return output;
};

const erode = (source: Uint8Array, radius: number) => {
  const horizontal = new Uint8Array(source.length);
  const output = new Uint8Array(source.length);
  const windowSize = radius * 2 + 1;

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    let count = 0;
    for (let sampleX = 0; sampleX <= radius && sampleX < width; sampleX += 1) {
      count += source[row + sampleX];
    }
    for (let x = 0; x < width; x += 1) {
      horizontal[row + x] = count === windowSize ? 1 : 0;
      const removeX = x - radius;
      const addX = x + radius + 1;
      if (removeX >= 0) count -= source[row + removeX];
      if (addX < width) count += source[row + addX];
    }
  }

  for (let x = 0; x < width; x += 1) {
    let count = 0;
    for (let sampleY = 0; sampleY <= radius && sampleY < height; sampleY += 1) {
      count += horizontal[sampleY * width + x];
    }
    for (let y = 0; y < height; y += 1) {
      output[y * width + x] = count === windowSize ? 1 : 0;
      const removeY = y - radius;
      const addY = y + radius + 1;
      if (removeY >= 0) count -= horizontal[removeY * width + x];
      if (addY < height) count += horizontal[addY * width + x];
    }
  }

  return output;
};

const barrier = dilate(ink, closureRadius);
const inkInterior = erode(ink, interiorRadius);
const outside = new Uint8Array(width * height);
const queue = new Int32Array(width * height);
let queueStart = 0;
let queueEnd = 0;

const enqueue = (index: number) => {
  if (index < 0 || index >= outside.length || barrier[index] === 1 || outside[index] === 1) {
    return;
  }

  outside[index] = 1;
  queue[queueEnd] = index;
  queueEnd += 1;
};

for (let x = 0; x < width; x += 1) {
  enqueue(x);
  enqueue((height - 1) * width + x);
}
for (let y = 0; y < height; y += 1) {
  enqueue(y * width);
  enqueue(y * width + width - 1);
}

while (queueStart < queueEnd) {
  const index = queue[queueStart];
  queueStart += 1;
  const x = index % width;

  if (x > 0) enqueue(index - 1);
  if (x < width - 1) enqueue(index + 1);
  if (index >= width) enqueue(index - width);
  if (index < width * (height - 1)) enqueue(index + width);
}

const cropLeft = Math.max(0, minX - outputMargin);
const cropTop = Math.max(0, minY - outputMargin);
const cropRight = Math.min(width - 1, maxX + outputMargin);
const cropBottom = Math.min(height - 1, maxY + outputMargin);
const outputWidth = cropRight - cropLeft + 1;
const outputHeight = cropBottom - cropTop + 1;
const finalWidth = outputWidth * outputScale;
const finalHeight = outputHeight * outputScale;
const output = Buffer.alloc(outputWidth * outputHeight * 4);
const whiteInkRegions = [
  [
    [0.39, 0.49],
    [0.69, 0.45],
    [0.87, 0.55],
    [0.95, 0.86],
    [0.78, 1],
    [0.48, 0.98],
    [0.35, 0.74],
  ],
  [
    [0.36, 0.55],
    [0.58, 0.55],
    [0.64, 0.65],
    [0.55, 0.79],
    [0.39, 0.82],
    [0.3, 0.73],
    [0.31, 0.63],
  ],
  [
    [0.25, 0.66],
    [0.43, 0.65],
    [0.48, 0.74],
    [0.4, 0.84],
    [0.26, 0.82],
    [0.19, 0.73],
  ],
] as const;
const scalePoints = (region: (typeof whiteInkRegions)[number]) =>
  region
    .map(([x, y]) => `${Math.round(x * outputWidth)},${Math.round(y * outputHeight)}`)
    .join(' ');
const whiteRegionSvg = Buffer.from(`
  <svg width="${outputWidth}" height="${outputHeight}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#000000" />
    ${whiteInkRegions.map((region) => `<polygon points="${scalePoints(region)}" fill="#FFFFFF" />`).join('')}
    <ellipse
      cx="${Math.round(outputWidth * 0.275)}"
      cy="${Math.round(outputHeight * 0.61)}"
      rx="${Math.round(outputWidth * 0.19)}"
      ry="${Math.round(outputHeight * 0.17)}"
      fill="#000000"
    />
  </svg>
`);
const whiteRegionMask = await sharp(whiteRegionSvg)
  .greyscale()
  .raw()
  .toBuffer();
let bluePixels = 0;
let whitePixels = 0;
let whitenedInkPixels = 0;

for (let y = 0; y < outputHeight; y += 1) {
  for (let x = 0; x < outputWidth; x += 1) {
    const sourceX = cropLeft + x;
    const sourceY = cropTop + y;
    const sourceIndex = sourceY * width + sourceX;
    const sourceOffset = sourceIndex * channels;
    const outputOffset = (y * outputWidth + x) * 4;
    const alpha = render.data[sourceOffset + 3];

    if (alpha > alphaThreshold) {
      const whiteInk =
        inkInterior[sourceIndex] === 1 &&
        whiteRegionMask[y * outputWidth + x] > 128;
      output[outputOffset] = whiteInk ? 255 : render.data[sourceOffset];
      output[outputOffset + 1] = whiteInk ? 255 : render.data[sourceOffset + 1];
      output[outputOffset + 2] = whiteInk ? 255 : render.data[sourceOffset + 2];
      output[outputOffset + 3] = alpha;
      if (whiteInk) {
        whitePixels += 1;
        whitenedInkPixels += 1;
      } else {
        bluePixels += 1;
      }
      continue;
    }

    if (outside[sourceIndex] === 0) {
      output[outputOffset] = 255;
      output[outputOffset + 1] = 255;
      output[outputOffset + 2] = 255;
      output[outputOffset + 3] = 255;
      whitePixels += 1;
    }
  }
}

await mkdir(dirname(outputPath), { recursive: true });
await sharp(output, {
  raw: {
    width: outputWidth,
    height: outputHeight,
    channels: 4,
  },
})
  .resize(finalWidth, finalHeight, { kernel: sharp.kernel.lanczos3 })
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

const badgeCrop = await sharp(output, {
  raw: {
    width: outputWidth,
    height: outputHeight,
    channels: 4,
  },
})
  .extract({
    left: Math.round(outputWidth * 0.12),
    top: Math.round(outputHeight * 0.04),
    width: Math.round(outputWidth * 0.76),
    height: Math.round(outputHeight * 0.78),
  })
  .resize(226, 286, {
    fit: 'contain',
    background: { r: 255, g: 255, b: 255, alpha: 0 },
  })
  .png()
  .toBuffer();

const badgeOverlay = Buffer.from(`
  <svg width="242" height="346" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="238" height="342" fill="none" stroke="#0000F2" stroke-width="4" />
    <rect x="4" y="4" width="234" height="25" fill="#FFFFFF" />
    <text x="121" y="20" fill="#0000F2" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" font-weight="700" letter-spacing="1.5" text-anchor="middle">CONSUELO</text>
    <rect x="4" y="315" width="234" height="27" fill="#FFFFFF" fill-opacity="0.96" />
    <text x="121" y="335" fill="#0000F2" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="15" font-weight="700" letter-spacing="2" text-anchor="middle">OS</text>
  </svg>
`);

await sharp({
  create: {
    width: 242,
    height: 346,
    channels: 4,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  },
})
  .composite([
    { input: badgeCrop, left: 8, top: 29 },
    { input: badgeOverlay, left: 0, top: 0 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(badgePath);

process.stdout.write(
  JSON.stringify(
    {
      sourcePath,
      outputPath,
      badgePath,
      width: finalWidth,
      height: finalHeight,
      bluePixels,
      whitePixels,
      whitenedInkPixels,
      closureRadius,
      interiorRadius,
      outputScale,
    },
    null,
    2,
  ) + '\n',
);
