import type { Genre, GenreAssessment, ImprovementPriority, PostProcessingAdviceItem, Report, ReviewContext, ScoreBand, ScoreName } from '../types/report';
import { normalizePreviewAdjustments } from './preview';

const scoreNames: ScoreName[] = ['构图', '光线', '色彩', '叙事', '技术完成度'];
const scoreBandNames: ScoreBand[] = ['作品级', '强', '成立', '普通', '偏弱', '严重问题'];
const improvementPriorities: ImprovementPriority[] = ['none', 'optional', 'material', 'critical'];
const genres: Genre[] = ['街头摄影', '人像摄影', '风景摄影', '建筑摄影', '静物摄影', '旅行摄影'];
const internalMetaPhrases = [
  '本次评分',
  '评分侧重',
  '评价基准',
  '点评口径',
  '按初学者口径',
  '按进阶口径',
  '按高级口径',
  '按爱好者水平口径',
  '按进阶水平口径',
  '用户选择',
  'AI',
  '模型',
  '建议优化后入选',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function containsInternalMetaLanguage(value = '') {
  return internalMetaPhrases.some((phrase) => value.includes(phrase));
}

export function sanitizeUserFacingText(value: unknown, fallback: string) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && !containsInternalMetaLanguage(text) ? text : fallback;
}

function normalizeScore(value: unknown, fallback: number) {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, Math.min(100, Math.round(numericValue))) : fallback;
}

function getScoreBandFromNumber(value: number): ScoreBand {
  if (value >= 90) return '作品级';
  if (value >= 80) return '强';
  if (value >= 70) return '成立';
  if (value >= 60) return '普通';
  if (value >= 45) return '偏弱';
  return '严重问题';
}

function normalizeStringArray(value: unknown, fallback: string[], limit: number) {
  const source = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0 && !containsInternalMetaLanguage(item))
    : [];
  return source.length ? source.slice(0, limit).map((item) => item.trim()) : fallback.slice(0, limit);
}

function emptyAdvice(): PostProcessingAdviceItem {
  return { suggestion: '', reason: '', expectedEffect: '' };
}

function normalizeAdvice(value: unknown, fallback: PostProcessingAdviceItem) {
  const source = isRecord(value) ? value : {};
  return {
    suggestion: sanitizeUserFacingText(source.suggestion, fallback.suggestion),
    reason: sanitizeUserFacingText(source.reason, fallback.reason),
    expectedEffect: sanitizeUserFacingText(source.expectedEffect, fallback.expectedEffect),
  };
}

function normalizeGenreAssessment(value: unknown): GenreAssessment | undefined {
  if (!isRecord(value) || !genres.includes(value.detectedGenre as Genre)) return undefined;

  const confidence = typeof value.confidence === 'number' ? value.confidence : Number(value.confidence);
  const reason = typeof value.reason === 'string' ? value.reason.trim() : '';

  if (!Number.isFinite(confidence) || !reason) return undefined;

  return {
    detectedGenre: value.detectedGenre as Genre,
    confidence: Math.max(0, Math.min(1, confidence)),
    reason: reason.slice(0, 160),
  };
}

/**
 * Accepts an untrusted API report and fills only missing or invalid fields.
 * Valid model observations and advice are never replaced with context templates.
 */
