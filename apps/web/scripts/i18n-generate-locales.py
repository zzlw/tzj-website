#!/usr/bin/env python3
"""Generate en/zh-TW page JSON and shared locale modules from zh-CN sources."""
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ZH = ROOT / "src/messages/zh-CN"
OUT_EN = ROOT / "src/messages/en"
OUT_TW = ROOT / "src/messages/zh-TW"

# Simplified → Traditional (common chars in this project)
S2T = str.maketrans(
    "国专业训练与实火燃烧专项场景器械覆盖消防公安部队矿山院校景区企业园区解决方案产品中心资源采购设计检测知识常见问题解答质保服务博客媒体报道展会活动年检如何买塔型发展历程核心团队资质认证全球业务为什么选择模块化固定定制标准攀登楼互锁隔热衬里危化品海事战术竞赛体能抗眩晕心理拓展绳索救援山岳专项科普教育馆工程案例隐私政策服务条款首页预约咨询下载产品规格延伸了解相关内容了解更多加载中出现了一些问题页面加载时发生错误请稍后重试如问题持续请联系我们的技术支持重试返回首页系统错误应用遇到了严重错误请刷新页面刷新页面",
    "國專業訓練與實火燃燒專項場景器械覆蓋消防公安部隊礦山院校景區企業園區解決方案產品中心資源採購設計檢測知識常見問題解答質保服務博客媒體報導展會活動年檢如何買塔型發展歷程核心團隊資質認證全球業務為什麼選擇模組化固定定制標準攀登樓互鎖隔熱襯裡危化品海事戰術競賽體能抗眩暈心理拓展繩索救援山岳專項科普教育館工程案例隱私政策服務條款首頁預約諮詢下載產品規格延伸了解相關內容了解更多載入中出現了一些問題頁面載入時發生錯誤請稍後重試如問題持續請聯繫我們的技術支持重試返回首頁系統錯誤應用遇到了嚴重錯誤請刷新頁面刷新頁面",
)


def to_traditional(obj):
    if isinstance(obj, str):
        return obj.translate(S2T)
    if isinstance(obj, list):
        return [to_traditional(x) for x in obj]
    if isinstance(obj, dict):
        return {k: to_traditional(v) for k, v in obj.items()}
    return obj


def translate_en_text(text: str) -> str:
    """Minimal EN translation for common UI; longer content uses placeholder prefix for review."""
    if not text or not re.search(r"[\u4e00-\u9fff]", text):
        return text
    # Keep already-translated short labels via lookup
    SHORT = {
        "首页": "Home",
        "预约咨询": "Book a Consultation",
        "了解更多": "Learn More",
        "延伸了解": "Explore More",
        "相关内容": "Related",
        "下载产品规格 PDF": "Download Product Specs (PDF)",
        "查看方案": "View Solution",
        "查看详情": "View Details",
        "客户：": "Client: ",
        "工程案例": "Project Portfolio",
        "资源中心": "Resource Center",
        "产品中心": "Products",
        "解决方案": "Solutions",
        "隐私政策": "Privacy Policy",
        "服务条款": "Terms of Service",
        "常见问题": "FAQs",
        "没有找到答案？": "Can't find an answer?",
        "还有疑问？": "Still have questions?",
        "固定训练塔": "Fixed Training Tower",
        "模块化训练塔": "Modular Training Tower",
        "燃烧室": "Burn Room",
        "训练配件与道具": "Training Props & Accessories",
    }
    if text in SHORT:
        return SHORT[text]
    # For long Chinese paragraphs, mark as needing translation but provide readable EN stub
    return f"[EN] {text}"


def translate_en(obj):
    if isinstance(obj, str):
        return translate_en_text(obj)
    if isinstance(obj, list):
        return [translate_en(x) for x in obj]
    if isinstance(obj, dict):
        return {k: translate_en(v) for k, v in obj.items()}
    return obj


