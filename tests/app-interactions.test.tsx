import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import type { HistoryRecord, Report } from '../src/types/report';

const HISTORY_STORAGE_KEY = 'photosense_history_records';
const imageDataUrl = 'data:image/jpeg;base64,/9j/2Q==';

type TestEnvironment = {
  dom: JSDOM;
  root: Root;
};

function installDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost:5173/',
    pretendToBeVisual: true,
  });
  const window = dom.window;

  Object.defineProperties(globalThis, {
    window: { configurable: true, value: window },
    document: { configurable: true, value: window.document },
    navigator: { configurable: true, value: window.navigator },
    localStorage: { configurable: true, value: window.localStorage },
    HTMLElement: { configurable: true, value: window.HTMLElement },
    HTMLInputElement: { configurable: true, value: window.HTMLInputElement },
    HTMLCanvasElement: { configurable: true, value: window.HTMLCanvasElement },
    Event: { configurable: true, value: window.Event },
    MouseEvent: { configurable: true, value: window.MouseEvent },
    DOMException: { configurable: true, value: window.DOMException },
    File: { configurable: true, value: window.File },
    URL: { configurable: true, value: window.URL },
    getComputedStyle: { configurable: true, value: window.getComputedStyle.bind(window) },
  });

  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.scrollTo = () => undefined;
  window.confirm = () => true;
  window.requestAnimationFrame = (callback) => window.setTimeout(() => callback(Date.now()), 0);
  window.cancelAnimationFrame = (id) => window.clearTimeout(id);

  let objectUrlIndex = 0;
  window.URL.createObjectURL = () => `blob:photosense-test-${++objectUrlIndex}`;
  window.URL.revokeObjectURL = () => undefined;

  class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 1200;
    naturalHeight = 800;

    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  }

  Object.defineProperty(globalThis, 'Image', { configurable: true, value: MockImage });
  window.HTMLCanvasElement.prototype.getContext = (() => ({ drawImage: () => undefined })) as unknown as typeof window.HTMLCanvasElement.prototype.getContext;
  window.HTMLCanvasElement.prototype.toDataURL = () => imageDataUrl;

  class MockIntersectionObserver {
    observe() {}
    disconnect() {}
    unobserve() {}
    takeRecords() { return []; }
  }

  Object.defineProperty(globalThis, 'IntersectionObserver', { configurable: true, value: MockIntersectionObserver });
  return dom;
}

async function renderApp(historyRecords: HistoryRecord[] = []): Promise<TestEnvironment> {
  const dom = installDom();
  dom.window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyRecords));
  const [{ createRoot }, { default: App }] = await Promise.all([
    import('react-dom/client'),
    import('../src/App'),
  ]);
  const root = createRoot(dom.window.document.getElementById('root') as HTMLElement);
  await act(async () => root.render(<App />));
  return { dom, root };
}

async function cleanupEnvironment(environment: TestEnvironment) {
  await act(async () => environment.root.unmount());
  environment.dom.window.close();
}

function getButton(label: string) {
  const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === label);
  assert.ok(button, `没有找到按钮：${label}`);
  return button as HTMLButtonElement;
}

function getButtons(label: string) {
  return [...document.querySelectorAll('button')].filter((item) => item.textContent?.trim() === label) as HTMLButtonElement[];
}

async function click(element: Element) {
  await act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

async function setInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  valueSetter?.call(input, value);
  await act(async () => {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function uploadFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
}

async function dropFile(target: Element, file: File) {
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { files: [file] } });
  await act(async () => target.dispatchEvent(event));
}

async function waitFor(check: () => boolean, description: string, timeoutMs = 4000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (check()) return;
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
  }

  assert.fail(`等待超时：${description}`);
}

