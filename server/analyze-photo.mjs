import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const PORT = Number(process.env.PORT || 8787);
const OPENAI_RELAY_BASE_URL = process.env.OPENAI_RELAY_BASE_URL?.trim().replace(/\/+$/, '');
const OPENAI_RELAY_MODEL = process.env.OPENAI_RELAY_MODEL?.trim() || 'gpt-5.4';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_RELAY_BASE_URL = process.env.GEMINI_RELAY_BASE_URL?.trim().replace(/\/+$/, '');
const GEMINI_RELAY_MODEL = process.env.GEMINI_RELAY_MODEL?.trim() || 'gemini-3-pro-preview';
const ANTHROPIC_RELAY_BASE_URL = process.env.ANTHROPIC_RELAY_BASE_URL?.trim().replace(/\/+$/, '');
const ANTHROPIC_RELAY_MODEL = process.env.ANTHROPIC_RELAY_MODEL?.trim() || 'claude-3-7-sonnet';
const MAX_BODY_SIZE = 15 * 1024 * 1024;
const PROVIDER_TIMEOUT_MS = 60_000;
const OPENAI_RELAY_TIMEOUT_MS = 90_000;
const ANTHROPIC_TIMEOUT_MS = 90_000;

const scoreNames = ['构图', '光线', '色彩', '叙事', '技术完成度'];
const EXPORTS_DIR = path.join(process.cwd(), 'exports');
const HISTORY_EXPORT_PATH = path.join(EXPORTS_DIR, 'photosense_reports_history.json');

const mediumEvaluationFocus = {
  数码摄影: '按数码摄影判断时，更重视曝光准确性、高光控制、白平衡、清晰度、噪点控制与后期调整空间。',
  胶片摄影: '按胶片摄影判断时，颗粒、色偏、宽容度和冲扫质感会被视为影像气氛的一部分，而不只按数码清晰度评估。',
};

const levelEvaluationFocus = {
  初学者: '初学者口径下，报告会使用更易懂的语言，重点放在主体清晰、取景边界、曝光控制和一个明确的下一步动作。',
  进阶: '进阶口径下，报告会加入构图、光线、色彩、主体分离、边缘管理和观看顺序的判断，并解释问题为什么影响画面。',
  高级: '高级口径下，报告更关注作者意图、视觉语言、叙事张力、风格一致性和作品集筛选价值，判断会更严格。',
};

const genreEvaluationFocus = {
  街头摄影: '街头摄影重点观察决定性瞬间、人物姿态、主体与环境关系，以及秩序和混乱之间的现场张力。',
  人像摄影: '人像摄影重点观察表情与眼神、肤色、姿态、人物和背景关系、情绪可信度，以及主体分离和亲密感。',
  风景摄影: '风景摄影重点观察空间深度、光线时机、前中后景关系、影调层次、地方感和空气感。',
  建筑摄影: '建筑摄影重点观察透视控制、垂直水平线、结构节奏、材质质感，以及光线是否塑造出建筑体量。',
  静物摄影: '静物摄影重点观察物件关系、材质呈现、阴影形状、背景控制、留白比例和表面质感。',
  旅行摄影: '旅行摄影重点观察地方感、人的痕迹、叙事上下文，以及记录性和作品性的平衡，避免流于明信片式描述。',
};

function getReviewContext(medium = '数码摄影', genre = '街头摄影', skillLevel = '初学者') {
  const scoringByGenre = {
    街头摄影: '本次评分更重视时机、现场张力、观看顺序和人物与环境关系是否共同成立。',
    人像摄影: '本次评分更重视人物状态、情绪可信度、肤色与背景控制是否共同服务主体。',
    风景摄影: '本次评分更重视光线时机、空间层次、影调过渡和地方气质是否成立。',
    建筑摄影: '本次评分更重视透视秩序、结构节奏、线条控制和光线体积感。',
    静物摄影: '本次评分更重视物件关系、材质表达、阴影形状和留白控制。',
    旅行摄影: '本次评分更重视地方感、叙事线索、现场气氛和画面是否避免普通记录感。',
  };

  return {
    mediumFocus: mediumEvaluationFocus[medium] || mediumEvaluationFocus['数码摄影'],
    levelFocus: levelEvaluationFocus[skillLevel] || levelEvaluationFocus['初学者'],
    genreFocus: genreEvaluationFocus[genre] || genreEvaluationFocus['街头摄影'],
    scoringLogic: scoringByGenre[genre] || scoringByGenre['街头摄影'],
  };
}

function setCorsHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(response, statusCode, data) {
  setCorsHeaders(response);
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;

      if (body.length > MAX_BODY_SIZE) {
        reject(new Error('请求体过大，请上传较小的图片。'));
        request.destroy();
      }
    });

    request.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('请求 JSON 格式不正确。'));
      }
    });

    request.on('error', reject);
  });
}

function parseImageDataUrl(imageDataUrl) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(imageDataUrl || '');

  if (!match) {
    throw new Error('图片数据格式不正确，请传入 data:image/...;base64,... 格式。');
  }

  return {
    mimeType: match[1],
    base64Data: match[2],
  };
}

function extractGeminiText(data) {
  return data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();
}

