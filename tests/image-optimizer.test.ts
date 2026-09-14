import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { hasVisibleStructuralChange } from '../server/image-optimizer.mjs';

async function createTestImage(squareLeft: number, toneScale = 1) {
  const square = Buffer.from(`<svg width="64" height="64"><rect width="64" height="64" fill="#303030"/><rect x="${squareLeft}" y="20" width="18" height="24" fill="#e8e8e8"/></svg>`);
  return sharp(square).linear(toneScale, toneScale === 1 ? 0 : 8).png().toBuffer();
}

test('结构变化检查忽略整体影调，但识别主体位置变化', async () => {
  const source = await createTestImage(8);
  const toneOnly = await createTestImage(8, 0.82);
  const movedSubject = await createTestImage(36);

  assert.equal(await hasVisibleStructuralChange(source, toneOnly), false);
  assert.equal(await hasVisibleStructuralChange(source, movedSubject), true);
});
