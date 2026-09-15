import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Medium, NextShootingAdvice, OptimizationKind, Report } from '../types/report';
import { getReportPreviewAdjustments, normalizePreviewAdjustments, renderPreview, type RenderedPreview } from '../utils/preview';

type PostProcessingPreviewProps = {
  imageUrl: string;
  report: Report;
  medium: Medium;
  nextShooting: NextShootingAdvice | null;
  persistedImageUrl?: string;
  onOptimizedImageGenerated?: (imageUrl: string) => Promise<void> | void;
  onOptimizedImageReady?: (imageUrl: string) => void;
  onGenerationStateChange?: (state: 'not-required' | 'generating' | 'ready' | 'error') => void;
  enabled: boolean;
};

type ServerPreview = {
  imageDataUrl: string;
  width: number;
  height: number;
};

type ComparisonView = 'before' | 'after';

const SERVER_PREVIEW_TIMEOUT_MS = 20_000;
const AI_PREVIEW_TIMEOUT_MS = 120_000;
const AI_PREVIEW_LONG_WAIT_MS = 30_000;
const optimizationLabels: Record<OptimizationKind, string> = {
  crop: '裁剪画面',
  tone: '调整明暗',
  'local-adjustment': '强化主体',
  cleanup: '清理干扰',
  reframe: '调整构图',
  'motion-effect': '表现动态',
  perspective: '整理透视',
  other: '画面优化',
};