function extractRelayText(data) {
  if (!data) {
    return '';
  }

  if (typeof data === 'string') {
    return data.trim();
  }

  const choice = data?.choices?.[0];
  const message = choice?.message;
  const content = message?.content;

  if (data.overall && data.scores) {
    return JSON.stringify(data);
  }

  if (typeof content === 'string') {
    return content.trim();
  }

  if (content && typeof content === 'object' && !Array.isArray(content)) {
    const nestedContentText = extractRelayText(content);
    return nestedContentText || JSON.stringify(content);
  }

  if (Array.isArray(content)) {
    const contentText = content
      .map((part) => {
        if (typeof part?.text === 'string') {
          return part.text;
        }

        if (typeof part?.content === 'string') {
          return part.content;
        }

        return '';
      })
      .join('')
      .trim();

    if (contentText) {
      return contentText;
    }
  }

  if (typeof message?.reasoning_content === 'string' && message.reasoning_content.trim()) {
    return message.reasoning_content.trim();
  }

  if (typeof choice?.delta?.content === 'string' && choice.delta.content.trim()) {
    return choice.delta.content.trim();
  }

  for (const key of ['content', 'response', 'output', 'result', 'data']) {
    const value = data[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (value && typeof value === 'object') {
      const nestedText = extractRelayText(value);

      if (nestedText) {
        return nestedText;
      }

      if (value.overall && value.scores) {
        return JSON.stringify(value);
      }
    }
  }

  return '';
}

function parseOpenAiRelayResponseText(responseText) {
  const dataLines = responseText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'));

  if (dataLines.length > 0) {
    const chunks = [];

    for (const line of dataLines) {
      const payload = line.replace(/^data:\s*/, '').trim();

      if (!payload || payload === '[DONE]') {
        continue;
      }

      try {
        const parsedPayload = JSON.parse(payload);
        const chunkText = extractRelayText(parsedPayload);

        if (chunkText) {
          chunks.push(chunkText);
        }
      } catch (error) {
        console.warn('[PhotoSense AI] OpenAI relay SSE line parse failed:', payload.slice(0, 300), error);
      }
    }

    if (chunks.length > 0) {
      return chunks.join('').trim();
    }
  }

  try {
    const parsed = JSON.parse(responseText);
    return extractRelayText(parsed) || responseText.trim();
  } catch {
    return responseText.trim();
  }
}

function extractAnthropicText(data) {
  const content = data?.content;

  if (!Array.isArray(content)) {
    return '';
  }

  const textBlock = content.find((part) => part?.type === 'text' && typeof part.text === 'string');
  return textBlock?.text?.trim() || '';
}

async function fetchWithTimeout(url, options, timeoutMs = PROVIDER_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('AI 分析请求超时，请稍后重试。');
      timeoutError.statusCode = 504;
      timeoutError.isTimeout = true;
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function stripJsonMarkdownFences(text) {
  return String(text ?? '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function escapeRawNewlinesInsideJsonStrings(text) {
  let output = '';
  let inString = false;
  let escaped = false;

  for (const char of text) {
    if (escaped) {
      output += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      output += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      output += char;
      inString = !inString;
      continue;
    }

    if (inString && char === '\n') {
      output += '\\n';
      continue;
    }

    if (inString && char === '\r') {
      continue;
    }

    output += char;
  }

  return output;
}

function findBalancedJsonObject(text) {
  const start = text.indexOf('{');

  if (start < 0) {
    return '';
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;

      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return '';
}

function makeJsonParseError(message, previewText) {
  const error = new Error(message);
  error.rawText = previewText;
  return error;
}

function tryParseJsonCandidate(candidate) {
  const variants = [
    candidate,
    candidate.replace(/,\s*([}\]])/g, '$1'),
    escapeRawNewlinesInsideJsonStrings(candidate).replace(/,\s*([}\]])/g, '$1'),
  ];

  for (const variant of variants) {
    try {
      return JSON.parse(variant);
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

function extractJsonFromText(text) {
  if (text && typeof text === 'object') {
    return text;
  }

  const cleanedText = stripJsonMarkdownFences(text);
  const directParsed = tryParseJsonCandidate(cleanedText);

  if (directParsed) {
    return directParsed;
  }

  const balancedCandidate = findBalancedJsonObject(cleanedText);

  if (balancedCandidate) {
    const parsedBalanced = tryParseJsonCandidate(balancedCandidate);

    if (parsedBalanced) {
      return parsedBalanced;
    }
  }

  const firstBrace = cleanedText.indexOf('{');
  const lastBrace = cleanedText.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const broadCandidate = cleanedText.slice(firstBrace, lastBrace + 1);
    const parsedBroad = tryParseJsonCandidate(broadCandidate);

    if (parsedBroad) {
      return parsedBroad;
    }
  }

  console.error('[PhotoSense AI] JSON parse failed. Preview:', cleanedText.slice(0, 1500));
  throw makeJsonParseError('AI 返回内容中未找到可解析的报告 JSON。', cleanedText.slice(0, 6000));
}

function parseJsonText(text) {
  return extractJsonFromText(text);
}

function normalizeScore(value, fallback) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  const percentageScore = numberValue > 0 && numberValue <= 10 ? numberValue * 10 : numberValue;
  return Math.max(0, Math.min(100, Math.round(percentageScore)));
}

function normalizeText(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
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
  '现场感已经出现，观看路径还可优化',
  '空间秩序成立，细节仍需整理',
  '人物状态可读，背景仍可收紧',
  '光线有气氛，层次仍可强化',
  '物件关系成立，质感还可加强',
  '地方气息可见，叙事还可聚焦',
];

function containsInternalMetaLanguage(text = '') {
  const normalizedText = typeof text === 'string' ? text : String(text ?? '');
  return internalMetaPhrases.some((phrase) => normalizedText.includes(phrase)) || /摄影的画面基础成立，仍需按.*口径收紧判断/.test(normalizedText);
}

function sanitizeUserFacingText(value, fallback) {
  const text = typeof value === 'string' ? value.trim() : '';

  if (!text || containsInternalMetaLanguage(text)) {
    return fallback;
  }

  return text;
}

function getScoreExtremes(scores = {}) {
  const entries = scoreNames.map((name) => ({ name, score: normalizeScore(scores[name], 70) }));
  const strongest = entries.reduce((best, item) => (item.score > best.score ? item : best), entries[0]);
  const weakest = entries.reduce((lowest, item) => (item.score < lowest.score ? item : lowest), entries[0]);

  return { strongest, weakest };
}

function getSafeVerdictTitle(genre = '街头摄影', scores = {}, skillLevel = '进阶') {
  const { strongest, weakest } = getScoreExtremes(scores);
  const skillTone = {
    初学者: {
      构图: '画面氛围可读，取景可再集中',
      光线: '画面基础清楚，光线还可整理',
      色彩: '色彩印象明确，关系可再统一',
      叙事: '现场线索已经出现，故事可再明确',
      技术完成度: '画面基本成立，细节可再稳住',
    },
    进阶: {
      构图: '结构已经成立，重心仍可压实',
      光线: '光线有气氛，层次仍可强化',
      色彩: '色彩氛围完整，关系还可明确',
      叙事: '现场感已经出现，观看路径还可优化',
      技术完成度: '画面可读，细节仍需整理',
    },
    高级: {
      构图: '空间关系成立，但取舍仍偏松',
      光线: '光线方向可读，层次还不够精确',
      色彩: '色彩气氛成立，表达仍可更克制',
      叙事: '气氛已经建立，叙事张力仍不足',
      技术完成度: '完成度具备基础，细节还需推敲',
    },
  };
  const genreFallback = {
    街头摄影: skillLevel === '高级' ? '现场气息可见，瞬间关系仍需更强' : '现场感已经出现，观看路径还可优化',
    人像摄影: skillLevel === '高级' ? '人物状态成立，情绪深度仍可推进' : '人物状态自然，背景关系仍可收紧',
    风景摄影: skillLevel === '高级' ? '气氛成立，但空间层次仍可深化' : '光线有气氛，层次仍可强化',
    建筑摄影: skillLevel === '高级' ? '结构秩序可见，空间取舍仍需更准' : '空间秩序成立，细节仍需整理',
    静物摄影: skillLevel === '高级' ? '物件关系成立，质感表达仍可深化' : '物件关系成立，质感还可加强',
    旅行摄影: skillLevel === '高级' ? '地方气息可见，叙事仍需更具体' : '地方气息可见，叙事还可聚焦',
  };

  return skillTone[skillLevel]?.[weakest.name] || genreFallback[genre] || skillTone.进阶[weakest.name] || '画面基础成立，重心仍可收紧';
}

function getSkillScoreShift(skillLevel = '进阶') {
  if (skillLevel === '初学者') return 7;
  if (skillLevel === '高级') return -11;
  return -1;
}

function calibrateScoresBySkillLevel(scores = {}, skillLevel = '进阶') {
  const rawEntries = scoreNames.map((name) => ({ name, score: normalizeScore(scores[name], 70) }));
  const rawAverage = Math.round(rawEntries.reduce((sum, item) => sum + item.score, 0) / rawEntries.length);
  const shift = getSkillScoreShift(skillLevel);
  const sorted = [...rawEntries].sort((a, b) => b.score - a.score);
  const strongestName = sorted[0]?.name;
  const weakestName = sorted[sorted.length - 1]?.name;
  const calibrated = {};

  for (const item of rawEntries) {
    let value = item.score + shift;

    if (rawEntries.every((entry) => Math.abs(entry.score - rawEntries[0].score) <= 4)) {
      if (item.name === strongestName) value += 3;
      if (item.name === weakestName) value -= 5;
    }

    if (skillLevel === '初学者') {
      value = Math.max(55, Math.min(93, value));
    } else if (skillLevel === '高级') {
      const highCap = rawAverage >= 88 ? 86 : rawAverage >= 82 ? 80 : 76;
      value = Math.max(35, Math.min(highCap, value));
    } else {
      const midCap = rawAverage >= 88 ? 90 : 84;
      value = Math.max(45, Math.min(midCap, value));
    }

    calibrated[item.name] = Math.max(0, Math.min(100, Math.round(value)));
  }

  console.log('[PhotoSense AI] raw model scores:', JSON.stringify(Object.fromEntries(rawEntries.map((item) => [item.name, item.score]))));
  console.log('[PhotoSense AI] skillLevel:', skillLevel);
  console.log('[PhotoSense AI] calibrated scores:', JSON.stringify(calibrated));
  console.log('[PhotoSense AI] final overall score:', Math.round(scoreNames.reduce((sum, name) => sum + calibrated[name], 0) / scoreNames.length));

  return calibrated;
}

function getFallbackScores(medium = '数码摄影', genre = '街头摄影', skillLevel = '初学者') {
  const skillShift = skillLevel === '初学者' ? 6 : skillLevel === '高级' ? -8 : 0;
  const baseScores = {
    构图: 72,
    光线: 64,
    色彩: 79,
    叙事: 68,
    技术完成度: 82,
  };
  const genreShift = {
    街头摄影: { 叙事: 3, 技术完成度: -1 },
    人像摄影: { 光线: 1, 色彩: 2, 叙事: 1 },
    风景摄影: { 光线: 3, 色彩: 1, 叙事: -1 },
    建筑摄影: { 构图: 3, 技术完成度: 2, 叙事: -1 },
    静物摄影: { 构图: 2, 色彩: 2, 技术完成度: 1 },
    旅行摄影: { 叙事: 2, 色彩: 1, 构图: 1 },
  };
  const mediumShift = {
    数码摄影: { 技术完成度: 2, 色彩: 1 },
    胶片摄影: { 色彩: 1, 叙事: 1, 技术完成度: -1 },
  };

  return scoreNames.reduce((scores, name) => {
    const rawScore = baseScores[name] + skillShift + (genreShift[genre]?.[name] || 0) + (mediumShift[medium]?.[name] || 0);
    scores[name] = Math.max(0, Math.min(100, Math.round(rawScore)));
    return scores;
  }, {});
}

function normalizeTextArray(value, fallback, limit = 3) {
  const source = Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
    : [];

  while (source.length < Math.min(fallback.length, limit)) {
    source.push(fallback[source.length]);
  }

  return source.slice(0, limit);
}

function normalizeAdviceItem(value, fallback) {
  return {
    suggestion: sanitizeUserFacingText(value?.suggestion, fallback.suggestion),
    reason: sanitizeUserFacingText(value?.reason, fallback.reason),
    expectedEffect: sanitizeUserFacingText(value?.expectedEffect, fallback.expectedEffect),
  };
}

function normalizeVerdict(value, fallback) {
  const title = sanitizeUserFacingText(value?.title, fallback.title);
  const safeTags = Array.isArray(value?.tags)
    ? value.tags.filter((item) => typeof item === 'string' && item.trim() && !containsInternalMetaLanguage(item)).map((item) => item.trim()).slice(0, 3)
    : [];

  return {
    title: title.length > 28 ? fallback.title : title,
    summary: sanitizeUserFacingText(value?.summary, fallback.summary),
    mainIssue: sanitizeUserFacingText(value?.mainIssue, fallback.mainIssue),
    nextStep: sanitizeUserFacingText(value?.nextStep, fallback.nextStep),
    tags: safeTags.length ? safeTags : fallback.tags,
  };
}

function normalizePostProcessing(value, fallback) {
  return {
    crop: normalizeAdviceItem(value?.crop, fallback.crop),
    tone: normalizeAdviceItem(value?.tone, fallback.tone),
    masking: normalizeAdviceItem(value?.masking, fallback.masking),
  };
}

function normalizeNextShooting(value, fallback) {
  const sourceItems = Array.isArray(value?.items) ? value.items : [];
  const items = fallback.items.map((fallbackItem, index) => sanitizeUserFacingText(sourceItems[index], fallbackItem));

  return {
    summary: sanitizeUserFacingText(value?.summary, fallback.summary),
    items,
  };
}

function normalizeReviewContext(value, fallback) {
  return {
    mediumFocus: normalizeText(value?.mediumFocus, fallback.mediumFocus),
    levelFocus: normalizeText(value?.levelFocus, fallback.levelFocus),
    genreFocus: normalizeText(value?.genreFocus, fallback.genreFocus),
    scoringLogic: normalizeText(value?.scoringLogic, fallback.scoringLogic),
  };
}

function normalizeReport(report, { genre, skillLevel, medium }) {
  const fallbackReviewContext = getReviewContext(medium, genre, skillLevel);
  const fallbackScores = getFallbackScores(medium, genre, skillLevel);
  const fallbackNextShooting = {
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
      items: ['把当地生活线索放入画面，但控制它们的数量。', '等待人物动作、光线和地点标识形成一个清楚关系。', '尝试更具体的拍摄角度，让画面不只是普通记录。'],
    },
  }[genre] || {
    summary: '下一次拍摄优先让主要关系更早成立，再决定环境信息保留多少。',
    items: ['先确认画面里最重要的一处信息。', '拍摄前检查边缘是否有无关亮点。', '等待主体关系或光线层次更明确的瞬间。'],
  };
  const fallback = {
    overall: `${genre}作品已经具备复盘基础。画面有可读线索，但仍需要继续整理观看顺序、明暗层次和信息取舍。`,
    scores: fallbackScores,
    composition: '结论：主体关系基本成立。说明：画面仍需要进一步整理边缘信息。方向：收紧取景，让视觉入口更明确。',
    lighting: '结论：光线具备可读性。说明：局部明暗层次仍可更集中。方向：优先处理高光与主体亮度。',
    colour: '结论：色彩保持克制。说明：关键色可以更清楚地承担情绪。方向：减少无关色彩干扰。',
    storytelling: '结论：画面具有现场线索。说明：叙事重心还可以更明确。方向：保留最能说明关系的视觉元素。',
    technical: '结论：技术完成度可以支撑复盘。说明：清晰度与曝光仍有优化空间。方向：使用轻量后期而非重滤镜。',
    suggestions: ['明确主体位置。', '检查画面边缘干扰。', '用局部调整强化观看顺序。'],
    recipe: {
      exposure: '+0.20',
      contrast: '+10',
      highlights: '-15',
      shadows: '+12',
      temperature: medium === '胶片摄影' ? '+4 偏暖' : '+2 偏暖',
      cropRatio: genre === '人像摄影' ? '4:5 竖幅' : '3:2 编辑裁切',
    },
    verdict: {
      title: getSafeVerdictTitle(genre, fallbackScores, skillLevel),
      summary: '画面已有可读的视觉基础，但观看路径和信息取舍仍可继续整理，让主要关系更快被看见。',
      mainIssue: medium === '胶片摄影'
        ? '颗粒、色偏和现场气氛还需要更明确地共同指向主题。'
        : '曝光层次、边缘信息和主体关系还可以更集中。',
      nextStep: skillLevel === '高级' ? '先判断最有作品集价值的视觉关系，再决定是否保留更多环境信息。' : '优先做轻微裁切和局部影调整理，让主体更快被看见。',
      tags: ['观看路径', '局部层次', '信息取舍'],
    },
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
        reason: '局部提亮或压暗比全局调整更适合保持现场感。',
        expectedEffect: '视线停留位置更明确，照片仍保持自然质感。',
      },
    },
    nextShooting: {
      summary: fallbackNextShooting.summary,
      items: fallbackNextShooting.items,
    },
    reviewContext: fallbackReviewContext,
  };

  const sourceScores = report?.scores || {};
  const rawNormalizedScores = scoreNames.reduce((result, name) => {
    result[name] = normalizeScore(sourceScores[name], fallback.scores[name]);
    return result;
  }, {});
  const scores = calibrateScoresBySkillLevel(rawNormalizedScores, skillLevel);
  fallback.scores = scores;
  fallback.verdict = {
    ...fallback.verdict,
    title: getSafeVerdictTitle(genre, scores, skillLevel),
  };

  const sourceSuggestions = Array.isArray(report?.suggestions)
    ? report.suggestions.filter((item) => typeof item === 'string' && item.trim()).slice(0, 3)
    : [];

  while (sourceSuggestions.length < 3) {
    sourceSuggestions.push(fallback.suggestions[sourceSuggestions.length]);
  }

  const sourceRecipe = report?.recipe || {};

  return {
    overall: normalizeText(report?.overall, fallback.overall),
    scores,
    composition: normalizeText(report?.composition, fallback.composition),
    lighting: normalizeText(report?.lighting, fallback.lighting),
    colour: normalizeText(report?.colour, fallback.colour),
    storytelling: normalizeText(report?.storytelling, fallback.storytelling),
    technical: normalizeText(report?.technical, fallback.technical),
    suggestions: sourceSuggestions,
    recipe: {
      exposure: normalizeText(sourceRecipe.exposure, fallback.recipe.exposure),
      contrast: normalizeText(sourceRecipe.contrast, fallback.recipe.contrast),
      highlights: normalizeText(sourceRecipe.highlights, fallback.recipe.highlights),
      shadows: normalizeText(sourceRecipe.shadows, fallback.recipe.shadows),
      temperature: normalizeText(sourceRecipe.temperature, fallback.recipe.temperature),
      cropRatio: normalizeText(sourceRecipe.cropRatio, fallback.recipe.cropRatio),
    },
    verdict: normalizeVerdict(report?.verdict, fallback.verdict),
    reviewContext: normalizeReviewContext(report?.reviewContext, fallback.reviewContext),
    postProcessing: normalizePostProcessing(report?.postProcessing, fallback.postProcessing),
    nextShooting: normalizeNextShooting(report?.nextShooting, fallback.nextShooting),
  };
}

