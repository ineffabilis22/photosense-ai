import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import test from 'node:test';

const appPort = 18879;
const providerPort = 18880;
const imageDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function listen(server: http.Server, port: number) {
  return new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
}

function close(server: http.Server) {
  return new Promise<void>((resolve) => server.close(() => resolve()));
}

async function waitForHealth(logs: () => string, port = appPort) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  assert.fail(`PhotoSense 测试服务未启动。\n${logs()}`);
}

async function stopChild(child: ReturnType<typeof spawn>) {
  if (child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise<void>((resolve) => child.once('exit', () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 2000)),
  ]);
}

test('OpenAI-compatible 完整链路传递新提示词并返回照片针对性报告', { timeout: 15_000 }, async () => {
  const providerRequests: Array<Record<string, any>> = [];
  const imageProviderRequests: Array<{ body: string; authorization?: string }> = [];
  const providerReport = {
    overall: '红伞人物是明确主体，湿润路面提供夜景层次。',
    scoreBands: undefined,
    scoreBreakdown: {
      构图: { fundamentals: { subjectHierarchy: 5, placementBalance: 4, edgeControl: 3, depthAndGeometry: 4 }, refinement: 2, evidence: '人物和红伞形成清楚入口，但右侧亮点仍分散重心。' },
      光线: { fundamentals: { exposureTone: 4, directionQuality: 4, subjectSeparation: 3, highlightShadowControl: 3 }, refinement: 2, evidence: '夜景层次可读，但路面高光和人物暗部还可进一步控制。' },
      色彩: { fundamentals: { harmony: 4, separation: 4, paletteIntent: 4, consistency: 4 }, refinement: 4, evidence: '红伞承担记忆点，冷暖关系稳定且没有明显杂色。' },
      叙事: { fundamentals: { subjectClarity: 4, contextRelation: 4, momentEmotion: 3, specificity: 3 }, refinement: 2, evidence: '人物、红伞与街道形成现场关系，但动作仍不够决定性。' },
      技术完成度: { fundamentals: { focusDetail: 1, exposureIntegrity: 3, perspectiveProcessing: 3, mediumFit: 3 }, refinement: 1, evidence: '夜景氛围保留，但人物动作与环境细节存在明显失焦。' },
    },
    scoreReasons: {
      构图: '主体清楚，但右侧视觉重量偏高。',
      光线: '夜景层次可读，路面高光略亮。',
      色彩: '红伞形成稳定的色彩记忆点。',
      叙事: '人物动作与街道环境形成现场关系。',
      技术完成度: '严重失焦使人物动作和环境细节无法可靠辨认。',
    },
    genreAssessment: {
      detectedGenre: '街头摄影',
      confidence: 0.91,
      reason: '行人与街道环境共同构成现场关系。',
    },
    composition: '结论：主体清楚。说明：右侧车灯略有干扰。方向：从右侧轻微收紧。',
    lighting: '结论：夜景层次可读。说明：路面高光略亮。方向：轻微回收高光。',
    colour: '结论：红色形成记忆点。说明：冷暖关系明确。方向：保持红伞饱和度。',
    storytelling: '结论：人物动作可读。说明：背景线索支持现场感。方向：强化人物与街景关系。',
    technical: '结论：清晰度稳定。说明：暗部仍有细节。方向：避免过度降噪。',
    suggestions: ['从右侧轻微收紧。', '压低路面高光。', '保留红伞色彩。'],
    verdict: {
      title: '红伞建立了清楚的夜景入口',
      summary: '主体明确，背景仍可收紧。',
      mainIssue: '右侧车灯分散注意。',
      nextStep: '从右侧轻微裁切。',
      tags: ['红伞', '夜景'],
    },
    photoSpecific: {
      strength: '红伞与深色街景形成明确对比。',
      priorityIssue: '右侧车灯抢走红伞的注意力。',
      affectedArea: '画面右侧边缘',
      nextAction: '从右侧轻微裁切。',
      crop: { ratio: '4:3', direction: '从右侧收紧', rationale: '去除车灯并保留人物关系。' },
    },
    postProcessing: {
      crop: { suggestion: '从右侧轻微裁切。', reason: '去除车灯。', expectedEffect: '主体更集中。' },
      tone: { suggestion: '压低路面高光。', reason: '保持夜景层次。', expectedEffect: '明暗更稳定。' },
      masking: { suggestion: '轻提人物面部。', reason: '人物是叙事核心。', expectedEffect: '动作更可读。' },
    },
    optimizationPlan: {
      summary: '清理右侧干扰，并让红伞人物更集中。',
      imagePrompt: '保留雨夜街道质感和红伞人物身份，只整理右侧车灯。',
      items: [
        { kind: 'cleanup', instruction: '移除右侧边缘分散注意力的车灯。', target: '画面右侧边缘', reason: '车灯亮度高于主体。', expectedEffect: '视线更快回到红伞人物。' },
        { kind: 'reframe', instruction: '轻微收紧右侧画面。', target: '人物与右侧边缘', reason: '人物目前略偏离视觉重心。', expectedEffect: '人物与街景关系更集中。' },
        { kind: 'tone', instruction: '轻微压低湿润路面的局部亮部。', target: '人物脚下至右下角路面', reason: '反光亮度接近红伞。', expectedEffect: '保留夜景层次并减少视线偏移。' },
        { kind: 'local-adjustment', instruction: '小幅提升红伞边缘与人物上身的明暗区分。', target: '红伞及人物上身', reason: '深色衣着与背景局部重叠。', expectedEffect: '人物轮廓更清楚但仍保持夜景质感。' },
        { kind: 'perspective', instruction: '轻微校正右侧建筑竖线。', target: '画面右侧建筑边缘', reason: '竖线向内倾斜形成不必要的压迫感。', expectedEffect: '街景结构更稳定。' },
      ],
    },
    nextShooting: { summary: '继续观察人物与灯光关系。', items: ['等待动作更完整。', '避开边缘车灯。', '保持低机位。'] },
  };
  const provider = http.createServer((request, response) => {
    if (request.url === '/v1/images/edits') {
      const chunks: Buffer[] = [];
      request.on('data', (chunk) => { chunks.push(Buffer.from(chunk)); });
      request.on('end', () => {
        imageProviderRequests.push({
          body: Buffer.concat(chunks).toString('utf8'),
          authorization: request.headers.authorization,
        });
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ data: [{ b64_json: imageDataUrl.split(',')[1] }] }));
      });
      return;
    }

    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      providerRequests.push(JSON.parse(body));
      const responseReport = providerRequests.length === 1
        ? providerReport
        : providerRequests.length === 2
          ? {
            ...providerReport,
            scoreBands: { 构图: '偏弱', 光线: '偏弱', 色彩: '严重问题', 叙事: '严重问题', 技术完成度: '严重问题' },
            scoreReasons: {
              构图: '第二次请求产生了漂移理由。',
              光线: '第二次请求产生了漂移理由。',
              色彩: '第二次请求产生了漂移理由。',
              叙事: '第二次请求产生了漂移理由。',
              技术完成度: '第二次请求产生了漂移理由。',
            },
          }
          : {
              ...providerReport,
              scoreBreakdown: undefined,
              scoreBands: { 构图: '作品级', 光线: '强', 色彩: '强', 叙事: '强', 技术完成度: '强' },
              verdict: {
                ...providerReport.verdict,
                title: '光线、空间与色彩共同形成成熟画面',
                mainIssue: '为了完整报告而填写的轻微问题。',
                nextStep: '保持当前处理。',
              },
              photoSpecific: {
                ...providerReport.photoSpecific,
                priorityIssue: '为了完整报告而填写的轻微问题。',
                affectedArea: '画面边缘',
                nextAction: '保持当前处理。',
              },
            };
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        choices: [{ message: { content: JSON.stringify(responseReport) } }],
      }));
    });
  });

  await listen(provider, providerPort);
  let stdout = '';
  let stderr = '';
  const child = spawn(process.execPath, ['server/start.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(appPort),
      NODE_ENV: 'test',
      ENABLE_HISTORY_EXPORT: 'false',
      OPENAI_RELAY_BASE_URL: `http://127.0.0.1:${providerPort}/v1`,
      OPENAI_RELAY_API_KEY: 'test-key',
      OPENAI_RELAY_MODEL: 'test-vision-model',
      IMAGE_RELAY_BASE_URL: `http://127.0.0.1:${providerPort}`,
      IMAGE_RELAY_API_KEY: 'test-image-key',
      IMAGE_RELAY_MODEL: 'gpt-image-2',
      GEMINI_RELAY_BASE_URL: '',
      GEMINI_RELAY_API_KEY: '',
      ANTHROPIC_RELAY_BASE_URL: '',
      ANTHROPIC_RELAY_API_KEY: '',
      GEMINI_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk) => { stdout += String(chunk); });
  child.stderr?.on('data', (chunk) => { stderr += String(chunk); });

  try {
    await waitForHealth(() => `${stdout}\n${stderr}`);
    const healthResponse = await fetch(`http://127.0.0.1:${appPort}/api/health`);
    const health = await healthResponse.json();
    assert.equal(health.imageProviderConfigured, true);
    async function requestReport(skillLevel: '爱好者水平' | '进阶水平', genre = '人像摄影') {
      const response = await fetch(`http://127.0.0.1:${appPort}/api/analyze-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl,
          fileName: 'street.png',
          medium: '数码摄影',
          genre,
          skillLevel,
          workTitle: '雨夜红伞',
        }),
      });
      return { response, data: await response.json() };
    }

    const advancedResult = await requestReport('进阶水平');
    const hobbyistResult = await requestReport('爱好者水平');
    const strongResult = await requestReport('进阶水平', '风景摄影');
    const { response, data } = advancedResult;

    assert.equal(response.status, 200, `${stdout}\n${stderr}`);
    assert.equal(data.ok, true);
    assert.equal(data.report.photoSpecific.affectedArea, '画面右侧边缘');
    assert.equal(data.report.photoSpecific.crop.direction, '从右侧收紧');
    assert.equal(data.report.scoreReasons.构图, '主体清楚，但右侧视觉重量偏高。');
    assert.equal(data.report.scoreVersion, 'v4-rubric');
    assert.deepEqual(data.report.scores, { 构图: 72, 光线: 64, 色彩: 80, 叙事: 64, 技术完成度: 44 });
    assert.deepEqual(hobbyistResult.data.report.scores, { 构图: 80, 光线: 70, 色彩: 80, 叙事: 70, 技术完成度: 50 });
    assert.notDeepEqual(hobbyistResult.data.report.scores, data.report.scores);
    assert.deepEqual(hobbyistResult.data.report.scoreBands, { 构图: '强', 光线: '成立', 色彩: '强', 叙事: '成立', 技术完成度: '偏弱' });
    assert.equal(hobbyistResult.data.report.scoreReasons.构图, '主体清楚，但右侧视觉重量偏高。');
    assert.doesNotMatch(JSON.stringify(hobbyistResult.data.report.scoreReasons), /漂移理由/);
    assert.equal(strongResult.data.report.improvementPriority, 'none');
    assert.equal(strongResult.data.report.verdict.mainIssue, '未发现影响画面成立的明显问题。');
    assert.equal(strongResult.data.report.photoSpecific.priorityIssue, '未发现影响画面成立的明显问题。');
    assert.equal(strongResult.data.report.photoSpecific.affectedArea, '不适用');
    assert.match(data.report.lighting, /高光/);
    assert.doesNotMatch(hobbyistResult.data.report.lighting, /高光|阴影|曝光/);
    assert.match(hobbyistResult.data.report.lighting, /最亮区域/);
    assert.doesNotMatch(
      JSON.stringify(hobbyistResult.data.report),
      /高光|阴影|中间调|动态范围|宽容度|主体分离|边缘管理|白平衡|曝光|\bEV\b/,
    );
    assert.deepEqual(data.report.genreAssessment, {
      detectedGenre: '街头摄影',
      confidence: 0.91,
      reason: '行人与街道环境共同构成现场关系。',
    });
    assert.match(data.report.reviewContext.genreFocus, /人像摄影/);
    assert.equal(providerRequests.length, 12);
    const getPrompt = (request: any) => request.messages?.[0]?.content?.find((item: any) => item.type === 'text')?.text ?? '';
    const capturedRequest: any = providerRequests.find((request) => getPrompt(request).includes('"photoSpecific"'));
    const hobbyistRequest: any = providerRequests.find((request) => getPrompt(request).includes('评价水平：爱好者水平'));

    const content = capturedRequest.messages?.[0]?.content;
    const prompt = content?.find((item: any) => item.type === 'text')?.text ?? '';
    const image = content?.find((item: any) => item.type === 'image_url')?.image_url?.url;
    assert.match(prompt, /"photoSpecific"/);
    assert.match(prompt, /"scoreReasons"/);
    assert.match(prompt, /"scoreBands"/);
    assert.match(prompt, /"genreAssessment"/);
    assert.match(prompt, /"optimizationPlan"/);
    assert.match(prompt, /不能固定凑成裁剪、影调、局部调整三项/);
    assert.match(prompt, /通常给出 2-4 条，最多 5 条/);
    assert.match(prompt, /第一条优先选择最适合在预览图中直观呈现的动作/);
    assert.match(prompt, /不能只产生影调差异/);
    assert.match(prompt, /独立判断最接近的题材/);
    assert.doesNotMatch(prompt, /分数居中/);
    assert.doesNotMatch(prompt, /"构图": 78/);
    assert.match(prompt, /affectedArea 只描述/);
    assert.match(prompt, /可以使用高光、阴影/);
    assert.match(prompt, /scoreBreakdown/);
    assert.match(prompt, /不要为了提供建议而虚构问题/);
    assert.doesNotMatch(prompt, /"scores"\s*:/);
    const hobbyistPrompt = hobbyistRequest.messages?.[0]?.content?.find((item: any) => item.type === 'text')?.text ?? '';
    assert.match(hobbyistPrompt, /使用日常语言/);
    assert.match(hobbyistPrompt, /不直接使用高光、阴影/);
    assert.match(hobbyistPrompt, /四项基础能力/);
    assert.equal(image, imageDataUrl);

    const optimizedResponse = await fetch(`http://127.0.0.1:${appPort}/api/generate-optimized-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageDataUrl,
        medium: '数码摄影',
        optimizationPlan: data.report.optimizationPlan,
        nextShooting: data.report.nextShooting,
      }),
    });
    const optimized = await optimizedResponse.json();
    assert.equal(optimizedResponse.status, 200, `${stdout}\n${stderr}`);
    assert.equal(optimized.ok, true);
    assert.match(optimized.imageUrl, /^data:image\/png;base64,/);
    assert.equal(imageProviderRequests.length, 1);
    assert.equal(imageProviderRequests[0].authorization, 'Bearer test-image-key');
    assert.match(imageProviderRequests[0].body, /name="model"/);
    assert.match(imageProviderRequests[0].body, /gpt-image-2/);
    assert.match(imageProviderRequests[0].body, /name="image\[\]"; filename="photosense-source.png"/);
    assert.match(imageProviderRequests[0].body, /不要添加图上批注/);
    assert.match(imageProviderRequests[0].body, /严格保持仍出现在画面中的招牌、文字、数字、车牌与标志/);
    assert.match(imageProviderRequests[0].body, /移除右侧边缘分散注意力的车灯/);
    assert.match(imageProviderRequests[0].body, /轻微校正右侧建筑竖线/);
    assert.match(imageProviderRequests[0].body, /同一现场按建议再拍一次后的更优拍摄结果/);
    assert.match(imageProviderRequests[0].body, /必须执行的主要动作：等待动作更完整/);
    assert.match(imageProviderRequests[0].body, /可选的辅助动作[\s\S]*保持低机位/);
    assert.match(imageProviderRequests[0].body, /拍摄动作的优先级高于普通影调优化/);
    assert.match(imageProviderRequests[0].body, /必须把主要动作落实为一眼可辨认的空间、构图或拍摄瞬间变化/);
    assert.match(imageProviderRequests[0].body, /不得只调整曝光、对比度、明暗或色彩/);
    assert.match(imageProviderRequests[0].body, /等待动作更完整.*重绘为紧邻且可信的更完整动作瞬间/);
    assert.match(imageProviderRequests[0].body, /提高或降低机位.*透视关系出现可见变化/);
    assert.match(imageProviderRequests[0].body, /如果修改前后并排时只能看出影调差别.*结果不合格/);
    assert.match(imageProviderRequests[0].body, /这些保留要求不能抵消建议明确要求的主体移动、姿态变化、重新取景、遮挡清理或透视调整/);

    const artworkResponse = await fetch(`http://127.0.0.1:${appPort}/api/generate-report-artwork`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageDataUrl,
        mode: 'detailed',
        reportContent: '01 评审结论\n红伞建立了清楚的夜景入口\n03 优化建议\n从右侧轻微裁切。',
      }),
    });
    const artwork = await artworkResponse.json();
    assert.equal(artworkResponse.status, 200, `${stdout}\n${stderr}`);
    assert.equal(artwork.ok, true);
    assert.match(artwork.artworkUrl, /^data:image\/png;base64,/);
    assert.equal(artwork.styleVersion, 'darkroom-editorial-report-v1');
    assert.equal(imageProviderRequests.length, 2);
    assert.match(imageProviderRequests[1].body, /PhotoSense AI 的详细报告/);
    assert.match(imageProviderRequests[1].body, /严禁生成任何文字、汉字、字母、数字/);
    assert.match(imageProviderRequests[1].body, /红伞建立了清楚的夜景入口/);
  } finally {
    await stopChild(child);
    await close(provider);
  }
});

