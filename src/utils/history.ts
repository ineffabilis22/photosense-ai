import type { Genre, HistoryRecord, Medium } from '../types/report';

export type HistorySort = '最新上传' | '评分最高' | '评分最低';

export type HistoryFilters = {
  medium: Medium | '全部';
  genre: Genre | '全部';
  startDate: string;
  endDate: string;
  query: string;
  sort: HistorySort;
};

function getRecordTimestamp(record: HistoryRecord) {
  const timestamp = new Date(record.createdAt || record.date).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function countRecordsInCurrentMonth(records: HistoryRecord[], now = new Date()) {
  return records.filter((record) => {
    const date = new Date(record.createdAt || record.date);
    return !Number.isNaN(date.getTime()) && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }).length;
}

export function filterAndSortHistoryRecords(records: HistoryRecord[], filters: HistoryFilters) {
  const keyword = filters.query.trim().toLowerCase();

  return records
    .filter((record) => filters.medium === '全部' || record.medium === filters.medium)
    .filter((record) => filters.genre === '全部' || (record.subject ?? record.genre) === filters.genre || record.genre === filters.genre)
    .filter((record) => {
      const recordDay = record.createdAt ? record.createdAt.slice(0, 10) : '';
      return (!filters.startDate || recordDay >= filters.startDate) && (!filters.endDate || recordDay <= filters.endDate);
    })
    .filter((record) => {
      if (!keyword) return true;
      return [record.title, record.fileName, record.medium, record.subject, record.critiqueLevel, ...record.tags]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    })
    .sort((first, second) => {
      if (filters.sort === '评分最高') return second.overallScore - first.overallScore;
      if (filters.sort === '评分最低') return first.overallScore - second.overallScore;
      return getRecordTimestamp(second) - getRecordTimestamp(first);
    });
}
