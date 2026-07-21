import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import type { HistoryRecord, Report } from '../src/types/report';

const HISTORY_STORAGE_KEY = 'photosense_history_records';
const HISTORY_SCHEMA_VERSION_KEY = 'photosense_history_schema_version';
const HISTORY_SCHEMA_VERSION = '2';
const HOME_INTRO_SEEN_KEY = 'photosense_home_intro_seen';
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

async function renderApp(
  historyRecords: HistoryRecord[] = [],
  historySchemaVersion = HISTORY_SCHEMA_VERSION,
  configureWindow?: () => void,
): Promise<TestEnvironment> {
  const dom = installDom();
  dom.window.localStorage.setItem(HISTORY_SCHEMA_VERSION_KEY, historySchemaVersion);
  dom.window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyRecords));
  configureWindow?.();
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

function getMainNavigation() {
  const navigation = document.querySelector('nav[aria-label="主导航"]');
  assert.ok(navigation, '没有找到主导航');
  return navigation as HTMLElement;
}

function getMainNavigationButton(label: string) {
  const button = [...getMainNavigation().querySelectorAll('button')].find((item) => item.textContent?.trim() === label);
  assert.ok(button, `主导航中没有找到按钮：${label}`);
  return button as HTMLButtonElement;
}

function assertCorePageHeading(pageLabel: string) {
  const main = document.querySelector('main');
  assert.ok(main, `${pageLabel} 没有 main 地标`);

  const firstLevelHeadings = main.querySelectorAll('h1');
  assert.equal(firstLevelHeadings.length, 1, `${pageLabel} 应有且仅有一个 h1`);

  const headings = [...main.querySelectorAll('h1, h2, h3, h4, h5, h6')];
  assert.ok(headings.length > 0, `${pageLabel} 没有标题`);
  assert.equal(headings[0].tagName, 'H1', `${pageLabel} 的首个标题应为 h1`);

  for (let index = 1; index < headings.length; index += 1) {
    const previousLevel = Number(headings[index - 1].tagName.slice(1));
    const currentLevel = Number(headings[index].tagName.slice(1));
    assert.ok(
      currentLevel <= previousLevel + 1,
      `${pageLabel} 标题层级从 h${previousLevel} 跳到 h${currentLevel}`,
    );
  }
}

function assertSelectionGroup(group: Element, expectedLabel: string) {
  const buttons = [...group.querySelectorAll('button')];
  assert.ok(buttons.length > 1, '选择组至少应包含两个按钮');
  buttons.forEach((button) => {
    assert.match(button.getAttribute('aria-pressed') ?? '', /^(true|false)$/, `${button.textContent?.trim()} 缺少 aria-pressed`);
  });

  const selectedButtons = buttons.filter((button) => button.getAttribute('aria-pressed') === 'true');
  assert.equal(selectedButtons.length, 1, '选择组应有且仅有一个已选按钮');
  assert.equal(selectedButtons[0].textContent?.trim(), expectedLabel);
}

