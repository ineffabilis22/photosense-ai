# PhotoSense AI — Visual redesign QA v3

Date: 2026-07-16

## Scope

- Remove the homepage evaluation illustration and the three explanatory illustration cards.
- Rebuild the homepage around one darkroom-style PhotoSense AI hero and a separate four-step flow panel.
- Replace the display treatment with a vintage editorial serif hierarchy.
- Remove the accidental outer frame around the optional work-title field.
- Restore safe inner spacing in the review preview header and metadata strip.
- Apply paper/fiber textures to primary commands, secondary controls, inputs and history cards.
- Verify home, review, report and history layouts across desktop, tablet and mobile widths.

## Source truth

The supplied screenshots are copied into `audit/ui-visual-v3-2026-07-16/`:

- `ref-01-home-remove.png` and `ref-02-home-remove.png`: homepage sections that must be deleted.
- `ref-03-home-hero.png`: dark hero composition and hierarchy reference.
- `ref-04-home-flow.png`: four-step content reference.
- `ref-05-type.png`: vintage print typography reference.
- `ref-06-preview-padding.png`, `ref-07-metadata-padding.png`, `ref-08-title-border.png`: review-page spacing and border defects.

## Viewports and states checked

- Desktop home/report/history: 1280 × 900.
- Tablet review breakpoint: 1000 × 700.
- Mobile home/review/report/history: 390 × 844.
- Empty-upload review state, sample report state, two-record history state, expanded mobile navigation, and history-card hover/focus CSS state.

## Mandatory comparison passes

### Typography

- `PhotoSense AI`, the brand wordmark, eyebrow labels, step numbers and editorial headings resolve to `Noto Serif SC / Source Han Serif SC / Songti SC / SimSun`.
- A higher-specificity legacy `#hero-title` rule initially kept the Latin product name in Noto Sans. The v3 selector now explicitly assigns the brand serif family; computed browser styles confirm the serif stack.
- Body copy and compact utility metadata retain the existing interface/mono roles so long-form Chinese text remains readable.

### Layout and spacing

- The removed homepage preview and three-card support section no longer exist in the DOM.
- The hero is a centered, single-column darkroom card over the retained user-photo collage; the four-step flow is a separate 2 × 2 paper panel below it.
- The review title-field wrapper resolves to `border: 0` and `padding: 0`; its input retains a functional boundary and `12px 16px` inner padding.
- Review preview padding resolves to `40.96px` at 1280px and `24px 18px` on mobile. Metadata uses auto-fit columns on larger screens and one column on mobile.
- At 1000px the review layout initially remained two columns and clipped the upload heading. The responsive stack threshold was expanded to 1080px and now resolves to `upload / preview / controls` in one column with no overflow.
- At 390px the two-record history feed initially remained two columns and produced cramped three-line titles. The final feed resolves to one 355px column.

### Colors, surfaces and texture

- The hero and primary commands use the existing darkroom-fiber texture; paper controls, inputs, flow panel and history cards use the existing manual-paper texture.
- Primary home CTA text uses the warm paper color on the red action surface.
- The mobile hero initially inherited a paper-colored value panel while its text stayed light, creating weak contrast. The value panel now remains transparent over the dark card and all supporting text uses the dark-surface text tokens.
- No new generic gradients, decorative blobs or substitute SVG artwork were added.

### Imagery

- The existing user-owned homepage collage remains the atmospheric background.
- The unwanted evaluation illustration and three explanatory illustrations were removed rather than restyled.
- Uploaded-photo preview, report image and history thumbnails retain their existing real-image assets and crop behavior.

### Copy and content

- The homepage H1 is now the canonical product name `PhotoSense AI`.
- The old headline “看见画面，再决定下一步” is removed.
- The four workflow steps remain: 选择照片语境、上传一张照片、查看反馈报告、保存分析记录.
- Report navigation still exposes five matching sections, including `05 补充说明`.

### Controls, borders and icons

