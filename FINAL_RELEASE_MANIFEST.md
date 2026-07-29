# PhotoSense AI v1.0 终稿说明

冻结日期：2026-07-29  
用户版本号：1.0  
包管理器版本号：1.0.0  
终稿来源：`deliverables/photosense-ai-github-current` 当前工作树  
Git 参考提交：`b511bdb`

## 冻结范围

本终稿包含用户确认时工作树中的全部有效源码、测试、设计规范、审计记录和说明文档。它不只是 Git 参考提交 `b511bdb` 的副本，也包含该提交之后尚未推送、但已经在本地版本中验收的改动。

2026-07-28 的产品审计和 2026-07-29 的修改路线图保留为历史记录。用户已确认不继续实施路线图中的改善项目，当前状态直接冻结为 v1.0。

## 产品边界

- 登录、注册和用户入口仍属于演示功能，不是真实账户系统。
- 历史记录默认保存在当前浏览器。
- 未配置真实分析 provider 时，系统会明确回退到示例报告。
- 真实分析需要在本地 `.env` 中配置支持图片输入的 provider。
- v1.0 的发布目标为 GitHub `ineffabilis22/photosense-ai` 的 `main` 分支和 Render 服务 `photosense-ai`；实际提交和部署状态以最终交付记录为准。

## 独立输出排除项

独立项目文件夹和压缩包不包含：

- `.git/`
- `node_modules/`
- `dist/`
- `.env`
- 日志、缓存和生成的 TypeScript build info

保留 `.env.example`、源码、测试、审计证据和全部必要说明。

## 运行

```powershell
npm ci
Copy-Item .env.example .env
npm run check
npm run server
```

另开终端：

```powershell
npm run dev
```

默认开发地址为 `http://localhost:5173`，API 健康检查为 `http://localhost:8787/api/health`。

## 最终验证

2026-07-29 在活动源码目录运行 `npm run check`：

- 测试源码 TypeScript 检查通过；
- 48 项自动化测试全部通过；
- 生产构建成功；
- npm 包版本显示为 `photosense-ai@1.0.0`。

独立输出文件数量、体积和压缩包 SHA-256 记录在最终交付回复中。