function createReportPrompt({ medium = '数码摄影', genre = '街头摄影', skillLevel = '初学者', fileName = '', workTitle = '', title = '' }) {
  const selectedReviewContext = getReviewContext(medium, genre, skillLevel);
  const skillStrictness = {
    初学者: '更宽容、更教学化；普通可读照片可以得到较高鼓励分，建议要简单明确。',
    进阶: '正常摄影点评标准；指出具体优缺点，分数居中，不要过度鼓励。',
    高级: '作品集/编辑评审标准；更严格，普通照片不要轻易超过 80 分，建议更偏表达完成度。',
  }[skillLevel] || '正常摄影点评标准。';

  return `你是 PhotoSense AI 的中文摄影导师。请根据上传照片生成一份简洁、具体、可执行的摄影点评报告。

用户选择：
- 文件名：${fileName || '未命名照片'}
- 作品标题：${workTitle || title || '未填写'}
- 影像介质：${medium}
- 摄影题材：${genre}
- 点评口径：${skillLevel}

评价上下文：
- 影像介质标准：${selectedReviewContext.mediumFocus}
- 点评口径标准：${selectedReviewContext.levelFocus}
- 题材标准：${selectedReviewContext.genreFocus}
- 评分侧重：${selectedReviewContext.scoringLogic}
- 严格度：${skillStrictness}

必须遵守：
1. 只返回一个合法 JSON object。不要 Markdown，不要解释，不要代码围栏。第一个字符必须是 {，最后一个字符必须是 }。
2. 所有字符串必须用双引号。不要尾随逗号。不要在字符串里写未转义换行。
3. 文本要短。verdict.title 8-22 个汉字；summary 1-2 句；每个建议字段尽量不超过 45 个汉字。
4. verdict、postProcessing、nextShooting 必须像给用户看的摄影点评，不要像系统说明。
5. 这些词不得出现在 verdict、postProcessing、nextShooting 中：本次评分、评分侧重、评价基准、点评口径、按初学者口径、按进阶口径、按高级口径、用户选择、AI、模型、建议优化后入选。
6. reviewContext 可以解释评价标准；但不要把 reviewContext 句子复制到 verdict.summary。
7. 不要使用“xx摄影的画面基础成立，仍需按xx口径收紧判断”这类模板句。
8. 不要编造相机参数、地名、精确坐标或框选区域。

评分规则：
- scores 必须是 0-100 整数。
- 90-100：非常出色或作品集级别；80-89：强但仍可改进；70-79：不错但限制明显；60-69：普通或明显受限；45-59：偏弱但有可用部分；45 以下：严重问题。
- 不要全部集中到 75/78/80。若有明显强弱项，维度之间可以相差 10-20 分。
- 同一张普通照片在初学者下应更宽容，进阶居中，高级更严格。高级口径下普通照片不要轻易超过 80。

题材判断要点：
- 街头摄影：时机、人物姿态、主体与环境关系、现场秩序与张力。
- 人像摄影：表情眼神、肤色、姿态、人物与背景关系、情绪可信度。
- 风景摄影：空间层次、光线时机、前中后景、影调和地方感。
- 建筑摄影：透视控制、垂直水平线、结构节奏、材质与光线体量。
- 静物摄影：物件关系、材质、阴影、背景、留白。
- 旅行摄影：地方感、人的痕迹、叙事上下文、记录与作品性的平衡。

后期建议：
- 必须结合可见画面和用户选择，不要泛泛而谈。
- 如果当前照片在该口径下已经不错，可以写“基本保持当前裁切”“不建议大幅改变影调”“仅做轻微局部整理”“当前处理已基本足够”。
- 胶片摄影要尊重颗粒、色偏、冲扫质感；数码摄影可讨论高光、白平衡、锐度、噪点、局部对比。

下次拍摄建议：
- 必须引用可见场景信息，例如背景、天气/天空、光线、主体位置、人物姿态、建筑结构、前中后景、拍摄距离或角度。
- 不要给每张照片相同的通用动作。

输出 JSON 结构如下，字段名必须一致：
{
  "overall": "总体印象，1-2句中文",
  "verdict": {
    "title": "用户主标题",
    "summary": "整体结论",
    "mainIssue": "最主要的可见问题",
    "nextStep": "最重要的下一步动作",
    "tags": ["标签1", "标签2", "标签3"]
  },
  "reviewContext": {
    "mediumFocus": "影像介质如何影响评价",
    "levelFocus": "点评口径如何影响评价",
    "genreFocus": "题材判断标准",
    "scoringLogic": "评分最重视什么"
  },
  "scores": {"构图": 78, "光线": 72, "色彩": 80, "叙事": 66, "技术完成度": 75},
  "composition": "结论：...。说明：...。方向：...。",
  "lighting": "结论：...。说明：...。方向：...。",
  "colour": "结论：...。说明：...。方向：...。",
  "storytelling": "结论：...。说明：...。方向：...。",
  "technical": "结论：...。说明：...。方向：...。",
  "suggestions": ["建议1", "建议2", "建议3"],
  "postProcessing": {
    "crop": {"suggestion": "裁剪建议", "reason": "理由", "expectedEffect": "预期效果"},
    "tone": {"suggestion": "影调建议", "reason": "理由", "expectedEffect": "预期效果"},
    "masking": {"suggestion": "蒙版建议", "reason": "理由", "expectedEffect": "预期效果"}
  },
  "nextShooting": {"summary": "下次拍摄总建议", "items": ["行动1", "行动2", "行动3"]}
}`;
}
async function createNativeGeminiReport({ imageDataUrl, medium, genre, skillLevel, fileName, workTitle, title }) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const error = new Error('未配置 GEMINI_API_KEY。');
    error.statusCode = 503;
    throw error;
  }

  const { mimeType, base64Data } = parseImageDataUrl(imageDataUrl);
  const prompt = createReportPrompt({ medium, genre, skillLevel, fileName, workTitle, title });

  console.log('[PhotoSense AI] provider mode: native-gemini');
  console.log('[PhotoSense AI] base URL: https://generativelanguage.googleapis.com/v1beta');
  console.log('[PhotoSense AI] model:', GEMINI_MODEL);
  console.log('[PhotoSense AI] Gemini request starts');

  const geminiResponse = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.45,
        responseMimeType: 'application/json',
      },
    }),
  });

  const data = await geminiResponse.json();

  if (!geminiResponse.ok) {
    const error = new Error(data.error?.message || 'Gemini API 请求失败。');
    error.statusCode = geminiResponse.status;
    throw error;
  }

  console.log('[PhotoSense AI] Gemini response received');

  const outputText = extractGeminiText(data);

  if (!outputText) {
    throw new Error('Gemini API 没有返回可解析的报告文本。');
  }

  return normalizeReport(parseJsonText(outputText), { genre, skillLevel, medium });
}

