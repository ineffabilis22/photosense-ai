import assert from 'node:assert/strict';
import test from 'node:test';
import { hasConfiguredProvider, isHistoryExportEnabled, readBoundedNumber } from '../server/config.mjs';

test('数值环境变量支持默认值、边界和整数化', () => {
  assert.equal(readBoundedNumber({}, 'TIMEOUT', 60_000, { min: 5_000, max: 180_000, integer: true }), 60_000);
  assert.equal(readBoundedNumber({ TIMEOUT: '1000' }, 'TIMEOUT', 60_000, { min: 5_000, max: 180_000, integer: true }), 5_000);
  assert.equal(readBoundedNumber({ TEMPERATURE: '0.333' }, 'TEMPERATURE', 0.45, { min: 0, max: 1 }), 0.333);
});

test('生产环境默认禁用历史文件写入', () => {
  assert.equal(isHistoryExportEnabled({ NODE_ENV: 'production' }), false);
  assert.equal(isHistoryExportEnabled({ NODE_ENV: 'production', ENABLE_HISTORY_EXPORT: 'true' }), true);
  assert.equal(isHistoryExportEnabled({ NODE_ENV: 'development' }), true);
});

test('健康检查只暴露 provider 是否已配置', () => {
  assert.equal(hasConfiguredProvider({}), false);
  assert.equal(hasConfiguredProvider({ OPENAI_RELAY_BASE_URL: 'https://example.com/v1', OPENAI_RELAY_API_KEY: 'secret' }), true);
});
