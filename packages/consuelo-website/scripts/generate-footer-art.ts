import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = join(packageRoot, 'public/images/home/holding-world.svg');
const outputPath = join(packageRoot, 'public/images/home/holding-world-editorial.png');
const renderSize = 2400;
const alphaThreshold = 8;
const closureRadius = 2;
const outputMargin = 24;

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
    for (let x = 0; x < width; x += 1) {
      for (let offset = -radius; offset <= radius; offset += 1) {
        const sampleX = x + offset;
        if (sampleX >= 0 && sampleX < width && source[row + sampleX] === 1) {
          horizontal[row + x] = 1;
          break;
        }
      }
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      for (let offset = -radius; offset <= radius; offset += 1) {
        const sampleY = y + offset;
        if (
          sampleY >= 0 &&
          sampleY < height &&
          horizontal[sampleY * width + x] === 1
        ) {
          output[y * width + x] = 1;
          break;
        }
      }
    }
  }

  return output;
};

const barrier = dilate(ink, closureRadius);
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
const output = Buffer.alloc(outputWidth * outputHeight * 4);
let bluePixels = 0;
let whitePixels = 0;

for (let y = 0; y < outputHeight; y += 1) {
  for (let x = 0; x < outputWidth; x += 1) {
    const sourceX = cropLeft + x;
    const sourceY = cropTop + y;
    const sourceIndex = sourceY * width + sourceX;
    const sourceOffset = sourceIndex * channels;
    const outputOffset = (y * outputWidth + x) * 4;
    const alpha = render.data[sourceOffset + 3];

    if (alpha > alphaThreshold) {
      output[outputOffset] = render.data[sourceOffset];
      output[outputOffset + 1] = render.data[sourceOffset + 1];
      output[outputOffset + 2] = render.data[sourceOffset + 2];
      output[outputOffset + 3] = alpha;
      bluePixels += 1;
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
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

process.stdout.write(
  JSON.stringify(
    {
      sourcePath,
      outputPath,
      width: outputWidth,
      height: outputHeight,
      bluePixels,
      whitePixels,
      closureRadius,
    },
    null,
    2,
  ) + '\n',
);
