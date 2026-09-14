import { hasConfiguredImageProvider, readBoundedNumber } from './config.mjs';
import sharp from 'sharp';

const MAX_DECODED_IMAGE_BYTES = 12 * 1024 * 1024;
const allowedKinds = new Set(['crop', 'tone', 'local-adjustment', 'cleanup', 'reframe', 'motion-effect', 'perspective', 'other']);

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function normalizeImageRelayBaseUrl(value) {
  const normalized = String(value || '').trim().replace(/\/+$/, '');
  if (!normalized) return '';
  return /\/v\d+(?:beta)?$/i.test(normalized) ? normalized : `${normalized}/v1`;
}

function parseImageDataUrl(imageDataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(imageDataUrl || '');
  if (!match) throw createHttpError('图片格式不受支持，请使用 JPG、PNG 或 WebP。', 400);

  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) throw createHttpError('图片内容为空。', 400);
  if (buffer.length > MAX_DECODED_IMAGE_BYTES) throw createHttpError('图片过大，请上传较小的图片。', 413);

  return { buffer, mimeType: match[1] };
}

function normalizeText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeOptimizationPlan(value) {
  const items = Array.isArray(value?.items)
    ? value.items
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        kind: allowedKinds.has(item.kind) ? item.kind : 'other',
        instruction: normalizeText(item.instruction, 240),
        target: normalizeText(item.target, 120),
        reason: normalizeText(item.reason, 240),
        expectedEffect: normalizeText(item.expectedEffect, 240),
      }))
      .filter((item) => item.instruction && item.reason)
      .slice(0, 5)
    : [];

  if (!items.length) throw createHttpError('缺少可执行的优化建议。', 400);

  return {
    summary: normalizeText(value?.summary, 360),
    imagePrompt: normalizeText(value?.imagePrompt, 1200),
    items,
  };
}

function normalizeNextShooting(value) {
  return {
    summary: normalizeText(value?.summary, 360),
    items: Array.isArray(value?.items)
      ? value.items.map((item) => normalizeText(item, 240)).filter(Boolean).slice(0, 3)
      : [],
  };
}

function createImageEditPrompt(plan, medium, nextShooting) {
  const instructions = plan.items.map((item, index) => (
    `${index + 1}. ${item.instruction}${item.target ? `；目标区域：${item.target}` : ''}；目标效果：${item.expectedEffect || item.reason}`
  )).join('\n');
  const [primaryNextShot, ...secondaryNextShots] = nextShooting.items;
  const nextShotBlock = primaryNextShot
    ? `首要目标：生成摄影者在同一现场按建议再拍一次后的更优拍摄结果。拍摄动作的优先级高于普通影调优化。\n必须执行的主要动作：${primaryNextShot}\n${secondaryNextShots.length ? `可选的辅助动作：\n${secondaryNextShots.map((item, index) => `${index + 1}. ${item}`).join('\n')}\n` : ''}${nextShooting.summary ? `整体方向：${nextShooting.summary}\n` : ''}\n必须把主要动作落实为一眼可辨认的空间、构图或拍摄瞬间变化；不得只调整曝光、对比度、明暗或色彩。通过局部重绘、重新取景或局部位置调整落实。可见变化可以是主体位置或姿态、取景范围、遮挡关系、拍摄角度、透视关系、背景干扰或运动瞬间之一。若建议文字没有点明对象，以原图中最明确的可见主体为对象；“等待动作更完整”要把该主体重绘为紧邻且可信的更完整动作瞬间，“避开干扰或遮挡”要通过相邻机位、主体位置或重新取景改变重叠关系，“提高或降低机位”要让地平线、前后景重叠或透视关系出现可见变化。只有主要动作确实无法从原图可靠推断时，才改为执行第一条可实现的辅助动作。输出前自检：如果修改前后并排时只能看出影调差别，说明结果不合格，必须继续完成主要动作的可见变化。\n`
    : '';

  return `请编辑所提供的摄影作品，不要添加图上批注、文字、边框或箭头。\n${nextShotBlock}${primaryNextShot ? '在完成上述清楚可见的再拍变化后，再执行以下与它不冲突的画面优化：' : '请执行以下画面优化：'}\n${instructions}\n${plan.imagePrompt ? `补充要求：${plan.imagePrompt}\n` : ''}保持原照片中的人物身份、面部特征、主体内容、地点、天气、时段、真实光线逻辑、摄影风格和${medium === '胶片摄影' ? '胶片颗粒与色偏特征' : '自然成像质感'}，但这些保留要求不能抵消建议明确要求的主体移动、姿态变化、重新取景、遮挡清理或透视调整。不得创造原图无法支持的新人物、新物体、新事件或新故事。严格保持仍出现在画面中的招牌、文字、数字、车牌与标志的内容和拼写，不得重写或生成相似文字；建议要求重新取景或移除干扰时，可以让边缘文字或标志自然离开画面。未被建议涉及的区域尽量保持不变。输出一张自然、可信、没有批注、像是在同一现场按建议重新拍摄后得到的照片。`;
}

