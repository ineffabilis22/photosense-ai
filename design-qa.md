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

## 2026-09-14 photo wall simplified to image-only preview

- The homepage photo wall no longer renders the right-side analysis result when a photo is selected.
- Clicking a wall photo now opens only a large image preview with a clear `关闭照片预览` control; no score, verdict, or adjustment text is included.
- The desktop preview is now a single centered image frame instead of an image-plus-analysis two-column layout. Mobile keeps the same single-frame behavior.
- Login and registration continue to use the shared photo wall background and are explicitly tested to contain no gallery analysis result.
- Evidence: `output/homepage-qa/homepage-gallery-only-390.png` shows the image-only preview state; automated interaction coverage verifies all 23 homepage wall items and both auth pages.
- Automated verification: `npm.cmd run check` passed with 60 tests; no horizontal overflow was observed in the opened image preview states.

final result: passed

## 2026-09-14 homepage comparison order refinement

- The homepage comparison now starts with `修改前` and then transitions to `修改后`.
- Selecting another film item also resets to its original photo first, so each comparison begins from a clear baseline.
- Automatic comparison remains enabled at the existing interval and now follows the same `修改前 → 修改后` order.
- The manual `修改前` / `修改后` controls, fade transition, reduced-motion behavior and report synchronization remain unchanged.
- Browser evidence: `output/homepage-qa/homepage-before-order.png` shows the first visible state with `/home-backgrounds/photo-01.jpg`, `修改前` active and no horizontal overflow at 1440 px.
- Automated verification: 60 tests passed; the initial image source and automatic transition order are covered by the homepage interaction tests.

final result: passed

## 2026-09-14 homepage introduction transparent surface refinement

- User issue: the homepage introduction window appeared nearly black even though its own background was transparent, because the enclosing review column used a near-opaque black surface.
- Fix: the workbench base is transparent, the photo stage keeps its deep canvas for controlled letterbox space, the review column now uses the shared `--em-window-surface` token, and the introduction window explicitly uses the same transparent-black family as other reading windows (`rgba(11, 11, 11, 0.32)`).
- Scope: only homepage surface styling changed; copy, layout, comparison controls, report content and API behavior remain unchanged.
- Evidence: `output/homepage-qa/homepage-1440-transparent-intro.png`, `homepage-760-transparent-intro.png` and `homepage-390-transparent-intro.png` show the page background visible through the introduction surface.
- Verification: computed styles are `rgba(11, 11, 11, 0.32)` for the introduction and `rgba(11, 11, 11, 0.48)` for the review column at 1440/760/390; no horizontal overflow was observed and CSS assertions passed.

final result: passed

## 2026-09-14 homepage hero copy and report spacing refinement

- Source visual truth: the user's latest homepage screenshots at `C:/Users/YYN/AppData/Local/Temp/codex-clipboard-8ab0f91e-b300-4668-8b9d-5feb9cdc74b5.png` and `C:/Users/YYN/AppData/Local/Temp/codex-clipboard-0e8c177d-6a46-4676-9b6e-11f29c31619b.png`.
- Implementation screenshots: `output/homepage-qa/homepage-1440-hero-copy.png`, `output/homepage-qa/homepage-760-hero-copy.png` and `output/homepage-qa/homepage-390-hero-copy.png`.
- Viewports and density: 1440 x 1000, 760 x 1000 and 390 x 844 CSS px at device scale factor 1. The source screenshots are focused references; comparison covered the requested copy, alignment and spacing rather than pixel-identical page framing.
- State: homepage introduction visible, default optimized image selected, report preview and film strip visible.

### Comparison and required fidelity surfaces

- Copy: the duplicate Hero eyebrow `Photosense AI` was removed. The main title is now `Photosense AI`, and the supporting line is now `摄影评审与优化建议`. The header brand remains unchanged.
- Action alignment: `开始点评` is right-aligned to the report column on desktop and remains right-aligned within the stacked content on tablet and mobile. It remains a semantic button with the existing focus and minimum-height rules.
- Spacing: the extra grid gap before `评审结论` was removed. The report preview now uses the same top-spacing token as the separator before `优化建议`; mobile keeps the same rhythm with its existing 24px inset.
- Visual continuity: the short orange rule remains above the Hero title, now attached to the title container rather than to the removed eyebrow text. Existing darkroom surfaces, type roles and restrained accent colors remain unchanged.
- Responsive evidence: browser metrics report `scrollWidth === viewport width` at all three viewports. The 1440 px button ends at the report text column edge (`right: 1329.14px`, matching the section content edge), and the report section boxes remain contiguous while the second section retains its internal top padding.