async function createRelayReport({ imageDataUrl, medium, genre, skillLevel, fileName, workTitle, title }) {
  const apiKey = process.env.GEMINI_RELAY_API_KEY;

  if (!apiKey) {
    const error = new Error('未配置 GEMINI_RELAY_API_KEY。');
    error.statusCode = 503;
    throw error;
  }

  parseImageDataUrl(imageDataUrl);

  const prompt = createReportPrompt({ medium, genre, skillLevel, fileName, workTitle, title });
  const relayUrl = `${GEMINI_RELAY_BASE_URL}/chat/completions`;

  console.log('[PhotoSense AI] provider mode: relay-openai-compatible');
  console.log('[PhotoSense AI] base URL:', GEMINI_RELAY_BASE_URL);
  console.log('[PhotoSense AI] model:', GEMINI_RELAY_MODEL);
  console.log('[PhotoSense AI] Gemini relay request starts');

  const relayResponse = await fetchWithTimeout(relayUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GEMINI_RELAY_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
      temperature: 0.45,
    }),
  });

  console.log('[PhotoSense AI] relay response status:', relayResponse.status);

  const responseText = await relayResponse.text();

  if (!relayResponse.ok) {
    console.error('[PhotoSense AI] relay response body on error:', responseText);
    const error = new Error('Gemini relay API 请求失败。');
    error.statusCode = relayResponse.status;
    throw error;
  }

  let data;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error('Gemini relay API 返回的响应不是有效 JSON。');
  }

  console.log('[PhotoSense AI] Gemini relay response received');

  const outputText = extractRelayText(data);

  if (!outputText) {
    throw new Error('Gemini relay API 没有返回可解析的报告文本。');
  }

  return normalizeReport(parseJsonText(outputText), { genre, skillLevel, medium });
}

