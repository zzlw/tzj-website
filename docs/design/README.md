# Design System

## 排版体系（流体标题，Rosenbauer 比例）

| 级别 | 大小（clamp） | 用途 |
|------|------|------|
| Eyebrow | 12px, 大写, 品牌红, letter-spacing 0.18em | Section 眉标（前缀红色横线） |
| Display | clamp(2.25rem, 3.17vw + 1.4rem, 4.5rem) | Hero 超大标题 |
| H1 | clamp(2rem, 3.17vw + 1.17rem, 4rem) | 页面标题 |
| H2 | clamp(1.63rem, 1.43vw + 1.25rem, 2.75rem) | Section 标题 |
| H3 | clamp(1.25rem, 1.11vw + 0.96rem, 2.13rem) | 卡片标题 |
| H4-H5 | clamp(1rem, ..., 1.63rem) | 子标题 |
| Body | 16px, #1C1C1C | 正文 |
| Body Secondary | 16px, #5B6166 | 次要文字 |

## 交互模式

- Header: 白底固定顶栏，向下滚动隐藏 / 向上滚动显示（translate3d 动画）
- 产品中心: 吸顶横向 Tab 导航（桌面端滚动、移动端换行网格）
- 新闻: 灰底白卡片行（rb-content-list）
- CTA: 红色按钮，锐利直角（radius 2-4px）
- 图片: next/image blur-up 占位符
- 滚动条: OverlayScrollbars 自定义主题（hover 品牌红）

## Section 间距

- Section 间: 96px (6rem)
- 内容区最大宽度: 1280px (80rem)
- 内边距: 16px (移动端), 24px (平板), 48px (桌面端)

## 圆角

- 全局锐利风格: sm/md = 2px, lg/xl = 4px, 2xl = 6px
