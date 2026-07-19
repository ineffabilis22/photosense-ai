import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { normalizePreviewAdjustments } from '../src/utils/preview';
import { analyzeImageTone, normalizePreviewRecipe, renderPreviewImage } from '../server/preview-renderer.mjs';

function toImageDataUrl(buffer: Buffer, mimeType = 'image/png') {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function decodeImageDataUrl(value: string) {
  return Buffer.from(value.slice(value.indexOf(',') + 1), 'base64');
}

async function averagePixelValue(imageDataUrl: string) {
  const pixels = await sharp(decodeImageDataUrl(imageDataUrl)).removeAlpha().raw().toBuffer();
  return pixels.reduce((sum, value) => sum + value, 0) / pixels.length;
}

test('normalizes legacy report strings into safe preview values', () => {
  const adjustments = normalizePreviewAdjustments(undefined, {
    exposure: '+0.25 EV',
    contrast: '+12',
    highlights: '-18',
    shadows: '+10',
    temperature: '+3 偏暖',
    cropRatio: '4:5 竖幅',
  });

  assert.deepEqual(adjustments, {
    crop: { ratio: '4:5', anchorX: 0.5, anchorY: 0.5 },
    global: {
      exposureEv: 0.25,
      contrast: 12,
      highlights: -18,
      shadows: 10,
      temperature: 3,
      saturation: 0,
    },
  });
});

test('clamps untrusted preview values in browser and server normalizers', () => {
  const candidate = {
    crop: { ratio: '16/9', anchorX: -4, anchorY: 8 },
    global: {
      exposureEv: 20,
      contrast: -80,
      highlights: 130,
      shadows: -140,
      temperature: 200,
      saturation: -200,
    },
  };

  const expected = {
    crop: { ratio: '16:9', anchorX: 0, anchorY: 1 },
    global: {
      exposureEv: 2,
      contrast: -50,
      highlights: 100,
      shadows: -100,
      temperature: 100,
      saturation: -100,
    },
  };

  assert.deepEqual(normalizePreviewAdjustments(candidate), expected);
  assert.deepEqual(normalizePreviewRecipe(candidate), expected);
});

test('Sharp renderer keeps the complete image even when the recipe requests a square crop', async () => {
  const input = await sharp({
    create: { width: 8, height: 4, channels: 3, background: { r: 92, g: 110, b: 134 } },
  }).png().toBuffer();

  const result = await renderPreviewImage({
    imageDataUrl: toImageDataUrl(input),
    recipe: {
      crop: { ratio: '1:1', anchorX: 0.5, anchorY: 0.5 },
      global: { exposureEv: 0.2, contrast: 8, highlights: -10, shadows: 5, temperature: 2, saturation: 0 },
    },
  });

  assert.equal(result.mimeType, 'image/webp');
  assert.equal(result.width, 8);
  assert.equal(result.height, 4);
  assert.equal(result.width / result.height, 2);
  assert.equal(result.appliedRecipe.crop.ratio, 'original');
  assert.match(result.imageDataUrl, /^data:image\/webp;base64,/);
});

test('tone analysis produces photo-specific adjustments for dark and bright images', async () => {
  const darkInput = await sharp({
    create: { width: 32, height: 24, channels: 3, background: { r: 20, g: 20, b: 20 } },
  }).png().toBuffer();
  const brightInput = await sharp({
    create: { width: 32, height: 24, channels: 3, background: { r: 235, g: 235, b: 235 } },
  }).png().toBuffer();

  const dark = await analyzeImageTone(toImageDataUrl(darkInput));
  const bright = await analyzeImageTone(toImageDataUrl(brightInput));

  assert.ok(dark.metrics.p50 < bright.metrics.p50);
  assert.ok(dark.adjustments.global.exposureEv > 0, '暗图应获得正曝光补偿');
  assert.ok(bright.adjustments.global.exposureEv < 0, '亮图应获得负曝光补偿');
  assert.ok(dark.adjustments.global.shadows > bright.adjustments.global.shadows);
  assert.ok(bright.adjustments.global.highlights < dark.adjustments.global.highlights);
  assert.notDeepEqual(dark.adjustments.global, bright.adjustments.global);
});

test('different adjustment recipes produce measurably different pixel output', async () => {
  const input = await sharp({
    create: { width: 16, height: 12, channels: 3, background: { r: 96, g: 112, b: 132 } },
  }).png().toBuffer();
  const imageDataUrl = toImageDataUrl(input);
  const neutral = await renderPreviewImage({
    imageDataUrl,
    recipe: {
      crop: { ratio: 'original', anchorX: 0.5, anchorY: 0.5 },
      global: { exposureEv: 0, contrast: 0, highlights: 0, shadows: 0, temperature: 0, saturation: 0 },
    },
  });
  const lifted = await renderPreviewImage({
    imageDataUrl,
    recipe: {
      crop: { ratio: 'original', anchorX: 0.5, anchorY: 0.5 },
      global: { exposureEv: 0.5, contrast: 12, highlights: -8, shadows: 18, temperature: 6, saturation: 8 },
    },
  });

  assert.notEqual(decodeImageDataUrl(neutral.imageDataUrl).toString('base64'), decodeImageDataUrl(lifted.imageDataUrl).toString('base64'));
  assert.ok(await averagePixelValue(lifted.imageDataUrl) > await averagePixelValue(neutral.imageDataUrl));
});

test('Sharp renderer rejects unsupported image data', async () => {
  await assert.rejects(
    () => renderPreviewImage({ imageDataUrl: 'data:text/plain;base64,SGVsbG8=', recipe: {} }),
    /仅支持 JPEG、PNG 或 WebP/,
  );
});
