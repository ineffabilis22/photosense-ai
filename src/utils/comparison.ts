import type { HistoryRecord, ScoreName } from '../types/report';

const scoreNames: ScoreName[] = ['构图', '光线', '色彩', '叙事', '技术完成度'];

function getTimestamp(record: HistoryRecord) {
  const timestamp = new Date(record.createdAt || record.date).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getScoreVersion(record: HistoryRecord) {
  return record.scoreVersion || record.report.scoreVersion || 'v2';
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
  const olderScoreVersion = getScoreVersion(older);
  const newerScoreVersion = getScoreVersion(newer);
  const isComparable = olderScoreVersion === newerScoreVersion;
  const scoredDimensions = scoreNames.map((name) => ({
    name,
    olderScore: older.report.scores[name],
    newerScore: newer.report.scores[name],
    delta: newer.report.scores[name] - older.report.scores[name],
  }));
  const dimensions = scoredDimensions.map((item) => ({
    ...item,
    delta: isComparable ? item.delta : null,
  }));
  const improvements = isComparable ? scoredDimensions.filter((item) => item.delta > 0) : [];
  const mostImproved = !isComparable
    ? null
    : improvements.length
      ? improvements.reduce((best, item) => (item.delta > best.delta ? item : best), improvements[0])
      : scoredDimensions.reduce((largest, item) => (Math.abs(item.delta) > Math.abs(largest.delta) ? item : largest), scoredDimensions[0]);
  const practicePriority = scoredDimensions.reduce((lowest, item) => (item.newerScore < lowest.newerScore ? item : lowest), scoredDimensions[0]);

  return {
    older,
    newer,
    isComparable,
    comparisonReason: isComparable ? '' : `评分标准不同（${olderScoreVersion} / ${newerScoreVersion}），仅并列展示，不计算分数变化。`,
    totalDelta: isComparable ? newer.overallScore - older.overallScore : null,
    dimensions,
    mostImproved,
    hasImprovement: isComparable && improvements.length > 0,
    practicePriority,
    olderIssue: getPriorityIssue(older),
    newerIssue: getPriorityIssue(newer),
    practiceAction: getPracticeAction(newer),
  };
}
