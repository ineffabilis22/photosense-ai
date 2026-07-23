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

async function waitForHealth(logs: () => string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${appPort}/api/health`);
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
  const providerReport = {
    overall: '红伞人物是明确主体，湿润路面提供夜景层次。',
    scoreBands: { 构图: '作品级', 光线: '强', 色彩: '成立', 叙事: '普通', 技术完成度: '严重问题' },
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
    nextShooting: { summary: '继续观察人物与灯光关系。', items: ['等待动作更完整。', '避开边缘车灯。', '保持低机位。'] },
  };
  const provider = http.createServer((request, response) => {
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
    assert.equal(data.report.scoreVersion, 'v3');
    assert.deepEqual(data.report.scores, { 构图: 95, 光线: 85, 色彩: 75, 叙事: 65, 技术完成度: 35 });
    assert.deepEqual(hobbyistResult.data.report.scores, data.report.scores);
    assert.deepEqual(hobbyistResult.data.report.scoreBands, data.report.scoreBands);
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
    assert.equal(providerRequests.length, 3);
    const capturedRequest: any = providerRequests[0];
    const hobbyistRequest: any = providerRequests[1];

    const content = capturedRequest.messages?.[0]?.content;
    const prompt = content?.find((item: any) => item.type === 'text')?.text ?? '';
    const image = content?.find((item: any) => item.type === 'image_url')?.image_url?.url;
    assert.match(prompt, /"photoSpecific"/);
    assert.match(prompt, /"scoreReasons"/);
    assert.match(prompt, /"scoreBands"/);
    assert.match(prompt, /"genreAssessment"/);
    assert.match(prompt, /独立判断最接近的题材/);
    assert.doesNotMatch(prompt, /分数居中/);
    assert.doesNotMatch(prompt, /"构图": 78/);
    assert.match(prompt, /affectedArea 只描述/);
    assert.match(prompt, /可以使用高光、阴影/);
    assert.match(prompt, /基础视觉分/);
    assert.match(prompt, /不要为了提供建议而虚构问题/);
    assert.doesNotMatch(prompt, /"scores"\s*:/);
    const hobbyistPrompt = hobbyistRequest.messages?.[0]?.content?.find((item: any) => item.type === 'text')?.text ?? '';
    assert.match(hobbyistPrompt, /使用日常语言/);
    assert.match(hobbyistPrompt, /不直接使用高光、阴影/);
    assert.match(hobbyistPrompt, /基础视觉分/);
    assert.equal(image, imageDataUrl);
  } finally {
    await stopChild(child);
    await close(provider);
  }
});
