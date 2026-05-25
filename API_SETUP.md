# PhotoSense AI 中转 API 接入说明

这个版本按 **中转 API / OpenAI-compatible / gpt-5.4** 方式配置。

## 1. 填写 API

打开项目根目录的 `.env`，把下面两项改成你的真实信息：

```env
OPENAI_RELAY_BASE_URL=https://你的中转API地址/v1
OPENAI_RELAY_API_KEY=你的中转API_KEY
OPENAI_RELAY_MODEL=gpt-5.4
PORT=8787
```

注意：

- `OPENAI_RELAY_BASE_URL` 通常只写到 `/v1`。
- 不要写成 `/v1/chat/completions`，后端会自动拼接 `/chat/completions`。
- 模型名固定使用你之前的中转模型：`gpt-5.4`。
- API Key 不一定必须是 `sk-` 开头，按你的中转平台给出的内容填写即可。

例如中转文档给你的接口是：

```text
https://api.example.com/v1/chat/completions
```

那么 `.env` 里应该写：

```env
OPENAI_RELAY_BASE_URL=https://api.example.com/v1
```

## 2. 启动后端

打开第一个 CMD：

```bat
cd /d 你的项目文件夹路径
npm install
npm run server
```

看到类似下面内容说明后端启动成功：

```text
PhotoSense AI local API running at http://localhost:8787/api/analyze-photo
```

这个窗口不要关闭。

## 3. 启动前端

打开第二个 CMD：

```bat
cd /d 你的项目文件夹路径
npm run dev
```

浏览器打开 CMD 里显示的地址，通常是：

```text
http://localhost:5173/
```

## 4. 如果请求失败

优先检查：

1. `.env` 是否在项目根目录。
2. `OPENAI_RELAY_BASE_URL` 是否只写到 `/v1`。
3. `OPENAI_RELAY_API_KEY` 是否正确、有额度。
4. 中转 API 是否支持视觉输入，也就是图片分析。
5. 后端 CMD 窗口里的报错信息。

## 5. 超时与速度配置

这版默认开启了更快的报告生成配置：

```env
OPENAI_RELAY_TIMEOUT_MS=45000
OPENAI_RELAY_MAX_TOKENS=1200
OPENAI_RELAY_TEMPERATURE=0.35
```

同时前端会把上传图片压缩到最长边约 768px，并以较低 JPEG 体积发送给后端，减少中转 API 的视觉分析耗时。

如果你的中转 API 偶尔仍然慢，可以把超时适当加到 60000；如果你希望用户不要等待太久，建议保持 45000 或改成 35000。
