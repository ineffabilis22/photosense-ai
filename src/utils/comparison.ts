import type { HistoryRecord, ScoreName } from '../types/report';

const scoreNames: ScoreName[] = ['构图', '光线', '色彩', '叙事', '技术完成度'];

function getTimestamp(record: HistoryRecord) {
  const timestamp = new Date(record.createdAt || record.date).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getPriorityIssue(record: HistoryRecord) {
  return record.report.photoSpecific?.priorityIssue
    || record.report.verdict?.mainIssue
    || record.summary
    || '这条记录没有保存主要问题。';
}

function getPracticeAction(record: HistoryRecord) {
  return record.report.photoSpecific?.nextAction
    || record.report.verdict?.nextStep
    || record.report.suggestions[0]
    || '继续围绕当前最低分维度进行拍摄练习。';
}

export function compareHistoryRecords(first: HistoryRecord, second: HistoryRecord) {
  const [older, newer] = getTimestamp(first) <= getTimestamp(second) ? [first, second] : [second, first];
  const dimensions = scoreNames.map((name) => ({
    name,
    olderScore: older.report.scores[name],
    newerScore: newer.report.scores[name],
    delta: newer.report.scores[name] - older.report.scores[name],
  }));
  const improvements = dimensions.filter((item) => item.delta > 0);
  const mostImproved = improvements.length
    ? improvements.reduce((best, item) => (item.delta > best.delta ? item : best), improvements[0])
    : dimensions.reduce((largest, item) => (Math.abs(item.delta) > Math.abs(largest.delta) ? item : largest), dimensions[0]);
  const practicePriority = dimensions.reduce((lowest, item) => (item.newerScore < lowest.newerScore ? item : lowest), dimensions[0]);

  return {
    older,
    newer,
    totalDelta: newer.overallScore - older.overallScore,
    dimensions,
    mostImproved,
    hasImprovement: improvements.length > 0,
    practicePriority,
    olderIssue: getPriorityIssue(older),
    newerIssue: getPriorityIssue(newer),
    practiceAction: getPracticeAction(newer),
  };
}