### Iteration history

1. P2 — Removed the redundant Hero product-name eyebrow and exchanged the H1/supporting line to match the requested product hierarchy.
2. P2 — Moved the primary action to the right edge of the report column.
3. P2 — Normalized the report preview grid gap and top padding so the first report section no longer receives an additional blank interval.
4. Post-fix pass — Captured 1440, 760 and 390 px states; no horizontal overflow or visible clipping remained.

### Functional verification

- `npm.cmd run check`: passed.
- TypeScript test build: passed.
- Automated tests: 60 passed, 0 failed.
- Production Vite build: passed; Vite emitted only the existing chunk-size advisory.
- Browser checks: Hero text, removed eyebrow, right-aligned CTA, equalized report spacing and no horizontal overflow verified at 1440/760/390.

final result: passed

## 2026-09-14 homepage fixed image frame and automatic comparison

- Source visual truth: the user's three attached reference screenshots at `C:/Users/YYN/AppData/Local/Temp/codex-clipboard-17142513-5987-4e1a-9a2c-7a33e603802d.png`, `C:/Users/YYN/AppData/Local/Temp/codex-clipboard-142ed0af-87d2-4629-82c4-75c720a7b3b9.png` and `C:/Users/YYN/AppData/Local/Temp/codex-clipboard-a540518e-ba02-4098-a96c-dc18855da0a2.png`.
- Implementation screenshots: `output/homepage-qa/homepage-1440-final-latest.png`, `output/homepage-qa/homepage-760-final-latest.png` and `output/homepage-qa/homepage-390-final-latest.png`.
- Viewports and density: 1440 x 1100, 760 x 980 and 390 x 844 CSS px at device scale factor 1. The source screenshots are directional references with different crops; comparison focused on the requested component behavior and hierarchy rather than pixel-identical page framing.
- State: homepage introduction visible, default optimized image selected, desktop/tablet/mobile responsive states, fixed comparison controls, generated report preview and film strip visible.
- Browser evidence: Chrome headless DevTools capture against `http://127.0.0.1:5173/`; no application console errors were observed and `document.documentElement.scrollWidth > window.innerWidth` was false at all three viewports.

### Comparison and required fidelity surfaces

- Full-view comparison: the desktop capture confirms the large image/report workbench remains the main focus, while the revised title, workflow copy, eye control and film strip remain visible in one continuous homepage composition.
- Focused comparison: the image stage, comparison toggle, eye control, right report/film boundary and workflow copy were inspected at all three viewport sizes. A separate crop was not needed because each focused area remains readable in the full captures.
- Fonts and typography: the homepage eyebrow now displays `Photosense AI` without forced uppercase transformation; the main title is `摄影评审与优化建议`; workflow labels are `选择属性`, `生成报告` and `回顾学习` with report/history-specific descriptions.
- Spacing and layout rhythm: the stage is fixed per responsive breakpoint and independent of image dimensions: 845.77 x 892 px at 1440, 709 x 520 px at 760 and 363 x 310 px at 390. The film rail follows the completed optimization suggestions with a stable gap and no overlap after the desktop-height correction.
- Colors and visual tokens: the existing charcoal surface, warm paper text and restrained orange-red accent remain unchanged. The letterbox space uses the existing canvas tone rather than a new decorative treatment.
- Image quality and asset fidelity: the original and generated homepage photographs remain unchanged as source assets. `object-fit: contain` shows the complete image and accepts letterbox space; no image is cropped by the fixed frame.
- Copy and content: `功能示例` is removed. The homepage now describes the product as `Photosense AI` / `摄影评审与优化建议`; the workflow no longer uses the superseded labels.
- Interaction and accessibility: the before/after image automatically alternates every 4.5 seconds when motion is allowed, each selected work remains visible for 9 seconds so both states have meaningful viewing time, the image uses a 220 ms fade state, the existing manual comparison buttons remain available, and the timer pauses when the carousel is paused by film interaction or focus. Reduced-motion mode disables the transition and automatic timers.
- Film strip: perforations use fixed 18 px holes with a fixed 14 px gap rather than distributing a dense 24-column grid across the viewport. The same physical spacing is retained across responsive widths.

### Iteration history

