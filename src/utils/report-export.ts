const MAX_REPORT_ARTWORK_CONTENT_LENGTH = 12_000;

export type ReportExportMode = 'simple' | 'detailed';

export function normalizeReportArtworkContent(value: string) {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_REPORT_ARTWORK_CONTENT_LENGTH);
}

function canvasToPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('无法生成报告图片'));
    }, 'image/png');
  });
}

export async function createFullReportPart(sourceCanvas: HTMLCanvasElement) {
  if (sourceCanvas.width <= 0 || sourceCanvas.height <= 0) return [];
  return [await canvasToPngBlob(sourceCanvas)];
}
