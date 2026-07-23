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
- Darkroom theme overrides: `src/theme-darkroom.css`
- Visual direction and guardrails: `VISUAL_STYLE_AGENT.md`
- Homepage visual assets: `public/home-assets`
- Static fallback preview: `preview.html`

## Visual Direction Rule

Before changing UI styles, read `VISUAL_STYLE_AGENT.md`. The approved direction is Darkroom Constructivist v1. Preserve its medium-gray fiber background, warm paper reading surfaces, constructivist scale, technical-manual hierarchy, small radii, restrained orange-red accent, and unchanged user photography. Do not reintroduce all-black surfaces, black-and-gold styling, large rounded cards, or widespread pill controls.

## Editing Guidance

- Keep future changes small, focused, and reviewable.
- Preserve existing functionality unless the task explicitly asks to change it.
- Be careful with the current upload -> analyze -> report -> history linking flow.
- Preserve the existing page-switching/navigation system unless explicitly asked to change it.
- Prefer following the existing component and CSS patterns before introducing new structure.

## Review Context Rule

When editing report generation or report UI, preserve the link between `medium`, `genre`, `skillLevel`, and the resulting report criteria. These selections are not metadata only. They must influence evaluation criteria, scoring emphasis, critique vocabulary, post-processing advice, next shooting advice, and the visible report context. Do not remove or bypass this connection.

`skillLevel` currently supports exactly two user-facing values: `爱好者水平` and `进阶水平`. Both levels use the same evidence-based v3 score bands and numeric mapping; `爱好者水平` uses plain language, while `进阶水平` may use explained photography terminology. Do not add a score offset for either level. Legacy inputs `初学者`, `进阶`, and `高级` may only appear in compatibility normalization or output-cleaning rules; they must not return as selectable UI values.

The v3 scoring bands are `作品级`, `强`, `成立`, `普通`, `偏弱`, and `严重问题`. The server owns their numeric mapping. If all five dimensions are `作品级` or `强`, the report must explicitly state that no significant issue was found instead of inventing a criticism. Historical records from v2 remain readable but must not be used for numeric deltas against v3 records.

## User-Facing Critique Language Rule

Do not expose internal evaluation metadata as critique content. `reviewContext` explains criteria, but verdict, postProcessing, and nextShooting must read like user-facing photography feedback.

Forbidden in user-facing verdict/advice: 本次评分, 评分侧重, 评价基准, 点评口径, 按爱好者水平/进阶水平口径, legacy 按初学者/进阶/高级口径, 用户选择, AI, 模型, 建议优化后入选.

The selected medium / genre / skillLevel must influence the critique, but should not be mechanically named inside every sentence.

## Files To Avoid Touching Casually

Avoid modifying these unless necessary for the task:

- `node_modules/`
- `dist/`
- `package-lock.json`
- backup files such as `src/App.tsx备份`, `src/styles.css备份`, and `preview.html备份`
- config files such as `vite.config.*`, `tsconfig*.json`, and generated build info files
