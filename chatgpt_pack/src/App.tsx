import { ChangeEvent, MouseEvent, RefObject, useEffect, useMemo, useRef, useState } from 'react';

type Medium = '数码摄影' | '胶片摄影';

type Genre = '街头摄影' | '人像摄影' | '风景摄影' | '建筑摄影' | '静物摄影' | '旅行摄影';

type SkillLevel = '初学者' | '进阶' | '高级';

type ScoreName = '构图' | '光线' | '色彩' | '叙事' | '技术完成度';

type Page = 'home' | 'review' | 'report' | 'history' | 'login' | 'register';

type PostProcessingAdviceItem = {
  suggestion: string;
  reason: string;
  expectedEffect: string;
};

type ReportVerdict = {
  title: string;
  summary: string;
  mainIssue: string;
  nextStep: string;
  tags: string[];
};

type NextShootingAdvice = {
  summary: string;
  items: string[];
};

type ReviewContext = {
  mediumFocus: string;
  levelFocus: string;
  genreFocus: string;
  scoringLogic: string;
};

type Report = {
  overall: string;
  scores: Record<ScoreName, number>;
  composition: string;
  lighting: string;
  colour: string;
  storytelling: string;
  technical: string;
  suggestions: string[];
  recipe: {
    exposure: string;
    contrast: string;
    highlights: string;
    shadows: string;
    temperature: string;
    cropRatio: string;
  };
  verdict?: ReportVerdict;
  reviewContext?: ReviewContext;
  postProcessing?: {
    crop: PostProcessingAdviceItem;
    tone: PostProcessingAdviceItem;
    masking: PostProcessingAdviceItem;
  };
  nextShooting?: NextShootingAdvice;
};

type HistoryRecord = {
  id: string;
  title: string;
  imageUrl: string;
  fileName: string;
  medium: Medium;
  subject: Genre;
  genre: Genre;
  critiqueLevel: SkillLevel;
  skillLevel: SkillLevel;
  date: string;
  dateTime: string;
  createdAt: string;
  report: Report;
  overallScore: number;
  tags: string[];
  summary: string;
  strongestDimension: ScoreName;
  weakestDimension: ScoreName;
};

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

const skillLevels: SkillLevel[] = ['初学者', '进阶', '高级'];

const skillTooltips: Record<SkillLevel, string> = {
  初学者: '更基础、更易懂，更强调拍摄习惯、取景方式与下一次可以尝试的具体动作。',
  进阶: '加入更多构图、光线、色彩和画面组织判断，帮助你从“拍到”走向“拍准”。',
  高级: '更强调叙事、风格、视觉语言与作者意图，反馈会更接近作品集编辑视角。',
};

const scoreNames: ScoreName[] = ['构图', '光线', '色彩', '叙事', '技术完成度'];
const HISTORY_STORAGE_KEY = 'photosense_history_records';
const DEFAULT_ANALYSIS_API_URL = 'http://localhost:8787/api/analyze-photo';

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


type ContextPatch = ReportVerdict & {
  mediumNote: string;
};

function getContextualVerdictPatch(medium: Medium, genre: Genre, skillLevel: SkillLevel): ContextPatch {
  const titleByGenreAndLevel: Record<Genre, Record<SkillLevel, string>> = {
    街头摄影: {
      初学者: '现场线索可读，先收紧主体',
      进阶: '瞬间感已出现，秩序还可强化',
      高级: '现场张力可见，表达仍需取舍',
    },
    人像摄影: {
      初学者: '人物状态清楚，背景先做减法',
      进阶: '情绪已经可读，分离仍可加强',
      高级: '人物关系成立，风格还需更锋利',
    },
    风景摄影: {
      初学者: '景物层次可见，先稳住明暗',
      进阶: '空间感已出现，光线还可等待',
      高级: '地方气息可读，视觉语言仍可凝练',
    },
    建筑摄影: {
      初学者: '结构已经清楚，先校正边线',
      进阶: '空间秩序成立，节奏仍可收紧',
      高级: '体量关系可读，表达还需更克制',
    },
    静物摄影: {
      初学者: '物件关系清楚，先整理背景',
      进阶: '材质已有表现，阴影仍可优化',
      高级: '静物秩序成立，形式还可更纯粹',
    },
    旅行摄影: {
      初学者: '地点信息清楚，先突出重点',
      进阶: '地方感已出现，叙事仍可聚焦',
      高级: '旅行线索可读，个人视角还可加强',
    },
  };
  const summaryByLevel: Record<SkillLevel, string> = {
    初学者: '画面已经具备可读基础，接下来先处理一个最明确的问题：让主体更快被看见，并减少不必要的干扰。',
    进阶: '画面不是单纯“拍到”了对象，而是已经开始形成观看顺序；下一步要把主体、光线和背景关系组织得更稳定。',
    高级: '画面具备继续筛选的价值，但还需要更严格地判断哪些视觉信息真正服务表达，哪些只是削弱作品力量。',
  };
  const issueByGenre: Record<Genre, string> = {
    街头摄影: '人物、背景和现场线索之间的关系还可以更集中，避免关键瞬间被次要信息稀释。',
    人像摄影: '人物状态与背景之间仍有竞争关系，情绪入口可以更干净。',
    风景摄影: '空间层次和光线重心还可以更明确，让视线从前景到远处的路径更自然。',
    建筑摄影: '线条、边缘和结构节奏还需要更严谨，避免空间重心被轻微偏差削弱。',
    静物摄影: '物件间距、阴影形状和背景纯度仍可继续整理，让材质关系更清楚。',
    旅行摄影: '地点信息已经存在，但人的痕迹、地方气质和叙事重点还可以更聚焦。',
  };
  const nextStepByLevel: Record<SkillLevel, string> = {
    初学者: '先做一次轻微裁切，再检查最亮处和边缘杂物，让主体位置更明确。',
    进阶: '优先调整主体附近的明暗和背景分离，再判断是否需要收紧构图。',
    高级: '先决定这张照片最值得保留的视觉关系，再删除或压低所有不服务这个关系的元素。',
  };
  const mediumNote = medium === '胶片摄影'
    ? '后期时保留颗粒、色偏和冲扫质感中有助于气氛的部分，不必按数码标准完全校正。'
    : '后期时优先控制高光、白平衡和局部对比，避免用过重滤镜掩盖画面关系。';

  return {
    title: titleByGenreAndLevel[genre][skillLevel],
    summary: `${summaryByLevel[skillLevel]}${medium === '胶片摄影' ? ' 胶片质感可以保留为情绪线索。' : ''}`,
    mainIssue: issueByGenre[genre],
    nextStep: `${nextStepByLevel[skillLevel]}${medium === '胶片摄影' ? ' 同时保留自然颗粒和色彩偏移。' : ''}`,
    tags: medium === '胶片摄影' ? ['观看路径', '胶片质感', '信息取舍'] : ['观看路径', '局部层次', '信息取舍'],
    mediumNote,
  };
}

