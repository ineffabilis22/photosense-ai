import assert from 'node:assert/strict';
import test from 'node:test';
import { formatFileSize, MAX_UPLOAD_BYTES, validateImageFile } from '../src/utils/upload';

test('接受 JPG、PNG 和 WebP', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.deepEqual(validateImageFile({ name: 'photo', size: 1024, type }), { ok: true });
  }
});

test('拒绝空文件、不支持类型和超大文件', () => {
  assert.equal(validateImageFile({ name: 'empty.jpg', size: 0, type: 'image/jpeg' }).ok, false);
  assert.equal(validateImageFile({ name: 'photo.gif', size: 1024, type: 'image/gif' }).ok, false);
  assert.equal(validateImageFile({ name: 'large.jpg', size: MAX_UPLOAD_BYTES + 1, type: 'image/jpeg' }).ok, false);
});

test('文件大小格式便于用户阅读', () => {
  assert.equal(formatFileSize(512 * 1024), '512 KB');
  assert.equal(formatFileSize(2.25 * 1024 * 1024), '2.3 MB');
});