function createJsonRepairPrompt({ brokenText, medium, genre, skillLevel }) {
  const safeBrokenText = String(brokenText || '').slice(0, 12000);

  return `你是 JSON 修复器。下面是一段由摄影点评模型返回的损坏 JSON 或 JSON-like 文本。请只做格式修复和字段补全，不要重新点评照片。

修复要求：
- 只返回一个合法 JSON object。
- 第一个字符必须是 {，最后一个字符必须是 }。
- 不要 Markdown，不要解释。
- 所有字符串必须使用双引号。
- 不要尾随逗号。
- 如果某个字段缺失或残缺，请用简短中文补全。
- scores 必须是 0-100 整数。
- 不要在 verdict、postProcessing、nextShooting 中写“本次评分、评分侧重、评价基准、点评口径、按初学者口径、按进阶口径、按高级口径、用户选择、AI、模型、建议优化后入选”。

当前上下文：
- 影像介质：${medium}
- 摄影题材：${genre}
- 点评口径：${skillLevel}

必须输出这些顶层字段：overall, verdict, reviewContext, scores, composition, lighting, colour, storytelling, technical, suggestions, postProcessing, nextShooting。recipe 可省略。

损坏文本如下：
${safeBrokenText}`;
}

async function repairReportJsonWithOpenAiRelay({ apiKey, relayUrl, brokenText, medium, genre, skillLevel }) {
  console.warn('[PhotoSense AI] JSON parse failed; attempting OpenAI relay JSON repair.');

  const repairResponse = await fetchWithTimeout(relayUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_RELAY_MODEL,
      messages: [
        {
          role: 'user',
          content: createJsonRepairPrompt({ brokenText, medium, genre, skillLevel }),
        },
      ],
      temperature: 0,
      max_tokens: 2600,
      response_format: { type: 'json_object' },
    }),
  }, OPENAI_RELAY_TIMEOUT_MS);

  console.log('[PhotoSense AI] OpenAI relay JSON repair response status:', repairResponse.status);

  const repairResponseText = await repairResponse.text();
  console.log('[PhotoSense AI] OpenAI relay JSON repair preview:', repairResponseText.slice(0, 1200));

  if (!repairResponse.ok) {
    const error = new Error('OpenAI-compatible relay JSON 修复请求失败。');
    error.statusCode = repairResponse.status;
    throw error;
  }

  const repairOutputText = parseOpenAiRelayResponseText(repairResponseText);

  if (!repairOutputText) {
    throw new Error('OpenAI-compatible relay JSON 修复没有返回可解析文本。');
  }

  return extractJsonFromText(repairOutputText);
}

