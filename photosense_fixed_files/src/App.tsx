import { ChangeEvent, RefObject, useMemo, useRef, useState } from 'react';

type Genre = '街头摄影' | '人像摄影' | '风景摄影' | '建筑摄影' | '静物摄影' | '旅行摄影' | '胶片摄影';

type SkillLevel = '初学者' | '进阶' | '高级';

type ScoreName = '构图' | '光线' | '色彩' | '叙事' | '技术完成度';

type Page = 'home' | 'review' | 'report' | 'history' | 'login' | 'register';

type Report = {
  overall: string;
  scores: Record<ScoreName, number>;
  composition: string;
  lighting: string;
  colour: string;
  storytelling: string;
  technical: string;
  suggestions: string[];
  recipe: {
    exposure: string;
    contrast: string;
    highlights: string;
    shadows: string;
    temperature: string;
    cropRatio: string;
  };
};

const genres: Genre[] = ['街头摄影', '人像摄影', '风景摄影', '建筑摄影', '静物摄影', '旅行摄影', '胶片摄影'];

const skillLevels: SkillLevel[] = ['初学者', '进阶', '高级'];

const skillTooltips: Record<SkillLevel, string> = {
  初学者: '更基础、更易懂，更强调拍摄习惯、取景方式与下一次可以尝试的具体动作。',
  进阶: '加入更多构图、光线、色彩和画面组织判断，帮助你从“拍到”走向“拍准”。',
  高级: '更强调叙事、风格、视觉语言与作者意图，反馈会更接近作品集编辑视角。',
};

const scoreNames: ScoreName[] = ['构图', '光线', '色彩', '叙事', '技术完成度'];

const historyItems = [
  { title: '清晨路口的行人', genre: '街头摄影', score: 82, date: '2026年5月21日', tags: ['构图复盘', '边缘管理'], size: 'tall' },
  { title: '窗边肖像练习', genre: '人像摄影', score: 76, date: '2026年5月19日', tags: ['肤色', '背景'], size: 'medium' },
  { title: '海岸黄昏色彩稿', genre: '风景摄影', score: 88, date: '2026年5月17日', tags: ['色温', '层次'], size: 'wide' },
  { title: '美术馆立面观察', genre: '建筑摄影', score: 79, date: '2026年5月16日', tags: ['透视', '线条'], size: 'short' },
  { title: '咖啡桌静物', genre: '静物摄影', score: 84, date: '2026年5月14日', tags: ['材质', '阴影'], size: 'medium' },
  { title: '旅途中转车站', genre: '旅行摄影', score: 80, date: '2026年5月12日', tags: ['地点感', '人物'], size: 'tall' },
  { title: '胶片色偏测试', genre: '胶片摄影', score: 86, date: '2026年5月9日', tags: ['颗粒', '暖调'], size: 'short' },
];

const genreGuidance: Record<Genre, string> = {
  街头摄影: '街头摄影的力量通常来自时机、人物姿态与现场秩序之间的张力。',
  人像摄影: '人像作品首先需要建立观看关系：表情、眼神、肤色、背景克制感都会影响画面的可信度。',
  风景摄影: '风景摄影更依赖空间层次、空气感、明暗分离，以及画面能否为视线安排一条自然路径。',
  建筑摄影: '建筑影像需要严谨的边线、透视控制、结构节奏，以及能勾勒体块关系的光线。',
  静物摄影: '静物摄影看似安静，但真正的判断来自材质、阴影形状、物件关系和留白比例。',
  旅行摄影: '旅行摄影不只是记录地点，更要让地方气质、人的痕迹和视觉秩序同时成立。',
  胶片摄影: '胶片摄影可以保留颗粒、偏色和不完美，但这些质感需要服务于情绪，而不是替代画面判断。',
};

const levelGuidance: Record<SkillLevel, string> = {
  初学者: '建议先把注意力放在一个明确目标上：让主体更清楚、边缘更干净、最亮处更有控制。',
  进阶: '你已经具备一定画面控制力，可以进一步关注主体分离、边缘管理和局部明暗关系。',
  高级: '这个阶段的重点不再是单项正确，而是每个视觉决定是否共同指向清晰的作者意图。',
};

