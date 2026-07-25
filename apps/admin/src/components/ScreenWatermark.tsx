'use client';

import { useEffect } from 'react';

/**
 * 后台防截图水印（溯源型明水印）。
 *
 * 浏览器无法真正阻止截图，此组件采用业内通行做法：在后台叠加一层带
 * 「登录账号 + 日期 + 可选机密标识」的半透明平铺水印，使任何截图都可
 * 追溯到具体员工，从而震慑内部信息外泄。
 *
 * 实现要点：
 * - 固定全屏层 + `pointer-events:none`，不影响任何操作，且覆盖弹窗/内容。
 * - 平铺用内联 SVG data URL 作 `background-image`，单节点即可铺满整屏。
 * - 防篡改：MutationObserver 监听移除/改样式 + 低频 setInterval 兜底重申，
 *   被 DevTools 删除或改 display/opacity 后会自动重建。
 */

const CONTAINER_ID = 'tzj-screen-watermark';
const Z_INDEX = 2147483000;

function todayLabel(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 生成平铺水印背景（旋转、半透明、两行：标识+账号 / 日期） */
function buildBackground(line1: string, line2: string, opacity: number): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='260' height='150'>` +
    `<g transform='rotate(-22 130 75)' fill='#0f172a' fill-opacity='${opacity}' ` +
    `font-family='-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif' font-size='13'>` +
    `<text x='20' y='72'>${esc(line1)}</text>` +
    `<text x='20' y='92'>${esc(line2)}</text>` +
    `</g></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

function buildCssText(background: string): string {
  return [
    'position:fixed',
    'left:0',
    'top:0',
    'right:0',
    'bottom:0',
    'width:100vw',
    'height:100vh',
    'pointer-events:none',
    'user-select:none',
    `z-index:${Z_INDEX}`,
    'background-repeat:repeat',
    `background-image:${background}`,
  ].join(';');
}

export function ScreenWatermark({
  username,
  text,
  opacity,
}: {
  username: string;
  text: string;
  opacity: number;
}) {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const prefix = text.trim();
    const line1 = prefix ? `${prefix} · ${username}` : username;
    const line2 = todayLabel();
    const cssText = buildCssText(buildBackground(line1, line2, opacity));

    let container: HTMLDivElement | null = null;
    let observer: MutationObserver | null = null;

    // 重新挂载 observer（container 可能被重建为新节点，需重新监听）
    const observe = () => {
      if (!observer || !container) return;
      observer.observe(document.body, { childList: true });
      observer.observe(container, { attributes: true, attributeFilter: ['style', 'class', 'id'] });
    };

    // 复用同 id 节点或新建，并确保挂在 body 上（防止重复挂载）
    const mountContainer = () => {
      const existing = document.getElementById(CONTAINER_ID);
      const node = existing instanceof HTMLDivElement ? existing : document.createElement('div');
      node.id = CONTAINER_ID;
      node.setAttribute('aria-hidden', 'true');
      if (!document.body.contains(node)) document.body.appendChild(node);
      container = node;
    };

    const ensure = () => {
      // 关键：写 DOM 前先断开 observer，避免「自身写样式 → 触发 observer → 再写」的死循环。
      // （style.cssText 读回值会被浏览器规范化，与写入串永不相等，若不断开将无限自触发、卡死主线程）
      observer?.disconnect();
      try {
        if (!container || !document.body.contains(container)) mountContainer();
        // 重申关键样式，抵御 DevTools 改 display/opacity/pointer-events
        if (container && container.style.cssText !== cssText) container.style.cssText = cssText;
      } finally {
        observe();
      }
    };

    // 监听移除与属性篡改，命中即重建（真实外部篡改仍会触发一次 ensure，自身写入则不会）
    observer = new MutationObserver(() => ensure());
    ensure();

    // 兜底：整棵子树被替换时 observer 可能漏掉，低频重申
    const timer = window.setInterval(ensure, 2000);

    return () => {
      observer?.disconnect();
      window.clearInterval(timer);
      if (container && document.body.contains(container)) {
        document.body.removeChild(container);
      }
      observer = null;
      container = null;
    };
  }, [username, text, opacity]);

  return null;
}
