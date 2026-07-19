export function readBoundedNumber(env, name, fallback, { min, max, integer = false }) {
  const rawValue = env[name];
  if (rawValue == null || String(rawValue).trim() === '') return fallback;

  const value = Number(rawValue);
  if (!Number.isFinite(value)) return fallback;

  const boundedValue = Math.max(min, Math.min(max, value));
  return integer ? Math.round(boundedValue) : boundedValue;
}

export function isHistoryExportEnabled(env) {
  if (typeof env.ENABLE_HISTORY_EXPORT === 'string') {
    return env.ENABLE_HISTORY_EXPORT.trim().toLowerCase() === 'true';
  }

  return env.NODE_ENV !== 'production';
}

export function hasConfiguredProvider(env) {
  return Boolean(
    (env.OPENAI_RELAY_BASE_URL && env.OPENAI_RELAY_API_KEY)
      || (env.GEMINI_RELAY_BASE_URL && env.GEMINI_RELAY_API_KEY)
      || (env.ANTHROPIC_RELAY_BASE_URL && env.ANTHROPIC_RELAY_API_KEY)
      || env.GEMINI_API_KEY,
  );
}
