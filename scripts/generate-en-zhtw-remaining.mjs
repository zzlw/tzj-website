#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT = 'apps/web/src/messages';
const ids = [
  'accessories-maritime', 'accessories-tactical', 'accessories-competition',
  'accessories-fitness-equipment', 'fixed-tower-series', 'resources-design-center',
  'resources-faqs', 'resources-how-to-buy', 'resources-inspections', 'resources-warranty',
];

// Simplified → Traditional (common chars for this domain)
const ST = String.raw;
const MAP = Object.fromEntries(
  `训练设施驾驶舱门与为这从到将让队伍在就还能以真实船舶蓝本集成一体练就过硬本领
  场景道具更多典型配置适用单位谁在使用覆盖水上涉海救援各类构建统一实战环境
  港口码头消防海事救助打捞船厂航运企业海警海上执法油气平台航海院校
  定制方案告诉场地条件科目工程师专家团队设计贴合需求返回专项
  模块化灵活重组系统任务变化采用全镀锌钢结构框架无需内部承重墙
  带来了其他室内战术训练难以匹敌灵活性墙体窗都可以轻松移动拆除
  同一座今天是多房间居民楼明天重组开放式办公区仓储空间让小队持续面对新挑战
  不断提升适应能力按您的需求量身打造构想到落成顾问并肩打造最契合
  了解固定竞赛体能抗眩晕器械对标规程专业连接赛场把标准搬进
  职业技能检验提升能力重要抓手无缝衔接练即是赛尺寸节奏帮助备赛稳定发挥
  也可用于队内比武常态化激励提升实战能力核心特性六大能力项目
  百米障碍竞速爬梯挂钩梯登楼水带铺设连接负重搬运选拔
  力量耐力爆发力旋转翻滚前庭功能眩晕环境下稳定性平衡协调复杂动作身体控制
  心肺高强度长时间高负荷工业级材料工艺经受高频维护简便
  高空作业云梯登高旋转救援双重要求系统化关键时刻稳得住顶得上
  分级适配不同基础阶段维持赛前任务前强化集训科目
  心理拓展磨炼意志胆识浏览完整配件道具企业与园区解决方案专职队
  标准塔型系列高层报警综合预设布局加速项目进度任选起点轻松
  对标国际实战满足要求无论单位规模定制合适基础固定件组合最大化体验
  经久耐用为什么更实战火场意味着高温冲击常年反复结构连接防护环节长期严苛
  相较混凝土砌块金属反复热冷循环表现稳定整体建造维护成本显著更低受损构件局部拆换
  无需整体报废如何选择预设更快落地完全贴合独特两者皆享同样坚固交钥匙
  对比项支持不支持多种外立面配色自由定制布局速度按方案而定
  想要量身定制每一处尺寸门窗布局都可由您决定打造属于下载产品规格
  产品目录按系列浏览查看详情设计资料选型参考需要完整参数文件联系团队根据项目提供
  可获取每款哪些帮助设计院施工方高效对接技术规格结构材料配置
  立面平面图楼层便于规划清单可选配建模所需文件
  常见问题关于选型燃烧室模块化采购维护解答没有找到答案直接联系获取针对专业
  从这里开始我们该如何起步最常被问到无论新建基地升级既有都会清晰透明流程一步步推进落地
  建设涉及选址预算车辆通行等诸多决策成功往往离不开两点紧密协作使用方管理方设计方施工方
  目标一致协同推进清晰愿景围绕安全现代真实环境共同目标展开采购流程六步完成落地
  需求沟通顾问目标条件时间计划方案选型开展确定结构报价签约清晰交付确认合同
  深化完成施工图结构计算必要合规文件生产制造工厂预制部件全程质量管控安装验收
  现场调试培训验收交付后续支持机构量身配合政府采购公开招投标配合提供完整参数资质
  分期建设扩展交付后持续年检维护开始咨询联系获取建议报价一起把基地落到实处前往
  检测周期多久一次参照相关标准工程经验建议具备结构经验专业人员定期评估形成书面记录
  类燃烧建筑固定式实战燃气式模拟约每建议仅供参考实际频次应结合使用强度当地规定状况综合确定
  可检查金属砌块集装箱等多种检测项目检查哪些关键部位主体隔热不放过任何潜在隐患
  范围涵盖五大类别报告门窗五金目视铰链闭门器插销各类磨损功能状态外壳
  墙板屋面板位移情况通行生命安全可见踏步管道板材固定必要时选择性拆板后方
  填缝连接点抽检安装密封完整性出具图文并茂逐项列出发现缺陷给出维护建议
  为什么要年检定期价值保障安全承受反复机械荷载及时发现隐患降低风险及时局部更换
  显著延长使用寿命保护长期投资合规可溯依据记录做到有据可查预约年度制定计划
  每一次都安全无虞查看质保一体化一个电话责任到底制造安装均由一家完成
  不同供应商施工方之间不再相互推诿任何环节出现问题只需联系我们分项政策部件说明
  钢结构主体长期热浸镀锌针对结构件质量保证防腐镀锌层期内正常使用下性能
  隔热衬里材料工艺缺陷易损耗部分按使用情况评估功能性备件支持具体条款以合同约定为准
  期范围可能因产品与使用条件不同而有所差异售后持续易损件单独更换交付后技术支持
  使用维护培训定期始终可用从沟通完整流程产品疑问`
    .replace(/\s+/g, '')
    .match(/.{1,2}/g)
    ?.filter((_, i, a) => i % 2 === 0)
    .map((s, i, a) => [s, a[i + 1]])
    .filter(Boolean) ?? [],
);

function toTW(obj) {
  if (typeof obj === 'string') {
    return [...obj].map((c) => MAP[c] ?? c).join('');
  }
  if (Array.isArray(obj)) return obj.map(toTW);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = toTW(v);
    return out;
  }
  return obj;
}

// Load EN from companion file if exists, else skip
const EN_DIR = path.join('scripts', 'en-translations');
for (const id of ids) {
  const enPath = path.join(EN_DIR, `${id}.json`);
  if (fs.existsSync(enPath)) {
    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    fs.writeFileSync(path.join(ROOT, 'en/pages', `${id}.json`), JSON.stringify(en, null, 2) + '\n');
  }
  const zhCN = JSON.parse(fs.readFileSync(path.join(ROOT, 'zh-CN/pages', `${id}.json`), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'zh-TW/pages', `${id}.json`), JSON.stringify(toTW(zhCN), null, 2) + '\n');
}
console.log('zh-TW generated for', ids.length, 'pages');
