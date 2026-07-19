export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

type UploadCandidate = {
  name: string;
  size: number;
  type: string;
};

export type UploadValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateImageFile(file: UploadCandidate): UploadValidationResult {
  if (file.size <= 0) {
    return { ok: false, error: '这个文件没有可读取的图片内容，请选择其他照片。' };
  }

  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return { ok: false, error: '仅支持 JPG、PNG 或 WebP 图片。' };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: '照片超过 15 MB，请压缩后再上传。' };
  }

  return { ok: true };
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