async function createOpenAiRelayReport({ imageDataUrl, medium, genre, skillLevel, fileName, workTitle, title }) {
  const apiKey = process.env.OPENAI_RELAY_API_KEY;

  if (!apiKey) {
    const error = new Error('未配置 OPENAI_RELAY_API_KEY。');
    error.statusCode = 503;
    throw error;
  }

  parseImageDataUrl(imageDataUrl);

  const prompt = createReportPrompt({ medium, genre, skillLevel, fileName, workTitle, title });
  const relayUrl = `${OPENAI_RELAY_BASE_URL}/chat/completions`;

  console.log('[PhotoSense AI] provider mode: openai-relay');
  console.log('[PhotoSense AI] base URL:', OPENAI_RELAY_BASE_URL);
  console.log('[PhotoSense AI] model:', OPENAI_RELAY_MODEL);
  console.log('[PhotoSense AI] OpenAI relay request starts');

  const relayResponse = await fetchWithTimeout(relayUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_RELAY_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
      temperature: 0.45,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    }),
  }, OPENAI_RELAY_TIMEOUT_MS);

  console.log('[PhotoSense AI] OpenAI relay response status:', relayResponse.status);

  const responseText = await relayResponse.text();
  const contentType = relayResponse.headers.get('content-type') || '';
  console.log('[PhotoSense AI] OpenAI relay response content-type:', contentType);
  console.log('[PhotoSense AI] OpenAI relay responseText length:', responseText.length);
  console.log('[PhotoSense AI] OpenAI relay response preview:', responseText.slice(0, 1500));

  if (!relayResponse.ok) {
    console.error('[PhotoSense AI] OpenAI relay error body preview if not ok:', responseText.slice(0, 1200));
    const error = new Error('OpenAI-compatible relay API 请求失败。');
    error.statusCode = relayResponse.status;
    throw error;
  }

  console.log('[PhotoSense AI] OpenAI relay response received');

  const outputText = parseOpenAiRelayResponseText(responseText);

  if (!outputText) {
    throw new Error('OpenAI-compatible relay API 没有返回可解析的报告文本。');
  }

  console.log('[PhotoSense AI] JSON parse starts');

  let parsedReport;

  try {
    parsedReport = extractJsonFromText(outputText);
  } catch (parseError) {
    console.warn('[PhotoSense AI] first JSON parse failed:', parseError?.message || parseError);
    parsedReport = await repairReportJsonWithOpenAiRelay({
      apiKey,
      relayUrl,
      brokenText: parseError?.rawText || outputText,
      medium,
      genre,
      skillLevel,
    });
  }

  return normalizeReport(parsedReport, { genre, skillLevel, medium });
}