async function createStructureSignature(buffer) {
  const { data, info } = await sharp(buffer)
    .rotate()
    .resize(64, 64, { fit: 'fill' })
    .grayscale()
    .normalise()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const signature = [];

  for (let y = 1; y < info.height; y += 1) {
    for (let x = 1; x < info.width; x += 1) {
      const index = y * info.width + x;
      signature.push(
        Math.abs(data[index] - data[index - 1])
        + Math.abs(data[index] - data[index - info.width]),
      );
    }
  }

  return signature;
}

export async function hasVisibleStructuralChange(sourceBuffer, optimizedBuffer) {
  try {
    const [sourceMetadata, optimizedMetadata] = await Promise.all([
      sharp(sourceBuffer).metadata(),
      sharp(optimizedBuffer).metadata(),
    ]);
    if (
      Math.min(sourceMetadata.width || 0, sourceMetadata.height || 0) < 16
      || Math.min(optimizedMetadata.width || 0, optimizedMetadata.height || 0) < 16
    ) {
      return true;
    }

    const [sourceSignature, optimizedSignature] = await Promise.all([
      createStructureSignature(sourceBuffer),
      createStructureSignature(optimizedBuffer),
    ]);
    const difference = sourceSignature.reduce((total, value, index) => (
      total + Math.abs(value - optimizedSignature[index])
    ), 0) / sourceSignature.length;

    return difference >= 6;
  } catch {
    return true;
  }
}

function createImageForm({ buffer, mimeType, extension, model, prompt }) {
  const form = new FormData();
  form.append('model', model);
  form.append('image[]', new Blob([buffer], { type: mimeType }), `photosense-source.${extension}`);
  form.append('prompt', prompt);
  return form;
}

async function requestOptimizedImage({ endpoint, apiKey, model, buffer, mimeType, extension, prompt, timeoutMs }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let providerResponse;

  try {
    providerResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: createImageForm({ buffer, mimeType, extension, model, prompt }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw createHttpError('优化图片生成超时，请稍后重试。', 504);
    throw createHttpError('暂时无法连接优化图片服务。', 502);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!providerResponse.ok) {
    console.error('[PhotoSense AI] image relay response status:', providerResponse.status);
    throw createHttpError('优化图片暂时无法生成，请稍后重试。', providerResponse.status >= 500 ? 502 : providerResponse.status);
  }

  let data;
  try {
    data = await providerResponse.json();
  } catch {
    throw createHttpError('优化图片服务返回了无法读取的结果。', 502);
  }

  const firstImage = data?.data?.[0];
  if (typeof firstImage?.b64_json === 'string' && firstImage.b64_json) {
    return {
      imageUrl: `data:image/png;base64,${firstImage.b64_json}`,
      imageBuffer: Buffer.from(firstImage.b64_json, 'base64'),
    };
  }
  if (typeof firstImage?.url === 'string' && /^https?:\/\//.test(firstImage.url)) {
    return { imageUrl: firstImage.url, imageBuffer: null };
  }

  throw createHttpError('优化图片服务没有返回图片。', 502);
}

export async function generateOptimizedImage({ imageDataUrl, medium = '数码摄影', optimizationPlan, nextShooting }, env = process.env) {
  if (!hasConfiguredImageProvider(env)) {
    throw createHttpError('优化图片服务暂未配置。', 503);
  }

  const baseUrl = normalizeImageRelayBaseUrl(env.IMAGE_RELAY_BASE_URL);
  let endpoint;
  try {
    endpoint = new URL(`${baseUrl}/images/edits`);
  } catch {
    throw createHttpError('优化图片服务地址配置不正确。', 503);
  }
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw createHttpError('优化图片服务地址配置不正确。', 503);
  }

  const { buffer, mimeType } = parseImageDataUrl(imageDataUrl);
  const plan = normalizeOptimizationPlan(optimizationPlan);
  const nextShot = normalizeNextShooting(nextShooting);
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1];
  const model = String(env.IMAGE_RELAY_MODEL).trim();
  const prompt = createImageEditPrompt(plan, medium, nextShot);
  const timeoutMs = readBoundedNumber(env, 'IMAGE_RELAY_TIMEOUT_MS', 120_000, { min: 10_000, max: 300_000, integer: true });
  const requestOptions = {
    endpoint,
    apiKey: env.IMAGE_RELAY_API_KEY,
    model,
    buffer,
    mimeType,
    extension,
    timeoutMs,
  };
  let result = await requestOptimizedImage({ ...requestOptions, prompt });

  if (nextShot.items.length && result.imageBuffer && !(await hasVisibleStructuralChange(buffer, result.imageBuffer))) {
    console.warn('[PhotoSense AI] optimized image lacked visible structural change; retrying once.');
    result = await requestOptimizedImage({
      ...requestOptions,
      prompt: `${prompt}\n上一次结果只有整体影调变化，未通过前后图检查。本次必须优先重绘或重新取景来完成主要动作，并让差异一眼可见。`,
    });
    if (result.imageBuffer && !(await hasVisibleStructuralChange(buffer, result.imageBuffer))) {
      throw createHttpError('这次没有形成清楚的画面变化，请重新生成。', 502);
    }
  }

  return { imageUrl: result.imageUrl, provider: 'image-relay' };
}
