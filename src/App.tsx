import React, { ChangeEvent, DragEvent, MouseEvent, RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type {
  AnalysisState,
  Genre,
  HistoryRecord,
  Medium,
  NextShootingAdvice,
  PhotoSpecificFeedback,
  PostProcessingAdviceItem,
  Report,
  ReportSource,
  ReportVerdict,
  ReviewContext,
  ScoreName,
  SkillLevel,
} from './types/report';
import { filterAndSortHistoryRecords, countRecordsInCurrentMonth, type HistorySort } from './utils/history';
import { analysisPhases, getAnalysisPhaseStatus, getAnalysisWaitMessage } from './utils/analysis';
import { compareHistoryRecords } from './utils/comparison';
import { createFullReportPart, createPortraitReportPart } from './utils/report-export';
import { mergeAiReportWithFallback } from './utils/report';
import { formatFileSize, validateImageFile } from './utils/upload';
import { PostProcessingPreview } from './components/PostProcessingPreview';

type Page = 'home' | 'review' | 'report' | 'history' | 'login' | 'register';


const mediums: Medium[] = ['数码摄影', '胶片摄影'];

const genres: Genre[] = ['街头摄影', '人像摄影', '风景摄影', '建筑摄影', '静物摄影', '旅行摄影'];

const homeBackgroundPhotos = Array.from({ length: 34 }, (_, index) => `/home-backgrounds/photo-${String(index + 1).padStart(2, '0')}.jpg`);

const homeBackgroundCollage = [
  { src: homeBackgroundPhotos[0], className: 'card-01' },
  { src: homeBackgroundPhotos[6], className: 'card-02' },
  { src: homeBackgroundPhotos[4], className: 'card-03' },
  { src: homeBackgroundPhotos[14], className: 'card-04' },
  { src: homeBackgroundPhotos[11], className: 'card-05' },
  { src: homeBackgroundPhotos[18], className: 'card-06' },
  { src: homeBackgroundPhotos[3], className: 'card-07' },
  { src: homeBackgroundPhotos[8], className: 'card-08' },
  { src: homeBackgroundPhotos[21], className: 'card-09' },
  { src: homeBackgroundPhotos[23], className: 'card-10' },
  { src: homeBackgroundPhotos[16], className: 'card-11' },
  { src: homeBackgroundPhotos[24], className: 'card-12' },
  { src: homeBackgroundPhotos[2], className: 'card-13' },
  { src: homeBackgroundPhotos[19], className: 'card-14' },
  { src: homeBackgroundPhotos[25], className: 'card-15' },
  { src: homeBackgroundPhotos[26], className: 'card-16' },
  { src: homeBackgroundPhotos[27], className: 'card-17' },
  { src: homeBackgroundPhotos[28], className: 'card-18' },
  { src: homeBackgroundPhotos[29], className: 'card-19' },
  { src: homeBackgroundPhotos[30], className: 'card-20' },
  { src: homeBackgroundPhotos[31], className: 'card-21' },
  { src: homeBackgroundPhotos[32], className: 'card-22' },
  { src: homeBackgroundPhotos[33], className: 'card-23' },
] as const;

const homeShowcaseItems = [
  {
    id: 'night-street',
    src: homeBackgroundPhotos[0],
    alt: '夜色街角的坡道、车辆与暖色店铺灯光',
    title: '夜色街角',
    medium: '数码摄影',
    genre: '街头摄影',
    score: 78,
    verdict: '暖色店铺形成视觉锚点，但前景车灯分散了观看重心。',
    action: '降低前景车灯亮度并收紧左侧边缘，让视线更快落到街角人物。',
  },
  {
    id: 'city-gap',
    src: homeBackgroundPhotos[6],
    alt: '建筑夹道中的行人、巴士与高处塔吊',
    title: '城市夹缝',
    medium: '数码摄影',
    genre: '建筑摄影',
    score: 82,
    verdict: '建筑边界形成稳定框景，巴士与行人让尺度关系更明确。',
    action: '保留两侧暗部框景，同时微调下沿裁切，强化行人与巴士的前后层次。',
  },
  {
    id: 'lake-swans',
    src: homeBackgroundPhotos[14],
    alt: '逆光湖面上的三只天鹅与大片水面留白',
    title: '湖面逆光',
    medium: '胶片摄影',
    genre: '风景摄影',
    score: 74,
    verdict: '水面反光建立安静气氛，但主体在大面积暗部中略显分散。',
    action: '向天鹅区域轻微裁切并压低顶部高光，让三只天鹅形成更集中的观看路径。',
  },
  {
    id: 'mist-station',
    src: homeBackgroundPhotos[21],
    alt: '雾天铁路站场、红色列车与纵深交错的轨道',
    title: '雾中站场',
    medium: '胶片摄影',
    genre: '旅行摄影',
    score: 80,
    verdict: '轨道透视与雾气共同建立纵深，红色列车提供了清楚的视觉落点。',
    action: '适度提亮列车周围中间亮度区域，并保留远处雾感，强化近实远虚的层次。',
  },
  {
    id: 'night-tram',
    src: homeBackgroundPhotos[3],
    alt: '夜间站台上驶过的电车、弧形钢架与暖色灯光',
    title: '夜轨穿行',
    medium: '数码摄影',
    genre: '街头摄影',
    score: 85,
    verdict: '弧形钢架与电车光轨形成强烈动势，冷暖灯光也清楚交代了夜间空间。',
    action: '略微压低顶部高光并提亮站台人物区域，让视线沿轨道进入画面后有更明确的停留点。',
  },
  {
    id: 'station-passage',
    src: homeBackgroundPhotos[8],
    alt: '车站入口处经过的行人与车身上的人像广告',
    title: '站内掠影',
    medium: '胶片摄影',
    genre: '街头摄影',
    score: 79,
    verdict: '行人与车身人像形成有趣的视线呼应，但右侧门框和前景标牌稍微分散注意力。',
    action: '从右侧收紧少量画面并保留人物完整步态，让真实行人与广告面孔的关系成为唯一焦点。',
  },
  {
    id: 'snow-peak',
    src: homeBackgroundPhotos[10],
    alt: '暮色中的雪山、山脚城镇与零星暖色灯火',
    title: '雪峰灯火',
    medium: '数码摄影',
    genre: '风景摄影',
    score: 88,
    verdict: '雪峰轮廓与山脚灯火建立了清晰尺度，冷色暮光使远近层次保持统一。',
    action: '轻微提升山峰中间调并控制城镇最亮灯光，让观看顺序先落到雪峰再回到山脚。',
  },
  {
    id: 'mist-lake-bird',
    src: homeBackgroundPhotos[22],
    alt: '雾气笼罩的湖面、两根木桩与停栖的水鸟',
    title: '雾湖栖鸟',
    medium: '胶片摄影',
    genre: '风景摄影',
    score: 81,
    verdict: '木桩、水鸟和远山构成克制的纵深关系，大面积留白很好地保留了雾天的安静。',
    action: '略微降低天空高光并增加水鸟局部对比，让主体更稳定，同时继续保留湖面的低反差质感。',
  },
] as const;

const homeGalleryAnalysisItems = [
  {
    src: homeBackgroundPhotos[4],
    alt: '暮色中的城市街道、钟楼、车辆与亮起的窗灯',
    title: '暮色街心',
    medium: '数码摄影',
    genre: '街头摄影',
    score: 86,
    verdict: '晚霞、钟楼和车灯一起把画面撑住了，街道的方向感明确。现在更适合把注意力再集中一点，让前景和中景别互相抢。',
    action: '下次把站位再往前移一点，减少前景路面杂点并等车辆位置更整齐，让钟楼与街道成为明确重心。',
  },
  {
    src: homeBackgroundPhotos[11],
    alt: '日光下延伸的历史街区立面、道路与街边车辆',
    title: '街廓立面',
    medium: '数码摄影',
    genre: '建筑摄影',
    score: 83,
    verdict: '连续立面和道路透视把街区秩序交代得很清楚，重复窗格也形成稳定节奏。路口车辆和下沿信息略散，削弱了建筑线条的完整性。',
    action: '轻微校正建筑垂直线并从下沿收紧少量画面，减少路口车辆干扰，让立面节奏更集中。',
  },
  {
    src: homeBackgroundPhotos[18],
    alt: '远处城市天际线、海湾与开阔水面',
    title: '海湾远眺',
    medium: '数码摄影',
    genre: '风景摄影',
    score: 74,
    verdict: '远景轮廓和光线都稳，整体可读性不错，但画面更像风景记录，现场张力和观看重心还不够集中。',
    action: '下次把拍摄点再靠近主体，并适度压缩天空或水面占比，让城市轮廓成为更明确的重心。',
  },
  {
    src: homeBackgroundPhotos[23],
    alt: '隔着水面与桥梁望向远处城市、双塔与山体',
    title: '隔岸城市',
    medium: '数码摄影',
    genre: '旅行摄影',
    score: 75,
    verdict: '远处双塔、桥面交通和水面反光把空间交代得很完整，但左上和左下的大块黑影削弱了主体存在感。',
    action: '下次横移少量机位避开左侧黑影，让双塔和桥梁更直接地进入画面。',
  },
  {
    src: homeBackgroundPhotos[16],
    alt: '楼梯、金属扶手与逆光中行走的人物剪影',
    title: '光影阶梯',
    medium: '数码摄影',
    genre: '街头摄影',
    score: 82,
    verdict: '几何线条和人物剪影叠在一起的瞬间很有吸引力，氛围已经出现。人物暗部过重，观看重心会稍微卡住。',
    action: '下次等人物走到更亮一点的位置再按下快门，让姿态和阶梯结构同时清楚。',
  },
  {
    src: homeBackgroundPhotos[24],
    alt: '从车窗望见高墙壁画、城市建筑与打伞路人',
    title: '窗外街景',
    medium: '数码摄影',
    genre: '街头摄影',
    score: 81,
    verdict: '高墙壁画和打伞路人形成了上下呼应，城市感很足。前景遮挡偏多，主体虽然明确但还不够利落。',
    action: '下次少留前景遮挡，并等路人与壁画落在更干净的对应位置，让上下关系成为唯一焦点。',
  },
  {
    src: homeBackgroundPhotos[2],
    alt: '铁路站台、棚架、轨道与等候的旅客',
    title: '站台片刻',
    medium: '数码摄影',
    genre: '旅行摄影',
    score: 81,
    verdict: '空间关系和光线气氛不错，安静的候车现场能够被感受到。现在更像环境记录，人物和事件感还差一点力度。',
    action: '下次等人物走到立柱间更亮的位置，再靠近半步拍，让候车动作成为观看落点。',
  },
  {
    src: homeBackgroundPhotos[19],
    alt: '狭窄巷道、深色建筑与尽头的一束天光',
    title: '巷口微光',
    medium: '数码摄影',
    genre: '街头摄影',
    score: 70,
    verdict: '窄巷把视线一路带到尽头亮起来的楼面，空间感很明确。两侧楼体太暗，前景和中段缺少能够支撑气氛的内容。',
    action: '下次在远处亮区等人物经过，或往前走一步减少底部空白，让透视尽头出现清楚主体。',
  },
  {
    src: homeBackgroundPhotos[25],
    alt: '火车站台上倚着栏杆候车的人与行李',
    title: '站台候车',
    medium: '数码摄影',
    genre: '旅行摄影',
    score: 84,
    verdict: '现场气氛和线条组织都在线，人物与行李也提供了明确情境。人物落在较暗位置，右上大面积棚顶压住了注意力。',
    action: '下次站远一点并等人物走到更亮的位置再按下，让候车状态从棚顶阴影中分离出来。',
  },
  {
    src: homeBackgroundPhotos[26],
    alt: '夕阳照亮的砖石建筑立面、街道与远处行人',
    title: '夕照砖墙',
    medium: '数码摄影',
    genre: '建筑摄影',
    score: 84,
    verdict: '建筑表面的光线和线条秩序很耐看，立面层次稳定。下方人物存在感偏弱，街道关系还没有成为有效尺度。',
    action: '保留这组斜射光线，再等人物走到更亮、更靠前的位置按下，让建筑尺度更明确。',
  },
  {
    src: homeBackgroundPhotos[27],
    alt: '城市教堂屋顶密集的哥特式尖塔与雕像',
    title: '尖塔群像',
    medium: '数码摄影',
    genre: '建筑摄影',
    score: 78,
    verdict: '建筑线条和层次很有看点，密集尖塔建立了稳定气氛。画面边缘和天空比例还可以继续整理。',
    action: '拍摄时稍微向主体集中，保留最有力量的几根尖塔并减少边缘截断，让结构节奏更利落。',
  },
  {
    src: homeBackgroundPhotos[28],
    alt: '浅色建筑墙面、阶梯与经过的行人',
    title: '墙边行者',
    medium: '数码摄影',
    genre: '街头摄影',
    score: 86,
    verdict: '人物经过的时机是亮点，墙面、窗框和影子一起帮画面成立。右下角的大块遮挡和人物位置稍靠边，分散了观看。',
    action: '下次多等半步，让人物走到碑牌下方的干净位置再按下，并避开右下角遮挡。',
  },
  {
    src: homeBackgroundPhotos[29],
    alt: '暮色水面、岛屿建筑、钟楼与来往船只',
    title: '泻湖暮色',
    medium: '数码摄影',
    genre: '风景摄影',
    score: 88,
    verdict: '塔楼、教堂和水面关系清楚，暖色晚光让画面很有吸引力。前景船只位置略散，视线还可以更集中。',
    action: '下次稍微抬高取景，或等前景船只位置更整齐再按下，让岛屿建筑成为稳定中心。',
  },
  {
    src: homeBackgroundPhotos[30],
    alt: '老城画廊门前经过的背包行人与街道招牌',
    title: '画廊门前',
    medium: '数码摄影',
    genre: '街头摄影',
    score: 82,
    verdict: '路牌、老建筑和行人形成了完整关系。人物存在感还不够强，视线容易先被上半部分分走。',
    action: '下次等人物走到路牌正下方或光更亮的位置再按下，让人物与地点线索直接呼应。',
  },
  {
    src: homeBackgroundPhotos[31],
    alt: '城市台阶与街道上分散停留、行走的人群',
    title: '台阶人群',
    medium: '数码摄影',
    genre: '街头摄影',
    score: 72,
    verdict: '台阶上的停留与路上的行走形成了对照，人与环境同时出现。前景栏杆和路牌过强，视线容易被带偏。',
    action: '下次先移动机位避开栏杆和路牌，再等一个更明确的人物动作，让台阶上的关系成为主体。',
  },
  {
    src: homeBackgroundPhotos[32],
    alt: '强烈明暗交界中独自行走的人与建筑线条',
    title: '光下独行',
    medium: '数码摄影',
    genre: '街头摄影',
    score: 78,
    verdict: '人物刚好走进明暗交界，步态自然，现场气氛已经成立。前景栏杆、顶部遮挡和背景立杆一起分散了注意力。',
    action: '下次先横向挪两步避开栏杆，再等人物走进光里，让明暗交界直接托住主体。',
  },
  {
    src: homeBackgroundPhotos[33],
    alt: '巨大钟表机械结构、透光钟面与窗前人物剪影',
    title: '钟面之内',
    medium: '数码摄影',
    genre: '建筑摄影',
    score: 87,
    verdict: '钟面骨架、齿轮圆环与人物剪影形成强烈尺度对比，结构本身就是清楚的视觉中心。顶部黑色横梁略重，压缩了钟面上方的呼吸空间。',
    action: '拍摄时稍微降低机位或减少顶部横梁占比，并压低窗外高光，让人物剪影和机械圆环更完整地分离。',
  },
] as const;

const homeGalleryResults = [...homeShowcaseItems, ...homeGalleryAnalysisItems] as const;

const skillLevels: SkillLevel[] = ['爱好者水平', '进阶水平'];

const skillTooltips: Record<SkillLevel, string> = {
  爱好者水平: '使用日常、易懂的语言，重点说明哪里好、哪里需要调整，以及下一次可以直接尝试的动作。',
  进阶水平: '允许使用高光、阴影、影调等摄影术语，并进一步解释构图、光线和画面组织问题。',
};

const scoreNames: ScoreName[] = ['构图', '光线', '色彩', '叙事', '技术完成度'];
const HISTORY_STORAGE_KEY = 'photosense_history_records';
const HISTORY_SCHEMA_VERSION_KEY = 'photosense_history_schema_version';
const HISTORY_SCHEMA_VERSION = '2';
const MAX_HISTORY_RECORDS = 20;
const DEFAULT_ANALYSIS_API_URL = '/api/analyze-photo';
const ANALYSIS_REQUEST_TIMEOUT_MS = 100_000;
const HISTORY_EXPORT_ENABLED = import.meta.env?.VITE_ENABLE_HISTORY_EXPORT === 'true';

class AnalysisCancelledError extends Error {
  constructor() {
    super('分析已取消。');
    this.name = 'AnalysisCancelledError';
  }
}

const genreGuidance: Record<Genre, string> = {
  街头摄影: '街头摄影的力量通常来自时机、人物姿态与现场秩序之间的张力。',
  人像摄影: '人像作品首先需要建立观看关系：表情、眼神、肤色、背景克制感都会影响画面的可信度。',
  风景摄影: '风景摄影更依赖空间层次、空气感、明暗分离，以及画面能否为视线安排一条自然路径。',
  建筑摄影: '建筑影像需要严谨的边线、透视控制、结构节奏，以及能勾勒体块关系的光线。',
  静物摄影: '静物摄影看似安静，但真正的判断来自材质、阴影形状、物件关系和留白比例。',
  旅行摄影: '旅行摄影不只是记录地点，更要让地方气质、人的痕迹和视觉秩序同时成立。',
};

const mediumGuidance: Record<Medium, string> = {
  数码摄影: '数码影像应关注曝光控制、清晰度、色彩还原与后期空间。',
  胶片摄影: '胶片影像可以观察颗粒、色彩偏移、宽容度和冲扫质感是否服务于画面情绪。',
};

const levelGuidance: Record<SkillLevel, string> = {
  爱好者水平: '建议先把注意力放在一个明确目标上：让主体更清楚、画面边缘更干净、最亮处不过分抢眼。',
  进阶水平: '你已经具备一定画面控制力，可以进一步关注主体分离、边缘管理、高光与阴影层次。',
};

const mediumEvaluationFocus: Record<Medium, string> = {
  数码摄影: '按数码摄影判断时，更重视曝光准确性、高光控制、白平衡、清晰度、噪点控制与后期调整空间。',
  胶片摄影: '按胶片摄影判断时，颗粒、色偏、宽容度和冲扫质感会被视为影像气氛的一部分，而不只按数码清晰度评估。',
};

const levelEvaluationFocus: Record<SkillLevel, string> = {
  爱好者水平: '选择“爱好者水平”时，报告会使用日常、易懂的语言，重点说明主体是否清楚、画面边缘是否干净，以及下一次可以直接尝试的动作。',
  进阶水平: '选择“进阶水平”时，报告可以使用高光、阴影、影调、主体分离等摄影术语，并解释这些问题为什么影响画面。',
};

const genreEvaluationFocus: Record<Genre, string> = {
  街头摄影: '街头摄影重点观察决定性瞬间、人物姿态、主体与环境关系，以及秩序和混乱之间的现场张力。',
  人像摄影: '人像摄影重点观察表情与眼神、肤色、姿态、人物和背景关系、情绪可信度，以及主体分离和亲密感。',
  风景摄影: '风景摄影重点观察空间深度、光线时机、前中后景关系、影调层次、地方感和空气感。',
  建筑摄影: '建筑摄影重点观察透视控制、垂直水平线、结构节奏、材质质感，以及光线是否塑造出建筑体量。',
  静物摄影: '静物摄影重点观察物件关系、材质呈现、阴影形状、背景控制、留白比例和表面质感。',
  旅行摄影: '旅行摄影重点观察地方感、人的痕迹、叙事上下文，以及记录性和作品性的平衡，避免流于明信片式描述。',
};

function getReviewContext(medium: Medium, genre: Genre, skillLevel: SkillLevel): ReviewContext {
  const scoringByGenre: Record<Genre, string> = {
    街头摄影: '本次评分更重视时机、现场张力、观看顺序和人物与环境关系是否共同成立。',
    人像摄影: '本次评分更重视人物状态、情绪可信度、肤色与背景控制是否共同服务主体。',
    风景摄影: '本次评分更重视光线时机、空间层次、影调过渡和地方气质是否成立。',
    建筑摄影: '本次评分更重视透视秩序、结构节奏、线条控制和光线体积感。',
    静物摄影: '本次评分更重视物件关系、材质表达、阴影形状和留白控制。',
    旅行摄影: '本次评分更重视地方感、叙事线索、现场气氛和画面是否避免普通记录感。',
  };

  return {
    mediumFocus: mediumEvaluationFocus[medium],
    levelFocus: levelEvaluationFocus[skillLevel],
    genreFocus: genreEvaluationFocus[genre],
    scoringLogic: scoringByGenre[genre],
  };
}

function getResolvedReviewContext(report: Report | null, medium: Medium, genre: Genre, skillLevel: SkillLevel): ReviewContext {
  const fallback = getReviewContext(medium, genre, skillLevel);

  return {
    mediumFocus: report?.reviewContext?.mediumFocus || fallback.mediumFocus,
    levelFocus: report?.reviewContext?.levelFocus || fallback.levelFocus,
    genreFocus: report?.reviewContext?.genreFocus || fallback.genreFocus,
    scoringLogic: report?.reviewContext?.scoringLogic || fallback.scoringLogic,
  };
}

const internalMetaPhrases = [
  '本次评分',
  '评分侧重',
  '评价基准',
  '点评口径',
  '按初学者口径',
  '按进阶口径',
  '按高级口径',
  '按爱好者水平口径',
  '按进阶水平口径',
  '用户选择',
  'AI',
  '模型',
  '建议优化后入选',
];

function containsInternalMetaLanguage(text = '') {
  const normalizedText = typeof text === 'string' ? text : String(text ?? '');
  return internalMetaPhrases.some((phrase) => normalizedText.includes(phrase)) || /摄影的画面基础成立，仍需按.*口径收紧判断/.test(normalizedText);
}

function normalizeSkillLevel(value: unknown): SkillLevel {
  return value === '进阶水平' || value === '进阶' || value === '高级' ? '进阶水平' : '爱好者水平';
}

const hobbyistLanguageReplacements: Array<[string, string]> = [
  [' EV', ''],
  ['动态范围', '亮暗细节范围'],
  ['主体分离', '主体与背景的区分'],
  ['边缘管理', '画面边缘整理'],
  ['局部对比', '局部明暗差异'],
  ['中间调', '中等亮度区域'],
  ['白平衡', '颜色冷暖是否自然'],
  ['宽容度', '亮暗细节保留能力'],
  ['饱和度', '颜色浓淡'],
  ['高光区域', '最亮区域'],
  ['高光细节', '亮部细节'],
  ['阴影区域', '较暗区域'],
  ['阴影细节', '暗部细节'],
  ['高光', '最亮区域'],
  ['阴影', '较暗区域'],
  ['影调', '明暗层次'],
  ['色温', '画面冷暖'],
  ['锐度', '清晰程度'],
  ['噪点', '画面杂点'],
  ['蒙版', '局部调整'],
  ['曝光', '整体明暗'],
];

function simplifyHobbyistValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return hobbyistLanguageReplacements.reduce(
      (text, [technicalTerm, plainTerm]) => text.split(technicalTerm).join(plainTerm),
      value,
    );
  }

  if (Array.isArray(value)) {
    return value.map(simplifyHobbyistValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, simplifyHobbyistValue(item)]));
  }

  return value;
}

