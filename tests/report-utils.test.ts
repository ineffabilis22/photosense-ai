import assert from 'node:assert/strict';
import test from 'node:test';
import type { Report, ReviewContext } from '../src/types/report';
import { mergeAiReportWithFallback } from '../src/utils/report';

const context: ReviewContext = {
  mediumFocus: '数码摄影基准',
  levelFocus: '进阶基准',
  genreFocus: '街头摄影基准',
  scoringLogic: '现场关系优先',
};

const fallback: Report = {
  overall: '默认总体印象',
  scores: { 构图: 70, 光线: 70, 色彩: 70, 叙事: 70, 技术完成度: 70 },
  composition: '默认构图',
  lighting: '默认光线',
  colour: '默认色彩',
  storytelling: '默认叙事',
  technical: '默认技术',
  suggestions: ['默认建议'],
  recipe: { exposure: '0', contrast: '0', highlights: '0', shadows: '0', temperature: '0', cropRatio: '3:2' },
  verdict: { title: '默认标题', summary: '默认结论', mainIssue: '默认问题', nextStep: '默认动作', tags: ['默认标签'] },
  reviewContext: context,
  postProcessing: {
    crop: { suggestion: '默认裁剪', reason: '默认理由', expectedEffect: '默认效果' },
    tone: { suggestion: '默认影调', reason: '默认理由', expectedEffect: '默认效果' },
    masking: { suggestion: '默认蒙版', reason: '默认理由', expectedEffect: '默认效果' },
  },
  nextShooting: { summary: '默认下次拍摄', items: ['默认动作'] },
  photoSpecific: {
    strength: '默认优点',
    priorityIssue: '默认优先问题',
    affectedArea: '默认区域',
    nextAction: '默认具体动作',
    crop: { ratio: '3:2', direction: '默认方向', rationale: '默认裁剪理由' },
  },
  scoreReasons: { 构图: '默认构图依据', 光线: '默认光线依据', 色彩: '默认色彩依据', 叙事: '默认叙事依据', 技术完成度: '默认技术依据' },
};

test('保留有效的模型分数、结论和后期建议', () => {
  const report = mergeAiReportWithFallback({
    scores: { 构图: 61, 光线: 74, 色彩: 82, 叙事: 57, 技术完成度: 69 },
    verdict: { title: '红伞与路人建立观看张力', summary: '鲜明红色形成视觉入口。', mainIssue: '右侧车灯分散注意。', nextStep: '小幅裁去右侧亮点。', tags: ['红伞', '现场张力'] },
    postProcessing: {
      crop: { suggestion: '仅裁去右边车灯。', reason: '亮点与红伞竞争。', expectedEffect: '红伞更快被看见。' },
      tone: { suggestion: '压低路面高光。', reason: '保留夜景层次。', expectedEffect: '视线更集中。' },
      masking: { suggestion: '轻提人物面部。', reason: '动作是叙事核心。', expectedEffect: '人物关系更清楚。' },
    },
    photoSpecific: {
      strength: '红伞与深色街景形成明确对比。',
      priorityIssue: '右侧车灯抢走红伞的注意力。',
      affectedArea: '画面右侧边缘',
      nextAction: '从右侧轻微裁切。',
      crop: { ratio: '4:3', direction: '从右侧收紧', rationale: '去除车灯并保留人物关系。' },
    },
    scoreReasons: { 构图: '主体清楚，但右侧视觉重量偏高。' },
    genreAssessment: {
      detectedGenre: '街头摄影',
      confidence: 0.91,
      reason: '行人与街道环境共同构成现场关系。',
    },
  }, fallback, context);

  assert.deepEqual(report.scores, { 构图: 61, 光线: 74, 色彩: 82, 叙事: 57, 技术完成度: 69 });
  assert.equal(report.verdict?.nextStep, '小幅裁去右侧亮点。');
  assert.equal(report.postProcessing?.crop.suggestion, '仅裁去右边车灯。');
  assert.equal(report.postProcessing?.tone.suggestion, '压低路面高光。');
  assert.equal(report.postProcessing?.masking.suggestion, '轻提人物面部。');
  assert.equal(report.photoSpecific?.affectedArea, '画面右侧边缘');
  assert.equal(report.photoSpecific?.crop.direction, '从右侧收紧');
  assert.equal(report.scoreReasons?.构图, '主体清楚，但右侧视觉重量偏高。');
  assert.deepEqual(report.genreAssessment, {
    detectedGenre: '街头摄影',
    confidence: 0.91,
    reason: '行人与街道环境共同构成现场关系。',
  });
});

test('字段缺失或包含内部元语言时才使用 fallback', () => {
  const report = mergeAiReportWithFallback({
    verdict: { nextStep: '按高级口径建议优化后入选' },
    scores: { 构图: 130, 光线: 'bad' },
    genreAssessment: { detectedGenre: '新闻摄影', confidence: 2, reason: '不在支持范围。' },
  }, fallback, context);

  assert.equal(report.verdict?.nextStep, '默认动作');
  assert.equal(report.scores.构图, 100);
  assert.equal(report.scores.光线, 70);
  assert.equal(report.composition, '默认构图');
  assert.deepEqual(report.reviewContext, context);
  assert.equal(report.photoSpecific?.strength, '默认优点');
  assert.equal(report.scoreReasons?.叙事, '默认叙事依据');
  assert.equal(report.genreAssessment, undefined);
});
