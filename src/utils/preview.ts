import type { PreviewAdjustments, Report } from '../types/report';

const DEFAULT_ADJUSTMENTS: PreviewAdjustments = {
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

const SUPPORTED_RATIOS = new Set(['original', '1:1', '4:5', '5:4', '3:2', '2:3', '16:9', '9:16']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clamp(value: unknown, fallback: number, min: number, max: number) {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? Math.max(min, Math.min(max, numericValue)) : fallback;
}

function parseLegacyNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return fallback;
  const match = value.replace(',', '.').match(/[+-]?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : fallback;
}

export function normalizeCropRatio(value: unknown) {
  if (typeof value !== 'string') return DEFAULT_ADJUSTMENTS.crop.ratio;
  const normalized = value.trim().toLowerCase().replace(/[×x／/]/g, ':');
  if (/保持|原始|当前|不建议/.test(normalized)) return 'original';
  const match = normalized.match(/(16:9|9:16|4:5|5:4|3:2|2:3|1:1)/);
  return match && SUPPORTED_RATIOS.has(match[1]) ? match[1] : DEFAULT_ADJUSTMENTS.crop.ratio;
}

export function normalizePreviewAdjustments(value: unknown, legacyRecipe?: Report['recipe']): PreviewAdjustments {
  const source = isRecord(value) ? value : {};
  const sourceCrop = isRecord(source.crop) ? source.crop : {};
  const sourceGlobal = isRecord(source.global) ? source.global : {};

  return {
    crop: {
      ratio: normalizeCropRatio(sourceCrop.ratio ?? legacyRecipe?.cropRatio),
      anchorX: clamp(sourceCrop.anchorX, DEFAULT_ADJUSTMENTS.crop.anchorX, 0, 1),
      anchorY: clamp(sourceCrop.anchorY, DEFAULT_ADJUSTMENTS.crop.anchorY, 0, 1),
    },
    global: {
      exposureEv: clamp(sourceGlobal.exposureEv ?? parseLegacyNumber(legacyRecipe?.exposure), 0, -2, 2),
      contrast: clamp(sourceGlobal.contrast ?? parseLegacyNumber(legacyRecipe?.contrast), 0, -50, 50),
      highlights: clamp(sourceGlobal.highlights ?? parseLegacyNumber(legacyRecipe?.highlights), 0, -100, 100),
      shadows: clamp(sourceGlobal.shadows ?? parseLegacyNumber(legacyRecipe?.shadows), 0, -100, 100),
      temperature: clamp(sourceGlobal.temperature ?? parseLegacyNumber(legacyRecipe?.temperature), 0, -100, 100),
      saturation: clamp(sourceGlobal.saturation, 0, -100, 100),
    },
  };
}

export function getReportPreviewAdjustments(report: Report) {
  return normalizePreviewAdjustments(report.previewAdjustments, report.recipe);
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('无法读取用于后期预览的照片。'));
    image.src = source;
  });
}

function applyPixelAdjustments(data: Uint8ClampedArray, adjustments: PreviewAdjustments) {
  const { exposureEv, contrast, highlights, shadows, temperature, saturation } = adjustments.global;
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

export type RenderedPreview = {
  previewUrl: string;
  width: number;
  height: number;
  adjustments: PreviewAdjustments;
};

export async function renderPreview(source: string, value: unknown, legacyRecipe?: Report['recipe']): Promise<RenderedPreview> {
  const adjustments = normalizePreviewAdjustments(value, legacyRecipe);
  const image = await loadImage(source);
  const maxEdge = 1200;
  const outputScale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * outputScale));
  const height = Math.max(1, Math.round(image.naturalHeight * outputScale));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('当前浏览器不支持后期预览。');

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  applyPixelAdjustments(imageData.data, adjustments);
  context.putImageData(imageData, 0, 0);

  return {
    previewUrl: canvas.toDataURL('image/jpeg', 0.9),
    width,
    height,
    adjustments,
  };
}
