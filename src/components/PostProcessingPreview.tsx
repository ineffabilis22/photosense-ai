import React, { useEffect, useMemo, useState } from 'react';
import type { Medium, PostProcessingAdviceItem, PreviewAdjustments, Report, SkillLevel } from '../types/report';
import { getReportPreviewAdjustments, normalizePreviewAdjustments, renderPreview, type RenderedPreview } from '../utils/preview';

type PostProcessingPreviewProps = {
  imageUrl: string;
  report: Report;
  medium: Medium;
  skillLevel: SkillLevel;
  enabled: boolean;
};

type ServerPreview = {
  imageDataUrl: string;
  width: number;
  height: number;
  appliedRecipe: PreviewAdjustments;
  tone: PostProcessingAdviceItem | null;
};

const SERVER_PREVIEW_TIMEOUT_MS = 20_000;

function formatSigned(value: number, suffix = '') {
  if (value === 0) return `0${suffix}`;
  return `${value > 0 ? '+' : ''}${Number(value.toFixed(2))}${suffix}`;
}

export function PostProcessingPreview({ imageUrl, report, medium, skillLevel, enabled }: PostProcessingPreviewProps) {
  const isHobbyist = skillLevel === '爱好者水平';
  const adjustments = useMemo(
    () => getReportPreviewAdjustments(report),
    [report],
  );
  const [localPreview, setLocalPreview] = useState<RenderedPreview | null>(null);
  const [serverPreview, setServerPreview] = useState<ServerPreview | null>(null);
  const [localStatus, setLocalStatus] = useState<'idle' | 'rendering' | 'ready' | 'error'>('idle');
  const [serverStatus, setServerStatus] = useState<'idle' | 'rendering' | 'ready' | 'error'>('idle');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let timeoutId: number | undefined;

    setLocalPreview(null);
    setServerPreview(null);
    setServerStatus('idle');
    setFeedback('');

    if (!enabled || !imageUrl) {
      setLocalStatus('idle');
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    setLocalStatus('rendering');
    renderPreview(imageUrl, adjustments)
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
      setServerStatus('rendering');
      setFeedback(isHobbyist ? '正在生成最终效果，当前可先查看快速预览。' : 'Sharp 正在生成最终效果，当前可先查看 Canvas 快速预览。');
      timeoutId = window.setTimeout(() => controller.abort(), SERVER_PREVIEW_TIMEOUT_MS);

      void fetch('/api/render-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl: imageUrl,
          medium,
          recipe: adjustments,
          legacyRecipe: report.recipe,
        }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok || !data?.preview?.imageDataUrl) {
            throw new Error(data?.error || '服务器预览生成失败。');
          }
          if (cancelled) return;
          const tone = data?.toneProfile?.tone;
          setServerPreview({
            imageDataUrl: data.preview.imageDataUrl,
            width: Number(data.preview.width) || 0,
            height: Number(data.preview.height) || 0,
            appliedRecipe: normalizePreviewAdjustments(data.preview.appliedRecipe ?? adjustments),
            tone: tone && typeof tone.suggestion === 'string'
              ? {
                  suggestion: tone.suggestion,
                  reason: typeof tone.reason === 'string' ? tone.reason : '',
                  expectedEffect: typeof tone.expectedEffect === 'string' ? tone.expectedEffect : '',
                }
              : null,
          });
          setServerStatus('ready');
          setFeedback(isHobbyist ? '服务器已生成最终效果。' : '已使用 Sharp 服务器渲染最终效果。');
        })
        .catch((error) => {
          if (cancelled) return;
          setServerStatus('error');
          setFeedback(error instanceof DOMException && error.name === 'AbortError'
            ? isHobbyist ? '服务器预览超时，已使用快速完整画幅预览。' : '服务器预览超时，已使用 Canvas 完整画幅预览。'
            : isHobbyist ? '服务器预览生成失败，已使用快速完整画幅预览。' : '服务器预览生成失败，已使用 Canvas 完整画幅预览。');
        })
        .finally(() => {
          if (timeoutId !== undefined) window.clearTimeout(timeoutId);
        });
    }

    return () => {
      cancelled = true;
      controller.abort();
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [adjustments, enabled, imageUrl, isHobbyist, medium, report.recipe]);

  function handleDownload() {
    const previewUrl = serverPreview?.imageDataUrl || localPreview?.previewUrl;
    if (!previewUrl) return;
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = `PhotoSense-AI-后期效果预览.${serverPreview ? 'webp' : 'jpg'}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  if (!enabled) {
    return (
      <div className="post-preview-panel post-preview-panel-disabled">
        <p className="panel-kicker">效果预览</p>
        <p>示例报告不生成后期效果。完成一次实时分析后即可查看。</p>
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="post-preview-panel post-preview-panel-disabled">
        <p className="panel-kicker">效果预览</p>
        <p>这条记录没有可用照片，暂时无法生成预览。</p>
      </div>
    );
  }

  const activePreviewUrl = serverPreview?.imageDataUrl || localPreview?.previewUrl || '';
  const previewWidth = serverPreview?.width || localPreview?.width;
  const previewHeight = serverPreview?.height || localPreview?.height;
  const appliedAdjustments = serverPreview?.appliedRecipe ?? adjustments;
  const tonePlan = isHobbyist ? report.postProcessing?.tone : serverPreview?.tone ?? report.postProcessing?.tone;
  const rendererLabel = isHobbyist
    ? serverStatus === 'ready' ? '服务器生成' : serverStatus === 'rendering' ? '正在生成' : '快速预览'
    : serverStatus === 'ready' ? 'Sharp 服务器渲染' : serverStatus === 'rendering' ? 'Sharp 正在渲染' : 'Canvas 降级预览';

  return (
    <div className="post-preview-panel" aria-label="后期效果模拟预览">
      <div className="post-preview-heading">
        <div>
          <p className="panel-kicker">Processed image</p>
          <h3>修改后效果预览</h3>
        </div>
        <span>{rendererLabel}</span>
      </div>

      {!activePreviewUrl && (localStatus === 'rendering' || serverStatus === 'rendering') ? (
        <div className="post-preview-loading" role="status">正在生成完整画幅预览…</div>
      ) : null}
      {!activePreviewUrl && localStatus === 'error' && serverStatus !== 'rendering' ? (
        <div className="post-preview-loading" role="status">无法生成预览，原始报告内容不受影响。</div>
      ) : null}

      {activePreviewUrl ? (
        <figure className="post-preview-image">
          <img
            src={activePreviewUrl}
            alt="根据后期建议生成的完整画幅效果预览"
            width={previewWidth}
            height={previewHeight}
          />
        </figure>
      ) : null}

      {tonePlan ? (
        <div className="post-preview-tone-plan" aria-label={isHobbyist ? '照片专属明暗方案' : '照片专属影调方案'}>
          <p className="panel-kicker">{isHobbyist ? '照片专属明暗方案' : '照片专属影调方案'}</p>
          <strong>{tonePlan.suggestion}</strong>
          <p>{tonePlan.reason} {tonePlan.expectedEffect}</p>
        </div>
      ) : null}

      <div className="post-preview-parameters" aria-label={isHobbyist ? '已应用的整体调整' : '已应用的全局影调参数'}>
        <span>{isHobbyist ? '整体明暗' : '曝光'} {formatSigned(appliedAdjustments.global.exposureEv, isHobbyist ? '' : ' EV')}</span>
        <span>{isHobbyist ? '明暗差异' : '对比'} {formatSigned(appliedAdjustments.global.contrast)}</span>
        <span>{isHobbyist ? '最亮区域' : '高光'} {formatSigned(appliedAdjustments.global.highlights)}</span>
        <span>{isHobbyist ? '较暗区域' : '阴影'} {formatSigned(appliedAdjustments.global.shadows)}</span>
        <span>{isHobbyist ? '画面冷暖' : '色温'} {formatSigned(appliedAdjustments.global.temperature)}</span>
        <span>{isHobbyist ? '颜色浓淡' : '饱和度'} {formatSigned(appliedAdjustments.global.saturation)}</span>
      </div>

      <div className="post-preview-actions">
        <button
          type="button"
          className="secondary-button compact"
          disabled={!activePreviewUrl}
          onClick={handleDownload}
        >
          保存预览
        </button>
      </div>

      {feedback ? <p className={`post-preview-feedback is-${serverStatus}`} role="status">{feedback}</p> : null}
      <p className="post-preview-note">{isHobbyist ? '完整画幅预览只应用整体明暗和颜色调整；裁剪与局部调整建议保留为文字参考，不会切割这张预览图。' : '完整画幅预览仅应用全局影调；裁剪与局部蒙版建议保留为文字参考，不会切割这张预览图。'}</p>
    </div>
  );
}
