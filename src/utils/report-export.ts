const MIN_PORTRAIT_HEIGHT_RATIO = 4 / 3;
const REPORT_PAGE_BACKGROUND = '#eee7d8';

export function getPortraitReportSize(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }

  return {
    width: Math.floor(width),
    height: Math.max(Math.floor(height), Math.round(width * MIN_PORTRAIT_HEIGHT_RATIO)),
  };
}

function canvasToPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('无法生成报告图片'));
    }, 'image/png');
  });
}

export async function createPortraitReportPart(sourceCanvas: HTMLCanvasElement) {
  const size = getPortraitReportSize(sourceCanvas.width, sourceCanvas.height);
  if (size.width === 0 || size.height === 0) return [];

  const pageCanvas = document.createElement('canvas');
  pageCanvas.width = size.width;
  pageCanvas.height = size.height;
  const context = pageCanvas.getContext('2d');

  if (!context) {
    throw new Error('无法创建报告图片画布');
  }

  context.fillStyle = REPORT_PAGE_BACKGROUND;
  context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
  context.drawImage(sourceCanvas, 0, 0);

  return [await canvasToPngBlob(pageCanvas)];
}

export async function createFullReportPart(sourceCanvas: HTMLCanvasElement) {
  if (sourceCanvas.width <= 0 || sourceCanvas.height <= 0) return [];
  return [await canvasToPngBlob(sourceCanvas)];
}