async function createAnthropicRelayReport({ imageDataUrl, medium, genre, skillLevel, fileName, workTitle, title }) {
  const apiKey = process.env.ANTHROPIC_RELAY_API_KEY;

  if (!apiKey) {
    const error = new Error('未配置 ANTHROPIC_RELAY_API_KEY。');
    error.statusCode = 503;
    throw error;
  }

  const { mimeType, base64Data } = parseImageDataUrl(imageDataUrl);
  const prompt = createReportPrompt({ medium, genre, skillLevel, fileName, workTitle, title });
  const relayUrl = `${ANTHROPIC_RELAY_BASE_URL}/v1/messages`;

  console.log('[PhotoSense AI] provider mode: anthropic-relay');
  console.log('[PhotoSense AI] base URL:', ANTHROPIC_RELAY_BASE_URL);
  console.log('[PhotoSense AI] model:', ANTHROPIC_RELAY_MODEL);
  console.log('[PhotoSense AI] parsed media_type:', mimeType);
  console.log('[PhotoSense AI] Claude relay request starts');

  const anthropicResponse = await fetchWithTimeout(relayUrl, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_RELAY_MODEL,
      max_tokens: 3000,
      temperature: 0.45,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    }),
  }, ANTHROPIC_TIMEOUT_MS);

  console.log('[PhotoSense AI] Claude relay response status:', anthropicResponse.status);

  const responseText = await anthropicResponse.text();

  if (!anthropicResponse.ok) {
    console.error('[PhotoSense AI] Claude relay response body preview if not ok:', responseText.slice(0, 1200));
    const error = new Error('Claude relay API 请求失败。');
    error.statusCode = anthropicResponse.status;
    throw error;
  }

  let data;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error('Claude relay API 返回的响应不是有效 JSON。');
  }

  console.log('[PhotoSense AI] Claude relay response received');

  const outputText = extractAnthropicText(data);

  if (!outputText) {
    throw new Error('Claude relay API 没有返回可解析的报告文本。');
  }

  console.log('[PhotoSense AI] JSON parse starts');

  return normalizeReport(parseJsonText(outputText), { genre, skillLevel, medium });
}

