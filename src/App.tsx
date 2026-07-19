import { ChangeEvent, DragEvent, MouseEvent, RefObject, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AnalysisState,
  Genre,
  HistoryRecord,
  Medium,
  NextShootingAdvice,
  PhotoSpecificFeedback,
  PostProcessingAdviceItem,
  Report,
  ReportSource,
  ReportVerdict,
  ReviewContext,
  ScoreName,
  SkillLevel,
} from './types/report';
import { filterAndSortHistoryRecords, countRecordsInCurrentMonth, type HistorySort } from './utils/history';
import { analysisPhases, getAnalysisPhaseStatus, getAnalysisWaitMessage } from './utils/analysis';
import { compareHistoryRecords } from './utils/comparison';
import { mergeAiReportWithFallback } from './utils/report';
import { formatFileSize, validateImageFile } from './utils/upload';

type Page = 'home' | 'review' | 'report' | 'history' | 'login' | 'register';


const mediums: Medium[] = ['数码摄影', '胶片摄影'];

const genres: Genre[] = ['街头摄影', '人像摄影', '风景摄影', '建筑摄影', '静物摄影', '旅行摄影'];

const homeAssets = {
  street: '/home-assets/street.svg',
  portrait: '/home-assets/portrait.svg',
  landscape: '/home-assets/landscape.svg',
  architecture: '/home-assets/architecture.svg',
  stillLife: '/home-assets/still-life.svg',
  travel: '/home-assets/travel.svg',
};

const homeBackgroundPhotos = Array.from({ length: 25 }, (_, index) => `/home-backgrounds/photo-${String(index + 1).padStart(2, '0')}.jpg`);

const homeStoryboards = {
  observation: '/home-storyboards/observation.svg',
  context: '/home-storyboards/context.svg',
  archive: '/home-storyboards/archive.svg',
};

const homeBackgroundCollage = [
  { src: homeBackgroundPhotos[0], className: 'card-01' },
  { src: homeBackgroundPhotos[6], className: 'card-02' },
  { src: homeBackgroundPhotos[4], className: 'card-03' },
  { src: homeBackgroundPhotos[14], className: 'card-04' },
  { src: homeBackgroundPhotos[11], className: 'card-05' },
  { src: homeBackgroundPhotos[18], className: 'card-06' },
  { src: homeBackgroundPhotos[3], className: 'card-07' },
  { src: homeBackgroundPhotos[8], className: 'card-08' },
  { src: homeBackgroundPhotos[21], className: 'card-09' },
  { src: homeBackgroundPhotos[23], className: 'card-10' },
  { src: homeBackgroundPhotos[16], className: 'card-11' },
  { src: homeBackgroundPhotos[24], className: 'card-12' },
  { src: homeBackgroundPhotos[2], className: 'card-13' },
  { src: homeBackgroundPhotos[19], className: 'card-14' },
];

const skillLevels: SkillLevel[] = ['初学者', '进阶', '高级'];

const skillTooltips: Record<SkillLevel, string> = {
  初学者: '更基础、更易懂，更强调拍摄习惯、取景方式与下一次可以尝试的具体动作。',
  进阶: '加入更多构图、光线、色彩和画面组织判断，帮助你从“拍到”走向“拍准”。',
  高级: '更强调叙事、风格、视觉语言与作者意图，反馈会更接近作品集编辑视角。',
};

const scoreNames: ScoreName[] = ['构图', '光线', '色彩', '叙事', '技术完成度'];
const HISTORY_STORAGE_KEY = 'photosense_history_records';
const MAX_HISTORY_RECORDS = 20;
const DEFAULT_ANALYSIS_API_URL = '/api/analyze-photo';
const ANALYSIS_REQUEST_TIMEOUT_MS = 100_000;
const HISTORY_EXPORT_ENABLED = import.meta.env?.VITE_ENABLE_HISTORY_EXPORT === 'true';

class AnalysisCancelledError extends Error {
  constructor() {
    super('分析已取消。');
    this.name = 'AnalysisCancelledError';
  }
}

const genreGuidance: Record<Genre, string> = {
  街头摄影: '街头摄影的力量通常来自时机、人物姿态与现场秩序之间的张力。',
  人像摄影: '人像作品首先需要建立观看关系：表情、眼神、肤色、背景克制感都会影响画面的可信度。',
  风景摄影: '风景摄影更依赖空间层次、空气感、明暗分离，以及画面能否为视线安排一条自然路径。',
  建筑摄影: '建筑影像需要严谨的边线、透视控制、结构节奏，以及能勾勒体块关系的光线。',
  静物摄影: '静物摄影看似安静，但真正的判断来自材质、阴影形状、物件关系和留白比例。',
  旅行摄影: '旅行摄影不只是记录地点，更要让地方气质、人的痕迹和视觉秩序同时成立。',
};

const mediumGuidance: Record<Medium, string> = {
  数码摄影: '数码影像应关注曝光控制、清晰度、色彩还原与后期空间。',
  胶片摄影: '胶片影像可以观察颗粒、色彩偏移、宽容度和冲扫质感是否服务于画面情绪。',
};

const levelGuidance: Record<SkillLevel, string> = {
  初学者: '建议先把注意力放在一个明确目标上：让主体更清楚、边缘更干净、最亮处更有控制。',
  进阶: '你已经具备一定画面控制力，可以进一步关注主体分离、边缘管理和局部明暗关系。',
  高级: '这个阶段的重点不再是单项正确，而是每个视觉决定是否共同指向清晰的作者意图。',
};

const mediumEvaluationFocus: Record<Medium, string> = {
  数码摄影: '按数码摄影判断时，更重视曝光准确性、高光控制、白平衡、清晰度、噪点控制与后期调整空间。',
  胶片摄影: '按胶片摄影判断时，颗粒、色偏、宽容度和冲扫质感会被视为影像气氛的一部分，而不只按数码清晰度评估。',
};

const levelEvaluationFocus: Record<SkillLevel, string> = {
  初学者: '初学者口径下，报告会使用更易懂的语言，重点放在主体清晰、取景边界、曝光控制和一个明确的下一步动作。',
  进阶: '进阶口径下，报告会加入构图、光线、色彩、主体分离、边缘管理和观看顺序的判断，并解释问题为什么影响画面。',
  高级: '高级口径下，报告更关注作者意图、视觉语言、叙事张力、风格一致性和作品集筛选价值，判断会更严格。',
};

const genreEvaluationFocus: Record<Genre, string> = {
  街头摄影: '街头摄影重点观察决定性瞬间、人物姿态、主体与环境关系，以及秩序和混乱之间的现场张力。',
  人像摄影: '人像摄影重点观察表情与眼神、肤色、姿态、人物和背景关系、情绪可信度，以及主体分离和亲密感。',
  风景摄影: '风景摄影重点观察空间深度、光线时机、前中后景关系、影调层次、地方感和空气感。',
  建筑摄影: '建筑摄影重点观察透视控制、垂直水平线、结构节奏、材质质感，以及光线是否塑造出建筑体量。',
  静物摄影: '静物摄影重点观察物件关系、材质呈现、阴影形状、背景控制、留白比例和表面质感。',
  旅行摄影: '旅行摄影重点观察地方感、人的痕迹、叙事上下文，以及记录性和作品性的平衡，避免流于明信片式描述。',
};

function getReviewContext(medium: Medium, genre: Genre, skillLevel: SkillLevel): ReviewContext {
  const scoringByGenre: Record<Genre, string> = {
    街头摄影: '本次评分更重视时机、现场张力、观看顺序和人物与环境关系是否共同成立。',
    人像摄影: '本次评分更重视人物状态、情绪可信度、肤色与背景控制是否共同服务主体。',
    风景摄影: '本次评分更重视光线时机、空间层次、影调过渡和地方气质是否成立。',
    建筑摄影: '本次评分更重视透视秩序、结构节奏、线条控制和光线体积感。',
    静物摄影: '本次评分更重视物件关系、材质表达、阴影形状和留白控制。',
    旅行摄影: '本次评分更重视地方感、叙事线索、现场气氛和画面是否避免普通记录感。',
  };

  return {
    mediumFocus: mediumEvaluationFocus[medium],
    levelFocus: levelEvaluationFocus[skillLevel],
    genreFocus: genreEvaluationFocus[genre],
    scoringLogic: scoringByGenre[genre],
  };
}

function getResolvedReviewContext(report: Report | null, medium: Medium, genre: Genre, skillLevel: SkillLevel): ReviewContext {
  const fallback = getReviewContext(medium, genre, skillLevel);

  return {
    mediumFocus: report?.reviewContext?.mediumFocus || fallback.mediumFocus,
    levelFocus: report?.reviewContext?.levelFocus || fallback.levelFocus,
    genreFocus: report?.reviewContext?.genreFocus || fallback.genreFocus,
    scoringLogic: report?.reviewContext?.scoringLogic || fallback.scoringLogic,
  };
}

const internalMetaPhrases = [
  '本次评分',
  '评分侧重',
  '评价基准',
  '点评口径',
  '按初学者口径',
  '按进阶口径',
  '按高级口径',
  '用户选择',
  'AI',
  '模型',
  '建议优化后入选',
];

function containsInternalMetaLanguage(text = '') {
  const normalizedText = typeof text === 'string' ? text : String(text ?? '');
  return internalMetaPhrases.some((phrase) => normalizedText.includes(phrase)) || /摄影的画面基础成立，仍需按.*口径收紧判断/.test(normalizedText);
}

function firstSentences(text: string, maxSentences = 2) {
  return text
    .split('。')
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, maxSentences)
    .map((sentence) => `${sentence}。`)
    .join('');
}

function sanitizeUserFacingText(value: string | undefined, fallback: string) {
  const text = value?.trim();

  if (!text || containsInternalMetaLanguage(text)) {
    return fallback;
  }

  return text;
}

function getSafeVerdictTitle(report: Report, genre: Genre) {
  const weakest = getScoreSummary(report).weakest.name;
  const byGenre: Partial<Record<Genre, string>> = {
    人像摄影: '人物状态可读，背景仍可收紧',
    建筑摄影: '空间秩序成立，细节仍需整理',
    街头摄影: '现场感已经出现，观看路径还可优化',
    风景摄影: '光线有气氛，层次仍可强化',
    静物摄影: '物件关系成立，质感还可加强',
    旅行摄影: '地方气息可见，叙事还可聚焦',
  };
  const byWeakest: Record<ScoreName, string> = {
    构图: '结构具备基础，重心仍可收紧',
    光线: '光线方向清楚，层次仍可强化',
    色彩: '色彩氛围完整，关系还可明确',
    叙事: '现场线索可读，叙事还可聚焦',
    技术完成度: '画面可读，细节仍需整理',
  };

  return byGenre[genre] ?? byWeakest[weakest];
}