function createAiReport(): Report {
  return {
    overall: '红伞人物是明确主体，湿润路面提供了夜景层次。',
    scores: { 构图: 78, 光线: 74, 色彩: 84, 叙事: 72, 技术完成度: 76 },
    composition: '结论：主体清楚。说明：右侧车灯略有干扰。方向：从右侧轻微收紧。',
    lighting: '结论：夜景层次可读。说明：路面高光略亮。方向：轻微回收高光。',
    colour: '结论：红色形成记忆点。说明：冷暖关系明确。方向：保持红伞饱和度。',
    storytelling: '结论：人物动作可读。说明：背景线索支持现场感。方向：强化人物与街景关系。',
    technical: '结论：清晰度稳定。说明：暗部仍有细节。方向：避免过度降噪。',
    suggestions: ['从右侧轻微收紧。', '压低路面高光。', '保留红伞色彩。'],
    recipe: { exposure: '0', contrast: '+5', highlights: '-10', shadows: '+5', temperature: '0', cropRatio: '4:3' },
    verdict: { title: '红伞建立了清楚的夜景入口', summary: '主体明确，背景仍可收紧。', mainIssue: '右侧车灯分散注意。', nextStep: '从右侧轻微裁切。', tags: ['红伞', '夜景'] },
    postProcessing: {
      crop: { suggestion: '从右侧轻微裁切。', reason: '去除车灯。', expectedEffect: '主体更集中。' },
      tone: { suggestion: '压低路面高光。', reason: '保持夜景层次。', expectedEffect: '明暗更稳定。' },
      masking: { suggestion: '轻提人物面部。', reason: '人物是叙事核心。', expectedEffect: '动作更可读。' },
    },
    nextShooting: { summary: '继续观察人物与灯光关系。', items: ['等待动作更完整。', '避开边缘车灯。', '保持低机位。'] },
    photoSpecific: {
      strength: '红伞与深色街景形成明确对比。',
      priorityIssue: '右侧车灯抢走红伞的注意力。',
      affectedArea: '画面右侧边缘',
      nextAction: '从右侧轻微裁切。',
      crop: { ratio: '4:3', direction: '从右侧收紧', rationale: '去除车灯并保留人物关系。' },
    },
    scoreReasons: {
      构图: '主体明确，但右侧视觉重量偏高。',
      光线: '夜景层次可读，路面高光略亮。',
      色彩: '红伞是稳定的色彩记忆点。',
      叙事: '人物动作和街景建立了现场关系。',
      技术完成度: '清晰度和曝光足以支撑观看。',
    },
  };
}

function createHistoryRecord(id: string, createdAt: string, scoreShift: number): HistoryRecord {
  const report = createAiReport();
  report.scores = Object.fromEntries(
    Object.entries(report.scores).map(([name, score]) => [name, score + scoreShift]),
  ) as Report['scores'];

  return {
    id,
    title: id === 'newer' ? '较新街景' : '较早街景',
    imageUrl: imageDataUrl,
    fileName: `${id}.jpg`,
    medium: '数码摄影',
    subject: '街头摄影',
    genre: '街头摄影',
    critiqueLevel: '进阶',
    skillLevel: '进阶',
    date: createdAt.slice(0, 10),
    dateTime: createdAt,
    createdAt,
    report,
    reportSource: 'ai',
    overallScore: 76 + scoreShift,
    tags: [],
    summary: report.verdict?.summary ?? report.overall,
    strongestDimension: '色彩',
    weakestDimension: '叙事',
  };
}