1. P1 — The first browser pass showed the film rail entering the middle of the optimization list on a 1440 x 1100 viewport. Increased the desktop workbench to a stable `clamp(780px, calc(100vh - 88px), 894px)` range and kept the film rail after the complete suggestion block; the revised capture shows all three suggestions before the rail.
2. P1 — The large image inherited `cover`, which cropped photographs differently by aspect ratio. Changed the fixed stage to `contain`, preserving the complete photograph and allowing controlled canvas letterboxing.
3. P2 — Perforations were compressed by `space-between` into a dense adaptive grid. Replaced them with fixed-size flex items and a fixed 14 px gap; browser metrics confirm 18 px holes and 14 px spacing at desktop.
4. P2 — Before/after state previously changed only from user input. Added the 4.5 second automatic comparison cycle, a 220 ms fade state, and a reduced-motion guard; the automated interaction test invokes the timer and verifies the source and fade class.
5. P2 — Updated the requested homepage title, eyebrow and workflow labels/descriptions, and moved the eye control to the page's right edge (`right: 6px`).

### Functional verification

- `npm.cmd run check`: passed.
- TypeScript test build: passed.
- Automated tests: 60 passed, 0 failed.
- Production Vite build: passed; Vite emitted only the existing chunk-size advisory.
- Browser checks: fixed frame dimensions, `contain`, automatic before/after change, fade class, fixed perforation geometry, right-aligned eye control, and no horizontal overflow at 1440/760/390.

final result: passed

## 2026-09-14 homepage review workbench and generated comparisons

- Source visual truth: `C:/Users/YYN/AppData/Local/Temp/codex-clipboard-c9410e44-334e-493b-b071-d6d9fc38a2a8.png` (1543 x 1038 px), with the user's explicit instruction to replace the marked progress block with a shortened version of the existing moving film strip.
- Supporting film reference: `C:/Users/YYN/AppData/Local/Temp/codex-clipboard-88121ef7-8299-422d-8802-90ce60268ffb.png`.
- Browser-rendered implementation screenshots: `output/homepage-qa/homepage-1440-final.png` (1440 x 1024), `homepage-760-final.png` (760 x 1200), `homepage-390-final.png` (390 x 844), and the interaction state `homepage-1440-before.png` (1440 x 1024).
- CSS viewport and density: 1440 x 1024, 760 x 1200 and 390 x 844 CSS px at `deviceScaleFactor: 1`; screenshot pixels equal CSS pixels.
- State: homepage introduction visible, first film work selected, optimized image selected by default. The before-state capture uses the same work and viewport after activating `修改前`.

### Comparison evidence and required fidelity surfaces

- Full-view comparison: `output/homepage-qa/homepage-full-comparison-final.png`. The 1543 x 1038 source and 1440 x 1024 implementation were each fitted without cropping into 720 x 484 canvases, then placed side by side. The implementation preserves the source's dominant photograph, compact right-side review, orange action, thin dividers and bottom status region; the requested moving film replaces the static progress line.
- Focused comparison: `output/homepage-qa/homepage-right-column-comparison-final.png`. The source right column (crop 545 x 790) and implementation right column (crop 475 x 894) were each fitted without cropping into 520 x 720 canvases. The final title is a single desktop line, and the film remains inside the right column beneath the advice.
- Fonts and typography: the existing PhotoSense serif, sans and mono roles are retained. The desktop title was reduced to a 40.44 px line box to match the reference's single-line hierarchy; report body copy remains readable and does not truncate.
- Spacing and layout rhythm: the desktop workbench is a 1.62fr / 430 px minimum split. At 1440 px it measures 1328.66 x 893.67 px; the right column measures 473.80 px and the 132 px film ends at 937.48 px, inside the 981.67 px workbench bottom. Tablet and mobile stack the photograph before the report and film without horizontal overflow.
- Colors and tokens: the existing darkroom black, warm white and restrained orange-red tokens map directly to the source. Active comparison state and numbered advice use the same accent; no gradient, glass or unrelated colour was introduced.
- Image quality and asset fidelity: all eight original film photographs remain unchanged. Eight dedicated optimized WebP assets in `public/home-showcase/` are derived from real local report output and retain the source aspect direction and photographic treatment; no placeholder or CSS-drawn image is present.
- Copy and content: the static example uses real generated report conclusions and two to three photograph-specific actions. `摄影评审与优化预览`, `评审结论`, `优化建议` and the four-step homepage flow reflect the current report structure without exposing model or implementation terminology.
- Icons: the pre-existing eye control remains because it is an established homepage interaction even though the reference mock omits it; its 44 px control, focus styling and existing icon asset are preserved.
- Interaction and accessibility: `修改前` and `修改后` are semantic buttons with `aria-pressed`, visible focus and 44 px minimum height. Clicking a film work synchronizes the image, report and active state; duplicated animation items stay outside the keyboard path. `prefers-reduced-motion` disables the film and image transitions.
- Responsive evidence: browser metrics report `scrollWidth === viewport width` at 1440, 760 and 390 px. Mobile comparison controls remain 44 px high and the workbench is 374 px wide inside the 390 px viewport.
- Browser errors: Chrome DevTools Protocol recorded 0 console exceptions, console errors or failed application-resource requests during navigation, comparison switching and film selection.