function createMockReport(genre: Genre, skillLevel: SkillLevel): Report {
  const scoreShift = skillLevel === '初学者' ? -3 : skillLevel === '高级' ? 4 : 0;

  return {
    overall: `${genreGuidance[genre]} 当前画面已经有可读的视觉核心，下一步应强化观看顺序：先让主体更快被识别，再保留次要信息作为层次。${levelGuidance[skillLevel]}`,
    scores: {
      构图: 78 + scoreShift,
      光线: 74 + scoreShift,
      色彩: 81 + scoreShift,
      叙事: 76 + scoreShift,
      技术完成度: 83 + scoreShift,
    },
    composition: `结论：主体区域已成立，但边缘仍有干扰。说明：${genre}需要更清楚的视觉入口。方向：收紧裁切或移动机位，让主体和留白关系更稳定。`,
    lighting:
      '结论：光线方向可读，但中间调还不够集中。说明：高光已能引导视线，暗部需要保留层次。方向：轻微回收高光，并用局部提亮托出主体。',
    colour:
      '结论：色彩克制，有形成情绪的基础。说明：冷暖关系可以更明确。方向：保护中性色，只让一个关键色承担视觉记忆点。',
    storytelling: `结论：画面有瞬间感，但叙事指向还可再清楚。说明：${skillLevel}阶段应先确定观众读到的第一件事。方向：减少延迟理解的元素，保留必要余味。`,
    technical:
      '结论：技术完成度稳定。说明：清晰度、曝光和整体质感足以支撑点评。方向：继续用局部调整替代大幅全局滤镜。',
    suggestions: [
      '收紧裁切，让主体进入更明确的位置。',
      '压低边缘干扰，让视线留在画面内部。',
      '局部提亮主体，再决定整体对比度。',
    ],
    recipe: {
      exposure: '+0.20',
      contrast: '+12',
      highlights: '-18',
      shadows: '+10',
      temperature: genre === '胶片摄影' ? '+4 偏暖' : '+2 偏暖',
      cropRatio: genre === '人像摄影' ? '4:5 竖幅' : genre === '建筑摄影' ? '5:4 精准裁切' : '3:2 编辑裁切',
    },
  };
}

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [selectedGenre, setSelectedGenre] = useState<Genre>('街头摄影');
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('初学者');
  const [imageUrl, setImageUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [copyStatus, setCopyStatus] = useState('复制报告');
  const [skillTooltip, setSkillTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analysisTimerRef = useRef<number | null>(null);

  const currentDate = useMemo(
    () =>
      new Intl.DateTimeFormat('zh-CN', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date()),
    [],
  );

  function clearAnalysisTimer() {
    if (analysisTimerRef.current) {
      window.clearTimeout(analysisTimerRef.current);
      analysisTimerRef.current = null;
    }
  }

  function goToPage(page: Page) {
    setCurrentPage(page);
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
  }

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    clearAnalysisTimer();

    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }

    setImageUrl(URL.createObjectURL(file));
    setFileName(file.name);
    setIsAnalyzing(false);
    setReport(null);
    setCopyStatus('复制报告');
  }

  function handleAnalyze() {
    if (!imageUrl) {
      return;
    }

    clearAnalysisTimer();
    setIsAnalyzing(true);
    setReport(null);
    setCopyStatus('复制报告');

    analysisTimerRef.current = window.setTimeout(() => {
      setReport(createMockReport(selectedGenre, skillLevel));
      setIsAnalyzing(false);
      analysisTimerRef.current = null;
      goToPage('report');
    }, 900);
  }

  function handleReset() {
    clearAnalysisTimer();

    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }

    setImageUrl('');
    setFileName('');
    setSelectedGenre('街头摄影');
    setSkillLevel('初学者');
    setIsAnalyzing(false);
    setReport(null);
    setCopyStatus('复制报告');
    setSkillTooltip(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleCopyReport() {
    if (!report) {
      return;
    }

    const scoreText = scoreNames.map((name) => `${name}：${report.scores[name]}/100`).join('\n');
    const suggestionText = report.suggestions.map((suggestion, index) => `${index + 1}. ${suggestion}`).join('\n');
    const recipeText = [
      `曝光：${report.recipe.exposure}`,
      `对比度：${report.recipe.contrast}`,
      `高光：${report.recipe.highlights}`,
      `阴影：${report.recipe.shadows}`,
      `色温：${report.recipe.temperature}`,
      `裁切比例：${report.recipe.cropRatio}`,
    ].join('\n');

    const text = `PhotoSense AI 摄影评审报告\n类型：${selectedGenre}\n创作阶段：${skillLevel}\n\n总体印象\n${report.overall}\n\n评分\n${scoreText}\n\n构图分析\n${report.composition}\n\n光线分析\n${report.lighting}\n\n色彩分析\n${report.colour}\n\n叙事分析\n${report.storytelling}\n\n技术完成度\n${report.technical}\n\n三条可执行建议\n${suggestionText}\n\n建议后期配方\n${recipeText}`;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        const copyArea = document.createElement('textarea');
        copyArea.value = text;
        document.body.appendChild(copyArea);
        copyArea.select();
        document.execCommand('copy');
        document.body.removeChild(copyArea);
      }

      setCopyStatus('已复制');
    } catch {
      setCopyStatus('复制失败');
    }

    window.setTimeout(() => setCopyStatus('复制报告'), 1600);
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand brand-button" type="button" onClick={() => goToPage('home')} aria-label="PhotoSense AI 首页">
          <span className="brand-mark">影</span>
          <span>PhotoSense AI</span>
        </button>
        <nav className="nav-links" aria-label="主导航">
          <button className={currentPage === 'home' ? 'active' : ''} type="button" onClick={() => goToPage('home')}>
            首页
          </button>
          <button className={currentPage === 'review' ? 'active' : ''} type="button" onClick={() => goToPage('review')}>
            开始点评
          </button>
          <button className={currentPage === 'report' ? 'active' : ''} type="button" onClick={() => goToPage('report')}>
            分析报告
          </button>
          <button className={currentPage === 'history' ? 'active' : ''} type="button" onClick={() => goToPage('history')}>
            历史记录
          </button>
        </nav>
        <div className="header-actions" aria-label="用户入口">
          <button className={currentPage === 'login' ? 'login-button active' : 'login-button'} type="button" onClick={() => goToPage('login')}>
            登录
          </button>
          <button
            className={currentPage === 'register' ? 'login-button active' : 'login-button'}
            type="button"
            onClick={() => goToPage('register')}
          >
            注册
          </button>
          <button className="user-entry" type="button" aria-label="模拟用户入口">
            <span>陈</span>
          </button>
        </div>
      </header>

      {currentPage === 'home' && <HomePage onStartReview={() => goToPage('review')} />}

      {currentPage === 'review' && (
        <ReviewPage
          currentDate={currentDate}
          fileInputRef={fileInputRef}
          fileName={fileName}
          imageUrl={imageUrl}
          isAnalyzing={isAnalyzing}
          onAnalyze={handleAnalyze}
          onImageUpload={handleImageUpload}
          onReset={handleReset}
          onSelectGenre={setSelectedGenre}
          onSelectSkillLevel={setSkillLevel}
          onSetReport={setReport}
          onSetSkillTooltip={setSkillTooltip}
          selectedGenre={selectedGenre}
          skillLevel={skillLevel}
          skillTooltip={skillTooltip}
        />
      )}

      {currentPage === 'report' && (
        <ReportPage
          copyStatus={copyStatus}
          currentDate={currentDate}
          imageUrl={imageUrl}
          isAnalyzing={isAnalyzing}
          onCopyReport={handleCopyReport}
          onStartReview={() => goToPage('review')}
          report={report}
          selectedGenre={selectedGenre}
          skillLevel={skillLevel}
        />
      )}

      {currentPage === 'history' && <HistoryPage />}
      {currentPage === 'login' && <LoginPage onSwitch={() => goToPage('register')} />}
      {currentPage === 'register' && <RegisterPage onSwitch={() => goToPage('login')} />}

      <footer className="site-footer">
        <p>面向摄影创作者与品牌内容团队的 AI 辅助复盘工具。</p>
      </footer>
    </div>
  );
}

