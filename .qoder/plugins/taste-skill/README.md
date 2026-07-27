# Taste Skill (Qoder Plugin)

反 AI 模板味（anti-slop）的前端设计品味 Skill 集，转换自开源仓库
[Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill)（MIT License）。

## 包含的 Skills

| Skill | 来源 | 适用场景 |
|-------|------|----------|
| `design-taste-frontend`（v2） | `skills/taste-skill/SKILL.md` | Landing / Portfolio / Redesign。含 Brief 推断、三档旋钮（VARIANCE/MOTION/DENSITY）、redesign-audit 协议、pre-flight 检查 |
| `minimalist-ui` | `skills/minimalist-skill/SKILL.md` | 产品型 UI（Notion/Linear 风格），克制配色、编辑感排版、扁平 bento 结构。**B 端后台优先使用此变体** |

> 注意：`design-taste-frontend` v2 自我声明"Not dashboards, not data tables"，
> 用于后台系统时应以 `minimalist-ui` 为主，仅借用 v2 的 redesign-audit 与反默认纪律。

## 来源与转换说明

- 源仓库：https://github.com/Leonxlnx/taste-skill （main 分支，2026-07 抓取）
- 两个 skill 目录在源仓库中均只含单个 `SKILL.md`，无 references/scripts 支持文件，无遗漏项
- 未包含源仓库其余变体（gpt-taste、redesign、soft、brutalist、image-gen 等），按需可再转换
- 无 logo 资产（源仓库无独立 logo 文件）

## 安装

项目级：本插件位于 `.qoder/plugins/taste-skill/`，可直接由 Qoder 发现，
或通过 `qodercli plugin install <本目录>` 安装到全局。

## 验证

- `plugin.json` 通过 `python3 -m json.tool` 校验
- 两个 SKILL.md frontmatter 均含 `name` 与 `description`