function getHistoryReportControl(card: Element) {
  const control = [...card.querySelectorAll('a[href], button')].find((item) => {
    const accessibleText = `${item.getAttribute('aria-label') ?? ''} ${item.textContent ?? ''}`;
    return /(?:查看|打开).*报告/.test(accessibleText);
  });
  assert.ok(control, '历史卡片缺少明确的“查看报告”链接或按钮');
  return control as HTMLElement;
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
    critiqueLevel: '进阶水平',
    skillLevel: '进阶水平',
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

test('主导航只为当前页面设置 aria-current', async () => {
  const environment = await renderApp();

  try {
    const pageLabels = ['首页', '开始点评', '分析报告', '历史记录'];

    for (const pageLabel of pageLabels) {
      if (pageLabel !== '首页') await click(getMainNavigationButton(pageLabel));

      const navigationButtons = [...getMainNavigation().querySelectorAll('button')];
      const currentButtons = navigationButtons.filter((button) => button.getAttribute('aria-current') === 'page');
      assert.equal(currentButtons.length, 1, `${pageLabel} 应只有一个当前导航项`);
      assert.equal(currentButtons[0].textContent?.trim(), pageLabel);
      navigationButtons
        .filter((button) => button !== currentButtons[0])
        .forEach((button) => assert.equal(button.hasAttribute('aria-current'), false));
    }
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('四个核心页面都有单一 h1 且标题层级不跳级', async () => {
  const environment = await renderApp();

  try {
    const pageLabels = ['首页', '开始点评', '分析报告', '历史记录'];

    for (const pageLabel of pageLabels) {
      if (pageLabel !== '首页') await click(getMainNavigationButton(pageLabel));
      assertCorePageHeading(pageLabel);
    }
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('两档评价水平与历史筛选通过 aria-pressed 暴露当前选择', async () => {
  const environment = await renderApp();

  try {
    await click(getMainNavigationButton('开始点评'));

    const mediumGroup = document.querySelector('.medium-block .level-toggle');
    const skillGroup = document.querySelector('.skill-block .level-toggle');
    const genreGroup = document.querySelector('.genre-block .genre-orbit');
    assert.ok(mediumGroup);
    assert.ok(skillGroup);
    assert.ok(genreGroup);
    assertSelectionGroup(mediumGroup, '数码摄影');
    assertSelectionGroup(skillGroup, '爱好者水平');
    assert.deepEqual(
      [...skillGroup.querySelectorAll('button')].map((button) => button.textContent?.trim()),
      ['爱好者水平', '进阶水平'],
    );
    assertSelectionGroup(genreGroup, '街头摄影');

    await click(getButton('胶片摄影'));
    await click(getButton('进阶水平'));
    await click(getButton('人像摄影'));
    assertSelectionGroup(mediumGroup, '胶片摄影');
    assertSelectionGroup(skillGroup, '进阶水平');
    assertSelectionGroup(genreGroup, '人像摄影');

    await click(getMainNavigationButton('历史记录'));
    const historyFilterGroups = [...document.querySelectorAll('.history-filter-group')];
    assert.equal(historyFilterGroups.length, 2);
    assertSelectionGroup(historyFilterGroups[0], '全部');
    assertSelectionGroup(historyFilterGroups[1], '全部');

    await click(getButton('数码摄影'));
    await click(getButton('人像摄影'));
    assertSelectionGroup(historyFilterGroups[0], '数码摄影');
    assertSelectionGroup(historyFilterGroups[1], '人像摄影');
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('爱好者与进阶报告使用各自匹配的后期语言', async () => {
  const hobbyistRecord = {
    ...createHistoryRecord('hobbyist', '2026-02-01T10:00:00Z', 0),
    critiqueLevel: '爱好者水平' as const,
    skillLevel: '爱好者水平' as const,
  };
  const hobbyistEnvironment = await renderApp([hobbyistRecord]);

  try {
    await click(getMainNavigationButton('分析报告'));
    const parameters = document.querySelector('.post-preview-parameters')?.textContent ?? '';
    const adviceTitles = [...document.querySelectorAll('.post-processing-grid h3')].map((heading) => heading.textContent?.trim());

    assert.match(parameters, /整体明暗/);
    assert.match(parameters, /最亮区域/);
    assert.doesNotMatch(parameters, /曝光|高光|阴影|色温|饱和度|\bEV\b/);
    assert.deepEqual(adviceTitles, ['裁剪建议', '明暗调整建议', '局部提亮 / 压暗建议']);
  } finally {
    await cleanupEnvironment(hobbyistEnvironment);
  }

  const advancedEnvironment = await renderApp([createHistoryRecord('advanced', '2026-02-02T10:00:00Z', 0)]);

  try {
    await click(getMainNavigationButton('分析报告'));
    const parameters = document.querySelector('.post-preview-parameters')?.textContent ?? '';
    const adviceTitles = [...document.querySelectorAll('.post-processing-grid h3')].map((heading) => heading.textContent?.trim());

    assert.match(parameters, /曝光/);
    assert.match(parameters, /高光/);
    assert.deepEqual(adviceTitles, ['裁剪建议', '影调修改建议', '蒙版提亮 / 压暗建议']);
  } finally {
    await cleanupEnvironment(advancedEnvironment);
  }
});

test('历史卡片任意非控件区域和独立按钮都可打开报告', async () => {
  const record = createHistoryRecord('newer', '2026-02-01T10:00:00Z', 0);
  const environment = await renderApp([record]);

  try {
    await click(getMainNavigationButton('历史记录'));
    const card = document.querySelector('.history-card');
    assert.ok(card);

    const interactiveSelector = 'a[href], button, input, select, textarea, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])';
    assert.equal(card.matches(interactiveSelector), false, '历史卡片本身不应成为交互控件');
    [...card.querySelectorAll(interactiveSelector)].forEach((control) => {
      assert.equal(control.querySelector(interactiveSelector), null, '历史卡片内不应嵌套交互控件');
    });

    getHistoryReportControl(card);
    await click(card);
    assert.ok(document.querySelector('main.page-report'));
    assert.match(document.querySelector('.photo-meta-strip')?.textContent ?? '', /newer\.jpg/);
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('已有历史时分析报告入口打开最近记录并保持章节标题层级', async () => {
  const newer = createHistoryRecord('newer', '2026-02-01T10:00:00Z', 0);
  const older = createHistoryRecord('older', '2026-01-01T10:00:00Z', -7);
  const environment = await renderApp([newer, older]);

  try {
    await click(getMainNavigationButton('分析报告'));

    assertCorePageHeading('分析报告');
    assert.equal(getMainNavigationButton('分析报告').getAttribute('aria-current'), 'page');
    assert.match(document.querySelector('.photo-meta-strip')?.textContent ?? '', /newer\.jpg/);
    assert.doesNotMatch(document.querySelector('.photo-meta-strip')?.textContent ?? '', /older\.jpg/);

    for (const sectionId of ['report-overview', 'report-dimensions', 'report-post-processing', 'report-next-actions', 'report-context']) {
      const section = document.getElementById(sectionId);
      assert.ok(section, `缺少报告章节：${sectionId}`);
      const firstHeading = section.querySelector('h1, h2, h3, h4, h5, h6');
      assert.equal(firstHeading?.tagName, 'H2', `${sectionId} 应从 h2 开始`);
    }
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('上传、更换与移除照片时保留点评参数和标题', async () => {
  const environment = await renderApp();

  try {
    await click(getButton('开始点评'));
    await click(getButton('胶片摄影'));
    await click(getButton('进阶水平'));
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
    assert.equal(getButton('进阶水平').classList.contains('active'), true);
    assert.equal(getButton('人像摄影').classList.contains('active'), true);
    assert.doesNotMatch(document.body.textContent ?? '', /服务器默认不永久保存原图/);

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
    let analysisRequestCount = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (String(input).includes('/api/render-preview')) {
        return {
          ok: false,
          status: 503,
          json: async () => ({ ok: false, error: 'preview unavailable in this interaction test' }),
        } as Response;
      }
      analysisRequestCount += 1;
      if (analysisRequestCount === 1) throw new TypeError('network unavailable');
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

    assert.equal(analysisRequestCount, 2);
    assert.match(document.body.textContent ?? '', /画面右侧边缘/);
    assert.match(document.body.textContent ?? '', /红伞与深色街景形成明确对比/);
    assert.match(document.body.textContent ?? '', /裁剪参考/);
    assert.match(document.body.textContent ?? '', /4:3/);
    assert.match(document.body.textContent ?? '', /评分依据/);
    assert.match(document.body.textContent ?? '', /主体明确，但右侧视觉重量偏高/);

    const reportNavLabels = [...document.querySelectorAll('.report-side-nav a')].map((item) => item.textContent?.trim());
    assert.deepEqual(reportNavLabels, ['总览', '五维诊断', '后期建议', '下次行动', '补充说明']);
    const nextActionsSection = document.getElementById('report-next-actions');
    const contextSection = document.getElementById('report-context');
    assert.ok(nextActionsSection);
    assert.ok(contextSection);
    assert.equal(nextActionsSection.compareDocumentPosition(contextSection) & window.Node.DOCUMENT_POSITION_FOLLOWING, window.Node.DOCUMENT_POSITION_FOLLOWING);
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('高置信度题材不一致时显示非阻断纠错提示', async () => {
  const environment = await renderApp();

  try {
    const report = createAiReport();
    report.genreAssessment = {
      detectedGenre: '街头摄影',
      confidence: 0.91,
      reason: '行人与街道环境共同构成现场关系。',
    };
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (String(input).includes('/api/render-preview')) {
        return {
          ok: false,
          status: 503,
          json: async () => ({ ok: false, error: 'preview unavailable in this interaction test' }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, report }),
      } as Response;
    }) as typeof fetch;

    await click(getButton('开始点评'));
    await click(getButton('人像摄影'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await uploadFile(fileInput, new File([new Uint8Array(1024)], 'street-as-portrait.jpg', { type: 'image/jpeg' }));
    await click(getButton('开始分析'));
    await waitFor(() => Boolean(document.querySelector('.report-genre-warning')), '显示题材核对提示');

    const warning = document.querySelector('.report-genre-warning');
    assert.match(warning?.textContent ?? '', /你选择了「人像摄影」，画面更接近「街头摄影」/);
    assert.match(warning?.textContent ?? '', /判断置信度 91%/);
    assert.ok(getButton('调整题材后重新分析'));
    assert.match(document.body.textContent ?? '', /实时 AI 分析/);
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('历史对比模式可以选择两份记录并完成报告对比', async () => {
  const older = createHistoryRecord('older', '2026-01-01T10:00:00Z', -7);
  const middle = createHistoryRecord('middle', '2026-01-15T10:00:00Z', -3);
  const newer = createHistoryRecord('newer', '2026-02-01T10:00:00Z', 0);
  const environment = await renderApp([newer, middle, older]);

  try {
    await click(getButton('历史记录'));
    await click(getButton('对比记录'));
    await click(getButtons('选择对比')[0]);
    await click(getButtons('选择对比')[1]);
    assert.equal(getButtons('选择对比').length, 1);
    assert.equal(getButtons('选择对比')[0].disabled, true);
    await click(getButton('查看对比（2/2）'));

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

test('历史记录把管理与对比分成互斥的独立入口', async () => {
  const first = createHistoryRecord('first', '2026-01-01T10:00:00Z', -4);
  const second = createHistoryRecord('second', '2026-02-01T10:00:00Z', 0);
  const environment = await renderApp([second, first]);

  try {
    await click(getButton('历史记录'));
    const headerActions = document.querySelector('.history-header-actions');
    assert.ok(headerActions);
    assert.equal(headerActions.querySelectorAll('button').length, 2);
    assert.ok(getButton('管理记录'));
    assert.ok(getButton('对比记录'));

    await click(getButton('管理记录'));
    assert.equal(getButtons('删除').length, 2);
    assert.equal(getButtons('选择对比').length, 0);

    await click(getButton('完成管理'));
    await click(getButton('对比记录'));
    assert.equal(getButtons('删除').length, 0);
    assert.equal(getButtons('选择对比').length, 2);
    assert.match(document.body.textContent ?? '', /当前已选 0\/2/);
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('评价体系升级时清空旧标准下的历史记录', async () => {
  const legacyRecord = createHistoryRecord('legacy', '2026-02-01T10:00:00Z', 0);
  const environment = await renderApp([legacyRecord], '1');

  try {
    await click(getMainNavigationButton('历史记录'));
    assert.match(document.body.textContent ?? '', /暂无历史记录/);
    assert.equal(localStorage.getItem(HISTORY_SCHEMA_VERSION_KEY), HISTORY_SCHEMA_VERSION);
    assert.deepEqual(JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) ?? '[]'), []);
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('首页流程先上传照片再选择照片属性', async () => {
  const environment = await renderApp();

  try {
    const steps = [...document.querySelectorAll('.home-flow-panel .flow-steps li')];
    assert.equal(document.querySelector('.hero-capability-line'), null);
    assert.equal(steps.length, 4);
    assert.equal(steps[0]?.querySelector('strong')?.textContent?.trim(), '上传一张照片');
    assert.equal(steps[1]?.querySelector('strong')?.textContent?.trim(), '选择照片属性');
    assert.equal(steps[3]?.querySelector('strong')?.textContent?.trim(), '复盘分析记录');
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('首页首次访问三秒后隐藏介绍，回到首页时保持照片墙', async () => {
  let autoHide: (() => void) | undefined;
  const environment = await renderApp([], HISTORY_SCHEMA_VERSION, () => {
    window.setTimeout = ((handler: TimerHandler, delay?: number) => {
      if (delay === 3_000 && typeof handler === 'function') autoHide = () => (handler as () => void)();
      return 1 as unknown as number;
    }) as typeof window.setTimeout;
  });

  try {
    assert.equal(document.querySelector('.home-intro-content')?.hasAttribute('hidden'), false, '首次访问应先显示介绍');
    assert.ok(autoHide, '首次访问应安排三秒自动隐藏');

    await act(async () => autoHide?.());
    assert.equal(document.querySelector('.home-intro-content')?.hasAttribute('hidden'), true);
    assert.equal(localStorage.getItem(HOME_INTRO_SEEN_KEY), 'true');

    await click(getMainNavigationButton('开始点评'));
    await click(getMainNavigationButton('首页'));
    assert.equal(document.querySelector('.home-intro-content')?.hasAttribute('hidden'), true, '再次进入首页应保持照片墙');
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('首页照片列表在悬停、聚焦和点击时同步切换大图与示例报告', async () => {
  const environment = await renderApp();

  try {
    const mainImage = document.querySelector('.home-showcase-image') as HTMLImageElement;
    const reportPreview = document.querySelector('.home-report-preview');
    const photoButtons = [...document.querySelectorAll('.home-photo-choice:not([data-duplicate="true"])')] as HTMLButtonElement[];

    assert.ok(mainImage);
    assert.ok(reportPreview);
    assert.equal(photoButtons.length, 8);
    assert.equal(document.querySelectorAll('.home-collage-card').length, 23);
    assert.ok(document.querySelector('.home-collage-card.is-collage-front'));
    assert.equal(document.querySelectorAll('.home-photo-choice[data-duplicate="true"]').length, 8);
    assert.equal(document.querySelector('.home-photo-browser-heading'), null);
    assert.equal(document.querySelector('.home-showcase-frame'), null);
    assert.equal(document.querySelectorAll('.home-showcase-caption span').length, 1);
    assert.equal(document.querySelectorAll('.home-photo-choice span').length, 0);
    assert.match(mainImage.src, /photo-01\.jpg$/);
    assert.match(reportPreview.textContent ?? '', /78/);
    assert.match(reportPreview.textContent ?? '', /分析结果/);
    assert.match(reportPreview.textContent ?? '', /微调建议/);
    assert.doesNotMatch(reportPreview.textContent ?? '', /最新分析报告|交互示例|优先行动|PS\s*\d+/i);
    assert.equal(photoButtons[0]?.getAttribute('aria-pressed'), 'true');
    assert.doesNotMatch(document.body.textContent ?? '', /看见画面.*再决定下一步/);
    assert.doesNotMatch(document.body.textContent ?? '', /口径/);

    await act(async () => {
      photoButtons[1]?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    assert.match(mainImage.src, /photo-07\.jpg$/);
    assert.match(reportPreview.textContent ?? '', /82/);
    assert.equal(photoButtons[1]?.getAttribute('aria-pressed'), 'true');

    await act(async () => photoButtons[2]?.focus());
    assert.match(mainImage.src, /photo-15\.jpg$/);
    assert.match(reportPreview.textContent ?? '', /74/);

    await click(photoButtons[3]);
    assert.match(mainImage.src, /photo-22\.jpg$/);
    assert.match(reportPreview.textContent ?? '', /80/);

    await click(photoButtons[7]);
    assert.match(mainImage.src, /photo-23\.jpg$/);
    assert.match(reportPreview.textContent ?? '', /81/);

    const contentToggle = document.querySelector<HTMLButtonElement>('button[aria-label="隐藏介绍"]');
    assert.ok(contentToggle);
    assert.ok(contentToggle.querySelector('svg'));
    assert.equal(contentToggle.textContent?.trim(), '');
    assert.equal(contentToggle.getAttribute('aria-expanded'), 'true');
    await click(contentToggle);
    assert.equal(document.querySelector('.home-intro-content')?.hasAttribute('hidden'), true);
    const collageCards = [...document.querySelectorAll<HTMLButtonElement>('.home-collage-card')];
    assert.equal(document.querySelector('.home-gallery-focus'), null, '进入照片墙时应先保留完整墙面预览');
    assert.equal(collageCards.length, 23);

    for (const card of collageCards) {
      await click(card);
      const galleryResult = document.querySelector('.home-gallery-result');
      assert.ok(galleryResult);
      assert.match(galleryResult.textContent ?? '', /\d{2,3}\/100/);
      assert.doesNotMatch(galleryResult.textContent ?? '', /待分析|暂不可用/);
    }

    assert.match(document.querySelector<HTMLImageElement>('.home-gallery-focus-image')?.src ?? '', /photo-34\.jpg$/);
    const closeGalleryButton = document.querySelector<HTMLButtonElement>('button[aria-label="关闭照片分析"]');
    assert.ok(closeGalleryButton);
    await click(closeGalleryButton);
    assert.equal(document.querySelector('.home-gallery-focus'), null);

    await click(collageCards[1]);
    assert.match(document.querySelector<HTMLImageElement>('.home-gallery-focus-image')?.src ?? '', /photo-07\.jpg$/);
    await click(document.querySelector('.home-gallery-background') as HTMLElement);
    assert.equal(document.querySelector('.home-gallery-focus'), null, '点击照片墙背景应关闭单图分析');

    const showContentToggle = document.querySelector<HTMLButtonElement>('button[aria-label="显示介绍"]');
    assert.ok(showContentToggle);
    assert.equal(showContentToggle.getAttribute('aria-expanded'), 'false');
    await click(showContentToggle);
    assert.equal(document.querySelector('.home-intro-content')?.hasAttribute('hidden'), false);

    const firstCollageCard = document.querySelector('.home-collage-card') as HTMLElement;
    await act(async () => firstCollageCard.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
    assert.ok(document.querySelector('.page-home')?.classList.contains('is-collage-paused'));
    await act(async () => firstCollageCard.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })));
    assert.equal(document.querySelector('.page-home')?.classList.contains('is-collage-paused'), false);
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('分析报告仅提供图片导出与文字复制，并可选择简易或详细报告', async () => {
  const record = createHistoryRecord('export', '2026-02-01T10:00:00Z', 0);
  const environment = await renderApp([record]);

  try {
    await click(getButton('分析报告'));
    assert.ok(getButton('导出报告图片'));
    assert.ok(getButton('复制报告文字'));
    assert.equal(getButtons('点评新照片').length, 0);
    assert.equal(getButtons('返回历史记录').length, 0);
    assert.match(document.querySelector('#export-report-help')?.textContent ?? '', /以图片形式导出报告，可选择简易报告或详细报告/);
    assert.match(document.querySelector('#copy-report-help')?.textContent ?? '', /将文字版报告复制至剪贴板/);

    await click(getButton('导出报告图片'));
    const exportOptions = [...document.querySelectorAll<HTMLButtonElement>('.report-export-menu button')];
    assert.equal(exportOptions.length, 2);
    assert.match(exportOptions[0].textContent ?? '', /简易报告/);
    assert.match(exportOptions[1].textContent ?? '', /详细报告/);
    assert.match(exportOptions[1].textContent ?? '', /单张长图/);
    assert.doesNotMatch(exportOptions[1].textContent ?? '', /3–4 页|分为/);
    assert.equal(getButtons('分享').length, 0);
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
    await click(getHistoryReportControl(historyCard));

    assert.match(document.body.textContent ?? '', /历史报告/);
    assert.match(document.body.textContent ?? '', /值得保留/);
    assert.match(document.body.textContent ?? '', /画面区域/);
    assert.match(document.body.textContent ?? '', /评分依据/);
  } finally {
    await cleanupEnvironment(environment);
  }
});