- Primary and secondary controls share the new print/texture treatment while preserving semantic button elements, pressed states and focus behavior.
- The optional title label has no decorative outer box; only the input itself remains bounded.
- Decorative nested borders were not added. Functional input boundaries, section rules and card separation remain.
- Existing icons and text arrows are unchanged; no placeholder icon set was introduced.

### Responsiveness and accessibility

- Browser checks report no horizontal overflow on home, review, report or history at the tested widths.
- Mobile hero copy wraps without clipping; review metadata and history cards collapse to one column.
- Navigation remains keyboard-semantic, one H1 per page is preserved, `aria-current`, `aria-pressed`, regions and labels continue to pass the automated accessibility assertions.
- Console inspection shows no errors; only Vite connection/HMR messages and the React DevTools informational message were present.

## Iteration history

1. P1 — Removed both unwanted homepage content blocks and centered the requested hero.
2. P1 — Repaired the 1000px review-page clipping by moving the single-column breakpoint to 1080px.
3. P1 — Repaired the mobile hero contrast regression by keeping the complete value panel on the dark surface.
4. P2 — Fixed the legacy font-specificity conflict so the product name and brand resolve to the vintage serif stack.
5. P2 — Removed the title-field wrapper border and added safe preview/header/metadata gutters.
6. P2 — Changed the mobile two-record history feed from two cramped columns to one readable column.
7. P3 — Confirmed texture, button, input, report and history-card consistency; no further blocking visual defects remained.

## Evidence

- Full and focused implementation captures: `01-home-before.png` through `12-report-after-mobile.png`.
- Hero comparison: `compare-01-home-hero.png`.
- Flow comparison: `compare-02-home-flow.png`.
- Review spacing/border comparison: `compare-03-review-spacing.png`.
- Evidence directory: `audit/ui-visual-v3-2026-07-16/`.

## Functional verification

- `npm.cmd run check`: passed.
- TypeScript test build: passed.
- Automated tests: 26 passed, 0 failed.
- Production Vite build: passed.
- Local frontend health: HTTP 200 at `http://localhost:5173/`.
- Local API health: HTTP 200 at `http://localhost:8787/api/health`; provider configured.

final result: passed

## 2026-07-18 interactive homepage follow-up

- Source visual truth: `D:/CodexData/.codex/generated_images/019f765f-9ba5-71d2-8f24-e178b216d9ad/exec-c10ccbf5-c7e7-494a-aa51-d81fb1755a34.png`, with the user's follow-up copy and interaction corrections.
- Browser: Playwright using the locally installed Microsoft Edge executable, explicitly authorized by the user.
- Viewports checked: 1440 x 1024, 760 x 1000 and 390 x 844.
- States checked: default homepage, second-thumbnail hover selection, desktop report genre warning and mobile report genre warning.
- Full-view source/implementation comparison: `audit/ui-home-interactive-2026-07-18/07-compare-home-source-vs-implementation.png`.
- Implementation evidence: `01-home-desktop-default.png` through `06-report-genre-warning-mobile.png` in the same evidence directory.

### Fidelity and interaction findings

- Typography: the existing Darkroom Constructivist serif hierarchy is preserved; the removed headline does not reappear and no user-facing `口径` wording remains.
- Layout and spacing: desktop uses a large left image and a right-side work list/report console; tablet and mobile stack without horizontal overflow (`scrollWidth === innerWidth` at all tested widths).
- Colors and surfaces: the retained paper, charcoal and rust-red tokens remain consistent across the homepage and report warning.
- Imagery: four existing PhotoSense image assets are used with stable crops; no placeholder or synthetic UI artwork was introduced.
- Controls and borders: hovering the second work changes the active image/report to PS 07 and score 82; `aria-pressed` moves from the first to the second choice. Mobile controls resolve to at least 44 px high.
- Report emphasis: the genre warning measures about 1289 x 148 px on desktop and 338 x 341 px on mobile, with the `01` marker, explicit mismatch summary and prominent re-analysis action visible in both states.
- Accessibility and runtime: no browser console or page errors occurred; thumbnail buttons preserve keyboard focus/click behavior, `aria-controls`, `aria-pressed` and the `aria-live` report region. Reduced-motion styling was exercised in the browser contexts.