### Comparison history

1. P2 — The first implementation used a narrow 360 px minimum right rail and a larger title, wrapping the core title to two lines and pushing the film below the desktop first viewport. The grid was changed from `1.78fr / 360 px` to `1.62fr / 430 px`, and the title scale was reduced. Post-fix evidence: `homepage-1440-final.png`, `homepage-full-comparison-final.png` and `homepage-right-column-comparison-final.png`.
2. Post-fix pass — The title now occupies one 40.44 px line, the film is fully contained by the workbench, and no actionable P0, P1 or P2 mismatch remains. The denser real report copy and moving film are intentional product differences from the conceptual mock.

### Functional verification

- `npm.cmd run check`: passed.
- TypeScript test build: passed.
- Automated tests: 59 passed, 0 failed.
- Production Vite build: passed; the existing chunk-size advisory remains non-blocking.
- Browser interactions: optimized image shown by default; before/after switch verified; second film item switched to `城市夹缝`, its optimized image and matching report; no horizontal overflow or console errors.

final result: passed

## 2026-09-11 report rhythm and image-orientation follow-up

- Source visual truth: the user's three issue captures at `C:/Users/YYN/AppData/Local/Temp/codex-clipboard-d7615895-42fa-47fe-af94-e1b66c532cbb.png`, `codex-clipboard-cd4e203c-fe1c-4377-a841-51cfd3f9ac71.png`, and `codex-clipboard-34b39159-5e78-457b-a5d7-28575a4c5a11.png`.
- Combined source/implementation comparison: `D:/CodexData/.codex/visualizations/2026/09/11/photosense-report-rhythm-orientation/comparison-source-vs-implementation.png` (1472 x 1982 px).
- Implementation screenshots: landscape and portrait overview, observation, five-dimension diagnosis, post-processing, next-shooting and evaluation-context captures under `D:/CodexData/.codex/visualizations/2026/09/11/photosense-report-rhythm-orientation/`.
- Viewports and density: 1440 x 1000, 760 x 960 and 390 x 844 CSS px at `deviceScaleFactor: 1`.
- State: one complete persisted QA report. Existing PhotoSense photographs `photo-01.jpg` (landscape) and `photo-05.jpg` (portrait) were inserted into the rendered report only for orientation capture because history sanitisation intentionally removes non-data local image URLs.
- Browser evidence: Microsoft Edge headless capture through the DevTools protocol. No console errors and no horizontal overflow at the three tested widths.

### Required fidelity surfaces

- Fonts and typography: the five report chapters now use the established serif role at 42.4–73.6 px desktop and 36–52 px mobile, while labels/body/numeric data retain sans/mono roles. No fourth font was introduced.
- Spacing and layout rhythm: title-to-body gaps are 8 px inside a reading unit; sibling reading groups use 24–72 px; chapter-to-content gaps use 36–72 px; top-level chapter breaks use 88–136 px desktop and at least 72 px mobile. The combined comparison shows that “一句话结论 / 主要问题 / 本张先改” no longer visually collapse into one block.
- Colors and tokens: the existing charcoal, warm-white and rust-orange tokens are unchanged. Functional score-list rules remain; no decorative frame system was added.
- Image quality: both QA photographs are existing PhotoSense JPEG assets, displayed with `object-fit: contain`, original colour and no filter.
- Copy and content: all report content and chapter names are preserved except the explicitly removed score-context sentence. The DOM and screenshots confirm that “基于数码摄影、街头摄影与进阶水平的学习参考” is absent.
- Responsiveness and accessibility: the orientation class changes after image load. At desktop, the portrait photo and score modules share the same measured vertical centre; landscape uses a full-width score row before the full-width photograph. At 390 px the same landscape reading order is retained, and at 760 px portrait content stacks without overflow.

### Iteration history

