import assert from 'node:assert/strict';
import test from 'node:test';
import { getPortraitReportSize } from '../src/utils/report-export';

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
