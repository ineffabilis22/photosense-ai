# PhotoSense AI 部署说明

## 本项目现在支持的启动方式

本地开发：

```bash
npm install
npm run server
npm run dev
```

线上生产：

```bash
npm install
npm run build
npm start
```

`npm start` 会启动 `server/analyze-photo.mjs`，并同时提供：

- 前端页面：`dist/index.html`
- 后端接口：`/api/analyze-photo`
- 历史保存接口：`/api/save-report-history`
- 健康检查：`/api/health`

## 重要安全原则

不要把真实 API Key 提交到 GitHub。

真实密钥只放在部署平台的 Environment Variables 里：

```env
OPENAI_RELAY_BASE_URL=https://kuaipao.pro/v1
OPENAI_RELAY_API_KEY=你的真实中转 API Key
OPENAI_RELAY_MODEL=gpt-5.4
```

`.env` 已经在 `.gitignore` 中忽略。

## Render / Railway 部署参数

Build Command:

```bash
npm install && npm run build
```

Start Command:

```bash
npm start
```

Environment Variables 按 `.env.example` 填入。

## 本地部署前检查

```bash
npm run build
npm start
```

然后打开：

```text
http://localhost:8787
```

健康检查：

```text
http://localhost:8787/api/health
```

## 更新线上版本

以后每次本地改好后：

```bash
git add .
git commit -m "update"
git push
```

部署平台会根据 GitHub 仓库自动重新部署。
