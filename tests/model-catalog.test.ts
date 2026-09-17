import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getImageModelCandidates,
  getReportModelCandidates,
  isImageModelId,
  isReportModelId,
} from '../server/model-catalog.mjs';

test('后端模型目录只接受固定模型 ID', () => {
  assert.equal(isReportModelId('claude'), true);
  assert.equal(isReportModelId('arbitrary-model'), false);
  assert.equal(isImageModelId('nano-banana'), true);
  assert.equal(isImageModelId('grok-image'), true);
  assert.equal(isImageModelId('arbitrary-image-model'), false);
});

test('自动模式优先使用 GPT 报告和 GPT Image', () => {
  assert.deepEqual(
    getReportModelCandidates('auto').map((item) => item.id),
    ['gpt', 'claude', 'deepseek', 'gemini'],
  );
  assert.deepEqual(
    getImageModelCandidates('auto').map((item) => item.id),
    ['gpt-image', 'nano-banana', 'grok-image'],
  );
});

test('旧环境变量仍可覆盖首选模型配置', () => {
  assert.equal(
    getReportModelCandidates('auto', { OPENAI_RELAY_MODEL: 'legacy-gpt-model' })[0].model,
    'legacy-gpt-model',
  );
  assert.equal(
    getImageModelCandidates('auto', { IMAGE_RELAY_MODEL: 'legacy-image-model' })[0].model,
    'legacy-image-model',
  );
});
