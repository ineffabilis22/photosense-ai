# PhotoSense AI v1.0 部署说明

完整的本地开发、测试、生产启动和 Render 部署步骤见 [README.md](./README.md)。

公开部署时务必设置：

```env
NODE_ENV=production
ENABLE_HISTORY_EXPORT=false
VITE_ENABLE_HISTORY_EXPORT=false
```

推荐命令：

```text
Build Command: npm ci --include=dev && npm run build
Start Command: npm start
```

部署完成后访问 `/api/health`，确认 `ok` 和 `providerConfigured` 均为 `true`。