test('上游连接失败重试耗尽后返回 503', { timeout: 15_000 }, async () => {
  const retryAppPort = 18883;
  const unavailableProviderPort = 18884;
  let stdout = '';
  let stderr = '';
  const child = spawn(process.execPath, ['server/start.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(retryAppPort),
      NODE_ENV: 'test',
      ENABLE_HISTORY_EXPORT: 'false',
      OPENAI_RELAY_BASE_URL: `http://127.0.0.1:${unavailableProviderPort}/v1`,
      OPENAI_RELAY_API_KEY: 'test-key',
      OPENAI_RELAY_MODEL: 'test-vision-model',
      OPENAI_RELAY_TIMEOUT_MS: '5000',
      IMAGE_RELAY_BASE_URL: '',
      IMAGE_RELAY_API_KEY: '',
      IMAGE_RELAY_MODEL: '',
      GEMINI_RELAY_BASE_URL: '',
      GEMINI_RELAY_API_KEY: '',
      ANTHROPIC_RELAY_BASE_URL: '',
      ANTHROPIC_RELAY_API_KEY: '',
      GEMINI_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk) => { stdout += String(chunk); });
  child.stderr?.on('data', (chunk) => { stderr += String(chunk); });

  try {
    await waitForHealth(() => `${stdout}\n${stderr}`, retryAppPort);
    const response = await fetch(`http://127.0.0.1:${retryAppPort}/api/analyze-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageDataUrl,
        fileName: 'unavailable.png',
        medium: '数码摄影',
        genre: '街头摄影',
        skillLevel: '爱好者水平',
      }),
    });
    const data = await response.json();
    assert.equal(response.status, 503, `${stdout}\n${stderr}`);
    assert.equal(data.ok, false);
    assert.match(data.error, /当前可用的报告模型均未能完成分析/);
    assert.match(`${stdout}\n${stderr}`, /retrying once/);
  } finally {
    await stopChild(child);
  }
});

test('上游瞬时连接失败时只重试一次并成功返回报告', { timeout: 15_000 }, async () => {
  const retryAppPort = 18881;
  const retryProviderPort = 18882;
  let providerRequestCount = 0;
  const provider = http.createServer((request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      providerRequestCount += 1;
      assert.ok(body.includes('data:image/png;base64,'));
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              scoreBands: { 构图: '成立', 光线: '成立', 色彩: '成立', 叙事: '成立', 技术完成度: '成立' },
            }),
          },
        }],
      }));
    });
  });

  let stdout = '';
  let stderr = '';
  const child = spawn(process.execPath, ['server/start.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(retryAppPort),
      NODE_ENV: 'test',
      ENABLE_HISTORY_EXPORT: 'false',
      OPENAI_RELAY_BASE_URL: `http://127.0.0.1:${retryProviderPort}/v1`,
      OPENAI_RELAY_API_KEY: 'test-key',
      OPENAI_RELAY_MODEL: 'test-vision-model',
      OPENAI_RELAY_TIMEOUT_MS: '5000',
      IMAGE_RELAY_BASE_URL: '',
      IMAGE_RELAY_API_KEY: '',
      IMAGE_RELAY_MODEL: '',
      GEMINI_RELAY_BASE_URL: '',
      GEMINI_RELAY_API_KEY: '',
      ANTHROPIC_RELAY_BASE_URL: '',
      ANTHROPIC_RELAY_API_KEY: '',
      GEMINI_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk) => { stdout += String(chunk); });
  child.stderr?.on('data', (chunk) => { stderr += String(chunk); });

  try {
    await waitForHealth(() => `${stdout}\n${stderr}`, retryAppPort);
    const requestPromise = fetch(`http://127.0.0.1:${retryAppPort}/api/analyze-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageDataUrl,
        fileName: 'retry.png',
        medium: '数码摄影',
        genre: '街头摄影',
        skillLevel: '爱好者水平',
      }),
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
    await listen(provider, retryProviderPort);

    const response = await requestPromise;
    const data = await response.json();
    assert.equal(response.status, 200, `${stdout}\n${stderr}`);
    assert.equal(data.ok, true);
    assert.ok(providerRequestCount >= 1 && providerRequestCount <= 4);
    assert.match(`${stdout}\n${stderr}`, /retrying once/);
  } finally {
    await stopChild(child);
    await close(provider);
  }
});

test('自动分析优先使用 GPT，失败后切换到其他报告模型且不暴露模型信息', { timeout: 15_000 }, async () => {
  const fallbackAppPort = 18885;
  const fallbackProviderPort = 18886;
  const requestedModels: string[] = [];
  const provider = http.createServer((request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      const payload = JSON.parse(body);
      requestedModels.push(payload.model);
      if (payload.model === 'gpt-5.6-luna') {
        response.writeHead(503, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: { message: 'temporarily unavailable' } }));
        return;
      }
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          scoreBands: { 构图: '成立', 光线: '成立', 色彩: '成立', 叙事: '成立', 技术完成度: '成立' },
        }) } }],
      }));
    });
  });
  await listen(provider, fallbackProviderPort);

  let stdout = '';
  let stderr = '';
  const child = spawn(process.execPath, ['server/start.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(fallbackAppPort),
      NODE_ENV: 'test',
      ENABLE_HISTORY_EXPORT: 'false',
      REPORT_RELAY_BASE_URL: `http://127.0.0.1:${fallbackProviderPort}/v1`,
      REPORT_RELAY_API_KEY: 'test-key',
      REPORT_MODEL_GPT: 'gpt-5.6-luna',
      REPORT_MODEL_CLAUDE: 'claude-sonnet-5',
      REPORT_MODEL_DEEPSEEK: 'deepseek-v4.1-flash',
      REPORT_MODEL_GEMINI: 'gemini-3-flash',
      IMAGE_RELAY_BASE_URL: '',
      IMAGE_RELAY_API_KEY: '',
      GEMINI_RELAY_BASE_URL: '',
      GEMINI_RELAY_API_KEY: '',
      ANTHROPIC_RELAY_BASE_URL: '',
      ANTHROPIC_RELAY_API_KEY: '',
      GEMINI_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk) => { stdout += String(chunk); });
  child.stderr?.on('data', (chunk) => { stderr += String(chunk); });

  try {
    await waitForHealth(() => `${stdout}\n${stderr}`, fallbackAppPort);
    const response = await fetch(`http://127.0.0.1:${fallbackAppPort}/api/analyze-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageDataUrl,
        fileName: 'fallback.png',
        medium: '数码摄影',
        genre: '街头摄影',
        skillLevel: '爱好者水平',
      }),
    });
    const data = await response.json();
    assert.equal(response.status, 200, `${stdout}\n${stderr}`);
    assert.equal(data.ok, true);
    assert.deepEqual([...requestedModels].sort(), [
      'claude-sonnet-5',
      'deepseek-v4.1-flash',
      'gemini-3-flash',
      'gpt-5.6-luna',
    ].sort());
    assert.equal(data.report.reportModel, undefined);
  } finally {
    await stopChild(child);
    await close(provider);
  }
});

test('自动分析使用第一个有效报告并取消较慢的模型请求', { timeout: 15_000 }, async () => {
  const raceAppPort = 18889;
  const raceProviderPort = 18890;
  const startedModels: string[] = [];
  const provider = http.createServer((request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      const payload = JSON.parse(body);
      const model = payload.model as string;
      startedModels.push(model);
      const delay = model === 'claude-sonnet-5'
        ? 25
        : model === 'deepseek-v4.1-flash'
          ? 150
          : model === 'gpt-5.6-luna'
            ? 350
            : 500;

      setTimeout(() => {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            overall: `${model} 获胜`,
            scoreBands: { 构图: '成立', 光线: '成立', 色彩: '成立', 叙事: '成立', 技术完成度: '成立' },
          }) } }],
        }));
      }, delay);
    });
  });
  await listen(provider, raceProviderPort);

  let stdout = '';
  let stderr = '';
  const child = spawn(process.execPath, ['server/start.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(raceAppPort),
      NODE_ENV: 'test',
      ENABLE_HISTORY_EXPORT: 'false',
      REPORT_RELAY_BASE_URL: `http://127.0.0.1:${raceProviderPort}/v1`,
      REPORT_RELAY_API_KEY: 'test-key',
      REPORT_MODEL_GPT: 'gpt-5.6-luna',
      REPORT_MODEL_CLAUDE: 'claude-sonnet-5',
      REPORT_MODEL_DEEPSEEK: 'deepseek-v4.1-flash',
      REPORT_MODEL_GEMINI: 'gemini-3-flash',
      IMAGE_RELAY_BASE_URL: '',
      IMAGE_RELAY_API_KEY: '',
      GEMINI_RELAY_BASE_URL: '',
      GEMINI_RELAY_API_KEY: '',
      ANTHROPIC_RELAY_BASE_URL: '',
      ANTHROPIC_RELAY_API_KEY: '',
      GEMINI_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk) => { stdout += String(chunk); });
  child.stderr?.on('data', (chunk) => { stderr += String(chunk); });

  try {
    await waitForHealth(() => `${stdout}\n${stderr}`, raceAppPort);
    const response = await fetch(`http://127.0.0.1:${raceAppPort}/api/analyze-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageDataUrl,
        fileName: 'race.png',
        medium: '数码摄影',
        genre: '街头摄影',
        skillLevel: '爱好者水平',
      }),
    });
    const data = await response.json();

    assert.equal(response.status, 200, `${stdout}\n${stderr}`);
    assert.equal(data.ok, true);
    assert.match(data.report.overall, /claude-sonnet-5 获胜/);
    assert.deepEqual([...startedModels].sort(), [
      'claude-sonnet-5',
      'deepseek-v4.1-flash',
      'gemini-3-flash',
      'gpt-5.6-luna',
    ].sort());
    assert.match(`${stdout}\n${stderr}`, /report model race winner: claude/);
  } finally {
    await stopChild(child);
    await close(provider);
  }
});

test('自动生图优先使用 GPT Image，失败后切换到其他生图模型且不暴露模型信息', { timeout: 15_000 }, async () => {
  const imageAppPort = 18887;
  const imageProviderPort = 18888;
  const requestedModels: string[] = [];
  const provider = http.createServer((request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      const model = /name="model"\r?\n\r?\n([^\r\n]+)/.exec(body)?.[1] || '';
      requestedModels.push(model);
      if (model === 'gpt-image-2') {
        response.writeHead(503, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ error: { message: 'temporarily unavailable' } }));
        return;
      }
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ data: [{ b64_json: imageDataUrl.split(',')[1] }] }));
    });
  });
  await listen(provider, imageProviderPort);

  let stdout = '';
  let stderr = '';
  const child = spawn(process.execPath, ['server/start.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(imageAppPort),
      NODE_ENV: 'test',
      ENABLE_HISTORY_EXPORT: 'false',
      REPORT_RELAY_BASE_URL: '',
      REPORT_RELAY_API_KEY: '',
      OPENAI_RELAY_BASE_URL: '',
      OPENAI_RELAY_API_KEY: '',
      IMAGE_RELAY_BASE_URL: `http://127.0.0.1:${imageProviderPort}/v1`,
      IMAGE_RELAY_API_KEY: 'test-image-key',
      IMAGE_RELAY_MODEL: '',
      IMAGE_MODEL_GPT: 'gpt-image-2',
      IMAGE_MODEL_NANO_BANANA: 'nano-banana-2',
      IMAGE_MODEL_GROK_IMAGE: 'grok-image',
      GEMINI_RELAY_BASE_URL: '',
      GEMINI_RELAY_API_KEY: '',
      ANTHROPIC_RELAY_BASE_URL: '',
      ANTHROPIC_RELAY_API_KEY: '',
      GEMINI_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk) => { stdout += String(chunk); });
  child.stderr?.on('data', (chunk) => { stderr += String(chunk); });

  try {
    await waitForHealth(() => `${stdout}\n${stderr}`, imageAppPort);
    const response = await fetch(`http://127.0.0.1:${imageAppPort}/api/generate-optimized-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageDataUrl,
        medium: '数码摄影',
        optimizationPlan: {
          summary: '保留主体并改善高光。',
          imagePrompt: '',
          items: [{ kind: 'tone', instruction: '适度压低高光。', target: '画面亮部', reason: '高光略亮。', expectedEffect: '层次更稳定。' }],
        },
        nextShooting: { summary: '', items: [] },
      }),
    });
    const data = await response.json();
    assert.equal(response.status, 200, `${stdout}\n${stderr}`);
    assert.equal(data.ok, true);
    assert.match(data.imageUrl, /^data:image\/png;base64,/);
    assert.deepEqual(requestedModels, ['gpt-image-2', 'nano-banana-2']);
    assert.equal(data.modelInfo, undefined);
  } finally {
    await stopChild(child);
    await close(provider);
  }
});