function adjustScoresForContext(scores: Record<ScoreName, number>, medium: Medium, genre: Genre, skillLevel: SkillLevel) {
  const levelShift: Record<SkillLevel, number> = { 初学者: 4, 进阶: 0, 高级: -7 };
  const genreShift: Record<Genre, Partial<Record<ScoreName, number>>> = {
    街头摄影: { 叙事: 3, 技术完成度: -1 },
    人像摄影: { 光线: 2, 色彩: 2, 叙事: 1 },
    风景摄影: { 光线: 3, 色彩: 1, 构图: 1 },
    建筑摄影: { 构图: 3, 技术完成度: 2, 叙事: -2 },
    静物摄影: { 构图: 2, 色彩: 2, 技术完成度: 1 },
    旅行摄影: { 叙事: 3, 色彩: 1, 构图: 1 },
  };
  const mediumShift: Record<Medium, Partial<Record<ScoreName, number>>> = {
    数码摄影: { 技术完成度: 1, 色彩: 1 },
    胶片摄影: { 色彩: 2, 叙事: 1, 技术完成度: -2 },
  };
  const values = scoreNames.map((name) => scores[name]);
  const tooFlat = Math.max(...values) - Math.min(...values) <= 5;

  return scoreNames.reduce((result, name) => {
    const flatPenalty = tooFlat && (name === '叙事' || name === '光线') ? -4 : 0;
    const raw = scores[name] + levelShift[skillLevel] + (genreShift[genre][name] ?? 0) + (mediumShift[medium][name] ?? 0) + flatPenalty;
    result[name] = Math.max(35, Math.min(96, Math.round(raw)));
    return result;
  }, {} as Record<ScoreName, number>);
}