1. P1 — The first implementation used `.section-title`, but the live heading wrapper is `.report-title-row`; chapter type remained too small and the post-processing heading occupied a single grid track. The selectors were corrected. Post-fix captures show large, full-width chapter headings.
2. P1 — The first five-dimension capture exposed all five diagnostic cards in narrow columns because an inherited grid rule remained stronger. The final cascade explicitly sets a 12-column desktop grid with 4/4/4 then 6/6 spans, 6/6 tablet spans and one mobile column.
3. P1 — The prior overview used one photo-first layout for every aspect ratio. The final implementation measures `naturalWidth` and `naturalHeight`: portrait remains photo/score side-by-side at desktop, while landscape becomes score-first with total/radar on the left and dimension scores on the right, followed by the full-width image.
4. P2 — Multiple report groups had sibling spacing equal to or smaller than their internal title/body gap. Shared reading-unit and sibling-group rules now enforce the inverse relationship throughout verdict, observation, diagnosis, post-processing, next-shooting and evaluation-context sections.
5. P2 — Chapter starts lacked hierarchy. The four section-heading wrappers following the lead now use a larger serif scale and 88–136 px preceding whitespace; the lead verdict was already the report's largest headline.

### Verification

- Automated orientation interaction test covers landscape and portrait image-load transitions.
- Static design assertions cover the score-first landscape grid and chapter title scale.
- `1440-portrait-metrics.json`: portrait class present, no overflow, no score-context sentence, centre delta 0 px.
- `1440-landscape-metrics.json`: landscape class present, score and photograph both 1190.40625 px wide, no overflow, no score-context sentence.
- `760-portrait-metrics.json` and `390-landscape-metrics.json`: no overflow, no console errors and no removed sentence.

final result: passed

## 2026-09-11 analysis report newspaper-layout rebuild

- Source visual truth: the three user-provided newspaper references at `C:/Users/YYN/AppData/Local/Temp/codex-clipboard-b46d91ba-9699-4e32-b22f-1d5663c00a15.png`, `C:/Users/YYN/AppData/Local/Temp/codex-clipboard-37221dd4-f246-4024-874b-885444050f69.png`, and `C:/Users/YYN/AppData/Local/Temp/codex-clipboard-8364b143-ccf0-4d29-9267-d1618b313e62.png`.
- Layout specification: `docs/REPORT_NEWSPAPER_LAYOUT_DESIGN.md`.
- Implementation evidence: `D:/CodexData/.codex/visualizations/2026/09/11/photosense-newspaper-report/1440-report-full.png`, `760-report-full.png`, `390-report-full.png`, plus overview, observation and context focused captures at each width.
- Viewports and density: 1440 x 1000, 760 x 960 and 390 x 844 CSS px; `deviceScaleFactor: 1`. Final full-page outputs are 1440 x 5667, 760 x 8793 and 390 x 8526 px.
- State: the same persisted PhotoSense report was opened at all three widths, with the full 01–05 report visible and no hover-dependent content.
- Browser evidence: Microsoft Edge headless capture through the DevTools protocol. No console exceptions or console errors were recorded.

### Comparison and required fidelity surfaces

- Full-view comparison: the three source images and the 1440 px implementation were opened in one comparison input. The implementation uses the shared newspaper logic—display headline, compact issue strip, lead image with sidebar, modular columns and restrained rules—without copying the references' paper colour, masthead identity or sample copy.
- Focused comparison: `1440-report-overview.png` (1214 x 910), `1440-report-observation.png` (1214 x 533) and `1440-report-context.png` (1214 x 498) were used because body hierarchy and column alignment are not legible in the 5667 px full-page reduction. Mobile overview, observation and context captures were also inspected at native width.
- Fonts and typography: the existing three-role system remains unchanged—serif for report headlines and section titles, sans for body/labels/actions, mono for score/date/file metadata. The 1440 px verdict has the strongest scale; mobile wraps it cleanly without clipping or an added font family.
- Spacing and layout rhythm: the fixed left report rail is replaced by a horizontal five-part issue index. The desktop overview uses a 12-column layout with the photograph occupying eight columns and score evidence four; observation uses a 2 x 2 grid plus a full-width crop row; diagnosis uses a 3 + 2 full-row structure; post-processing uses a 7/5 image/sidebar split; actions and context use three and four columns. Sections are separated primarily by vertical space and only functional rules.
- Colors and tokens: the existing charcoal, warm-white and restrained rust-orange tokens are preserved. No newspaper-beige imitation, gradient, extra card fill or decorative border system was added.
- Image quality: the uploaded photograph and generated post-processing preview retain their original aspect ratios and colour. Both are real application assets, not placeholders or code-drawn replacements.
- Copy and content: report copy, scores, fields, source status and the 01–05 anchors remain unchanged. Only layout CSS and design documentation changed in this iteration.
- Responsiveness and accessibility: 760 and 390 px collapse the wide grids to ordered reading columns; the issue index remains horizontally available, persistent controls keep their existing semantics, and browser metrics report no horizontal overflow.

