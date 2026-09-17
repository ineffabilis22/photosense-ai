export type ReportModelId = 'auto' | 'gpt' | 'claude' | 'deepseek' | 'gemini';
export type ImageModelId = 'auto' | 'gpt-image' | 'nano-banana' | 'grok-image';

export type ModelDefinition = {
  id: string;
  label: string;
  model: string;
  envName: string;
  enabled?: boolean;
  unavailableReason?: string;
};

export const reportModelIds: readonly ReportModelId[];
export const imageModelIds: readonly ImageModelId[];
export const reportAutoOrder: readonly Exclude<ReportModelId, 'auto'>[];
export const imageAutoOrder: readonly Exclude<ImageModelId, 'auto'>[];
export function isReportModelId(value: unknown): value is ReportModelId;
export function isImageModelId(value: unknown): value is ImageModelId;
export function getReportModelCandidates(requestedId?: ReportModelId, env?: Record<string, string | undefined>): ModelDefinition[];
export function getImageModelCandidates(requestedId?: ImageModelId, env?: Record<string, string | undefined>): ModelDefinition[];
export function getImageModelDefinition(requestedId: ImageModelId, env?: Record<string, string | undefined>): ModelDefinition | null;
export function hasConfiguredReportRelay(env?: Record<string, string | undefined>): boolean;
export function hasConfiguredImageRelay(env?: Record<string, string | undefined>): boolean;