function firstSentences(text: string, maxSentences = 2) {
  return text
    .split('。')
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, maxSentences)
    .map((sentence) => `${sentence}。`)
    .join('');
}

function sanitizeUserFacingText(value: string | undefined, fallback: string) {
  const text = value?.trim();

  if (!text || containsInternalMetaLanguage(text)) {
    return fallback;
  }

  return text;
}

function getSafeVerdictTitle(report: Report, genre: Genre) {
  const weakest = getScoreSummary(report).weakest.name;
  const byGenre: Partial<Record<Genre, string>> = {
    人像摄影: '人物状态可读，背景仍可收紧',
    建筑摄影: '空间秩序成立，细节仍需整理',
    街头摄影: '现场感已经出现，观看路径还可优化',
    风景摄影: '光线有气氛，层次仍可强化',
    静物摄影: '物件关系成立，质感还可加强',
    旅行摄影: '地方气息可见，叙事还可聚焦',
  };
  const byWeakest: Record<ScoreName, string> = {
    构图: '结构具备基础，重心仍可收紧',
    光线: '光线方向清楚，层次仍可强化',
    色彩: '色彩氛围完整，关系还可明确',
    叙事: '现场线索可读，叙事还可聚焦',
    技术完成度: '画面可读，细节仍需整理',
  };

  return byGenre[genre] ?? byWeakest[weakest];
}

function createMockReport(genre: Genre, skillLevel: SkillLevel, medium: Medium): Report {
  const scoreShift = skillLevel === '爱好者水平' ? 6 : 0;
  const reviewContext = getReviewContext(medium, genre, skillLevel);
  const baseScores: Record<ScoreName, number> = {
    构图: 72,
    光线: 64,
    色彩: 79,
    叙事: 68,
    技术完成度: 82,
  };
  const genreScoreShift: Record<Genre, Partial<Record<ScoreName, number>>> = {
    街头摄影: { 叙事: 3, 技术完成度: -1 },
    人像摄影: { 光线: 1, 色彩: 2, 叙事: 1 },
    风景摄影: { 光线: 3, 色彩: 1, 叙事: -1 },
    建筑摄影: { 构图: 3, 技术完成度: 2, 叙事: -1 },
    静物摄影: { 构图: 2, 色彩: 2, 技术完成度: 1 },
    旅行摄影: { 叙事: 2, 色彩: 1, 构图: 1 },
  };
  const mediumScoreShift: Record<Medium, Partial<Record<ScoreName, number>>> = {
    数码摄影: { 技术完成度: 2, 色彩: 1 },
    胶片摄影: { 色彩: 1, 叙事: 1, 技术完成度: -1 },
  };
  const mockScores = scoreNames.reduce((scores, name) => {
    const rawScore = baseScores[name] + scoreShift + (genreScoreShift[genre][name] ?? 0) + (mediumScoreShift[medium][name] ?? 0);
    scores[name] = Math.max(0, Math.min(100, rawScore));
    return scores;
  }, {} as Record<ScoreName, number>);

  const report: Report = {
    overall: `${genreGuidance[genre]} ${mediumGuidance[medium]} 当前画面已经有可读的视觉核心，下一步应强化观看顺序：先让主体更快被识别，再保留次要信息作为层次。${levelGuidance[skillLevel]}`,
    scores: mockScores,
    composition: `结论：主体区域已成立，但边缘仍有干扰。说明：${genre}需要更清楚的视觉入口。方向：收紧裁切或移动机位，让主体和留白关系更稳定。`,
    lighting:
      '结论：光线方向可读，但中间调还不够集中。说明：高光已能引导视线，暗部需要保留层次。方向：轻微回收高光，并用局部提亮托出主体。',
    colour:
      '结论：色彩克制，有形成情绪的基础。说明：冷暖关系可以更明确。方向：保护中性色，只让一个关键色承担视觉记忆点。',
    storytelling: '结论：画面有瞬间感，但叙事指向还可再清楚。说明：先确定观众最先读到的内容。方向：减少延迟理解的元素，保留必要余味。',
    technical:
      '结论：技术完成度稳定。说明：清晰度、曝光和整体质感足以支撑点评。方向：继续用局部调整替代大幅全局滤镜。',
    suggestions: [
      '收紧裁切，让主体进入更明确的位置。',
      '压低边缘干扰，让视线留在画面内部。',
      '局部提亮主体，再决定整体对比度。',
    ],
    recipe: {
      exposure: '0',
      contrast: '0',
      highlights: '0',
      shadows: '0',
      temperature: '0',
      cropRatio: '保持原比例',
    },
    verdict: {
      title: genre === '建筑摄影' ? '空间秩序成立，细节仍需整理' : genre === '人像摄影' ? '人物状态可读，背景仍可收紧' : '现场感已经出现，观看路径还可优化',
      summary:
        medium === '胶片摄影'
          ? '画面已有可读的情绪基础，颗粒和色偏可以保留为气氛的一部分；下一步要让主体关系更集中。'
          : '画面已有清楚的视觉入口，但曝光层次和边缘信息还可以更克制，让观看路径更顺畅。',
      mainIssue: genre === '建筑摄影' ? '线条和边缘信息还可以再整理，避免空间重心被分散。' : '次要信息略多，观众进入主体的速度还可以更快。',
      nextStep: skillLevel === '进阶水平' ? '先确认主体与环境的观看关系，再通过轻微裁切和局部影调整理强化层次。' : '先减少画面里最分散注意力的部分，让主体更快被看见。',
      tags: ['观看路径', '局部层次', '信息取舍'],
    },
    reviewContext,
    postProcessing: {
      crop: {
        suggestion: genre === '建筑摄影' ? '先检查垂直线和画面边缘，必要时只做小幅裁切。' : genre === '人像摄影' ? '基本保留人物关系，只轻微收紧背景中分散注意力的部分。' : '不必大幅改变构图，只轻微收紧与主题无关的边缘信息。',
        reason: '当前画面已经有可读核心，过度裁切会削弱现场或空间线索。',
        expectedEffect: '让观看入口更清楚，同时保留照片原有气氛。',
      },
      tone: {
        suggestion: medium === '胶片摄影' ? '保留现有色偏与颗粒感，只轻微压低过亮区域。' : '轻微回收高光，适度整理主体附近的中间调。',
        reason: medium === '胶片摄影' ? '胶片质感本身可以参与情绪表达，不需要按数码标准完全校正。' : '温和的影调整理能加强层次，也避免照片显得过度处理。',
        expectedEffect: '画面重点更稳定，明暗关系更自然。',
      },
      masking: {
        suggestion: skillLevel === '进阶水平' ? '用柔和蒙版轻微提亮主体，并压低分散视线的高光。' : '轻微提亮主体，再压低分散注意力的亮处。',
        reason: '局部处理比全局滤镜更适合保留照片的现场感。',
        expectedEffect: '形成更稳定的观看路径，让画面保持自然克制。',
      },
    },
    nextShooting: {
      summary: '下一次拍摄优先让主体关系更早成立，再决定环境信息保留多少。',
      items: [
        '拍摄前先确认画面里最想让观众看到的第一处信息。',
        '移动一步或收紧取景，减少边缘无关亮点。',
        '等待光线或人物关系更明确的瞬间再按下快门。',
      ],
    },
    photoSpecific: {
      strength: genre === '建筑摄影' ? '结构线与空间层次已经形成清楚秩序。' : genre === '人像摄影' ? '人物状态和环境气氛已经具备可读关系。' : '主体与现场环境已经形成可辨认的视觉关系。',
      priorityIssue: genre === '建筑摄影' ? '边缘线条仍会分散空间重心。' : '次要亮点和边缘信息减慢了主体被看见的速度。',
      affectedArea: genre === '人像摄影' ? '人物轮廓附近与背景亮点区域' : genre === '风景摄影' ? '前景入口与远处高光区域' : '主体周围与画面边缘',
      nextAction: '先处理最分散视线的一处边缘信息，再判断是否需要整体调整。',
      crop: {
        ratio: genre === '人像摄影' ? '4:5' : genre === '建筑摄影' ? '5:4' : '3:2',
        direction: genre === '人像摄影' ? '从背景较杂的一侧轻微收紧' : '从干扰较明显的边缘轻微收紧',
        rationale: '保留主体与环境关系，只减少延迟观看的次要信息。',
      },
    },
    scoreReasons: {
      构图: '主体位置可读，但边缘信息仍影响画面重心。',
      光线: '光线方向明确，中间调与高光层次仍可更集中。',
      色彩: '关键色能够建立气氛，整体关系保持克制。',
      叙事: '现场线索存在，但第一观看信息还可以更明确。',
      技术完成度: medium === '胶片摄影' ? '颗粒与色偏能够参与气氛表达，曝光仍有整理空间。' : '清晰度与曝光足以支撑观看，局部细节仍可优化。',
    },
  };

  return skillLevel === '爱好者水平' ? simplifyHobbyistValue(report) as Report : report;
}

