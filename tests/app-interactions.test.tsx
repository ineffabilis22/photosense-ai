import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import type { HistoryRecord, Report } from '../src/types/report';

const HISTORY_STORAGE_KEY = 'photosense_history_records';
const HISTORY_SCHEMA_VERSION_KEY = 'photosense_history_schema_version';
const HISTORY_SCHEMA_VERSION = '3';
const imageDataUrl = 'data:image/jpeg;base64,/9j/2Q==';

type RenderOptions = {
  revealInitialHome?: boolean;
};

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
  options: RenderOptions = {},
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

  if (options.revealInitialHome !== false) {
    const revealButton = dom.window.document.querySelector<HTMLButtonElement>('button[aria-label="显示介绍"]');
    if (revealButton) {
      await act(async () => revealButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
    }
  }

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
    scoreVersion: 'v3',
    scoreBands: { 构图: '成立', 光线: '成立', 色彩: '强', 叙事: '成立', 技术完成度: '成立' },
    improvementPriority: 'optional',
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
    scoreVersion: report.scoreVersion,
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

test('主导航切页使用页面渐入，并在切页时更新主内容', async () => {
  const environment = await renderApp([], HISTORY_SCHEMA_VERSION, undefined, { revealInitialHome: false });

  try {
    await click(getMainNavigationButton('开始点评'));
    assert.ok(document.querySelector('.app-shell')?.classList.contains('is-page-entering'));
    assert.ok(document.querySelector('.page-review'));

    await click(getMainNavigationButton('历史记录'));
    assert.ok(document.querySelector('.app-shell')?.classList.contains('is-page-entering'));
    assert.ok(document.querySelector('.history-page'));
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

test('不同水平报告显示对应的优化建议，并隐藏实现参数', async () => {
  const hobbyistRecord = {
    ...createHistoryRecord('hobbyist', '2026-02-01T10:00:00Z', 0),
    critiqueLevel: '爱好者水平' as const,
    skillLevel: '爱好者水平' as const,
  };
  const hobbyistEnvironment = await renderApp([hobbyistRecord]);

  try {
    await click(getMainNavigationButton('分析报告'));
    const adviceTitles = [...document.querySelectorAll('.post-preview-copy h4')].map((heading) => heading.textContent?.trim());

    assert.equal(document.querySelector('.post-preview-parameters'), null);
    assert.equal(document.querySelector('.post-preview-tone-plan'), null);
    assert.deepEqual(adviceTitles, ['从右侧轻微裁切。', '压低路面最亮区域。', '轻提人物面部。']);
  } finally {
    await cleanupEnvironment(hobbyistEnvironment);
  }

  const advancedEnvironment = await renderApp([createHistoryRecord('advanced', '2026-02-02T10:00:00Z', 0)]);

  try {
    await click(getMainNavigationButton('分析报告'));
    const adviceTitles = [...document.querySelectorAll('.post-preview-copy h4')].map((heading) => heading.textContent?.trim());

    assert.equal(document.querySelector('.post-preview-parameters'), null);
    assert.equal(document.querySelector('.post-preview-tone-plan'), null);
    assert.deepEqual(adviceTitles, ['从右侧轻微裁切。', '压低路面高光。', '轻提人物面部。']);
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
    assert.equal(document.querySelector('.report-score-context'), null);
    assert.doesNotMatch(document.querySelector('.report-score-block')?.textContent ?? '', /学习参考/);

    for (const sectionId of ['report-overview', 'report-dimensions', 'report-post-processing', 'report-context']) {
      const section = document.getElementById(sectionId);
      assert.ok(section, `缺少报告章节：${sectionId}`);
      const firstHeading = section.querySelector('h1, h2, h3, h4, h5, h6');
      assert.equal(firstHeading?.tagName, 'H2', `${sectionId} 应从 h2 开始`);
    }
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('报告后的预览降级时不向用户暴露实现说明', async () => {
  const originalFetch = globalThis.fetch;
  const environment = await renderApp([createHistoryRecord('preview-fallback', '2026-02-01T10:00:00Z', 0)]);
  let previewRequestCount = 0;

  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (String(input).includes('/api/render-preview')) previewRequestCount += 1;
      return {
        ok: false,
        status: 503,
        json: async () => ({ ok: false, error: 'preview unavailable in this interaction test' }),
      } as Response;
    }) as typeof fetch;

    await click(getMainNavigationButton('分析报告'));
    await waitFor(() => previewRequestCount === 1, '请求后期预览');
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    const previewText = document.querySelector('.post-preview-panel')?.textContent ?? '';
    assert.match(previewText, /优化预览/);
    assert.match(previewText, /保存预览/);
    assert.doesNotMatch(previewText, /报告生成后开始加载|当前为示例结果|真实分析结论|红色表示|绿色表示|整体明暗|明暗差异|照片专属|效果示意已更新|调整示意|服务器|Sharp|Canvas|降级预览|完整画幅预览(?:仅|只)应用|不会切割/);
    assert.equal(document.querySelector('.post-preview-note'), null);
  } finally {
    globalThis.fetch = originalFetch;
    await cleanupEnvironment(environment);
  }
});

test('优化图生成期间显示可理解的等待状态，完成后确认成功并可切换修改前后', async () => {
  const originalFetch = globalThis.fetch;
  const environment = await renderApp(
    [createHistoryRecord('comparison-toggle', '2026-02-01T10:00:00Z', 0)],
    HISTORY_SCHEMA_VERSION,
    () => {
      const nativeSetTimeout = window.setTimeout.bind(window);
      window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => nativeSetTimeout(
        handler,
        delay === 30_000 ? 0 : delay,
        ...args,
      )) as typeof window.setTimeout;
    },
  );
  const optimizedImageUrl = 'data:image/png;base64,b3B0aW1pemVk';
  const regeneratedImageUrl = 'data:image/png;base64,cmVnZW5lcmF0ZWQ=';
  let resolveOptimizedImage!: (response: Response) => void;
  let optimizedImageRequestCount = 0;
  let optimizedImageRequestBody: { nextShooting?: Report['nextShooting'] } = {};

  try {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/api/generate-optimized-image')) {
        optimizedImageRequestCount += 1;
        optimizedImageRequestBody = JSON.parse(String(init?.body ?? '{}')) as { nextShooting?: Report['nextShooting'] };
        if (optimizedImageRequestCount > 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ ok: true, imageUrl: regeneratedImageUrl, provider: 'image-relay' }),
          } as Response;
        }
        return new Promise<Response>((resolve) => {
          resolveOptimizedImage = resolve;
        });
      }

      if (String(input).includes('/api/render-preview')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            preview: {
              imageDataUrl,
              width: 1200,
              height: 800,
              appliedRecipe: createAiReport().previewAdjustments,
            },
          }),
        } as Response;
      }

      throw new Error(`Unexpected request: ${String(input)}`);
    }) as typeof fetch;

    await click(getMainNavigationButton('分析报告'));
    await waitFor(() => Boolean(document.querySelector('.post-preview-loading-overlay')), '优化图生成遮罩');

    const previewImage = document.querySelector<HTMLImageElement>('.post-preview-image img');
    assert.ok(previewImage);
    assert.equal(previewImage.src, imageDataUrl);
    assert.match(document.querySelector('.post-preview-status')?.textContent ?? '', /生成中/);
    await waitFor(() => document.querySelector('.post-preview-loading-overlay')?.textContent?.includes('仍在生成优化后照片') === true, '长等待提示');
    assert.match(document.querySelector('.post-preview-loading-overlay')?.textContent ?? '', /仍在生成优化后照片/);
    assert.match(document.querySelector('.post-preview-loading-overlay')?.textContent ?? '', /完成后会自动显示/);
    assert.doesNotMatch(document.querySelector('.post-preview-loading-overlay')?.textContent ?? '', /API|模型|服务端|接口|请求|队列|渲染|响应|超时/);
    assert.equal(document.querySelector('.post-preview-comparison-toggle'), null);
    assert.equal((getButton('保存预览') as HTMLButtonElement).disabled, true);
    await waitFor(() => optimizedImageRequestCount === 1, '优化图片请求开始');
    assert.deepEqual(optimizedImageRequestBody.nextShooting, createAiReport().nextShooting, '图片生成请求应包含同一现场的再拍建议');
    const integratedAdvice = document.querySelector('.post-preview-next-shot');
    assert.match(integratedAdvice?.textContent ?? '', /如果当时再拍一次/);
    assert.match(integratedAdvice?.textContent ?? '', /继续观察人物与灯光关系/);
    assert.match(integratedAdvice?.textContent ?? '', /等待动作更完整/);

    await act(async () => {
      resolveOptimizedImage({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, imageUrl: optimizedImageUrl, provider: 'image-relay' }),
      } as Response);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => Boolean(document.querySelector('.post-preview-comparison-toggle')), '修改前后切换按钮');
    assert.match(document.querySelector('.post-preview-status')?.textContent ?? '', /已完成/);
    assert.match(document.querySelector('.post-preview-success-overlay')?.textContent ?? '', /优化后照片已生成/);
    assert.match(document.querySelector('.post-preview-completion-note')?.textContent ?? '', /优化后照片已生成/);
    assert.match(document.querySelector('.post-preview-completion-note')?.textContent ?? '', /修改前.*修改后/);
    assert.equal((getButton('保存预览') as HTMLButtonElement).disabled, false);
    assert.ok(getButton('重新生成'));
    assert.ok(document.querySelector('.post-preview-button-row button'));
    assert.ok(document.querySelector('.post-preview-image .post-preview-actions'));
    const postPreviewActions = document.querySelector('.post-preview-actions');
    assert.equal(postPreviewActions?.firstElementChild?.classList.contains('post-preview-completion-note'), true);
    assert.equal(postPreviewActions?.lastElementChild?.classList.contains('post-preview-button-row'), true);
    await waitFor(() => JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) ?? '[]')[0]?.optimizedImageUrl === optimizedImageUrl, '优化图写入报告记录');

    const beforeButton = getButton('修改前');
    const afterButton = getButton('修改后');
    assert.equal(beforeButton.getAttribute('aria-pressed'), 'false');
    assert.equal(afterButton.getAttribute('aria-pressed'), 'true');
    assert.equal(previewImage.src, optimizedImageUrl);

    await click(beforeButton);
    assert.equal(beforeButton.getAttribute('aria-pressed'), 'true');
    assert.equal(afterButton.getAttribute('aria-pressed'), 'false');
    assert.equal(previewImage.src, imageDataUrl);

    await click(afterButton);
    assert.equal(afterButton.getAttribute('aria-pressed'), 'true');
    assert.equal(previewImage.src, optimizedImageUrl);

    await click(getMainNavigationButton('首页'));
    await click(getMainNavigationButton('分析报告'));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    assert.equal(optimizedImageRequestCount, 1, '重新进入报告时应直接读取已保存的优化图');
    assert.equal(document.querySelector<HTMLImageElement>('.post-preview-image img')?.src, optimizedImageUrl);

    await click(getButton('重新生成'));
    await waitFor(() => optimizedImageRequestCount === 2, '用户主动重新生成优化图');
    await waitFor(() => JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) ?? '[]')[0]?.optimizedImageUrl === regeneratedImageUrl, '新优化图覆盖旧结果');
    assert.equal(document.querySelector<HTMLImageElement>('.post-preview-image img')?.src, regeneratedImageUrl);
  } finally {
    globalThis.fetch = originalFetch;
    await cleanupEnvironment(environment);
  }
});

