import type { AnalysisPhase } from '../types/report';

export const analysisPhases: Array<{ id: AnalysisPhase; label: string }> = [
  { id: 'preparing', label: '准备图片' },
  { id: 'connecting', label: '连接服务' },
  { id: 'analyzing', label: '分析画面' },
  { id: 'formatting', label: '整理报告' },
];

export function getAnalysisPhaseStatus(current: AnalysisPhase | undefined, target: AnalysisPhase) {
  const currentIndex = analysisPhases.findIndex((item) => item.id === current);
  const targetIndex = analysisPhases.findIndex((item) => item.id === target);

  if (currentIndex < 0 || targetIndex > currentIndex) return 'pending';
  if (targetIndex === currentIndex) return 'active';
  return 'complete';
}

export function getAnalysisWaitMessage(elapsedSeconds: number) {
  if (elapsedSeconds >= 12) return `已等待 ${elapsedSeconds} 秒，公开部署首次访问可能正在冷启动，请稍候。`;
  return `已等待 ${Math.max(0, elapsedSeconds)} 秒。`;
}