function getOverallScore(report: Report) {
  const total = scoreNames.reduce((sum, name) => sum + report.scores[name], 0);
  return Math.round(total / scoreNames.length);
}

function getScoreSummaryDimensions(report: Report) {
  const scoreEntries = scoreNames.map((name) => ({ name, score: report.scores[name] }));
  const strongest = scoreEntries.reduce((best, item) => (item.score > best.score ? item : best), scoreEntries[0]);
  const weakest = scoreEntries.reduce((lowest, item) => (item.score < lowest.score ? item : lowest), scoreEntries[0]);

  return {
    strongestDimension: strongest.name,
    weakestDimension: weakest.name,
  };
}

function getHistoryTags(genre: Genre, skillLevel: SkillLevel, medium: Medium) {
  return [medium, genre, skillLevel];
}

function getFallbackHistoryTitle(genre: Genre) {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');

  return `${genre}复盘 · ${month}月${day}日`;
}

function getCoreDiagnosis(report: Report, genre: Genre) {
  const firstSentence = report.overall.split('。')[0];

  return {
    strength: firstSentence ? `${firstSentence}。` : `${genre}的画面核心已经成立，具备继续深化的基础。`,
    problem: parseDiagnosticText(report.composition).conclusion,
    direction: report.suggestions[0] ?? '下一步先明确主体位置，再处理边缘和明暗关系。',
  };
}

function getReportVerdict(report: Report, genre: Genre): ReportVerdict {
  const coreDiagnosis = getCoreDiagnosis(report, genre);
  const safeTitle = getSafeVerdictTitle(report, genre);
  const safeSummary = firstSentences(report.overall) || coreDiagnosis.strength;
  const fallback = {
    title: safeTitle,
    summary: containsInternalMetaLanguage(safeSummary) ? '画面已经具备可读的视觉基础，但观看路径和信息取舍仍可继续整理。' : safeSummary,
    mainIssue: coreDiagnosis.problem,
    nextStep: coreDiagnosis.direction,
    tags: getProblemTags(report),
  };

  if (report.verdict?.title && report.verdict.summary && report.verdict.mainIssue && report.verdict.nextStep) {
    const title = sanitizeUserFacingText(report.verdict.title, fallback.title);

    return {
      title: title.length > 28 ? fallback.title : title,
      summary: sanitizeUserFacingText(report.verdict.summary, fallback.summary),
      mainIssue: sanitizeUserFacingText(report.verdict.mainIssue, fallback.mainIssue),
      nextStep: sanitizeUserFacingText(report.verdict.nextStep, fallback.nextStep),
      tags: (() => {
        const safeTags = report.verdict?.tags?.filter((tag) => !containsInternalMetaLanguage(tag)).slice(0, 3) ?? [];
        return safeTags.length ? safeTags : fallback.tags;
      })(),
    };
  }

  return fallback;
}

function getPhotoSpecificFeedback(report: Report, genre: Genre): PhotoSpecificFeedback {
  const verdict = getReportVerdict(report, genre);
  const weakest = getScoreSummary(report).weakest.name;
  const affectedAreaByDimension: Record<ScoreName, string> = {
    构图: '主体周围与画面边缘',
    光线: '主体附近的中间调与最亮区域',
    色彩: '关键色与背景杂色相邻的区域',
    叙事: '主体、环境线索与观看入口之间',
    技术完成度: '高反差边缘与细节纹理区域',
  };
  const fallback: PhotoSpecificFeedback = {
    strength: getCoreDiagnosis(report, genre).strength,
    priorityIssue: verdict.mainIssue,
    affectedArea: affectedAreaByDimension[weakest],
    nextAction: verdict.nextStep,
    crop: {
      ratio: report.recipe.cropRatio || '保持当前比例',
      direction: '从干扰较明显的边缘轻微收紧',
      rationale: getPostProcessingAdvice(report).crop.reason,
    },
  };
  const source = report.photoSpecific;

  if (!source) return fallback;

  return {
    strength: sanitizeUserFacingText(source.strength, fallback.strength),
    priorityIssue: sanitizeUserFacingText(source.priorityIssue, fallback.priorityIssue),
    affectedArea: sanitizeUserFacingText(source.affectedArea, fallback.affectedArea),
    nextAction: sanitizeUserFacingText(source.nextAction, fallback.nextAction),
    crop: {
      ratio: sanitizeUserFacingText(source.crop?.ratio, fallback.crop.ratio),
      direction: sanitizeUserFacingText(source.crop?.direction, fallback.crop.direction),
      rationale: sanitizeUserFacingText(source.crop?.rationale, fallback.crop.rationale),
    },
  };
}

function getScoreReasons(report: Report): Record<ScoreName, string> {
  const diagnosticByScore: Record<ScoreName, string> = {
    构图: report.composition,
    光线: report.lighting,
    色彩: report.colour,
    叙事: report.storytelling,
    技术完成度: report.technical,
  };

  return scoreNames.reduce((result, name) => {
    const fallback = parseDiagnosticText(diagnosticByScore[name]).explanation;
    result[name] = sanitizeUserFacingText(report.scoreReasons?.[name], fallback);
    return result;
  }, {} as Record<ScoreName, string>);
}

function getPostProcessingAdvice(report: Report): NonNullable<Report['postProcessing']> {
  const fallback = {
    crop: {
      suggestion: report.recipe.cropRatio ? `参考 ${report.recipe.cropRatio}，以更清楚的画面边界组织主体。` : report.suggestions[0] ?? '轻微收紧取景，让主体更快被识别。',
      reason: parseDiagnosticText(report.composition).explanation,
      expectedEffect: '减少无关信息，强化观看入口。',
    },
    tone: {
      suggestion: '以温和的影调调整强化主体层次，避免大幅度全局滤镜。',
      reason: parseDiagnosticText(report.lighting).explanation,
      expectedEffect: '让明暗关系更集中，同时保留照片的自然质感。',
    },
    masking: {
      suggestion: report.suggestions[2] ?? '用局部蒙版处理主体与边缘亮度关系。',
      reason: '局部调整可以让画面重点更清楚，而不改变整张照片的气质。',
      expectedEffect: '让视线更稳定地停留在关键区域。',
    },
  };

  if (report.postProcessing?.crop && report.postProcessing.tone && report.postProcessing.masking) {
    return {
      crop: {
        suggestion: sanitizeUserFacingText(report.postProcessing.crop.suggestion, fallback.crop.suggestion),
        reason: sanitizeUserFacingText(report.postProcessing.crop.reason, fallback.crop.reason),
        expectedEffect: sanitizeUserFacingText(report.postProcessing.crop.expectedEffect, fallback.crop.expectedEffect),
      },
      tone: {
        suggestion: sanitizeUserFacingText(report.postProcessing.tone.suggestion, fallback.tone.suggestion),
        reason: sanitizeUserFacingText(report.postProcessing.tone.reason, fallback.tone.reason),
        expectedEffect: sanitizeUserFacingText(report.postProcessing.tone.expectedEffect, fallback.tone.expectedEffect),
      },
      masking: {
        suggestion: sanitizeUserFacingText(report.postProcessing.masking.suggestion, fallback.masking.suggestion),
        reason: sanitizeUserFacingText(report.postProcessing.masking.reason, fallback.masking.reason),
        expectedEffect: sanitizeUserFacingText(report.postProcessing.masking.expectedEffect, fallback.masking.expectedEffect),
      },
    };
  }

  return fallback;
}

function getScoreSummary(report: Report) {
  const entries = scoreNames.map((name) => ({ name, score: report.scores[name] }));
  const overall = getOverallScore(report);
  const strongest = entries.reduce((best, item) => (item.score > best.score ? item : best), entries[0]);
  const weakest = entries.reduce((lowest, item) => (item.score < lowest.score ? item : lowest), entries[0]);

  return { entries, overall, strongest, weakest };
}

function getProblemTags(report: Report) {
  const weakest = getScoreSummary(report).weakest.name;
  const tags: string[] = ['边缘干扰'];

  if (weakest === '光线') {
    tags.push('光线层次不足');
  } else if (weakest === '构图') {
    tags.push('主体弱化');
  } else if (weakest === '叙事') {
    tags.push('叙事指向不清');
  } else if (weakest === '色彩') {
    tags.push('色彩记忆点不足');
  } else {
    tags.push('技术细节需整理');
  }

  tags.push('观看顺序待强化');
  return tags.slice(0, 3);
}

function getRatingInterpretation(score: number) {
  if (score >= 86) {
    return '具备作品潜力';
  }

  if (score >= 78) {
    return '可进入二次筛选';
  }

  if (score >= 72) {
    return '仍有打磨空间';
  }

  return '适合继续打磨';
}

function getNextShootingActions(report: Report, genre: Genre = '街头摄影') {
  const fallbackByGenre: Record<Genre, NextShootingAdvice> = {
    街头摄影: {
      summary: '下一次拍摄优先观察人物姿态、背景重叠和现场秩序，保留有用的混乱，但让关键关系更快出现。',
      items: ['等待人物动作和背景线索同时成立的瞬间。', '按下快门前检查人物是否与招牌、车辆或路人发生不必要重叠。', '靠近或侧移一步，让现场张力集中在一个主要关系上。'],
    },
    人像摄影: {
      summary: '下一次拍摄优先处理表情、眼神方向和背景分离，让人物状态比环境更先被看见。',
      items: ['先确认眼神或面部朝向是否承载情绪。', '让背景亮点避开头部和肩线，保持人物轮廓干净。', '根据服装和背景颜色调整距离，保留更自然的亲密感。'],
    },
    风景摄影: {
      summary: '下一次拍摄优先等待更有层次的光线，并整理前景、中景和远景之间的路径。',
      items: ['确认地平线和主要线条是否稳定。', '用前景元素建立空间入口，但不要让它抢走光线重心。', '选择光线更有方向的时刻，让空气感和层次更清楚。'],
    },
    建筑摄影: {
      summary: '下一次拍摄优先稳定垂直线和边缘结构，再利用光线塑造建筑体量。',
      items: ['拍摄前检查垂直和水平线是否有无意倾斜。', '让结构节奏在画面边缘也保持完整。', '等待侧光或阴影更清楚地勾勒材料和体块。'],
    },
    静物摄影: {
      summary: '下一次拍摄优先整理物件间距、阴影形状和背景纯度，让材质关系更明确。',
      items: ['调整物件距离，让主次关系一眼可读。', '观察阴影边缘是否帮助塑造形体，而不是制造杂乱。', '保留足够负空间，让材质和形状有呼吸感。'],
    },
    旅行摄影: {
      summary: '下一次拍摄优先寻找地方气息和人的痕迹，避免只留下普通风景记录。',
      items: ['把当地生活线索放入画面，但控制它们的数量。', '等待人物动作、光线和地点标识形成一个清楚关系。', '尝试更具体的拍摄角度，让画面不只是“到此一游”。'],
    },
  };
  const fallback = fallbackByGenre[genre];

  if (report.nextShooting?.summary && report.nextShooting.items?.length) {
    const safeItems = report.nextShooting.items
      .map((item, index) => sanitizeUserFacingText(item, fallback.items[index] ?? fallback.items[0]))
      .slice(0, 3);

    return {
      summary: sanitizeUserFacingText(report.nextShooting.summary, fallback.summary),
      items: safeItems.length ? safeItems : fallback.items,
    };
  }

  return fallback;
}

function formatReportDate(date: string) {
  const match = date.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);

  if (!match) {
    return date;
  }

  return `${match[1]}.${match[2].padStart(2, '0')}.${match[3].padStart(2, '0')}`;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('无法读取上传作品。'));
    };

    image.src = objectUrl;
  });
}

async function compressImageForApi(file: File): Promise<string> {
  const image = await loadImageFromFile(file);
  const maxSize = 768;
  const scale = Math.min(1, maxSize / image.naturalWidth, maxSize / image.naturalHeight);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('浏览器无法压缩上传作品。');
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', 0.55);
}

async function requestAiReport({
  fallbackReport,
  fileName,
  genre,
  imageDataUrl,
  medium,
  signal,
  skillLevel,
  workTitle,
}: {
  fallbackReport: Report;
  fileName: string;
  genre: Genre;
  imageDataUrl: string;
  medium: Medium;
  signal?: AbortSignal;
  skillLevel: SkillLevel;
  workTitle?: string;
}) {
  const apiUrl = getAnalysisApiUrl();

  console.log('Calling analysis API...');
  console.log('imageDataUrl starts with:', imageDataUrl.slice(0, 30));

  if (!imageDataUrl.startsWith('data:image/')) {
    throw new Error('上传作品没有转换为有效的 base64 图片数据。');
  }

  const controller = new AbortController();
  let didTimeout = false;
  const handleExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', handleExternalAbort, { once: true });
  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, ANALYSIS_REQUEST_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageDataUrl,
        fileName,
        medium,
        genre,
        skillLevel,
        critiquePath: skillLevel,
        title: workTitle,
        workTitle,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (signal?.aborted) {
      throw new AnalysisCancelledError();
    }

    if (didTimeout || (error instanceof DOMException && error.name === 'AbortError')) {
      throw new Error('分析请求超时，请稍后重试。');
    }

    throw new Error('无法连接分析服务，请确认本地服务已启动或稍后重试。');
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', handleExternalAbort);
  }

  if (signal?.aborted) throw new AnalysisCancelledError();

  console.log('Analysis API status:', response.status);

  if (!response.ok) {
    let serverMessage = '';

    try {
      const errorPayload = await response.json();
      serverMessage = typeof errorPayload?.error === 'string' ? errorPayload.error : '';
    } catch {
      // The status-specific message below is clearer than exposing invalid response text.
    }

    if (response.status === 503) {
      throw new Error(serverMessage || '分析服务尚未配置 API，请检查项目根目录的 .env。');
    }

    if (response.status === 504) {
      throw new Error(serverMessage || '上游图像分析超时，请稍后重试。');
    }

    throw new Error(serverMessage || `分析服务返回错误（HTTP ${response.status}）。`);
  }

  let data: { ok?: boolean; error?: string; report?: unknown };

  try {
    data = await response.json();
  } catch {
    if (signal?.aborted) throw new AnalysisCancelledError();
    throw new Error('分析服务返回了无法读取的数据，请稍后重试。');
  }

  if (signal?.aborted) throw new AnalysisCancelledError();

  if (data.ok === false) {
    throw new Error(data.error || 'AI 分析接口返回失败。');
  }

  if (!data.report || typeof data.report !== 'object') {
    throw new Error('AI 分析接口没有返回有效报告。');
  }

  console.log('Analysis API success');

  const mergedReport = mergeAiReportWithFallback(data.report, fallbackReport, getReviewContext(medium, genre, skillLevel));
  return skillLevel === '爱好者水平' ? simplifyHobbyistValue(mergedReport) as Report : mergedReport;
}

function getAnalysisApiUrl() {
  return import.meta.env?.VITE_ANALYSIS_API_URL || DEFAULT_ANALYSIS_API_URL;
}

function getSaveReportHistoryApiUrl() {
  const apiUrl = getAnalysisApiUrl();

  try {
    return new URL('/api/save-report-history', apiUrl).toString();
  } catch {
    return apiUrl.replace(/\/api\/analyze-photo$/, '/api/save-report-history') || '/api/save-report-history';
  }
}

function getPersistedImageUrl(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.startsWith('data:image/') || value.startsWith('https://') || value.startsWith('http://') ? value : '';
}