def copy_shared_modules():
    OUT_EN.mkdir(parents=True, exist_ok=True)
    OUT_TW.mkdir(parents=True, exist_ok=True)
    for name in ["home", "blocks", "content", "catalog", "error"]:
        src = ZH / f"{name}.json"
        if not src.exists():
            continue
        data = json.loads(src.read_text(encoding="utf-8"))
        (OUT_EN / f"{name}.json").write_text(
            json.dumps(translate_en(data), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        (OUT_TW / f"{name}.json").write_text(
            json.dumps(to_traditional(data), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"Shared module: {name}")


def copy_pages():
    src_dir = ZH / "pages"
    for src in sorted(src_dir.glob("*.json")):
        data = json.loads(src.read_text(encoding="utf-8"))
        (OUT_EN / "pages").mkdir(parents=True, exist_ok=True)
        (OUT_TW / "pages").mkdir(parents=True, exist_ok=True)
        (OUT_EN / "pages" / src.name).write_text(
            json.dumps(translate_en(data), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        (OUT_TW / "pages" / src.name).write_text(
            json.dumps(to_traditional(data), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    print(f"Pages: {len(list(src_dir.glob('*.json')))} × 2 locales")


def write_solutions():
    solutions_zh = {
        "solutions": {
            "fire-rescue": {
                "name": "消防救援",
                "tagline": "面向消防救援总队、支队与训练基地的一体化实战训练解决方案。",
                "intro": [
                    "消防救援队伍的训练科目最为综合——从高层灭火、内攻搜救到 CFBT 实火与危化品处置，几乎覆盖全部灾害场景。训练设施必须既能承受长期高频、高温使用，又能灵活支撑多样化科目。",
                    "拓之迹以交钥匙方式，为消防救援机构打造从固定训练塔、燃烧室到专项场景的综合训练基地，参照 NFPA 及国内相关 GB 标准设计，兼顾实战真实度与长期耐用性。",
                ],
                "focus": [
                    {"title": "实火训练能力", "desc": "互锁隔热衬里燃烧室与 CFBT 设施，支持可控、可重复的高温实火训练。"},
                    {"title": "高层与内攻", "desc": "多层训练塔还原高层建筑，支撑登高、内攻搜救与逃生自救科目。"},
                    {"title": "危化品处置", "desc": "教官系列道具与移动拖车，复刻泄漏、堵漏与洗消场景。"},
                    {"title": "长期可用", "desc": "全镀锌钢结构 + 年检维保，守护设施数十年安全服役。"},
                ],
                "recommended": [
                    {"label": "固定训练塔（钢结构）", "desc": "多层实战火场主体，抗高温、抗风荷载。"},
                    {"label": "燃烧室与互锁衬里", "desc": "安全真实的实火训练核心。"},
                    {"label": "CFBT 烟火特性训练设施", "desc": "训练火行为判读与轰燃预警。"},
                    {"label": "危化品训练", "desc": "泄漏、堵漏、洗消全流程演练。"},
                ],
                "programs": [
                    "高层建筑灭火与内攻搜救", "CFBT 火行为判读与轰燃预警", "浓烟环境搜索与逃生自救",
                    "危化品泄漏堵漏与洗消", "绳索救援与高空转移", "破拆与强行进入",
                ],
            },
            "police": {
                "name": "公安武警",
                "tagline": "面向公安特警、武警部队的攀登与战术实战化训练解决方案。",
                "intro": [
                    "公安武警的训练强调攀登、突入与战术协同。攀登楼与可重组的战术场景，是锤炼快速机动与实战处突能力的关键设施。",
                    "拓之迹为公安、特警与武警单位定制攀登楼与战术训练设施，将真实战术场景融入结构设计，支持破门突入、楼宇机动与绳索下降等多科目演练。",
                ],
                "focus": [
                    {"title": "攀登楼主体", "desc": "多层攀登楼还原真实楼宇，支撑徒手攀登、索降与窗口突入。"},
                    {"title": "战术场景", "desc": "破门口、绳索锚点等可重组道具，贴合 CQB 与处突战术。"},
                    {"title": "定制布局", "desc": "按单位战术需求定制平面与场景，融入实战流程。"},
                    {"title": "协同演练", "desc": "多层多点位设计，支持编队协同与指挥调度训练。"},
                ],
                "recommended": [
                    {"label": "公安武警攀登楼", "desc": "攀登、索降、突入一体化主体。"},
                    {"label": "战术训练", "desc": "破门突入与 CQB 可重组场景。"},
                    {"label": "定制训练塔", "desc": "按战术流程量身定制布局。"},
                    {"label": "体能抗眩晕训练器械", "desc": "强化体能与前庭抗眩晕能力。"},
                ],
                "programs": [
                    "徒手攀登与快速登楼", "绳索索降与高空转移", "破门突入与室内 CQB",
                    "窗口突入与楼宇机动", "编队协同与指挥调度", "体能与前庭抗眩晕训练",
                ],
            },
            "military": {
                "name": "部队",
                "tagline": "面向部队与应急力量的综合体能、战术与救援训练解决方案。",
                "intro": [
                    "部队训练强调体能、意志与协同作战。综合训练设施需要在一处场地内，同时支撑攀爬、越障、心理拓展与专项救援等多类科目。",
                    "拓之迹为部队与应急力量提供可组合的训练塔、心理拓展与体能器械设施，帮助在有限场地内构建高强度、多科目的综合训练场。",
                ],
                "focus": [
                    {"title": "体能与越障", "desc": "攀爬、越障与体能器械，锤炼力量、耐力与协调。"},
                    {"title": "心理拓展", "desc": "高空断桥、云梯等心理拓展科目，磨炼意志与胆识。"},
                    {"title": "绳索与救援", "desc": "山岳绳索与高空转移，支撑复杂地形救援训练。"},
                    {"title": "模块可扩展", "desc": "模块化系统按预算分期扩建，训练能力随队伍成长。"},
                ],
                "recommended": [
                    {"label": "固定训练塔（钢结构）", "desc": "多层攀爬与综合训练主体。"},
                    {"label": "心理拓展训练", "desc": "高空拓展磨炼意志与胆识。"},
                    {"label": "山岳绳索救援训练", "desc": "复杂地形绳索与高空转移。"},
                    {"label": "体能抗眩晕训练器械", "desc": "体能与前庭抗眩晕强化。"},
                ],
                "programs": [
                    "攀爬越障与体能强化", "高空断桥与心理拓展", "山岳绳索与高空转移",
                    "前庭抗眩晕训练", "编队协同作战演练", "综合救援实战化训练",
                ],
            },
            "mine-rescue": {
                "name": "矿山救援",
                "tagline": "面向矿山与工贸救援队的地下空间与高危环境训练解决方案。",
                "intro": [
                    "矿山救援面对巷道、竖井与受限空间等高危环境，训练必须尽可能贴近真实，才能锤炼复杂条件下的搜索与救援能力。",
                    "拓之迹为矿山与工贸救援队伍模拟地下巷道、竖井与受限空间场景，结合烟雾与热环境系统，构建安全可控的高危救援训练场。",
                ],
                "focus": [
                    {"title": "地下空间模拟", "desc": "巷道、竖井与受限空间还原，训练狭窄环境搜索救援。"},
                    {"title": "烟热环境", "desc": "烟雾发生与热环境系统，模拟复杂能见度与高温条件。"},
                    {"title": "垂直救援", "desc": "竖井与高差场景，支撑绳索与担架垂直转移训练。"},
                    {"title": "耐腐蚀结构", "desc": "耐高腐蚀镀锌钢结构，适应潮湿高腐蚀训练环境。"},
                ],
                "recommended": [
                    {"label": "模块化训练塔", "desc": "灵活模拟地下与受限空间场景。"},
                    {"label": "山岳绳索救援训练", "desc": "竖井与高差垂直救援。"},
                    {"label": "燃烧室与互锁衬里", "desc": "烟热环境下的搜索与自救。"},
                    {"label": "危化品训练", "desc": "有毒有害气体环境处置。"},
                ],
                "programs": [
                    "巷道与受限空间搜索救援", "竖井垂直救援与转移", "浓烟环境搜索与自救",
                    "有毒有害气体环境处置", "担架转运与伤员救护", "自救器与呼吸保护训练",
                ],
            },
            "education": {
                "name": "院校教育",
                "tagline": "面向高校、职院与培训机构的教学实训与科普教育解决方案。",
                "intro": [
                    "院校强调教学友好、多专业共用与安全可控。训练设施既要满足消防、安全工程等专业的实训需求，也常兼顾科普教育与公众体验功能。",
                    "拓之迹为院校与培训机构提供教学友好型训练塔、低强度燃烧室与科普教育馆方案，配套完整图纸，在预算内快速落地标准化实训基地。",
                ],
                "focus": [
                    {"title": "教学友好", "desc": "低强度燃烧室与开放平台，适合分组教学与反复实训。"},
                    {"title": "科普教育馆", "desc": "沉浸式消防科普体验，服务学生与公众安全教育。"},
                    {"title": "多专业共用", "desc": "开放式平台，供消防、安全工程等多专业共享使用。"},
                    {"title": "预算内落地", "desc": "标准塔型 + 完整图纸，快速在预算内建成。"},
                ],
                "recommended": [
                    {"label": "科普教育馆", "desc": "沉浸式消防安全科普体验空间。"},
                    {"label": "标准塔型系列", "desc": "预设布局，教学实训快速落地。"},
                    {"label": "模块化训练塔", "desc": "灵活开放，多专业共用。"},
                    {"label": "消防模拟训练设施", "desc": "安全可控的模拟教学设施。"},
                ],
                "programs": [
                    "消防与安全工程专业实训", "灭火器材与器材操作教学", "疏散逃生与自救演练",
                    "科普体验与公众安全教育", "应急预案与桌面推演", "职业技能竞赛集训",
                ],
            },
            "enterprise": {
                "name": "企业与园区",
                "tagline": "面向企业、化工园区与专职消防队的应急能力建设解决方案。",
                "intro": [
                    "企业与园区（尤其石化、能源、制造）需要具备与自身风险相匹配的应急处置能力。训练设施应贴合本单位的工艺风险与应急预案。",
                    "拓之迹为企业专职消防队与园区应急力量定制训练设施，结合危化品、消防模拟与实火训练场景，帮助建立可持续演练的应急能力体系。",
                ],
                "focus": [
                    {"title": "工艺风险贴合", "desc": "按园区工艺与介质风险，定制危化品处置训练场景。"},
                    {"title": "实火与模拟", "desc": "实火燃烧与模拟设施结合，兼顾真实度与运行成本。"},
                    {"title": "竞赛与练兵", "desc": "竞赛类训练设施，激励专职队常态化练兵。"},
                    {"title": "预案演练", "desc": "贴合企业应急预案，支撑常态化实战演练。"},
                ],
                "recommended": [
                    {"label": "危化品训练", "desc": "泄漏、堵漏、洗消实战演练。"},
                    {"label": "消防模拟训练设施", "desc": "低成本、可重复的模拟训练。"},
                    {"label": "竞赛类训练设施", "desc": "激励专职队常态化练兵。"},
                    {"label": "模块化训练塔", "desc": "灵活落地，分期扩建。"},
                ],
                "programs": [
                    "危化品泄漏与堵漏处置", "初期火灾扑救与器材操作", "工艺装置火灾模拟处置",
                    "应急预案实战化演练", "专职队竞赛与练兵", "员工消防安全培训",
                ],
            },
        }
    }
    for locale, transform, out in [
        ("zh-CN", lambda x: x, ZH / "solutions.json"),
        ("en", translate_en, OUT_EN / "solutions.json"),
        ("zh-TW", to_traditional, OUT_TW / "solutions.json"),
    ]:
        out.write_text(json.dumps(transform(solutions_zh), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("solutions.json × 3 locales")


def write_solution_detail_page():
    data = {
        "meta": {"titleSuffix": "训练解决方案"},
        "hero": {"eyebrowPrefix": "解决方案 · "},
        "intro": {"eyebrow": "需求洞察", "titleSuffix": "需要怎样的训练设施"},
        "focus": {"eyebrow": "关注重点", "title": "我们如何贴合您的任务"},
        "recommended": {
            "eyebrow": "推荐配置",
            "title": "为您推荐的训练设施组合",
            "description": "以下产品可组合成贴合您需求的整体训练方案，也可按场地与预算分期建设。",
        },
        "programs": {"eyebrow": "典型科目", "title": "可支撑的训练科目", "caseLink": "查看相关工程案例"},
        "others": {"title": "其他客户解决方案"},
        "cta": {
            "titlePrefix": "为",
            "titleSuffix": "定制专属训练方案",
            "description": "告诉我们您的场地、科目与预算，我们的工程师与消防专家团队将为您量身设计整体方案。",
            "backLink": "返回全部解决方案",
        },
    }
    for out in [ZH / "pages/solution-detail.json", OUT_EN / "pages/solution-detail.json", OUT_TW / "pages/solution-detail.json"]:
        out.parent.mkdir(parents=True, exist_ok=True)
        transformed = translate_en(data) if "en/" in str(out) else to_traditional(data) if "zh-TW/" in str(out) else data
        out.write_text(json.dumps(transformed, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    copy_shared_modules()
    copy_pages()
    write_solutions()
    write_solution_detail_page()
    print("Locale generation complete.")


if __name__ == "__main__":
    main()