function createMockReport(genre: Genre, skillLevel: SkillLevel, medium: Medium): Report {
  const scoreShift = skillLevel === '初学者' ? 6 : skillLevel === '高级' ? -8 : 0;
  const reviewContext = getReviewContext(medium, genre, skillLevel);
  const baseScores: Record<ScoreName, number> = {
    构图: 72,
    光线: 64,
    色彩: 79,
    叙事: 68,
    技术完成度: 82,
  };
  const genreScoreShift: Record<Genre, Partial<Record<ScoreName, number>>> = {
    街头摄影: { 叙事: 3, 技术完成度: -1 },
    人像摄影: { 光线: 1, 色彩: 2, 叙事: 1 },
    风景摄影: { 光线: 3, 色彩: 1, 叙事: -1 },
    建筑摄影: { 构图: 3, 技术完成度: 2, 叙事: -1 },
    静物摄影: { 构图: 2, 色彩: 2, 技术完成度: 1 },
    旅行摄影: { 叙事: 2, 色彩: 1, 构图: 1 },
  };
  const mediumScoreShift: Record<Medium, Partial<Record<ScoreName, number>>> = {
    数码摄影: { 技术完成度: 2, 色彩: 1 },
    胶片摄影: { 色彩: 1, 叙事: 1, 技术完成度: -1 },
  };
  const mockScores = scoreNames.reduce((scores, name) => {
    const rawScore = baseScores[name] + scoreShift + (genreScoreShift[genre][name] ?? 0) + (mediumScoreShift[medium][name] ?? 0);
    scores[name] = Math.max(0, Math.min(100, rawScore));
    return scores;
  }, {} as Record<ScoreName, number>);

  const report: Report = {
    overall: `${genreGuidance[genre]} ${mediumGuidance[medium]} 当前画面已经有可读的视觉核心，下一步应强化观看顺序：先让主体更快被识别，再保留次要信息作为层次。${levelGuidance[skillLevel]}`,
    scores: mockScores,
    composition: `结论：主体区域已成立，但边缘仍有干扰。说明：${genre}需要更清楚的视觉入口。方向：收紧裁切或移动机位，让主体和留白关系更稳定。`,
    lighting:
      '结论：光线方向可读，但中间调还不够集中。说明：高光已能引导视线，暗部需要保留层次。方向：轻微回收高光，并用局部提亮托出主体。',
    colour:
      '结论：色彩克制，有形成情绪的基础。说明：冷暖关系可以更明确。方向：保护中性色，只让一个关键色承担视觉记忆点。',
    storytelling: `结论：画面有瞬间感，但叙事指向还可再清楚。说明：${skillLevel}阶段应先确定观众读到的第一件事。方向：减少延迟理解的元素，保留必要余味。`,
    technical:
      '结论：技术完成度稳定。说明：清晰度、曝光和整体质感足以支撑点评。方向：继续用局部调整替代大幅全局滤镜。',
    suggestions: [
      '收紧裁切，让主体进入更明确的位置。',
      '压低边缘干扰，让视线留在画面内部。',
      '局部提亮主体，再决定整体对比度。',
    ],
    recipe: {
      exposure: '+0.20',
      contrast: '+12',
      highlights: '-18',
      shadows: '+10',
      temperature: medium === '胶片摄影' ? '+4 偏暖' : '+2 偏暖',
      cropRatio: genre === '人像摄影' ? '4:5 竖幅' : genre === '建筑摄影' ? '5:4 精准裁切' : '3:2 编辑裁切',
    },
    verdict: {
      title: genre === '建筑摄影' ? '空间秩序成立，细节仍需整理' : genre === '人像摄影' ? '人物状态可读，背景仍可收紧' : '现场感已经出现，观看路径还可优化',
      summary:
        medium === '胶片摄影'
          ? '画面已有可读的情绪基础，颗粒和色偏可以保留为气氛的一部分；下一步要让主体关系更集中。'
          : '画面已有清楚的视觉入口，但曝光层次和边缘信息还可以更克制，让观看路径更顺畅。',
      mainIssue: genre === '建筑摄影' ? '线条和边缘信息还可以再整理，避免空间重心被分散。' : '次要信息略多，观众进入主体的速度还可以更快。',
      nextStep: skillLevel === '高级' ? '先判断最有作品集价值的视觉关系，再决定是否保留更多环境信息。' : '优先做轻微裁切和局部影调整理，让主体更快被看见。',
      tags: ['观看路径', '局部层次', '信息取舍'],
    },
    reviewContext,
    postProcessing: {
      crop: {
        suggestion: genre === '建筑摄影' ? '先检查垂直线和画面边缘，必要时只做小幅裁切。' : genre === '人像摄影' ? '基本保留人物关系，只轻微收紧背景中分散注意力的部分。' : '不必大幅改变构图，只轻微收紧与主题无关的边缘信息。',
        reason: '当前画面已经有可读核心，过度裁切会削弱现场或空间线索。',
        expectedEffect: '让观看入口更清楚，同时保留照片原有气氛。',
      },
      tone: {
        suggestion: medium === '胶片摄影' ? '保留现有色偏与颗粒感，只轻微压低过亮区域。' : '轻微回收高光，适度整理主体附近的中间调。',
        reason: medium === '胶片摄影' ? '胶片质感本身可以参与情绪表达，不需要按数码标准完全校正。' : '温和的影调整理能加强层次，也避免照片显得过度处理。',
        expectedEffect: '画面重点更稳定，明暗关系更自然。',
      },
      masking: {
        suggestion: skillLevel === '高级' ? '仅做轻微局部整理，不建议明显改变原有光线性格。' : '用柔和局部调整轻微提亮主体，压低分散视线的亮点。',
        reason: '局部处理比全局滤镜更适合保留照片的现场感。',
        expectedEffect: '形成更稳定的观看路径，让画面保持自然克制。',
      },
    },
    nextShooting: {
      summary: '下一次拍摄优先让主体关系更早成立，再决定环境信息保留多少。',
      items: [
        '拍摄前先确认画面里最想让观众看到的第一处信息。',
        '移动一步或收紧取景，减少边缘无关亮点。',
        '等待光线或人物关系更明确的瞬间再按下快门。',
      ],
    },
    photoSpecific: {
      strength: genre === '建筑摄影' ? '结构线与空间层次已经形成清楚秩序。' : genre === '人像摄影' ? '人物状态和环境气氛已经具备可读关系。' : '主体与现场环境已经形成可辨认的视觉关系。',
      priorityIssue: genre === '建筑摄影' ? '边缘线条仍会分散空间重心。' : '次要亮点和边缘信息减慢了主体被看见的速度。',
      affectedArea: genre === '人像摄影' ? '人物轮廓附近与背景亮点区域' : genre === '风景摄影' ? '前景入口与远处高光区域' : '主体周围与画面边缘',
      nextAction: '先处理最分散视线的一处边缘信息，再判断是否需要整体调整。',
      crop: {
        ratio: genre === '人像摄影' ? '4:5' : genre === '建筑摄影' ? '5:4' : '3:2',
        direction: genre === '人像摄影' ? '从背景较杂的一侧轻微收紧' : '从干扰较明显的边缘轻微收紧',
        rationale: '保留主体与环境关系，只减少延迟观看的次要信息。',
      },
    },
    scoreReasons: {
      构图: '主体位置可读，但边缘信息仍影响画面重心。',
      光线: '光线方向明确，中间调与高光层次仍可更集中。',
      色彩: '关键色能够建立气氛，整体关系保持克制。',
      叙事: '现场线索存在，但第一观看信息还可以更明确。',
      技术完成度: medium === '胶片摄影' ? '颗粒与色偏能够参与气氛表达，曝光仍有整理空间。' : '清晰度与曝光足以支撑观看，局部细节仍可优化。',
    },
  };

  return report;
}

function getOverallScore(report: Report) {
  const total = scoreNames.reduce((sum, name) => sum + report.scores[name], 0);
  return Math.round(total / scoreNames.length);
}

function getScoreSummaryDimensions(report: Report) {
  const scoreEntries = scoreNames.map((name) => ({ name, score: report.scores[name] }));
  const strongest = scoreEntries.reduce((best, item) => (item.score > best.score ? item : best), scoreEntries[0]);
  const weakest = scoreEntries.reduce((lowest, item) => (item.score < lowest.score ? item : lowest), scoreEntries[0]);

  return {
    strongestDimension: strongest.name,
    weakestDimension: weakest.name,
  };
}

function getHistoryTags(genre: Genre, skillLevel: SkillLevel, medium: Medium) {
  return [medium, genre, skillLevel];
}

function getFallbackHistoryTitle(genre: Genre) {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');

  return `${genre}复盘 · ${month}月${day}日`;
}

function getCoreDiagnosis(report: Report, genre: Genre) {
  const firstSentence = report.overall.split('。')[0];

  return {
    strength: firstSentence ? `${firstSentence}。` : `${genre}的画面核心已经成立，具备继续深化的基础。`,
    problem: parseDiagnosticText(report.composition).conclusion,
    direction: report.suggestions[0] ?? '下一步先明确主体位置，再处理边缘和明暗关系。',
  };
}

function getReportVerdict(report: Report, genre: Genre): ReportVerdict {
  const coreDiagnosis = getCoreDiagnosis(report, genre);
  const safeTitle = getSafeVerdictTitle(report, genre);
  const safeSummary = firstSentences(report.overall) || coreDiagnosis.strength;
  const fallback = {
    title: safeTitle,
    summary: containsInternalMetaLanguage(safeSummary) ? '画面已经具备可读的视觉基础，但观看路径和信息取舍仍可继续整理。' : safeSummary,
    mainIssue: coreDiagnosis.problem,
    nextStep: coreDiagnosis.direction,
    tags: getProblemTags(report),
  };

  if (report.verdict?.title && report.verdict.summary && report.verdict.mainIssue && report.verdict.nextStep) {
    const title = sanitizeUserFacingText(report.verdict.title, fallback.title);

    return {
      title: title.length > 28 ? fallback.title : title,
      summary: sanitizeUserFacingText(report.verdict.summary, fallback.summary),
      mainIssue: sanitizeUserFacingText(report.verdict.mainIssue, fallback.mainIssue),
      nextStep: sanitizeUserFacingText(report.verdict.nextStep, fallback.nextStep),
      tags: (() => {
        const safeTags = report.verdict?.tags?.filter((tag) => !containsInternalMetaLanguage(tag)).slice(0, 3) ?? [];
        return safeTags.length ? safeTags : fallback.tags;
      })(),
    };
  }

  return fallback;
}

function getPhotoSpecificFeedback(report: Report, genre: Genre): PhotoSpecificFeedback {
  const verdict = getReportVerdict(report, genre);
  const weakest = getScoreSummary(report).weakest.name;
  const affectedAreaByDimension: Record<ScoreName, string> = {
    构图: '主体周围与画面边缘',
    光线: '主体附近的中间调与最亮区域',
    色彩: '关键色与背景杂色相邻的区域',
    叙事: '主体、环境线索与观看入口之间',
    技术完成度: '高反差边缘与细节纹理区域',
  };
  const fallback: PhotoSpecificFeedback = {
    strength: getCoreDiagnosis(report, genre).strength,
    priorityIssue: verdict.mainIssue,
    affectedArea: affectedAreaByDimension[weakest],
    nextAction: verdict.nextStep,
    crop: {
      ratio: report.recipe.cropRatio || '保持当前比例',
      direction: '从干扰较明显的边缘轻微收紧',
      rationale: getPostProcessingAdvice(report).crop.reason,
    },
  };
  const source = report.photoSpecific;

  if (!source) return fallback;

  return {
    strength: sanitizeUserFacingText(source.strength, fallback.strength),
    priorityIssue: sanitizeUserFacingText(source.priorityIssue, fallback.priorityIssue),
    affectedArea: sanitizeUserFacingText(source.affectedArea, fallback.affectedArea),
    nextAction: sanitizeUserFacingText(source.nextAction, fallback.nextAction),
    crop: {
      ratio: sanitizeUserFacingText(source.crop?.ratio, fallback.crop.ratio),
      direction: sanitizeUserFacingText(source.crop?.direction, fallback.crop.direction),
      rationale: sanitizeUserFacingText(source.crop?.rationale, fallback.crop.rationale),
    },
  };
}

function getScoreReasons(report: Report): Record<ScoreName, string> {
  const diagnosticByScore: Record<ScoreName, string> = {
    构图: report.composition,
    光线: report.lighting,
    色彩: report.colour,
    叙事: report.storytelling,
    技术完成度: report.technical,
  };

  return scoreNames.reduce((result, name) => {
    const fallback = parseDiagnosticText(diagnosticByScore[name]).explanation;
    result[name] = sanitizeUserFacingText(report.scoreReasons?.[name], fallback);
    return result;
  }, {} as Record<ScoreName, string>);
}

function getPostProcessingAdvice(report: Report): NonNullable<Report['postProcessing']> {
  const fallback = {
    crop: {
      suggestion: report.recipe.cropRatio ? `参考 ${report.recipe.cropRatio}，以更清楚的画面边界组织主体。` : report.suggestions[0] ?? '轻微收紧取景，让主体更快被识别。',
      reason: parseDiagnosticText(report.composition).explanation,
      expectedEffect: '减少无关信息，强化观看入口。',
    },
    tone: {
      suggestion: '以温和的影调调整强化主体层次，避免大幅度全局滤镜。',
      reason: parseDiagnosticText(report.lighting).explanation,
      expectedEffect: '让明暗关系更集中，同时保留照片的自然质感。',
    },
    masking: {
      suggestion: report.suggestions[2] ?? '用局部蒙版处理主体与边缘亮度关系。',
      reason: '局部调整可以让画面重点更清楚，而不改变整张照片的气质。',
      expectedEffect: '让视线更稳定地停留在关键区域。',
    },
  };

  if (report.postProcessing?.crop && report.postProcessing.tone && report.postProcessing.masking) {
    return {
      crop: {
        suggestion: sanitizeUserFacingText(report.postProcessing.crop.suggestion, fallback.crop.suggestion),
        reason: sanitizeUserFacingText(report.postProcessing.crop.reason, fallback.crop.reason),
        expectedEffect: sanitizeUserFacingText(report.postProcessing.crop.expectedEffect, fallback.crop.expectedEffect),
      },
      tone: {
        suggestion: sanitizeUserFacingText(report.postProcessing.tone.suggestion, fallback.tone.suggestion),
        reason: sanitizeUserFacingText(report.postProcessing.tone.reason, fallback.tone.reason),
        expectedEffect: sanitizeUserFacingText(report.postProcessing.tone.expectedEffect, fallback.tone.expectedEffect),
      },
      masking: {
        suggestion: sanitizeUserFacingText(report.postProcessing.masking.suggestion, fallback.masking.suggestion),
        reason: sanitizeUserFacingText(report.postProcessing.masking.reason, fallback.masking.reason),
        expectedEffect: sanitizeUserFacingText(report.postProcessing.masking.expectedEffect, fallback.masking.expectedEffect),
      },
    };
  }

  return fallback;
}

