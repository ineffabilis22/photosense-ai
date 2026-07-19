import type { Medium, PostProcessingAdviceItem, PreviewAdjustments, Report } from '../src/types/report';

export type ImageToneMetrics = {
  p05: number;
  p50: number;
  p95: number;
  dynamicRange: number;
  shadowClipRatio: number;
  highlightClipRatio: number;
  meanRed: number;
  meanGreen: number;
  meanBlue: number;
  averageSaturation: number;
};

export type ImageToneAnalysis = {
  metrics: ImageToneMetrics;
  adjustments: PreviewAdjustments;
  tone: PostProcessingAdviceItem;
};

export function normalizeCropRatio(value: unknown): string;
export function normalizePreviewRecipe(value: unknown, legacyRecipe?: Partial<Report['recipe']>): PreviewAdjustments;
export function analyzeImageTone(imageDataUrl: string, options?: { medium?: Medium }): Promise<ImageToneAnalysis>;
export function renderPreviewImage(input: {
  imageDataUrl: string;
  recipe?: unknown;
  legacyRecipe?: Partial<Report['recipe']>;
}): Promise<{
  imageDataUrl: string;
  mimeType: 'image/webp';
  width: number;
  height: number;
  appliedRecipe: PreviewAdjustments;
}>;
