import sharp from 'sharp';

const MAX_DECODED_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;
const MAX_OUTPUT_EDGE = 1600;
const SUPPORTED_RATIOS = new Set(['original', '1:1', '4:5', '5:4', '3:2', '2:3', '16:9', '9:16']);

const DEFAULT_RECIPE = {
  crop: { ratio: 'original', anchorX: 0.5, anchorY: 0.5 },
  global: {
    exposureEv: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    temperature: 0,
    saturation: 0,
  },
};

function statusError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clamp(value, fallback, min, max) {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? Math.max(min, Math.min(max, numericValue)) : fallback;
}

function parseLegacyNumber(value, fallback = 0) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return fallback;
  const match = value.replace(',', '.').match(/[+-]?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : fallback;
}

export function normalizeCropRatio(value) {
  if (typeof value !== 'string') return DEFAULT_RECIPE.crop.ratio;
  const normalized = value.trim().toLowerCase().replace(/[×x／/]/g, ':');
  if (/保持|原始|当前|不建议/.test(normalized)) return 'original';
  const match = normalized.match(/(16:9|9:16|4:5|5:4|3:2|2:3|1:1)/);
  return match && SUPPORTED_RATIOS.has(match[1]) ? match[1] : DEFAULT_RECIPE.crop.ratio;
}

export function normalizePreviewRecipe(value, legacyRecipe = {}) {
  const source = isRecord(value) ? value : {};
  const crop = isRecord(source.crop) ? source.crop : {};
  const global = isRecord(source.global) ? source.global : {};

  return {
    crop: {
      ratio: normalizeCropRatio(crop.ratio ?? legacyRecipe.cropRatio),
      anchorX: clamp(crop.anchorX, DEFAULT_RECIPE.crop.anchorX, 0, 1),
      anchorY: clamp(crop.anchorY, DEFAULT_RECIPE.crop.anchorY, 0, 1),
    },
    global: {
      exposureEv: clamp(global.exposureEv ?? parseLegacyNumber(legacyRecipe.exposure), 0, -2, 2),
      contrast: clamp(global.contrast ?? parseLegacyNumber(legacyRecipe.contrast), 0, -50, 50),
      highlights: clamp(global.highlights ?? parseLegacyNumber(legacyRecipe.highlights), 0, -100, 100),
      shadows: clamp(global.shadows ?? parseLegacyNumber(legacyRecipe.shadows), 0, -100, 100),
      temperature: clamp(global.temperature ?? parseLegacyNumber(legacyRecipe.temperature), 0, -100, 100),
      saturation: clamp(global.saturation, 0, -100, 100),
    },
  };
}

function parseImageDataUrl(imageDataUrl) {
  if (typeof imageDataUrl !== 'string') {
    throw statusError('缺少 imageDataUrl。');
  }

  const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-zA-Z0-9+/=\s]+)$/.exec(imageDataUrl);
  if (!match) {
    throw statusError('后期预览仅支持 JPEG、PNG 或 WebP 图片。');
  }

  const input = Buffer.from(match[2], 'base64');
  if (!input.length) throw statusError('图片数据为空。');
  if (input.length > MAX_DECODED_IMAGE_BYTES) {
    throw statusError('用于后期预览的图片过大，请使用 12MB 以内的图片。', 413);
  }
  return input;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundToStep(value, step = 1) {
  return Math.round(value / step) * step;
}

function readPercentile(histogram, total, percentile) {
  const threshold = total * percentile;
  let cumulative = 0;

  for (let index = 0; index < histogram.length; index += 1) {
    cumulative += histogram[index];
    if (cumulative >= threshold) return index / 255;
  }

  return 1;
}

