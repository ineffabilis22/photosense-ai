import assert from 'node:assert/strict';
import test from 'node:test';
import { getAnalysisPhaseStatus, getAnalysisWaitMessage } from '../src/utils/analysis';

test('分析阶段正确区分已完成、当前和等待', () => {
  assert.equal(getAnalysisPhaseStatus('analyzing', 'preparing'), 'complete');
  assert.equal(getAnalysisPhaseStatus('analyzing', 'analyzing'), 'active');
  assert.equal(getAnalysisPhaseStatus('analyzing', 'formatting'), 'pending');
});

test('等待较久时给出冷启动解释', () => {
  assert.equal(getAnalysisWaitMessage(3), '已等待 3 秒。');
  assert.match(getAnalysisWaitMessage(12), /冷启动/);
});