test('优化图未能生成时保持结果边界并提供重新生成', async () => {
  const originalFetch = globalThis.fetch;
  const environment = await renderApp([createHistoryRecord('optimized-image-error', '2026-02-01T10:00:00Z', 0)]);

  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (String(input).includes('/api/generate-optimized-image')) {
        return {
          ok: false,
          status: 503,
          json: async () => ({ error: 'provider unavailable' }),
        } as Response;
      }

      if (String(input).includes('/api/render-preview')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            preview: {
              imageDataUrl: 'data:image/webp;base64,bG9jYWwtcHJldmlldw==',
              width: 1200,
              height: 800,
              appliedRecipe: createAiReport().previewAdjustments,
            },
          }),
        } as Response;
      }

      throw new Error(`Unexpected request: ${String(input)}`);
    }) as typeof fetch;

    await click(getMainNavigationButton('分析报告'));
    await waitFor(() => document.querySelector('.post-preview-status')?.textContent?.includes('暂未完成') === true, '优化图失败状态');

    const previewImage = document.querySelector<HTMLImageElement>('.post-preview-image img');
    assert.ok(previewImage);
    assert.equal(previewImage.src, imageDataUrl, '失败时应以明确遮罩覆盖原图，不能把普通预览当作优化结果');
    assert.match(document.querySelector('.post-preview-error-overlay')?.textContent ?? '', /优化后照片暂时未生成/);
    assert.match(document.querySelector('.post-preview-error-overlay')?.textContent ?? '', /文字报告仍可正常查看/);
    assert.ok(getButton('重新生成'));
    assert.equal((getButton('保存预览') as HTMLButtonElement).disabled, true);
    assert.doesNotMatch(document.querySelector('.post-preview-panel')?.textContent ?? '', /API|模型|服务端|接口|请求|队列|渲染|响应|报错|超时/);
  } finally {
    globalThis.fetch = originalFetch;
    await cleanupEnvironment(environment);
  }
});

