const reportModelDefinitions = Object.freeze({
  gpt: Object.freeze({ id: 'gpt', label: 'GPT · gpt-5.6-luna', model: 'gpt-5.6-luna', envName: 'REPORT_MODEL_GPT' }),
  claude: Object.freeze({ id: 'claude', label: 'Claude · claude-sonnet-5', model: 'claude-sonnet-5', envName: 'REPORT_MODEL_CLAUDE' }),
  deepseek: Object.freeze({ id: 'deepseek', label: 'DeepSeek · deepseek-v4.1-flash', model: 'deepseek-v4.1-flash', envName: 'REPORT_MODEL_DEEPSEEK' }),
  gemini: Object.freeze({ id: 'gemini', label: 'Gemini · gemini-3-flash', model: 'gemini-3-flash', envName: 'REPORT_MODEL_GEMINI' }),
});

const imageModelDefinitions = Object.freeze({
  'gpt-image': Object.freeze({ id: 'gpt-image', label: 'GPT Image · gpt-image-2', model: 'gpt-image-2', envName: 'IMAGE_MODEL_GPT' }),
  'nano-banana': Object.freeze({ id: 'nano-banana', label: 'Nano Banana · nano-banana-2', model: 'nano-banana-2', envName: 'IMAGE_MODEL_NANO_BANANA' }),
  'grok-image': Object.freeze({ id: 'grok-image', label: 'Grok Image · grok-image', model: 'grok-image', envName: 'IMAGE_MODEL_GROK_IMAGE' }),
});

export const reportModelIds = Object.freeze(['auto', ...Object.keys(reportModelDefinitions)]);
export const imageModelIds = Object.freeze(['auto', ...Object.keys(imageModelDefinitions)]);
export const reportAutoOrder = Object.freeze(['gpt', 'claude', 'deepseek', 'gemini']);
export const imageAutoOrder = Object.freeze(['gpt-image', 'nano-banana', 'grok-image']);

function resolveDefinition(definition, env) {
  const legacyModel = definition.id === 'gpt'
    ? env?.OPENAI_RELAY_MODEL
    : definition.id === 'gpt-image'
      ? env?.IMAGE_RELAY_MODEL
      : '';
  const configuredModel = String(env?.[definition.envName] || legacyModel || '').trim();
  return { ...definition, model: configuredModel || definition.model };
}

export function isReportModelId(value) {
  return typeof value === 'string' && reportModelIds.includes(value);
}

export function isImageModelId(value) {
  return typeof value === 'string' && imageModelIds.includes(value);
}

export function getReportModelCandidates(requestedId = 'auto', env = process.env) {
  if (!isReportModelId(requestedId)) return [];
  const ids = requestedId === 'auto' ? reportAutoOrder : [requestedId];
  return ids.map((id) => resolveDefinition(reportModelDefinitions[id], env));
}

export function getImageModelCandidates(requestedId = 'auto', env = process.env) {
  if (!isImageModelId(requestedId)) return [];
  const ids = requestedId === 'auto' ? imageAutoOrder : [requestedId];
  return ids
    .map((id) => resolveDefinition(imageModelDefinitions[id], env))
    .filter((definition) => definition.enabled !== false);
}

export function getImageModelDefinition(requestedId, env = process.env) {
  if (!isImageModelId(requestedId) || requestedId === 'auto') return null;
  return resolveDefinition(imageModelDefinitions[requestedId], env);
}

export function hasConfiguredReportRelay(env = process.env) {
  return Boolean(
    (env.REPORT_RELAY_BASE_URL || env.OPENAI_RELAY_BASE_URL)
    && (env.REPORT_RELAY_API_KEY || env.OPENAI_RELAY_API_KEY),
  );
}

export function hasConfiguredImageRelay(env = process.env) {
  return Boolean(
    (env.IMAGE_RELAY_BASE_URL || env.REPORT_RELAY_BASE_URL || env.OPENAI_RELAY_BASE_URL)
    && (env.IMAGE_RELAY_API_KEY || env.REPORT_RELAY_API_KEY || env.OPENAI_RELAY_API_KEY),
  );
}