### Iteration history

1. P1 — The initial layout targeted the obsolete `.post-processing-preview` selector while the live component uses `.post-preview-panel`, compressing the preview into one grid track and creating a very tall vertical strip. The selector was corrected, inherited panel decoration was removed, and the image was restored to full width. Post-fix evidence: `1440-report-full.png` shows a conventional landscape preview beside the three advice entries and reduces the desktop report from 6942 px to 5667 px.
2. P2 — The previous fixed left navigation consumed report width and kept the page close to the old structure. It was replaced with the horizontal issue index; post-fix evidence shows the complete 1214 px report column available to the article grid.
3. P2 — The former report treated most sections as isolated full-width blocks. The final 12-column templates establish lead-story, sidebar, 3 + 2 diagnosis, 7/5 post-processing, three-column action and four-column context compositions. Focused captures confirm aligned columns and usable line lengths.
4. P2 — Wide structures could have caused narrow-screen overflow or unreadable columns. Explicit 1180 px and 760 px reductions now produce single-column overview/post-processing and readable mobile sections; computed metrics report `overflow: false` at 760 and 390 px.

### Functional verification

- `npm.cmd run check`: passed.
- TypeScript test build: passed.
- Automated tests: 48 passed, 0 failed.
- Production Vite build: passed.
- Primary interactions tested: open the analysis report from global navigation, use the live report state, preserve the five report anchors, and open history management after the report capture.
- Residual P3: the complete report is necessarily long on a 390 px viewport; all content remains ordered and readable, so no truncation or multi-column compression was introduced to shorten it artificially.

final result: passed

## 2026-09-11 history cleanup and newspaper-grid report

- Source visual truth: user-provided history/report issue captures plus the three newspaper layout references at `C:/Users/YYN/AppData/Local/Temp/codex-clipboard-b46d91ba-9699-4e32-b22f-1d5663c00a15.png`, `codex-clipboard-37221dd4-f246-4024-874b-885444050f69.png`, and `codex-clipboard-8364b143-ccf0-4d29-9267-d1618b313e62.png`.
- Implementation screenshots: `D:/CodexData/.codex/visualizations/2026/09/11/photosense-newspaper-report/1440-report-full.png`, `760-report-full.png`, `390-report-full.png`, and matching history-management captures in the same directory.
- Viewports and density: 1440 x 1000, 760 x 960, and 390 x 844 CSS px; `deviceScaleFactor: 1`. Full-page output dimensions are 1440 x 7352, 760 x 8859, and 390 x 8588 px.
- State: one persisted real PhotoSense sample record; report open at the overview, history open in management mode, no hover required for tags or delete control.
- Browser evidence: Microsoft Edge headless capture through the DevTools protocol, matching the saved Product Design browser preference. No browser console errors were recorded.

### Comparison and required fidelity surfaces

- Full-view comparison: the source references and implementation were opened together. The implementation translates their hierarchy rather than their paper colour: a large serif lead, compact sans-serif labels, a 7/5 lead grid, full-width photograph, two-column observation copy, and a four-column context block. It does not copy the reference mastheads or decorative paper treatment.
- Focused comparison: `1440-report-overview.png` (981 x 1353), `1440-report-observation.png` (981 x 533), `1440-report-context.png` (981 x 554), and `1440-history-card-manage.png` (944 x 414) were inspected because the full 7352 px report makes labels and border states too small to judge.
- Fonts and typography: the existing three-role serif/sans/mono system remains intact. Display headlines use the serif role; body, tags and actions use the sans role; numeric scores retain mono treatment. Desktop report body text is 16–18.56 px with 1.75 line height; mobile remains readable without clipping.
- Spacing and layout rhythm: desktop lead columns measure 540 px and 360 px with an 80 px gap; the observation grid measures 957.6 px and uses two equal text columns plus one full-width crop note. At 760 and 390 px these structures collapse to one column. No horizontal overflow was detected.
- Colors and tokens: warm white is used for report metadata and body text, rust orange remains restricted to headings, scores and state emphasis, and thin neutral rules are used only to separate major editorial bands. History metadata tags now have a permanent 1 px neutral border.
- Image quality: the original uploaded photograph is reused without filters, recolouring or synthetic replacements. The report image remains full-width and the history thumbnail crop is unchanged.
- Copy and content: all report wording and the 01–05 section order are preserved. The history comparison entry, selection copy and comparison panel are absent by explicit request.
- Interaction and accessibility: history has one management entry, `aria-pressed` remains on that control, delete keeps its confirmation flow and a 44 px target, and report/history navigation remains functional. Captured metrics confirm zero comparison buttons, permanent tag borders, visible dark-red delete fill, and zero console errors.

