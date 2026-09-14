import assert from 'node:assert/strict';
import test from 'node:test';
import { getPortraitReportSize, normalizeReportArtworkContent, shouldIncludeReportSection } from '../src/utils/report-export';

test('keeps an already portrait report at its captured dimensions', () => {
  assert.deepEqual(getPortraitReportSize(1080, 1920), { width: 1080, height: 1920 });
});

test('adds blank page height without resizing the captured width', () => {
  assert.deepEqual(getPortraitReportSize(1080, 900), { width: 1080, height: 1440 });
});

test('returns an empty size for invalid canvas dimensions', () => {
  assert.deepEqual(getPortraitReportSize(0, 1000), { width: 0, height: 0 });
  assert.deepEqual(getPortraitReportSize(1080, Number.NaN), { width: 0, height: 0 });
});

test('simple export keeps only the report overview and optimization advice sections', () => {
  assert.equal(shouldIncludeReportSection('simple', 'report-overview'), true);
  assert.equal(shouldIncludeReportSection('simple', 'report-post-processing'), true);
  assert.equal(shouldIncludeReportSection('simple', 'report-dimensions'), false);
  assert.equal(shouldIncludeReportSection('simple', 'report-context'), false);
});

test('detailed export keeps every report section', () => {
  assert.equal(shouldIncludeReportSection('detailed', 'report-overview'), true);
  assert.equal(shouldIncludeReportSection('detailed', 'report-dimensions'), true);
  assert.equal(shouldIncludeReportSection('detailed', 'report-post-processing'), true);
  assert.equal(shouldIncludeReportSection('detailed', 'report-context'), true);
});

test('normalizes the visible report text before sending it to the artwork API', () => {
  assert.equal(
    normalizeReportArtworkContent('  01  评审结论\r\n\r\n  夜色中的流动光线  \n\t03 优化建议 '),
    '01 评审结论\n夜色中的流动光线\n03 优化建议',
  );
});