function HomePage({ onStartReview }: { onStartReview: () => void }) {
  return (
    <main className="page-main page-home">
      <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-collage" aria-hidden="true">
            <span className="photo-tile tile-street" />
            <span className="photo-tile tile-portrait" />
            <span className="photo-tile tile-landscape" />
            <span className="photo-tile tile-archive" />
            <span className="photo-tile tile-night" />
            <span className="photo-tile tile-window" />
          </div>
          <div className="hero-copy">
            <p className="eyebrow">AI 摄影点评助手</p>
            <h1 id="hero-title">让每一张作品都有清晰的下一步。</h1>
            <p className="hero-text">
              PhotoSense AI 面向摄影创作者、内容团队与作品集准备场景，将照片拆解为构图、光线、色彩、叙事与技术完成度，生成克制、具体、可执行的中文评审报告。
            </p>
            <div className="hero-actions">
              <button className="primary-link" type="button" onClick={onStartReview}>
                开始点评
              </button>
              <span>上传作品后约 1 秒生成模拟评审</span>
            </div>
            <dl className="hero-metrics" aria-label="产品能力概览">
              <div>
                <dt>5 项</dt>
                <dd>影像评分维度</dd>
              </div>
              <div>
                <dt>7 类</dt>
                <dd>摄影题材预设</dd>
              </div>
              <div>
                <dt>3 步</dt>
                <dd>完成一次复盘</dd>
              </div>
            </dl>
          </div>

          <div className="feature-preview" aria-label="功能流程展示区">
            <div className="feature-preview-head">
              <p className="panel-kicker">功能流程展示区</p>
              <span>原型 01</span>
            </div>
            <ol className="flow-steps">
              <li>
                <span>01</span>
                <strong>上传照片</strong>
                <p>将作品放入评审台，保留大图预览与基础信息。</p>
              </li>
              <li>
                <span>02</span>
                <strong>AI 分析</strong>
                <p>按题材与创作阶段生成差异化点评。</p>
              </li>
              <li>
                <span>03</span>
                <strong>阅读报告</strong>
                <p>查看评分、细项分析、行动建议与后期配方。</p>
              </li>
              <li>
                <span>04</span>
                <strong>查看历史记录</strong>
                <p>以作品档案方式回看近期评审结果。</p>
              </li>
            </ol>
          </div>
      </section>

      <section className="home-support" aria-labelledby="home-support-title">
          <div className="section-heading">
            <p className="eyebrow">产品亮点</p>
            <h2 id="home-support-title">不是聊天窗口，而是一张影像评审单。</h2>
          </div>
          <div className="support-grid">
            <article>
              <p className="panel-kicker">结构化点评</p>
              <h3>从审美判断回到具体问题</h3>
              <p>报告围绕构图、光线、色彩、叙事与技术完成度展开，避免空泛的好坏评价。</p>
            </article>
            <article>
              <p className="panel-kicker">摄影语境</p>
              <h3>不同题材使用不同观察方式</h3>
              <p>街头、人像、风光、建筑等题材会触发不同的点评侧重，让反馈更贴近作品语境。</p>
            </article>
            <article>
              <p className="panel-kicker">复盘友好</p>
              <h3>适合创作者和团队持续沉淀</h3>
              <p>把一次点评沉淀为可复制的学习记录，方便作品集准备、内容团队选片与内部培训展示。</p>
            </article>
          </div>
      </section>
    </main>
  );
}

