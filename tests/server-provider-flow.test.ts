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
  let providerRequest: Record<string, any> | null = null;
  const providerReport = {
    overall: '红伞人物是明确主体，湿润路面提供夜景层次。',
    scores: { 构图: 78, 光线: 74, 色彩: 84, 叙事: 72, 技术完成度: 76 },
    scoreReasons: {
      构图: '主体清楚，但右侧视觉重量偏高。',
      光线: '夜景层次可读，路面高光略亮。',
      色彩: '红伞形成稳定的色彩记忆点。',
      叙事: '人物动作与街道环境形成现场关系。',
      技术完成度: '清晰度和曝光足以支撑观看。',
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
      providerRequest = JSON.parse(body);
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        choices: [{ message: { content: JSON.stringify(providerReport) } }],
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
    const response = await fetch(`http://127.0.0.1:${appPort}/api/analyze-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageDataUrl,
        fileName: 'street.png',
        medium: '数码摄影',
        genre: '街头摄影',
        skillLevel: '进阶',
        workTitle: '雨夜红伞',
      }),
    });
    const data = await response.json();

    assert.equal(response.status, 200, `${stdout}\n${stderr}`);
    assert.equal(data.ok, true);
    assert.equal(data.report.photoSpecific.affectedArea, '画面右侧边缘');
    assert.equal(data.report.photoSpecific.crop.direction, '从右侧收紧');
    assert.equal(data.report.scoreReasons.构图, '主体清楚，但右侧视觉重量偏高。');
    const capturedRequest: any = providerRequest;
    assert.ok(capturedRequest);

    const content = capturedRequest.messages?.[0]?.content;
    const prompt = content?.find((item: any) => item.type === 'text')?.text ?? '';
    const image = content?.find((item: any) => item.type === 'image_url')?.image_url?.url;
    assert.match(prompt, /"photoSpecific"/);
    assert.match(prompt, /"scoreReasons"/);
    assert.match(prompt, /affectedArea 只描述/);
    assert.equal(image, imageDataUrl);
  } finally {
    await stopChild(child);
    await close(provider);
  }
});
