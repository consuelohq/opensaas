import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = join(packageRoot, 'public/images/home/holding-world.svg');
const bodyFillMaskPath = join(packageRoot, 'public/images/home/holding-world-body-fill-mask.svg');
const fillMaskPath = join(packageRoot, 'public/images/home/holding-world-white-fill-mask.svg');
const outputPath = join(packageRoot, 'public/generated/holding-world-editorial.png');
const badgePath = join(packageRoot, 'public/generated/consuelo-footer-badge.png');
const renderSize = 1200;
const outputScale = 2;
const alphaThreshold = 8;
const closureRadius = 1;
const bodyClosureRadius = 5;
const interiorRadius = 3;
const cleanInteriorRadius = 2;
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

const inkInterior = erode(ink, interiorRadius);
const floodOutside = (barrier: Uint8Array) => {
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

  return outside;
};

const detailOutside = floodOutside(dilate(ink, closureRadius));
const bodyOutside = floodOutside(dilate(ink, bodyClosureRadius));

const cropLeft = Math.max(0, minX - outputMargin);
const cropTop = Math.max(0, minY - outputMargin);
const cropRight = Math.min(width - 1, maxX + outputMargin);
const cropBottom = Math.min(height - 1, maxY + outputMargin);
const outputWidth = cropRight - cropLeft + 1;
const outputHeight = cropBottom - cropTop + 1;
const finalWidth = outputWidth * outputScale;
const finalHeight = outputHeight * outputScale;
const output = Buffer.alloc(outputWidth * outputHeight * 4);
const renderFillMask = (path: string) =>
  sharp(path)
    .resize(outputWidth, outputHeight, { fit: 'fill' })
    .greyscale()
    .removeAlpha()
    .raw()
    .toBuffer();
const [bodyRegionMask, cleanWhiteRegionMask] = await Promise.all([
  renderFillMask(bodyFillMaskPath),
  renderFillMask(fillMaskPath),
]);
const bodyShape = new Uint8Array(width * height);
for (let index = 0; index < bodyShape.length; index += 1) {
  bodyShape[index] = bodyOutside[index] === 0 ? 1 : 0;
}
const cleanBodyInterior = erode(bodyShape, cleanInteriorRadius);
const bodyUnderlayMask = new Uint8Array(outputWidth * outputHeight);

for (let y = 0; y < outputHeight; y += 1) {
  for (let x = 0; x < outputWidth; x += 1) {
    const sourceX = cropLeft + x;
    const sourceY = cropTop + y;
    const sourceIndex = sourceY * width + sourceX;
    const outputIndex = y * outputWidth + x;
    const inBodyRegion = bodyRegionMask[outputIndex] > 128;

    if (inBodyRegion && bodyOutside[sourceIndex] === 0) {
      bodyUnderlayMask[outputIndex] = 1;
    }
  }
}
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
    const outputIndex = y * outputWidth + x;
    const alpha = render.data[sourceOffset + 3];
    const inBodyRegion = bodyRegionMask[outputIndex] > 128;
    const forceCleanWhite =
      cleanWhiteRegionMask[outputIndex] > 128 && cleanBodyInterior[sourceIndex] === 1;
    const hasWhiteUnderlay =
      bodyUnderlayMask[outputIndex] === 1 || detailOutside[sourceIndex] === 0;

    if (forceCleanWhite) {
      output[outputOffset] = 255;
      output[outputOffset + 1] = 255;
      output[outputOffset + 2] = 255;
      output[outputOffset + 3] = 255;
      whitePixels += 1;
      continue;
    }

    if (hasWhiteUnderlay) {
      output[outputOffset] = 255;
      output[outputOffset + 1] = 255;
      output[outputOffset + 2] = 255;
      output[outputOffset + 3] = 255;
      whitePixels += 1;
    }

    if (alpha > alphaThreshold) {
      const whiteInk = inBodyRegion && inkInterior[sourceIndex] === 1;
      if (whiteInk) {
        whitenedInkPixels += 1;
      } else {
        output[outputOffset] = render.data[sourceOffset];
        output[outputOffset + 1] = render.data[sourceOffset + 1];
        output[outputOffset + 2] = render.data[sourceOffset + 2];
        output[outputOffset + 3] = alpha;
        bluePixels += 1;
      }
      continue;
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
    left: Math.round(outputWidth * 0.34),
    top: Math.round(outputHeight * 0.04),
    width: Math.round(outputWidth * 0.52),
    height: Math.round(outputHeight * 0.64),
  })
  .resize(226, 286, {
    fit: 'cover',
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
      bodyClosureRadius,
      interiorRadius,
      cleanInteriorRadius,
      outputScale,
    },
    null,
    2,
  ) + '\n',
);