### Iteration history

1. P1 — The history page exposed a comparison workflow the user asked to remove. Removed the entry, comparison state, record selectors, panel and production utility; post-fix captures report zero comparison buttons at all three viewports.
2. P1 — Delete and metadata controls depended too heavily on hover. Restyled delete to match the `NEW` label's dark-red/cream treatment and made tag borders permanent; post-fix computed styles are `rgb(142, 47, 34)` and `1px` respectively.
3. P1 — The report lead left “主要问题 / 本张先改” in a narrow residual area. Rebuilt the lead as a 7/5 editorial grid and gave both notes the complete verdict-column width; `1440-report-overview.png` confirms the two notes align as equal columns.
4. P2 — “画面观察” and “评价依据” left large unused rails and used low-contrast metadata. Made both sections full-width editorial grids and raised metadata to `--em-paper-soft`; focused post-fix captures show readable two/four-column structures.
5. P2 — Mobile could have inherited the wide newspaper grid. Added explicit single-column reductions for verdict notes, observation, crop guidance and evaluation context; 760/390 captures have no horizontal overflow.
6. P2 — The first desktop management capture placed the newly prominent delete control over the score label. Moved the management action into the photo layer, mirroring `NEW`; the revised `1440-history-card-manage.png` shows both labels on the image with the score unobstructed.

### Functional verification

- `npm.cmd run check`: passed.
- TypeScript test build: passed.
- Automated tests: 48 passed, 0 failed.
- Production Vite build: passed.
- Primary interactions tested: open report, open history, enter management mode, inspect non-hover delete/tag states.
- Residual P3: the intentionally long report remains vertically dense; this is consistent with its complete 01–05 reading flow and does not block access or legibility.

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

## 2026-09-11 report title deduplication

- Source visual truth: the user's annotated evaluation-context crop at `C:/Users/YYN/AppData/Local/Temp/codex-clipboard-d4af142a-0c9e-4d63-a462-9e34804c46f2.png` (1252 x 601 px), together with the explicit requirement that each report subsection retain one fused title and that the report directory use the same terms.
- Implementation screenshots: `D:/CodexData/.codex/visualizations/2026/09/11/photosense-title-dedup/1440-report-full.png`, `760-report-full.png`, `390-report-full.png`, and the matching overview, observation and context crops in the same directory.
- Viewports and density: 1440 x 1000, 760 x 960 and 390 x 844 CSS px at `deviceScaleFactor: 1`. Full-page outputs are 1440 x 5313, 760 x 8244 and 390 x 7996 px.
- State: one persisted real report opened through the global analysis-report navigation; all five report anchors and the complete report content are present.
- Browser evidence: Microsoft Edge headless capture through the DevTools protocol. Metrics report no horizontal overflow and no console exceptions or console errors at all three widths.

### Comparison and required fidelity surfaces

- Full-view comparison: the final report was inspected as a complete page to confirm that removing headings did not break the newspaper grid, section order or vertical rhythm.
- Focused comparison: the annotated source crop and `1440-report-context.png` (1214 x 429) were opened in the same comparison input. The source's three stacked headings are replaced by one `评价基准` heading; the medium/level/genre string remains a right-aligned metadata line above the four evidence columns. `390-report-context.png` (350 x 886) confirms the same hierarchy in one column.
- Fonts and typography: no font roles changed. Each top-level report section now has one serif heading; generic eyebrow text such as `诊断维度`, `后期参考`, `诊断模块` and `Processed image` is absent.
- Spacing and layout rhythm: the removed overview kicker no longer reserves an empty grid row; desktop headline and summary start on the same row. The context crop height falls from 498 px to 429 px while preserving readable column spacing.
- Colors and tokens: existing warm white and rust-orange tokens remain unchanged; title removal introduces no new state or contrast treatment.
- Image quality: report and post-processing images are untouched and retain their existing crops and colour.
- Copy and content: critique text, scores, recommendations and evaluation evidence are unchanged. Only redundant display headings and their navigation labels were consolidated.
- Interaction and accessibility: the directory remains five accessible anchors with `aria-current`; labels are now `评审结论`, `五维诊断`, `后期建议`, `下次拍摄`, and `评价基准`. Every report section still starts at `h2`, and diagnostic items retain `h3` headings.