function getScoreSummary(report: Report) {
  const entries = scoreNames.map((name) => ({ name, score: report.scores[name] }));
  const overall = getOverallScore(report);
  const strongest = entries.reduce((best, item) => (item.score > best.score ? item : best), entries[0]);
  const weakest = entries.reduce((lowest, item) => (item.score < lowest.score ? item : lowest), entries[0]);

  return { entries, overall, strongest, weakest };
}

function getProblemTags(report: Report) {
  const weakest = getScoreSummary(report).weakest.name;
  const tags: string[] = ['边缘干扰'];

  if (weakest === '光线') {
    tags.push('光线层次不足');
  } else if (weakest === '构图') {
    tags.push('主体弱化');
  } else if (weakest === '叙事') {
    tags.push('叙事指向不清');
  } else if (weakest === '色彩') {
    tags.push('色彩记忆点不足');
  } else {
    tags.push('技术细节需整理');
  }

  tags.push('观看顺序待强化');
  return tags.slice(0, 3);
}

function getRatingInterpretation(score: number) {
  if (score >= 86) {
    return '具备作品潜力';
  }

  if (score >= 78) {
    return '可进入二次筛选';
  }

  if (score >= 72) {
    return '仍有打磨空间';
  }

  return '适合继续打磨';
}

function getNextShootingActions(report: Report, genre: Genre = '街头摄影') {
  const fallbackByGenre: Record<Genre, NextShootingAdvice> = {
    街头摄影: {
      summary: '下一次拍摄优先观察人物姿态、背景重叠和现场秩序，保留有用的混乱，但让关键关系更快出现。',
      items: ['等待人物动作和背景线索同时成立的瞬间。', '按下快门前检查人物是否与招牌、车辆或路人发生不必要重叠。', '靠近或侧移一步，让现场张力集中在一个主要关系上。'],
    },
    人像摄影: {
      summary: '下一次拍摄优先处理表情、眼神方向和背景分离，让人物状态比环境更先被看见。',
      items: ['先确认眼神或面部朝向是否承载情绪。', '让背景亮点避开头部和肩线，保持人物轮廓干净。', '根据服装和背景颜色调整距离，保留更自然的亲密感。'],
    },
    风景摄影: {
      summary: '下一次拍摄优先等待更有层次的光线，并整理前景、中景和远景之间的路径。',
      items: ['确认地平线和主要线条是否稳定。', '用前景元素建立空间入口，但不要让它抢走光线重心。', '选择光线更有方向的时刻，让空气感和层次更清楚。'],
    },
    建筑摄影: {
      summary: '下一次拍摄优先稳定垂直线和边缘结构，再利用光线塑造建筑体量。',
      items: ['拍摄前检查垂直和水平线是否有无意倾斜。', '让结构节奏在画面边缘也保持完整。', '等待侧光或阴影更清楚地勾勒材料和体块。'],
    },
    静物摄影: {
      summary: '下一次拍摄优先整理物件间距、阴影形状和背景纯度，让材质关系更明确。',
      items: ['调整物件距离，让主次关系一眼可读。', '观察阴影边缘是否帮助塑造形体，而不是制造杂乱。', '保留足够负空间，让材质和形状有呼吸感。'],
    },
    旅行摄影: {
      summary: '下一次拍摄优先寻找地方气息和人的痕迹，避免只留下普通风景记录。',
      items: ['把当地生活线索放入画面，但控制它们的数量。', '等待人物动作、光线和地点标识形成一个清楚关系。', '尝试更具体的拍摄角度，让画面不只是“到此一游”。'],
    },
  };
  const fallback = fallbackByGenre[genre];

  if (report.nextShooting?.summary && report.nextShooting.items?.length) {
    const safeItems = report.nextShooting.items
      .map((item, index) => sanitizeUserFacingText(item, fallback.items[index] ?? fallback.items[0]))
      .slice(0, 3);

    return {
      summary: sanitizeUserFacingText(report.nextShooting.summary, fallback.summary),
      items: safeItems.length ? safeItems : fallback.items,
    };
  }

  return fallback;
}

function formatReportDate(date: string) {
  const match = date.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);

  if (!match) {
    return date;
  }

  return `${match[1]}.${match[2].padStart(2, '0')}.${match[3].padStart(2, '0')}`;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('无法读取上传作品。'));
    };

    image.src = objectUrl;
  });
}

async function compressImageForApi(file: File): Promise<string> {
  const image = await loadImageFromFile(file);
  const maxSize = 768;
  const scale = Math.min(1, maxSize / image.naturalWidth, maxSize / image.naturalHeight);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('浏览器无法压缩上传作品。');
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', 0.55);
}

async function requestAiReport({
  fallbackReport,
  fileName,
  genre,
  imageDataUrl,
  medium,
  signal,
  skillLevel,
  workTitle,
}: {
  fallbackReport: Report;
  fileName: string;
  genre: Genre;
  imageDataUrl: string;
  medium: Medium;
  signal?: AbortSignal;
  skillLevel: SkillLevel;
  workTitle?: string;
}) {
  const apiUrl = getAnalysisApiUrl();

  console.log('Calling analysis API...');
  console.log('imageDataUrl starts with:', imageDataUrl.slice(0, 30));

  if (!imageDataUrl.startsWith('data:image/')) {
    throw new Error('上传作品没有转换为有效的 base64 图片数据。');
  }

  const controller = new AbortController();
  let didTimeout = false;
  const handleExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', handleExternalAbort, { once: true });
  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, ANALYSIS_REQUEST_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageDataUrl,
        fileName,
        medium,
        genre,
        skillLevel,
        critiquePath: skillLevel,
        title: workTitle,
        workTitle,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (signal?.aborted) {
      throw new AnalysisCancelledError();
    }

    if (didTimeout || (error instanceof DOMException && error.name === 'AbortError')) {
      throw new Error('分析请求超时，请稍后重试。');
    }

    throw new Error('无法连接分析服务，请确认本地服务已启动或稍后重试。');
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', handleExternalAbort);
  }

  if (signal?.aborted) throw new AnalysisCancelledError();

  console.log('Analysis API status:', response.status);

  if (!response.ok) {
    let serverMessage = '';

    try {
      const errorPayload = await response.json();
      serverMessage = typeof errorPayload?.error === 'string' ? errorPayload.error : '';
    } catch {
      // The status-specific message below is clearer than exposing invalid response text.
    }

    if (response.status === 503) {
      throw new Error(serverMessage || '分析服务尚未配置 API，请检查项目根目录的 .env。');
    }

    if (response.status === 504) {
      throw new Error(serverMessage || '上游图像分析超时，请稍后重试。');
    }

    throw new Error(serverMessage || `分析服务返回错误（HTTP ${response.status}）。`);
  }

  let data: { ok?: boolean; error?: string; report?: unknown };

  try {
    data = await response.json();
  } catch {
    if (signal?.aborted) throw new AnalysisCancelledError();
    throw new Error('分析服务返回了无法读取的数据，请稍后重试。');
  }

  if (signal?.aborted) throw new AnalysisCancelledError();

  if (data.ok === false) {
    throw new Error(data.error || 'AI 分析接口返回失败。');
  }

  if (!data.report || typeof data.report !== 'object') {
    throw new Error('AI 分析接口没有返回有效报告。');
  }

  console.log('Analysis API success');

  return mergeAiReportWithFallback(data.report, fallbackReport, getReviewContext(medium, genre, skillLevel));
}

function getAnalysisApiUrl() {
  return import.meta.env?.VITE_ANALYSIS_API_URL || DEFAULT_ANALYSIS_API_URL;
}

function getSaveReportHistoryApiUrl() {
  const apiUrl = getAnalysisApiUrl();

  try {
    return new URL('/api/save-report-history', apiUrl).toString();
  } catch {
    return apiUrl.replace(/\/api\/analyze-photo$/, '/api/save-report-history') || '/api/save-report-history';
  }
}

function getPersistedImageUrl(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.startsWith('data:image/') || value.startsWith('https://') || value.startsWith('http://') ? value : '';
}

function getReportSource(value: unknown): ReportSource {
  return value === 'ai' || value === 'mock' ? value : 'legacy';
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function loadStoredHistoryRecords(): HistoryRecord[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(HISTORY_STORAGE_KEY);

    if (!storedValue) {
      return [];
    }

    const parsedValue = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .filter((record) => record && typeof record.id === 'string' && typeof record.report === 'object')
      .map((record) => {
        const medium = mediums.includes(record.medium) ? record.medium : '数码摄影';
        const genre = genres.includes(record.genre ?? record.subject) ? record.genre ?? record.subject : '街头摄影';
        const skillLevel = skillLevels.includes(record.skillLevel ?? record.critiqueLevel) ? record.skillLevel ?? record.critiqueLevel : '初学者';
        const fallbackReport = createMockReport(genre, skillLevel, medium);
        const report = mergeAiReportWithFallback(record.report, fallbackReport, getReviewContext(medium, genre, skillLevel));
        const createdAt = typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString();

        return {
          ...record,
          title: typeof record.title === 'string' && record.title ? record.title : '历史点评记录',
          imageUrl: getPersistedImageUrl(record.imageUrl),
          fileName: typeof record.fileName === 'string' ? record.fileName : '未命名照片',
          medium,
          subject: genre,
          genre,
          critiqueLevel: skillLevel,
          skillLevel,
          date: typeof record.date === 'string' ? record.date : new Date(createdAt).toLocaleDateString('zh-CN'),
          dateTime: typeof record.dateTime === 'string' ? record.dateTime : new Date(createdAt).toLocaleString('zh-CN'),
          createdAt,
          report,
          reportSource: getReportSource(record.reportSource),
          analysisError: typeof record.analysisError === 'string' ? record.analysisError : undefined,
          overallScore: typeof record.overallScore === 'number' ? record.overallScore : getOverallScore(report),
          tags: Array.isArray(record.tags) ? record.tags : getHistoryTags(genre, skillLevel, medium),
          summary: typeof record.summary === 'string' ? record.summary : getCoreDiagnosis(report, genre).direction,
          strongestDimension: scoreNames.includes(record.strongestDimension) ? record.strongestDimension : getScoreSummaryDimensions(report).strongestDimension,
          weakestDimension: scoreNames.includes(record.weakestDimension) ? record.weakestDimension : getScoreSummaryDimensions(report).weakestDimension,
        } as HistoryRecord;
      })
      .slice(0, MAX_HISTORY_RECORDS);
  } catch (error) {
    console.warn('Failed to restore PhotoSense history records from localStorage', error);
    return [];
  }
}