### Functional verification

- `npm.cmd run check`: passed.
- Automated tests: 43 passed, 0 failed.
- TypeScript: passed.
- Production Vite build: passed.
- Local frontend: HTTP 200 at `http://127.0.0.1:4173/`.

final result: passed

## 2026-07-18 vertical film rail follow-up

- Source visual truth: `D:/CodexData/.codex/generated_images/019f765f-9ba5-71d2-8f24-e178b216d9ad/exec-c10ccbf5-c7e7-494a-aa51-d81fb1755a34.png`, with the user's explicit requirement to retain the prior floating collage background and remove the source headline.
- Implementation screenshots: `audit/ui-home-film-2026-07-18/20-home-film-desktop-final.png`, `16-home-film-tablet-final.png` and `21-home-film-mobile-final.png`.
- Viewports: 1440 x 1024, 760 x 1000 and 390 x 844.
- States: moving film rail, pointer-paused film rail with PS 07 selected, and reduced-motion mode.
- Full-view comparison: `audit/ui-home-film-2026-07-18/22-compare-source-vs-film-layout.png`.
- Focused comparison was not required because the full-size 2880 x 1024 comparison keeps the large image, report card, type hierarchy, right rail and surrounding collage readable.

### Findings and iteration history

1. P1: the first pass inherited the old four-column thumbnail grid, compressing the vertical rail to narrow slivers. The final cascade forces a single full-width film track; post-fix evidence is `20-home-film-desktop-final.png`.
2. P1: the first mobile pass used a short fixed console height and allowed the report to overlap the CTA. The mobile console was lengthened and the title scale was reduced; post-fix evidence is `21-home-film-mobile-final.png`.
3. P2: the first desktop pass allowed the product title to intrude into the rail. The title now uses two controlled lines and the established editorial serif at 63.36 px desktop / 36 px mobile.
4. Fonts and typography: the PhotoSense title resolves to the approved Noto Serif / Source Han Serif / Songti stack; film metadata retains the mono/manual treatment.
5. Spacing and layout rhythm: desktop matches the source's large image, editorial center panel and narrow right contact-sheet rail; tablet and mobile preserve the vertical rail without horizontal overflow.
6. Colors and tokens: charcoal fiber, warm paper and restrained rust-red remain the only dominant surfaces and accent.
7. Image quality: all main, film and background images use the existing 25 user-owned PhotoSense photographs with unchanged color.
8. Copy and content: the removed source headline remains absent; the report stays explicitly labelled `交互示例`.
9. Interaction and accessibility: the rail moves downward on an 18-second loop, pauses under pointer/focus, switches image/report on hover, focus or click, exposes one accessible set of four buttons, and disables motion under `prefers-reduced-motion`.
10. Runtime: no console or page errors; `scrollWidth === innerWidth` at all tested viewports.

final result: passed

## 2026-07-18 workflow width alignment

- Implementation screenshots: `audit/ui-home-flow-width-2026-07-18/04-flow-desktop-final.png`, `05-flow-tablet-final.png` and `06-flow-mobile-final.png`.
- Viewports: 1440 x 1024, 760 x 1000 and 390 x 844.
- Desktop hero and workflow widths: both 1280.65625 px; each workflow cell is 639.328125 px, aligning with the two-column hero structure.
- Tablet hero and workflow widths: both 712 px.
- Mobile hero and workflow widths: both 342 px; workflow cells stack to one 340 px content column.
- The workflow panel now removes the extra inner frame padding, uses the same outer grid as the hero, retains the paper/manual surface and preserves readable internal spacing.
- No horizontal overflow or browser console errors were found. `npm.cmd run check` passes 43 tests, TypeScript and the production build.

final result: passed

