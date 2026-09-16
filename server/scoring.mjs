export const scoreNames = ['构图', '光线', '色彩', '叙事', '技术完成度'];

export const SCORE_VERSION = 'v4-rubric';

export const scoreBandValues = {
  作品级: 95,
  强: 85,
  成立: 75,
  普通: 65,
  偏弱: 50,
  严重问题: 35,
};

export const scoreBandNames = Object.keys(scoreBandValues);

const rubricCriteria = {
  构图: ['subjectHierarchy', 'placementBalance', 'edgeControl', 'depthAndGeometry'],
  光线: ['exposureTone', 'directionQuality', 'subjectSeparation', 'highlightShadowControl'],
  色彩: ['harmony', 'separation', 'paletteIntent', 'consistency'],
  叙事: ['subjectClarity', 'contextRelation', 'momentEmotion', 'specificity'],
  技术完成度: ['focusDetail', 'exposureIntegrity', 'perspectiveProcessing', 'mediumFit'],
};

export const scoreRubricDescription = {
  爱好者水平: '每个维度先看四项基础能力的平均分；0-5 分分别代表缺失、明显不足、有限可用、基本成立、控制稳定、非常出色。',
  进阶水平: '每个维度按四项基础能力 80% 加控制与意图 20% 计算；控制项低于基础平均时会真实拉低分数。0-5 分分别代表缺失、明显不足、有限可用、基本成立、控制稳定、非常出色。',
};

export const scoreRubricCriteria = rubricCriteria;

export const scoreRubricLabels = {
  构图: {
    subjectHierarchy: '主体层级是否清楚',
    placementBalance: '主体位置与画面平衡',
    edgeControl: '边缘是否干净且有意',
    depthAndGeometry: '空间、线条或形体关系',
  },
  光线: {
    exposureTone: '曝光与明暗层次',
    directionQuality: '光线方向、质量与时机',
    subjectSeparation: '主体与背景的亮暗分离',
    highlightShadowControl: '高光和阴影的控制',
  },
  色彩: {
    harmony: '色彩和谐与整体调性',
    separation: '色彩层次与主体分离',
    paletteIntent: '色彩是否服务主题或情绪',
    consistency: '色彩统一、准确与处理克制',
  },
  叙事: {
    subjectClarity: '主体、动作或事件是否清楚',
    contextRelation: '主体与环境的关系',
    momentEmotion: '瞬间、情绪或现场张力',
    specificity: '画面的具体性与可复述性',
  },
  技术完成度: {
    focusDetail: '对焦、清晰度与细节可靠性',
    exposureIntegrity: '高光、暗部和曝光完整度',
    perspectiveProcessing: '透视、倾斜与后期完整度',
    mediumFit: '介质质感是否服务表达',
  },
};

export function normalizeScore(value, fallback) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(numberValue)));
}

export function isValidScore(value) {
  if (value === null || value === '' || typeof value === 'boolean') return false;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 && numberValue <= 100;
}

export function getScoreBandFromNumber(value) {
  const score = normalizeScore(value, 65);
  if (score >= 90) return '作品级';
  if (score >= 80) return '强';
  if (score >= 70) return '成立';
  if (score >= 60) return '普通';
  if (score >= 45) return '偏弱';
  return '严重问题';
}

export function normalizeScoreBands(value, legacyScores = {}) {
  const hasCompleteBands = scoreNames.every((name) => scoreBandNames.includes(value?.[name]));

  if (hasCompleteBands) {
    return Object.fromEntries(scoreNames.map((name) => [name, value[name]]));
  }

  if (scoreNames.every((name) => isValidScore(legacyScores?.[name]))) {
    return Object.fromEntries(scoreNames.map((name) => [name, getScoreBandFromNumber(legacyScores[name])]));
  }

  const error = new Error('AI 返回的评分等级不完整，请重试。');
  error.statusCode = 502;
  throw error;
}

export function getScoresFromBands(scoreBands = {}) {
  return Object.fromEntries(scoreNames.map((name) => [name, scoreBandValues[scoreBands[name]]]));
}

export function getImprovementPriority(scores = {}) {
  const weakestScore = Math.min(...scoreNames.map((name) => normalizeScore(scores[name], 65)));
  if (weakestScore >= 85) return 'none';
  if (weakestScore >= 75) return 'optional';
  if (weakestScore >= 50) return 'material';
  return 'critical';
}

function normalizeSubscore(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0 || numberValue > 5) return undefined;
  return Math.round(numberValue * 10) / 10;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeScoreBreakdown(value) {
  if (!isRecord(value)) return {};

  return Object.fromEntries(scoreNames.flatMap((name) => {
    const source = value[name];
    const fundamentals = source?.fundamentals;
    const criteria = rubricCriteria[name];
    if (!isRecord(source) || !isRecord(fundamentals)) return [];

    const normalizedFundamentals = Object.fromEntries(criteria.map((criterion) => [criterion, normalizeSubscore(fundamentals[criterion])]));
    if (Object.values(normalizedFundamentals).some((score) => score === undefined)) return [];

    const refinement = normalizeSubscore(source.refinement);
    const evidence = typeof source.evidence === 'string' ? source.evidence.trim().slice(0, 300) : '';
    if (refinement === undefined || !evidence) return [];

    return [[name, { fundamentals: normalizedFundamentals, refinement, evidence }]];
  }));
}

export function calculateRubricScores({ scoreBreakdown = {}, skillLevel = '爱好者水平', legacyScores = {}, legacyBands = {} }) {
  const normalizedBreakdown = normalizeScoreBreakdown(scoreBreakdown);
  const fallbackScores = scoreNames.every((name) => isValidScore(legacyScores?.[name]))
    ? Object.fromEntries(scoreNames.map((name) => [name, normalizeScore(legacyScores[name], 65)]))
    : getScoresFromBands(legacyBands);
  const scores = Object.fromEntries(scoreNames.map((name) => {
    const item = normalizedBreakdown[name];
    if (!item) return [name, fallbackScores[name]];

    const coreScores = Object.values(item.fundamentals);
    const coreAverage = coreScores.reduce((sum, score) => sum + score, 0) / coreScores.length;
    const weightedScore = skillLevel === '进阶水平'
      ? (coreAverage * 0.8) + (item.refinement * 0.2)
      : coreAverage;
    return [name, Math.max(0, Math.min(100, Math.round(weightedScore * 20)))];
  }));
  const scoreBands = Object.fromEntries(scoreNames.map((name) => [name, getScoreBandFromNumber(scores[name])]));

  return { scores, scoreBands, scoreBreakdown: normalizedBreakdown };
}
