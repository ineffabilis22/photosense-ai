# AGENTS.md

PhotoSense AI is a Chinese AI photography critique web app prototype. It helps users upload a photo, select review context, request a photography diagnosis report from a configured vision model, and keep records in a history archive. When the provider is unavailable, the UI must label the fallback as a sample report.

## Tech Stack

- Vite
- React
- TypeScript
- Plain CSS

## Key Project Files

- Main app logic: `src/App.tsx`
- Main styling: `src/styles.css`
- Homepage visual assets: `public/home-assets`
- Static fallback preview: `preview.html`

## Editing Guidance

- Keep future changes small, focused, and reviewable.
- Preserve existing functionality unless the task explicitly asks to change it.
- Be careful with the current upload -> analyze -> report -> history linking flow.
- Preserve the existing page-switching/navigation system unless explicitly asked to change it.
- Prefer following the existing component and CSS patterns before introducing new structure.

## Review Context Rule

When editing report generation or report UI, preserve the link between `medium`, `genre`, `skillLevel`, and the resulting report criteria. These selections are not metadata only. They must influence evaluation criteria, scoring emphasis, critique vocabulary, post-processing advice, next shooting advice, and the visible report context. Do not remove or bypass this connection.

## User-Facing Critique Language Rule

Do not expose internal evaluation metadata as critique content. `reviewContext` explains criteria, but verdict, postProcessing, and nextShooting must read like user-facing photography feedback.

Forbidden in user-facing verdict/advice: 本次评分, 评分侧重, 评价基准, 点评口径, 按初学者/进阶/高级口径, 用户选择, AI, 模型, 建议优化后入选.

The selected medium / genre / skillLevel must influence the critique, but should not be mechanically named inside every sentence.

## Files To Avoid Touching Casually

Avoid modifying these unless necessary for the task:

- `node_modules/`
- `dist/`
- `package-lock.json`
- backup files such as `src/App.tsx备份`, `src/styles.css备份`, and `preview.html备份`
- config files such as `vite.config.*`, `tsconfig*.json`, and generated build info files
