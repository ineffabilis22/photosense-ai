# PhotoSense AI

PhotoSense AI 是一个面向摄影学习者的作品分析工具。用户选择摄影媒介、题材和评价水平，上传照片后获得构图、光线、色彩、叙事、技术完成度以及后期和下次拍摄建议。评价水平分为“爱好者水平”和“进阶水平”：前者使用日常语言并提供适度宽容分，后者使用统一基础分并可采用经过解释的摄影术语。

本版本在分析真实性和历史记录修复基础上，继续完善上传、分析进度、照片针对性反馈和历史报告对比。登录、注册、分享仍是演示功能，不应作为真实账号系统使用。

## 运行要求

- Node.js 20 或更高版本
- npm 10 或更高版本
- 一个支持图片输入的 OpenAI-compatible、Gemini 或 Anthropic 接口；没有 API 也能浏览网站，但分析时会明确显示“示例报告”

## 本地开发

先在项目根目录安装依赖：

```powershell
npm ci
Copy-Item .env.example .env
```

macOS / Linux 复制环境文件时使用：

```bash
cp .env.example .env
```

编辑 `.env`，至少填写一种分析服务。OpenAI-compatible 中转接口示例：

```env
OPENAI_RELAY_BASE_URL=https://your-provider.example/v1
OPENAI_RELAY_API_KEY=your_api_key
OPENAI_RELAY_MODEL=your_vision_model
NODE_ENV=development
```

不要把真实 API Key 提交到 Git。`OPENAI_RELAY_BASE_URL` 通常填写到 `/v1`，服务端会自动拼接 `/chat/completions`。

打开两个终端，均进入项目根目录。第一个终端启动 API：

```powershell
npm run server
```

第二个终端启动前端：

```powershell
npm run dev
```

访问 `http://localhost:5173`。Vite 会把 `/api` 请求代理到 `http://localhost:8787`。

## 本地验证

运行自动测试和生产构建：

```powershell
npm run check
```

`npm run check` 会依次完成测试源码类型检查、42 项自动测试和生产构建。自动测试包含 DOM 交互闭环以及本地模拟 OpenAI-compatible 供应商的端到端请求，不会调用或消耗真实 API Key。

也可以分别运行：

```powershell
npm run test
npm run build
```

检查后端状态：

```text
http://localhost:8787/api/health
```

返回结果中：

- `ok: true` 表示 PhotoSense 服务已启动；
- `providerConfigured: true` 表示至少配置了一种分析服务；
- `historyExportEnabled` 表示服务器端 JSON 历史导出是否开启。

建议手动测试下面的核心路径：

1. 点击或拖放上传 JPG、PNG、WebP；空文件、其他格式和超过 15 MB 的文件应被拒绝。
2. 更换照片时，作品标题、媒介、题材和评价水平应保持不变；评价水平应只显示“爱好者水平”和“进阶水平”。
3. 开始分析后检查四阶段进度、等待时间、取消操作和冷启动提示。
4. API 可用时，报告顶部应显示“实时 AI 分析”；报告应包含照片优点、优先问题、画面区域、裁剪参考和五项评分依据。
5. 停止 API 后再次分析，页面应明确显示“示例报告”和失败原因；点击“重试实时分析”应保留照片和点评参数。
6. 刷新页面后检查历史记录；缩略图应仍然有效，媒介与题材筛选可组合使用。
7. 进入管理模式，选择两份记录，检查综合评分、五项评分、主要问题和练习方向的对比结果。
8. 检查本月数量、日期区间、搜索、评分排序和删除记录。
9. 历史记录最多保留 20 条，以控制浏览器存储占用。

## 本地生产模式

先构建，再由同一个 Node 服务提供前端和 API：

```powershell
npm run build
npm start
```

访问 `http://localhost:8787`。

## 可选的历史 JSON 导出

浏览器历史默认保存在 `localStorage`。如需在本地同时把历史写入项目的 `exports` 目录，在 `.env` 中同时开启：

```env
ENABLE_HISTORY_EXPORT=true
VITE_ENABLE_HISTORY_EXPORT=true
```

修改 `VITE_` 变量后需要重新启动 Vite 或重新构建。公开部署必须保持这两项为 `false`，因为该接口不包含账号级权限控制。

## Render 部署参考

- Build Command：`npm ci && npm run build`
- Start Command：`npm start`
- Node 版本：20 或更高
- 环境变量：填写所选分析供应商的 URL、Key、模型名，并设置 `NODE_ENV=production`
- 安全设置：`ENABLE_HISTORY_EXPORT=false`、`VITE_ENABLE_HISTORY_EXPORT=false`

部署后检查 `/api/health`，再上传一张测试照片完成一次分析。健康接口只返回配置状态，不会暴露 API Key。

## 数据说明

- 上传图片会发送给你在 `.env` 中配置的分析供应商。
- 历史缩略图会压缩为较小的数据 URL 并保存在当前浏览器中。
- 默认不会把用户历史记录写到公共服务器。
- 首页摄影作品为项目作者自有素材。