### Iteration history

1. P1 — The evaluation section showed three synonymous titles (`评价依据`, `补充说明`, `本次评价基准`). They were consolidated into one `评价基准` heading and the directory entry was updated to match. Post-fix evidence: `1440-report-context.png` and `390-report-context.png`.
2. P2 — Other report sections repeated generic eyebrows above meaningful titles. The top-level sections now use one heading each, diagnostic cards keep only their dimension name, and the post-processing preview keeps only `修改后效果预览`.
3. P2 — Removing the overview kicker initially risked leaving the former first grid row empty. Its headline, summary and notes were reassigned to rows one and two; `1440-report-overview.png` shows no residual top gap.

### Functional verification

- `npm.cmd run check`: passed.
- TypeScript test build: passed.
- Automated tests: 48 passed, 0 failed.
- Production Vite build: passed.
- Updated interaction assertions verify the five new directory labels and the absence of redundant context, preview and diagnostic-card kickers.

final result: passed

## 2026-09-11 latest QA status: report rhythm and image orientation

- Detailed evidence and findings are recorded above under `report rhythm and image-orientation follow-up`.
- Combined comparison: `D:/CodexData/.codex/visualizations/2026/09/11/photosense-report-rhythm-orientation/comparison-source-vs-implementation.png`.
- Final captures cover 1440 px portrait and landscape layouts, 760 px portrait layout, and 390 px landscape layout.
- The final browser pass found no horizontal overflow, no console errors, no removed score-context sentence, and no remaining P0/P1/P2 visual findings.

final result: passed

## 2026-09-14 latest QA status: homepage review workbench

- Detailed evidence and the complete iteration history are recorded above under `2026-09-14 homepage review workbench and generated comparisons`.
- Final combined comparisons: `output/homepage-qa/homepage-full-comparison-final.png` and `output/homepage-qa/homepage-right-column-comparison-final.png`.
- Final browser captures cover 1440 x 1024, 760 x 1200 and 390 x 844 at device scale factor 1; the before/after switch and film-to-report synchronization were exercised with no application console errors or horizontal overflow.
- `npm.cmd run check` passed with 59 tests, TypeScript and the production Vite build.

final result: passed

## 2026-09-14 homepage film frame and numbered advice refinement

- The decorative outer border and track-container border were removed from the homepage film rail. Each thumbnail keeps its own boundary so the individual photographs remain distinguishable.
- Homepage `优化建议` now exposes an explicit numbered index class and keeps the orange circular numbering treatment aligned with the report's numbered advice language.
- The change is local to the homepage preview; report controls, functional form boundaries and the image comparison control remain unchanged.
- The right-side preview uses a fixed bottom row for the film rail. Its bottom spacing comes from the panel inset instead of the amount of verdict or advice text, with responsive minimum heights preserving the same anchoring on tablet and mobile.
- Verification: `npm.cmd run check` passed with 60 tests; the local page remains available at `http://127.0.0.1:5173/`.

## 2026-09-14 homepage showcase curation

- Removed `雾湖栖鸟`, `雪峰灯火` and `夜色街角` from the homepage showcase data so they no longer appear in the moving film strip or its duplicated loop items.
- Existing report/history data and source photo assets were not removed; this is limited to the homepage's curated example set.

## 2026-09-15 share-report full-image priority

- The simple share report now treats complete photo display as the first constraint for both portrait and landscape images. Images use their intrinsic ratio at full frame width with `object-fit: contain`; no report-photo crop or filter is introduced.
- The existing 392 px image area remains the minimum for landscape work. Portrait work expands the comparison row and overall report height while preserving the title, analysis, score and advice spacing.
- The footer participates in the report grid so the expanded portrait layout cannot overlap the final recommendation.
- Visual evidence: `tmp/qa-share-poster-portrait-complete-v2.png` and `tmp/qa-share-poster-landscape-complete-v3.png`.
- `npm.cmd run check` passed with 63 tests, TypeScript checks and the production Vite build.

final result: passed

## 2026-09-15 detailed-export title contrast

- The detailed report export masthead title now uses `#f5f5f1` only inside `.is-detailed-export-host`, correcting the dark inherited title without changing the live report or simple share poster.
- Visual evidence: `tmp/qa-detailed-export-title.png` at the fixed 1320 px detailed-export width.
- `npm.cmd run check` passed with 63 tests, TypeScript checks and the production Vite build.

final result: passed