function calibrateReportForContext(report: Report, medium: Medium, genre: Genre, skillLevel: SkillLevel): Report {
  const contextPatch = getContextualVerdictPatch(medium, genre, skillLevel);
  const safeScores = adjustScoresForContext(report.scores, medium, genre, skillLevel);
  const postProcessing = getPostProcessingAdvice(report);
  const cropByGenre: Record<Genre, string> = {
    街头摄影: '基本保留现场关系，只裁掉最分散注意力的边缘亮点。',
    人像摄影: '优先收紧人物头肩或身体周围的背景干扰，让表情和姿态更先被看见。',
    风景摄影: '先检查地平线和前景比例，必要时裁掉削弱空间层次的空白区域。',
    建筑摄影: '先校正垂直线与水平线，再用小幅裁切稳定边缘结构。',
    静物摄影: '围绕主物件和阴影形状裁切，保留足够呼吸感。',
    旅行摄影: '保留能说明地点的线索，裁掉只增加杂乱感的游客、招牌或空白区域。',
  };
  const maskingByLevel: Record<SkillLevel, string> = {
    初学者: '只做一处柔和局部提亮或压暗，避免同时修改太多区域。',
    进阶: '用局部调整拉开主体与背景亮度关系，让观看顺序更明确。',
    高级: '仅保留非常克制的局部整理，不要把现场光线修成过度设计感。',
  };
  const nextShooting = getNextShootingActions(report, genre);

  return {
    ...report,
    scores: safeScores,
    verdict: {
      ...contextPatch,
      summary: sanitizeUserFacingText(report.verdict?.summary, contextPatch.summary),
      mainIssue: sanitizeUserFacingText(report.verdict?.mainIssue, contextPatch.mainIssue),
      nextStep: contextPatch.nextStep,
      tags: contextPatch.tags,
    },
    reviewContext: getReviewContext(medium, genre, skillLevel),
    postProcessing: {
      crop: {
        ...postProcessing.crop,
        suggestion: cropByGenre[genre],
        expectedEffect: '画面重点更快出现，同时不牺牲原有场景气氛。',
      },
      tone: {
        ...postProcessing.tone,
        suggestion: medium === '胶片摄影' ? '保留颗粒、色偏和冲扫质感，只轻微压住过亮区域或脏色块。' : '轻微回收高光，整理主体附近的中间调和局部对比。',
        reason: contextPatch.mediumNote,
      },
      masking: {
        ...postProcessing.masking,
        suggestion: maskingByLevel[skillLevel],
      },
    },
    nextShooting: {
      summary: `${nextShooting.summary}${skillLevel === '高级' ? ' 同时用更严格的作品筛选意识判断这张照片是否有独立表达。' : ''}`,
      items: nextShooting.items,
    },
  };
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
  };

  return calibrateReportForContext(report, medium, genre, skillLevel);
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
  skillLevel,
  workTitle,
}: {
  fallbackReport: Report;
  fileName: string;
  genre: Genre;
  imageDataUrl: string;
  medium: Medium;
  skillLevel: SkillLevel;
  workTitle?: string;
}) {
  const apiUrl = getAnalysisApiUrl();

  console.log('Calling analysis API...');
  console.log('imageDataUrl starts with:', imageDataUrl.slice(0, 30));

  if (!imageDataUrl.startsWith('data:image/')) {
    throw new Error('上传作品没有转换为有效的 base64 图片数据。');
  }

  const response = await fetch(apiUrl, {
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
  });

  console.log('Analysis API status:', response.status);

  if (!response.ok) {
    throw new Error('AI 分析接口暂时不可用。');
  }

  const data = await response.json();

  if (data.ok === false) {
    throw new Error(data.error || 'AI 分析接口返回失败。');
  }

  if (!data.report || typeof data.report !== 'object') {
    throw new Error('AI 分析接口没有返回有效报告。');
  }

  console.log('Analysis API success');

  return calibrateReportForContext({
    ...fallbackReport,
    ...data.report,
  } as Report, medium, genre, skillLevel);
}

function getAnalysisApiUrl() {
  return import.meta.env.VITE_ANALYSIS_API_URL || DEFAULT_ANALYSIS_API_URL;
}

function getSaveReportHistoryApiUrl() {
  const apiUrl = getAnalysisApiUrl();

  try {
    return new URL('/api/save-report-history', apiUrl).toString();
  } catch {
    return apiUrl.replace(/\/api\/analyze-photo$/, '/api/save-report-history') || 'http://localhost:8787/api/save-report-history';
  }
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
        const report = {
          ...createMockReport(genre, skillLevel, medium),
          ...record.report,
        };
        const createdAt = typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString();

        return {
          ...record,
          title: typeof record.title === 'string' && record.title ? record.title : '历史点评记录',
          imageUrl: typeof record.imageUrl === 'string' ? record.imageUrl : '',
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
          overallScore: typeof record.overallScore === 'number' ? record.overallScore : getOverallScore(report),
          tags: Array.isArray(record.tags) ? record.tags : getHistoryTags(genre, skillLevel, medium),
          summary: typeof record.summary === 'string' ? record.summary : getCoreDiagnosis(report, genre).direction,
          strongestDimension: scoreNames.includes(record.strongestDimension) ? record.strongestDimension : getScoreSummaryDimensions(report).strongestDimension,
          weakestDimension: scoreNames.includes(record.weakestDimension) ? record.weakestDimension : getScoreSummaryDimensions(report).weakestDimension,
        } as HistoryRecord;
      });
  } catch (error) {
    console.warn('Failed to restore PhotoSense history records from localStorage', error);
    return [];
  }
}