test('上传与分析阶段不请求后期预览，报告渲染后才开始生成', async () => {
  const environment = await renderApp();
  let previewRequestCount = 0;
  let optimizedImageRequestCount = 0;
  let reportWasPaintedAtRequest = false;
  let reportWasPaintedAtOptimizedImageRequest = false;

  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (String(input).includes('/api/render-preview')) {
        previewRequestCount += 1;
        reportWasPaintedAtRequest = Boolean(document.querySelector('.diagnostic-report'));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            preview: {
              imageDataUrl,
              width: 1200,
              height: 800,
              appliedRecipe: createAiReport().previewAdjustments,
            },
            toneProfile: {
              tone: createAiReport().postProcessing?.tone,
            },
          }),
        } as Response;
      }

      if (String(input).includes('/api/generate-optimized-image')) {
        optimizedImageRequestCount += 1;
        reportWasPaintedAtOptimizedImageRequest = Boolean(document.querySelector('.diagnostic-report'));
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, imageUrl: imageDataUrl, provider: 'image-relay' }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, report: createAiReport() }),
      } as Response;
    }) as typeof fetch;

    await click(getButton('开始点评'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await uploadFile(fileInput, new File([new Uint8Array(1024)], 'after-report.jpg', { type: 'image/jpeg' }));
    assert.equal(previewRequestCount, 0);
    assert.equal(optimizedImageRequestCount, 0);

    await click(getButton('开始分析'));
    await waitFor(() => Boolean(document.querySelector('.diagnostic-report')), '报告生成');
    await waitFor(() => previewRequestCount === 1, '报告后的后期预览请求');
    await waitFor(() => optimizedImageRequestCount === 1, '报告后的图片优化请求');
    assert.equal(reportWasPaintedAtRequest, true);
    assert.equal(reportWasPaintedAtOptimizedImageRequest, true);
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

    const frameMetadata = document.querySelector('.frame-metadata');
    assert.equal(frameMetadata?.getAttribute('aria-label'), '照片属性');
    const frameMetadataItems = [...(frameMetadata?.querySelectorAll('span') ?? [])].map((item) => item.textContent?.trim());
    assert.deepEqual(frameMetadataItems.slice(0, 3), ['胶片摄影', '进阶水平', '人像摄影']);
    assert.equal(frameMetadataItems.length, 4);
    assert.match(frameMetadataItems[3] ?? '', /\d{4}/);
    assert.doesNotMatch(frameMetadata?.textContent ?? '', /已上传|尚未选择文件|portrait\.jpg/);

    await uploadFile(fileInput, new File([new Uint8Array(2048)], 'portrait-new.webp', { type: 'image/webp' }));
    assert.match(document.body.textContent ?? '', /portrait-new\.webp/);
    assert.equal(titleInput.value, '窗边人物');
    assert.doesNotMatch(frameMetadata?.textContent ?? '', /portrait-new\.webp/);

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
    await waitFor(() => (document.body.textContent ?? '').includes('正在准备分析'), '进入分析准备阶段');

    assert.match(document.body.textContent ?? '', /准备照片/);
    assert.match(document.body.textContent ?? '', /分析画面/);
    await click(getButton('取消分析'));
    await waitFor(() => (document.body.textContent ?? '').includes('分析已取消'), '显示取消状态');

    const records = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) ?? '[]');
    assert.equal(records.length, 0);
    assert.equal((document.body.textContent ?? '').includes('实时结果'), false);
    assert.equal((document.body.textContent ?? '').includes('示例结果'), false);
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
    await waitFor(() => (document.body.textContent ?? '').includes('示例结果'), '显示示例结果');
    await click(getButton('重新生成结果'));
    await waitFor(() => (document.body.textContent ?? '').includes('实时结果'), '重试后显示实时结果');
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
    assert.doesNotMatch(document.body.textContent ?? '', /连接分析服务|分析服务|实时 AI 分析|评价基准|评分侧重|冷启动/);

    const reportNavLabels = [...document.querySelectorAll('.report-side-nav a')].map((item) => item.textContent?.trim());
    assert.deepEqual(reportNavLabels, ['评审结论', '五维诊断', '优化建议', '评审依据']);
    assert.equal(document.querySelector('.report-side-nav .panel-kicker'), null);
    assert.equal(document.querySelector('#report-dimensions .report-title-row h2')?.textContent, '五维诊断');
    assert.equal(document.querySelector('#report-post-processing .report-title-row h2')?.textContent, '优化建议');
    const mergedVerdictNotes = document.querySelector('.report-verdict-notes');
    assert.equal(mergedVerdictNotes?.classList.contains('is-merged'), true);
    assert.equal(mergedVerdictNotes?.children.length, 1);
    assert.equal(mergedVerdictNotes?.querySelector('span')?.textContent?.trim(), '优化建议');
    assert.doesNotMatch(mergedVerdictNotes?.textContent ?? '', /待优化|本张先改/);
    assert.equal(document.getElementById('report-next-actions'), null, '下次拍摄不应继续作为独立章节');
    assert.equal(document.querySelector('#report-context .report-title-row h2')?.textContent, '评审依据');
    assert.equal(document.querySelector('#report-context .review-context-head .panel-kicker'), null);
    assert.equal(document.querySelector('.post-preview-heading .panel-kicker'), null);
    assert.equal(document.querySelector('.diagnostic-card .report-title-row .panel-kicker'), null);
    const integratedNextActions = document.querySelector('#report-post-processing .post-preview-next-shot');
    const postProcessingSection = document.getElementById('report-post-processing');
    const contextSection = document.getElementById('report-context');
    assert.ok(integratedNextActions);
    assert.ok(postProcessingSection);
    assert.ok(contextSection);
    const contextDescriptions = [...document.querySelectorAll('#report-context .review-context-card dd')].map((item) => item.textContent?.trim() ?? '');
    assert.match(contextDescriptions[0], /^数码摄影会/);
    assert.match(contextDescriptions[1], /^爱好者水平会/);
    assert.match(contextDescriptions[2], /^街头摄影重点/);
    assert.match(contextDescriptions[3], /^街头摄影会/);
    assert.doesNotMatch(contextDescriptions.join(' '), /这次/);
    assert.equal(postProcessingSection.compareDocumentPosition(contextSection) & window.Node.DOCUMENT_POSITION_FOLLOWING, window.Node.DOCUMENT_POSITION_FOLLOWING);
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
    assert.equal(warning?.querySelector('.report-genre-warning-label')?.textContent?.trim(), '题材核对');
    assert.equal(warning?.querySelector('.report-genre-warning-label b'), null);
    assert.ok(getButton('调整题材后重新分析'));
    assert.match(document.body.textContent ?? '', /实时结果/);
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('历史记录只保留管理入口，并在管理模式显示删除按钮', async () => {
  const first = createHistoryRecord('first', '2026-01-01T10:00:00Z', -4);
  const second = createHistoryRecord('second', '2026-02-01T10:00:00Z', 0);
  const environment = await renderApp([second, first]);

  try {
    await click(getButton('历史记录'));
    const headerActions = document.querySelector('.history-header-actions');
    assert.ok(headerActions);
    assert.equal(headerActions.querySelectorAll('button').length, 1);
    assert.ok(getButton('管理记录'));
    assert.equal(getButtons('对比记录').length, 0);

    await click(getButton('管理记录'));
    assert.equal(getButtons('删除').length, 2);
    assert.match(document.body.textContent ?? '', /删除后不可恢复/);

    await click(getButton('完成管理'));
    assert.equal(getButtons('删除').length, 0);
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

test('v2 历史记录升级到 v3 时保留，但不展示规则元数据', async () => {
  const legacyRecord = createHistoryRecord('legacy-v2', '2026-02-01T10:00:00Z', 0);
  delete legacyRecord.scoreVersion;
  delete legacyRecord.report.scoreVersion;
  const environment = await renderApp([legacyRecord], '2');

  try {
    await click(getMainNavigationButton('历史记录'));
    assert.doesNotMatch(document.body.textContent ?? '', /暂无历史记录/);
    assert.doesNotMatch(document.body.textContent ?? '', /本次规则|历史规则/);
    assert.equal(localStorage.getItem(HISTORY_SCHEMA_VERSION_KEY), HISTORY_SCHEMA_VERSION);
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('历史记录会将旧的默认复盘标题迁移为摄影标题', async () => {
  const legacyRecord = createHistoryRecord('legacy-title', '2026-02-01T10:00:00Z', 0);
  legacyRecord.title = '街头摄影复盘 · 02月01日';
  const environment = await renderApp([legacyRecord]);

  try {
    await click(getMainNavigationButton('历史记录'));
    assert.match(document.body.textContent ?? '', /街头摄影 · 02月01日/);
    assert.doesNotMatch(document.body.textContent ?? '', /街头摄影复盘 · 02月01日/);
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('首次打开时移除已确认的测试上传记录，但保留其他历史记录', async () => {
  const testRecord = createHistoryRecord('test-upload', '2026-09-13T10:00:00Z', 0);
  testRecord.title = '789789';
  testRecord.fileName = '_DSC6793.jpg';
  testRecord.date = '2026年9月13日';
  const realRecord = createHistoryRecord('real-record', '2026-09-12T10:00:00Z', 0);
  const environment = await renderApp([testRecord, realRecord]);

  try {
    await click(getMainNavigationButton('历史记录'));
    assert.equal(document.querySelectorAll('.history-card').length, 1);
    assert.doesNotMatch(document.body.textContent ?? '', /789789|_DSC6793\.jpg/);
    assert.match(document.body.textContent ?? '', /real-record\.jpg/);
    assert.equal(JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) ?? '[]').some((record: HistoryRecord) => record.title === '789789'), false);
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('高完成度报告允许明确显示无明显问题', async () => {
  const strongRecord = createHistoryRecord('strong', '2026-02-01T10:00:00Z', 10);
  strongRecord.overallScore = 88;
  strongRecord.report.scores = { 构图: 95, 光线: 85, 色彩: 85, 叙事: 85, 技术完成度: 85 };
  strongRecord.report.scoreBands = { 构图: '作品级', 光线: '强', 色彩: '强', 叙事: '强', 技术完成度: '强' };
  strongRecord.report.improvementPriority = 'none';
  const environment = await renderApp([strongRecord]);

  try {
    await click(getMainNavigationButton('历史记录'));
    await click(getHistoryReportControl(document.querySelector('.history-card') as Element));

    assert.match(document.body.textContent ?? '', /未发现影响画面成立的明显问题/);
    assert.match(document.body.textContent ?? '', /当前判断/);
    assert.doesNotMatch(document.body.textContent ?? '', /最优先问题/);
    assert.doesNotMatch(document.querySelector('.radar-legend-list')?.textContent ?? '', /待优化/);
    assert.doesNotMatch(document.querySelector('.dimension-diagnosis')?.textContent ?? '', /优先处理/);
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('评分概览以实心优势项和空心待优化标签区分最高与最低分', async () => {
  const environment = await renderApp([createHistoryRecord('score-labels', '2026-02-01T10:00:00Z', 0)]);

  try {
    await click(getMainNavigationButton('历史记录'));
    await click(getHistoryReportControl(document.querySelector('.history-card') as Element));

    const scoreBlock = document.querySelector('.report-score-block');
    assert.ok(scoreBlock);
    assert.equal(scoreBlock.querySelector('em.is-strong')?.textContent?.trim(), '优势项');
    assert.equal(scoreBlock.querySelector('em.is-weak')?.textContent?.trim(), '待优化');
    assert.doesNotMatch(scoreBlock.textContent ?? '', /可选优化/);

    const diagnosticBlock = document.querySelector('.dimension-diagnosis');
    const diagnosticStrong = diagnosticBlock?.querySelector('.diagnostic-card-score-status.is-strong');
    const diagnosticWeak = diagnosticBlock?.querySelector('.diagnostic-card-score-status.is-weak');
    assert.equal(diagnosticStrong?.textContent?.trim(), '优势项');
    assert.equal(diagnosticWeak?.textContent?.trim(), '待优化');
    assert.equal(diagnosticStrong?.closest('.diagnostic-card')?.querySelector('h3')?.textContent?.trim(), '色彩');
    assert.equal(diagnosticWeak?.closest('.diagnostic-card')?.querySelector('h3')?.textContent?.trim(), '叙事');
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('五项诊断以紧凑摘要呈现并保留可展开的完整正文', async () => {
  const environment = await renderApp([createHistoryRecord('diagnostic', '2026-02-01T10:00:00Z', 0)]);

  try {
    await click(getMainNavigationButton('历史记录'));
    await click(getHistoryReportControl(document.querySelector('.history-card') as Element));

    const cards = [...document.querySelectorAll('.dimension-diagnosis .diagnostic-card')];
    assert.equal(cards.length, 5);
    assert.ok(cards.every((card) => card.tagName === 'ARTICLE'));
    const details = [...document.querySelectorAll<HTMLDetailsElement>('.dimension-diagnosis details')];
    assert.equal(details.length, 5);
    assert.equal(document.querySelectorAll('.dimension-diagnosis summary').length, 5);
    assert.equal(details.filter((item) => item.open).length, 0, '默认收起详情以优先显示优化建议');
    assert.ok(details.every((item) => Boolean(item.querySelector('.diagnostic-card-disclosure'))));
    assert.equal(document.querySelector('.dimension-diagnosis .diagnostic-card-head small'), null);
    assert.equal(document.querySelectorAll('.dimension-diagnosis .diagnostic-card-score-lockup').length, 5);
    assert.ok(cards.every((card) => (card.querySelector('.diagnostic-card-content')?.textContent ?? '').trim().length > 0));
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('首页流程与当前评审及优化闭环一致', async () => {
  const environment = await renderApp();

  try {
    const steps = [...document.querySelectorAll('.home-flow-panel .flow-steps li')];
    assert.equal(document.querySelector('.hero-capability-line'), null);
    assert.equal(steps.length, 4);
    assert.equal(steps[0]?.querySelector('strong')?.textContent?.trim(), '上传照片');
    assert.equal(steps[1]?.querySelector('strong')?.textContent?.trim(), '选择属性');
    assert.equal(steps[2]?.querySelector('strong')?.textContent?.trim(), '生成报告');
    assert.equal(steps[3]?.querySelector('strong')?.textContent?.trim(), '回顾学习');
    assert.equal(steps[1]?.querySelector('p')?.textContent?.trim(), '确认影像介质、摄影题材和评价水平。');
    assert.equal(steps[2]?.querySelector('p')?.textContent?.trim(), '从结论、评审依据到五维诊断，读懂这张照片。');
    assert.equal(steps[3]?.querySelector('p')?.textContent?.trim(), '在历史记录中回看报告与优化前后变化。');
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('首页每次进入都显示介绍，且只由眼睛按钮切换', async () => {
  let autoHideScheduled = false;
  const environment = await renderApp([], HISTORY_SCHEMA_VERSION, () => {
    localStorage.setItem('photosense_home_intro_seen', 'true');
    window.sessionStorage.setItem('photosense_home_intro_seen_session', 'true');
    const originalSetTimeout = window.setTimeout;
    window.setTimeout = ((handler: TimerHandler, delay?: number) => {
      if (delay === 3_000) autoHideScheduled = true;
      return originalSetTimeout(handler, delay);
    }) as typeof window.setTimeout;
  });

  try {
    assert.equal(document.querySelector('.brand-text')?.textContent?.trim(), 'PhotoSense AI', '页头只应显示产品名称');
    assert.ok(document.querySelector('.app-shell-home'), '首页应提供独立的主题作用域');
    assert.equal(document.querySelector('.home-showcase-intro .eyebrow'), null, 'Hero顶部不应重复显示产品名称');
    assert.equal(document.querySelector('#hero-title')?.textContent?.trim(), 'Photosense AI', '首页主标题应展示产品名称');
    assert.equal(document.querySelector('.home-showcase-intro .hero-text')?.textContent?.trim(), '摄影评审与优化建议', '首页副标题应说明核心功能');
    assert.doesNotMatch(document.querySelector('.home-showcase-intro')?.textContent ?? '', /功能示例/);
    assert.equal(document.querySelectorAll('#hero-title span').length, 0, '首页标题不应使用无语义的拆分词块');
    assert.doesNotMatch(document.querySelector('.home-showcase-intro')?.textContent ?? '', /\bv(?:1\.0|3)\b/i, '首页介绍不应显示版本号');
    assert.equal(document.querySelector('.home-intro-content')?.hasAttribute('hidden'), false, '进入首页应立即显示介绍');
    assert.equal(autoHideScheduled, false, '首页不应安排三秒自动隐藏');
    assert.ok(document.querySelector('.page-home > .home-view-controls'), '眼睛按钮应固定在首页主区域右上角');
    assert.equal(document.querySelector('.home-intro-content .home-view-controls'), null, '眼睛按钮不应被介绍容器的 hidden 属性隐藏');

    const hideIntroButton = document.querySelector<HTMLButtonElement>('button[aria-label="隐藏介绍"]');
    assert.ok(hideIntroButton);
    assert.equal(hideIntroButton.getAttribute('aria-controls'), 'home-intro-content');
    assert.equal(hideIntroButton.getAttribute('aria-expanded'), 'true');
    assert.equal(hideIntroButton.title, '隐藏介绍');
    assert.equal(document.querySelector('.home-gallery-background')?.getAttribute('aria-hidden'), 'true');
    const homeRipple = document.querySelector('.page-home > .background-ripple-layer');
    assert.ok(homeRipple, '首页应提供独立的背景波纹层');
    assert.equal(homeRipple?.classList.contains('is-hidden'), false, '介绍模式应显示背景波纹层');
    await act(async () => {
      window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 128, clientY: 96 }));
    });
    assert.equal((homeRipple as HTMLElement).style.getPropertyValue('--ripple-x'), '128px');
    assert.equal((homeRipple as HTMLElement).style.getPropertyValue('--ripple-y'), '96px');
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 260));
    });
    assert.equal(homeRipple?.classList.contains('is-pointer-resting'), true, '鼠标停留后应显示波纹与微光状态');
    assert.equal([...document.querySelectorAll<HTMLButtonElement>('.home-collage-card')].every((card) => card.tabIndex === -1), true);
    await click(hideIntroButton);
    assert.equal(document.querySelector('.home-intro-content')?.hasAttribute('hidden'), true, '用户点击眼睛后应隐藏介绍');
    assert.equal(document.querySelector('.home-gallery-background')?.hasAttribute('aria-hidden'), false);
    assert.equal(document.querySelector('.page-home > .background-ripple-layer')?.classList.contains('is-hidden'), true, '照片墙模式应隐藏背景波纹层');
    assert.equal([...document.querySelectorAll<HTMLButtonElement>('.home-collage-card')].filter((card) => card.tabIndex === 0).length, 1, '照片墙只保留一个键盘入口');
    const showIntroButton = document.querySelector<HTMLButtonElement>('button[aria-label="显示介绍"]');
    assert.equal(showIntroButton?.getAttribute('aria-controls'), 'home-intro-content');
    assert.equal(showIntroButton?.getAttribute('aria-expanded'), 'false');
    assert.equal(showIntroButton?.title, '显示介绍');
    assert.equal(showIntroButton?.closest('.home-intro-content'), null, '照片墙模式下眼睛按钮仍应保持可见');

    await click(getMainNavigationButton('开始点评'));
    await click(getMainNavigationButton('首页'));
    assert.equal(document.querySelector('.home-intro-content')?.hasAttribute('hidden'), false, '再次进入首页应重新显示介绍');
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('报告总览根据照片方向切换竖幅并排与横幅评分优先版式', async () => {
  const environment = await renderApp([createHistoryRecord('orientation', '2026-02-01T10:00:00Z', 0)]);

  try {
    await click(getMainNavigationButton('分析报告'));
    const hero = document.querySelector('.diagnostic-hero-report');
    const reportImage = document.querySelector('.diagnostic-image-board img');
    assert.ok(hero);
    assert.ok(reportImage);
    assert.equal(hero.classList.contains('is-portrait-image'), true);

    Object.defineProperties(reportImage, {
      naturalWidth: { configurable: true, value: 1600 },
      naturalHeight: { configurable: true, value: 900 },
    });
    await act(async () => reportImage.dispatchEvent(new Event('load', { bubbles: true })));
    assert.equal(hero.classList.contains('is-landscape-image'), true);

    Object.defineProperties(reportImage, {
      naturalWidth: { configurable: true, value: 900 },
      naturalHeight: { configurable: true, value: 1600 },
    });
    await act(async () => reportImage.dispatchEvent(new Event('load', { bubbles: true })));
    assert.equal(hero.classList.contains('is-portrait-image'), true);
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('分析报告使用照片背景、分章透明底层与吸顶目录且不影响其他页面', async () => {
  const record = createHistoryRecord('immersive-report', '2026-02-01T10:00:00Z', 0);
  const environment = await renderApp([record]);

  try {
    await click(getMainNavigationButton('分析报告'));

    const background = document.querySelector('.page-report > .report-immersive-background');
    const backgroundImage = background?.querySelector<HTMLImageElement>('img');
    const reportRipple = background?.querySelector('.background-ripple-layer');
    assert.ok(background, '报告页应提供沉浸式照片背景');
    assert.ok(reportRipple, '报告页应在沉浸式背景中提供共用波纹层');
    assert.equal(reportRipple?.getAttribute('aria-hidden'), 'true');
    assert.equal(background.getAttribute('aria-hidden'), 'true');
    assert.equal(backgroundImage?.src, record.imageUrl);
    assert.equal(background.querySelectorAll('button, a, input').length, 0, '背景不应进入交互路径');
    assert.equal(document.querySelector('.diagnostic-report .report-immersive-background'), null, '背景不应进入报告导出内容');

    await click(getMainNavigationButton('开始点评'));
    assert.equal(document.querySelector('.report-immersive-background'), null, '其他页面不应保留报告背景');

    const css = await readFile(new URL('../src/theme-editorial-monochrome.css', import.meta.url), 'utf8');
    assert.match(css, /\.report-immersive-background img[\s\S]*?opacity:\s*0\.2/);
    assert.match(css, /\.page-report \.diagnostic-report:not\(\.is-exporting\) \{[\s\S]*?gap:\s*clamp\(28px, 3vw, 48px\)[\s\S]*?background:\s*transparent !important/);
    assert.match(css, /\.page-report \.diagnostic-report:not\(\.is-exporting\) > :is\([\s\S]*?\.review-context-section[\s\S]*?background:\s*var\(--em-window-surface\) !important/);
    assert.match(css, /\.page-report :is\(\.report-masthead, \.diagnostic-report-shell\),[\s\S]*?\.diagnostic-photo-panel,[\s\S]*?\.diagnostic-image-board,[\s\S]*?\.post-preview-image,[\s\S]*?background:\s*transparent !important/);
    assert.match(css, /\.page-report \.report-source-notice \{[\s\S]*?background:\s*rgba\(11, 11, 11, 0\.68\) !important/);
    assert.match(css, /\.page-report \.report-side-nav \{[\s\S]*?position:\s*sticky[\s\S]*?top:\s*72px[\s\S]*?background:\s*rgba\(11, 11, 11, 0\.76\) !important[\s\S]*?backdrop-filter:\s*blur\(8px\)/);
    assert.match(css, /Report typography unification and four-part directory/);
    assert.match(css, /\.page-report \.report-side-nav \{[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
    assert.match(css, /\.report-verdict-summary > span,[\s\S]*?\.review-context-card dt[\s\S]*?color:\s*var\(--em-accent-dark\) !important[\s\S]*?font-size:\s*clamp\(0\.9rem, 1vw, 1rem\) !important/);
    assert.match(css, /\.post-preview-next-shot[\s\S]*?border-top:\s*1px solid/);
    assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.page-report \.report-side-nav \{[\s\S]*?top:\s*0/);
    assert.match(css, /@keyframes report-ambient-light/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.report-immersive-light[\s\S]*?animation:\s*none !important/);
    assert.match(css, /\.background-ripple-layer \{[\s\S]*?pointer-events:\s*none/);
    assert.match(css, /\.background-ripple-layer \{[\s\S]*?animation:\s*background-ambient-drift/);
    assert.match(css, /\.background-ripple-layer::before[\s\S]*?radial-gradient\([\s\S]*?var\(--ripple-x\)[\s\S]*?var\(--ripple-y\)/);
    assert.match(css, /\.background-ripple-layer\.is-pointer-resting::after[\s\S]*?animation:\s*background-ripple-pulse/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.background-ripple-layer[\s\S]*?display:\s*none !important/);
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('首页首次进入先显示照片墙，一秒后自动显示介绍，站内返回不重复触发', async () => {
  let triggerEntranceReveal: (() => void) | null = null;
  let introTransitionCount = 0;
  const originalStartViewTransition = document.startViewTransition;
  const environment = await renderApp([], HISTORY_SCHEMA_VERSION, () => {
    document.startViewTransition = ((update?: ViewTransitionUpdateCallback) => {
      introTransitionCount += 1;
      void update?.();
      const completed = Promise.resolve();
      return {
        finished: completed,
        ready: completed,
        updateCallbackDone: completed,
        skipTransition: () => undefined,
      } as ViewTransition;
    }) as Document['startViewTransition'];
    const originalSetTimeout = window.setTimeout;
    window.setTimeout = ((handler: TimerHandler, delay?: number) => {
      if (delay === 1_000) {
        triggerEntranceReveal = handler as () => void;
        return 0 as unknown as number;
      }
      return originalSetTimeout(handler, delay);
    }) as typeof window.setTimeout;
  }, { revealInitialHome: false });

  try {
    assert.equal(document.querySelector('.home-intro-content')?.hasAttribute('hidden'), true);
    assert.equal(document.querySelector<HTMLButtonElement>('.home-content-toggle')?.getAttribute('aria-expanded'), 'false');
    assert.ok(document.querySelector('.page-home > .home-view-controls'), '照片墙模式下眼睛按钮仍应显示');
    assert.equal(document.querySelector('.home-gallery-background')?.hasAttribute('aria-hidden'), false);
    assert.equal(document.querySelector('.home-gallery-focus'), null, '首次照片墙不应自动打开单张照片预览');
    assert.ok(triggerEntranceReveal, '首页应安排一次 1 秒后的介绍揭示');

    await act(async () => triggerEntranceReveal?.());
    assert.equal(document.querySelector('.home-intro-content')?.hasAttribute('hidden'), false);
    assert.equal(document.querySelector<HTMLButtonElement>('.home-content-toggle')?.getAttribute('aria-expanded'), 'true');
    assert.equal(introTransitionCount, 1, '自动出现应复用眼睛按钮的介绍过渡');

    await click(getMainNavigationButton('开始点评'));
    await click(getMainNavigationButton('首页'));
    assert.equal(document.querySelector('.home-intro-content')?.hasAttribute('hidden'), false, '站内返回首页不应再次隐藏介绍');
  } finally {
    document.startViewTransition = originalStartViewTransition;
    await cleanupEnvironment(environment);
  }
});

test('开始点评和历史记录完整复用首页照片墙与互动效果但不提供介绍切换', async () => {
  const environment = await renderApp([createHistoryRecord('ambient-background', '2026-02-01T10:00:00Z', 0)]);

  try {
    const expectedSources = [1, 7, 5, 15, 12, 19, 4, 9, 22, 24, 17, 25, 3, 20, 26, 27, 28, 29, 30, 31, 32, 33, 34]
      .map((number) => `/home-backgrounds/photo-${String(number).padStart(2, '0')}.jpg`);

    for (const pageLabel of ['开始点评', '历史记录']) {
      await click(getMainNavigationButton(pageLabel));

      const main = document.querySelector(pageLabel === '开始点评' ? '.page-review' : '.history-page');
      const sharedLayer = main?.querySelector('.shared-home-photo-background.page-home');
      const background = sharedLayer?.querySelector('.home-gallery-background');
      const ripple = sharedLayer?.querySelector('.background-ripple-layer');
      const cards = [...(background?.querySelectorAll<HTMLElement>('.home-collage-card') ?? [])];
      const photos = [...(background?.querySelectorAll<HTMLImageElement>('.home-collage-card img') ?? [])];

      assert.ok(background, `${pageLabel}应包含共享照片背景`);
      assert.ok(ripple, `${pageLabel}应包含共用背景波纹层`);
      assert.equal(ripple?.classList.contains('is-hidden'), false, `${pageLabel}内容模式应显示背景波纹层`);
      assert.equal(background.getAttribute('aria-hidden'), 'true');
      assert.equal(photos.length, 23, `${pageLabel}应使用首页完整的 23 张背景照片`);
      assert.deepEqual(photos.map((photo) => new URL(photo.src).pathname), expectedSources);
      assert.equal(cards.every((card, index) => card.classList.contains(`card-${String(index + 1).padStart(2, '0')}`)), true);
      assert.equal(cards.filter((card) => card.classList.contains('is-collage-front')).length, 1);
      assert.equal(photos.every((photo) => photo.alt === ''), true, '装饰照片不应重复进入读屏内容');
      assert.equal(main?.querySelector('.home-view-controls'), null, `${pageLabel}不应提供首页眼睛切换`);
      assert.equal(background.querySelectorAll('button, a, input').length, 0, '背景不应抢占键盘或点击路径');

      await act(async () => cards[0]?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
      assert.equal(sharedLayer?.classList.contains('is-collage-paused'), true, '悬停照片时应像首页一样暂停轮换');
      await act(async () => cards[0]?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })));
      assert.equal(sharedLayer?.classList.contains('is-collage-paused'), false);
    }

    const css = await readFile(new URL('../src/theme-editorial-monochrome.css', import.meta.url), 'utf8');
    assert.match(css, /\.shared-home-photo-background\.page-home[\s\S]*?position:\s*absolute[\s\S]*?pointer-events:\s*none/);
    assert.match(css, /\.shared-home-photo-background[\s\S]*?\.home-collage-card[\s\S]*?pointer-events:\s*auto/);
    assert.doesNotMatch(css, /\.ambient-photo-background|\.ambient-photo-card/);
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('登录和注册复用首页照片墙并保留眼睛切换', async () => {
  const environment = await renderApp();

  try {
    for (const pageLabel of ['登录', '注册']) {
      const entry = [...document.querySelectorAll<HTMLButtonElement>('.header-actions .login-button')]
        .find((button) => button.textContent?.trim() === pageLabel);
      assert.ok(entry, `没有找到${pageLabel}入口`);
      await click(entry);

      const main = document.querySelector('.auth-page-clean');
      const sharedLayer = main?.querySelector('.shared-home-photo-background.page-home');
      const background = sharedLayer?.querySelector('.home-gallery-background');
      const cards = [...(background?.querySelectorAll<HTMLElement>('.home-collage-card') ?? [])];
      const toggle = main?.querySelector<HTMLButtonElement>('.home-content-toggle');
      const panel = main?.querySelector<HTMLElement>('.auth-panel');
      const ripple = sharedLayer?.querySelector('.background-ripple-layer');

      assert.ok(background, `${pageLabel}页应包含首页照片墙背景`);
      assert.equal(document.querySelector('.home-gallery-result'), null, `${pageLabel}页不应展示照片分析结果`);
      assert.equal(background.getAttribute('data-background-page'), pageLabel === '登录' ? 'login' : 'register');
      assert.equal(background.querySelectorAll('.home-collage-card img').length, 23);
      assert.equal(cards.filter((card) => card.classList.contains('is-collage-front')).length, 1);
      assert.ok(toggle, `${pageLabel}页应保留眼睛图标`);
      assert.ok(ripple, `${pageLabel}页应包含共用背景波纹层`);
      assert.equal(ripple?.classList.contains('is-hidden'), false);
      assert.equal(toggle.getAttribute('aria-expanded'), 'true');
      assert.equal(panel?.hasAttribute('hidden'), false);

      await click(toggle);
      assert.equal(toggle.getAttribute('aria-expanded'), 'false');
      assert.equal(panel?.hasAttribute('hidden'), true);
      assert.equal(sharedLayer?.classList.contains('is-gallery-only'), true);
      assert.equal(ripple?.classList.contains('is-hidden'), true, `${pageLabel}照片墙模式应隐藏背景波纹层`);

      await click(toggle);
      assert.equal(toggle.getAttribute('aria-expanded'), 'true');
      assert.equal(panel?.hasAttribute('hidden'), false);

      await act(async () => cards[0]?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
      assert.equal(sharedLayer?.classList.contains('is-collage-paused'), true);
      await act(async () => cards[0]?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })));
      assert.equal(sharedLayer?.classList.contains('is-collage-paused'), false);
    }

    const css = await readFile(new URL('../src/theme-editorial-monochrome.css', import.meta.url), 'utf8');
    assert.match(css, /:is\(\.page-review, \.history-page, \.auth-page-clean\)/);
    assert.match(css, /\.auth-page-clean \.home-view-controls[\s\S]*?z-index:\s*50/);
    assert.match(css, /\.auth-page-clean \.home-content-toggle[\s\S]*?min-height:\s*46px/);
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('首页与其他页面窗口统一使用报告章节的透明黑色底层', async () => {
  const css = await readFile(new URL('../src/theme-editorial-monochrome.css', import.meta.url), 'utf8');

  assert.match(css, /--em-window-surface:\s*rgba\(11, 11, 11, 0\.48\)/);
  assert.match(css, /--em-window-padding-block:\s*clamp\(36px, 4vw, 64px\)/);
  assert.match(css, /--em-window-padding-inline:\s*clamp\(24px, 3vw, 48px\)/);
  assert.match(css, /\.diagnostic-report:not\(\.is-exporting\) > :is\([\s\S]*?background:\s*var\(--em-window-surface\) !important/);
  assert.match(css, /\.home-showcase-intro,[\s\S]*?\.home-flow-panel,[\s\S]*?\.review-page-intro,[\s\S]*?\.review-upload,[\s\S]*?\.review-preview,[\s\S]*?\.history-page-intro,[\s\S]*?\.history-tools,[\s\S]*?\.history-card,[\s\S]*?\.auth-panel[\s\S]*?background:\s*var\(--em-window-surface\) !important/);
  assert.match(css, /\.page-home \.home-showcase-intro,[\s\S]*?\.history-page \.history-page-intro[\s\S]*?padding:\s*var\(--em-window-padding-block\) var\(--em-window-padding-inline\) !important/);
  assert.match(css, /\.page-review \.review-page-intro,\s*\.history-page \.history-page-intro[\s\S]*?background:\s*rgba\(11, 11, 11, 0\.32\) !important/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?--em-window-padding-block:\s*32px[\s\S]*?--em-window-padding-inline:\s*16px/);
});

test('首页胶片在悬停、聚焦和点击时同步切换真实报告与前后对比图', async () => {
  const environment = await renderApp();

  try {
    const mainImage = document.querySelector('.home-showcase-image') as HTMLImageElement;
    const reportPreview = document.querySelector('.home-report-preview');
    const photoButtons = [...document.querySelectorAll('.home-photo-choice:not([data-duplicate="true"])')] as HTMLButtonElement[];
    const beforeButton = document.querySelector<HTMLButtonElement>('.home-comparison-button[data-view="before"]');
    const afterButton = document.querySelector<HTMLButtonElement>('.home-comparison-button[data-view="after"]');

    assert.ok(mainImage);
    assert.ok(reportPreview);
    assert.ok(beforeButton);
    assert.ok(afterButton);
    assert.equal(photoButtons.length, 5);
    assert.equal(document.querySelectorAll('.home-collage-card').length, 23);
    assert.ok(document.querySelector('.home-collage-card.is-collage-front'));
    assert.equal(document.querySelectorAll('.home-photo-choice[data-duplicate="true"]').length, 5);
    assert.equal(photoButtons.some((button) => /雾湖栖鸟|雪峰灯火|夜色街角/.test(button.getAttribute('aria-label') ?? '')), false, '首页胶片不应展示指定移除的照片');
    assert.equal(document.querySelector('.home-photo-browser-heading'), null);
    assert.equal(document.querySelector('.home-showcase-frame'), null);
    assert.equal(document.querySelector('.home-showcase-caption-title')?.textContent?.trim(), '城市夹缝');
    assert.equal(document.querySelectorAll('.home-showcase-caption-meta span').length, 3);
    assert.equal(document.querySelectorAll('.home-report-actions .home-suggestion-index').length, 3, '首页优化建议应使用报告一致的数字序号');
    assert.equal(document.querySelectorAll('.home-showcase-caption-meta small').length, 0);
    assert.deepEqual(
      [...document.querySelectorAll('.home-showcase-caption-meta span')].map((element) => element.textContent?.trim()),
      ['数码摄影', '进阶水平', '建筑摄影'],
      '首页照片属性只应显示实际值，不应混入属性名称',
    );
    assert.doesNotMatch(document.querySelector('.home-showcase-caption-meta')?.textContent ?? '', /影像介质|评价水平|摄影题材/);
    assert.equal(document.querySelectorAll('.home-photo-choice span').length, 0);
    assert.ok(document.querySelector('.home-workbench > .home-showcase-stage + .home-review-column'));
    assert.ok(document.querySelector('.home-review-column > .home-showcase-intro + .home-report-preview + .home-photo-browser'));
    assert.ok(document.querySelector('.home-showcase-intro > .home-showcase-title + .hero-text + .primary-link'));
    assert.match(mainImage.src, /home-backgrounds\/photo-07\.jpg$/);
    assert.equal(beforeButton.getAttribute('aria-pressed'), 'true');
    assert.equal(afterButton.getAttribute('aria-pressed'), 'false');
    assert.match(reportPreview.textContent ?? '', /评审结论/);
    assert.match(reportPreview.textContent ?? '', /优化建议/);
    assert.match(reportPreview.textContent ?? '', /红砖、白色立面与起重机/);
    assert.match(reportPreview.textContent ?? '', /下缘略向上收束/);
    assert.doesNotMatch(reportPreview.textContent ?? '', /综合评分|微调建议|AI|模型|PS\s*\d+/i);
    assert.equal(photoButtons[0]?.getAttribute('aria-pressed'), 'true');
    assert.equal(document.querySelectorAll('#home-report-preview').length, 1);
    assert.equal(photoButtons.every((button) => button.getAttribute('aria-controls') === 'home-report-preview'), true);
    assert.equal(reportPreview.getAttribute('aria-live'), 'off');
    assert.match(document.querySelector('.home-flow-panel')?.textContent ?? '', /上传照片.*选择属性.*生成报告.*回顾学习/s);
    assert.doesNotMatch(document.body.textContent ?? '', /看见画面.*再决定下一步/);
    assert.doesNotMatch(document.body.textContent ?? '', /口径/);

    await click(beforeButton);
    assert.match(mainImage.src, /home-backgrounds\/photo-07\.jpg$/);
    assert.equal(beforeButton.getAttribute('aria-pressed'), 'true');
    assert.equal(afterButton.getAttribute('aria-pressed'), 'false');
    await click(afterButton);
    assert.match(mainImage.src, /home-showcase\/city-gap-after\.webp$/);

    await act(async () => {
      photoButtons[1]?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
    assert.match(mainImage.src, /home-backgrounds\/photo-15\.jpg$/);
    assert.equal(beforeButton.getAttribute('aria-pressed'), 'true');
    assert.equal(afterButton.getAttribute('aria-pressed'), 'false');
    assert.match(reportPreview.textContent ?? '', /湖面反光与两只天鹅/);
    assert.match(reportPreview.textContent ?? '', /机位放低并靠近/);
    assert.equal(photoButtons[1]?.getAttribute('aria-pressed'), 'true');
    assert.match(document.querySelector('[role="status"]')?.textContent ?? '', /湖面逆光.*修改前后/);

    await click(beforeButton);
    assert.match(mainImage.src, /home-backgrounds\/photo-15\.jpg$/);
    await click(afterButton);
    assert.match(mainImage.src, /home-showcase\/lake-swans-after\.webp$/);

    await act(async () => photoButtons[2]?.focus());
    assert.match(mainImage.src, /home-backgrounds\/photo-22\.jpg$/);
    assert.equal(beforeButton.getAttribute('aria-pressed'), 'true');
    assert.match(mainImage.alt, /雾天铁路站场/);
    assert.match(reportPreview.textContent ?? '', /避开中央立柱/);
    await click(afterButton);
    assert.match(mainImage.src, /home-showcase\/mist-station-after\.webp$/);

    await click(photoButtons[3]);
    assert.match(mainImage.src, /home-backgrounds\/photo-04\.jpg$/);
    await click(afterButton);
    assert.match(mainImage.src, /home-showcase\/night-tram-after\.webp$/);

    await click(photoButtons[4]);
    assert.match(mainImage.src, /home-backgrounds\/photo-09\.jpg$/);

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
      const galleryFocus = document.querySelector('.home-gallery-focus');
      assert.ok(galleryFocus?.querySelector('.home-gallery-focus-image'), '点击照片墙照片应只打开大图预览');
      assert.equal(document.querySelector('.home-gallery-result'), null, '照片墙不应展示分析结果');
      assert.doesNotMatch(galleryFocus?.textContent ?? '', /分析结果|综合评分|评审结论|微调建议/);
    }

    assert.match(document.querySelector<HTMLImageElement>('.home-gallery-focus-image')?.src ?? '', /photo-34\.jpg$/);
    const closeGalleryButton = document.querySelector<HTMLButtonElement>('button[aria-label="关闭照片预览"]');
    assert.ok(closeGalleryButton);
    await click(closeGalleryButton);
    assert.equal(document.querySelector('.home-gallery-focus'), null);

    await click(collageCards[1]);
    assert.match(document.querySelector<HTMLImageElement>('.home-gallery-focus-image')?.src ?? '', /photo-07\.jpg$/);
    await click(document.querySelector('.home-gallery-background') as HTMLElement);
    assert.equal(document.querySelector('.home-gallery-focus'), null, '点击照片墙背景应关闭单图分析');

    const showContentToggle = document.querySelector<HTMLButtonElement>('button[aria-label="显示介绍"]');
    assert.ok(showContentToggle);
    assert.equal(showContentToggle.closest('.home-intro-content'), null);
    assert.equal(showContentToggle.getAttribute('aria-expanded'), 'false');
    await click(showContentToggle);
    assert.equal(document.querySelector('.home-intro-content')?.hasAttribute('hidden'), false);

    const firstCollageCard = document.querySelector('.home-collage-card') as HTMLElement;
    await act(async () => firstCollageCard.focus());
    assert.ok(document.querySelector('.page-home')?.classList.contains('is-collage-paused'));
    await act(async () => firstCollageCard.blur());
    assert.equal(document.querySelector('.page-home')?.classList.contains('is-collage-paused'), false);

    await act(async () => photoButtons[0]?.focus());
    assert.ok(document.querySelector('.page-home')?.classList.contains('is-carousel-paused'));
    await act(async () => photoButtons[0]?.blur());
    assert.equal(document.querySelector('.page-home')?.classList.contains('is-carousel-paused'), false);
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('首页前后图会自动交替并使用渐变状态', async () => {
  let comparisonTimer: TimerHandler | null = null;
  let comparisonTimerDelay: number | undefined;
  const environment = await renderApp([], HISTORY_SCHEMA_VERSION, () => {
    const nativeSetInterval = window.setInterval;
    window.setInterval = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (delay === 4_500) {
        comparisonTimer = handler;
        comparisonTimerDelay = delay;
      }
      return nativeSetInterval(handler, delay, ...args);
    }) as typeof window.setInterval;
  });

  try {
    const mainImage = document.querySelector<HTMLImageElement>('.home-showcase-image');
    assert.ok(mainImage);
    assert.equal(comparisonTimerDelay, 4_500);
    assert.equal(mainImage.getAttribute('src'), '/home-backgrounds/photo-07.jpg');
    assert.equal(typeof comparisonTimer, 'function');

    await act(async () => {
      if (typeof comparisonTimer === 'function') comparisonTimer();
    });

    assert.equal(mainImage.getAttribute('src'), '/home-showcase/city-gap-after.webp');
    assert.ok(mainImage.classList.contains('is-fading'));

    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 260)));
    assert.equal(mainImage.classList.contains('is-fading'), false);
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('首页保留键盘入口、触控尺寸、焦点样式和减少动态效果约束', async () => {
  const environment = await renderApp();

  try {
    const photoButtons = [...document.querySelectorAll<HTMLButtonElement>('.home-photo-choice:not([data-duplicate="true"])')];
    const duplicateButtons = [...document.querySelectorAll<HTMLButtonElement>('.home-photo-choice[data-duplicate="true"]')];
    const collageCards = [...document.querySelectorAll<HTMLButtonElement>('.home-collage-card')];

    assert.equal(photoButtons.length, 5);
    assert.equal(photoButtons.every((button) => button.tabIndex === 0), true, '照片索引按钮应可通过键盘访问');
    assert.equal(duplicateButtons.every((button) => button.tabIndex === -1), true, '循环复制项不应重复进入键盘路径');
    assert.equal(collageCards.every((button) => button.tabIndex === -1), true, '介绍显示时照片墙不应进入键盘路径');
    assert.equal(document.querySelector<HTMLButtonElement>('.home-content-toggle')?.tabIndex, 0);
    assert.equal(document.querySelector('.site-footer')?.textContent?.trim(), 'Photosense AI · Made by Yune · 2026');

    const css = await readFile(new URL('../src/theme-editorial-monochrome.css', import.meta.url), 'utf8');
    assert.match(css, /\.app-shell-home \.site-header[\s\S]*?background: var\(--em-ink\)/);
    assert.match(css, /\.app-shell-home \.site-header[\s\S]*?border: 0/);
    assert.match(css, /\.app-shell-home \.site-footer[\s\S]*?border: 0/);
    assert.match(css, /\.app-shell \.site-footer[\s\S]*?white-space:\s*nowrap/);
    assert.match(css, /\.home-film-perforations[\s\S]*?display:\s*flex[\s\S]*?gap:\s*14px/);
    assert.match(css, /\.home-film-perforations i[\s\S]*?flex:\s*0 0 18px[\s\S]*?width:\s*18px/);
    assert.match(css, /\.home-photo-choice img[\s\S]*?filter: grayscale\(1\) contrast\(1\.06\)/);
    assert.match(css, /\.home-gallery-background::before[\s\S]*?rgba\(11, 11, 11, 0\.56\)/);
    assert.match(css, /\.home-collage-card\.is-collage-behind[\s\S]*?opacity: 0\.26 !important/);
    assert.match(css, /\.home-showcase-intro[\s\S]*?border-top: 0[\s\S]*?border-bottom: 0/);
    assert.match(css, /\.page-home \.home-view-controls[\s\S]*?position: absolute[\s\S]*?top: 14px[\s\S]*?right: 6px[\s\S]*?z-index: 50/);
    assert.match(css, /\.page-home\.is-gallery-only \.home-gallery-focus[\s\S]*?margin-top: 84px/);
    assert.match(css, /\.home-view-controls[\s\S]*?border: 0[\s\S]*?background: transparent[\s\S]*?box-shadow: none/);
    assert.match(css, /\.home-visual-pair[\s\S]*?border-top: 0/);
    assert.match(css, /\.page-home \.home-workbench[\s\S]*?grid-template-columns:\s*minmax\(0, 1\.62fr\) minmax\(430px, 0\.9fr\)/);
    assert.match(css, /\.page-home \.home-workbench[\s\S]*?height:\s*clamp\(780px, calc\(100vh - 88px\), 894px\)[\s\S]*?min-height:\s*0/);
    assert.match(css, /\.page-home \.home-workbench \.home-showcase-image[\s\S]*?object-fit:\s*contain[\s\S]*?transition:\s*opacity 220ms ease/);
    assert.match(css, /\.page-home \.home-workbench \.home-showcase-image\.is-fading[\s\S]*?opacity:\s*0/);
    assert.match(css, /\.page-home \.home-review-column > \.home-photo-browser[\s\S]*?height:\s*132px/);
    assert.match(css, /\.page-home \.home-review-column[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\) 132px[\s\S]*?align-content:\s*stretch/);
    assert.match(css, /\.page-home \.home-review-column > \.home-photo-browser[\s\S]*?align-self:\s*end[\s\S]*?margin-top:\s*0/);
    assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.page-home \.home-review-column[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\) 122px[\s\S]*?min-height:\s*650px/);
    assert.match(css, /\.page-home \.home-review-column > \.home-photo-browser[\s\S]*?border:\s*0[\s\S]*?box-shadow:\s*none/);
    assert.match(css, /\.page-home \.home-review-column \.home-photo-choice-list[\s\S]*?border:\s*0/);
    assert.match(css, /\.home-report-actions \.home-suggestion-index[\s\S]*?border-radius:\s*50%[\s\S]*?background:\s*var\(--em-accent-dark\)/);
    assert.match(css, /\.page-home \.home-comparison-button[\s\S]*?min-height:\s*44px/);
    assert.match(css, /--em-serif:[^;]+;[\s\S]*?--em-sans:[^;]+;[\s\S]*?--em-mono:[^;]+;/);
    assert.match(css, /--em-type-display: clamp\(46px, 5vw, 72px\);[\s\S]*?--em-type-section: 1\.25rem;[\s\S]*?--em-type-ui: 0\.875rem;/);
    assert.match(css, /--em-type-body: clamp\(1rem, calc\(0\.25vw \+ 0\.9375rem\), 1\.125rem\);/);
    assert.match(css, /--em-leading-display: 0\.95;[\s\S]*?--em-leading-heading: 1\.3;[\s\S]*?--em-leading-ui: 1\.5;/);
    assert.match(css, /--em-leading-body: 1\.65;/);
    assert.match(css, /--em-space-1: 4px;[\s\S]*?--em-space-2: 8px;[\s\S]*?--em-space-3: 12px;[\s\S]*?--em-space-4: 16px;[\s\S]*?--em-space-6: 24px;[\s\S]*?--em-space-8: 32px;[\s\S]*?--em-space-12: 48px;/);
    assert.doesNotMatch(css, /--em-type-support|--em-type-meta|--em-leading-support|--em-leading-meta/);
    assert.match(css, /\.home-showcase-caption-meta span[\s\S]*?font-family: var\(--em-sans\)[\s\S]*?font-size: var\(--em-type-ui\)[\s\S]*?line-height: var\(--em-leading-ui\)[\s\S]*?font-weight: 400/);
    assert.match(css, /\.home-showcase-title::before[\s\S]*?background: var\(--em-accent-dark\)/);
    assert.match(css, /\.home-showcase-intro h1#hero-title[\s\S]*?font-family: var\(--em-serif\)/);
    assert.match(css, /\.page-home \.home-workbench[\s\S]*?background: transparent/);
    assert.match(css, /\.page-home \.home-workbench > \.home-showcase-stage[\s\S]*?background: rgba\(11, 11, 11, 0\.86\)/);
    assert.match(css, /\.page-home \.home-review-column[\s\S]*?background: var\(--em-window-surface\)/);
    assert.match(css, /\.page-home \.home-review-column > \.home-showcase-intro[\s\S]*?background: rgba\(11, 11, 11, 0\.32\) !important/);
    assert.match(css, /\.page-home \.home-review-column \.home-showcase-intro \.primary-link[\s\S]*?justify-self: end/);
    assert.match(css, /\.page-home \.home-review-column > \.home-report-preview[\s\S]*?gap: 0[\s\S]*?padding: clamp\(22px, 2vw, 30px\) 0 0/);
    assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.page-home \.home-review-column > \.home-report-preview[\s\S]*?gap: 0[\s\S]*?padding: 24px 0 0/);
    assert.match(css, /\.home-showcase-intro \.primary-link[\s\S]*?border: 1px solid transparent[\s\S]*?color: var\(--em-ink\)[\s\S]*?background: var\(--em-accent-dark\)[\s\S]*?background-image: none/);
    assert.match(css, /@media \(min-width: 981px\)[\s\S]*?\.home-showcase-intro > \.hero-text[\s\S]*?align-self: end/);
    assert.match(css, /Editorial Monochrome v2 — spacing-led implementation of design\.md[\s\S]*?\.home-flow-panel \.flow-steps li:last-child[\s\S]*?border: 0/);
    assert.match(css, /\.home-report-preview-grid > div > strong[\s\S]*?font-family: var\(--em-sans\)[\s\S]*?font-size: var\(--em-type-body\)[\s\S]*?line-height: var\(--em-leading-body\)/);
    assert.match(css, /\.page-home \.home-report-score strong[\s\S]*?color: var\(--em-accent-dark\)[\s\S]*?font-family: var\(--em-mono\)[\s\S]*?font-size: var\(--em-type-score\) !important/);
    assert.match(css, /\.home-flow-panel \.flow-steps strong[\s\S]*?font-family: var\(--em-sans\)[\s\S]*?font-size: var\(--em-type-body\)[\s\S]*?line-height: var\(--em-leading-heading\)/);
    assert.match(css, /\.home-flow-panel \.flow-steps p[\s\S]*?font-size: var\(--em-type-body\)[\s\S]*?line-height: var\(--em-leading-body\)/);
    assert.match(css, /\.home-showcase-intro \.primary-link:hover[\s\S]*?border: 1px solid var\(--em-accent-dark\)[\s\S]*?color: var\(--em-accent-dark\)[\s\S]*?background: var\(--em-ink\)/);
    assert.match(css, /\.home-showcase-intro h1#hero-title span[\s\S]*?white-space: nowrap/);
    assert.match(css, /\.page-review \.frame-metadata span:last-child \{\s*white-space: nowrap;\s*word-break: keep-all;\s*\}/);
    assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.home-showcase-intro[\s\S]*?padding: 76px 2px var\(--em-space-8\)/);
    assert.match(css, /\.home-content-toggle[\s\S]*?min-height: 46px/);
    assert.match(css, /\.home-photo-choice img[\s\S]*?height: 88px[\s\S]*?min-height: 88px/);
    assert.match(css, /\.home-photo-choice:focus-visible[\s\S]*?outline-color: var\(--em-accent-dark\)/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.home-photo-choice-track[\s\S]*?animation: none !important/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.home-showcase-image[\s\S]*?transition: none !important/);
    assert.match(css, /\.app-shell\.is-page-entering > :is\(\.page-main, \.auth-page\)[\s\S]*?page-content-in 680ms/);
    assert.match(css, /\.app-shell-review\.is-page-entering > \.page-review,[\s\S]*?\.app-shell-history\.is-page-entering > \.history-page[\s\S]*?page-content-soft-in 900ms/);
    assert.match(css, /@keyframes page-content-soft-in[\s\S]*?transform: translateY\(24px\) scale\(0\.992\)[\s\S]*?filter: blur\(4px\)/);
    assert.doesNotMatch(css, /view-transition-name:\s*page-content/);
    assert.match(css, /scrollbar-gutter: stable/);
    assert.match(css, /\*::\-webkit-scrollbar-thumb[\s\S]*?border-radius: 0[\s\S]*?box-shadow: inset 0 0 0 1px/);
    assert.doesNotMatch(css, /cursor:\s*url\(['"]?\/cursors\/aperture\.svg/);
    assert.doesNotMatch(css, /cursor:\s*[^;]*crosshair/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.app-shell\.is-page-entering > :is\(\.page-main, \.auth-page\)[\s\S]*?animation: none !important/);
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('设计指导覆盖全站页面并限制为三种字体角色', async () => {
  const [guide, css] = await Promise.all([
    readFile(new URL('../design.md', import.meta.url), 'utf8'),
    readFile(new URL('../src/theme-editorial-monochrome.css', import.meta.url), 'utf8'),
  ]);

  assert.match(guide, /适用范围：首页、开始点评、分析报告、历史记录、登录、注册/);
  assert.match(guide, /全站最多三种字体角色/);
  assert.match(guide, /--em-serif:[^;]+;[\s\S]*?--em-sans:[^;]+;[\s\S]*?--em-mono:[^;]+;/);
  assert.match(guide, /用户照片保持原始色彩/);
  assert.match(guide, /以留白代替套框/);
  assert.match(guide, /选中选项：移除左侧竖线/);
  assert.match(guide, /尚未选择文件.*数码摄影.*使用无衬线/);
  assert.match(guide, /每次视觉修改至少检查 1440、760、390 px/);

  assert.match(css, /Editorial Monochrome v2 — spacing-led implementation of design\.md/);
  assert.match(css, /\.app-shell:not\(\.app-shell-home\)[\s\S]*?\.page-review[\s\S]*?\.page-report[\s\S]*?\.history-page[\s\S]*?\.auth-page/);
  assert.match(css, /\.page-report \.diagnostic-report:not\(\.is-exporting\)/);
  assert.match(css, /--em-space-16: 64px;[\s\S]*?--em-space-20: 80px;[\s\S]*?--em-space-24: 96px;/);
  assert.match(css, /\.page-review :is\(\.level-button, \.genre-button\)\.active[\s\S]*?box-shadow: inset 0 -3px 0 var\(--em-accent-dark\)/);
  assert.match(css, /\.page-review :is\(\.level-button, \.genre-button\)\.active,[\s\S]*?\.history-page \.history-filter-tags button\.active[\s\S]*?border-color: var\(--em-accent-dark\) !important[\s\S]*?box-shadow: inset 0 -3px 0 var\(--em-accent-dark\) !important/);
  assert.match(css, /\.history-page \.history-date-group > div[\s\S]*?grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\) auto/);
  assert.match(css, /\.history-page \.history-date-group label input[\s\S]*?width: 100%[\s\S]*?min-width: 0/);
  assert.match(css, /\.history-date-group button[\s\S]*?white-space: nowrap/);
  assert.match(css, /\.page-report \.report-side-nav a:is\(:hover, \.is-active\)[\s\S]*?box-shadow: inset 0 -3px 0 var\(--em-accent-dark\)/);
  assert.match(css, /\.history-page \.history-filter-tags button:not\(\.active\)[\s\S]*?color: var\(--em-dark-secondary\) !important/);
  assert.match(css, /\.report-score-block \.radar-legend-row em\.is-strong[\s\S]*?color: var\(--em-paper\) !important/);
  assert.match(css, /Report rhythm and orientation v2/);
  assert.match(css, /\.diagnostic-hero-report\.is-landscape-image \.report-score-block[\s\S]*?grid-template-areas: "total radar list"/);
  assert.match(css, /> \.report-title-row h2[\s\S]*?font-size: clamp\(2\.65rem, 4vw, 4\.6rem\) !important/);
  assert.match(css, /\.page-report \.report-masthead-copy h1[\s\S]*?max-width:\s*none !important[\s\S]*?white-space:\s*nowrap/);
  assert.match(css, /\.history-page \.history-score-badge strong,[\s\S]*?background: transparent !important/);
  assert.match(css, /Keep history metadata complete while allowing summaries to wrap[\s\S]*?\.history-page \.history-card-info[\s\S]*?grid-template-columns: minmax\(0, 1fr\) 76px[\s\S]*?\.history-page \.history-meta-tags[\s\S]*?flex-wrap: wrap[\s\S]*?overflow: visible[\s\S]*?\.history-page \.history-card-summary[\s\S]*?text-overflow: clip[\s\S]*?white-space: normal/);
  assert.doesNotMatch(css, /--em-(?:display|serif-alt|sans-alt|font-4):/);
});

test('进入点评时空状态主按钮禁用，非法上传显示可读错误并保持禁用', async () => {
  const environment = await renderApp();

  try {
    await click(getButton('开始点评'));
    const analyzeButton = getButton('开始分析') as HTMLButtonElement;
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    assert.equal(analyzeButton.disabled, true);
    await uploadFile(fileInput, new File([new Uint8Array(1024)], 'notes.txt', { type: 'text/plain' }));

    const uploadError = document.querySelector('.upload-error[role="alert"]');
    assert.ok(uploadError);
    assert.match(uploadError.textContent ?? '', /支持|格式|照片/);
    assert.equal(analyzeButton.disabled, true);
    assert.equal(document.querySelector('.empty-preview span')?.textContent, '待上传');
    assert.equal(document.querySelector('.empty-preview span')?.textContent?.includes('待审'), false);

    const css = await readFile(new URL('../src/theme-editorial-monochrome.css', import.meta.url), 'utf8');
    assert.match(css, /\.page-review \.empty-preview\.light-table-empty span[\s\S]*?border:\s*1px solid var\(--em-line-dark\)/);
    assert.match(css, /\.page-review \.empty-preview\.light-table-empty span[\s\S]*?background:\s*var\(--em-window-surface\)/);
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
    assert.equal(document.querySelector('.report-save-status'), null);
    assert.doesNotMatch(document.body.textContent ?? '', /已自动保存到此浏览器/);
    assert.equal(getButtons('点评新照片').length, 0);
    assert.equal(getButtons('返回历史记录').length, 0);
    assert.match(document.querySelector('#export-report-help')?.textContent ?? '', /简易报告适合分享传播，详细报告适合保存复盘/);
    assert.match(document.querySelector('#copy-report-help')?.textContent ?? '', /将文字版报告复制至剪贴板/);

    await click(getButton('导出报告图片'));
    const exportOptions = [...document.querySelectorAll<HTMLButtonElement>('.report-export-menu button')];
    assert.equal(exportOptions.length, 2);
    assert.match(document.querySelector('.report-export-intro')?.textContent ?? '', /根据分享或复盘目的，选择不同的信息密度/);
    assert.match(exportOptions[0].textContent ?? '', /简易报告/);
    assert.match(exportOptions[0].textContent ?? '', /4:5 社交分享海报/);
    assert.match(exportOptions[0].textContent ?? '', /前后对比、评审结论、综合与五维评分/);
    assert.match(exportOptions[1].textContent ?? '', /详细报告/);
    assert.match(exportOptions[1].textContent ?? '', /完整评审长图/);
    assert.match(exportOptions[1].textContent ?? '', /保存评测内容并随时复盘/);
    assert.doesNotMatch(exportOptions[1].textContent ?? '', /3–4 页|分为/);
    assert.equal(getButtons('分享').length, 0);

    const darkroomCss = await readFile(new URL('../src/theme-darkroom.css', import.meta.url), 'utf8');
    assert.match(darkroomCss, /\.page-report\.report-export-host > \.report-section\.page-view[\s\S]*?width: 1320px !important[\s\S]*?background: var\(--em-canvas\) !important/);
    assert.match(darkroomCss, /\.page-report\.report-export-host \.report-export-artwork[\s\S]*?opacity: 0\.22[\s\S]*?mask-image: linear-gradient/);
    assert.match(darkroomCss, /\.page-report\.report-export-host \.report-header-tools,[\s\S]*?\.report-side-nav,[\s\S]*?\.post-preview-actions,[\s\S]*?display: none !important/);
    assert.match(darkroomCss, /\.report-share-poster[\s\S]*?width: 1080px[\s\S]*?height: auto[\s\S]*?min-height: 1350px/);
    assert.match(darkroomCss, /\.report-share-poster[\s\S]*?grid-template-rows:[^;]*?minmax\(430px, auto\)/);
    assert.match(darkroomCss, /\.report-share-poster[\s\S]*?grid-template-rows:[^;]*?minmax\(190px, 1fr\) 38px/);
    assert.match(darkroomCss, /\.share-poster-comparison figure[\s\S]*?grid-template-rows: minmax\(392px, auto\) 38px/);
    assert.match(darkroomCss, /\.share-poster-comparison img[\s\S]*?width: 100%[\s\S]*?height: auto !important[\s\S]*?object-fit: contain !important/);
    assert.match(darkroomCss, /\.share-poster-footer[\s\S]*?position: relative[\s\S]*?bottom: auto/);
    assert.ok(document.querySelector('.report-share-poster'));
    assert.match(document.querySelector('.report-share-poster')?.textContent ?? '', /核心优化建议/);
    assert.doesNotMatch(darkroomCss, /\.page-report \.diagnostic-report\.is-exporting[\s\S]*?#eee7d8/);
  } finally {
    await cleanupEnvironment(environment);
  }
});

test('优化预览生成期间不允许导出，并在选项中提示等待完成', async () => {
  const record = createHistoryRecord('export-pending', '2026-02-01T10:00:00Z', 0);
  record.report.optimizationPlan = {
    summary: '收紧主体关系。',
    imagePrompt: '保留原图内容，只调整主体位置关系。',
    items: [{
      kind: 'reframe',
      instruction: '向主体方向收紧取景。',
      target: '主体与画面边缘',
      reason: '让观看入口更清楚。',
      expectedEffect: '主体更集中。',
    }],
  };
  const originalFetch = globalThis.fetch;
  const environment = await renderApp([record]);

  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (String(input).includes('/api/render-preview')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ preview: { imageDataUrl, width: 1200, height: 800 } }),
        } as Response;
      }
      if (String(input).includes('/api/generate-optimized-image')) {
        return new Promise<Response>(() => undefined);
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    }) as typeof fetch;

    await click(getMainNavigationButton('分析报告'));
    await click(getButton('导出报告图片'));
    assert.match(document.querySelector('.report-export-pending')?.textContent ?? '', /优化预览尚未生成完成/);
    const exportOptions = [...document.querySelectorAll<HTMLButtonElement>('.report-export-menu button')];
    assert.equal(exportOptions.length, 2);
    assert.equal(exportOptions.every((button) => button.disabled), true);
  } finally {
    globalThis.fetch = originalFetch;
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

    assert.match(document.body.textContent ?? '', /历史记录/);
    assert.match(document.body.textContent ?? '', /值得保留/);
    assert.match(document.body.textContent ?? '', /画面区域/);
    assert.match(document.body.textContent ?? '', /评分依据/);
  } finally {
    await cleanupEnvironment(environment);
  }
});