export function PostProcessingPreview({ imageUrl, report, medium, nextShooting, persistedImageUrl = '', onOptimizedImageGenerated, onOptimizedImageReady, onGenerationStateChange, enabled }: PostProcessingPreviewProps) {
  const adjustments = useMemo(
    () => getReportPreviewAdjustments(report),
    [report],
  );
  const [localPreview, setLocalPreview] = useState<RenderedPreview | null>(null);
  const [serverPreview, setServerPreview] = useState<ServerPreview | null>(null);
  const [aiPreviewUrl, setAiPreviewUrl] = useState('');
  const [localStatus, setLocalStatus] = useState<'idle' | 'rendering' | 'ready' | 'error'>('idle');
  const [serverStatus, setServerStatus] = useState<'idle' | 'rendering' | 'ready' | 'error'>('idle');
  const [aiStatus, setAiStatus] = useState<'idle' | 'rendering' | 'ready' | 'error'>('idle');
  const [hasLongWaited, setHasLongWaited] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);
  const [comparisonView, setComparisonView] = useState<ComparisonView>('after');
  const forceGenerationRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const previewController = new AbortController();
    const imageController = new AbortController();
    let timeoutId: number | undefined;
    let imageTimeoutId: number | undefined;
    let longWaitTimerId: number | undefined;
    let renderTimerId: number | undefined;
    let animationFrameId: number | undefined;

    const forceGeneration = forceGenerationRef.current;
    forceGenerationRef.current = false;
    const hasOptimizationPlan = Boolean(report.optimizationPlan?.items.length);
    setLocalPreview(null);
    setServerPreview(null);
    setAiPreviewUrl(forceGeneration ? '' : persistedImageUrl);
    setServerStatus('idle');
    setAiStatus(!forceGeneration && persistedImageUrl ? 'ready' : 'idle');
    setHasLongWaited(false);
    setComparisonView('after');

    if (!enabled || !imageUrl) {
      onGenerationStateChange?.('not-required');
      setLocalStatus('idle');
      return () => {
        cancelled = true;
        previewController.abort();
        imageController.abort();
      };
    }

    const startPreviewGeneration = () => {
      if (cancelled) return;

      setLocalStatus('rendering');
      renderPreview(imageUrl, adjustments, report.recipe)
        .then((preview) => {
          if (cancelled) return;
          setLocalPreview(preview);
          setLocalStatus('ready');
        })
        .catch(() => {
          if (cancelled) return;
          setLocalStatus('error');
        });

      if (imageUrl.startsWith('data:image/')) {
        if (hasOptimizationPlan && (forceGeneration || !persistedImageUrl)) {
          onGenerationStateChange?.('generating');
          setAiStatus('rendering');
          longWaitTimerId = window.setTimeout(() => {
            if (!cancelled) setHasLongWaited(true);
          }, AI_PREVIEW_LONG_WAIT_MS);
          imageTimeoutId = window.setTimeout(() => imageController.abort(), AI_PREVIEW_TIMEOUT_MS);

          void fetch('/api/generate-optimized-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageDataUrl: imageUrl,
              medium,
              optimizationPlan: report.optimizationPlan,
              nextShooting,
            }),
            signal: imageController.signal,
          })
            .then(async (response) => {
              const data = await response.json().catch(() => ({}));
              if (!response.ok || typeof data?.imageUrl !== 'string') {
                throw new Error(data?.error || 'optimized-image-generation-failed');
              }
              if (cancelled) return;
              await onOptimizedImageGenerated?.(data.imageUrl);
              if (cancelled) return;
              setAiPreviewUrl(data.imageUrl);
              setAiStatus('ready');
              onGenerationStateChange?.('ready');
              onOptimizedImageReady?.(data.imageUrl);
            })
            .catch(() => {
              if (cancelled) return;
              onGenerationStateChange?.('error');
              setAiStatus('error');
            })
            .finally(() => {
              if (imageTimeoutId !== undefined) window.clearTimeout(imageTimeoutId);
              if (longWaitTimerId !== undefined) window.clearTimeout(longWaitTimerId);
            });
        }

        if (hasOptimizationPlan && !forceGeneration && persistedImageUrl) {
          onGenerationStateChange?.('ready');
        }

        setServerStatus('rendering');
        timeoutId = window.setTimeout(() => previewController.abort(), SERVER_PREVIEW_TIMEOUT_MS);

        void fetch('/api/render-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageDataUrl: imageUrl,
            medium,
            recipe: adjustments,
            legacyRecipe: report.recipe,
          }),
          signal: previewController.signal,
        })
          .then(async (response) => {
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data?.preview?.imageDataUrl) {
              throw new Error(data?.error || 'preview-render-failed');
            }
            if (cancelled) return;
            const appliedRecipe = normalizePreviewAdjustments(data.preview.appliedRecipe ?? adjustments);
            setServerPreview({
              imageDataUrl: data.preview.imageDataUrl,
              width: Number(data.preview.width) || 0,
              height: Number(data.preview.height) || 0,
            });
            setServerStatus('ready');
            void renderPreview(imageUrl, appliedRecipe, report.recipe)
              .then((preview) => {
                if (cancelled) return;
                setLocalPreview(preview);
                setLocalStatus('ready');
              })
              .catch(() => undefined);
          })
          .catch(() => {
            if (cancelled) return;
            setServerStatus('error');
          })
          .finally(() => {
            if (timeoutId !== undefined) window.clearTimeout(timeoutId);
          });
      }
    };

    // Let the report paint first so the expensive Canvas work never blocks report generation.
    animationFrameId = window.requestAnimationFrame(() => {
      renderTimerId = window.setTimeout(startPreviewGeneration, 0);
    });

    return () => {
      cancelled = true;
      previewController.abort();
      imageController.abort();
      if (animationFrameId !== undefined) window.cancelAnimationFrame(animationFrameId);
      if (renderTimerId !== undefined) window.clearTimeout(renderTimerId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if (imageTimeoutId !== undefined) window.clearTimeout(imageTimeoutId);
      if (longWaitTimerId !== undefined) window.clearTimeout(longWaitTimerId);
    };
  }, [adjustments, enabled, imageUrl, medium, onGenerationStateChange, report.optimizationPlan, report.recipe, requestVersion]);

  function handleRegenerate() {
    forceGenerationRef.current = true;
    setRequestVersion((version) => version + 1);
  }

  function handleDownload() {
    const previewUrl = aiPreviewUrl || serverPreview?.imageDataUrl || localPreview?.previewUrl;
    if (!previewUrl) return;
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = `PhotoSense-AI-优化预览.${aiPreviewUrl ? 'png' : serverPreview ? 'webp' : 'jpg'}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  if (!enabled) {
    return (
      <div className="post-preview-panel post-preview-panel-disabled">
        <p className="panel-kicker">优化预览</p>
        <p>这条记录没有可用照片，暂时无法生成预览。</p>
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="post-preview-panel post-preview-panel-disabled">
        <p className="panel-kicker">优化预览</p>
        <p>这条记录没有可用照片，暂时无法生成预览。</p>
      </div>
    );
  }

  const isAiReady = aiStatus === 'ready' && Boolean(aiPreviewUrl);
  const hasOptimizationPlan = Boolean(report.optimizationPlan?.items.length);
  const isAiGenerating = hasOptimizationPlan && !isAiReady && aiStatus !== 'error';
  const isAiError = hasOptimizationPlan && aiStatus === 'error';
  const fallbackPreviewUrl = serverPreview?.imageDataUrl || localPreview?.previewUrl || '';
  const activePreviewUrl = isAiReady
    ? comparisonView === 'before' ? imageUrl : aiPreviewUrl
    : hasOptimizationPlan ? imageUrl : fallbackPreviewUrl;
  const canDownloadPreview = hasOptimizationPlan ? isAiReady : Boolean(fallbackPreviewUrl);
  const previewWidth = serverPreview?.width || localPreview?.width;
  const previewHeight = serverPreview?.height || localPreview?.height;
  const optimizationItems = report.optimizationPlan?.items.length
    ? report.optimizationPlan.items.map((item) => ({
      label: optimizationLabels[item.kind],
      instruction: item.instruction,
      reason: item.reason,
      expectedEffect: item.expectedEffect,
    }))
    : [
      { label: '裁剪画面', instruction: report.postProcessing?.crop.suggestion, reason: report.postProcessing?.crop.reason, expectedEffect: report.postProcessing?.crop.expectedEffect },
      { label: '调整明暗', instruction: report.postProcessing?.tone.suggestion, reason: report.postProcessing?.tone.reason, expectedEffect: report.postProcessing?.tone.expectedEffect },
      { label: '强化主体', instruction: report.postProcessing?.masking.suggestion, reason: report.postProcessing?.masking.reason, expectedEffect: report.postProcessing?.masking.expectedEffect },
    ].filter((item): item is { label: string; instruction: string; reason: string; expectedEffect: string } => Boolean(item.instruction && item.reason && item.expectedEffect));

  return (
    <div className="post-preview-panel" aria-label="优化建议">
      <div className="post-preview-heading">
        <div>
          <h3>优化预览</h3>
        </div>
      </div>

      {optimizationItems.length ? (
        <div className="post-preview-layout">
          <figure className="post-preview-image">
            {activePreviewUrl ? (
              <img
                src={activePreviewUrl}
                alt={isAiReady && comparisonView === 'before' ? '修改前的原始照片' : '根据本次分析结论生成的优化后图片'}
                width={previewWidth}
                height={previewHeight}
              />
            ) : (
              <div className="post-preview-loading" role="status">
                {localStatus === 'rendering' || serverStatus === 'rendering' || aiStatus === 'rendering' ? '正在生成优化后的图片…' : '预览暂时无法生成，报告内容仍可查看。'}
              </div>
            )}
            {isAiReady ? (
              <div className="post-preview-comparison-toggle" role="group" aria-label="切换修改前后照片">
                <button type="button" aria-pressed={comparisonView === 'before'} onClick={() => setComparisonView('before')}>
                  修改前
                </button>
                <button type="button" aria-pressed={comparisonView === 'after'} onClick={() => setComparisonView('after')}>
                  修改后
                </button>
              </div>
            ) : null}
            {hasOptimizationPlan ? (
              <div
                className={`post-preview-status post-preview-status-${isAiReady ? 'ready' : isAiError ? 'error' : 'generating'}`}
                aria-hidden="true"
              >
                <span className="post-preview-status-dot" />
                <span>{isAiReady ? '已完成' : isAiError ? '暂未完成' : '生成中'}</span>
              </div>
            ) : null}
            {isAiGenerating ? (
              <div className="post-preview-loading-overlay" role="status" aria-live="polite">
                <div className="post-preview-state-copy">
                  <strong>{hasLongWaited ? '仍在生成优化后照片' : '正在生成优化后照片'}</strong>
                  <p>
                    {hasLongWaited
                      ? '画面调整需要更多时间，完成后会自动显示。'
                      : '这一步比文字报告需要更长时间，你可以先阅读右侧的优化内容。'}
                  </p>
                  <span className="post-preview-progress-line" aria-hidden="true"><span /></span>
                </div>
              </div>
            ) : null}
            {isAiError ? (
              <div className="post-preview-loading-overlay post-preview-error-overlay" role="status" aria-live="polite">
                <div className="post-preview-state-copy">
                  <strong>优化后照片暂时未生成</strong>
                  <p>文字报告仍可正常查看，你可以重新尝试。</p>
                </div>
              </div>
            ) : null}
            <div className="post-preview-actions">
              {isAiReady ? (
                <p className="post-preview-completion-note" role="status" aria-live="polite">
                  <strong>优化后照片已生成</strong>
                  <span>可以切换“修改前 / 修改后”，查看画面变化。</span>
                </p>
              ) : null}
              <div className="post-preview-button-row">
                {(isAiReady || aiStatus === 'error') && report.optimizationPlan?.items.length ? (
                  <button type="button" className="secondary-button compact" onClick={handleRegenerate}>
                    重新生成
                  </button>
                ) : null}
                <button
                  type="button"
                  className="secondary-button compact"
                  disabled={!canDownloadPreview}
                  onClick={handleDownload}
                >
                  保存预览
                </button>
              </div>
            </div>
          </figure>
          <div className="post-preview-copy" aria-label="后期建议内容">
            <p className="panel-kicker">后期建议</p>
            <div className="post-preview-suggestions">
              {optimizationItems.map((item, index) => (
                <article key={`${item.label}-${index}`}>
                  <span>{item.label}</span>
                  <h4>{item.instruction}</h4>
                  <p><strong>理由：</strong>{item.reason}</p>
                  <p><strong>变化：</strong>{item.expectedEffect}</p>
                </article>
              ))}
            </div>
            {nextShooting?.items.length ? (
              <div className="post-preview-next-shot">
                <p className="panel-kicker">如果当时再拍一次</p>
                <p className="post-preview-next-shot-summary">{nextShooting.summary}</p>
                <ul>
                  {nextShooting.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

    </div>
  );
}
