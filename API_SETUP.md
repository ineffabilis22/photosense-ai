# 分析 API 配置

先把 `.env.example` 复制为 `.env`。OpenAI-compatible 图片分析接口的最小配置如下：

```env
OPENAI_RELAY_BASE_URL=https://your-provider.example/v1
OPENAI_RELAY_API_KEY=your_api_key
OPENAI_RELAY_MODEL=your_vision_model
```

可选参数：

```env
PROVIDER_TIMEOUT_MS=60000
OPENAI_RELAY_TIMEOUT_MS=90000
OPENAI_RELAY_MAX_TOKENS=3000
OPENAI_RELAY_TEMPERATURE=0.45
```

服务端也保留 Gemini 和 Anthropic 兼容配置。至少配置一种供应商后，启动服务并访问 `/api/health`，确认 `providerConfigured: true`。

完整启动与排错步骤见 [README.md](./README.md)。请勿把真实 API Key 写入 Git 仓库。