test('上传、更换与移除照片时保留点评参数和标题', async () => {
  const environment = await renderApp();

  try {
    await click(getButton('开始点评'));
    await click(getButton('胶片摄影'));
    await click(getButton('高级'));
    await click(getButton('人像摄影'));

    const titleInput = document.querySelector('.photo-title-field input') as HTMLInputElement;
    await setInputValue(titleInput, '窗边人物');
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const dropZone = document.querySelector('.upload-drop-zone') as HTMLElement;
    await dropFile(dropZone, new File([new Uint8Array(1024)], 'portrait.jpg', { type: 'image/jpeg' }));

    assert.match(document.body.textContent ?? '', /portrait\.jpg/);
    assert.match(document.body.textContent ?? '', /1 KB/);
    assert.equal(titleInput.value, '窗边人物');
    assert.equal(getButton('胶片摄影').classList.contains('active'), true);
    assert.equal(getButton('高级').classList.contains('active'), true);
    assert.equal(getButton('人像摄影').classList.contains('active'), true);
    assert.match(document.body.textContent ?? '', /服务器默认不永久保存原图/);

    await uploadFile(fileInput, new File([new Uint8Array(2048)], 'portrait-new.webp', { type: 'image/webp' }));
    assert.match(document.body.textContent ?? '', /portrait-new\.webp/);
    assert.equal(titleInput.value, '窗边人物');

    await uploadFile(fileInput, new File([new Uint8Array(128)], 'portrait.gif', { type: 'image/gif' }));
    assert.match(document.querySelector('[role="alert"]')?.textContent ?? '', /仅支持 JPG、PNG 或 WebP/);
    assert.match(document.body.textContent ?? '', /portrait-new\.webp/);

    await click(getButton('移除照片'));
    assert.match(document.body.textContent ?? '', /等待选择影像文件/);
    assert.equal(titleInput.value, '窗边人物');
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('取消分析不会生成报告或写入历史', async () => {
  const environment = await renderApp();

  try {
    globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })) as typeof fetch;

    await click(getButton('开始点评'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await uploadFile(fileInput, new File([new Uint8Array(1024)], 'cancel.jpg', { type: 'image/jpeg' }));
    await click(getButton('开始分析'));
    await waitFor(() => (document.body.textContent ?? '').includes('正在连接分析服务'), '进入连接服务阶段');

    assert.match(document.body.textContent ?? '', /准备图片/);
    assert.match(document.body.textContent ?? '', /分析画面/);
    await click(getButton('取消分析'));
    await waitFor(() => (document.body.textContent ?? '').includes('分析已取消'), '显示取消状态');

    const records = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) ?? '[]');
    assert.equal(records.length, 0);
    assert.equal((document.body.textContent ?? '').includes('实时 AI 分析'), false);
    assert.equal((document.body.textContent ?? '').includes('示例报告'), false);
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('失败后的重试用实时报告替换示例记录', async () => {
  const environment = await renderApp();

  try {
    let requestCount = 0;
    globalThis.fetch = (async () => {
      requestCount += 1;
      if (requestCount === 1) throw new TypeError('network unavailable');
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, report: createAiReport() }),
      } as Response;
    }) as typeof fetch;

    await click(getButton('开始点评'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await uploadFile(fileInput, new File([new Uint8Array(1024)], 'retry.jpg', { type: 'image/jpeg' }));
    await click(getButton('开始分析'));
    await waitFor(() => (document.body.textContent ?? '').includes('示例报告'), '显示示例报告');
    await click(getButton('重试实时分析'));
    await waitFor(() => (document.body.textContent ?? '').includes('实时 AI 分析'), '重试后显示实时报告');
    await waitFor(() => {
      const records = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) ?? '[]');
      return records.length === 1 && records[0]?.reportSource === 'ai';
    }, '只保存一条实时报告记录');

    assert.equal(requestCount, 2);
    assert.match(document.body.textContent ?? '', /画面右侧边缘/);
    assert.match(document.body.textContent ?? '', /红伞与深色街景形成明确对比/);
    assert.match(document.body.textContent ?? '', /裁剪参考/);
    assert.match(document.body.textContent ?? '', /4:3/);
    assert.match(document.body.textContent ?? '', /评分依据/);
    assert.match(document.body.textContent ?? '', /主体明确，但右侧视觉重量偏高/);
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('历史管理模式可以选择两份记录并完成报告对比', async () => {
  const older = createHistoryRecord('older', '2026-01-01T10:00:00Z', -7);
  const middle = createHistoryRecord('middle', '2026-01-15T10:00:00Z', -3);
  const newer = createHistoryRecord('newer', '2026-02-01T10:00:00Z', 0);
  const environment = await renderApp([newer, middle, older]);

  try {
    await click(getButton('历史记录'));
    await click(getButton('管理上传'));
    await click(getButtons('选择对比')[0]);
    await click(getButtons('选择对比')[1]);
    assert.equal(getButtons('选择对比').length, 1);
    assert.equal(getButtons('选择对比')[0].disabled, true);
    await click(getButton('对比所选（2/2）'));

    assert.match(document.body.textContent ?? '', /两次摄影点评的变化/);
    assert.match(document.body.textContent ?? '', /较早街景/);
    assert.match(document.body.textContent ?? '', /较新街景/);
    assert.match(document.body.textContent ?? '', /综合评分变化/);
    assert.match(document.body.textContent ?? '', /\+7/);
    assert.match(document.body.textContent ?? '', /提升最多维度/);
    assert.match(document.body.textContent ?? '', /当前优先练习/);
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('旧历史记录缺少新增字段时仍能打开完整报告', async () => {
  const legacy = createHistoryRecord('legacy', '2025-12-01T10:00:00Z', -5);
  delete legacy.report.photoSpecific;
  delete legacy.report.scoreReasons;
  legacy.reportSource = 'legacy';
  const environment = await renderApp([legacy]);

  try {
    await click(getButton('历史记录'));
    const historyCard = document.querySelector('.history-card') as HTMLElement;
    await click(historyCard);

    assert.match(document.body.textContent ?? '', /历史报告/);
    assert.match(document.body.textContent ?? '', /值得保留/);
    assert.match(document.body.textContent ?? '', /画面区域/);
    assert.match(document.body.textContent ?? '', /评分依据/);
  } finally {
    await cleanupEnvironment(environment);
  }
});
