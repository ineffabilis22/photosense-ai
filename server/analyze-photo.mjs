import http from 'node:http';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

function loadLocalEnvFile() {
  const envPath = path.join(process.cwd(), '.env');

  if (!fsSync.existsSync(envPath)) {
    return;
  }

  const envText = fsSync.readFileSync(envPath, 'utf8');

  for (const rawLine of envText.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const equalsIndex = line.indexOf('=');

    if (equalsIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadLocalEnvFile();


const PORT = Number(process.env.PORT || 8787);
const OPENAI_RELAY_BASE_URL = process.env.OPENAI_RELAY_BASE_URL?.trim().replace(/\/+$/, '');
const OPENAI_RELAY_MODEL = process.env.OPENAI_RELAY_MODEL?.trim() || 'gpt-5.4';
const MAX_BODY_SIZE = 15 * 1024 * 1024;
const PROVIDER_TIMEOUT_MS = Number(process.env.PROVIDER_TIMEOUT_MS || 45_000);
const OPENAI_RELAY_TIMEOUT_MS = Number(process.env.OPENAI_RELAY_TIMEOUT_MS || 45_000);
const OPENAI_RELAY_MAX_TOKENS = Number(process.env.OPENAI_RELAY_MAX_TOKENS || 2500);
const OPENAI_RELAY_TEMPERATURE = Number(process.env.OPENAI_RELAY_TEMPERATURE || 0.35);

const scoreNames = ['构图', '光线', '色彩', '叙事', '技术完成度'];
const EXPORTS_DIR = path.join(process.cwd(), 'exports');
const HISTORY_EXPORT_PATH = path.join(EXPORTS_DIR, 'photosense_reports_history.json');
const DEBUG_AI_RESPONSE_LATEST_PATH = path.join(EXPORTS_DIR, 'debug_ai_response_latest.txt');
const DEBUG_AI_OUTPUT_LATEST_PATH = path.join(EXPORTS_DIR, 'debug_ai_output_latest.txt');
const DIST_DIR = path.join(process.cwd(), 'dist');
const INDEX_HTML_PATH = path.join(DIST_DIR, 'index.html');
const STATIC_MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

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

function isSafeStaticPath(filePath) {
  const relativePath = path.relative(DIST_DIR, filePath);
  return Boolean(relativePath) && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

async function sendStaticFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = STATIC_MIME_TYPES[extension] || 'application/octet-stream';

  try {
    const data = await fs.readFile(filePath);
    response.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': extension === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
    });
    response.end(data);
    return true;
  } catch {
    return false;
  }
}

async function serveFrontend(requestUrl, response) {
  if (!fsSync.existsSync(INDEX_HTML_PATH)) {
    sendJson(response, 404, {
      ok: false,
      error: '前端构建文件不存在。请先运行 npm run build。',
    });
    return;
  }

  const decodedPathname = decodeURIComponent(requestUrl.pathname);
  const normalizedPathname = decodedPathname === '/' ? '/index.html' : decodedPathname;
  const requestedFilePath = path.join(DIST_DIR, normalizedPathname);

  if (isSafeStaticPath(requestedFilePath) && fsSync.existsSync(requestedFilePath)) {
    const stat = await fs.stat(requestedFilePath);

    if (stat.isFile()) {
      await sendStaticFile(response, requestedFilePath);
      return;
    }
  }

  await sendStaticFile(response, INDEX_HTML_PATH);
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

function sanitizeJsonText(text) {
  return String(text ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^```(?:json|javascript|js)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function removeTrailingCommas(jsonText) {
  return jsonText.replace(/,\s*([}\]])/g, '$1');
}

function tryParseJsonCandidate(candidate) {
  const attempts = [
    candidate,
    removeTrailingCommas(candidate),
    candidate.replace(/[“”]/g, '"').replace(/[‘’]/g, "'"),
    removeTrailingCommas(candidate.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")),
  ];

  let lastError;

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function findBalancedJsonObjects(text) {
  const candidates = [];
  let startIndex = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      if (depth === 0) {
        startIndex = index;
      }

      depth += 1;
      continue;
    }

    if (char === '}') {
      if (depth > 0) {
        depth -= 1;

        if (depth === 0 && startIndex >= 0) {
          candidates.push(text.slice(startIndex, index + 1));
          startIndex = -1;
        }
      }
    }
  }

  return candidates;
}

async function saveAiDebugFile(filePath, content) {
  try {
    await fs.mkdir(EXPORTS_DIR, { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
  } catch (error) {
    console.warn('[PhotoSense AI] failed to save debug file:', error?.message || error);
  }
}

async function saveAiDebugSnapshot({ responseText = '', outputText = '', error = null, label = 'openai-relay' }) {
  const timestamp = new Date().toISOString();
  const errorText = error ? `${error?.name || 'Error'}: ${error?.message || String(error)}` : 'none';
  const responseSnapshotPath = path.join(EXPORTS_DIR, `debug_ai_response_${Date.now()}.txt`);
  const outputSnapshotPath = path.join(EXPORTS_DIR, `debug_ai_output_${Date.now()}.txt`);
  const responseContent = [
    `timestamp=${timestamp}`,
    `label=${label}`,
    `error=${errorText}`,
    '',
    '----- RAW PROVIDER RESPONSE -----',
    responseText || '',
  ].join('\n');
  const outputContent = [
    `timestamp=${timestamp}`,
    `label=${label}`,
    `error=${errorText}`,
    '',
    '----- EXTRACTED MODEL OUTPUT -----',
    outputText || '',
  ].join('\n');

  await saveAiDebugFile(DEBUG_AI_RESPONSE_LATEST_PATH, responseContent);
  await saveAiDebugFile(DEBUG_AI_OUTPUT_LATEST_PATH, outputContent);
  await saveAiDebugFile(responseSnapshotPath, responseContent);
  await saveAiDebugFile(outputSnapshotPath, outputContent);

  console.error('[PhotoSense AI] debug response saved:', path.relative(process.cwd(), DEBUG_AI_RESPONSE_LATEST_PATH).replace(/\\/g, '/'));
  console.error('[PhotoSense AI] debug output saved:', path.relative(process.cwd(), DEBUG_AI_OUTPUT_LATEST_PATH).replace(/\\/g, '/'));
}

function getJsonParsePreview(text) {
  const normalized = String(text ?? '');
  const head = normalized.slice(0, 1800);
  const tail = normalized.length > 1800 ? normalized.slice(-900) : '';
  return tail ? `${head}\n\n----- OUTPUT TAIL -----\n${tail}` : head;
}

function extractJsonFromText(text) {
  if (text && typeof text === 'object') {
    return text;
  }

  const cleanedText = sanitizeJsonText(text);

  if (!cleanedText) {
    throw new Error('AI 返回内容为空，无法解析报告 JSON。');
  }

  try {
    return tryParseJsonCandidate(cleanedText);
  } catch (directError) {
    const fencedMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)```/i);

    if (fencedMatch?.[1]) {
      try {
        return tryParseJsonCandidate(fencedMatch[1].trim());
      } catch {
        // Continue to balanced object extraction below.
      }
    }

    const candidates = findBalancedJsonObjects(cleanedText);

    for (const candidate of candidates) {
      try {
        const parsed = tryParseJsonCandidate(candidate);

        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      } catch {
        // Keep looking for another balanced object.
      }
    }

    const firstBrace = cleanedText.indexOf('{');
    const lastBrace = cleanedText.lastIndexOf('}');

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const jsonCandidate = cleanedText.slice(firstBrace, lastBrace + 1);

      try {
        return tryParseJsonCandidate(jsonCandidate);
      } catch (braceError) {
        console.error('[PhotoSense AI] JSON parse failed after extracting braces:', braceError?.message || braceError);
      }
    }

    console.error('[PhotoSense AI] JSON parse failed:', directError?.message || directError);
    console.error('[PhotoSense AI] JSON parse failed preview:', getJsonParsePreview(cleanedText));
    throw new Error('AI 返回内容中未找到可解析的报告 JSON。');
  }
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

function getSafeVerdictTitle(genre = '街头摄影') {
  const titles = {
    街头摄影: '现场感已经出现，观看路径还可优化',
    人像摄影: '人物状态可读，背景仍可收紧',
    风景摄影: '光线有气氛，层次仍可强化',
    建筑摄影: '空间秩序成立，细节仍需整理',
    静物摄影: '物件关系成立，质感还可加强',
    旅行摄影: '地方气息可见，叙事还可聚焦',
  };

  return titles[genre] || '画面基础成立，重心仍可收紧';
}


function getContextualVerdictPatch({ medium = '数码摄影', genre = '街头摄影', skillLevel = '初学者' }) {
  const titleByGenreAndLevel = {
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
  const summaryByLevel = {
    初学者: '画面已经具备可读基础，接下来先处理一个最明确的问题：让主体更快被看见，并减少不必要的干扰。',
    进阶: '画面不是单纯“拍到”了对象，而是已经开始形成观看顺序；下一步要把主体、光线和背景关系组织得更稳定。',
    高级: '画面具备继续筛选的价值，但还需要更严格地判断哪些视觉信息真正服务表达，哪些只是削弱作品力量。',
  };
  const issueByGenre = {
    街头摄影: '人物、背景和现场线索之间的关系还可以更集中，避免关键瞬间被次要信息稀释。',
    人像摄影: '人物状态与背景之间仍有竞争关系，情绪入口可以更干净。',
    风景摄影: '空间层次和光线重心还可以更明确，让视线从前景到远处的路径更自然。',
    建筑摄影: '线条、边缘和结构节奏还需要更严谨，避免空间重心被轻微偏差削弱。',
    静物摄影: '物件间距、阴影形状和背景纯度仍可继续整理，让材质关系更清楚。',
    旅行摄影: '地点信息已经存在，但人的痕迹、地方气质和叙事重点还可以更聚焦。',
  };
  const nextStepByLevel = {
    初学者: '先做一次轻微裁切，再检查最亮处和边缘杂物，让主体位置更明确。',
    进阶: '优先调整主体附近的明暗和背景分离，再判断是否需要收紧构图。',
    高级: '先决定这张照片最值得保留的视觉关系，再删除或压低所有不服务这个关系的元素。',
  };
  const mediumNote = medium === '胶片摄影'
    ? '后期时保留颗粒、色偏和冲扫质感中有助于气氛的部分，不必按数码标准完全校正。'
    : '后期时优先控制高光、白平衡和局部对比，避免用过重滤镜掩盖画面关系。';

  return {
    title: titleByGenreAndLevel[genre]?.[skillLevel] || getSafeVerdictTitle(genre),
    summary: `${summaryByLevel[skillLevel] || summaryByLevel['进阶']}${medium === '胶片摄影' ? ' 胶片质感可以保留为情绪线索。' : ''}`,
    mainIssue: issueByGenre[genre] || '主要视觉关系还可以更集中。',
    nextStep: `${nextStepByLevel[skillLevel] || nextStepByLevel['进阶']}${medium === '胶片摄影' ? ' 同时保留自然颗粒和色彩偏移。' : ''}`,
    tags: medium === '胶片摄影' ? ['观看路径', '胶片质感', '信息取舍'] : ['观看路径', '局部层次', '信息取舍'],
    mediumNote,
  };
}

function adjustScoresForContext(scores = {}, { medium = '数码摄影', genre = '街头摄影', skillLevel = '初学者' }) {
  const levelShift = { 初学者: 4, 进阶: 0, 高级: -7 }[skillLevel] ?? 0;
  const genreShift = {
    街头摄影: { 叙事: 3, 技术完成度: -1 },
    人像摄影: { 光线: 2, 色彩: 2, 叙事: 1 },
    风景摄影: { 光线: 3, 色彩: 1, 构图: 1 },
    建筑摄影: { 构图: 3, 技术完成度: 2, 叙事: -2 },
    静物摄影: { 构图: 2, 色彩: 2, 技术完成度: 1 },
    旅行摄影: { 叙事: 3, 色彩: 1, 构图: 1 },
  }[genre] || {};
  const mediumShift = medium === '胶片摄影' ? { 色彩: 2, 叙事: 1, 技术完成度: -2 } : { 技术完成度: 1, 色彩: 1 };
  const values = scoreNames.map((name) => Number(scores[name])).filter(Number.isFinite);
  const tooFlat = values.length === scoreNames.length && Math.max(...values) - Math.min(...values) <= 5;

  return scoreNames.reduce((result, name) => {
    const base = normalizeScore(scores[name], getFallbackScores(medium, genre, skillLevel)[name]);
    const flatPenalty = tooFlat && (name === '叙事' || name === '光线') ? -4 : 0;
    const raw = base + levelShift + (genreShift[name] || 0) + (mediumShift[name] || 0) + flatPenalty;
    result[name] = Math.max(35, Math.min(96, Math.round(raw)));
    return result;
  }, {});
}

function contextualizeDiagnosticText(text, fallback, { medium = '数码摄影', genre = '街头摄影', skillLevel = '初学者' }, dimension) {
  const cleaned = sanitizeUserFacingText(text, fallback);
  const shouldReplace = containsInternalMetaLanguage(cleaned) || cleaned.length < 18;

  if (shouldReplace) {
    return fallback;
  }

  const levelAction = {
    初学者: '方向：先完成一个最明确的调整，再比较前后差异。',
    进阶: '方向：把主体、背景和明暗关系放在一起判断，而不是只修单个局部。',
    高级: '方向：用作品筛选的标准保留真正服务表达的部分，其余信息要敢于舍弃。',
  }[skillLevel];
  const mediumAction = medium === '胶片摄影' && dimension === '技术完成度'
    ? '方向：保留有助于气氛的颗粒和色偏，只修正明显破坏观看的冲扫问题。'
    : null;

  if (/方向：/.test(cleaned)) {
    return cleaned.replace(/方向：.+$/, mediumAction || levelAction);
  }

  return `${cleaned}${cleaned.endsWith('。') ? '' : '。'}${mediumAction || levelAction}`;
}

function getContextualPostProcessing(fallbackPostProcessing, contextPatch, { medium = '数码摄影', genre = '街头摄影', skillLevel = '初学者' }) {
  const cropByGenre = {
    街头摄影: '基本保留现场关系，只裁掉最分散注意力的边缘亮点。',
    人像摄影: '优先收紧人物头肩或身体周围的背景干扰，让表情和姿态更先被看见。',
    风景摄影: '先检查地平线和前景比例，必要时裁掉削弱空间层次的空白区域。',
    建筑摄影: '先校正垂直线与水平线，再用小幅裁切稳定边缘结构。',
    静物摄影: '围绕主物件和阴影形状裁切，保留足够呼吸感。',
    旅行摄影: '保留能说明地点的线索，裁掉只增加杂乱感的游客、招牌或空白区域。',
  };
  const maskingByLevel = {
    初学者: '只做一处柔和局部提亮或压暗，避免同时修改太多区域。',
    进阶: '用局部调整拉开主体与背景亮度关系，让观看顺序更明确。',
    高级: '仅保留非常克制的局部整理，不要把现场光线修成过度设计感。',
  };
  const toneSuggestion = medium === '胶片摄影'
    ? '保留颗粒、色偏和冲扫质感，只轻微压住过亮区域或脏色块。'
    : '轻微回收高光，整理主体附近的中间调和局部对比。';

  return {
    crop: {
      suggestion: cropByGenre[genre] || fallbackPostProcessing.crop.suggestion,
      reason: fallbackPostProcessing.crop.reason,
      expectedEffect: '画面重点更快出现，同时不牺牲原有场景气氛。',
    },
    tone: {
      suggestion: toneSuggestion,
      reason: contextPatch.mediumNote,
      expectedEffect: medium === '胶片摄影' ? '保留胶片气氛，同时让明暗关系更稳定。' : '画面层次更集中，照片不会显得过度处理。',
    },
    masking: {
      suggestion: maskingByLevel[skillLevel] || fallbackPostProcessing.masking.suggestion,
      reason: fallbackPostProcessing.masking.reason,
      expectedEffect: skillLevel === '高级' ? '维持现场光线性格，同时提高作品筛选时的完成度。' : '让视线更稳定地停留在关键区域。',
    },
  };
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
      title: getSafeVerdictTitle(genre),
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
  const scores = scoreNames.reduce((result, name) => {
    result[name] = normalizeScore(sourceScores[name], fallback.scores[name]);
    return result;
  }, {});

  const sourceSuggestions = Array.isArray(report?.suggestions)
    ? report.suggestions.filter((item) => typeof item === 'string' && item.trim()).slice(0, 3)
    : [];

  while (sourceSuggestions.length < 3) {
    sourceSuggestions.push(fallback.suggestions[sourceSuggestions.length]);
  }

  const sourceRecipe = report?.recipe || {};

  const contextPatch = getContextualVerdictPatch({ medium, genre, skillLevel });
  const normalizedPostProcessing = normalizePostProcessing(report?.postProcessing, fallback.postProcessing);
  const calibratedPostProcessing = getContextualPostProcessing(normalizedPostProcessing, contextPatch, { medium, genre, skillLevel });
  const calibratedScores = adjustScoresForContext(scores, { medium, genre, skillLevel });

  return {
    overall: sanitizeUserFacingText(report?.overall, fallback.overall),
    scores: calibratedScores,
    composition: contextualizeDiagnosticText(report?.composition, fallback.composition, { medium, genre, skillLevel }, '构图'),
    lighting: contextualizeDiagnosticText(report?.lighting, fallback.lighting, { medium, genre, skillLevel }, '光线'),
    colour: contextualizeDiagnosticText(report?.colour, fallback.colour, { medium, genre, skillLevel }, '色彩'),
    storytelling: contextualizeDiagnosticText(report?.storytelling, fallback.storytelling, { medium, genre, skillLevel }, '叙事'),
    technical: contextualizeDiagnosticText(report?.technical, fallback.technical, { medium, genre, skillLevel }, '技术完成度'),
    suggestions: sourceSuggestions.map((item, index) => sanitizeUserFacingText(item, fallback.suggestions[index])),
    recipe: {
      exposure: normalizeText(sourceRecipe.exposure, fallback.recipe.exposure),
      contrast: normalizeText(sourceRecipe.contrast, fallback.recipe.contrast),
      highlights: normalizeText(sourceRecipe.highlights, fallback.recipe.highlights),
      shadows: normalizeText(sourceRecipe.shadows, fallback.recipe.shadows),
      temperature: normalizeText(sourceRecipe.temperature, fallback.recipe.temperature),
      cropRatio: normalizeText(sourceRecipe.cropRatio, fallback.recipe.cropRatio),
    },
    verdict: normalizeVerdict(report?.verdict, { ...fallback.verdict, ...contextPatch }),
    reviewContext: normalizeReviewContext(report?.reviewContext, fallback.reviewContext),
    postProcessing: calibratedPostProcessing,
    nextShooting: normalizeNextShooting(report?.nextShooting, {
      summary: `${fallback.nextShooting.summary}${skillLevel === '高级' ? ' 同时请用更严格的作品筛选意识检查这张照片是否有独立表达。' : ''}`,
      items: fallback.nextShooting.items,
    }),
  };
}

function createReportPrompt({ medium = '数码摄影', genre = '街头摄影', skillLevel = '初学者', fileName = '', workTitle = '', title = '' }) {
  const selectedReviewContext = getReviewContext(medium, genre, skillLevel);

  return `你是 PhotoSense AI 的中文摄影导师。请快速阅读照片，输出紧凑 JSON。不要 Markdown，不要解释 JSON 外内容。

用户选择：
- 文件名：${fileName || '未命名照片'}
- 作品标题：${workTitle || title || '未填写'}
- 影像介质：${medium}
- 摄影题材：${genre}
- 点评口径：${skillLevel}

本次评价焦点：
- 介质：${selectedReviewContext.mediumFocus}
- 水平：${selectedReviewContext.levelFocus}
- 题材：${selectedReviewContext.genreFocus}
- 评分：${selectedReviewContext.scoringLogic}

核心要求：
1. 只基于照片可见内容写，不编造相机参数、地点、人物身份。
2. 同一张照片在不同“影像介质 / 摄影题材 / 点评口径”下必须有不同侧重点。
3. ${medium === '胶片摄影' ? '胶片摄影要尊重颗粒、色偏、冲扫质感，不要按数码标准强行校正。' : '数码摄影重点看曝光、高光、白平衡、清晰度、噪点和后期空间。'}
4. ${skillLevel === '初学者' ? '初学者：语言更易懂、更鼓励，重点给一个清楚下一步。' : skillLevel === '高级' ? '高级：用作品集/编辑筛选标准，更严格看作者意图、视觉语言和取舍。' : '进阶：正常摄影点评术语，解释构图、光线、色彩、主体分离和观看顺序。'}
5. ${genre} 要按该题材判断，不要写成通用摄影点评。
6. 用户可见字段不得出现：本次评分、评分侧重、评价基准、点评口径、按初学者口径、按进阶口径、按高级口径、用户选择、AI、模型、建议优化后入选。
7. 文本短而具体。每个诊断字段只写“结论：...。说明：...。方向：...。”三段。
8. 分数为 0-100 整数，拉开差异，不要全部挤在 75-80。

题材速查：街头看瞬间/人物姿态/环境关系；人像看表情眼神/肤色/背景分离；风景看光线时机/空间层次/地方感；建筑看透视/线条/结构节奏；静物看物件关系/材质/阴影；旅行看地方感/人的痕迹/叙事。

输出格式硬性要求：
- 只返回一个合法 JSON 对象，不能有 Markdown、不能有 ```json、不能有 JSON 外说明。
- 所有 key 必须使用英文双引号。
- 所有字符串必须是单行中文字符串，不能包含真实换行符。
- 不要输出注释、列表符号、解释段落或第二个 JSON。
- 字段必须齐全；如果不确定，也要根据照片可见内容给出保守判断。
- 控制文本长度，避免超过输出上限。

必须返回这个 JSON 结构，字段齐全，所有字符串用中文：
{
  "overall": "总体印象，1句",
  "verdict": {"title": "8-22个汉字", "summary": "1句整体结论", "mainIssue": "主要问题", "nextStep": "最重要的下一步", "tags": ["标签1", "标签2", "标签3"]},
  "reviewContext": {"mediumFocus": "介质如何影响评价", "levelFocus": "水平如何影响评价", "genreFocus": "题材判断标准", "scoringLogic": "评分最重视什么"},
  "scores": {"构图": 78, "光线": 76, "色彩": 80, "叙事": 75, "技术完成度": 82},
  "composition": "结论：...。说明：...。方向：...。",
  "lighting": "结论：...。说明：...。方向：...。",
  "colour": "结论：...。说明：...。方向：...。",
  "storytelling": "结论：...。说明：...。方向：...。",
  "technical": "结论：...。说明：...。方向：...。",
  "suggestions": ["可执行建议1", "可执行建议2", "可执行建议3"],
  "postProcessing": {"crop": {"suggestion": "裁剪建议", "reason": "原因", "expectedEffect": "效果"}, "tone": {"suggestion": "影调建议", "reason": "原因", "expectedEffect": "效果"}, "masking": {"suggestion": "局部处理建议", "reason": "原因", "expectedEffect": "效果"}},
  "nextShooting": {"summary": "下次拍摄总建议", "items": ["行动1", "行动2", "行动3"]},
  "recipe": {"exposure": "+0.20", "contrast": "+12", "highlights": "-18", "shadows": "+10", "temperature": "+2 偏暖", "cropRatio": "3:2 编辑裁切"}
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
            { type: 'image_url', image_url: { url: imageDataUrl, detail: 'low' } },
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
            { type: 'image_url', image_url: { url: imageDataUrl, detail: 'low' } },
          ],
        },
      ],
      temperature: OPENAI_RELAY_TEMPERATURE,
      max_tokens: OPENAI_RELAY_MAX_TOKENS,
      response_format: { type: 'json_object' },
    }),
  }, OPENAI_RELAY_TIMEOUT_MS);

  console.log('[PhotoSense AI] OpenAI relay response status:', relayResponse.status);

  const responseText = await relayResponse.text();
  const contentType = relayResponse.headers.get('content-type') || '';
  console.log('[PhotoSense AI] OpenAI relay response content-type:', contentType);

  if (!relayResponse.ok) {
    console.error('[PhotoSense AI] OpenAI relay error body preview if not ok:', responseText.slice(0, 1200));
    const error = new Error('OpenAI-compatible relay API 请求失败。');
    error.statusCode = relayResponse.status;
    throw error;
  }

  console.log('[PhotoSense AI] OpenAI relay response received');

  let relayDataForDebug = null;
  try {
    relayDataForDebug = JSON.parse(responseText);
    const finishReason = relayDataForDebug?.choices?.[0]?.finish_reason || relayDataForDebug?.finish_reason || relayDataForDebug?.data?.choices?.[0]?.finish_reason;
    if (finishReason) {
      console.log('[PhotoSense AI] OpenAI relay finish_reason:', finishReason);
    }
    if (relayDataForDebug?.usage) {
      console.log('[PhotoSense AI] OpenAI relay usage:', JSON.stringify(relayDataForDebug.usage));
    }
  } catch {
    console.warn('[PhotoSense AI] OpenAI relay response is not directly parseable JSON; trying text extraction.');
  }

  const outputText = parseOpenAiRelayResponseText(responseText);
  console.log('[PhotoSense AI] OpenAI relay raw response length:', responseText.length);
  console.log('[PhotoSense AI] OpenAI relay extracted output length:', outputText.length);

  if (!outputText) {
    await saveAiDebugSnapshot({ responseText, outputText, label: 'openai-relay-empty-output' });
    throw new Error('OpenAI-compatible relay API 没有返回可解析的报告文本。');
  }

  console.log('[PhotoSense AI] JSON parse starts');

  try {
    const parsedReport = extractJsonFromText(outputText);
    return normalizeReport(parsedReport, { genre, skillLevel, medium });
  } catch (error) {
    await saveAiDebugSnapshot({ responseText, outputText, error, label: 'openai-relay-json-parse-failed' });
    throw error;
  }
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
      max_tokens: 1800,
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

  if (!OPENAI_RELAY_BASE_URL) {
    const error = new Error('未配置 OPENAI_RELAY_BASE_URL。请在 .env 中填写你的中转 API Base URL，例如 https://你的中转API地址/v1。');
    error.statusCode = 503;
    throw error;
  }

  return createOpenAiRelayReport(context);
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

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    setCorsHeaders(response);
    response.writeHead(204);
    response.end();
    return;
  }

  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'GET' && requestUrl.pathname === '/api/health') {
    sendJson(response, 200, {
      ok: true,
      app: 'PhotoSense AI',
      status: 'healthy',
    });
    return;
  }

  if ((request.method === 'GET' || request.method === 'HEAD') && !requestUrl.pathname.startsWith('/api/')) {
    await serveFrontend(requestUrl, response);
    return;
  }

  if (request.method !== 'POST') {
    sendJson(response, 404, { error: 'Not found' });
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
  console.log(`PhotoSense AI running on port ${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/analyze-photo`);
});