async function syncReportHistoryToProject(historyRecords: HistoryRecord[]) {
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
  const [selectedMedium, setSelectedMedium] = useState<Medium>('数码摄影');
  const [selectedGenre, setSelectedGenre] = useState<Genre>('街头摄影');
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('初学者');
  const [photoTitle, setPhotoTitle] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>(loadStoredHistoryRecords);
  const [activeRecord, setActiveRecord] = useState<HistoryRecord | null>(null);
  const [copyStatus, setCopyStatus] = useState('复制报告');
  const [skillTooltip, setSkillTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analysisTimerRef = useRef<number | null>(null);
  const historySyncTimerRef = useRef<number | null>(null);

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

  function clearAnalysisTimer() {
    if (analysisTimerRef.current) {
      window.clearTimeout(analysisTimerRef.current);
      analysisTimerRef.current = null;
    }
  }

  function goToPage(page: Page) {
    setCurrentPage(page);
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
  }

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    clearAnalysisTimer();

    if (imageUrl && !historyRecords.some((record) => record.imageUrl === imageUrl)) {
      URL.revokeObjectURL(imageUrl);
    }

    setImageUrl(URL.createObjectURL(file));
    setUploadedFile(file);
    setFileName(file.name);
    setIsAnalyzing(false);
    setReport(null);
    setActiveRecord(null);
    setCopyStatus('复制报告');
  }

  async function handleAnalyze() {
    if (!imageUrl) {
      return;
    }

    clearAnalysisTimer();
    setIsAnalyzing(true);
    setReport(null);
    setCopyStatus('复制报告');

    const fallbackReport = createMockReport(selectedGenre, skillLevel, selectedMedium);
    let nextReport = fallbackReport;

    try {
      if (!uploadedFile) {
        throw new Error('缺少原始上传文件，无法发送到分析接口。');
      }

      console.log('original file size:', uploadedFile.size);
      const imageDataUrl = await compressImageForApi(uploadedFile);
      console.log('compressed imageDataUrl length:', imageDataUrl.length);
      nextReport = await requestAiReport({
        fallbackReport,
        fileName,
        genre: selectedGenre,
        imageDataUrl,
        medium: selectedMedium,
        skillLevel,
        workTitle: photoTitle.trim() || undefined,
      });
    } catch (error) {
      console.warn('AI request failed, using mock fallback', error);
    } finally {
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
        imageUrl,
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
        overallScore: getOverallScore(nextReport),
        tags: [...getHistoryTags(selectedGenre, skillLevel, selectedMedium), ...getProblemTags(nextReport).slice(0, 1)],
        summary: coreDiagnosis.direction,
        strongestDimension: dimensions.strongestDimension,
        weakestDimension: dimensions.weakestDimension,
      };

      setReport(nextReport);
      setActiveRecord(nextRecord);
      setHistoryRecords((records) => [nextRecord, ...records]);
      setIsAnalyzing(false);
      analysisTimerRef.current = null;
      goToPage('report');
    }
  }

  function handleReset() {
    clearAnalysisTimer();

    if (imageUrl && !historyRecords.some((record) => record.imageUrl === imageUrl)) {
      URL.revokeObjectURL(imageUrl);
    }

    setImageUrl('');
    setUploadedFile(null);
    setFileName('');
    setPhotoTitle('');
    setSelectedMedium('数码摄影');
    setSelectedGenre('街头摄影');
    setSkillLevel('初学者');
    setIsAnalyzing(false);
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
    const scoreText = scoreNames.map((name) => `${name}：${reportToCopy.scores[name]}/100`).join('\n');
    const postProcessingText = [
      `1. 裁剪建议：${postProcessing.crop.suggestion}\n理由：${postProcessing.crop.reason}\n预期效果：${postProcessing.crop.expectedEffect}`,
      `2. 影调修改建议：${postProcessing.tone.suggestion}\n理由：${postProcessing.tone.reason}\n预期效果：${postProcessing.tone.expectedEffect}`,
      `3. 蒙版提亮 / 压暗建议：${postProcessing.masking.suggestion}\n理由：${postProcessing.masking.reason}\n预期效果：${postProcessing.masking.expectedEffect}`,
    ].join('\n');
    const nextShootingText = [nextShooting.summary, ...nextShooting.items.map((item, index) => `${index + 1}. ${item}`)].join('\n');

    const text = `PhotoSense AI 摄影评审报告\n影像介质：${reportMedium}\n摄影题材：${reportGenre}\n点评口径：${reportSkillLevel}\n\n本次评价基准\n影像介质：${reviewContext.mediumFocus}\n点评口径：${reviewContext.levelFocus}\n摄影题材：${reviewContext.genreFocus}\n评分侧重：${reviewContext.scoringLogic}\n\n评审结论\n${reportVerdict.title}\n${reportVerdict.summary}\n主要问题：${reportVerdict.mainIssue}\n下一步：${reportVerdict.nextStep}\n\n总体印象\n${reportToCopy.overall}\n\n评分\n${scoreText}\n\n构图分析\n${reportToCopy.composition}\n\n光线分析\n${reportToCopy.lighting}\n\n色彩分析\n${reportToCopy.colour}\n\n叙事分析\n${reportToCopy.storytelling}\n\n技术完成度\n${reportToCopy.technical}\n\n后期建议\n${postProcessingText}\n\n下次拍摄建议\n${nextShootingText}`;

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
    setCopyStatus('复制报告');
    goToPage('report');
  }

  function handleDeleteHistoryRecord(recordId: string) {
    setHistoryRecords((records) => records.filter((record) => record.id !== recordId));

    if (activeRecord?.id === recordId) {
      setActiveRecord(null);
      setReport(null);
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand brand-button" type="button" onClick={() => goToPage('home')} aria-label="PhotoSense AI 首页">
          <span className="brand-mark">影</span>
          <span>PhotoSense AI</span>
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
          <button className="user-entry" type="button" aria-label="模拟用户入口">
            <span>陈</span>
          </button>
        </div>
      </header>

      {currentPage === 'home' && <HomePage onStartReview={() => goToPage('review')} />}

      {currentPage === 'review' && (
        <ReviewPage
          currentDate={currentDate}
          fileInputRef={fileInputRef}
          fileName={fileName}
          imageUrl={imageUrl}
          isAnalyzing={isAnalyzing}
          onAnalyze={handleAnalyze}
          onImageUpload={handleImageUpload}
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
        />
      )}

      {currentPage === 'report' && (
        <ReportPage
          activeRecord={activeRecord}
          copyStatus={copyStatus}
          currentDate={currentDate}
          fileName={fileName}
          imageUrl={imageUrl}
          isAnalyzing={isAnalyzing}
          onCopyReport={handleCopyReport}
          onGoHistory={() => goToPage('history')}
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
      {currentPage === 'login' && <LoginPage onSwitch={() => goToPage('register')} />}
      {currentPage === 'register' && <RegisterPage onSwitch={() => goToPage('login')} />}

      <footer className="site-footer">
        <p>面向摄影创作者与品牌内容团队的 AI 辅助复盘工具。</p>
      </footer>
    </div>
  );
}

function HomePage({ onStartReview }: { onStartReview: () => void }) {
  return (
    <main className="page-main page-home">
      <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-collage" aria-hidden="true">
            <img className="photo-tile tile-street" src={homeAssets.street} alt="" />
            <img className="photo-tile tile-portrait" src={homeAssets.portrait} alt="" />
            <img className="photo-tile tile-landscape" src={homeAssets.landscape} alt="" />
            <img className="photo-tile tile-archive" src={homeAssets.architecture} alt="" />
            <img className="photo-tile tile-night" src={homeAssets.stillLife} alt="" />
            <img className="photo-tile tile-window" src={homeAssets.travel} alt="" />
          </div>
          <div className="hero-copy">
            <p className="eyebrow">AI 摄影点评助手</p>
            <h1 id="hero-title">让每一张作品都有清晰的下一步。</h1>
            <p className="hero-text">
              PhotoSense AI 面向摄影创作者、内容团队与作品集准备场景，将上传作品拆解为构图、光线、色彩、叙事与技术完成度，生成克制、具体、可执行的中文影像诊断报告。
            </p>
            <div className="hero-actions">
              <button className="primary-link" type="button" onClick={onStartReview}>
                开始点评
              </button>
              <span>上传一张照片，即可获得五维摄影诊断与可执行修改建议。</span>
            </div>
            <dl className="hero-metrics" aria-label="产品能力概览">
              <div>
                <dt>5 项</dt>
                <dd>摄影诊断维度</dd>
              </div>
              <div>
                <dt>6 类</dt>
                <dd>摄影题材</dd>
              </div>
              <div>
                <dt>2 种</dt>
                <dd>影像介质</dd>
              </div>
              <div>
                <dt>3 种</dt>
                <dd>点评口径</dd>
              </div>
            </dl>
          </div>

          <div className="feature-preview" aria-label="功能流程展示区">
            <div className="feature-preview-head">
              <p className="panel-kicker">产品预览</p>
              <span>五项摄影诊断</span>
            </div>
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
                <strong>选择介质与口径</strong>
                <p>区分数码、胶片与初学者、进阶、高级点评方式。</p>
              </li>
              <li>
                <span>02</span>
                <strong>上传作品到审片灯台</strong>
                <p>保留大图预览、作品标题与基础拍摄语境。</p>
              </li>
              <li>
                <span>03</span>
                <strong>生成五项摄影诊断</strong>
                <p>围绕构图、光线、色彩、叙事与技术完成度输出建议。</p>
              </li>
              <li>
                <span>04</span>
                <strong>保存为影像复盘档案</strong>
                <p>在历史记录中持续回看作品变化与训练方向。</p>
              </li>
            </ol>
          </div>
      </section>

      <section className="home-support" aria-labelledby="home-support-title">
          <div className="section-heading">
            <p className="eyebrow">产品亮点</p>
            <h2 id="home-support-title">不是聊天窗口，而是一张影像评审单。</h2>
          </div>
          <div className="support-grid">
            <article>
              <img src={homeAssets.stillLife} alt="静物摄影样片缩略图" />
              <p className="panel-kicker">从感觉到依据</p>
              <h3>把“哪里不对”拆成可判断的问题</h3>
              <p>报告围绕构图、光线、色彩、叙事与技术完成度展开，把主观感受转译成下一步可尝试的动作。</p>
            </article>
            <article>
              <img src={homeAssets.architecture} alt="建筑摄影样片缩略图" />
              <p className="panel-kicker">不同题材，不同判断方式</p>
              <h3>让点评更贴合作品语境</h3>
              <p>街头、人像、风景、建筑、静物、旅行题材会触发不同观察重点，避免所有照片都被同一种标准粗暴处理。</p>
            </article>
            <article>
              <img src={homeAssets.travel} alt="旅行纪实摄影样片缩略图" />
              <p className="panel-kicker">复盘友好</p>
              <h3>让每次点评沉淀为复盘档案</h3>
              <p>每次分析都能进入历史记录，按介质、题材、日期与评分回看，帮助作品集准备和团队选片复盘。</p>
            </article>
          </div>
      </section>

      <section className="home-workflow-strip" aria-label="产品使用流程">
        <div><span>01</span><strong>选择影像介质</strong></div>
        <div><span>02</span><strong>选择点评口径</strong></div>
        <div><span>03</span><strong>上传作品</strong></div>
        <div><span>04</span><strong>阅读报告</strong></div>
        <div><span>05</span><strong>回看历史记录</strong></div>
      </section>
    </main>
  );
}

type ReviewPageProps = {
  currentDate: string;
  fileInputRef: RefObject<HTMLInputElement>;
  fileName: string;
  imageUrl: string;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  onImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
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
};

function ReviewPage({
  currentDate,
  fileInputRef,
  fileName,
  imageUrl,
  isAnalyzing,
  onAnalyze,
  onImageUpload,
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
}: ReviewPageProps) {
  return (
    <main className="page-main page-review">
      <section className="review-desk page-view" aria-labelledby="review-title">
          <div className="section-heading">
            <p className="eyebrow">开始点评</p>
            <h2 id="review-title">按创作阶段建立一张作品评审单</h2>
          </div>

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
                <div className="rounded-control upload-status-card">
                  <div>
                    <p className="panel-kicker">作品状态</p>
                    <h3>{fileName || '等待选择影像文件'}</h3>
                    <p>支持本地图片即时预览，用于生成模拟摄影点评报告。</p>
                  </div>
                  <label className="photo-title-field">
                    <span>作品标题（选填）</span>
                    <input
                      type="text"
                      value={photoTitle}
                      placeholder="例如：午后立面、街角等待、雾中山脊"
                      onChange={(event) => onPhotoTitleChange(event.target.value)}
                    />
                  </label>
                  <button className="secondary-button rounded-command" type="button" onClick={() => fileInputRef.current?.click()}>
                    选择照片
                  </button>
                  <input
                    ref={fileInputRef}
                    className="visually-hidden"
                    type="file"
                    accept="image/*"
                    onChange={onImageUpload}
                  />
                </div>
              </section>

              <section className="sequence-block action-block">
                <div className="step-label">
                  <span>05</span>
                  <p>开始分析</p>
                </div>
                <div className="desk-actions rounded-actions">
                  <button className="analyze-button rounded-command" type="button" disabled={!imageUrl || isAnalyzing} onClick={onAnalyze}>
                    {isAnalyzing ? '正在分析影像' : '开始分析'}
                  </button>
                  <button className="reset-button rounded-command" type="button" onClick={onReset}>
                    重置
                  </button>
                  <p className="analysis-helper">{imageUrl ? '已准备生成五项摄影诊断' : '请先上传作品'}</p>
                </div>
              </section>

              <div className="review-note">
                <p className="panel-kicker">分析说明</p>
                <p>当前点评将覆盖构图、光线、色彩、叙事与技术完成度，并给出三条可执行建议和一组后期参数参考。</p>
              </div>
            </aside>

            <section className="review-preview" aria-label="照片上传与预览">
              <div className="preview-header">
                <div>
                  <p className="panel-kicker">审片灯台</p>
                  <h3>{fileName ? '作品已进入点评流程' : '请先上传一张照片'}</h3>
                  <p>{fileName ? '作品已载入审片灯台，可生成五项摄影诊断。' : '上传后会在灯台区域生成大图预览。'}</p>
                </div>
                <div className="preview-index">
                  <span>{imageUrl ? '准备就绪' : '待上传'}</span>
                  <span>{imageUrl ? '可开始分析' : '本地预览'}</span>
                  {imageUrl ? <span>本地预览</span> : null}
                </div>
              </div>

              <div className={`preview-stage ${imageUrl ? 'has-image' : ''}`}>
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
  copyStatus: string;
  currentDate: string;
  fileName: string;
  imageUrl: string;
  isAnalyzing: boolean;
  onCopyReport: () => void;
  onGoHistory: () => void;
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
  copyStatus,
  currentDate,
  fileName,
  imageUrl,
  isAnalyzing,
  onCopyReport,
  onGoHistory,
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
  const reportVerdict = displayedReport ? getReportVerdict(displayedReport, displayedGenre) : null;
  const reviewContext = getResolvedReviewContext(displayedReport, displayedMedium, displayedGenre, displayedSkillLevel);
  const postProcessing = displayedReport ? getPostProcessingAdvice(displayedReport) : null;
  const scoreSummary = displayedReport ? getScoreSummary(displayedReport) : null;
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
      <section className="report-section page-view" aria-live="polite" aria-labelledby="report-title">
          <div className="section-heading report-heading">
            <div>
              <p className="eyebrow">评审报告</p>
              <h2 id="report-title">影像诊断报告</h2>
            </div>
            {displayedReport ? (
              <div className="report-header-tools">
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
          </div>

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
                    <i>/</i>
                    <span>五项摄影诊断</span>
                  </div>
                </div>

                <article className="diagnostic-overview report-score-panel">
                  {scoreSummary && reportVerdict ? (
                    <div className="review-verdict-card">
                      <div className="review-verdict-head">
                        <div>
                          <p className="panel-kicker">评审结论</p>
                          <h3>{reportVerdict.title}</h3>
                        </div>
                        <div className="verdict-score" aria-label={`综合评分 ${scoreSummary.overall}`}>
                          <span>综合评分</span>
                          <strong>{scoreSummary.overall}<small>/100</small></strong>
                        </div>
                      </div>
                      <div className="verdict-body">
                        <div className="verdict-statement">
                          <span>一句话结论</span>
                          <p>{reportVerdict.summary}</p>
                        </div>
                        <div className="verdict-notes">
                          <div>
                            <span>主要问题</span>
                            <p>{reportVerdict.mainIssue}</p>
                          </div>
                          <div>
                            <span>下一步动作</span>
                            <p>{reportVerdict.nextStep}</p>
                          </div>
                        </div>
                      </div>
                      <div className="verdict-footer">
                        <em>{displayedReport.verdict ? '影像结论' : getRatingInterpretation(scoreSummary.overall)}</em>
                        <div className="problem-tags" aria-label="主要问题标签">
                          {reportVerdict.tags.map((tag) => (
                            <span key={tag}>{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {scoreSummary ? <RadarChart scores={displayedReport.scores} /> : null}
                  <article className="review-context-card" aria-label="本次评价基准">
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
                  </article>
                  <dl className="report-context-list">
                    <div>
                      <dt>影像介质</dt>
                      <dd>{displayedMedium}</dd>
                    </div>
                    <div>
                      <dt>摄影题材</dt>
                      <dd>{displayedGenre}</dd>
                    </div>
                    <div>
                      <dt>点评口径</dt>
                      <dd>{displayedSkillLevel}</dd>
                    </div>
                    <div>
                      <dt>报告日期</dt>
                      <dd>{displayedDate}</dd>
                    </div>
                  </dl>
                </article>
                </section>

                <section className="dimension-diagnosis" id="report-dimensions" aria-label="五项摄影诊断维度">
                <SectionTitle icon="technical" eyebrow="诊断维度" title="评分、结论与行动建议" />
                <div className="diagnosis-grid">
                  <DiagnosticCard icon="composition" title="构图" score={displayedReport.scores['构图']} text={displayedReport.composition} />
                  <DiagnosticCard icon="lighting" title="光线" score={displayedReport.scores['光线']} text={displayedReport.lighting} />
                  <DiagnosticCard icon="colour" title="色彩" score={displayedReport.scores['色彩']} text={displayedReport.colour} />
                  <DiagnosticCard icon="storytelling" title="叙事" score={displayedReport.scores['叙事']} text={displayedReport.storytelling} />
                  <DiagnosticCard
                    icon="technical"
                    title="技术完成度"
                    score={displayedReport.scores['技术完成度']}
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
  const [activeFilter, setActiveFilter] = useState('全部');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historySort, setHistorySort] = useState('最新上传');
  const averageScore = historyRecords.length
    ? Math.round(historyRecords.reduce((sum, record) => sum + record.overallScore, 0) / historyRecords.length)
    : 0;
  const mediumFilterOptions = ['全部', ...mediums];
  const subjectFilterOptions = [...genres];
  const filteredRecords = historyRecords
    .filter((record) => {
      if (activeFilter === '全部') {
        return true;
      }

      const subject = record.subject ?? record.genre;

      return record.tags.includes(activeFilter) || record.medium === activeFilter || subject === activeFilter || record.genre === activeFilter;
    })
    .filter((record) => {
      const recordDay = record.createdAt ? record.createdAt.slice(0, 10) : '';
      const afterStart = !startDate || recordDay >= startDate;
      const beforeEnd = !endDate || recordDay <= endDate;

      return afterStart && beforeEnd;
    })
    .filter((record) => {
      const keyword = historySearch.trim().toLowerCase();

      if (!keyword) {
        return true;
      }

      const searchableText = [record.title, record.fileName, record.medium, record.subject, record.critiqueLevel, ...record.tags]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(keyword);
    })
    .sort((first, second) => {
      if (historySort === '评分最高') {
        return second.overallScore - first.overallScore;
      }

      if (historySort === '评分最低') {
        return first.overallScore - second.overallScore;
      }

      return new Date(second.createdAt || second.date).getTime() - new Date(first.createdAt || first.date).getTime();
    });

  function handleDeleteRecord(event: MouseEvent<HTMLButtonElement>, record: HistoryRecord) {
    event.stopPropagation();

    if (window.confirm('确定删除这条历史记录吗？')) {
      onDeleteRecord(record.id);
    }
  }

  return (
    <main className="history-page">
      <section className="history-hero">
        <p className="eyebrow">历史记录</p>
        <h1>以时间线整理你的每一次影像复盘。</h1>
        <p>
          这里合并历史浏览、上传管理与时间轴归档。每张卡片代表一次点评记录，便于回看风格变化、筛选作品集素材和追踪训练方向。
        </p>
      </section>

      <section className="history-toolbar" aria-label="历史记录筛选">
        <div>
          <span>全部记录</span>
          <strong>{historyRecords.length}</strong>
        </div>
        <div>
          <span>本月点评</span>
          <strong>{historyRecords.length}</strong>
        </div>
        <div>
          <span>平均评分</span>
          <strong>{averageScore || '--'}</strong>
        </div>
        <button type="button" onClick={() => setIsManaging((current) => !current)}>
          {isManaging ? '完成管理' : '管理上传'}
        </button>
      </section>

      <section className="history-filters" aria-label="历史记录筛选工具">
        <div className="history-filter-group">
          <span>介质</span>
          <div className="history-filter-tags">
            {mediumFilterOptions.map((option) => (
              <button
                className={activeFilter === option ? 'active' : ''}
                key={option}
                type="button"
                onClick={() => setActiveFilter(option)}
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
                className={activeFilter === option ? 'active' : ''}
                key={option}
                type="button"
                onClick={() => setActiveFilter(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        <div className="history-filter-controls">
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
          <label className="history-control-group history-search">
            <span>搜索</span>
            <input
              type="search"
              value={historySearch}
              placeholder="搜索作品标题 / 文件名 / 标签"
              onChange={(event) => setHistorySearch(event.target.value)}
            />
          </label>
          <label className="history-control-group">
            <span>排序</span>
            <select value={historySort} onChange={(event) => setHistorySort(event.target.value)}>
              <option>最新上传</option>
              <option>评分最高</option>
              <option>评分最低</option>
            </select>
          </label>
        </div>
        <div className="history-results-bar">
          <span>当前显示 {filteredRecords.length} / {historyRecords.length} 条记录</span>
          {isManaging ? <strong>管理模式下可删除上传记录，删除后不可恢复。</strong> : null}
        </div>
      </section>

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
              className={`history-card history-${cardSize} history-uploaded ${historyRecords[0]?.id === record.id ? 'history-recent' : ''}`}
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
                <button
                  className="history-delete-button"
                  type="button"
                  onClick={(event) => handleDeleteRecord(event, record)}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  删除
                </button>
              ) : null}
              <div className="history-thumb">
                {record.imageUrl ? (
                  <img src={record.imageUrl} alt={`${title} 缩略图`} />
                ) : (
                  <div className="history-thumb-placeholder">暂无缩略图</div>
                )}
                {isNewestRecord ? <span className="history-new-label">NEW</span> : null}
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

function LoginPage({ onSwitch }: { onSwitch: () => void }) {
  return <AuthPage mode="login" onSwitch={onSwitch} />;
}

function RegisterPage({ onSwitch }: { onSwitch: () => void }) {
  return <AuthPage mode="register" onSwitch={onSwitch} />;
}

function AuthPage({ mode, onSwitch }: { mode: 'login' | 'register'; onSwitch: () => void }) {
  const isLogin = mode === 'login';

  return (
    <main className="auth-page">
      <section className="auth-visual" aria-hidden="true">
        <div className="auth-frame auth-frame-one" />
        <div className="auth-frame auth-frame-two" />
        <p>PhotoSense AI / 影像复盘工作台</p>
      </section>

      <section className="auth-panel" aria-labelledby="auth-title">
        <p className="eyebrow">{isLogin ? '登录' : '注册'}</p>
        <h1 id="auth-title">{isLogin ? '回到你的评审工作台。' : '创建一个新的影像复盘空间。'}</h1>
        <p className="auth-intro">
          {isLogin
            ? '登录后可继续管理历史点评、上传记录与作品集准备进度。'
            : '用于产品原型展示，表单暂不连接真实账号系统。'}
        </p>

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
          <button className="analyze-button rounded-command" type="button">
            {isLogin ? '登录' : '注册'}
          </button>
        </form>

        <div className="auth-links">
          {isLogin ? <button type="button">忘记密码</button> : null}
          <button type="button" onClick={onSwitch}>
            {isLogin ? '还没有账号？去注册' : '已有账号？去登录'}
          </button>
        </div>

        <div className="third-party-row" aria-label="第三方登录占位">
          <span>微信</span>
          <span>企业微信</span>
          <span>手机号验证码</span>
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
              <div className="radar-legend-track" aria-hidden="true">
                <i style={{ width: `${item.score}%` }} />
              </div>
              {status ? <em className={status === '优势项' ? 'is-strong' : 'is-weak'}>{status}</em> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DiagnosticCard({ icon, title, score, text }: { icon: IconName; title: string; score: number; text: string }) {
  const parts = parseDiagnosticText(text);

  return (
    <article className="diagnostic-card">
      <div className="diagnostic-card-head">
        <SectionTitle icon={icon} eyebrow="诊断模块" title={title} />
        <strong>{score}</strong>
      </div>
      <dl>
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