type ReviewPageProps = {
  currentDate: string;
  fileInputRef: RefObject<HTMLInputElement>;
  fileName: string;
  imageUrl: string;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  onImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
  onSelectGenre: (genre: Genre) => void;
  onSelectSkillLevel: (level: SkillLevel) => void;
  onSetReport: (report: Report | null) => void;
  onSetSkillTooltip: (tooltip: { text: string; x: number; y: number } | null) => void;
  selectedGenre: Genre;
  skillLevel: SkillLevel;
  skillTooltip: { text: string; x: number; y: number } | null;
};

function ReviewPage({
  currentDate,
  fileInputRef,
  fileName,
  imageUrl,
  isAnalyzing,
  onAnalyze,
  onImageUpload,
  onReset,
  onSelectGenre,
  onSelectSkillLevel,
  onSetReport,
  onSetSkillTooltip,
  selectedGenre,
  skillLevel,
  skillTooltip,
}: ReviewPageProps) {
  return (
    <main className="page-main page-review">
      <section className="review-desk page-view" aria-labelledby="review-title">
          <div className="section-heading">
            <p className="eyebrow">开始点评</p>
            <h2 id="review-title">按创作阶段建立一张作品评审单</h2>
          </div>

          <div className="review-worktable">
            <aside className="review-controls" aria-label="点评流程控制">
              <section className="sequence-block skill-block">
                <div className="step-label">
                  <span>01</span>
                  <p>摄影水平</p>
                </div>
                <div className="level-toggle">
                  {skillLevels.map((level) => (
                    <button
                      className={skillLevel === level ? 'level-button active' : 'level-button'}
                      key={level}
                      type="button"
                      onMouseEnter={(event) =>
                        onSetSkillTooltip({ text: skillTooltips[level], x: event.clientX, y: event.clientY })
                      }
                      onMouseMove={(event) =>
                        onSetSkillTooltip({ text: skillTooltips[level], x: event.clientX, y: event.clientY })
                      }
                      onMouseLeave={() => onSetSkillTooltip(null)}
                      onFocus={(event) =>
                        onSetSkillTooltip({
                          text: skillTooltips[level],
                          x: event.currentTarget.getBoundingClientRect().left + 20,
                          y: event.currentTarget.getBoundingClientRect().bottom,
                        })
                      }
                      onBlur={() => onSetSkillTooltip(null)}
                      onClick={() => {
                        onSelectSkillLevel(level);
                        onSetReport(null);
                      }}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </section>

              <section className="sequence-block genre-block">
                <div className="step-label">
                  <span>02</span>
                  <p>摄影风格</p>
                </div>
                <div className="genre-orbit">
                  {genres.map((genre, index) => (
                    <button
                      className={selectedGenre === genre ? `genre-button genre-${index + 1} active` : `genre-button genre-${index + 1}`}
                      key={genre}
                      type="button"
                      onClick={() => {
                        onSelectGenre(genre);
                        onSetReport(null);
                      }}
                    >
                      <span>{genre}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="sequence-block upload-command">
                <div className="step-label">
                  <span>03</span>
                  <p>上传照片</p>
                </div>
                <div className="rounded-control upload-status-card">
                  <div>
                    <p className="panel-kicker">作品状态</p>
                    <h3>{fileName || '等待选择影像文件'}</h3>
                    <p>支持本地图片即时预览，用于生成模拟摄影点评报告。</p>
                  </div>
                  <button className="secondary-button rounded-command" type="button" onClick={() => fileInputRef.current?.click()}>
                    选择照片
                  </button>
                  <input
                    ref={fileInputRef}
                    className="visually-hidden"
                    type="file"
                    accept="image/*"
                    onChange={onImageUpload}
                  />
                </div>
              </section>

              <section className="sequence-block action-block">
                <div className="step-label">
                  <span>04</span>
                  <p>开始分析</p>
                </div>
                <div className="desk-actions rounded-actions">
                  <button className="analyze-button rounded-command" type="button" disabled={!imageUrl || isAnalyzing} onClick={onAnalyze}>
                    {isAnalyzing ? '正在分析影像' : '开始分析'}
                  </button>
                  <button className="reset-button rounded-command" type="button" onClick={onReset}>
                    重置
                  </button>
                </div>
              </section>

              <div className="review-note">
                <p className="panel-kicker">分析说明</p>
                <p>当前点评将覆盖构图、光线、色彩、叙事与技术完成度，并给出三条可执行建议和一组后期参数参考。</p>
              </div>
            </aside>

            <section className="review-preview" aria-label="照片上传与预览">
              <div className="preview-header">
                <div>
                  <p className="panel-kicker">审片灯台</p>
                  <h3>{fileName ? '作品已进入点评流程' : '请先上传一张照片'}</h3>
                </div>
                <div className="preview-index">
                  <span>{skillLevel}</span>
                  <span>{selectedGenre}</span>
                </div>
              </div>

              <div className={`preview-stage ${imageUrl ? 'has-image' : ''}`}>
                {imageUrl ? (
                  <img src={imageUrl} alt="已上传照片预览" />
                ) : (
                  <div className="empty-preview light-table-empty">
                    <span>待审</span>
                    <p>上传后会在灯台区域生成大图预览</p>
                  </div>
                )}
              </div>

              <div className="frame-metadata" aria-label="已上传照片信息">
                <span>{fileName ? '已上传' : '尚未选择文件'}</span>
                <span>{selectedGenre}</span>
                <span>{currentDate}</span>
              </div>
            </section>
          </div>

          {skillTooltip ? (
            <div className="skill-tooltip" style={{ left: skillTooltip.x + 18, top: skillTooltip.y + 18 }}>
              {skillTooltip.text}
            </div>
          ) : null}
      </section>
    </main>
  );
}

type ReportPageProps = {
  copyStatus: string;
  currentDate: string;
  imageUrl: string;
  isAnalyzing: boolean;
  onCopyReport: () => void;
  onStartReview: () => void;
  report: Report | null;
  selectedGenre: Genre;
  skillLevel: SkillLevel;
};

function ReportPage({ copyStatus, currentDate, imageUrl, isAnalyzing, onCopyReport, onStartReview, report, selectedGenre, skillLevel }: ReportPageProps) {
  return (
    <main className="page-main page-report">
      <section className="report-section page-view" aria-live="polite" aria-labelledby="report-title">
          <div className="section-heading report-heading">
            <div>
              <p className="eyebrow">评审报告</p>
              <h2 id="report-title">影像诊断报告</h2>
            </div>
            {report ? (
              <button className="secondary-button compact" type="button" onClick={onCopyReport}>
                {copyStatus}
              </button>
            ) : null}
          </div>

          {isAnalyzing ? (
            <div className="loading-panel">
              <div className="scan-line" />
              <p>正在读取明暗结构、主体层级与画面意图。</p>
            </div>
          ) : null}

          {!isAnalyzing && !report ? (
            <div className="empty-report empty-report-state">
              <p className="eyebrow">暂无分析报告</p>
              <h3>请先上传一张照片并完成 AI 点评。</h3>
              <button className="primary-link" type="button" onClick={onStartReview}>
                前往开始点评
              </button>
            </div>
          ) : null}

          {report ? (
            <div className="diagnostic-report">
              <section className="diagnostic-hero-report" aria-label="照片诊断标注">
                <div className="diagnostic-image-board">
                  {imageUrl ? <img src={imageUrl} alt="用于诊断的已上传照片" /> : null}
                  <span className="image-callout callout-one">主体锚点</span>
                  <span className="image-callout callout-two">高光引导</span>
                  <span className="image-callout callout-three">边缘干扰</span>
                </div>
                <article className="diagnostic-overview">
                  <SectionTitle icon="overall" eyebrow="总体判断" title="先建立观看顺序，再保留画面余味" />
                  <p>{report.overall}</p>
                  <dl>
                    <div>
                      <dt>摄影风格</dt>
                      <dd>{selectedGenre}</dd>
                    </div>
                    <div>
                      <dt>点评口径</dt>
                      <dd>{skillLevel}</dd>
                    </div>
                    <div>
                      <dt>报告日期</dt>
                      <dd>{currentDate}</dd>
                    </div>
                  </dl>
                </article>
              </section>

              <section className="score-sheet" aria-label="摄影评分">
                <SectionTitle icon="technical" eyebrow="评分表" title="五项摄影诊断维度" />
                <div className="score-strip">
                  {scoreNames.map((name) => (
                    <div className="score-item" key={name}>
                      <span>{name}</span>
                      <strong>{report.scores[name]}</strong>
                      <div className="score-rule">
                        <span style={{ width: `${report.scores[name]}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="diagnosis-grid" aria-label="分析模块">
                <DiagnosticCard icon="composition" title="构图" text={report.composition} />
                <DiagnosticCard icon="lighting" title="光线" text={report.lighting} />
                <DiagnosticCard icon="colour" title="色彩" text={report.colour} />
                <DiagnosticCard icon="storytelling" title="叙事" text={report.storytelling} />
                <DiagnosticCard icon="technical" title="技术完成度" text={report.technical} />
              </section>

              <section className="visual-suggestions" aria-label="可执行建议">
                <SectionTitle icon="suggestions" eyebrow="行动建议" title="三组可视化修改方向" />
                <div className="suggestion-grid">
                  {report.suggestions.map((suggestion, index) => (
                    <SuggestionCard key={suggestion} index={index} text={suggestion} />
                  ))}
                </div>
              </section>

              <section className="edit-recipe-sheet">
                <SectionTitle icon="recipe" eyebrow="后期参考" title="暗房式调整记录" />
                <div className="recipe-board">
                  <RecipeItem label="曝光" value={report.recipe.exposure} />
                  <RecipeItem label="对比度" value={report.recipe.contrast} />
                  <RecipeItem label="高光" value={report.recipe.highlights} />
                  <RecipeItem label="阴影" value={report.recipe.shadows} />
                  <RecipeItem label="色温" value={report.recipe.temperature} />
                  <RecipeItem label="裁切比例" value={report.recipe.cropRatio} />
                </div>
              </section>
            </div>
          ) : null}
      </section>
    </main>
  );
}

function HistoryPage() {
  return (
    <main className="history-page">
      <section className="history-hero">
        <p className="eyebrow">历史记录</p>
        <h1>以时间线整理你的每一次影像复盘。</h1>
        <p>
          这里合并历史浏览、上传管理与时间轴归档。每张卡片代表一次点评记录，便于回看风格变化、筛选作品集素材和追踪训练方向。
        </p>
      </section>

      <section className="history-toolbar" aria-label="历史记录筛选">
        <div>
          <span>全部记录</span>
          <strong>{historyItems.length}</strong>
        </div>
        <div>
          <span>本月点评</span>
          <strong>18</strong>
        </div>
        <div>
          <span>平均评分</span>
          <strong>82</strong>
        </div>
        <button type="button">管理上传</button>
      </section>

      <section className="history-feed" aria-label="摄影点评历史内容流">
        {historyItems.map((item, index) => (
          <article className={`history-card history-${item.size}`} key={item.title}>
            <div className={`history-thumb history-thumb-${index + 1}`} />
            <div className="history-card-body">
              <div>
                <p className="panel-kicker">{item.genre}</p>
                <h2>{item.title}</h2>
              </div>
              <dl>
                <div>
                  <dt>评分</dt>
                  <dd>{item.score}</dd>
                </div>
                <div>
                  <dt>日期</dt>
                  <dd>{item.date}</dd>
                </div>
              </dl>
              <div className="history-tags">
                {item.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function LoginPage({ onSwitch }: { onSwitch: () => void }) {
  return <AuthPage mode="login" onSwitch={onSwitch} />;
}

function RegisterPage({ onSwitch }: { onSwitch: () => void }) {
  return <AuthPage mode="register" onSwitch={onSwitch} />;
}

function AuthPage({ mode, onSwitch }: { mode: 'login' | 'register'; onSwitch: () => void }) {
  const isLogin = mode === 'login';

  return (
    <main className="auth-page">
      <section className="auth-visual" aria-hidden="true">
        <div className="auth-frame auth-frame-one" />
        <div className="auth-frame auth-frame-two" />
        <p>PhotoSense AI / 影像复盘工作台</p>
      </section>

      <section className="auth-panel" aria-labelledby="auth-title">
        <p className="eyebrow">{isLogin ? '登录' : '注册'}</p>
        <h1 id="auth-title">{isLogin ? '回到你的评审工作台。' : '创建一个新的影像复盘空间。'}</h1>
        <p className="auth-intro">
          {isLogin
            ? '登录后可继续管理历史点评、上传记录与作品集准备进度。'
            : '用于产品原型展示，表单暂不连接真实账号系统。'}
        </p>

        <form className="auth-form">
          {!isLogin ? (
            <label>
              用户名
              <input type="text" placeholder="例如：陈明" />
            </label>
          ) : null}
          <label>
            邮箱或手机号
            <input type="text" placeholder="name@example.com / 138 0000 0000" />
          </label>
          <label>
            密码
            <input type="password" placeholder="请输入密码" />
          </label>
          {!isLogin ? (
            <label>
              确认密码
              <input type="password" placeholder="再次输入密码" />
            </label>
          ) : null}
          {!isLogin ? (
            <label className="agreement-row">
              <input type="checkbox" />
              <span>我已阅读并同意用户协议与隐私政策</span>
            </label>
          ) : null}
          <button className="analyze-button rounded-command" type="button">
            {isLogin ? '登录' : '注册'}
          </button>
        </form>

        <div className="auth-links">
          {isLogin ? <button type="button">忘记密码</button> : null}
          <button type="button" onClick={onSwitch}>
            {isLogin ? '还没有账号？去注册' : '已有账号？去登录'}
          </button>
        </div>

        <div className="third-party-row" aria-label="第三方登录占位">
          <span>微信</span>
          <span>企业微信</span>
          <span>手机号验证码</span>
        </div>
      </section>
    </main>
  );
}

function SectionTitle({ icon, eyebrow, title }: { icon: IconName; eyebrow: string; title: string }) {
  return (
    <div className="report-title-row">
      <IconMark name={icon} />
      <div>
        <p className="panel-kicker">{eyebrow}</p>
        <h3>{title}</h3>
      </div>
    </div>
  );
}

function DiagnosticCard({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  const parts = parseDiagnosticText(text);

  return (
    <article className="diagnostic-card">
      <SectionTitle icon={icon} eyebrow="诊断模块" title={title} />
      <dl>
        <div>
          <dt>结论</dt>
          <dd>{parts.conclusion}</dd>
        </div>
        <div>
          <dt>说明</dt>
          <dd>{parts.explanation}</dd>
        </div>
        <div>
          <dt>方向</dt>
          <dd>{parts.action}</dd>
        </div>
      </dl>
    </article>
  );
}

function RecipeItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="recipe-item">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="recipe-track" aria-hidden="true">
        <i style={{ width: getRecipeWidth(label) }} />
      </div>
    </div>
  );
}

function SuggestionCard({ index, text }: { index: number; text: string }) {
  const labels = [
    { before: '原裁切', after: '收紧主体', className: 'demo-crop' },
    { before: '边缘分散', after: '压低边缘', className: 'demo-edge' },
    { before: '主体偏暗', after: '局部提亮', className: 'demo-light' },
  ];
  const demo = labels[index] ?? labels[0];

  return (
    <article className="suggestion-card">
      <div className="suggestion-copy">
        <span>{String(index + 1).padStart(2, '0')}</span>
        <p>{text}</p>
      </div>
      <div className={`mini-demo ${demo.className}`} aria-label={`${demo.before}到${demo.after}的示意图`}>
        <div>
          <em>{demo.before}</em>
        </div>
        <div>
          <em>{demo.after}</em>
        </div>
      </div>
    </article>
  );
}

type IconName = 'overall' | 'composition' | 'lighting' | 'colour' | 'storytelling' | 'technical' | 'suggestions' | 'recipe';

function IconMark({ name }: { name: IconName }) {
  return (
    <span className={`section-icon icon-${name}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" role="img">
        {name === 'overall' ? <path d="M4 12h4l2-5 4 10 2-5h4" /> : null}
        {name === 'composition' ? <path d="M5 5h14v14H5z M9 5v14 M15 5v14 M5 9h14 M5 15h14" /> : null}
        {name === 'lighting' ? <path d="M13 2 5 14h6l-1 8 8-12h-6z" /> : null}
        {name === 'colour' ? <path d="M12 4a8 8 0 1 0 0 16 3 3 0 0 0 0-6h1a5 5 0 0 0 5-5c0-2.8-2.7-5-6-5z" /> : null}
        {name === 'storytelling' ? <path d="M5 6h14v12H5z M8 9h8 M8 12h5 M8 15h7" /> : null}
        {name === 'technical' ? <path d="M4 17h16 M6 17V8 M12 17V5 M18 17v-7" /> : null}
        {name === 'suggestions' ? <path d="M12 4v6 M12 14v6 M4 12h6 M14 12h6 M7 7l3 3 M14 14l3 3" /> : null}
        {name === 'recipe' ? <path d="M7 4h10v16H7z M10 8h4 M10 12h4 M10 16h2" /> : null}
      </svg>
    </span>
  );
}

function parseDiagnosticText(text: string) {
  const conclusion = text.match(/结论：(.+?)。说明：/)?.[1] ?? text;
  const explanation = text.match(/说明：(.+?)。方向：/)?.[1] ?? '观察画面中的主体、明暗和边缘关系。';
  const action = text.match(/方向：(.+)$/)?.[1] ?? '下一次拍摄时先明确视觉重心。';

  return { conclusion, explanation, action };
}

function getRecipeWidth(label: string) {
  const widths: Record<string, string> = {
    曝光: '56%',
    对比度: '64%',
    高光: '38%',
    阴影: '58%',
    色温: '62%',
    裁切比例: '72%',
  };

  return widths[label] ?? '50%';
}

export default App;
