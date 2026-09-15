import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeReportArtworkContent } from '../src/utils/report-export';

test('normalizes the visible report text before sending it to the artwork API', () => {
  assert.equal(
    normalizeReportArtworkContent('  01  评审结论\r\n\r\n  夜色中的流动光线  \n\t03 优化建议 '),
    '01 评审结论\n夜色中的流动光线\n03 优化建议',
  );
});