## 2026-07-18 homepage rail and spacing refinement

- Implementation screenshots: `audit/ui-home-refine-2026-07-18/04-home-refine-desktop-final.png`, `05-home-refine-tablet-final.png`, `06-home-refine-mobile-final.png` and `04-flow-refine-desktop-final.png`.
- Viewports: 1440 x 1024, 760 x 1000 and 390 x 844.
- Right rail: the heading above the automatic downward loop is removed; the rail now uses dark side rails, inset rules and dashed guide lines to read as a vertical film strip.
- Left stage: duplicated frame identifiers and year metadata are removed, leaving only medium, genre and the active work title.
- Center spacing: the desktop console is widened and the introduction-to-report gap is 61.53125 px; the tablet gap is 45.296875 px. Mobile content remains non-overlapping within the stacked responsive layout.
- Workflow panel: its background is now `rgba(228, 218, 195, 0.82)` with restrained transparent step cells, preserving dark-text readability while allowing the collage to show through subtly.
- Width alignment remains exact: workflow and hero are both 1280.65625 px on desktop, 712 px on tablet and 342 px on mobile.
- Runtime: no horizontal overflow, browser console errors or page errors were found at the three tested widths.
- `npm.cmd run check`: passed; 43 tests passed, TypeScript passed and the production Vite build passed.

final result: passed

## 2026-07-18 expanded homepage film rail

- The right film rail now contains eight distinct PhotoSense photographs instead of four, plus eight hidden loop duplicates for a seamless continuous track.
- Added source photographs: `photo-04.jpg`, `photo-09.jpg`, `photo-11.jpg` and `photo-23.jpg`; each has its own title, medium, genre, score, verdict and prioritized action.
- The loop duration is 32 seconds so doubling the number of frames does not make the film strip move too quickly.
- Playwright screenshots: `audit/ui-home-film-expanded-2026-07-18/home-film-desktop.png` and `home-film-mobile.png`.
- Browser viewports checked: 1440 x 1024, 760 x 1000 and 390 x 844.
- At all three widths the browser reports eight primary buttons, eight loop duplicates, active `photo-23.jpg` with score 81 after selecting the final item, a moving 32-second animation, no horizontal overflow and no console or page errors.

final result: passed

## 2026-07-19 homepage gallery controls and user photo wall

- Homepage copy now uses `分析结果` and `微调建议`; `最新分析报告`, `交互示例`, `优先行动` and every homepage `PS + number` label are absent.
- The stage medium/genre strip is removed. The large image advances every five seconds when motion is allowed; entering or focusing the right film rail pauses both the large-image timer and film movement.
- A fixed right-side `隐藏介绍 / 显示介绍` control removes the complete homepage introduction and workflow from layout and accessibility exposure while preserving the photo wall and navigation.
- The workflow gap is 18 px and each desktop/tablet step is 132 px high, with a quieter translucent paper surface matching the report panel.
- The collage contains 23 images. Nine user photographs were converted without overwriting originals to sRGB JPEG as `photo-26.jpg` through `photo-34.jpg`; portrait files are 1200 x 1800, landscape files are 1800 x 1200, and compressed sizes range from 147366 to 267163 bytes.
- Gallery-only evidence: `audit/ui-home-gallery-controls-2026-07-19/home-desktop-gallery-final.png` and `home-mobile-gallery-final.png`. Default-state evidence is stored in the same directory for desktop, tablet and mobile.
- Playwright viewports: 1440 x 1024, 760 x 1000 and 390 x 844. Desktop advanced from `photo-01.jpg` to `photo-07.jpg` after five seconds; hovering a visible thumbnail selected `photo-11.jpg`, paused the film, and remained on that image after another five seconds.
- Gallery-only mode shows 15 visible collage cards in the desktop viewport and 8 on mobile. All viewports had no horizontal overflow, console errors or page errors; all nine new images were present.
- `npm.cmd run check`: passed; 43 tests passed, TypeScript passed and the production Vite build passed.

final result: passed