async function syncReportHistoryToProject(historyRecords: HistoryRecord[]) {
  if (!HISTORY_EXPORT_ENABLED) return;

  const response = await fetch(getSaveReportHistoryApiUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app: 'PhotoSense AI',
      exportedAt: new Date().toISOString(),
      recordCount: historyRecords.length,
      records: historyRecords,
    }),
  });

  if (!response.ok) {
    throw new Error(`Save report history failed: ${response.status}`);
  }
}

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedMedium, setSelectedMedium] = useState<Medium>('数码摄影');
  const [selectedGenre, setSelectedGenre] = useState<Genre>('街头摄影');
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('初学者');
  const [photoTitle, setPhotoTitle] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisElapsedSeconds, setAnalysisElapsedSeconds] = useState(0);
  const [analysisState, setAnalysisState] = useState<AnalysisState>({ kind: 'idle' });
  const [report, setReport] = useState<Report | null>(null);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>(loadStoredHistoryRecords);
  const [activeRecord, setActiveRecord] = useState<HistoryRecord | null>(null);
  const [copyStatus, setCopyStatus] = useState('复制报告');
  const [skillTooltip, setSkillTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const historySyncTimerRef = useRef<number | null>(null);
  const analysisAbortRef = useRef<AbortController | null>(null);

  const currentDate = useMemo(
    () =>
      new Intl.DateTimeFormat('zh-CN', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date()),
    [],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyRecords));
    } catch (error) {
      console.warn('Failed to save PhotoSense history records to localStorage', error);
    }

    if (historySyncTimerRef.current) {
      window.clearTimeout(historySyncTimerRef.current);
      historySyncTimerRef.current = null;
    }

    if (historyRecords.length === 0) {
      return undefined;
    }

    historySyncTimerRef.current = window.setTimeout(() => {
      syncReportHistoryToProject(historyRecords).catch((error) => {
        console.warn('Report history auto-save skipped. Is the local backend running?', error);
      });
    }, 600);

    return () => {
      if (historySyncTimerRef.current) {
        window.clearTimeout(historySyncTimerRef.current);
        historySyncTimerRef.current = null;
      }
    };
  }, [historyRecords]);

  useEffect(() => {
    if (!isAnalyzing) return undefined;

    const startedAt = Date.now();
    const timerId = window.setInterval(() => {
      setAnalysisElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isAnalyzing]);

  useEffect(() => {
    return () => analysisAbortRef.current?.abort();
  }, []);

  function goToPage(page: Page) {
    setCurrentPage(page);
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
  }

  function handleAuthSuccess() {
    setIsLoggedIn(true);
    goToPage('home');
  }

  function handleLogout() {
    setIsLoggedIn(false);
    goToPage('home');
  }

  function handleImageFile(file: File) {
    const validation = validateImageFile(file);

    if (!validation.ok) {
      setUploadError(validation.error);
      return;
    }

    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    if (imageUrl.startsWith('blob:')) URL.revokeObjectURL(imageUrl);

    setUploadError('');
    setImageUrl(URL.createObjectURL(file));
    setUploadedFile(file);
    setFileName(file.name);
    setIsAnalyzing(false);
    setAnalysisElapsedSeconds(0);
    setAnalysisState({ kind: 'idle' });
    setReport(null);
    setActiveRecord(null);
    setCopyStatus('复制报告');
  }

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) handleImageFile(file);
    event.target.value = '';
  }

  function handleRemoveImage() {
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    if (imageUrl.startsWith('blob:')) URL.revokeObjectURL(imageUrl);
    setImageUrl('');
    setUploadedFile(null);
    setFileName('');
    setUploadError('');
    setIsAnalyzing(false);
    setAnalysisElapsedSeconds(0);
    setAnalysisState({ kind: 'idle' });
    setReport(null);
    setActiveRecord(null);
    setCopyStatus('复制报告');
  }

  async function handleAnalyze() {
    if (!imageUrl) {
      return;
    }

    analysisAbortRef.current?.abort();
    const requestController = new AbortController();
    analysisAbortRef.current = requestController;
    setAnalysisElapsedSeconds(0);
    setIsAnalyzing(true);
    setAnalysisState({ kind: 'analyzing', phase: 'preparing', message: '正在准备图片。' });
    setReport(null);
    setCopyStatus('复制报告');

    const fallbackReport = createMockReport(selectedGenre, skillLevel, selectedMedium);
    let nextReport = fallbackReport;
    let reportSource: ReportSource = 'ai';
    let analysisError: string | undefined;
    let imageDataUrl = '';

    try {
      if (!uploadedFile) {
        throw new Error('缺少原始上传文件，无法发送到分析接口。');
      }

      console.log('original file size:', uploadedFile.size);
      imageDataUrl = await compressImageForApi(uploadedFile);
      console.log('compressed imageDataUrl length:', imageDataUrl.length);

      if (requestController.signal.aborted) {
        setIsAnalyzing(false);
        setAnalysisState({ kind: 'cancelled', message: '分析已取消，照片和点评参数已保留。' });
        return;
      }
    } catch (error) {
      if (requestController.signal.aborted) {
        setIsAnalyzing(false);
        setAnalysisState({ kind: 'cancelled', message: '分析已取消，照片和点评参数已保留。' });
        if (analysisAbortRef.current === requestController) analysisAbortRef.current = null;
        return;
      }

      const message = getErrorMessage(error, '无法读取这张照片，请更换图片后重试。');
      console.error('Image preparation failed', error);
      setIsAnalyzing(false);
      setAnalysisState({ kind: 'error', message });
      if (analysisAbortRef.current === requestController) analysisAbortRef.current = null;
      return;
    }

    setAnalysisState({ kind: 'analyzing', phase: 'connecting', message: '正在连接分析服务。' });
    const phaseTimerId = window.setTimeout(() => {
      if (!requestController.signal.aborted) {
        setAnalysisState({ kind: 'analyzing', phase: 'analyzing', message: '正在分析构图、光线与画面关系。' });
      }
    }, 1600);

    try {
      nextReport = await requestAiReport({
        fallbackReport,
        fileName,
        genre: selectedGenre,
        imageDataUrl,
        medium: selectedMedium,
        signal: requestController.signal,
        skillLevel,
        workTitle: photoTitle.trim() || undefined,
      });
      window.clearTimeout(phaseTimerId);
      setAnalysisState({ kind: 'analyzing', phase: 'formatting', message: '分析完成，正在整理报告。' });
      await new Promise((resolve) => window.setTimeout(resolve, 220));

      if (requestController.signal.aborted) {
        setIsAnalyzing(false);
        setAnalysisState({ kind: 'cancelled', message: '分析已取消，照片和点评参数已保留。' });
        if (analysisAbortRef.current === requestController) analysisAbortRef.current = null;
        return;
      }

      setAnalysisState({ kind: 'ai', message: '本次报告由实时图像分析生成。' });
    } catch (error) {
      window.clearTimeout(phaseTimerId);

      if (error instanceof AnalysisCancelledError || requestController.signal.aborted) {
        setIsAnalyzing(false);
        setAnalysisState({ kind: 'cancelled', message: '分析已取消，照片和点评参数已保留。' });
        if (analysisAbortRef.current === requestController) analysisAbortRef.current = null;
        return;
      }

      console.warn('AI request failed, using mock fallback', error);
      reportSource = 'mock';
      analysisError = getErrorMessage(error, '分析服务暂时不可用。');
      setAnalysisState({
        kind: 'mock',
        message: `分析服务暂时不可用，当前显示示例报告。${analysisError}`,
      });
    }

    const now = new Date();
    const createdAt = now.toISOString();
    const dateTime = new Intl.DateTimeFormat('zh-CN', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(now);
    const dimensions = getScoreSummaryDimensions(nextReport);
    const coreDiagnosis = getCoreDiagnosis(nextReport, selectedGenre);
    const nextRecord: HistoryRecord = {
      id: `${Date.now()}`,
      title: photoTitle.trim() || getFallbackHistoryTitle(selectedGenre),
      imageUrl: imageDataUrl,
      fileName: fileName || '未命名照片',
      medium: selectedMedium,
      subject: selectedGenre,
      genre: selectedGenre,
      critiqueLevel: skillLevel,
      skillLevel,
      date: currentDate,
      dateTime,
      createdAt,
      report: nextReport,
      reportSource,
      analysisError,
      overallScore: getOverallScore(nextReport),
      tags: [...getHistoryTags(selectedGenre, skillLevel, selectedMedium), ...getProblemTags(nextReport).slice(0, 1)],
      summary: coreDiagnosis.direction,
      strongestDimension: dimensions.strongestDimension,
      weakestDimension: dimensions.weakestDimension,
    };

    if (imageUrl.startsWith('blob:')) URL.revokeObjectURL(imageUrl);
    setImageUrl(imageDataUrl);
    setReport(nextReport);
    setActiveRecord(nextRecord);
    setHistoryRecords((records) => [nextRecord, ...records].slice(0, MAX_HISTORY_RECORDS));
    setIsAnalyzing(false);
    if (analysisAbortRef.current === requestController) analysisAbortRef.current = null;
    goToPage('report');
  }

  function handleCancelAnalysis() {
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    setIsAnalyzing(false);
    setAnalysisState({ kind: 'cancelled', message: '分析已取消，照片和点评参数已保留。' });
  }

  function handleRetryAnalysis() {
    if (activeRecord?.reportSource === 'mock') {
      setHistoryRecords((records) => records.filter((record) => record.id !== activeRecord.id));
      setActiveRecord(null);
    }
    goToPage('review');
    window.setTimeout(() => void handleAnalyze(), 0);
  }

  function handleReset() {
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    if (imageUrl && !historyRecords.some((record) => record.imageUrl === imageUrl)) {
      URL.revokeObjectURL(imageUrl);
    }

    setImageUrl('');
    setUploadedFile(null);
    setFileName('');
    setUploadError('');
    setPhotoTitle('');
    setSelectedMedium('数码摄影');
    setSelectedGenre('街头摄影');
    setSkillLevel('初学者');
    setIsAnalyzing(false);
    setAnalysisElapsedSeconds(0);
    setAnalysisState({ kind: 'idle' });
    setReport(null);
    setActiveRecord(null);
    setCopyStatus('复制报告');
    setSkillTooltip(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleCopyReport() {
    const reportToCopy = activeRecord?.report ?? report;

    if (!reportToCopy) {
      return;
    }

    const reportMedium = activeRecord?.medium ?? selectedMedium;
    const reportGenre = activeRecord?.genre ?? selectedGenre;
    const reportSkillLevel = activeRecord?.skillLevel ?? skillLevel;
    const reportVerdict = getReportVerdict(reportToCopy, reportGenre);
    const reviewContext = getResolvedReviewContext(reportToCopy, reportMedium, reportGenre, reportSkillLevel);
    const postProcessing = getPostProcessingAdvice(reportToCopy);
    const nextShooting = getNextShootingActions(reportToCopy, reportGenre);
    const scoreReasons = getScoreReasons(reportToCopy);
    const photoSpecific = getPhotoSpecificFeedback(reportToCopy, reportGenre);
    const scoreText = scoreNames.map((name) => `${name}：${reportToCopy.scores[name]}/100\n评分依据：${scoreReasons[name]}`).join('\n');
    const postProcessingText = [
      `1. 裁剪建议：${postProcessing.crop.suggestion}\n理由：${postProcessing.crop.reason}\n预期效果：${postProcessing.crop.expectedEffect}`,
      `2. 影调修改建议：${postProcessing.tone.suggestion}\n理由：${postProcessing.tone.reason}\n预期效果：${postProcessing.tone.expectedEffect}`,
      `3. 蒙版提亮 / 压暗建议：${postProcessing.masking.suggestion}\n理由：${postProcessing.masking.reason}\n预期效果：${postProcessing.masking.expectedEffect}`,
    ].join('\n');
    const nextShootingText = [nextShooting.summary, ...nextShooting.items.map((item, index) => `${index + 1}. ${item}`)].join('\n');

    const text = `PhotoSense AI 摄影评审报告\n影像介质：${reportMedium}\n摄影题材：${reportGenre}\n点评口径：${reportSkillLevel}\n\n本次评价基准\n影像介质：${reviewContext.mediumFocus}\n点评口径：${reviewContext.levelFocus}\n摄影题材：${reviewContext.genreFocus}\n评分侧重：${reviewContext.scoringLogic}\n\n评审结论\n${reportVerdict.title}\n${reportVerdict.summary}\n主要问题：${reportVerdict.mainIssue}\n下一步：${reportVerdict.nextStep}\n\n照片重点\n值得保留：${photoSpecific.strength}\n优先问题：${photoSpecific.priorityIssue}\n画面区域：${photoSpecific.affectedArea}\n下一步动作：${photoSpecific.nextAction}\n裁剪参考：${photoSpecific.crop.ratio}，${photoSpecific.crop.direction}\n裁剪理由：${photoSpecific.crop.rationale}\n\n总体印象\n${reportToCopy.overall}\n\n评分\n${scoreText}\n\n构图分析\n${reportToCopy.composition}\n\n光线分析\n${reportToCopy.lighting}\n\n色彩分析\n${reportToCopy.colour}\n\n叙事分析\n${reportToCopy.storytelling}\n\n技术完成度\n${reportToCopy.technical}\n\n后期建议\n${postProcessingText}\n\n下次拍摄建议\n${nextShootingText}`;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        const copyArea = document.createElement('textarea');
        copyArea.value = text;
        document.body.appendChild(copyArea);
        copyArea.select();
        document.execCommand('copy');
        document.body.removeChild(copyArea);
      }

      setCopyStatus('已复制');
    } catch {
      setCopyStatus('复制失败');
    }

    window.setTimeout(() => setCopyStatus('复制报告'), 1600);
  }

  function handleOpenHistoryRecord(record: HistoryRecord) {
    setActiveRecord(record);
    setReport(record.report);
    setAnalysisState({
      kind: record.reportSource === 'ai' ? 'ai' : record.reportSource === 'mock' ? 'mock' : 'idle',
      message: record.analysisError,
    });
    setCopyStatus('复制报告');
    goToPage('report');
  }

  function handleDeleteHistoryRecord(recordId: string) {
    setHistoryRecords((records) => records.filter((record) => record.id !== recordId));

    if (activeRecord?.id === recordId) {
      setActiveRecord(null);
      setReport(null);
      setAnalysisState({ kind: 'idle' });
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand brand-button" type="button" onClick={() => goToPage('home')} aria-label="PhotoSense AI 首页">
          <span className="brand-text">PhotoSense AI</span>
        </button>
        <nav className="nav-links" aria-label="主导航">
          <button className={currentPage === 'home' ? 'active' : ''} type="button" onClick={() => goToPage('home')}>
            首页
          </button>
          <button className={currentPage === 'review' ? 'active' : ''} type="button" onClick={() => goToPage('review')}>
            开始点评
          </button>
          <button className={currentPage === 'report' ? 'active' : ''} type="button" onClick={() => goToPage('report')}>
            分析报告
          </button>
          <button className={currentPage === 'history' ? 'active' : ''} type="button" onClick={() => goToPage('history')}>
            历史记录
          </button>
        </nav>
        <div className="header-actions" aria-label="用户入口">
          {isLoggedIn ? (
            <button className="login-button active" type="button" onClick={handleLogout}>
              登出
            </button>
          ) : (
            <>
              <button className={currentPage === 'login' ? 'login-button active' : 'login-button'} type="button" onClick={() => goToPage('login')}>
                登录
              </button>
              <button
                className={currentPage === 'register' ? 'login-button active' : 'login-button'}
                type="button"
                onClick={() => goToPage('register')}
              >
                注册
              </button>
            </>
          )}
          <button className="user-entry" type="button" aria-label="用户入口">
            <span>{isLoggedIn ? '已' : '访'}</span>
          </button>
        </div>
      </header>

      {currentPage === 'home' && <HomePage onStartReview={() => goToPage('review')} />}

      {currentPage === 'review' && (
        <ReviewPage
          analysisState={analysisState}
          analysisElapsedSeconds={analysisElapsedSeconds}
          currentDate={currentDate}
          fileInputRef={fileInputRef}
          fileName={fileName}
          fileSize={uploadedFile?.size ?? 0}
          imageUrl={imageUrl}
          isAnalyzing={isAnalyzing}
          onAnalyze={handleAnalyze}
          onCancelAnalysis={handleCancelAnalysis}
          onImageFile={handleImageFile}
          onImageUpload={handleImageUpload}
          onRemoveImage={handleRemoveImage}
          onPhotoTitleChange={setPhotoTitle}
          onReset={handleReset}
          onSelectMedium={setSelectedMedium}
          onSelectGenre={setSelectedGenre}
          onSelectSkillLevel={setSkillLevel}
          onSetReport={(nextReport) => {
            setReport(nextReport);
            if (!nextReport) {
              setActiveRecord(null);
            }
          }}
          onSetSkillTooltip={setSkillTooltip}
          selectedGenre={selectedGenre}
          selectedMedium={selectedMedium}
          photoTitle={photoTitle}
          skillLevel={skillLevel}
          skillTooltip={skillTooltip}
          uploadError={uploadError}
        />
      )}

      {currentPage === 'report' && (
        <ReportPage
          activeRecord={activeRecord}
          analysisState={analysisState}
          canRetryAnalysis={Boolean(uploadedFile && activeRecord?.imageUrl === imageUrl)}
          copyStatus={copyStatus}
          currentDate={currentDate}
          fileName={fileName}
          imageUrl={imageUrl}
          isAnalyzing={isAnalyzing}
          onCopyReport={handleCopyReport}
          onGoHistory={() => goToPage('history')}
          onRetryAnalysis={handleRetryAnalysis}
          onStartReview={() => goToPage('review')}
          report={report}
          selectedGenre={selectedGenre}
          selectedMedium={selectedMedium}
          skillLevel={skillLevel}
        />
      )}

      {currentPage === 'history' && (
        <HistoryPage historyRecords={historyRecords} onDeleteRecord={handleDeleteHistoryRecord} onOpenRecord={handleOpenHistoryRecord} />
      )}
      {currentPage === 'login' && <LoginPage onAuthSuccess={handleAuthSuccess} onSwitch={() => goToPage('register')} />}
      {currentPage === 'register' && <RegisterPage onAuthSuccess={handleAuthSuccess} onSwitch={() => goToPage('login')} />}

      <footer className="site-footer">
        <p>用于整理摄影反馈与复盘记录的 AI 辅助工具。</p>
      </footer>
    </div>
  );
}

function HomePage({ onStartReview }: { onStartReview: () => void }) {
  return (
    <main className="page-main page-home">
      <div className="home-gallery-background" aria-hidden="true">
        {homeBackgroundCollage.map(({ src, className }, index) => (
          <figure className={`home-collage-card ${className}`} key={`${className}-${src}`}>
            <img src={src} alt="" loading={index < 6 ? 'eager' : 'lazy'} />
          </figure>
        ))}
      </div>

      <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">AI 摄影点评助手</p>
            <h1 id="hero-title">PhotoSense AI</h1>
            <p className="hero-text">
              一个面向摄影反馈与复盘的网页工具。上传照片后，系统会结合影像介质、题材和反馈口径，从构图、光线、色彩、叙事与技术完成度几个角度整理出结构化反馈。
            </p>
            <div className="hero-actions">
              <button className="primary-link" type="button" onClick={onStartReview}>
                开始点评
              </button>
              <span>上传一张照片，查看一份结构化摄影反馈。</span>
            </div>
            <dl className="hero-metrics hero-capability-line" aria-label="产品能力概览">
              <div>
                <dt>5</dt>
                <dd>观察角度</dd>
              </div>
              <div>
                <dt>6</dt>
                <dd>摄影题材</dd>
              </div>
              <div>
                <dt>2</dt>
                <dd>影像介质</dd>
              </div>
              <div>
                <dt>3</dt>
                <dd>反馈口径</dd>
              </div>
            </dl>
          </div>

          <div className="feature-preview" aria-label="功能流程展示区">
            <div className="product-preview-card">
              <div className="preview-contact-sheet" aria-label="样片接触印相">
                <img src={homeAssets.street} alt="街头摄影样片" />
                <img src={homeAssets.portrait} alt="人像摄影样片" />
                <img src={homeAssets.landscape} alt="风景摄影样片" />
                <img src={homeAssets.architecture} alt="建筑摄影样片" />
              </div>
              <div className="mini-report-preview" aria-label="摄影诊断报告缩略预览">
                <div>
                  <span>综合评分</span>
                  <strong>82</strong>
                </div>
                <ul>
                  <li><span>构图</span><i style={{ width: '78%' }} /></li>
                  <li><span>光线</span><i style={{ width: '74%' }} /></li>
                  <li><span>色彩</span><i style={{ width: '81%' }} /></li>
                  <li><span>叙事</span><i style={{ width: '76%' }} /></li>
                  <li><span>技术</span><i style={{ width: '83%' }} /></li>
                </ul>
              </div>
            </div>
            <ol className="flow-steps">
              <li>
                <span>01</span>
                <strong>选择照片语境</strong>
                <p>选择介质、题材和适合的反馈口径。</p>
              </li>
              <li>
                <span>02</span>
                <strong>上传一张照片</strong>
                <p>在页面中确认照片和基础信息。</p>
              </li>
              <li>
                <span>03</span>
                <strong>查看反馈报告</strong>
                <p>从多个观察角度理解画面问题。</p>
              </li>
              <li>
                <span>04</span>
                <strong>保存分析记录</strong>
                <p>之后可以在历史记录中回看。</p>
              </li>
            </ol>
          </div>
      </section>

      <section className="home-workflow-strip" aria-label="产品使用流程">
        <div><span>01</span><strong>选择介质</strong></div>
        <div><span>02</span><strong>选择反馈口径</strong></div>
        <div><span>03</span><strong>上传照片</strong></div>
        <div><span>04</span><strong>查看反馈</strong></div>
        <div><span>05</span><strong>保存记录</strong></div>
      </section>

      <section className="home-support" aria-label="摄影反馈方式">
          <div className="support-grid">
            <article>
              <img src={homeStoryboards.observation} alt="照片观察点拆解示意图" />
              <p className="panel-kicker">从感觉到问题</p>
              <h3>把“哪里不对”拆成更具体的观察点</h3>
              <p>系统会围绕构图、光线、色彩、叙事与技术完成度展开反馈，让模糊感受变成可调整的问题。</p>
            </article>
            <article>
              <img src={homeStoryboards.context} alt="按题材和介质调整反馈重点示意图" />
              <p className="panel-kicker">按语境调整反馈</p>
              <h3>不同题材和介质，会触发不同观察重点</h3>
              <p>街头、人像、风景、建筑、静物、旅行等类型不会被同一种标准处理，反馈会尽量贴合作品语境。</p>
            </article>
            <article>
              <img src={homeStoryboards.archive} alt="分析记录保存示意图" />
              <p className="panel-kicker">留下复盘记录</p>
              <h3>每次分析都可以保存，方便之后回看</h3>
              <p>分析结果可以进入历史记录，之后按介质、题材、日期和评分回看，观察自己的拍摄变化。</p>
            </article>
          </div>
      </section>

    </main>
  );
}

type ReviewPageProps = {
  analysisState: AnalysisState;
  analysisElapsedSeconds: number;
  currentDate: string;
  fileInputRef: RefObject<HTMLInputElement>;
  fileName: string;
  fileSize: number;
  imageUrl: string;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  onCancelAnalysis: () => void;
  onImageFile: (file: File) => void;
  onImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onPhotoTitleChange: (title: string) => void;
  onReset: () => void;
  onSelectMedium: (medium: Medium) => void;
  onSelectGenre: (genre: Genre) => void;
  onSelectSkillLevel: (level: SkillLevel) => void;
  onSetReport: (report: Report | null) => void;
  onSetSkillTooltip: (tooltip: { text: string; x: number; y: number } | null) => void;
  photoTitle: string;
  selectedGenre: Genre;
  selectedMedium: Medium;
  skillLevel: SkillLevel;
  skillTooltip: { text: string; x: number; y: number } | null;
  uploadError: string;
};

function ReviewPage({
  analysisState,
  analysisElapsedSeconds,
  currentDate,
  fileInputRef,
  fileName,
  fileSize,
  imageUrl,
  isAnalyzing,
  onAnalyze,
  onCancelAnalysis,
  onImageFile,
  onImageUpload,
  onRemoveImage,
  onPhotoTitleChange,
  onReset,
  onSelectMedium,
  onSelectGenre,
  onSelectSkillLevel,
  onSetReport,
  onSetSkillTooltip,
  selectedGenre,
  selectedMedium,
  photoTitle,
  skillLevel,
  skillTooltip,
  uploadError,
}: ReviewPageProps) {
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  function openFilePicker() {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }

  function handleFileDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingFile(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onImageFile(file);
  }

  const canRetry = imageUrl && (analysisState.kind === 'error' || analysisState.kind === 'cancelled');

  return (
    <main className="page-main page-review">
      <section className="review-desk page-view" aria-label="开始点评工作台">
          <div className="review-worktable">
            <aside className="review-controls" aria-label="点评流程控制">
              <section className="sequence-block medium-block">
                <div className="step-label">
                  <span>01</span>
                  <p>影像介质</p>
                </div>
                <div className="level-toggle">
                  {mediums.map((medium) => (
                    <button
                      className={selectedMedium === medium ? 'level-button active' : 'level-button'}
                      key={medium}
                      type="button"
                      onClick={() => {
                        onSelectMedium(medium);
                        onSetReport(null);
                      }}
                    >
                      {medium}
                    </button>
                  ))}
                </div>
              </section>

              <section className="sequence-block skill-block">
                <div className="step-label">
                  <span>02</span>
                  <p>点评口径</p>
                </div>
                <div className="level-toggle">
                  {skillLevels.map((level) => (
                    <button
                      className={skillLevel === level ? 'level-button active' : 'level-button'}
                      key={level}
                      type="button"
                      onMouseEnter={(event) =>
                        onSetSkillTooltip({ text: skillTooltips[level], x: event.clientX, y: event.clientY })
                      }
                      onMouseMove={(event) =>
                        onSetSkillTooltip({ text: skillTooltips[level], x: event.clientX, y: event.clientY })
                      }
                      onMouseLeave={() => onSetSkillTooltip(null)}
                      onFocus={(event) =>
                        onSetSkillTooltip({
                          text: skillTooltips[level],
                          x: event.currentTarget.getBoundingClientRect().left + 20,
                          y: event.currentTarget.getBoundingClientRect().bottom,
                        })
                      }
                      onBlur={() => onSetSkillTooltip(null)}
                      onClick={() => {
                        onSelectSkillLevel(level);
                        onSetReport(null);
                      }}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </section>

              <section className="sequence-block genre-block">
                <div className="step-label">
                  <span>03</span>
                  <p>摄影题材</p>
                </div>
                <div className="genre-orbit">
                  {genres.map((genre, index) => (
                    <button
                      className={selectedGenre === genre ? `genre-button genre-${index + 1} active` : `genre-button genre-${index + 1}`}
                      key={genre}
                      type="button"
                      onClick={() => {
                        onSelectGenre(genre);
                        onSetReport(null);
                      }}
                    >
                      <span>{genre}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="sequence-block upload-command">
                <div className="step-label">
                  <span>04</span>
                  <p>上传作品</p>
                </div>
                <div
                  className={`rounded-control upload-status-card upload-drop-zone ${isDraggingFile ? 'is-dragging' : ''}`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDraggingFile(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDraggingFile(false);
                  }}
                  onDrop={handleFileDrop}
                >
                  <div>
                    <p className="panel-kicker">作品状态</p>
                    <h3>{fileName || '等待选择影像文件'}</h3>
                    <p>{fileName ? `${formatFileSize(fileSize)} · 可拖入另一张照片直接更换` : '拖入照片，或点击下方按钮选择 JPG、PNG、WebP（最大 15 MB）。'}</p>
                  </div>
                  {uploadError ? <p className="upload-error" role="alert">{uploadError}</p> : null}
                  <label className="photo-title-field">
                    <span>作品标题（选填）</span>
                    <input
                      type="text"
                      value={photoTitle}
                      placeholder="例如：午后立面、街角等待、雾中山脊"
                      onChange={(event) => onPhotoTitleChange(event.target.value)}
                    />
                  </label>
                  <div className="upload-file-actions">
                    <button className="secondary-button rounded-command" type="button" onClick={openFilePicker}>
                      {imageUrl ? '更换照片' : '选择照片'}
                    </button>
                    {imageUrl ? (
                      <button className="upload-remove-button rounded-command" type="button" onClick={onRemoveImage}>
                        移除照片
                      </button>
                    ) : null}
                  </div>
                  <input
                    ref={fileInputRef}
                    className="visually-hidden"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    onChange={onImageUpload}
                  />
                  <p className="upload-privacy-note">
                    照片仅发送给你配置的分析服务；服务器默认不永久保存原图，历史缩略图保存在当前浏览器。
                  </p>
                </div>
              </section>

              <section className="sequence-block action-block">
                <div className="step-label">
                  <span>05</span>
                  <p>开始分析</p>
                </div>
                <div className="desk-actions rounded-actions">
                  <button className="analyze-button rounded-command" type="button" disabled={!imageUrl || isAnalyzing} onClick={onAnalyze}>
                    {isAnalyzing ? '正在分析影像' : canRetry ? '重新分析' : '开始分析'}
                  </button>
                  {isAnalyzing ? (
                    <button className="cancel-analysis-button rounded-command" type="button" onClick={onCancelAnalysis}>
                      取消分析
                    </button>
                  ) : (
                    <button className="reset-button rounded-command" type="button" onClick={onReset}>
                      重置
                    </button>
                  )}
                  {isAnalyzing ? (
                    <div className="analysis-progress" aria-label="分析进度">
                      <ol>
                        {analysisPhases.map((phase) => (
                          <li className={`phase-${getAnalysisPhaseStatus(analysisState.phase, phase.id)}`} key={phase.id}>
                            <span aria-hidden="true" />
                            <strong>{phase.label}</strong>
                          </li>
                        ))}
                      </ol>
                      <p>{getAnalysisWaitMessage(analysisElapsedSeconds)}</p>
                    </div>
                  ) : null}
                  <p className={`analysis-helper analysis-state-${analysisState.kind}`} role={analysisState.kind === 'error' || analysisState.kind === 'mock' ? 'alert' : 'status'}>
                    {analysisState.message ?? (imageUrl ? '已准备查看反馈报告' : '请先上传作品')}
                  </p>
                </div>
              </section>

            </aside>

            <section className="review-preview" aria-label="照片上传与预览">
              <div className="preview-header">
                <div>
                  <p className="panel-kicker">审片灯台</p>
                  <h3>{fileName ? '作品已进入点评流程' : '请先上传一张照片'}</h3>
                  <p>{fileName ? '作品已载入审片灯台，可查看反馈报告。' : '上传后会在灯台区域生成大图预览。'}</p>
                </div>

              </div>

              <div
                className={`preview-stage ${imageUrl ? 'has-image' : ''} ${isDraggingFile ? 'is-dragging' : ''}`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDraggingFile(false);
                }}
                onDrop={handleFileDrop}
              >
                {imageUrl ? (
                  <img src={imageUrl} alt="已上传照片预览" />
                ) : (
                  <div className="empty-preview light-table-empty">
                    <span>待审</span>
                    <p>上传后会在灯台区域生成大图预览</p>
                  </div>
                )}
              </div>

              <div className="frame-metadata" aria-label="已上传照片信息">
                <span>{fileName ? '已上传' : '尚未选择文件'}</span>
                {fileName ? <span>{fileName}</span> : null}
                <span>{selectedMedium}</span>
                <span>{skillLevel}口径</span>
                <span>{selectedGenre}</span>
                <span>{currentDate}</span>
              </div>
            </section>
          </div>

          {skillTooltip ? (
            <div className="skill-tooltip" style={{ left: skillTooltip.x + 18, top: skillTooltip.y + 18 }}>
              {skillTooltip.text}
            </div>
          ) : null}
      </section>
    </main>
  );
}

type ReportPageProps = {
  activeRecord: HistoryRecord | null;
  analysisState: AnalysisState;
  canRetryAnalysis: boolean;
  copyStatus: string;
  currentDate: string;
  fileName: string;
  imageUrl: string;
  isAnalyzing: boolean;
  onCopyReport: () => void;
  onGoHistory: () => void;
  onRetryAnalysis: () => void;
  onStartReview: () => void;
  report: Report | null;
  selectedGenre: Genre;
  selectedMedium: Medium;
  skillLevel: SkillLevel;
};

const reportNavItems = [
  { id: 'report-overview', label: '总览' },
  { id: 'report-dimensions', label: '五维诊断' },
  { id: 'report-post-processing', label: '后期建议' },
  { id: 'report-next-actions', label: '下次行动' },
];

function ReportPage({
  activeRecord,
  analysisState,
  canRetryAnalysis,
  copyStatus,
  currentDate,
  fileName,
  imageUrl,
  isAnalyzing,
  onCopyReport,
  onGoHistory,
  onRetryAnalysis,
  onStartReview,
  report,
  selectedGenre,
  selectedMedium,
  skillLevel,
}: ReportPageProps) {
  const displayedReport = activeRecord?.report ?? report;
  const displayedFileName = (activeRecord?.fileName ?? fileName) || '未命名照片';
  const displayedImageUrl = activeRecord?.imageUrl ?? imageUrl;
  const displayedMedium = activeRecord?.medium ?? selectedMedium;
  const displayedGenre = activeRecord?.genre ?? selectedGenre;
  const displayedSkillLevel = activeRecord?.skillLevel ?? skillLevel;
  const displayedDate = activeRecord?.date ?? currentDate;
  const displayedSource: ReportSource = activeRecord?.reportSource ?? (analysisState.kind === 'mock' ? 'mock' : analysisState.kind === 'ai' ? 'ai' : 'legacy');
  const displayedAnalysisError = activeRecord?.analysisError ?? (analysisState.kind === 'mock' || analysisState.kind === 'error' ? analysisState.message : undefined);
  const reportVerdict = displayedReport ? getReportVerdict(displayedReport, displayedGenre) : null;
  const reviewContext = getResolvedReviewContext(displayedReport, displayedMedium, displayedGenre, displayedSkillLevel);
  const postProcessing = displayedReport ? getPostProcessingAdvice(displayedReport) : null;
  const scoreSummary = displayedReport ? getScoreSummary(displayedReport) : null;
  const scoreReasons = displayedReport ? getScoreReasons(displayedReport) : null;
  const photoSpecific = displayedReport ? getPhotoSpecificFeedback(displayedReport, displayedGenre) : null;
  const nextActions = displayedReport ? getNextShootingActions(displayedReport, displayedGenre) : null;
  const [activeReportSection, setActiveReportSection] = useState(reportNavItems[0].id);
  const [shareStatus, setShareStatus] = useState('');
  const shareTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!displayedReport) {
      return undefined;
    }

    const visibleSections = reportNavItems
      .map((item) => document.getElementById(item.id))
      .filter((section): section is HTMLElement => Boolean(section));

    const observer = new IntersectionObserver(
      (entries) => {
        const currentEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => first.boundingClientRect.top - second.boundingClientRect.top)[0];

        if (currentEntry?.target.id) {
          setActiveReportSection(currentEntry.target.id);
        }
      },
      { rootMargin: '-120px 0px -62% 0px', threshold: 0.01 },
    );

    visibleSections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [displayedReport]);

  useEffect(() => {
    return () => {
      if (shareTimerRef.current) {
        window.clearTimeout(shareTimerRef.current);
      }
    };
  }, []);

  async function handleShareReport() {
    const shareTitle = `PhotoSense AI 影像诊断报告 - ${displayedFileName}`;
    const shareUrl = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: '查看这份 AI 摄影点评报告。',
          url: shareUrl,
        });
        setShareStatus('已打开系统分享');
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareStatus('分享链接已复制');
      }
    } catch {
      setShareStatus('分享暂未完成');
    }

    if (shareTimerRef.current) {
      window.clearTimeout(shareTimerRef.current);
    }

    shareTimerRef.current = window.setTimeout(() => {
      setShareStatus('');
    }, 2200);
  }

  return (
    <main className="page-main page-report">
      <section className="report-section page-view" aria-live="polite" aria-label="影像诊断报告">
          {displayedReport ? (
            <div className="report-header-tools report-header-tools-only">
              <div className="report-action-group">
                <button className="secondary-button compact" type="button" onClick={onStartReview}>
                  重新点评
                </button>
                <button className="secondary-button compact" type="button" onClick={onGoHistory}>
                  返回历史记录
                </button>
                <button className="secondary-button compact" type="button" onClick={handleShareReport}>
                  分享
                </button>
                <button className="secondary-button compact" type="button" onClick={onCopyReport}>
                  {copyStatus}
                </button>
              </div>
              {shareStatus ? <span className="report-share-feedback">{shareStatus}</span> : null}
            </div>
          ) : null}

          {displayedReport ? (
            <div className={`report-source-notice report-source-${displayedSource}`} role={displayedSource === 'mock' ? 'alert' : 'status'}>
              <div>
                <strong>
                  {displayedSource === 'ai' ? '实时 AI 分析' : displayedSource === 'mock' ? '示例报告' : '历史报告'}
                </strong>
                <span>
                  {displayedSource === 'ai'
                    ? '本次结果来自图像分析服务。'
                    : displayedSource === 'mock'
                      ? `分析服务暂时不可用，请勿将这份示例报告视为真实照片分析。${displayedAnalysisError ? ` ${displayedAnalysisError}` : ''}`
                      : '这条旧记录没有保存报告来源，建议重新分析。'}
                </span>
              </div>
              {displayedSource === 'mock' && canRetryAnalysis ? (
                <button className="report-retry-button" type="button" onClick={onRetryAnalysis}>
                  重试实时分析
                </button>
              ) : null}
            </div>
          ) : null}

          {isAnalyzing ? (
            <div className="loading-panel">
              <div className="scan-line" />
              <p>正在读取明暗结构、主体层级与画面意图。</p>
            </div>
          ) : null}

          {!isAnalyzing && !displayedReport ? (
            <div className="empty-report empty-report-state">
              <p className="eyebrow">暂无分析报告</p>
              <h3>请先上传一张照片并完成 AI 点评。</h3>
              <button className="primary-link" type="button" onClick={onStartReview}>
                前往开始点评
              </button>
            </div>
          ) : null}

          {displayedReport ? (
            <div className="diagnostic-report-shell">
              <aside className="report-side-nav" aria-label="报告章节导航">
                <p className="panel-kicker">报告目录</p>
                {reportNavItems.map((item) => (
                  <a className={activeReportSection === item.id ? 'is-active' : ''} href={`#${item.id}`} key={item.id}>
                    {item.label}
                  </a>
                ))}
              </aside>

              <div className="diagnostic-report">
                <section className="diagnostic-hero-report" id="report-overview" aria-label="照片诊断标注">
                <article className="report-opening-summary">
                  {reportVerdict ? (
                    <section className="report-verdict-block" aria-label="评审结论">
                      <p className="panel-kicker">评审结论</p>
                      <h3>{reportVerdict.title}</h3>
                      <div className="report-verdict-summary">
                        <span>一句话结论</span>
                        <p>{reportVerdict.summary}</p>
                      </div>
                      <div className="report-verdict-notes">
                        <div>
                          <span>主要问题</span>
                          <p>{reportVerdict.mainIssue}</p>
                        </div>
                        <div>
                          <span>下一步动作</span>
                          <p>{reportVerdict.nextStep}</p>
                        </div>
                      </div>
                    </section>
                  ) : null}
                  {scoreSummary ? (
                    <section className="report-score-block" aria-label="综合评分与五维评分概览">
                      <div className="score-total-lockup" aria-label={`综合评分 ${scoreSummary.overall}`}>
                        <span>综合评分</span>
                        <strong>{scoreSummary.overall}<small>/100</small></strong>
                      </div>
                      <RadarChart scores={displayedReport.scores} />
                    </section>
                  ) : null}
                </article>

                <div className="diagnostic-photo-panel">
                  <div className="diagnostic-image-board">
                    {displayedImageUrl ? <img src={displayedImageUrl} alt="用于诊断的已上传照片" /> : null}
                  </div>
                  <div className="photo-meta-strip">
                    <span>{displayedFileName}</span>
                    <i>/</i>
                    <span>{displayedMedium}</span>
                    <i>/</i>
                    <span>{displayedGenre}</span>
                    <i>/</i>
                    <span>{displayedSkillLevel}口径</span>
                    <i>/</i>
                    <span>{formatReportDate(displayedDate)}</span>

                  </div>
                </div>
                </section>

                {photoSpecific ? (
                  <section className="photo-specific-summary" aria-label="照片针对性观察">
                    <SectionTitle icon="overall" eyebrow="画面观察" title="这张照片最值得处理的关系" />
                    <div className="photo-specific-grid">
                      <article>
                        <span>值得保留</span>
                        <p>{photoSpecific.strength}</p>
                      </article>
                      <article>
                        <span>最优先问题</span>
                        <p>{photoSpecific.priorityIssue}</p>
                      </article>
                      <article>
                        <span>画面区域</span>
                        <p>{photoSpecific.affectedArea}</p>
                      </article>
                      <article>
                        <span>下一步动作</span>
                        <p>{photoSpecific.nextAction}</p>
                      </article>
                      <article className="photo-specific-crop">
                        <span>裁剪参考</span>
                        <strong>{photoSpecific.crop.ratio}</strong>
                        <p>{photoSpecific.crop.direction}。{photoSpecific.crop.rationale}</p>
                      </article>
                    </div>
                  </section>
                ) : null}

                <section className="dimension-diagnosis" id="report-dimensions" aria-label="五项摄影诊断维度">
                <SectionTitle icon="technical" eyebrow="诊断维度" title="评分、结论与行动建议" />
                <div className="diagnosis-grid">
                  <DiagnosticCard icon="composition" title="构图" score={displayedReport.scores['构图']} reason={scoreReasons?.['构图']} text={displayedReport.composition} />
                  <DiagnosticCard icon="lighting" title="光线" score={displayedReport.scores['光线']} reason={scoreReasons?.['光线']} text={displayedReport.lighting} />
                  <DiagnosticCard icon="colour" title="色彩" score={displayedReport.scores['色彩']} reason={scoreReasons?.['色彩']} text={displayedReport.colour} />
                  <DiagnosticCard icon="storytelling" title="叙事" score={displayedReport.scores['叙事']} reason={scoreReasons?.['叙事']} text={displayedReport.storytelling} />
                  <DiagnosticCard
                    icon="technical"
                    title="技术完成度"
                    score={displayedReport.scores['技术完成度']}
                    reason={scoreReasons?.['技术完成度']}
                    text={displayedReport.technical}
                  />
                </div>
                </section>

                {postProcessing ? (
                  <section className="post-processing-advice" id="report-post-processing" aria-label="后期建议">
                  <SectionTitle icon="recipe" eyebrow="后期参考" title="后期建议" />
                  <div className="post-processing-grid">
                    <PostAdviceCard index="01" title="裁剪建议" item={postProcessing.crop} />
                    <PostAdviceCard index="02" title="影调修改建议" item={postProcessing.tone} />
                    <PostAdviceCard index="03" title="蒙版提亮 / 压暗建议" item={postProcessing.masking} />
                  </div>
                  </section>
                ) : null}

                <section className="review-context-section" aria-label="评价设置">
                  <SectionTitle icon="overall" eyebrow="补充说明" title="评价设置" />
                  <div className="review-context-card" aria-label="本次评价设置">
                    <div className="review-context-head">
                      <p className="panel-kicker">本次评价基准</p>
                      <span>{displayedMedium} / {displayedSkillLevel}口径 / {displayedGenre}</span>
                    </div>
                    <dl>
                      <div>
                        <dt>影像介质</dt>
                        <dd>{reviewContext.mediumFocus}</dd>
                      </div>
                      <div>
                        <dt>点评口径</dt>
                        <dd>{reviewContext.levelFocus}</dd>
                      </div>
                      <div>
                        <dt>摄影题材</dt>
                        <dd>{reviewContext.genreFocus}</dd>
                      </div>
                      <div>
                        <dt>评分侧重</dt>
                        <dd>{reviewContext.scoringLogic}</dd>
                      </div>
                    </dl>
                  </div>
                </section>

                {nextActions ? (
                  <section className="next-shooting-actions" id="report-next-actions">
                  <SectionTitle icon="suggestions" eyebrow="下次行动" title="下次拍摄优先尝试" />
                  <p>{nextActions.summary}</p>
                  <ul>
                    {nextActions.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  </section>
                ) : null}
              </div>
            </div>
          ) : null}
      </section>
    </main>
  );
}