async function createPhotoReport({ imageDataUrl, medium = '数码摄影', genre = '街头摄影', skillLevel = '初学者', fileName = '', workTitle = '', title = '' }) {
  const context = { imageDataUrl, medium, genre, skillLevel, fileName, workTitle, title };

  if (OPENAI_RELAY_BASE_URL) {
    return createOpenAiRelayReport(context);
  }

  if (GEMINI_RELAY_BASE_URL) {
    return createRelayReport(context);
  }

  if (ANTHROPIC_RELAY_BASE_URL) {
    return createAnthropicRelayReport(context);
  }

  if (process.env.GEMINI_API_KEY) {
    return createNativeGeminiReport(context);
  }

  const error = new Error('未配置可用的 AI provider API Key。');
  error.statusCode = 503;
  throw error;
}

function createExportFileName(date = new Date()) {
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const timestamp = safeDate.toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
  return `photosense_reports_export_${timestamp}.json`;
}

async function saveReportHistoryExport(body) {
  const records = Array.isArray(body?.records) ? body.records : [];
  const exportedAt = typeof body?.exportedAt === 'string' ? body.exportedAt : new Date().toISOString();
  const payload = {
    app: 'PhotoSense AI',
    exportedAt,
    recordCount: records.length,
    records,
  };
  const stableRelativePath = 'exports/photosense_reports_history.json';
  const snapshotPath = path.join(EXPORTS_DIR, createExportFileName(new Date(exportedAt)));

  await fs.mkdir(EXPORTS_DIR, { recursive: true });
  await fs.writeFile(HISTORY_EXPORT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fs.writeFile(snapshotPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log('[PhotoSense AI] report history saved:', stableRelativePath, `records=${records.length}`);
  console.log('[PhotoSense AI] report history snapshot saved:', path.relative(process.cwd(), snapshotPath).replace(/\\/g, '/'));

  return {
    ok: true,
    path: stableRelativePath,
  };
}


const DIST_DIR = path.join(process.cwd(), 'dist');

const staticMimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function getStaticMimeType(filePath) {
  return staticMimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

async function serveStaticApp(request, response, requestUrl) {
  const method = request.method || 'GET';
  const rawPath = decodeURIComponent(requestUrl.pathname || '/');

  if (rawPath.startsWith('/api/')) {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }

  const normalizedPath = path.normalize(rawPath).replace(/^([.][.][/\\])+/, '');
  const relativePath = normalizedPath === '/' || normalizedPath === '.' ? 'index.html' : normalizedPath.replace(/^[/\\]+/, '');
  let filePath = path.join(DIST_DIR, relativePath);

  if (!filePath.startsWith(DIST_DIR)) {
    sendJson(response, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
  } catch {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  try {
    const file = await fs.readFile(filePath);
    response.writeHead(200, {
      'Content-Type': getStaticMimeType(filePath),
      'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    if (method !== 'HEAD') {
      response.end(file);
    } else {
      response.end();
    }
  } catch (error) {
    console.error('[PhotoSense AI] static file serve failed:', error);
    sendJson(response, 404, { error: 'Not found' });
  }
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    setCorsHeaders(response);
    response.writeHead(204);
    response.end();
    return;
  }

  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'GET' || request.method === 'HEAD') {
    await serveStaticApp(request, response, requestUrl);
    return;
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }

  if (requestUrl.pathname === '/api/save-report-history') {
    console.log('[PhotoSense AI] save report history request received');

    try {
      const body = await readJsonBody(request);
      const result = await saveReportHistoryExport(body);
      sendJson(response, 200, result);
    } catch (error) {
      console.error('[PhotoSense AI] save report history failed:', error);
      sendJson(response, 500, {
        ok: false,
        error: '保存报告历史失败。',
      });
    }

    return;
  }

  if (requestUrl.pathname !== '/api/analyze-photo') {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }

  console.log('[PhotoSense AI] request received');

  try {
    const body = await readJsonBody(request);
    console.log('[PhotoSense AI] imageDataUrl exists:', Boolean(body.imageDataUrl));
    console.log('[PhotoSense AI] imageDataUrl starts with data:image/:', typeof body.imageDataUrl === 'string' && body.imageDataUrl.startsWith('data:image/'));
    console.log('[PhotoSense AI] imageDataUrl length:', typeof body.imageDataUrl === 'string' ? body.imageDataUrl.length : 0);

    if (!body.imageDataUrl || typeof body.imageDataUrl !== 'string') {
      sendJson(response, 400, { error: '缺少 imageDataUrl。' });
      return;
    }

    const report = await createPhotoReport(body);
    console.log('[PhotoSense AI] response sent to frontend');
    sendJson(response, 200, { ok: true, report });
  } catch (error) {
    console.error('[PhotoSense AI] error details:', error);
    sendJson(response, error.statusCode || 500, {
      ok: false,
      error: error.message || '分析照片失败。',
    });
  }
});

server.listen(PORT, () => {
  console.log(`PhotoSense AI local API running at http://localhost:${PORT}/api/analyze-photo`);
});
