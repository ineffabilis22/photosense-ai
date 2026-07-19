import assert from 'node:assert/strict';
import test from 'node:test';
import type { HistoryRecord, Report } from '../src/types/report';
import { compareHistoryRecords } from '../src/utils/comparison';

function createRecord(id: string, createdAt: string, overallScore: number, scores: Report['scores']): HistoryRecord {
  return {
    id,
    title: id,
    imageUrl: '',
    fileName: `${id}.jpg`,
    medium: '数码摄影',
    subject: '街头摄影',
    genre: '街头摄影',
    critiqueLevel: '进阶',
    skillLevel: '进阶',
    date: createdAt.slice(0, 10),
    dateTime: createdAt,
    createdAt,
    reportSource: 'ai',
    overallScore,
    tags: [],
    summary: `${id} summary`,
    strongestDimension: '色彩',
    weakestDimension: '叙事',
    report: {
      overall: `${id} overall`,
      scores,
      composition: '构图',
      lighting: '光线',
      colour: '色彩',
      storytelling: '叙事',
      technical: '技术',
      suggestions: ['继续练习'],
      recipe: { exposure: '0', contrast: '0', highlights: '0', shadows: '0', temperature: '0', cropRatio: '3:2' },
      verdict: { title: id, summary: id, mainIssue: `${id} issue`, nextStep: `${id} action`, tags: [] },
    },
  };
}

test('报告对比按时间识别前后作品并计算变化', () => {
  const older = createRecord('older', '2026-01-01T10:00:00Z', 65, { 构图: 60, 光线: 62, 色彩: 75, 叙事: 55, 技术完成度: 73 });
  const newer = createRecord('newer', '2026-02-01T10:00:00Z', 72, { 构图: 72, 光线: 68, 色彩: 78, 叙事: 61, 技术完成度: 81 });
  const comparison = compareHistoryRecords(newer, older);

  assert.equal(comparison.older.id, 'older');
  assert.equal(comparison.newer.id, 'newer');
  assert.equal(comparison.totalDelta, 7);
  assert.equal(comparison.mostImproved.name, '构图');
  assert.equal(comparison.mostImproved.delta, 12);
  assert.equal(comparison.practicePriority.name, '叙事');
  assert.equal(comparison.practiceAction, 'newer action');
});

test('没有提升项时指出下降幅度最大的维度', () => {
  const older = createRecord('older', '2026-01-01T10:00:00Z', 75, { 构图: 80, 光线: 75, 色彩: 78, 叙事: 70, 技术完成度: 72 });
  const newer = createRecord('newer', '2026-02-01T10:00:00Z', 68, { 构图: 79, 光线: 65, 色彩: 76, 叙事: 68, 技术完成度: 70 });
  const comparison = compareHistoryRecords(older, newer);

  assert.equal(comparison.hasImprovement, false);
  assert.equal(comparison.mostImproved.name, '光线');
  assert.equal(comparison.mostImproved.delta, -10);
});
