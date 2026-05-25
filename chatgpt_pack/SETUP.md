# PhotoSense AI 本地 AI API 设置

PhotoSense AI 前端点击“开始分析”时会请求本地接口：

```text
POST http://localhost:8787/api/analyze-photo
```

本地后端负责调用 OpenAI-compatible relay、Gemini relay、Claude relay，或 Native Gemini。API Key 只放在后端环境变量中，不要写入前端代码。

如果本地接口不可用、API Key 未配置、模型超时，或模型返回异常，前端会自动回退到 `createMockReport()`，静态演示仍可继续使用。

## Mode A：OpenAI-Compatible Relay（推荐）

当前推荐模式，适用于已经通过纯文本测试的 OpenAI-compatible relay。

Relay 地址：

```text
https://kuaipao.pro/v1
```

后端会调用：

```text
POST ${OPENAI_RELAY_BASE_URL}/chat/completions
```

因此当 `OPENAI_RELAY_BASE_URL=https://kuaipao.pro/v1` 时，最终请求地址是：

```text
https://kuaipao.pro/v1/chat/completions
```

### 启动后端

Windows CMD：

```cmd
set OPENAI_RELAY_API_KEY=your_relay_key
set OPENAI_RELAY_BASE_URL=https://kuaipao.pro/v1
set OPENAI_RELAY_MODEL=gpt-5.4
node server/analyze-photo.mjs
```

OpenAI-compatible relay 使用 `image_url` 多模态输入。前端会把上传图片压缩为 `data:image/jpeg;base64,...` 后发送给本地后端。

## Mode B：Gemini Relay / OpenAI-Compatible API（可选）

旧的 Gemini relay 模式仍然保留。它同样使用 OpenAI-compatible `/chat/completions`。

Windows CMD：

```cmd
set GEMINI_RELAY_API_KEY=your_relay_key
set GEMINI_RELAY_BASE_URL=https://kuaipao.pro/v1
set GEMINI_RELAY_MODEL=gemini-3-pro-preview
node server/analyze-photo.mjs
```

## Mode C：Claude Relay / Anthropic-Compatible API（可选）

Claude relay 使用 Anthropic Messages API，不使用 OpenAI-compatible `/chat/completions`。

Windows CMD：

```cmd
set ANTHROPIC_RELAY_API_KEY=your_relay_key
set ANTHROPIC_RELAY_BASE_URL=https://kuaipao.pro
set ANTHROPIC_RELAY_MODEL=claude-3-7-sonnet
node server/analyze-photo.mjs
```

Claude relay 会调用：

```text
POST ${ANTHROPIC_RELAY_BASE_URL}/v1/messages
```

## Mode D：Native Gemini API（可选）

适用于 Google AI Studio 原生 Gemini API。

Windows CMD：

```cmd
set GEMINI_API_KEY=your_google_ai_studio_key
set GEMINI_MODEL=gemini-2.5-flash
node server/analyze-photo.mjs
```

## Provider 优先级

后端会按以下顺序选择 provider：

1. `OPENAI_RELAY_BASE_URL` → `openai-relay`
2. `GEMINI_RELAY_BASE_URL` → old OpenAI-compatible Gemini relay
3. `ANTHROPIC_RELAY_BASE_URL` → Claude relay / Anthropic-compatible `/v1/messages`
4. `GEMINI_API_KEY` → Native Gemini `generateContent`

如果你要切换模式，建议在新的 CMD 窗口里只设置当前模式需要的环境变量，避免旧变量干扰判断。

## 启动前端

另开一个 Windows CMD：

```cmd
npm run dev -- --host 0.0.0.0
```

前端默认请求：

```text
http://localhost:8787/api/analyze-photo
```

如果本地 API 地址有变化，可以在启动前端前设置：

```cmd
set VITE_ANALYSIS_API_URL=http://localhost:8787/api/analyze-photo
npm run dev -- --host 0.0.0.0
```

## 什么时候会调用 API

- 上传作品本身不会调用 AI API。
- 只有点击“开始分析”后，前端才会请求本地 `analyze-photo` 接口。
- 浏览器 Network 里应该出现 `analyze-photo` 请求。
- 请求 Payload 里的 `imageDataUrl` 应该以 `data:image/` 开头，而不是 `blob:http://...`。

## 如何确认 OpenAI-Compatible Relay 已经生效

浏览器 Console 应看到：

```text
Calling analysis API...
imageDataUrl starts with: data:image/...
Analysis API status: 200
Analysis API success
```

后端 CMD 应看到：

```text
[PhotoSense AI] request received
[PhotoSense AI] imageDataUrl exists: true
[PhotoSense AI] imageDataUrl starts with data:image/: true
[PhotoSense AI] imageDataUrl length: ...
[PhotoSense AI] provider mode: openai-relay
[PhotoSense AI] base URL: https://kuaipao.pro/v1
[PhotoSense AI] model: gpt-5.4
[PhotoSense AI] OpenAI relay request starts
[PhotoSense AI] OpenAI relay response status: 200
[PhotoSense AI] OpenAI relay response content-type: ...
[PhotoSense AI] OpenAI relay responseText length: ...
[PhotoSense AI] OpenAI relay response preview: ...
[PhotoSense AI] OpenAI relay response received
[PhotoSense AI] JSON parse starts
[PhotoSense AI] response sent to frontend
```

如果浏览器 Console 出现：

```text
AI request failed, using mock fallback
```

说明前端进入了 mock 兜底流程。请检查：

- 后端是否已启动
- 是否设置了 `OPENAI_RELAY_API_KEY`
- 是否设置了 `OPENAI_RELAY_BASE_URL=https://kuaipao.pro/v1`
- 是否设置了 `OPENAI_RELAY_MODEL=gpt-5.4`
- Network 中 `analyze-photo` 的响应状态和错误内容
- 后端 CMD 中的 `OpenAI relay response status`、`content-type`、response preview 和错误 body preview

## 自动打包报告给 ChatGPT

当前项目包含一个本地开发用的自动保存流程。当前端生成报告并更新历史记录后，会在后台请求：

```text
POST http://localhost:8787/api/save-report-history
```

如果本地后端正在运行，报告历史会自动写入项目目录：

```text
exports/photosense_reports_history.json
```

同时会生成一份带时间戳的快照：

```text
exports/photosense_reports_export_YYYY-MM-DD_HH-mm-ss.json
```

这样 `pack-chat.bat` 可以直接包含 `exports/` 文件夹，不需要截图，也不需要在界面里添加导出按钮。

如果后端没有启动，前端只会在 Console 中记录 warning。报告仍会保留在浏览器当前状态和 `localStorage` 中，但不会写入 `exports/` 文件夹。

## curl 快速测试

可以用一个很小的 base64 图片 data URL 验证本地接口是否通：

```cmd
curl -X POST http://localhost:8787/api/analyze-photo ^
  -H "Content-Type: application/json" ^
  -d "{\"imageDataUrl\":\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=\",\"medium\":\"数码摄影\",\"genre\":\"街头摄影\",\"skillLevel\":\"初学者\",\"fileName\":\"test.png\"}"
```

这个 curl 只用于验证接口链路；图片太小，模型不会给出有参考价值的摄影点评。正式测试请优先使用浏览器上传真实照片。
