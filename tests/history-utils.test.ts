import assert from 'node:assert/strict';
import test from 'node:test';
import type { HistoryRecord, Report } from '../src/types/report';
import { countRecordsInCurrentMonth, filterAndSortHistoryRecords } from '../src/utils/history';

const report = { scores: { 构图: 70, 光线: 70, 色彩: 70, 叙事: 70, 技术完成度: 70 } } as Report;

function record(id: string, medium: HistoryRecord['medium'], genre: HistoryRecord['genre'], createdAt: string, score: number): HistoryRecord {
  return {
    id,
    title: `${medium}${genre}`,
    imageUrl: 'data:image/jpeg;base64,test',
    fileName: `${id}.jpg`,
    medium,
    subject: genre,
    genre,
    critiqueLevel: '进阶',
    skillLevel: '进阶',
    date: createdAt.slice(0, 10),
    dateTime: createdAt,
    createdAt,
    report,
    reportSource: 'ai',
    overallScore: score,
    tags: [genre],
    summary: '',
    strongestDimension: '构图',
    weakestDimension: '叙事',
  };
}

const records = [
  record('1', '数码摄影', '街头摄影', '2026-07-10T12:00:00.000Z', 72),
  record('2', '胶片摄影', '街头摄影', '2026-07-11T12:00:00.000Z', 83),
  record('3', '胶片摄影', '人像摄影', '2026-06-11T12:00:00.000Z', 65),
];

test('介质与题材可以组合筛选', () => {
  const result = filterAndSortHistoryRecords(records, {
    medium: '胶片摄影',
    genre: '街头摄影',
    startDate: '',
    endDate: '',
    query: '',
    sort: '最新上传',
  });

  assert.deepEqual(result.map((item) => item.id), ['2']);
});

test('本月统计只计算当前自然月', () => {
  assert.equal(countRecordsInCurrentMonth(records, new Date('2026-07-14T12:00:00.000Z')), 2);
});

test('评分排序与搜索可以叠加', () => {
  const result = filterAndSortHistoryRecords(records, {
    medium: '全部',
    genre: '全部',
    startDate: '',
    endDate: '',
    query: '街头',
    sort: '评分最高',
  });

  assert.deepEqual(result.map((item) => item.id), ['2', '1']);
});