export function mergeAiReportWithFallback(candidate: unknown, fallback: Report, reviewContext: ReviewContext): Report {
  const source = isRecord(candidate) ? candidate : {};
  const sourceScores = isRecord(source.scores) ? source.scores : {};
  const scores = scoreNames.reduce((result, name) => {
    result[name] = normalizeScore(sourceScores[name], fallback.scores[name]);
    return result;
  }, {} as Record<ScoreName, number>);
  const sourceScoreBands = isRecord(source.scoreBands) ? source.scoreBands : {};
  const fallbackScoreBands: Partial<Record<ScoreName, ScoreBand>> = fallback.scoreBands ?? {};
  const scoreBands = scoreNames.reduce((result, name) => {
    const sourceBand = sourceScoreBands[name];
    const fallbackBand = fallbackScoreBands[name];
    result[name] = scoreBandNames.includes(sourceBand as ScoreBand)
      ? sourceBand as ScoreBand
      : fallbackBand && scoreBandNames.includes(fallbackBand)
        ? fallbackBand
        : getScoreBandFromNumber(scores[name]);
    return result;
  }, {} as Record<ScoreName, ScoreBand>);
  const sourcePriority = source.improvementPriority as ImprovementPriority;
  const improvementPriority = improvementPriorities.includes(sourcePriority)
    ? sourcePriority
    : fallback.improvementPriority;

  const sourceRecipe = isRecord(source.recipe) ? source.recipe : {};
  const sourceVerdict = isRecord(source.verdict) ? source.verdict : {};
  const fallbackVerdict = fallback.verdict ?? {
    title: '照片具备可读的视觉基础',
    summary: fallback.overall,
    mainIssue: fallback.composition,
    nextStep: fallback.suggestions[0] ?? '先整理画面中最重要的视觉关系。',
    tags: [],
  };
  const fallbackPostProcessing = fallback.postProcessing ?? {
    crop: emptyAdvice(),
    tone: emptyAdvice(),
    masking: emptyAdvice(),
  };
  const sourcePostProcessing = isRecord(source.postProcessing) ? source.postProcessing : {};
  const fallbackNextShooting = fallback.nextShooting ?? { summary: '', items: [] };
  const sourceNextShooting = isRecord(source.nextShooting) ? source.nextShooting : {};
  const fallbackPhotoSpecific = fallback.photoSpecific ?? {
    strength: fallback.overall,
    priorityIssue: fallbackVerdict.mainIssue,
    affectedArea: '主体周围与画面边缘',
    nextAction: fallbackVerdict.nextStep,
    crop: {
      ratio: fallback.recipe.cropRatio || '保持当前比例',
      direction: '从干扰较明显的边缘轻微收紧',
      rationale: fallbackPostProcessing.crop.reason,
    },
  };
  const sourcePhotoSpecific = isRecord(source.photoSpecific) ? source.photoSpecific : {};
  const sourceCrop = isRecord(sourcePhotoSpecific.crop) ? sourcePhotoSpecific.crop : {};
  const sourceScoreReasons = isRecord(source.scoreReasons) ? source.scoreReasons : {};
  const fallbackScoreReasons = fallback.scoreReasons ?? {};
  const recipe = {
    exposure: sanitizeUserFacingText(sourceRecipe.exposure, fallback.recipe.exposure),
    contrast: sanitizeUserFacingText(sourceRecipe.contrast, fallback.recipe.contrast),
    highlights: sanitizeUserFacingText(sourceRecipe.highlights, fallback.recipe.highlights),
    shadows: sanitizeUserFacingText(sourceRecipe.shadows, fallback.recipe.shadows),
    temperature: sanitizeUserFacingText(sourceRecipe.temperature, fallback.recipe.temperature),
    cropRatio: sanitizeUserFacingText(sourceRecipe.cropRatio, fallback.recipe.cropRatio),
  };

  return {
    overall: sanitizeUserFacingText(source.overall, fallback.overall),
    scores,
    scoreBands,
    scoreVersion: typeof source.scoreVersion === 'string' && source.scoreVersion.trim()
      ? source.scoreVersion.trim()
      : fallback.scoreVersion,
    improvementPriority,
    composition: sanitizeUserFacingText(source.composition, fallback.composition),
    lighting: sanitizeUserFacingText(source.lighting, fallback.lighting),
    colour: sanitizeUserFacingText(source.colour, fallback.colour),
    storytelling: sanitizeUserFacingText(source.storytelling, fallback.storytelling),
    technical: sanitizeUserFacingText(source.technical, fallback.technical),
    suggestions: normalizeStringArray(source.suggestions, fallback.suggestions, 3),
    recipe,
    previewAdjustments: normalizePreviewAdjustments(source.previewAdjustments, recipe),
    verdict: {
      title: sanitizeUserFacingText(sourceVerdict.title, fallbackVerdict.title),
      summary: sanitizeUserFacingText(sourceVerdict.summary, fallbackVerdict.summary),
      mainIssue: sanitizeUserFacingText(sourceVerdict.mainIssue, fallbackVerdict.mainIssue),
      nextStep: sanitizeUserFacingText(sourceVerdict.nextStep, fallbackVerdict.nextStep),
      tags: normalizeStringArray(sourceVerdict.tags, fallbackVerdict.tags, 3),
    },
    // These four fields are controlled by the user's selections, not by the model.
    reviewContext,
    postProcessing: {
      crop: normalizeAdvice(sourcePostProcessing.crop, fallbackPostProcessing.crop),
      tone: normalizeAdvice(sourcePostProcessing.tone, fallbackPostProcessing.tone),
      masking: normalizeAdvice(sourcePostProcessing.masking, fallbackPostProcessing.masking),
    },
    nextShooting: {
      summary: sanitizeUserFacingText(sourceNextShooting.summary, fallbackNextShooting.summary),
      items: normalizeStringArray(sourceNextShooting.items, fallbackNextShooting.items, 3),
    },
    photoSpecific: {
      strength: sanitizeUserFacingText(sourcePhotoSpecific.strength, fallbackPhotoSpecific.strength),
      priorityIssue: sanitizeUserFacingText(sourcePhotoSpecific.priorityIssue, fallbackPhotoSpecific.priorityIssue),
      affectedArea: sanitizeUserFacingText(sourcePhotoSpecific.affectedArea, fallbackPhotoSpecific.affectedArea),
      nextAction: sanitizeUserFacingText(sourcePhotoSpecific.nextAction, fallbackPhotoSpecific.nextAction),
      crop: {
        ratio: sanitizeUserFacingText(sourceCrop.ratio, fallbackPhotoSpecific.crop.ratio),
        direction: sanitizeUserFacingText(sourceCrop.direction, fallbackPhotoSpecific.crop.direction),
        rationale: sanitizeUserFacingText(sourceCrop.rationale, fallbackPhotoSpecific.crop.rationale),
      },
    },
    scoreReasons: scoreNames.reduce((result, name) => {
      result[name] = sanitizeUserFacingText(sourceScoreReasons[name], fallbackScoreReasons[name] ?? fallback[name === '构图' ? 'composition' : name === '光线' ? 'lighting' : name === '色彩' ? 'colour' : name === '叙事' ? 'storytelling' : 'technical']);
      return result;
    }, {} as Record<ScoreName, string>),
    genreAssessment: normalizeGenreAssessment(source.genreAssessment) ?? fallback.genreAssessment,
  };
}