function getReportSource(value: unknown): ReportSource {
  return value === 'ai' || value === 'mock' ? value : 'legacy';
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function loadStoredHistoryRecords(): HistoryRecord[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    if (window.localStorage.getItem(HISTORY_SCHEMA_VERSION_KEY) !== HISTORY_SCHEMA_VERSION) {
      window.localStorage.removeItem(HISTORY_STORAGE_KEY);
      window.localStorage.setItem(HISTORY_SCHEMA_VERSION_KEY, HISTORY_SCHEMA_VERSION);
      return [];
    }

    const storedValue = window.localStorage.getItem(HISTORY_STORAGE_KEY);

    if (!storedValue) {
      return [];
    }

    const parsedValue = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .filter((record) => record && typeof record.id === 'string' && typeof record.report === 'object')
      .map((record) => {
        const medium = mediums.includes(record.medium) ? record.medium : '数码摄影';
        const genre = genres.includes(record.genre ?? record.subject) ? record.genre ?? record.subject : '街头摄影';
        const skillLevel = normalizeSkillLevel(record.skillLevel ?? record.critiqueLevel);
        const fallbackReport = createMockReport(genre, skillLevel, medium);
        const mergedReport = mergeAiReportWithFallback(record.report, fallbackReport, getReviewContext(medium, genre, skillLevel));
        const report = skillLevel === '爱好者水平' ? simplifyHobbyistValue(mergedReport) as Report : mergedReport;
        const createdAt = typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString();

        return {
          ...record,
          title: typeof record.title === 'string' && record.title ? record.title : '历史点评记录',
          imageUrl: getPersistedImageUrl(record.imageUrl),
          fileName: typeof record.fileName === 'string' ? record.fileName : '未命名照片',
          medium,
          subject: genre,
          genre,
          critiqueLevel: skillLevel,
          skillLevel,
          date: typeof record.date === 'string' ? record.date : new Date(createdAt).toLocaleDateString('zh-CN'),
          dateTime: typeof record.dateTime === 'string' ? record.dateTime : new Date(createdAt).toLocaleString('zh-CN'),
          createdAt,
          report,
          reportSource: getReportSource(record.reportSource),
          analysisError: typeof record.analysisError === 'string' ? record.analysisError : undefined,
          overallScore: typeof record.overallScore === 'number' ? record.overallScore : getOverallScore(report),
          tags: Array.isArray(record.tags) ? record.tags : getHistoryTags(genre, skillLevel, medium),
          summary: typeof record.summary === 'string' ? record.summary : getCoreDiagnosis(report, genre).direction,
          strongestDimension: scoreNames.includes(record.strongestDimension) ? record.strongestDimension : getScoreSummaryDimensions(report).strongestDimension,
          weakestDimension: scoreNames.includes(record.weakestDimension) ? record.weakestDimension : getScoreSummaryDimensions(report).weakestDimension,
        } as HistoryRecord;
      })
      .slice(0, MAX_HISTORY_RECORDS);
  } catch (error) {
    console.warn('Failed to restore PhotoSense history records from localStorage', error);
    return [];
  }
}

