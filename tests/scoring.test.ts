import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateRubricScores, getScoreBandFromNumber } from '../server/scoring.mjs';

const completeBreakdown = {
  构图: {
    fundamentals: { subjectHierarchy: 3, placementBalance: 3, edgeControl: 3, depthAndGeometry: 3 },
    refinement: 1,
    evidence: '主体层级和空间线条基本成立，但边缘仍有可见干扰。',
  },
  光线: {
    fundamentals: { exposureTone: 4.2, directionQuality: 3.8, subjectSeparation: 3.4, highlightShadowControl: 3 },
    refinement: 2,
    evidence: '亮部和暗部都有细节，主体分离与层次控制仍不够主动。',
  },
  色彩: {
    fundamentals: { harmony: 4, separation: 4, paletteIntent: 4, consistency: 4 },
    refinement: 5,
    evidence: '冷暖关系统一，关键色承担了明确的视觉作用。',
  },
  叙事: {
    fundamentals: { subjectClarity: 2, contextRelation: 3, momentEmotion: 2, specificity: 2 },
    refinement: 1,
    evidence: '环境线索可读，但事件和瞬间的具体性仍然有限。',
  },
  技术完成度: {
    fundamentals: { focusDetail: 4, exposureIntegrity: 4, perspectiveProcessing: 4, mediumFit: 4 },
    refinement: 4,
    evidence: '清晰度、曝光和透视都可靠，后期处理没有破坏介质质感。',
  },
};

test('爱好者与进阶使用不同的可解释计算公式', () => {
  const hobbyist = calculateRubricScores({
    scoreBreakdown: completeBreakdown,
    skillLevel: '爱好者水平',
    legacyBands: { 构图: '强', 光线: '强', 色彩: '强', 叙事: '强', 技术完成度: '强' },
  });
  const advanced = calculateRubricScores({
    scoreBreakdown: completeBreakdown,
    skillLevel: '进阶水平',
    legacyBands: { 构图: '强', 光线: '强', 色彩: '强', 叙事: '强', 技术完成度: '强' },
  });

  assert.equal(hobbyist.scores.构图, 60);
  assert.equal(advanced.scores.构图, 52);
  assert.equal(hobbyist.scores.光线, 72);
  assert.equal(advanced.scores.光线, 66);
  assert.equal(hobbyist.scores.色彩, 80);
  assert.equal(advanced.scores.色彩, 84);
  assert.equal(advanced.scoreBands.光线, getScoreBandFromNumber(66));
  assert.notDeepEqual(hobbyist.scores, advanced.scores);
});

test('旧 provider 没有子项时保留兼容回退，但不再伪造新子项', () => {
  const result = calculateRubricScores({
    scoreBreakdown: {},
    skillLevel: '进阶水平',
    legacyBands: { 构图: '成立', 光线: '普通', 色彩: '强', 叙事: '偏弱', 技术完成度: '作品级' },
  });

  assert.deepEqual(result.scores, { 构图: 75, 光线: 65, 色彩: 85, 叙事: 50, 技术完成度: 95 });
  assert.deepEqual(result.scoreBands, { 构图: '成立', 光线: '普通', 色彩: '强', 叙事: '偏弱', 技术完成度: '作品级' });
  assert.deepEqual(result.scoreBreakdown, {});
});

test('无效子项只回退对应维度，避免一个坏字段污染整份报告', () => {
  const result = calculateRubricScores({
    scoreBreakdown: {
      ...completeBreakdown,
      色彩: {
        ...completeBreakdown.色彩,
        fundamentals: { ...completeBreakdown.色彩.fundamentals, harmony: 8 },
      },
    },
    skillLevel: '爱好者水平',
    legacyBands: { 构图: '普通', 光线: '普通', 色彩: '普通', 叙事: '普通', 技术完成度: '普通' },
  });

  assert.equal(result.scores.构图, 60);
  assert.equal(result.scores.色彩, 65);
  assert.equal(result.scoreBreakdown.构图?.evidence, completeBreakdown.构图.evidence);
  assert.equal(result.scoreBreakdown.色彩, undefined);
});