function deriveToneAdjustments(metrics, medium) {
  const targetMedian = medium === '胶片摄影' ? 0.43 : 0.48;
  let exposureEv = clampNumber(Math.log2(targetMedian / Math.max(0.06, metrics.p50)), -0.65, 0.65);

  if (exposureEv > 0) {
    const highlightHeadroomEv = Math.log2(0.9 / Math.max(0.15, metrics.p95));
    exposureEv = Math.min(exposureEv, Math.max(0, highlightHeadroomEv));
  }

  if (metrics.highlightClipRatio > 0.012 && exposureEv > 0) {
    exposureEv = Math.min(exposureEv, 0.05);
  }

  if (metrics.shadowClipRatio > 0.08 && exposureEv < 0) {
    exposureEv = Math.max(exposureEv, -0.2);
  }

  exposureEv = Number(roundToStep(exposureEv, 0.05).toFixed(2));

  let highlights = clampNumber(Math.round((0.86 - metrics.p95) * 180), -38, 12);
  if (metrics.highlightClipRatio > 0.01) {
    highlights = Math.min(highlights, -18 - Math.round(Math.min(0.08, metrics.highlightClipRatio) * 180));
  }

  let shadows = clampNumber(Math.round((0.13 - metrics.p05) * 170), -12, 30);
  if (metrics.shadowClipRatio > 0.06) {
    shadows = Math.max(shadows, 16 + Math.round(Math.min(0.12, metrics.shadowClipRatio) * 90));
  }

  const contrast = clampNumber(Math.round((0.68 - metrics.dynamicRange) * 58), -12, 20);
  const temperature = clampNumber(Math.round((metrics.meanBlue - metrics.meanRed) * 52), -12, 12);
  const saturation = medium === '胶片摄影'
    ? 0
    : clampNumber(Math.round((0.27 - metrics.averageSaturation) * 38), -10, 12);

  return {
    crop: { ratio: 'original', anchorX: 0.5, anchorY: 0.5 },
    global: { exposureEv, contrast, highlights, shadows, temperature, saturation },
  };
}

function buildToneAdvice(metrics, adjustments) {
  const actions = [];
  const reasons = [];
  const { exposureEv, contrast, highlights, shadows, temperature, saturation } = adjustments.global;

  if (exposureEv >= 0.1) actions.push(`整体提亮约 +${exposureEv.toFixed(2)} EV`);
  if (exposureEv <= -0.1) actions.push(`整体压暗约 ${exposureEv.toFixed(2)} EV`);
  if (highlights <= -4) actions.push(`回收高光 ${highlights}`);
  if (highlights >= 4) actions.push(`轻提高光 +${highlights}`);
  if (shadows >= 4) actions.push(`打开阴影 +${shadows}`);
  if (shadows <= -4) actions.push(`压实阴影 ${shadows}`);
  if (contrast >= 4) actions.push(`增加对比 +${contrast}`);
  if (contrast <= -4) actions.push(`降低对比 ${contrast}`);
  if (temperature >= 3) actions.push(`色温微暖 +${temperature}`);
  if (temperature <= -3) actions.push(`色温微冷 ${temperature}`);
  if (saturation >= 4) actions.push(`饱和度 +${saturation}`);
  if (saturation <= -4) actions.push(`饱和度 ${saturation}`);

  if (metrics.p50 < 0.38) reasons.push('中间调整体偏暗');
  if (metrics.p50 > 0.62) reasons.push('中间调整体偏亮');
  if (metrics.highlightClipRatio > 0.01 || metrics.p95 > 0.93) reasons.push('高光已接近或出现溢出');
  if (metrics.shadowClipRatio > 0.06 || metrics.p05 < 0.045) reasons.push('暗部压缩较明显');
  if (metrics.dynamicRange < 0.5) reasons.push('明暗跨度偏窄');
  if (metrics.dynamicRange > 0.82) reasons.push('明暗跨度较大');
  if (!reasons.length) reasons.push('整体曝光较稳定，仅需小幅整理层次');

  return {
    suggestion: actions.length
      ? `${actions.join('，')}。`
      : '保留当前整体影调，仅做非常轻微的层次整理。',
    reason: `${reasons.join('，')}。`,
    expectedEffect: '完整保留原始画幅，同时让高光、阴影和中间调的关系更清楚。',
  };
}

