export type Medium = '数码摄影' | '胶片摄影';

export type Genre = '街头摄影' | '人像摄影' | '风景摄影' | '建筑摄影' | '静物摄影' | '旅行摄影';

export type SkillLevel = '初学者' | '进阶' | '高级';

export type ScoreName = '构图' | '光线' | '色彩' | '叙事' | '技术完成度';

export type ReportSource = 'ai' | 'mock' | 'legacy';

export type AnalysisPhase = 'preparing' | 'connecting' | 'analyzing' | 'formatting';

export type AnalysisState = {
  kind: 'idle' | 'analyzing' | 'ai' | 'mock' | 'error' | 'cancelled';
  message?: string;
  phase?: AnalysisPhase;
};

export type PostProcessingAdviceItem = {
  suggestion: string;
  reason: string;
  expectedEffect: string;
};

export type ReportVerdict = {
  title: string;
  summary: string;
  mainIssue: string;
  nextStep: string;
  tags: string[];
};

export type NextShootingAdvice = {
  summary: string;
  items: string[];
};

export type ReviewContext = {
  mediumFocus: string;
  levelFocus: string;
  genreFocus: string;
  scoringLogic: string;
};

export type PhotoSpecificFeedback = {
  strength: string;
  priorityIssue: string;
  affectedArea: string;
  nextAction: string;
  crop: {
    ratio: string;
    direction: string;
    rationale: string;
  };
};

export type Report = {
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
  photoSpecific?: PhotoSpecificFeedback;
  scoreReasons?: Partial<Record<ScoreName, string>>;
};

export type HistoryRecord = {
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
  reportSource: ReportSource;
  analysisError?: string;
  overallScore: number;
  tags: string[];
  summary: string;
  strongestDimension: ScoreName;
  weakestDimension: ScoreName;
};
