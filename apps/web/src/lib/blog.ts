export interface BlogSection {
  heading?: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface BlogPost {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  readTime: string;
  date: string;
  image: string;
  featured?: boolean;
  content: BlogSection[];
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'plan-fire-training-tower',
    category: '训练设施',
    title: '如何规划一座实战火场训练塔：从目标到落地的完整指南',
    excerpt:
      '训练塔的规划远不止“盖一栋楼”。本文从训练目标拆解、场地评估、塔型选型到预算与分期建设，系统梳理从构想到落地的关键决策。',
    readTime: '8 分钟',
    date: '近期',
    image: 'images/202101/29e0925cf89.jpg',
    featured: true,
    content: [
      {
        paragraphs: [
          '“我们该如何起步？”这是规划训练设施时最常被问到的问题。一座训练塔的价值，不在于它有多高、多大，而在于它能否支撑起你真正需要的训练科目，并在未来数十年里持续可用。',
          '在动工之前，把目标、场地、预算与未来扩展想清楚，往往比施工本身更重要。',
        ],
      },
      {
        heading: '第一步：从训练目标出发',
        paragraphs: [
          '先明确队伍要练什么：是基础的登梯与破拆，还是高层灭火、绳索救援、CFBT 实火训练，或是战术突入与危化品处置？不同科目对楼层、燃烧室、道具接口的要求差异很大。',
          '把高频、核心的科目列为“必须满足”，把偶发或进阶的科目列为“未来扩展”，这会直接决定塔型的基本盘。',
        ],
      },
      {
        heading: '第二步：评估场地与通行',
        paragraphs: [
          '场地条件决定了塔的占地、朝向与基础方案。除了建筑本身，还要预留消防车、云梯车的通行与展开空间，以及受训人员的集结与观摩区域。',
        ],
        bullets: [
          '可用占地面积与净空高度',
          '车辆通行与登高作业空间',
          '给排水、供电与烟气排放条件',
          '与周边建筑、居民区的安全距离',
        ],
      },
      {
        heading: '第三步：选型与分期',
        paragraphs: [
          '预设塔型能让项目更快落地，定制塔型则完全贴合独特需求；模块化系统则适合预算分期、逐步成长的场景。无论哪种路线，都建议预留后期加建的可能，让训练能力随队伍一起成长。',
          '把这些决策交给既懂消防、又懂工程的团队，能帮你在预算之内做出最优权衡。',
        ],
      },
    ],
  },
  {
    slug: 'interlock-liner-durability',
    category: '燃烧室技术',
    title: '互锁隔热衬里，为什么更耐用也更省心',
    excerpt: '解读钙硅基互锁衬里的隔热原理、可维护性优势，以及它如何保护燃烧室主体结构。',
    readTime: '6 分钟',
    date: '近期',
    image: '/media/burn-room.webp',
    content: [
      {
        paragraphs: [
          '燃烧室是训练塔里最“受苦”的部分——日复一日承受高温、水枪冲击与快速升降温循环。衬里选得好不好，直接决定燃烧室的安全、寿命与维护成本。',
        ],
      },
      {
        heading: '隔热原理：把热量挡在结构之外',
        paragraphs: [
          '互锁式钙硅基衬里以高硬度表面结合工厂级防水处理，隔热效果极佳。板与结构之间形成隔热气腔，在内部燃烧时能有效降低结构钢的背温，保护主体结构不受损伤。',
        ],
      },
      {
        heading: '可维护性：单块可拆换',
        paragraphs: [
          '传统衬里一旦损坏，往往需要大面积凿除、长时间停训。互锁衬里则允许单块独立拆换，板间预留热膨胀缝，检修更快、停训时间更短。',
          '对于长期高频使用的训练基地来说，这种“可局部维修”的特性，往往比初始价格更能决定全生命周期成本。',
        ],
      },
    ],
  },
  {
    slug: 'modular-scalability',
    category: '模块化系统',
    title: '模块化训练系统的“可成长性”',
    excerpt: '如何用一套模块化系统，随预算与需求分期搭出完整的训练基地。',
    readTime: '5 分钟',
    date: '近期',
    image: '/media/modular-hero.jpg',
    content: [
      {
        paragraphs: [
          '并不是每个单位都能一次性建成理想中的综合训练基地。模块化系统的最大价值，正在于它的“可成长性”——先以核心模块起步，再随需求与预算逐步扩展。',
        ],
      },
      {
        heading: '从一个模块开始',
        paragraphs: [
          '全镀锌钢结构框架无需内部承重墙，墙体、门窗都可自由移动重组。这让你能先满足最迫切的基础训练，之后再叠加楼层、燃烧室与专项道具。',
        ],
      },
      {
        heading: '分期建设的现实意义',
        paragraphs: [
          '分期不仅缓解预算压力，也让训练能力与队伍一起成长：第一期打基础，第二期上高层与火场，第三期接入危化品或战术场景——全程无需推倒重建，投资持续增值。',
        ],
      },
    ],
  },
  {
    slug: 'hazmat-realistic-training',
    category: '训练实践',
    title: '危化品训练场景如何更贴近实战',
    excerpt: '结合教官系列道具与移动拖车，构建真实而安全的危化品训练环境。',
    readTime: '7 分钟',
    date: '近期',
    image: '/media/hazmat-trailer.webp',
    content: [
      {
        paragraphs: [
          '危化品事故处置容不得半点失误。要练出过硬本领，训练场景就必须尽可能贴近真实——可控的泄漏、真实的反应、临场的不确定性，缺一不可。',
        ],
      },
      {
        heading: '用可控道具复刻真实危害',
        paragraphs: [
          '氯气瓶、泄漏桶、反应桶、坠落气瓶等教官系列道具，能在安全可控的前提下复刻阀门泄漏、桶体反应、失控释放等典型场景，让处置人员反复演练定位、堵漏与关阀。',
        ],
      },
      {
        heading: '移动拖车：把训练场送到队伍身边',
        paragraphs: [
          '对于需要跨区域、跨单位组织训练的机构，移动训练拖车可将整套危化品场景灵活转场，让不同地点的队伍都能在统一、真实的环境中演练，也更利于降低单位成本。',
        ],
      },
    ],
  },
  {
    slug: 'steel-vs-masonry-tower',
    category: '行业洞察',
    title: '钢结构训练塔 vs 砌体训练塔',
    excerpt: '对比两类训练塔在耐用性、安全性与全生命周期成本上的差异。',
    readTime: '6 分钟',
    date: '近期',
    image: 'images/202101/5a18f6f4749.jpg',
    content: [
      {
        paragraphs: [
          '训练塔要长期承受反复的热-冷循环与机械冲击。选钢结构还是砌体/混凝土，会显著影响它的寿命与维护方式。',
        ],
      },
      {
        heading: '热循环下的表现',
        paragraphs: [
          '金属结构的热胀冷缩更均匀，在反复高温下更稳定；混凝土因钢筋与水泥膨胀速率不同，容易开裂，一旦开裂修复往往昂贵甚至难以实施。',
        ],
      },
      {
        heading: '维护与成本',
        paragraphs: [
          '热浸镀锌钢结构维护成本低，受损板件可拆换；砌体结构则需要持续的防水与结构评估。综合全生命周期来看，钢结构训练塔通常更具经济性。',
        ],
      },
    ],
  },
  {
    slug: 'tower-annual-inspection',
    category: '训练设施',
    title: '训练塔年检：你需要知道的关键点',
    excerpt: '为什么定期检测对训练设施的安全与寿命至关重要，检查哪些关键部位。',
    readTime: '5 分钟',
    date: '近期',
    image: 'images/202605/041a07c4595.jpg',
    content: [
      {
        paragraphs: [
          '训练设施承受着反复的高温与机械荷载。定期检测能在隐患扩大成大问题之前，及时发现并处理，既保障安全，也延长设施寿命。',
        ],
      },
      {
        heading: '检查哪些关键部位',
        paragraphs: ['一次完整的检测通常覆盖结构主体到隔热衬里的全部关键部位：'],
        bullets: [
          '门体、窗户与五金',
          '墙体、屋面与结构件',
          '楼梯、护栏与爬梯',
          '燃烧室紧固件与隔热衬里表面',
        ],
      },
      {
        heading: '留下可追溯的记录',
        paragraphs: [
          '检测应出具图文并茂的报告，逐项列出发现的缺陷并给出维护建议。这不仅指导维修，也为设施的合规使用与管理提供依据。参照 NFPA 1400 等标准与工程经验，建议由专业人员定期评估并形成书面记录。',
        ],
      },
    ],
  },
  {
    slug: 'modular-vs-containers',
    category: '行业洞察',
    title: '模块化系统为什么优于集装箱改造',
    excerpt: '从材料、屋顶载荷、地板到涂装工艺，全面拆解两种方案的本质差异。',
    readTime: '7 分钟',
    date: '近期',
    image: '/media/modular-construction.jpg',
    content: [
      {
        paragraphs: [
          '集装箱最初为货运而生，并非为实战火场训练设计。用作训练设施时，往往面临锈蚀、载荷不足、改造困难等问题。',
        ],
      },
      {
        heading: '材料与工艺',
        paragraphs: [
          '模块化系统采用全新原材料与全镀锌钢框架，工厂烤漆长效稳定；翻新集装箱则多为旧漆二次涂装，需定期重涂，且品质参差。',
        ],
      },
      {
        heading: '结构与使用',
        paragraphs: [
          '模块化系统按训练载荷设计屋顶与地板，墙门窗不承担结构、可自由重组；集装箱屋顶非按载荷设计，改造需切割补漆，灵活性与寿命都受限。',
          '长期来看，专为训练而生的模块化系统，在寿命与全生命周期成本上更具优势。',
        ],
      },
    ],
  },
  {
    slug: 'maritime-training',
    category: '训练实践',
    title: '海事训练：把船舶火场搬上陆地',
    excerpt: '驾驶台、机舱、舱口与船门如何还原真实的水上与船舶火场。',
    readTime: '6 分钟',
    date: '近期',
    image: 'images/202605/041a07c4595.jpg',
    content: [
      {
        paragraphs: [
          '船舶火灾与房屋、建筑火灾截然不同——消防员往往从最高温处切入、向下深入火场。这种“逆向推进”的作业逻辑，只有在贴近真实的船体结构中反复演练，才能形成肌肉记忆。',
        ],
      },
      {
        heading: '还原真实的船体结构',
        paragraphs: [
          '以真实船舶为蓝本，将驾驶台、机舱、货舱、船门与舷梯集成于一体，训练狭窄空间的登船、垂直转移与舱室推进。',
        ],
      },
      {
        heading: '谁需要海事训练',
        paragraphs: [
          '港口与码头消防、海事与救助打捞、船厂与航运企业、海警与海上执法，乃至海上油气平台，都需要在下水之前，就在陆地上练就过硬本领。',
        ],
      },
    ],
  },
  {
    slug: 'burn-room-temperature',
    category: '燃烧室技术',
    title: '燃烧室温度控制与热成像训练',
    excerpt: '如何通过温度监测与合理布局，兼顾训练真实度与衬里寿命。',
    readTime: '5 分钟',
    date: '近期',
    image: '/media/burn-room.webp',
    content: [
      {
        paragraphs: [
          '燃烧室训练既要“够真”，又要“可控”。温度管理，正是平衡训练真实度与设施寿命的关键。',
        ],
      },
      {
        heading: '布置温度监测',
        paragraphs: [
          '在天花与工作面布置测温点，既能控制训练温度、保障人员安全，也有助于及时掌握热负荷，延长衬里的使用寿命。',
        ],
      },
      {
        heading: '配合热成像训练',
        paragraphs: [
          '优质衬里具备逼真的“干墙”外观，并能与热成像相机良好配合，让受训人员在贴近实战的观感中练习火场判读与搜索。',
        ],
      },
    ],
  },
];

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}

export function getAllBlogSlugs(): string[] {
  return blogPosts.map((p) => p.slug);
}