async function syncReportHistoryToProject(historyRecords: HistoryRecord[]) {
  if (!HISTORY_EXPORT_ENABLED) return;

  const response = await fetch(getSaveReportHistoryApiUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app: 'PhotoSense AI',
      exportedAt: new Date().toISOString(),
      recordCount: historyRecords.length,
      records: historyRecords,
    }),
  });

  if (!response.ok) {
    throw new Error(`Save report history failed: ${response.status}`);
  }
}

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedMedium, setSelectedMedium] = useState<Medium>('数码摄影');
  const [selectedGenre, setSelectedGenre] = useState<Genre>('街头摄影');
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('爱好者水平');
  const [photoTitle, setPhotoTitle] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisElapsedSeconds, setAnalysisElapsedSeconds] = useState(0);
  const [analysisState, setAnalysisState] = useState<AnalysisState>({ kind: 'idle' });
  const [report, setReport] = useState<Report | null>(null);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>(loadStoredHistoryRecords);
  const [activeRecord, setActiveRecord] = useState<HistoryRecord | null>(null);
  const [copyStatus, setCopyStatus] = useState('复制报告文字');
  const [skillTooltip, setSkillTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const historySyncTimerRef = useRef<number | null>(null);
  const analysisAbortRef = useRef<AbortController | null>(null);

  const currentDate = useMemo(
    () =>
      new Intl.DateTimeFormat('zh-CN', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date()),
    [],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyRecords));
    } catch (error) {
      console.warn('Failed to save PhotoSense history records to localStorage', error);
    }

    if (historySyncTimerRef.current) {
      window.clearTimeout(historySyncTimerRef.current);
      historySyncTimerRef.current = null;
    }

    if (historyRecords.length === 0) {
      return undefined;
    }

    historySyncTimerRef.current = window.setTimeout(() => {
      syncReportHistoryToProject(historyRecords).catch((error) => {
        console.warn('Report history auto-save skipped. Is the local backend running?', error);
      });
    }, 600);

    return () => {
      if (historySyncTimerRef.current) {
        window.clearTimeout(historySyncTimerRef.current);
        historySyncTimerRef.current = null;
      }
    };
  }, [historyRecords]);

  useEffect(() => {
    if (!isAnalyzing) return undefined;

    const startedAt = Date.now();
    const timerId = window.setInterval(() => {
      setAnalysisElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isAnalyzing]);

  useEffect(() => {
    return () => analysisAbortRef.current?.abort();
  }, []);

  function goToPage(page: Page) {
    setCurrentPage(page);
    window.setTimeout(() => {
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true });
    }, 0);
  }

  function handleOpenReportEntry() {
    if (activeRecord || report) {
      goToPage('report');
      return;
    }

    const latestRecord = historyRecords[0];
    if (latestRecord) {
      handleOpenHistoryRecord(latestRecord);
      return;
    }

    goToPage('report');
  }

  function handleAuthSuccess() {
    setIsLoggedIn(true);
    goToPage('home');
  }

  function handleLogout() {
    setIsLoggedIn(false);
    goToPage('home');
  }

  function handleImageFile(file: File) {
    const validation = validateImageFile(file);

    if (!validation.ok) {
      setUploadError(validation.error);
      return;
    }

    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    if (imageUrl.startsWith('blob:')) URL.revokeObjectURL(imageUrl);

    setUploadError('');
    setImageUrl(URL.createObjectURL(file));
    setUploadedFile(file);
    setFileName(file.name);
    setIsAnalyzing(false);
    setAnalysisElapsedSeconds(0);
    setAnalysisState({ kind: 'idle' });
    setReport(null);
    setActiveRecord(null);
    setCopyStatus('复制报告文字');
  }

  function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) handleImageFile(file);
    event.target.value = '';
  }

  function handleRemoveImage() {
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    if (imageUrl.startsWith('blob:')) URL.revokeObjectURL(imageUrl);
    setImageUrl('');
    setUploadedFile(null);
    setFileName('');
    setUploadError('');
    setIsAnalyzing(false);
    setAnalysisElapsedSeconds(0);
    setAnalysisState({ kind: 'idle' });
    setReport(null);
    setActiveRecord(null);
    setCopyStatus('复制报告文字');
  }

  async function handleAnalyze() {
    if (!imageUrl) {
      return;
    }

    analysisAbortRef.current?.abort();
    const requestController = new AbortController();
    analysisAbortRef.current = requestController;
    setAnalysisElapsedSeconds(0);
    setIsAnalyzing(true);
    setAnalysisState({ kind: 'analyzing', phase: 'preparing', message: '正在准备图片。' });
    setReport(null);
    setCopyStatus('复制报告文字');

    const fallbackReport = createMockReport(selectedGenre, skillLevel, selectedMedium);
    let nextReport = fallbackReport;
    let reportSource: ReportSource = 'ai';
    let analysisError: string | undefined;
    let imageDataUrl = '';

    try {
      if (!uploadedFile) {
        throw new Error('缺少原始上传文件，无法发送到分析接口。');
      }

      console.log('original file size:', uploadedFile.size);
      imageDataUrl = await compressImageForApi(uploadedFile);
      console.log('compressed imageDataUrl length:', imageDataUrl.length);

      if (requestController.signal.aborted) {
        setIsAnalyzing(false);
        setAnalysisState({ kind: 'cancelled', message: '分析已取消，照片和点评参数已保留。' });
        return;
      }
    } catch (error) {
      if (requestController.signal.aborted) {
        setIsAnalyzing(false);
        setAnalysisState({ kind: 'cancelled', message: '分析已取消，照片和点评参数已保留。' });
        if (analysisAbortRef.current === requestController) analysisAbortRef.current = null;
        return;
      }

      const message = getErrorMessage(error, '无法读取这张照片，请更换图片后重试。');
      console.error('Image preparation failed', error);
      setIsAnalyzing(false);
      setAnalysisState({ kind: 'error', message });
      if (analysisAbortRef.current === requestController) analysisAbortRef.current = null;
      return;
    }

    setAnalysisState({ kind: 'analyzing', phase: 'connecting', message: '正在连接分析服务。' });
    const phaseTimerId = window.setTimeout(() => {
      if (!requestController.signal.aborted) {
        setAnalysisState({ kind: 'analyzing', phase: 'analyzing', message: '正在分析构图、光线与画面关系。' });
      }
    }, 1600);

    try {
      nextReport = await requestAiReport({
        fallbackReport,
        fileName,
        genre: selectedGenre,
        imageDataUrl,
        medium: selectedMedium,
        signal: requestController.signal,
        skillLevel,
        workTitle: photoTitle.trim() || undefined,
      });
      window.clearTimeout(phaseTimerId);
      setAnalysisState({ kind: 'analyzing', phase: 'formatting', message: '分析完成，正在整理报告。' });
      await new Promise((resolve) => window.setTimeout(resolve, 220));

      if (requestController.signal.aborted) {
        setIsAnalyzing(false);
        setAnalysisState({ kind: 'cancelled', message: '分析已取消，照片和点评参数已保留。' });
        if (analysisAbortRef.current === requestController) analysisAbortRef.current = null;
        return;
      }

      setAnalysisState({ kind: 'ai', message: '本次报告由实时图像分析生成。' });
    } catch (error) {
      window.clearTimeout(phaseTimerId);

      if (error instanceof AnalysisCancelledError || requestController.signal.aborted) {
        setIsAnalyzing(false);
        setAnalysisState({ kind: 'cancelled', message: '分析已取消，照片和点评参数已保留。' });
        if (analysisAbortRef.current === requestController) analysisAbortRef.current = null;
        return;
      }

      console.warn('AI request failed, using mock fallback', error);
      reportSource = 'mock';
      analysisError = getErrorMessage(error, '分析服务暂时不可用。');
      setAnalysisState({
        kind: 'mock',
        message: `分析服务暂时不可用，当前显示示例报告。${analysisError}`,
      });
    }

    const now = new Date();
    const createdAt = now.toISOString();
    const dateTime = new Intl.DateTimeFormat('zh-CN', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(now);
    const dimensions = getScoreSummaryDimensions(nextReport);
    const coreDiagnosis = getCoreDiagnosis(nextReport, selectedGenre);
    const nextRecord: HistoryRecord = {
      id: `${Date.now()}`,
      title: photoTitle.trim() || getFallbackHistoryTitle(selectedGenre),
      imageUrl: imageDataUrl,
      fileName: fileName || '未命名照片',
      medium: selectedMedium,
      subject: selectedGenre,
      genre: selectedGenre,
      critiqueLevel: skillLevel,
      skillLevel,
      date: currentDate,
      dateTime,
      createdAt,
      report: nextReport,
      reportSource,
      analysisError,
      overallScore: getOverallScore(nextReport),
      tags: [...getHistoryTags(selectedGenre, skillLevel, selectedMedium), ...getProblemTags(nextReport).slice(0, 1)],
      summary: coreDiagnosis.direction,
      strongestDimension: dimensions.strongestDimension,
      weakestDimension: dimensions.weakestDimension,
    };

    if (imageUrl.startsWith('blob:')) URL.revokeObjectURL(imageUrl);
    setImageUrl(imageDataUrl);
    setReport(nextReport);
    setActiveRecord(nextRecord);
    setHistoryRecords((records) => [nextRecord, ...records].slice(0, MAX_HISTORY_RECORDS));
    setIsAnalyzing(false);
    if (analysisAbortRef.current === requestController) analysisAbortRef.current = null;
    goToPage('report');
  }

  function handleCancelAnalysis() {
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    setIsAnalyzing(false);
    setAnalysisState({ kind: 'cancelled', message: '分析已取消，照片和点评参数已保留。' });
  }

  function handleRetryAnalysis() {
    if (activeRecord?.reportSource === 'mock') {
      setHistoryRecords((records) => records.filter((record) => record.id !== activeRecord.id));
      setActiveRecord(null);
    }
    goToPage('review');
    window.setTimeout(() => void handleAnalyze(), 0);
  }

  function handleReset() {
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    if (imageUrl && !historyRecords.some((record) => record.imageUrl === imageUrl)) {
      URL.revokeObjectURL(imageUrl);
    }

    setImageUrl('');
    setUploadedFile(null);
    setFileName('');
    setUploadError('');
    setPhotoTitle('');
    setSelectedMedium('数码摄影');
    setSelectedGenre('街头摄影');
    setSkillLevel('爱好者水平');
    setIsAnalyzing(false);
    setAnalysisElapsedSeconds(0);
    setAnalysisState({ kind: 'idle' });
    setReport(null);
    setActiveRecord(null);
    setCopyStatus('复制报告文字');
    setSkillTooltip(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleCopyReport() {
    const reportToCopy = activeRecord?.report ?? report;

    if (!reportToCopy) {
      return;
    }

    const reportMedium = activeRecord?.medium ?? selectedMedium;
    const reportGenre = activeRecord?.genre ?? selectedGenre;
    const reportSkillLevel = activeRecord?.skillLevel ?? skillLevel;
    const reportVerdict = getReportVerdict(reportToCopy, reportGenre);
    const reviewContext = getResolvedReviewContext(reportToCopy, reportMedium, reportGenre, reportSkillLevel);
    const postProcessing = getPostProcessingAdvice(reportToCopy);
    const nextShooting = getNextShootingActions(reportToCopy, reportGenre);
    const scoreReasons = getScoreReasons(reportToCopy);
    const photoSpecific = getPhotoSpecificFeedback(reportToCopy, reportGenre);
    const scoreText = scoreNames.map((name) => `${name}：${reportToCopy.scores[name]}/100\n评分依据：${scoreReasons[name]}`).join('\n');
    const postProcessingText = [
      `1. 裁剪建议：${postProcessing.crop.suggestion}\n理由：${postProcessing.crop.reason}\n预期效果：${postProcessing.crop.expectedEffect}`,
      `2. 影调修改建议：${postProcessing.tone.suggestion}\n理由：${postProcessing.tone.reason}\n预期效果：${postProcessing.tone.expectedEffect}`,
      `3. 蒙版提亮 / 压暗建议：${postProcessing.masking.suggestion}\n理由：${postProcessing.masking.reason}\n预期效果：${postProcessing.masking.expectedEffect}`,
    ].join('\n');
    const nextShootingText = [nextShooting.summary, ...nextShooting.items.map((item, index) => `${index + 1}. ${item}`)].join('\n');

    const text = `PhotoSense AI 摄影评审报告\n影像介质：${reportMedium}\n摄影题材：${reportGenre}\n评价水平：${reportSkillLevel}\n\n本次评价基准\n影像介质：${reviewContext.mediumFocus}\n评价水平：${reviewContext.levelFocus}\n摄影题材：${reviewContext.genreFocus}\n评分侧重：${reviewContext.scoringLogic}\n\n评审结论\n${reportVerdict.title}\n${reportVerdict.summary}\n主要问题：${reportVerdict.mainIssue}\n下一步：${reportVerdict.nextStep}\n\n照片重点\n值得保留：${photoSpecific.strength}\n优先问题：${photoSpecific.priorityIssue}\n画面区域：${photoSpecific.affectedArea}\n下一步动作：${photoSpecific.nextAction}\n裁剪参考：${photoSpecific.crop.ratio}，${photoSpecific.crop.direction}\n裁剪理由：${photoSpecific.crop.rationale}\n\n总体印象\n${reportToCopy.overall}\n\n评分\n${scoreText}\n\n构图分析\n${reportToCopy.composition}\n\n光线分析\n${reportToCopy.lighting}\n\n色彩分析\n${reportToCopy.colour}\n\n叙事分析\n${reportToCopy.storytelling}\n\n技术完成度\n${reportToCopy.technical}\n\n后期建议\n${postProcessingText}\n\n下次拍摄建议\n${nextShootingText}`;

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

    window.setTimeout(() => setCopyStatus('复制报告文字'), 1600);
  }

  function handleOpenHistoryRecord(record: HistoryRecord) {
    setActiveRecord(record);
    setReport(record.report);
    setAnalysisState({
      kind: record.reportSource === 'ai' ? 'ai' : record.reportSource === 'mock' ? 'mock' : 'idle',
      message: record.analysisError,
    });
    setCopyStatus('复制报告文字');
    goToPage('report');
  }

  function handleDeleteHistoryRecord(recordId: string) {
    setHistoryRecords((records) => records.filter((record) => record.id !== recordId));

    if (activeRecord?.id === recordId) {
      setActiveRecord(null);
      setReport(null);
      setAnalysisState({ kind: 'idle' });
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <header className="site-header">
        <button className="brand brand-button" type="button" onClick={() => goToPage('home')} aria-label="PhotoSense AI 首页">
          <span className="brand-text">PhotoSense AI</span>
        </button>
        <nav className="nav-links" id="primary-navigation" aria-label="主导航">
          <button aria-current={currentPage === 'home' ? 'page' : undefined} className={currentPage === 'home' ? 'active' : ''} type="button" onClick={() => goToPage('home')}>
            首页
          </button>
          <button aria-current={currentPage === 'review' ? 'page' : undefined} className={currentPage === 'review' ? 'active' : ''} type="button" onClick={() => goToPage('review')}>
            开始点评
          </button>
          <button aria-current={currentPage === 'report' ? 'page' : undefined} className={currentPage === 'report' ? 'active' : ''} type="button" onClick={handleOpenReportEntry}>
            分析报告
          </button>
          <button aria-current={currentPage === 'history' ? 'page' : undefined} className={currentPage === 'history' ? 'active' : ''} type="button" onClick={() => goToPage('history')}>
            历史记录
          </button>
        </nav>
        <div className="header-actions" aria-label="用户入口">
          {isLoggedIn ? (
            <button className="login-button active" type="button" onClick={handleLogout}>
              登出
            </button>
          ) : (
            <>
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
            </>
          )}
          <button className="user-entry" type="button" aria-label="用户入口">
            <span>{isLoggedIn ? '已' : '访'}</span>
          </button>
        </div>
      </header>

      {currentPage === 'home' && <HomePage onStartReview={() => goToPage('review')} />}

      {currentPage === 'review' && (
        <ReviewPage
          analysisState={analysisState}
          analysisElapsedSeconds={analysisElapsedSeconds}
          currentDate={currentDate}
          fileInputRef={fileInputRef}
          fileName={fileName}
          fileSize={uploadedFile?.size ?? 0}
          imageUrl={imageUrl}
          isAnalyzing={isAnalyzing}
          onAnalyze={handleAnalyze}
          onCancelAnalysis={handleCancelAnalysis}
          onImageFile={handleImageFile}
          onImageUpload={handleImageUpload}
          onRemoveImage={handleRemoveImage}
          onPhotoTitleChange={setPhotoTitle}
          onReset={handleReset}
          onSelectMedium={setSelectedMedium}
          onSelectGenre={setSelectedGenre}
          onSelectSkillLevel={setSkillLevel}
          onSetReport={(nextReport) => {
            setReport(nextReport);
            if (!nextReport) {
              setActiveRecord(null);
            }
          }}
          onSetSkillTooltip={setSkillTooltip}
          selectedGenre={selectedGenre}
          selectedMedium={selectedMedium}
          photoTitle={photoTitle}
          skillLevel={skillLevel}
          skillTooltip={skillTooltip}
          uploadError={uploadError}
        />
      )}

      {currentPage === 'report' && (
        <ReportPage
          activeRecord={activeRecord}
          analysisState={analysisState}
          canRetryAnalysis={Boolean(uploadedFile && activeRecord?.imageUrl === imageUrl)}
          copyStatus={copyStatus}
          currentDate={currentDate}
          fileName={fileName}
          imageUrl={imageUrl}
          isAnalyzing={isAnalyzing}
          onCopyReport={handleCopyReport}
          onRetryAnalysis={handleRetryAnalysis}
          onStartReview={() => goToPage('review')}
          report={report}
          selectedGenre={selectedGenre}
          selectedMedium={selectedMedium}
          skillLevel={skillLevel}
        />
      )}

      {currentPage === 'history' && (
        <HistoryPage
          historyRecords={historyRecords}
          onDeleteRecord={handleDeleteHistoryRecord}
          onOpenRecord={handleOpenHistoryRecord}
          onStartReview={() => goToPage('review')}
        />
      )}
      {currentPage === 'login' && <LoginPage onAuthSuccess={handleAuthSuccess} onSwitch={() => goToPage('register')} />}
      {currentPage === 'register' && <RegisterPage onAuthSuccess={handleAuthSuccess} onSwitch={() => goToPage('login')} />}

      <footer className="site-footer">
        <p>用于整理摄影反馈与复盘记录的 AI 辅助工具。</p>
      </footer>
    </div>
  );
}

function HomePage({ onStartReview }: { onStartReview: () => void }) {
  const [activeShowcaseId, setActiveShowcaseId] = useState<(typeof homeShowcaseItems)[number]['id']>(homeShowcaseItems[0].id);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);
  const [isCollagePaused, setIsCollagePaused] = useState(false);
  const [frontCollageIndex, setFrontCollageIndex] = useState(0);
  const [previousCollageIndex, setPreviousCollageIndex] = useState<number | null>(null);
  const [isIntroVisible, setIsIntroVisible] = useState(false);
  const [selectedGalleryIndex, setSelectedGalleryIndex] = useState<number | null>(8);
  const activeShowcase = homeShowcaseItems.find((item) => item.id === activeShowcaseId) ?? homeShowcaseItems[0];
  const selectedGalleryPhoto = selectedGalleryIndex === null ? null : homeBackgroundCollage[selectedGalleryIndex];
  const selectedGalleryResult = selectedGalleryPhoto ? homeGalleryResults.find((item) => item.src === selectedGalleryPhoto.src) : null;

  useEffect(() => {
    if (isCarouselPaused || !isIntroVisible || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    const timerId = window.setInterval(() => {
      setActiveShowcaseId((currentId) => {
        const currentIndex = homeShowcaseItems.findIndex((item) => item.id === currentId);
        return homeShowcaseItems[(currentIndex + 1) % homeShowcaseItems.length].id;
      });
    }, 5_000);

    return () => window.clearInterval(timerId);
  }, [activeShowcaseId, isCarouselPaused, isIntroVisible]);

  useEffect(() => {
    if (isCollagePaused || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    const timerId = window.setTimeout(() => {
      setPreviousCollageIndex(frontCollageIndex);
      setFrontCollageIndex((frontCollageIndex + 1) % homeBackgroundCollage.length);
    }, 7_000);

    return () => window.clearTimeout(timerId);
  }, [frontCollageIndex, isCollagePaused]);

  useEffect(() => {
    if (selectedGalleryIndex === null) return undefined;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedGalleryIndex(null);
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [selectedGalleryIndex]);

  const handleFilmBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setIsCarouselPaused(false);
  };

  const handleToggleIntro = () => {
    const updateVisibility = () => flushSync(() => {
      setSelectedGalleryIndex(null);
      setIsIntroVisible((visible) => !visible);
    });
    const transitionDocument = document as Document & {
      startViewTransition?: (update: () => void) => void;
    };

    if (transitionDocument.startViewTransition && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      transitionDocument.startViewTransition(updateVisibility);
      return;
    }

    updateVisibility();
  };

  return (
    <main
      className={`page-main page-home${isCarouselPaused ? ' is-carousel-paused' : ''}${isCollagePaused ? ' is-collage-paused' : ''}${isIntroVisible ? '' : ' is-gallery-only'}`}
      id="main-content"
      tabIndex={-1}
    >
      <div
        className="home-gallery-background"
        aria-hidden={isIntroVisible || undefined}
        onClick={() => {
          if (!isIntroVisible) setSelectedGalleryIndex(null);
        }}
      >
        {homeBackgroundCollage.map(({ src, className }, index) => (
          <button
            type="button"
            className={`home-collage-card ${className}${index === frontCollageIndex ? ' is-collage-front' : ''}${index === previousCollageIndex ? ' is-collage-behind' : ''}`}
            key={`${className}-${src}`}
            aria-label={isIntroVisible ? undefined : `查看照片 ${String(index + 1).padStart(2, '0')}`}
            tabIndex={isIntroVisible ? -1 : 0}
            onClick={(event) => {
              event.stopPropagation();
              if (!isIntroVisible) setSelectedGalleryIndex(index);
            }}
            onMouseEnter={() => setIsCollagePaused(true)}
            onMouseLeave={() => setIsCollagePaused(false)}
          >
            <span className="home-collage-photo">
              <img src={src} alt="" loading={index < 6 ? 'eager' : 'lazy'} />
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        aria-controls="home-intro-content"
        aria-expanded={isIntroVisible}
        aria-label={isIntroVisible ? '隐藏介绍' : '显示介绍'}
        className={`home-content-toggle${isIntroVisible ? '' : ' is-intro-hidden'}`}
        onClick={handleToggleIntro}
        title={isIntroVisible ? '隐藏介绍' : '显示介绍'}
      >
        <svg viewBox="0 0 28 20" aria-hidden="true">
          <path className="home-eye-outline" d="M1.8 10s4.4-7 12.2-7 12.2 7 12.2 7-4.4 7-12.2 7S1.8 10 1.8 10Z" />
          <circle className="home-eye-pupil" cx="14" cy="10" r="3.4" />
          {!isIntroVisible ? <path className="home-eye-slash" d="m4 2 20 16" /> : null}
        </svg>
      </button>

      {!isIntroVisible && selectedGalleryPhoto && selectedGalleryIndex !== null ? (
        <section className="home-gallery-focus" aria-label="照片墙照片预览" aria-live="polite">
          <figure className="home-gallery-focus-frame" key={selectedGalleryPhoto.src}>
            <button
              className="home-gallery-focus-close"
              type="button"
              aria-label="关闭照片分析"
              onClick={() => setSelectedGalleryIndex(null)}
            >
              <span aria-hidden="true">×</span>
            </button>
            <img
              className="home-gallery-focus-image"
              src={selectedGalleryPhoto.src}
              alt={selectedGalleryResult?.alt || `照片墙照片 ${String(selectedGalleryIndex + 1).padStart(2, '0')}`}
            />
          </figure>
          <article className="home-report-preview home-gallery-result">
            <header>
              <span>分析结果</span>
            </header>
            <div className="home-report-preview-grid">
              <div className="home-report-score">
                <span>综合评分</span>
                {selectedGalleryResult ? <strong>{selectedGalleryResult.score}<small>/100</small></strong> : <strong className="is-pending">暂不可用</strong>}
              </div>
              <div>
                <span>评审结论</span>
                <p>{selectedGalleryResult?.verdict || '这张照片的分析结果暂时无法读取。'}</p>
              </div>
              <div>
                <span>微调建议</span>
                <p>{selectedGalleryResult?.action || '请稍后重新打开这张照片。'}</p>
              </div>
            </div>
          </article>
        </section>
      ) : null}

      <div className="home-intro-content" id="home-intro-content" hidden={!isIntroVisible}>

      <section className="home-showcase" aria-labelledby="hero-title">
        <div className="home-showcase-stage">
          <img className="home-showcase-image" src={activeShowcase.src} alt={activeShowcase.alt} />
          <div className="home-showcase-caption">
            <span>{activeShowcase.title}</span>
          </div>
        </div>

        <div className="home-showcase-console">
          <div className="home-showcase-intro">
            <p className="eyebrow">摄影点评与学习</p>
            <h1 id="hero-title"><span>PhotoSense</span><span>AI</span></h1>
            <p className="hero-text">
              上传一张照片，结合影像介质、摄影题材与评价水平，从构图、光线、色彩、叙事和技术完成度整理出可执行的摄影反馈。
            </p>
            <button className="primary-link" type="button" onClick={onStartReview}>
              开始点评
            </button>
          </div>

          <div
            className="home-photo-browser"
            onMouseEnter={() => setIsCarouselPaused(true)}
            onMouseLeave={() => setIsCarouselPaused(false)}
            onFocusCapture={() => setIsCarouselPaused(true)}
            onBlurCapture={handleFilmBlur}
          >
            <div className="home-photo-choice-list" role="list" aria-label="首页摄影作品示例">
              <div className="home-photo-choice-track">
              {[...homeShowcaseItems, ...homeShowcaseItems].map((item, index) => {
                const isActive = item.id === activeShowcase.id;
                const isDuplicate = index >= homeShowcaseItems.length;
                const selectItem = () => setActiveShowcaseId(item.id);

                return (
                  <div role={isDuplicate ? undefined : 'listitem'} aria-hidden={isDuplicate || undefined} key={`${item.id}-${isDuplicate ? 'duplicate' : 'primary'}`}>
                    <button
                      className={`home-photo-choice${isActive ? ' is-active' : ''}`}
                      type="button"
                      data-duplicate={isDuplicate ? 'true' : undefined}
                      tabIndex={isDuplicate ? -1 : undefined}
                      aria-controls={isDuplicate ? undefined : 'home-report-preview'}
                      aria-label={isDuplicate ? undefined : `查看「${item.title}」及对应示例报告`}
                      aria-pressed={isDuplicate ? undefined : isActive}
                      onClick={selectItem}
                      onFocus={isDuplicate ? undefined : selectItem}
                      onMouseEnter={selectItem}
                    >
                      <img src={item.src} alt="" loading="lazy" />
                    </button>
                  </div>
                );
              })}
              </div>
            </div>
          </div>

          <article className="home-report-preview" id="home-report-preview" aria-live="polite" aria-atomic="true">
            <header>
              <strong>分析结果</strong>
            </header>
            <div className="home-report-preview-grid">
              <div className="home-report-score">
                <span>综合评分</span>
                <strong>{activeShowcase.score}</strong>
                <small>/100</small>
              </div>
              <div>
                <span>一句话结论</span>
                <strong>{activeShowcase.verdict}</strong>
              </div>
              <div>
                <span>微调建议</span>
                <strong>{activeShowcase.action}</strong>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="home-flow-panel" aria-label="PhotoSense AI 使用流程">
        <ol className="flow-steps">
          <li>
            <span>01</span>
            <strong>上传一张照片</strong>
            <p>上传作品，并确认照片与基础信息。</p>
          </li>
          <li>
            <span>02</span>
            <strong>选择照片属性</strong>
            <p>选择影像介质、摄影题材和评价水平。</p>
          </li>
          <li>
            <span>03</span>
            <strong>查看反馈报告</strong>
            <p>从多个观察角度理解画面问题。</p>
          </li>
          <li>
            <span>04</span>
            <strong>复盘分析记录</strong>
            <p>之后可以在历史记录中回看。</p>
          </li>
        </ol>
      </section>

      </div>

    </main>
  );
}

type ReviewPageProps = {
  analysisState: AnalysisState;
  analysisElapsedSeconds: number;
  currentDate: string;
  fileInputRef: RefObject<HTMLInputElement>;
  fileName: string;
  fileSize: number;
  imageUrl: string;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  onCancelAnalysis: () => void;
  onImageFile: (file: File) => void;
  onImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onPhotoTitleChange: (title: string) => void;
  onReset: () => void;
  onSelectMedium: (medium: Medium) => void;
  onSelectGenre: (genre: Genre) => void;
  onSelectSkillLevel: (level: SkillLevel) => void;
  onSetReport: (report: Report | null) => void;
  onSetSkillTooltip: (tooltip: { text: string; x: number; y: number } | null) => void;
  photoTitle: string;
  selectedGenre: Genre;
  selectedMedium: Medium;
  skillLevel: SkillLevel;
  skillTooltip: { text: string; x: number; y: number } | null;
  uploadError: string;
};

function ReviewPage({
  analysisState,
  analysisElapsedSeconds,
  currentDate,
  fileInputRef,
  fileName,
  fileSize,
  imageUrl,
  isAnalyzing,
  onAnalyze,
  onCancelAnalysis,
  onImageFile,
  onImageUpload,
  onRemoveImage,
  onPhotoTitleChange,
  onReset,
  onSelectMedium,
  onSelectGenre,
  onSelectSkillLevel,
  onSetReport,
  onSetSkillTooltip,
  selectedGenre,
  selectedMedium,
  photoTitle,
  skillLevel,
  skillTooltip,
  uploadError,
}: ReviewPageProps) {
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  function openFilePicker() {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }

  function handleFileDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingFile(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onImageFile(file);
  }

  const canRetry = imageUrl && (analysisState.kind === 'error' || analysisState.kind === 'cancelled');

  return (
    <main className="page-main page-review" id="main-content" tabIndex={-1}>
      <header className="page-intro review-page-intro">
        <div>
          <p className="panel-kicker">Photo review desk</p>
          <h1>开始点评</h1>
        </div>
        <p>先上传作品并确认预览，再选择适合这张照片的评价语境。</p>
      </header>
      <section className="review-desk page-view" aria-label="开始点评工作台">
          <div className="review-worktable">
            <section className="sequence-block upload-command review-upload" aria-labelledby="review-upload-title">
              <div className="step-label">
                <span>01</span>
                <p id="review-upload-title">上传作品</p>
              </div>
              <div
                className={`rounded-control upload-status-card upload-drop-zone ${isDraggingFile ? 'is-dragging' : ''}`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDraggingFile(false);
                }}
                onDrop={handleFileDrop}
              >
                <div>
                  <p className="panel-kicker">作品状态</p>
                  <h2>{fileName || '等待选择影像文件'}</h2>
                  <p>{fileName ? `${formatFileSize(fileSize)} · 可拖入另一张照片直接更换` : '拖入照片，或点击下方按钮选择 JPG、PNG、WebP（最大 15 MB）。'}</p>
                </div>
                {uploadError ? <p className="upload-error" role="alert">{uploadError}</p> : null}
                <label className="photo-title-field">
                  <span>作品标题（选填）</span>
                  <input
                    type="text"
                    value={photoTitle}
                    placeholder="例如：午后立面、街角等待、雾中山脊"
                    onChange={(event) => onPhotoTitleChange(event.target.value)}
                  />
                </label>
                <div className="upload-file-actions">
                  <button className="secondary-button rounded-command" type="button" onClick={openFilePicker}>
                    {imageUrl ? '更换照片' : '选择照片'}
                  </button>
                  {imageUrl ? (
                    <button className="upload-remove-button rounded-command" type="button" onClick={onRemoveImage}>
                      移除照片
                    </button>
                  ) : null}
                </div>
                <input
                  ref={fileInputRef}
                  className="visually-hidden"
                  type="file"
                  tabIndex={-1}
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  onChange={onImageUpload}
                />
              </div>
            </section>

            <aside className="review-controls" aria-label="点评流程控制">
              <section className="sequence-block medium-block">
                <div className="step-label">
                  <span>02</span>
                  <p>影像介质</p>
                </div>
                <div className="level-toggle" role="group" aria-label="影像介质">
                  {mediums.map((medium) => (
                    <button
                      aria-pressed={selectedMedium === medium}
                      className={selectedMedium === medium ? 'level-button active' : 'level-button'}
                      key={medium}
                      type="button"
                      onClick={() => {
                        onSelectMedium(medium);
                        onSetReport(null);
                      }}
                    >
                      {medium}
                    </button>
                  ))}
                </div>
              </section>

              <section className="sequence-block skill-block">
                <div className="step-label">
                  <span>03</span>
                  <p>评价水平</p>
                </div>
                <div className="level-toggle" role="group" aria-label="评价水平">
                  {skillLevels.map((level) => (
                    <button
                      aria-describedby={skillTooltip ? 'skill-level-tooltip' : undefined}
                      aria-pressed={skillLevel === level}
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
                  <span>04</span>
                  <p>摄影题材</p>
                </div>
                <div className="genre-orbit" role="group" aria-label="摄影题材">
                  {genres.map((genre, index) => (
                    <button
                      aria-pressed={selectedGenre === genre}
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

              <section className="sequence-block action-block">
                <div className="step-label">
                  <span>05</span>
                  <p>开始分析</p>
                </div>
                <div className="desk-actions rounded-actions">
                  <button className="analyze-button rounded-command" type="button" disabled={!imageUrl || isAnalyzing} onClick={onAnalyze}>
                    {isAnalyzing ? '正在分析影像' : canRetry ? '重新分析' : '开始分析'}
                  </button>
                  {isAnalyzing ? (
                    <button className="cancel-analysis-button rounded-command" type="button" onClick={onCancelAnalysis}>
                      取消分析
                    </button>
                  ) : (
                    <button className="reset-button rounded-command" type="button" onClick={onReset}>
                      重置
                    </button>
                  )}
                  {isAnalyzing ? (
                    <div className="analysis-progress" aria-label="分析进度">
                      <ol>
                        {analysisPhases.map((phase) => (
                          <li className={`phase-${getAnalysisPhaseStatus(analysisState.phase, phase.id)}`} key={phase.id}>
                            <span aria-hidden="true" />
                            <strong>{phase.label}</strong>
                          </li>
                        ))}
                      </ol>
                      <p>{getAnalysisWaitMessage(analysisElapsedSeconds)}</p>
                    </div>
                  ) : null}
                  <p className={`analysis-helper analysis-state-${analysisState.kind}`} role={analysisState.kind === 'error' || analysisState.kind === 'mock' ? 'alert' : 'status'}>
                    {analysisState.message ?? (imageUrl ? '已准备查看反馈报告' : '请先上传作品')}
                  </p>
                </div>
              </section>

            </aside>

            <section className="review-preview" aria-label="照片上传与预览">
              <div className="preview-header">
                <div>
                  <p className="panel-kicker">审片灯台</p>
                  <h2>{fileName ? '作品已进入点评流程' : '请先上传一张照片'}</h2>
                  <p>{fileName ? '作品已载入审片灯台，可查看反馈报告。' : '上传后会在灯台区域生成大图预览。'}</p>
                </div>

              </div>

              <div
                className={`preview-stage ${imageUrl ? 'has-image' : ''} ${isDraggingFile ? 'is-dragging' : ''}`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDraggingFile(false);
                }}
                onDrop={handleFileDrop}
              >
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
                {fileName ? <span>{fileName}</span> : null}
                <span>{selectedMedium}</span>
                <span>{skillLevel}</span>
                <span>{selectedGenre}</span>
                <span>{currentDate}</span>
              </div>
            </section>
          </div>

          {skillTooltip ? (
            <div className="skill-tooltip" id="skill-level-tooltip" role="tooltip" style={{ left: skillTooltip.x + 18, top: skillTooltip.y + 18 }}>
              {skillTooltip.text}
            </div>
          ) : null}
      </section>
    </main>
  );
}

type ReportPageProps = {
  activeRecord: HistoryRecord | null;
  analysisState: AnalysisState;
  canRetryAnalysis: boolean;
  copyStatus: string;
  currentDate: string;
  fileName: string;
  imageUrl: string;
  isAnalyzing: boolean;
  onCopyReport: () => void;
  onRetryAnalysis: () => void;
  onStartReview: () => void;
  report: Report | null;
  selectedGenre: Genre;
  selectedMedium: Medium;
  skillLevel: SkillLevel;
};

const reportNavItems = [
  { id: 'report-overview', label: '总览' },
  { id: 'report-dimensions', label: '五维诊断' },
  { id: 'report-post-processing', label: '后期建议' },
  { id: 'report-next-actions', label: '下次行动' },
  { id: 'report-context', label: '补充说明' },
];

function ReportPage({
  activeRecord,
  analysisState,
  canRetryAnalysis,
  copyStatus,
  currentDate,
  fileName,
  imageUrl,
  isAnalyzing,
  onCopyReport,
  onRetryAnalysis,
  onStartReview,
  report,
  selectedGenre,
  selectedMedium,
  skillLevel,
}: ReportPageProps) {
  const displayedReport = activeRecord?.report ?? report;
  const displayedFileName = (activeRecord?.fileName ?? fileName) || '未命名照片';
  const displayedImageUrl = activeRecord?.imageUrl ?? imageUrl;
  const displayedMedium = activeRecord?.medium ?? selectedMedium;
  const displayedGenre = activeRecord?.genre ?? selectedGenre;
  const displayedSkillLevel = activeRecord?.skillLevel ?? skillLevel;
  const displayedDate = activeRecord?.date ?? currentDate;
  const displayedSource: ReportSource = activeRecord?.reportSource ?? (analysisState.kind === 'mock' ? 'mock' : analysisState.kind === 'ai' ? 'ai' : 'legacy');
  const displayedAnalysisError = activeRecord?.analysisError ?? (analysisState.kind === 'mock' || analysisState.kind === 'error' ? analysisState.message : undefined);
  const displayedSourceLabel = displayedSource === 'ai' ? '实时 AI 分析' : displayedSource === 'mock' ? '示例报告' : '历史报告';
  const displayedSourceMessage = displayedSource === 'ai'
    ? '本次结果来自图像分析服务。'
    : displayedSource === 'mock'
      ? `分析服务暂时不可用，请勿将这份示例报告视为真实照片分析。${displayedAnalysisError ? ` ${displayedAnalysisError}` : ''}`
      : '这条旧记录没有保存报告来源，建议重新分析。';
  const genreAssessment = displayedReport?.genreAssessment;
  const hasGenreMismatch = displayedSource === 'ai'
    && Boolean(genreAssessment)
    && genreAssessment!.confidence >= 0.75
    && genreAssessment!.detectedGenre !== displayedGenre;
  const reportVerdict = displayedReport ? getReportVerdict(displayedReport, displayedGenre) : null;
  const reviewContext = getResolvedReviewContext(displayedReport, displayedMedium, displayedGenre, displayedSkillLevel);
  const postProcessing = displayedReport ? getPostProcessingAdvice(displayedReport) : null;
  const scoreSummary = displayedReport ? getScoreSummary(displayedReport) : null;
  const scoreReasons = displayedReport ? getScoreReasons(displayedReport) : null;
  const photoSpecific = displayedReport ? getPhotoSpecificFeedback(displayedReport, displayedGenre) : null;
  const nextActions = displayedReport ? getNextShootingActions(displayedReport, displayedGenre) : null;
  const [activeReportSection, setActiveReportSection] = useState(reportNavItems[0].id);
  const [exportStatus, setExportStatus] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportTimerRef = useRef<number | null>(null);
  const reportExportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!displayedReport) {
      return undefined;
    }

    const visibleSections = reportNavItems
      .map((item) => document.getElementById(item.id))
      .filter((section): section is HTMLElement => Boolean(section));

    const observer = new IntersectionObserver(
      (entries) => {
        const currentEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => first.boundingClientRect.top - second.boundingClientRect.top)[0];

        if (currentEntry?.target.id) {
          setActiveReportSection(currentEntry.target.id);
        }
      },
      { rootMargin: '-120px 0px -62% 0px', threshold: 0.01 },
    );

    visibleSections.forEach((section) => observer.observe(section));

    const handleDocumentScroll = () => {
      const isAtPageEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 12;
      if (isAtPageEnd) {
        setActiveReportSection(reportNavItems[reportNavItems.length - 1].id);
      }
    };

    window.addEventListener('scroll', handleDocumentScroll, { passive: true });
    handleDocumentScroll();

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleDocumentScroll);
    };
  }, [displayedReport]);

  useEffect(() => {
    return () => {
      if (exportTimerRef.current) {
        window.clearTimeout(exportTimerRef.current);
      }
    };
  }, []);

  async function handleExportReport(mode: 'simple' | 'detailed') {
    const exportNode = reportExportRef.current;
    if (!exportNode || isExporting) return;

    setIsExportMenuOpen(false);
    setIsExporting(true);
    setExportStatus(`正在生成${mode === 'simple' ? '简易' : '详细'}报告图片…`);

    const exportHost = document.createElement('div');
    exportHost.className = 'page-report report-export-host';
    exportHost.setAttribute('aria-hidden', 'true');
    const clonedReport = exportNode.cloneNode(true) as HTMLDivElement;
    clonedReport.removeAttribute('data-report-export');
    clonedReport.classList.add('is-exporting');
    if (mode === 'simple') clonedReport.classList.add('is-simple-export');
    clonedReport.querySelectorAll('details').forEach((item) => {
      item.open = true;
    });
    exportHost.appendChild(clonedReport);
    document.body.appendChild(exportHost);

    try {
      await document.fonts?.ready;
      await Promise.all([...clonedReport.querySelectorAll('img')].map(async (image) => {
        if (!image.complete) {
          await new Promise<void>((resolve) => {
            image.addEventListener('load', () => resolve(), { once: true });
            image.addEventListener('error', () => resolve(), { once: true });
          });
        }
        if (typeof image.decode === 'function') {
          await image.decode().catch(() => undefined);
        }
      }));
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

      const { default: html2canvas } = await import('html2canvas');
      const exportImage = clonedReport.querySelector<HTMLImageElement>('.diagnostic-image-board img');
      const imageScale = mode === 'simple' && exportImage?.naturalWidth && exportImage.clientWidth
        ? Math.max(1, exportImage.naturalWidth / exportImage.clientWidth)
        : 1;
      const canvas = await html2canvas(clonedReport, {
        backgroundColor: '#eee7d8',
        logging: false,
        scale: imageScale,
        useCORS: true,
        windowWidth: 1440,
      });
      const imageParts = mode === 'simple'
        ? await createPortraitReportPart(canvas)
        : await createFullReportPart(canvas);
      if (imageParts.length === 0) {
        throw new Error('报告画布尺寸无效');
      }
      const safeName = (activeRecord?.title || displayedFileName || '分析报告')
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
        .slice(0, 80) || '分析报告';

      for (const [index, imageBlob] of imageParts.entries()) {
        const downloadUrl = URL.createObjectURL(imageBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = downloadUrl;
        downloadLink.download = mode === 'simple'
          ? `PhotoSense-AI-${safeName}-简易报告.png`
          : `PhotoSense-AI-${safeName}-详细报告.png`;
        document.body.appendChild(downloadLink);
        setExportStatus(`正在下载第 ${index + 1}/${imageParts.length} 张报告图片…`);
        downloadLink.click();
        downloadLink.remove();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 30000);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 120));
      }

      setExportStatus(`已导出 ${imageParts.length} 张报告图片`);
    } catch (error) {
      console.error('Report export failed', error);
      setExportStatus('导出失败，请稍后重试');
    } finally {
      exportHost.remove();
      setIsExporting(false);
    }

    if (exportTimerRef.current) {
      window.clearTimeout(exportTimerRef.current);
    }

    exportTimerRef.current = window.setTimeout(() => {
      setExportStatus('');
    }, 2200);
  }

  return (
    <main className="page-main page-report" id="main-content" tabIndex={-1}>
      <section className="report-section page-view" aria-labelledby="report-page-title">
          <header className="report-masthead">
            <div className="report-masthead-copy">
              <p className="panel-kicker">Photography review</p>
              <h1 id="report-page-title">{activeRecord?.title || '分析报告'}</h1>
              <p>
                {displayedReport
                  ? `${formatReportDate(displayedDate)} · ${displayedMedium} · ${displayedGenre} · ${displayedSkillLevel}`
                  : '完成一次照片点评后，报告会在这里集中展示。'}
              </p>
            </div>
            {displayedReport ? (
              <div className="report-header-tools report-header-tools-only">
              <div className="report-action-group">
                <div className="report-action-item">
                  <button
                    className="secondary-button compact"
                    type="button"
                    aria-busy={isExporting}
                    aria-describedby="export-report-help"
                    aria-expanded={isExportMenuOpen}
                    aria-haspopup="menu"
                    disabled={isExporting}
                    onClick={() => setIsExportMenuOpen((isOpen) => !isOpen)}
                  >
                    {isExporting ? '正在导出…' : '导出报告图片'}
                  </button>
                  <span className="report-action-tooltip" id="export-report-help" role="tooltip">
                    以图片形式导出报告，可选择简易报告或详细报告
                  </span>
                  {isExportMenuOpen ? (
                    <div className="report-export-menu" role="menu" aria-label="选择报告图片类型">
                      <button type="button" role="menuitem" onClick={() => void handleExportReport('simple')}>
                        <strong>简易报告</strong>
                        <span>单张竖版图 · 四项核心内容</span>
                      </button>
                      <button type="button" role="menuitem" onClick={() => void handleExportReport('detailed')}>
                        <strong>详细报告</strong>
                        <span>完整内容 · 单张长图</span>
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="report-action-item">
                  <button
                    className="primary-link compact"
                    type="button"
                    aria-describedby="copy-report-help"
                    onClick={onCopyReport}
                  >
                    {copyStatus}
                  </button>
                  <span className="report-action-tooltip" id="copy-report-help" role="tooltip">
                    将文字版报告复制至剪贴板
                  </span>
                </div>
              </div>
                <span className="report-save-status">已自动保存到此浏览器</span>
                {exportStatus ? <span className="report-share-feedback" role="status">{exportStatus}</span> : null}
              </div>
            ) : null}
          </header>

          {displayedReport ? (
            <div className={`report-source-notice report-source-${displayedSource}`} role={displayedSource === 'mock' ? 'alert' : 'status'}>
              <div>
                <strong>
                  {displayedSourceLabel}
                </strong>
                <span>{displayedSourceMessage}</span>
              </div>
              {displayedSource === 'mock' && canRetryAnalysis ? (
                <button className="report-retry-button" type="button" onClick={onRetryAnalysis}>
                  重试实时分析
                </button>
              ) : null}
            </div>
          ) : null}

          {hasGenreMismatch && genreAssessment ? (
            <div className="report-genre-warning" role="status">
              <span className="report-genre-warning-label"><b>01</b>题材核对</span>
              <div>
                <span className="report-genre-warning-kicker">当前选择与画面判断不一致</span>
                <strong>你选择了「{displayedGenre}」，画面更接近「{genreAssessment.detectedGenre}」</strong>
                <p>{genreAssessment.reason} · 判断置信度 {Math.round(genreAssessment.confidence * 100)}%</p>
                <small>当前报告仍按「{displayedGenre}」标准生成；如需按「{genreAssessment.detectedGenre}」评价，请返回调整后重新分析。</small>
              </div>
              <button className="secondary-button compact" type="button" onClick={onStartReview}>
                调整题材后重新分析
              </button>
            </div>
          ) : null}

          {isAnalyzing ? (
            <div className="loading-panel">
              <div className="scan-line" />
              <p>正在读取明暗结构、主体层级与画面意图。</p>
            </div>
          ) : null}

          {!isAnalyzing && !displayedReport ? (
            <div className="empty-report empty-report-state">
              <p className="eyebrow">暂无分析报告</p>
              <h2>请先上传一张照片并完成 AI 点评。</h2>
              <button className="primary-link" type="button" onClick={onStartReview}>
                前往开始点评
              </button>
            </div>
          ) : null}

          {displayedReport ? (
            <div className="diagnostic-report-shell">
              <aside className="report-side-nav" aria-label="报告章节导航">
                <p className="panel-kicker">报告目录</p>
                {reportNavItems.map((item) => (
                  <a
                    aria-current={activeReportSection === item.id ? 'location' : undefined}
                    className={activeReportSection === item.id ? 'is-active' : ''}
                    href={`#${item.id}`}
                    key={item.id}
                    onClick={() => setActiveReportSection(item.id)}
                  >
                    {item.label}
                  </a>
                ))}
              </aside>

              <div className="diagnostic-report" data-report-export="true" ref={reportExportRef}>
                <div className={`report-export-cover report-source-${displayedSource}`} aria-hidden="true" data-report-page-block="true">
                  <p className="panel-kicker">PhotoSense AI · Photography review</p>
                  <h2>{activeRecord?.title || '分析报告'}</h2>
                  <p>{formatReportDate(displayedDate)} · {displayedMedium} · {displayedGenre} · {displayedSkillLevel}</p>
                  <div>
                    <strong>{displayedSourceLabel}</strong>
                    <span>{displayedSourceMessage}</span>
                  </div>
                </div>
                <section className="diagnostic-hero-report" id="report-overview" aria-label="照片诊断标注" data-report-page-block="true">
                <article className="report-opening-summary">
                  {reportVerdict ? (
                    <section className="report-verdict-block" aria-label="评审结论">
                      <p className="panel-kicker">评审结论</p>
                      <h2>{reportVerdict.title}</h2>
                      <div className="report-verdict-summary">
                        <span>一句话结论</span>
                        <p>{reportVerdict.summary}</p>
                      </div>
                      <div className="report-verdict-notes">
                        <div>
                          <span>主要问题</span>
                          <p>{reportVerdict.mainIssue}</p>
                        </div>
                        <div>
                          <span>本张先改</span>
                          <p>{reportVerdict.nextStep}</p>
                        </div>
                      </div>
                    </section>
                  ) : null}
                  {scoreSummary ? (
                    <section className="report-score-block" aria-label="综合评分与五维评分概览">
                      <div className="score-total-lockup" aria-label={`综合评分 ${scoreSummary.overall}`}>
                        <span>综合评分</span>
                        <strong>{scoreSummary.overall}<small>/100</small></strong>
                      </div>
                      <p className="report-score-context">
                        基于{displayedMedium}、{displayedGenre}与{displayedSkillLevel}的学习参考
                      </p>
                      <RadarChart scores={displayedReport.scores} />
                    </section>
                  ) : null}
                </article>

                <div className="diagnostic-photo-panel">
                  <div className="diagnostic-image-board">
                    {displayedImageUrl ? <img src={displayedImageUrl} alt="用于诊断的已上传照片" /> : null}
                  </div>
                  <div className="photo-meta-strip">
                    <span>{displayedFileName}</span>
                    <i>/</i>
                    <span>{displayedMedium}</span>
                    <i>/</i>
                    <span>{displayedGenre}</span>
                    <i>/</i>
                    <span>{displayedSkillLevel}</span>
                    <i>/</i>
                    <span>{formatReportDate(displayedDate)}</span>

                  </div>
                </div>
                </section>

                {photoSpecific ? (
                  <section className="photo-specific-summary" aria-label="照片针对性观察" data-report-page-block="true">
                    <SectionTitle icon="overall" eyebrow="画面观察" title="初步评价" />
                    <div className="photo-specific-grid">
                      <article>
                        <span>值得保留</span>
                        <p>{photoSpecific.strength}</p>
                      </article>
                      <article>
                        <span>最优先问题</span>
                        <p>{photoSpecific.priorityIssue}</p>
                      </article>
                      <article>
                        <span>画面区域</span>
                        <p>{photoSpecific.affectedArea}</p>
                      </article>
                      <article>
                        <span>本张调整</span>
                        <p>{photoSpecific.nextAction}</p>
                      </article>
                      <article className="photo-specific-crop">
                        <span>裁剪参考</span>
                        <strong>{photoSpecific.crop.ratio}</strong>
                        <p>{photoSpecific.crop.direction}。{photoSpecific.crop.rationale}</p>
                      </article>
                    </div>
                  </section>
                ) : null}

                <section className="dimension-diagnosis" id="report-dimensions" aria-label="五项摄影诊断维度" data-report-page-block="true">
                <SectionTitle icon="technical" eyebrow="诊断维度" title="评分、结论与行动建议" />
                <div className="diagnosis-grid">
                  <DiagnosticCard icon="composition" title="构图" score={displayedReport.scores['构图']} reason={scoreReasons?.['构图']} text={displayedReport.composition} priority={scoreSummary?.weakest.name === '构图'} />
                  <DiagnosticCard icon="lighting" title="光线" score={displayedReport.scores['光线']} reason={scoreReasons?.['光线']} text={displayedReport.lighting} priority={scoreSummary?.weakest.name === '光线'} />
                  <DiagnosticCard icon="colour" title="色彩" score={displayedReport.scores['色彩']} reason={scoreReasons?.['色彩']} text={displayedReport.colour} priority={scoreSummary?.weakest.name === '色彩'} />
                  <DiagnosticCard icon="storytelling" title="叙事" score={displayedReport.scores['叙事']} reason={scoreReasons?.['叙事']} text={displayedReport.storytelling} priority={scoreSummary?.weakest.name === '叙事'} />
                  <DiagnosticCard
                    icon="technical"
                    title="技术完成度"
                    score={displayedReport.scores['技术完成度']}
                    reason={scoreReasons?.['技术完成度']}
                    text={displayedReport.technical}
                    priority={scoreSummary?.weakest.name === '技术完成度'}
                  />
                </div>
                </section>

                {postProcessing ? (
                  <section className="post-processing-advice" id="report-post-processing" aria-label="后期建议" data-report-page-block="true">
                  <SectionTitle icon="recipe" eyebrow="后期参考" title="后期建议" />
                  <PostProcessingPreview
                    imageUrl={displayedImageUrl}
                    report={displayedReport}
                    medium={displayedMedium}
                    skillLevel={displayedSkillLevel}
                    enabled={displayedSource !== 'mock'}
                  />
                  <div className="post-processing-grid">
                    <PostAdviceCard index="01" title="裁剪建议" item={postProcessing.crop} priority />
                    <PostAdviceCard index="02" title={displayedSkillLevel === '爱好者水平' ? '明暗调整建议' : '影调修改建议'} item={postProcessing.tone} />
                    <PostAdviceCard index="03" title={displayedSkillLevel === '爱好者水平' ? '局部提亮 / 压暗建议' : '蒙版提亮 / 压暗建议'} item={postProcessing.masking} />
                  </div>
                  </section>
                ) : null}

                {nextActions ? (
                  <section className="next-shooting-actions" id="report-next-actions" data-report-page-block="true">
                  <SectionTitle icon="suggestions" eyebrow="下次行动" title="下次拍摄优先尝试" />
                  <p>{nextActions.summary}</p>
                  <ul>
                    {nextActions.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  </section>
                ) : null}

                <section className="review-context-section" id="report-context" aria-label="补充说明与评价设置" data-report-page-block="true">
                  <SectionTitle icon="overall" eyebrow="评价依据" title="补充说明" />
                  <div className="review-context-card" aria-label="本次评价设置">
                    <div className="review-context-head">
                      <p className="panel-kicker">本次评价基准</p>
                      <span>{displayedMedium} / {displayedSkillLevel} / {displayedGenre}</span>
                    </div>
                    <dl>
                      <div>
                        <dt>影像介质</dt>
                        <dd>{reviewContext.mediumFocus}</dd>
                      </div>
                      <div>
                        <dt>评价水平</dt>
                        <dd>{reviewContext.levelFocus}</dd>
                      </div>
                      <div>
                        <dt>摄影题材</dt>
                        <dd>{reviewContext.genreFocus}</dd>
                      </div>
                      <div>
                        <dt>评分侧重</dt>
                        <dd>{reviewContext.scoringLogic}</dd>
                      </div>
                    </dl>
                  </div>
                </section>
              </div>
            </div>
          ) : null}
      </section>
    </main>
  );
}

type HistoryPageProps = {
  historyRecords: HistoryRecord[];
  onDeleteRecord: (recordId: string) => void;
  onOpenRecord: (record: HistoryRecord) => void;
  onStartReview: () => void;
};

function HistoryPage({ historyRecords, onDeleteRecord, onOpenRecord, onStartReview }: HistoryPageProps) {
  const [historyActionMode, setHistoryActionMode] = useState<'idle' | 'manage' | 'compare'>('idle');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [activeMediumFilter, setActiveMediumFilter] = useState<Medium | '全部'>('全部');
  const [activeGenreFilter, setActiveGenreFilter] = useState<Genre | '全部'>('全部');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historySort, setHistorySort] = useState<HistorySort>('最新上传');
  const averageScore = historyRecords.length
    ? Math.round(historyRecords.reduce((sum, record) => sum + record.overallScore, 0) / historyRecords.length)
    : 0;
  const currentMonthCount = countRecordsInCurrentMonth(historyRecords);
  const mediumFilterOptions: Array<Medium | '全部'> = ['全部', ...mediums];
  const subjectFilterOptions: Array<Genre | '全部'> = ['全部', ...genres];
  const filteredRecords = filterAndSortHistoryRecords(historyRecords, {
    medium: activeMediumFilter,
    genre: activeGenreFilter,
    startDate,
    endDate,
    query: historySearch,
    sort: historySort,
  });
  const comparisonRecords = comparisonIds
    .map((recordId) => historyRecords.find((record) => record.id === recordId))
    .filter((record): record is HistoryRecord => Boolean(record));
  const hasActiveFilters = activeMediumFilter !== '全部' || activeGenreFilter !== '全部' || Boolean(startDate || endDate);
  const isManaging = historyActionMode === 'manage';
  const isSelectingComparison = historyActionMode === 'compare';

  function resetFilters() {
    setActiveMediumFilter('全部');
    setActiveGenreFilter('全部');
    setStartDate('');
    setEndDate('');
  }

  function handleDeleteRecord(event: MouseEvent<HTMLButtonElement>, record: HistoryRecord) {
    event.stopPropagation();

    if (window.confirm('确定删除这条历史记录吗？')) {
      onDeleteRecord(record.id);
      setComparisonIds((records) => records.filter((recordId) => recordId !== record.id));
      setIsComparing(false);
    }
  }

  function handleToggleComparison(event: MouseEvent<HTMLButtonElement>, recordId: string) {
    event.stopPropagation();
    setIsComparing(false);
    setComparisonIds((current) => {
      if (current.includes(recordId)) return current.filter((id) => id !== recordId);
      if (current.length >= 2) return current;
      return [...current, recordId];
    });
  }

  function handleToggleManaging() {
    setHistoryActionMode(isManaging ? 'idle' : 'manage');
    setComparisonIds([]);
    setIsComparing(false);
  }

  function handleComparisonAction() {
    if (!isSelectingComparison) {
      setHistoryActionMode('compare');
      setComparisonIds([]);
      setIsComparing(false);
      return;
    }

    if (isComparing) {
      setHistoryActionMode('idle');
      setComparisonIds([]);
      setIsComparing(false);
      return;
    }

    if (comparisonRecords.length === 2) {
      setIsComparing(true);
      return;
    }

    setHistoryActionMode('idle');
    setComparisonIds([]);
  }

  return (
    <main className="history-page" id="main-content" tabIndex={-1}>
      <header className="page-intro history-page-intro">
        <div className="history-intro-copy">
          <p className="panel-kicker">Contact archive</p>
          <div className="history-title-row">
            <h1>历史记录</h1>
            <p>回看关键问题、改善方向与下一次练习。</p>
          </div>
        </div>
        <div className="history-header-actions">
          <button
            className={`history-manage-button ${isManaging ? 'is-active' : ''}`}
            type="button"
            aria-pressed={isManaging}
            onClick={handleToggleManaging}
          >
            {isManaging ? '完成管理' : '管理记录'}
          </button>
          <button
            className={`history-compare-button ${isSelectingComparison ? 'is-active' : ''}`}
            type="button"
            aria-pressed={isSelectingComparison}
            onClick={handleComparisonAction}
          >
            {!isSelectingComparison
              ? '对比记录'
              : isComparing
                ? '结束对比'
                : comparisonRecords.length === 2
                  ? '查看对比（2/2）'
                  : `取消对比（${comparisonRecords.length}/2）`}
          </button>
        </div>
      </header>
      <section className="history-tools" aria-label="历史记录工具栏">
        <div className="history-summary" aria-label="历史记录摘要">
          <div>
            <strong>{historyRecords.length}</strong>
            <span>全部记录</span>
          </div>
          <div>
            <strong>{currentMonthCount}</strong>
            <span>本月点评</span>
          </div>
          <div>
            <strong>{averageScore || '--'}</strong>
            <span>全部平均</span>
          </div>
        </div>

        <div className="history-primary-tools">
          <label className="history-control-group history-search">
            <span>搜索</span>
            <input
              type="search"
              value={historySearch}
              placeholder="搜索作品标题 / 文件名 / 标签"
              onChange={(event) => setHistorySearch(event.target.value)}
            />
          </label>
          <label className="history-control-group history-sort">
            <span>排序</span>
            <select value={historySort} onChange={(event) => setHistorySort(event.target.value as HistorySort)}>
              <option>最新上传</option>
              <option>评分最高</option>
              <option>评分最低</option>
            </select>
          </label>
          <button
            className={`history-filter-toggle ${isFiltersOpen ? 'is-active' : ''}`}
            type="button"
            aria-controls="history-filter-panel"
            aria-expanded={isFiltersOpen}
            onClick={() => setIsFiltersOpen((current) => !current)}
          >
            {isFiltersOpen ? '收起筛选' : hasActiveFilters ? '筛选已启用' : '筛选条件'}
          </button>
        </div>
      </section>

      <section className={`history-filters ${isFiltersOpen ? 'is-open' : 'is-collapsed'}`} id="history-filter-panel" aria-label="历史记录筛选工具">
        <div className="history-filter-layout">
          <div className="history-filter-left">
            <div className="history-filter-group">
              <span>介质</span>
              <div className="history-filter-tags">
                {mediumFilterOptions.map((option) => (
                  <button
                    aria-pressed={activeMediumFilter === option}
                    className={activeMediumFilter === option ? 'active' : ''}
                    key={option}
                    type="button"
                    onClick={() => setActiveMediumFilter(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="history-filter-group">
              <span>题材</span>
              <div className="history-filter-tags">
                {subjectFilterOptions.map((option) => (
                  <button
                    aria-pressed={activeGenreFilter === option}
                    className={activeGenreFilter === option ? 'active' : ''}
                    key={option}
                    type="button"
                    onClick={() => setActiveGenreFilter(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="history-filter-right">
            <div className="history-filter-controls history-date-controls">
              <div className="history-control-group history-date-group">
                <span>时间</span>
                <div>
                  <label>
                    <small>开始日期</small>
                    <input type="date" max={endDate || undefined} value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                  </label>
                  <label>
                    <small>结束日期</small>
                    <input type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                  </label>
                  <button type="button" onClick={resetFilters}>
                    清除全部
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="history-results-bar">
          <span role="status">当前显示 {filteredRecords.length} / {historyRecords.length} 条记录</span>
          {hasActiveFilters ? <button type="button" onClick={resetFilters}>清除筛选</button> : null}
        </div>
      </section>

      {historyActionMode !== 'idle' ? (
        <div className={`history-action-status history-action-status-${historyActionMode}`} role="status">
          <strong>{isManaging ? '管理记录' : '对比记录'}</strong>
          <span>
            {isManaging
              ? '可以删除不再需要的记录；删除后不可恢复。'
              : `请选择两份记录查看评分与练习方向变化，当前已选 ${comparisonRecords.length}/2。`}
          </span>
        </div>
      ) : null}

      {isComparing && comparisonRecords.length === 2 ? (
        <HistoryComparison first={comparisonRecords[0]} second={comparisonRecords[1]} onClose={() => setIsComparing(false)} />
      ) : null}

      <section className="history-feed" data-count={Math.min(filteredRecords.length, 3)} aria-label="摄影点评历史内容流">
        {historyRecords.length === 0 ? (
          <div className="empty-report empty-report-state">
            <p className="eyebrow">暂无历史记录</p>
            <h2>完成一次 AI 点评后，上传照片会自动出现在这里。</h2>
            <button className="primary-link" type="button" onClick={onStartReview}>开始第一次点评</button>
          </div>
        ) : null}

        {historyRecords.length > 0 && filteredRecords.length === 0 ? (
          <div className="empty-report empty-report-state history-filter-empty">
            <p className="eyebrow">没有找到符合条件的作品</p>
            <h2>可以调整筛选条件，或上传新的照片进行点评。</h2>
            <button className="secondary-button" type="button" onClick={resetFilters}>清除筛选</button>
          </div>
        ) : null}

        {filteredRecords.map((record) => {
          const title = record.title || '未命名作品';
          const subject = record.subject ?? record.genre;
          const critiqueLevel = record.critiqueLevel ?? record.skillLevel;
          const isNewestRecord = historyRecords[0]?.id === record.id;

          return (
            <article
              className={`history-card history-uploaded ${historyRecords[0]?.id === record.id ? 'history-recent' : ''} ${comparisonIds.includes(record.id) ? 'is-comparison-selected' : ''}`}
              key={record.id}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return;
                onOpenRecord(record);
              }}
            >
              {isManaging || isSelectingComparison ? (
                <div className="history-card-manage-actions">
                  {isSelectingComparison ? (
                    <button
                      className={`history-select-button ${comparisonIds.includes(record.id) ? 'is-selected' : ''}`}
                      type="button"
                      aria-pressed={comparisonIds.includes(record.id)}
                      disabled={comparisonIds.length >= 2 && !comparisonIds.includes(record.id)}
                      onClick={(event) => handleToggleComparison(event, record.id)}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      {comparisonIds.includes(record.id) ? '已选对比' : '选择对比'}
                    </button>
                  ) : null}
                  {isManaging ? (
                    <button
                      className="history-delete-button"
                      type="button"
                      onClick={(event) => handleDeleteRecord(event, record)}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      删除
                    </button>
                  ) : null}
                </div>
              ) : null}
              <div className="history-thumb">
                {record.imageUrl ? (
                  <img src={record.imageUrl} alt={`${title} 缩略图`} />
                ) : (
                  <div className="history-thumb-placeholder">暂无缩略图</div>
                )}
                {isNewestRecord ? <span className="history-new-label">NEW</span> : null}
                {record.reportSource !== 'ai' ? (
                  <span className={`history-source-label history-source-${record.reportSource}`}>
                    {record.reportSource === 'mock' ? '示例报告' : '来源未记录'}
                  </span>
                ) : null}
              </div>
              <div className="history-card-body">
                <div className="history-card-info">
                  <div className="history-card-title">
                    <h2>{title}</h2>
                    <p className="history-file-name" title={record.fileName}>{record.fileName}</p>
                    <div className="history-meta-tags">
                      <span>{record.medium}</span>
                      <span>{critiqueLevel}</span>
                      <span>{subject}</span>
                    </div>
                    <p className="history-card-summary">{record.summary || record.report.overall}</p>
                    <div className="history-priority-dimension">
                      <span>优先改善</span>
                      <strong>{record.weakestDimension || getScoreSummary(record.report).weakest.name}</strong>
                    </div>
                  </div>
                  <div className="history-score-badge" aria-label={`评分 ${record.overallScore}`}>
                    <span>评分</span>
                    <strong>{record.overallScore}</strong>
                  </div>
                </div>
                <div className="history-card-footer">
                  <time>{record.date}</time>
                  <button className="history-report-button" type="button" aria-label={`查看 ${title} 的分析报告`} onClick={() => onOpenRecord(record)}>
                    查看报告 →
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function HistoryComparison({ first, second, onClose }: { first: HistoryRecord; second: HistoryRecord; onClose: () => void }) {
  const comparison = compareHistoryRecords(first, second);
  const formatDelta = (delta: number) => (delta > 0 ? `+${delta}` : `${delta}`);

  return (
    <section className="history-comparison" aria-labelledby="history-comparison-title">
      <div className="history-comparison-head">
        <div>
          <p className="panel-kicker">成长对比</p>
          <h2 id="history-comparison-title">两次摄影点评的变化</h2>
          <p>系统按记录时间自动区分较早作品和较新作品。</p>
        </div>
        <button type="button" onClick={onClose}>关闭对比</button>
      </div>

      <div className="comparison-photo-grid">
        {[{ label: '较早作品', record: comparison.older, issue: comparison.olderIssue }, { label: '较新作品', record: comparison.newer, issue: comparison.newerIssue }].map(({ label, record, issue }) => (
          <article key={record.id}>
            <div className="comparison-photo">
              {record.imageUrl ? <img src={record.imageUrl} alt={`${record.title} 对比缩略图`} /> : <span>暂无缩略图</span>}
            </div>
            <div className="comparison-photo-copy">
              <span>{label}</span>
              <h3>{record.title || '未命名作品'}</h3>
              <p>{record.date} · {record.genre} · {record.skillLevel}</p>
              <strong>{record.overallScore}<small>/100</small></strong>
              <dl>
                <dt>主要问题</dt>
                <dd>{issue}</dd>
              </dl>
            </div>
          </article>
        ))}
      </div>

      <div className="comparison-highlights">
        <article>
          <span>综合评分变化</span>
          <strong className={comparison.totalDelta > 0 ? 'is-positive' : comparison.totalDelta < 0 ? 'is-negative' : ''}>
            {formatDelta(comparison.totalDelta)}
          </strong>
        </article>
        <article>
          <span>{comparison.hasImprovement ? '提升最多维度' : '变化最大维度'}</span>
          <strong>{comparison.mostImproved.name} {formatDelta(comparison.mostImproved.delta)}</strong>
        </article>
        <article>
          <span>当前优先练习</span>
          <strong>{comparison.practicePriority.name}</strong>
          <p>{comparison.practiceAction}</p>
        </article>
      </div>

      <div className="comparison-dimensions" aria-label="五项评分变化">
        <div className="comparison-dimension-row comparison-dimension-head" aria-hidden="true">
          <span>维度</span><span>较早</span><span>较新</span><span>变化</span>
        </div>
        {comparison.dimensions.map((item) => (
          <div className="comparison-dimension-row" key={item.name}>
            <strong>{item.name}</strong>
            <span>{item.olderScore}</span>
            <span>{item.newerScore}</span>
            <em className={item.delta > 0 ? 'is-positive' : item.delta < 0 ? 'is-negative' : ''}>{formatDelta(item.delta)}</em>
          </div>
        ))}
      </div>
    </section>
  );
}

function LoginPage({ onAuthSuccess, onSwitch }: { onAuthSuccess: () => void; onSwitch: () => void }) {
  return <AuthPage mode="login" onAuthSuccess={onAuthSuccess} onSwitch={onSwitch} />;
}

function RegisterPage({ onAuthSuccess, onSwitch }: { onAuthSuccess: () => void; onSwitch: () => void }) {
  return <AuthPage mode="register" onAuthSuccess={onAuthSuccess} onSwitch={onSwitch} />;
}

function AuthPage({
  mode,
  onAuthSuccess,
  onSwitch,
}: {
  mode: 'login' | 'register';
  onAuthSuccess: () => void;
  onSwitch: () => void;
}) {
  const isLogin = mode === 'login';

  return (
    <main className="auth-page auth-page-clean">
      <section className="auth-panel" aria-labelledby="auth-title">
        <p className="eyebrow">{isLogin ? '登录' : '注册'}</p>
        <h1 id="auth-title">{isLogin ? '登录' : '注册'}</h1>

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
          <button className="auth-submit-button" type="button" onClick={onAuthSuccess}>
            {isLogin ? '登录' : '注册'}
          </button>
        </form>

        <div className="auth-links">
          {isLogin ? <button type="button">忘记密码</button> : null}
          <button type="button" onClick={onSwitch}>
            {isLogin ? '还没有账号？去注册' : '已有账号？去登录'}
          </button>
        </div>
      </section>
    </main>
  );
}

function SectionTitle({
  icon,
  eyebrow,
  title,
  level = 'h2',
}: {
  icon: IconName;
  eyebrow: string;
  title: string;
  level?: 'h2' | 'h3';
}) {
  const Heading = level;

  return (
    <div className="report-title-row">
      <IconMark name={icon} />
      <div>
        <p className="panel-kicker">{eyebrow}</p>
        <Heading>{title}</Heading>
      </div>
    </div>
  );
}

function RadarChart({ scores }: { scores: Record<ScoreName, number> }) {
  const center = 96;
  const maxRadius = 62;
  const labelRadius = 82;
  const scoreEntries = scoreNames.map((name) => ({ name, score: scores[name] }));
  const strongest = scoreEntries.reduce((best, item) => (item.score > best.score ? item : best), scoreEntries[0]);
  const weakest = scoreEntries.reduce((lowest, item) => (item.score < lowest.score ? item : lowest), scoreEntries[0]);
  const axisPoints = scoreNames.map((name, index) => {
    const angle = (Math.PI * 2 * index) / scoreNames.length - Math.PI / 2;
    const outerX = center + Math.cos(angle) * maxRadius;
    const outerY = center + Math.sin(angle) * maxRadius;
    const labelX = center + Math.cos(angle) * labelRadius;
    const labelY = center + Math.sin(angle) * labelRadius;
    const scoreRadius = (scores[name] / 100) * maxRadius;
    const scoreX = center + Math.cos(angle) * scoreRadius;
    const scoreY = center + Math.sin(angle) * scoreRadius;

    return { name, outerX, outerY, labelX, labelY, scoreX, scoreY };
  });
  const polygonPoints = axisPoints.map((point) => `${point.scoreX},${point.scoreY}`).join(' ');
  const gridLevels = [1, 0.66, 0.33];

  return (
    <div className="radar-summary" aria-label="五项维度概览">
      <div className="radar-visual" aria-hidden="true">
        <svg viewBox="0 0 192 192" role="img">
          {gridLevels.map((level) => (
            <polygon
              className={`radar-grid ${level === 1 ? 'radar-grid-outer' : 'radar-grid-middle'}`}
              key={level}
              points={scoreNames
                .map((_, index) => {
                  const angle = (Math.PI * 2 * index) / scoreNames.length - Math.PI / 2;
                  return `${center + Math.cos(angle) * maxRadius * level},${center + Math.sin(angle) * maxRadius * level}`;
                })
                .join(' ')}
            />
          ))}
          {axisPoints.map((point) => (
            <line className="radar-axis" key={point.name} x1={center} y1={center} x2={point.outerX} y2={point.outerY} />
          ))}
          <polygon className="radar-value" points={polygonPoints} />
          {axisPoints.map((point) => (
            <circle className="radar-dot" key={`${point.name}-dot`} cx={point.scoreX} cy={point.scoreY} r="3.2" />
          ))}
          <circle className="radar-center-dot" cx={center} cy={center} r="2" />
          {axisPoints.map((point) => (
            <text className="radar-axis-label" key={`${point.name}-label`} x={point.labelX} y={point.labelY + 4} textAnchor="middle">
              {point.name}
            </text>
          ))}
        </svg>
      </div>
      <div className="radar-legend-list">
        {scoreEntries.map((item) => {
          const status = item.name === strongest.name ? '优势项' : item.name === weakest.name ? '待优化' : '';

          return (
            <div className="radar-legend-row" key={item.name}>
              <div className="radar-legend-meta">
                <span>{item.name}</span>
                <strong>{item.score}</strong>
              </div>
              {status ? <em className={status === '优势项' ? 'is-strong' : 'is-weak'}>{status}</em> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function useResponsiveDisclosure(priority = false) {
  const getIsCompact = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 760px)').matches;
  const [isCompact, setIsCompact] = useState(getIsCompact);
  const [isOpen, setIsOpen] = useState(() => !getIsCompact() || priority);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia('(max-width: 760px)');
    const handleChange = () => setIsCompact(mediaQuery.matches);
    mediaQuery.addEventListener?.('change', handleChange);
    return () => mediaQuery.removeEventListener?.('change', handleChange);
  }, []);

  useEffect(() => {
    setIsOpen(!isCompact || priority);
  }, [isCompact, priority]);

  return [isOpen, setIsOpen] as const;
}

function DiagnosticCard({
  icon,
  title,
  score,
  reason,
  text,
  priority = false,
}: {
  icon: IconName;
  title: string;
  score: number;
  reason?: string;
  text: string;
  priority?: boolean;
}) {
  const parts = parseDiagnosticText(text);
  const [isOpen, setIsOpen] = useResponsiveDisclosure(priority);

  return (
    <details className={`diagnostic-card ${priority ? 'is-priority' : ''}`} open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary className="diagnostic-card-head">
        <SectionTitle icon={icon} eyebrow={priority ? '优先处理' : '诊断模块'} title={title} level="h3" />
        <strong>{score}</strong>
      </summary>
      <dl className="diagnostic-card-content">
        {reason ? (
          <div className="diagnostic-score-reason">
            <dt>评分依据</dt>
            <dd>{reason}</dd>
          </div>
        ) : null}
        <div>
          <dt>结论</dt>
          <dd>{parts.conclusion}</dd>
        </div>
        <div>
          <dt>原因</dt>
          <dd>{parts.explanation}</dd>
        </div>
        <div>
          <dt>本维度建议</dt>
          <dd>{parts.action}</dd>
        </div>
      </dl>
    </details>
  );
}

function PostAdviceCard({ index, title, item, priority = false }: { index: string; title: string; item: PostProcessingAdviceItem; priority?: boolean }) {
  const [isOpen, setIsOpen] = useResponsiveDisclosure(priority);

  return (
    <details className="post-advice-card" open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary className="post-advice-summary">
        <span className="post-advice-index">{index}</span>
        <h3>{title}</h3>
      </summary>
      <div className="post-advice-content">
        <div className="advice-meta-row">
          <span>建议</span>
          <p>{item.suggestion}</p>
        </div>
        <div className="advice-meta-row">
          <span>理由</span>
          <p>{item.reason}</p>
        </div>
        <div className="advice-meta-row">
          <span>预期效果</span>
          <p>{item.expectedEffect}</p>
        </div>
      </div>
    </details>
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

export default App;