export async function analyzeImageTone(imageDataUrl, { medium = '数码摄影' } = {}) {
  const input = parseImageDataUrl(imageDataUrl);
  let measured;

  try {
    measured = await sharp(input, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
      .toColourspace('srgb')
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw statusError('无法测量这张图片的影调，请确认文件没有损坏。', 422);
  }

  const histogram = new Uint32Array(256);
  const { data, info } = measured;
  const total = info.width * info.height;
  let sumRed = 0;
  let sumGreen = 0;
  let sumBlue = 0;
  let saturationTotal = 0;
  let shadowClipped = 0;
  let highlightClipped = 0;

  for (let index = 0; index < data.length; index += info.channels) {
    const red = data[index] / 255;
    const green = data[index + 1] / 255;
    const blue = data[index + 2] / 255;
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);

    histogram[Math.max(0, Math.min(255, Math.round(luminance * 255)))] += 1;
    sumRed += red;
    sumGreen += green;
    sumBlue += blue;
    saturationTotal += maximum <= 0 ? 0 : (maximum - minimum) / maximum;
    if (luminance <= 0.02) shadowClipped += 1;
    if (luminance >= 0.98) highlightClipped += 1;
  }

  const p05 = readPercentile(histogram, total, 0.05);
  const p50 = readPercentile(histogram, total, 0.5);
  const p95 = readPercentile(histogram, total, 0.95);
  const metrics = {
    p05,
    p50,
    p95,
    dynamicRange: p95 - p05,
    shadowClipRatio: shadowClipped / total,
    highlightClipRatio: highlightClipped / total,
    meanRed: sumRed / total,
    meanGreen: sumGreen / total,
    meanBlue: sumBlue / total,
    averageSaturation: saturationTotal / total,
  };
  const adjustments = deriveToneAdjustments(metrics, medium);

  return {
    metrics,
    adjustments,
    tone: buildToneAdvice(metrics, adjustments),
  };
}

function applyPixelAdjustments(data, recipe) {
  const { exposureEv, contrast, highlights, shadows, temperature, saturation } = recipe.global;
  const exposureFactor = 2 ** exposureEv;
  const contrastFactor = 1 + contrast / 100;
  const saturationFactor = Math.max(0, 1 + saturation / 100);
  const temperatureAmount = temperature / 100;

  for (let index = 0; index < data.length; index += 4) {
    let red = data[index] / 255;
    let green = data[index + 1] / 255;
    let blue = data[index + 2] / 255;

    red *= exposureFactor * (1 + temperatureAmount * 0.12);
    green *= exposureFactor;
    blue *= exposureFactor * (1 - temperatureAmount * 0.12);

    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    red = luminance + (red - luminance) * saturationFactor;
    green = luminance + (green - luminance) * saturationFactor;
    blue = luminance + (blue - luminance) * saturationFactor;

    const shadowOffset = (shadows / 100) * 0.25 * (1 - Math.min(1, luminance)) ** 2;
    const highlightOffset = (highlights / 100) * 0.25 * Math.min(1, luminance) ** 2;
    const toneOffset = shadowOffset + highlightOffset;

    red = (red + toneOffset - 0.5) * contrastFactor + 0.5;
    green = (green + toneOffset - 0.5) * contrastFactor + 0.5;
    blue = (blue + toneOffset - 0.5) * contrastFactor + 0.5;

    data[index] = Math.round(Math.max(0, Math.min(1, red)) * 255);
    data[index + 1] = Math.round(Math.max(0, Math.min(1, green)) * 255);
    data[index + 2] = Math.round(Math.max(0, Math.min(1, blue)) * 255);
  }
}

export async function renderPreviewImage({ imageDataUrl, recipe, legacyRecipe }) {
  const input = parseImageDataUrl(imageDataUrl);
  const normalizedRecipe = normalizePreviewRecipe(recipe, legacyRecipe);
  const appliedRecipe = {
    ...normalizedRecipe,
    crop: { ratio: 'original', anchorX: 0.5, anchorY: 0.5 },
  };

  let orientedBuffer;
  try {
    orientedBuffer = await sharp(input, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .toBuffer();
  } catch {
    throw statusError('无法读取这张图片，请确认文件没有损坏。', 422);
  }

  const { data, info } = await sharp(orientedBuffer)
    .resize({ width: MAX_OUTPUT_EDGE, height: MAX_OUTPUT_EDGE, fit: 'inside', withoutEnlargement: true })
    .toColourspace('srgb')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  applyPixelAdjustments(data, appliedRecipe);

  const output = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();

  return {
    imageDataUrl: `data:image/webp;base64,${output.toString('base64')}`,
    mimeType: 'image/webp',
    width: info.width,
    height: info.height,
    appliedRecipe,
  };
}
