export type ScoreName = '构图' | '光线' | '色彩' | '叙事' | '技术完成度';
export type ScoreBand = '作品级' | '强' | '成立' | '普通' | '偏弱' | '严重问题';
export type ScoreBreakdownItem = {
  fundamentals: Record<string, number>;
  refinement: number;
  evidence: string;
};

export const SCORE_VERSION: string;
export const scoreBandValues: Record<ScoreBand, number>;
export const scoreBandNames: string[];
export const scoreNames: ScoreName[];
export const scoreRubricCriteria: Record<ScoreName, string[]>;
export const scoreRubricLabels: Record<ScoreName, Record<string, string>>;
export const scoreRubricDescription: Record<string, string>;

export function normalizeScore(value: unknown, fallback: number): number;
export function isValidScore(value: unknown): boolean;
export function getScoreBandFromNumber(value: unknown): ScoreBand;
export function normalizeScoreBands(value: unknown, legacyScores?: Record<string, unknown>): Record<ScoreName, ScoreBand>;
export function getScoresFromBands(scoreBands?: Partial<Record<ScoreName, ScoreBand>>): Record<ScoreName, number>;
export function getImprovementPriority(scores?: Partial<Record<ScoreName, number>>): 'none' | 'optional' | 'material' | 'critical';
export function normalizeScoreBreakdown(value: unknown): Partial<Record<ScoreName, ScoreBreakdownItem>>;
export function calculateRubricScores(args: {
  scoreBreakdown?: unknown;
  skillLevel?: '爱好者水平' | '进阶水平';
  legacyScores?: Record<string, unknown>;
  legacyBands?: Partial<Record<ScoreName, ScoreBand>>;
}): {
  scores: Record<ScoreName, number>;
  scoreBands: Record<ScoreName, ScoreBand>;
  scoreBreakdown: Partial<Record<ScoreName, ScoreBreakdownItem>>;
};
