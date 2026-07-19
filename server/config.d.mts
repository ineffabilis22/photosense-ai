export function readBoundedNumber(
  env: Record<string, string | undefined>,
  name: string,
  fallback: number,
  bounds: { min: number; max: number; integer?: boolean },
): number;

export function isHistoryExportEnabled(env: Record<string, string | undefined>): boolean;

export function hasConfiguredProvider(env: Record<string, string | undefined>): boolean;

