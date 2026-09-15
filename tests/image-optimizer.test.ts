import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { createReportArtworkPrompt, hasVisibleStructuralChange } from '../server/image-optimizer.mjs';

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

test('报告视觉提示只生成无文字背景并接收当前报告内容', () => {
  const prompt = createReportArtworkPrompt('01 评审结论\n夜色中的流动光线\n03 优化建议\n压低路面亮部。', 'simple');

  assert.match(prompt, /PhotoSense AI 的简易报告/);
  assert.match(prompt, /严禁生成任何文字、汉字、字母、数字/);
  assert.match(prompt, /准确的中文正文、评分、章节标题和图表会由程序在后续叠加/);
  assert.match(prompt, /适合 4:5 社交媒体海报/);
  assert.match(prompt, /夜色中的流动光线/);
  assert.match(prompt, /#0b0b0b/);
  assert.match(prompt, /#c86852/);
});