type HistoryPageProps = {
  historyRecords: HistoryRecord[];
  onDeleteRecord: (recordId: string) => void;
  onOpenRecord: (record: HistoryRecord) => void;
};

function HistoryPage({ historyRecords, onDeleteRecord, onOpenRecord }: HistoryPageProps) {
  const [isManaging, setIsManaging] = useState(false);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [activeMediumFilter, setActiveMediumFilter] = useState<Medium | '全部'>('全部');
  const [activeGenreFilter, setActiveGenreFilter] = useState<Genre | '全部'>('全部');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historySort, setHistorySort] = useState<HistorySort>('最新上传');
  const averageScore = historyRecords.length
    ? Math.round(historyRecords.reduce((sum, record) => sum + record.overallScore, 0) / historyRecords.length)
    : 0;
  const currentMonthCount = countRecordsInCurrentMonth(historyRecords);
  const mediumFilterOptions: Array<Medium | '全部'> = ['全部', ...mediums];
  const subjectFilterOptions: Array<Genre | '全部'> = ['全部', ...genres];
  const filteredRecords = filterAndSortHistoryRecords(historyRecords, {
    medium: activeMediumFilter,
    genre: activeGenreFilter,
    startDate,
    endDate,
    query: historySearch,
    sort: historySort,
  });
  const comparisonRecords = comparisonIds
    .map((recordId) => historyRecords.find((record) => record.id === recordId))
    .filter((record): record is HistoryRecord => Boolean(record));

  function handleDeleteRecord(event: MouseEvent<HTMLButtonElement>, record: HistoryRecord) {
    event.stopPropagation();

    if (window.confirm('确定删除这条历史记录吗？')) {
      onDeleteRecord(record.id);
      setComparisonIds((records) => records.filter((recordId) => recordId !== record.id));
      setIsComparing(false);
    }
  }

  function handleToggleComparison(event: MouseEvent<HTMLButtonElement>, recordId: string) {
    event.stopPropagation();
    setIsComparing(false);
    setComparisonIds((current) => {
      if (current.includes(recordId)) return current.filter((id) => id !== recordId);
      if (current.length >= 2) return current;
      return [...current, recordId];
    });
  }

  function handleToggleManaging() {
    setIsManaging((current) => {
      if (current) {
        setComparisonIds([]);
        setIsComparing(false);
      }
      return !current;
    });
  }

  return (
    <main className="history-page">
      <section className="history-tools" aria-label="历史记录工具栏">
        <div className="history-summary" aria-label="历史记录摘要">
          <div>
            <strong>{historyRecords.length}</strong>
            <span>全部记录</span>
          </div>
          <div>
            <strong>{currentMonthCount}</strong>
            <span>本月点评</span>
          </div>
          <div>
            <strong>{averageScore || '--'}</strong>
            <span>平均评分</span>
          </div>
        </div>

        <div className="history-primary-tools">
          <label className="history-control-group history-search">
            <span>搜索</span>
            <input
              type="search"
              value={historySearch}
              placeholder="搜索作品标题 / 文件名 / 标签"
              onChange={(event) => setHistorySearch(event.target.value)}
            />
          </label>
          <label className="history-control-group history-sort">
            <span>排序</span>
            <select value={historySort} onChange={(event) => setHistorySort(event.target.value as HistorySort)}>
              <option>最新上传</option>
              <option>评分最高</option>
              <option>评分最低</option>
            </select>
          </label>
          {isManaging ? (
            <button
              className="history-compare-button"
              type="button"
              disabled={comparisonRecords.length !== 2}
              onClick={() => setIsComparing(true)}
            >
              对比所选（{comparisonRecords.length}/2）
            </button>
          ) : null}
          <button
            className={`history-manage-button ${isManaging ? 'is-active' : ''}`}
            type="button"
            onClick={handleToggleManaging}
          >
            {isManaging ? '完成管理' : '管理上传'}
          </button>
        </div>
      </section>

      <section className="history-filters" aria-label="历史记录筛选工具">
        <div className="history-filter-layout">
          <div className="history-filter-left">
            <div className="history-filter-group">
              <span>介质</span>
              <div className="history-filter-tags">
                {mediumFilterOptions.map((option) => (
                  <button
                    className={activeMediumFilter === option ? 'active' : ''}
                    key={option}
                    type="button"
                    onClick={() => setActiveMediumFilter(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="history-filter-group">
              <span>题材</span>
              <div className="history-filter-tags">
                {subjectFilterOptions.map((option) => (
                  <button
                    className={activeGenreFilter === option ? 'active' : ''}
                    key={option}
                    type="button"
                    onClick={() => setActiveGenreFilter(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="history-filter-right">
            <div className="history-filter-controls history-date-controls">
              <div className="history-control-group history-date-group">
                <span>时间</span>
                <div>
                  <label>
                    <small>开始日期</small>
                    <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                  </label>
                  <label>
                    <small>结束日期</small>
                    <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                  </label>
                  <button type="button" onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}>
                    清除日期
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="history-results-bar">
          <span>当前显示 {filteredRecords.length} / {historyRecords.length} 条记录</span>
          {isManaging ? <strong>选择两份记录进行对比，也可以删除记录；删除后不可恢复。</strong> : null}
        </div>
      </section>

      {isComparing && comparisonRecords.length === 2 ? (
        <HistoryComparison first={comparisonRecords[0]} second={comparisonRecords[1]} onClose={() => setIsComparing(false)} />
      ) : null}

      <section className="history-feed" aria-label="摄影点评历史内容流">
        {historyRecords.length === 0 ? (
          <div className="empty-report empty-report-state">
            <p className="eyebrow">暂无历史记录</p>
            <h3>完成一次 AI 点评后，上传照片会自动出现在这里。</h3>
          </div>
        ) : null}

        {historyRecords.length > 0 && filteredRecords.length === 0 ? (
          <div className="empty-report empty-report-state history-filter-empty">
            <p className="eyebrow">没有找到符合条件的作品</p>
            <h3>可以调整筛选条件，或上传新的照片进行点评。</h3>
          </div>
        ) : null}

        {filteredRecords.map((record, index) => {
          const cardSize = index % 3 === 0 ? 'tall' : index % 3 === 1 ? 'medium' : 'wide';
          const title = record.title || '未命名作品';
          const subject = record.subject ?? record.genre;
          const critiqueLevel = record.critiqueLevel ?? record.skillLevel;
          const isNewestRecord = historyRecords[0]?.id === record.id;

          return (
            <article
              className={`history-card history-${cardSize} history-uploaded ${historyRecords[0]?.id === record.id ? 'history-recent' : ''} ${comparisonIds.includes(record.id) ? 'is-comparison-selected' : ''}`}
              key={record.id}
              role="button"
              tabIndex={0}
              aria-label={`查看 ${title} 的分析报告`}
              onClick={() => onOpenRecord(record)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpenRecord(record);
                }
              }}
            >
              {isManaging ? (
                <div className="history-card-manage-actions">
                  <button
                    className={`history-select-button ${comparisonIds.includes(record.id) ? 'is-selected' : ''}`}
                    type="button"
                    aria-pressed={comparisonIds.includes(record.id)}
                    disabled={comparisonIds.length >= 2 && !comparisonIds.includes(record.id)}
                    onClick={(event) => handleToggleComparison(event, record.id)}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    {comparisonIds.includes(record.id) ? '已选对比' : '选择对比'}
                  </button>
                  <button
                    className="history-delete-button"
                    type="button"
                    onClick={(event) => handleDeleteRecord(event, record)}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    删除
                  </button>
                </div>
              ) : null}
              <div className="history-thumb">
                {record.imageUrl ? (
                  <img src={record.imageUrl} alt={`${title} 缩略图`} />
                ) : (
                  <div className="history-thumb-placeholder">暂无缩略图</div>
                )}
                {isNewestRecord ? <span className="history-new-label">NEW</span> : null}
                {record.reportSource !== 'ai' ? (
                  <span className={`history-source-label history-source-${record.reportSource}`}>
                    {record.reportSource === 'mock' ? '示例报告' : '来源未记录'}
                  </span>
                ) : null}
              </div>
              <div className="history-card-body">
                <div className="history-card-info">
                  <div className="history-card-title">
                    <h2>{title}</h2>
                    <p>{record.fileName}</p>
                    <div className="history-meta-tags">
                      <span>{record.medium}</span>
                      <span>{critiqueLevel}口径</span>
                      <span>{subject}</span>
                    </div>
                  </div>
                  <div className="history-score-badge" aria-label={`评分 ${record.overallScore}`}>
                    <span>评分</span>
                    <strong>{record.overallScore}</strong>
                  </div>
                </div>
                <div className="history-card-footer" aria-hidden="true">
                  <time>{record.date}</time>
                  <strong>查看报告 →</strong>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function HistoryComparison({ first, second, onClose }: { first: HistoryRecord; second: HistoryRecord; onClose: () => void }) {
  const comparison = compareHistoryRecords(first, second);
  const formatDelta = (delta: number) => (delta > 0 ? `+${delta}` : `${delta}`);

  return (
    <section className="history-comparison" aria-labelledby="history-comparison-title">
      <div className="history-comparison-head">
        <div>
          <p className="panel-kicker">成长对比</p>
          <h2 id="history-comparison-title">两次摄影点评的变化</h2>
          <p>系统按记录时间自动区分较早作品和较新作品。</p>
        </div>
        <button type="button" onClick={onClose}>关闭对比</button>
      </div>

      <div className="comparison-photo-grid">
        {[{ label: '较早作品', record: comparison.older, issue: comparison.olderIssue }, { label: '较新作品', record: comparison.newer, issue: comparison.newerIssue }].map(({ label, record, issue }) => (
          <article key={record.id}>
            <div className="comparison-photo">
              {record.imageUrl ? <img src={record.imageUrl} alt={`${record.title} 对比缩略图`} /> : <span>暂无缩略图</span>}
            </div>
            <div className="comparison-photo-copy">
              <span>{label}</span>
              <h3>{record.title || '未命名作品'}</h3>
              <p>{record.date} · {record.genre} · {record.skillLevel}口径</p>
              <strong>{record.overallScore}<small>/100</small></strong>
              <dl>
                <dt>主要问题</dt>
                <dd>{issue}</dd>
              </dl>
            </div>
          </article>
        ))}
      </div>

      <div className="comparison-highlights">
        <article>
          <span>综合评分变化</span>
          <strong className={comparison.totalDelta > 0 ? 'is-positive' : comparison.totalDelta < 0 ? 'is-negative' : ''}>
            {formatDelta(comparison.totalDelta)}
          </strong>
        </article>
        <article>
          <span>{comparison.hasImprovement ? '提升最多维度' : '变化最大维度'}</span>
          <strong>{comparison.mostImproved.name} {formatDelta(comparison.mostImproved.delta)}</strong>
        </article>
        <article>
          <span>当前优先练习</span>
          <strong>{comparison.practicePriority.name}</strong>
          <p>{comparison.practiceAction}</p>
        </article>
      </div>

      <div className="comparison-dimensions" aria-label="五项评分变化">
        <div className="comparison-dimension-row comparison-dimension-head" aria-hidden="true">
          <span>维度</span><span>较早</span><span>较新</span><span>变化</span>
        </div>
        {comparison.dimensions.map((item) => (
          <div className="comparison-dimension-row" key={item.name}>
            <strong>{item.name}</strong>
            <span>{item.olderScore}</span>
            <span>{item.newerScore}</span>
            <em className={item.delta > 0 ? 'is-positive' : item.delta < 0 ? 'is-negative' : ''}>{formatDelta(item.delta)}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

function LoginPage({ onAuthSuccess, onSwitch }: { onAuthSuccess: () => void; onSwitch: () => void }) {
  return <AuthPage mode="login" onAuthSuccess={onAuthSuccess} onSwitch={onSwitch} />;
}

function RegisterPage({ onAuthSuccess, onSwitch }: { onAuthSuccess: () => void; onSwitch: () => void }) {
  return <AuthPage mode="register" onAuthSuccess={onAuthSuccess} onSwitch={onSwitch} />;
}

function AuthPage({
  mode,
  onAuthSuccess,
  onSwitch,
}: {
  mode: 'login' | 'register';
  onAuthSuccess: () => void;
  onSwitch: () => void;
}) {
  const isLogin = mode === 'login';

  return (
    <main className="auth-page auth-page-clean">
      <section className="auth-panel" aria-labelledby="auth-title">
        <p className="eyebrow">{isLogin ? '登录' : '注册'}</p>
        <h1 id="auth-title">{isLogin ? '登录' : '注册'}</h1>

        <form className="auth-form">
          {!isLogin ? (
            <label>
              用户名
              <input type="text" placeholder="例如：陈明" />
            </label>
          ) : null}
          <label>
            邮箱或手机号
            <input type="text" placeholder="name@example.com / 138 0000 0000" />
          </label>
          <label>
            密码
            <input type="password" placeholder="请输入密码" />
          </label>
          {!isLogin ? (
            <label>
              确认密码
              <input type="password" placeholder="再次输入密码" />
            </label>
          ) : null}
          {!isLogin ? (
            <label className="agreement-row">
              <input type="checkbox" />
              <span>我已阅读并同意用户协议与隐私政策</span>
            </label>
          ) : null}
          <button className="auth-submit-button" type="button" onClick={onAuthSuccess}>
            {isLogin ? '登录' : '注册'}
          </button>
        </form>

        <div className="auth-links">
          {isLogin ? <button type="button">忘记密码</button> : null}
          <button type="button" onClick={onSwitch}>
            {isLogin ? '还没有账号？去注册' : '已有账号？去登录'}
          </button>
        </div>
      </section>
    </main>
  );
}

function SectionTitle({ icon, eyebrow, title }: { icon: IconName; eyebrow: string; title: string }) {
  return (
    <div className="report-title-row">
      <IconMark name={icon} />
      <div>
        <p className="panel-kicker">{eyebrow}</p>
        <h3>{title}</h3>
      </div>
    </div>
  );
}

function RadarChart({ scores }: { scores: Record<ScoreName, number> }) {
  const center = 96;
  const maxRadius = 62;
  const labelRadius = 82;
  const scoreEntries = scoreNames.map((name) => ({ name, score: scores[name] }));
  const strongest = scoreEntries.reduce((best, item) => (item.score > best.score ? item : best), scoreEntries[0]);
  const weakest = scoreEntries.reduce((lowest, item) => (item.score < lowest.score ? item : lowest), scoreEntries[0]);
  const axisPoints = scoreNames.map((name, index) => {
    const angle = (Math.PI * 2 * index) / scoreNames.length - Math.PI / 2;
    const outerX = center + Math.cos(angle) * maxRadius;
    const outerY = center + Math.sin(angle) * maxRadius;
    const labelX = center + Math.cos(angle) * labelRadius;
    const labelY = center + Math.sin(angle) * labelRadius;
    const scoreRadius = (scores[name] / 100) * maxRadius;
    const scoreX = center + Math.cos(angle) * scoreRadius;
    const scoreY = center + Math.sin(angle) * scoreRadius;

    return { name, outerX, outerY, labelX, labelY, scoreX, scoreY };
  });
  const polygonPoints = axisPoints.map((point) => `${point.scoreX},${point.scoreY}`).join(' ');
  const gridLevels = [1, 0.66, 0.33];

  return (
    <div className="radar-summary" aria-label="五项维度概览">
      <div className="radar-visual" aria-hidden="true">
        <svg viewBox="0 0 192 192" role="img">
          {gridLevels.map((level) => (
            <polygon
              className={`radar-grid ${level === 1 ? 'radar-grid-outer' : 'radar-grid-middle'}`}
              key={level}
              points={scoreNames
                .map((_, index) => {
                  const angle = (Math.PI * 2 * index) / scoreNames.length - Math.PI / 2;
                  return `${center + Math.cos(angle) * maxRadius * level},${center + Math.sin(angle) * maxRadius * level}`;
                })
                .join(' ')}
            />
          ))}
          {axisPoints.map((point) => (
            <line className="radar-axis" key={point.name} x1={center} y1={center} x2={point.outerX} y2={point.outerY} />
          ))}
          <polygon className="radar-value" points={polygonPoints} />
          {axisPoints.map((point) => (
            <circle className="radar-dot" key={`${point.name}-dot`} cx={point.scoreX} cy={point.scoreY} r="3.2" />
          ))}
          <circle className="radar-center-dot" cx={center} cy={center} r="2" />
          {axisPoints.map((point) => (
            <text className="radar-axis-label" key={`${point.name}-label`} x={point.labelX} y={point.labelY + 4} textAnchor="middle">
              {point.name}
            </text>
          ))}
        </svg>
      </div>
      <div className="radar-legend-list">
        {scoreEntries.map((item) => {
          const status = item.name === strongest.name ? '优势项' : item.name === weakest.name ? '待优化' : '';

          return (
            <div className="radar-legend-row" key={item.name}>
              <div className="radar-legend-meta">
                <span>{item.name}</span>
                <strong>{item.score}</strong>
              </div>
              {status ? <em className={status === '优势项' ? 'is-strong' : 'is-weak'}>{status}</em> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DiagnosticCard({ icon, title, score, reason, text }: { icon: IconName; title: string; score: number; reason?: string; text: string }) {
  const parts = parseDiagnosticText(text);

  return (
    <article className="diagnostic-card">
      <div className="diagnostic-card-head">
        <SectionTitle icon={icon} eyebrow="诊断模块" title={title} />
        <strong>{score}</strong>
      </div>
      <dl>
        {reason ? (
          <div className="diagnostic-score-reason">
            <dt>评分依据</dt>
            <dd>{reason}</dd>
          </div>
        ) : null}
        <div>
          <dt>结论</dt>
          <dd>{parts.conclusion}</dd>
        </div>
        <div>
          <dt>原因</dt>
          <dd>{parts.explanation}</dd>
        </div>
        <div>
          <dt>行动</dt>
          <dd>{parts.action}</dd>
        </div>
      </dl>
    </article>
  );
}

function PostAdviceCard({ index, title, item }: { index: string; title: string; item: PostProcessingAdviceItem }) {
  return (
    <article className="post-advice-card">
      <span className="post-advice-index">{index}</span>
      <div className="post-advice-content">
        <h3>{title}</h3>
        <div className="advice-meta-row">
          <span>建议</span>
          <p>{item.suggestion}</p>
        </div>
        <div className="advice-meta-row">
          <span>理由</span>
          <p>{item.reason}</p>
        </div>
        <div className="advice-meta-row">
          <span>预期效果</span>
          <p>{item.expectedEffect}</p>
        </div>
      </div>
    </article>
  );
}

type IconName = 'overall' | 'composition' | 'lighting' | 'colour' | 'storytelling' | 'technical' | 'suggestions' | 'recipe';

function IconMark({ name }: { name: IconName }) {
  return (
    <span className={`section-icon icon-${name}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" role="img">
        {name === 'overall' ? <path d="M4 12h4l2-5 4 10 2-5h4" /> : null}
        {name === 'composition' ? <path d="M5 5h14v14H5z M9 5v14 M15 5v14 M5 9h14 M5 15h14" /> : null}
        {name === 'lighting' ? <path d="M13 2 5 14h6l-1 8 8-12h-6z" /> : null}
        {name === 'colour' ? <path d="M12 4a8 8 0 1 0 0 16 3 3 0 0 0 0-6h1a5 5 0 0 0 5-5c0-2.8-2.7-5-6-5z" /> : null}
        {name === 'storytelling' ? <path d="M5 6h14v12H5z M8 9h8 M8 12h5 M8 15h7" /> : null}
        {name === 'technical' ? <path d="M4 17h16 M6 17V8 M12 17V5 M18 17v-7" /> : null}
        {name === 'suggestions' ? <path d="M12 4v6 M12 14v6 M4 12h6 M14 12h6 M7 7l3 3 M14 14l3 3" /> : null}
        {name === 'recipe' ? <path d="M7 4h10v16H7z M10 8h4 M10 12h4 M10 16h2" /> : null}
      </svg>
    </span>
  );
}

function parseDiagnosticText(text: string) {
  const conclusion = text.match(/结论：(.+?)。说明：/)?.[1] ?? text;
  const explanation = text.match(/说明：(.+?)。方向：/)?.[1] ?? '观察画面中的主体、明暗和边缘关系。';
  const action = text.match(/方向：(.+)$/)?.[1] ?? '下一次拍摄时先明确视觉重心。';

  return { conclusion, explanation, action };
}

export default App;
