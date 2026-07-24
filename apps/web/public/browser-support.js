/* 本文件为面向旧浏览器的 ES5 兼容脚本：整份代码会被最老的浏览器解析，故禁用一切会引入
 * 现代语法（箭头函数 / 模板字符串 / 可选链）的 lint 自动改写，否则改写后的语法本身会在
 * 目标旧浏览器上直接解析失败，使升级引导失效。 */
/* biome-ignore-all lint/style/useTemplate: 旧浏览器不支持模板字符串，改用字符串拼接 */
/* biome-ignore-all lint/complexity/useOptionalChain: 旧浏览器不支持可选链，保持显式判空 */
/* biome-ignore-all lint/complexity/useArrowFunction: 旧浏览器不支持箭头函数 */

/**
 * 旧版浏览器检测与升级引导（自包含，DEV/PROD 通用）。
 *
 * 设计要点（对齐 GitHub / Stripe / browser-update.org 业内实践）：
 * 1. 本脚本仅用 ES5 语法，且不依赖应用主包——当浏览器过旧、连主包都无法解析时仍能运行并提示；
 * 2. 采用「特性检测」而非「UA 嗅探」：勾选站点运行所需的现代 JS 能力（≈ES2020 基线，
 *    对应可选链 / 空值合并的可用区间），避免误判新浏览器、也不受 UA 伪装影响；
 * 3. 非阻断式顶部横幅 + 关闭记忆（localStorage），不硬锁用户、不每页骚扰；
 * 4. 文案随 <html lang> 切换（zh-CN / zh-TW / en），自带三语，无需应用国际化包。
 */
(function () {
  // 站点运行所依赖的现代 JS 能力探针；缺任一项即判定浏览器过旧。
  function isSupported() {
    try {
      return (
        typeof window.Promise === 'function' &&
        typeof window.Promise.allSettled === 'function' &&
        typeof Object.fromEntries === 'function' &&
        typeof window.globalThis === 'object' &&
        typeof String.prototype.replaceAll === 'function' &&
        typeof window.IntersectionObserver === 'function'
      );
    } catch (_e) {
      return false;
    }
  }

  if (isSupported()) {
    return;
  }

  var STORAGE_KEY = 'tzj-browser-warning-dismissed';
  try {
    if (window.localStorage && window.localStorage.getItem(STORAGE_KEY) === '1') {
      return;
    }
  } catch (_e) {
    // 隐私模式等禁用 localStorage 时忽略，横幅照常展示
  }

  // 读取 <html lang> 选择文案，回退简体中文。
  var rawLang = document.documentElement.getAttribute('lang') || 'zh-CN';
  var lang = rawLang.toLowerCase();
  var I18N = {
    'zh-cn': {
      msg: '您的浏览器版本较旧，可能无法正常浏览本网站。为获得完整体验，建议升级或更换以下现代浏览器：',
      close: '关闭',
    },
    'zh-tw': {
      msg: '您的瀏覽器版本較舊，可能無法正常瀏覽本網站。為獲得完整體驗，建議升級或更換以下現代瀏覽器：',
      close: '關閉',
    },
    en: {
      msg: 'Your browser is out of date and may not display this website correctly. For the best experience, please upgrade to a modern browser:',
      close: 'Close',
    },
  };
  var t = I18N[lang];
  if (!t) {
    t = lang.indexOf('zh') === 0 ? I18N['zh-cn'] : I18N.en;
  }

  var BROWSERS = [
    { name: 'Chrome', url: 'https://www.google.cn/chrome/' },
    { name: 'Edge', url: 'https://www.microsoft.com/edge' },
    { name: 'Firefox', url: 'https://www.mozilla.org/firefox/new/' },
  ];

  function buildBanner() {
    var bar = document.createElement('div');
    bar.setAttribute('role', 'alert');
    bar.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'right:0',
      'z-index:2147483647',
      'box-sizing:border-box',
      'padding:12px 16px',
      'background:#b91c1c',
      'color:#ffffff',
      'font-size:14px',
      'line-height:1.6',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
      'box-shadow:0 2px 10px rgba(0,0,0,0.25)',
      'display:flex',
      'flex-wrap:wrap',
      'align-items:center',
      'justify-content:center',
      'gap:6px 14px',
      'text-align:center',
    ].join(';');

    var text = document.createElement('span');
    text.appendChild(document.createTextNode(t.msg));
    bar.appendChild(text);

    var links = document.createElement('span');
    var i;
    var a;
    for (i = 0; i < BROWSERS.length; i++) {
      a = document.createElement('a');
      a.href = BROWSERS[i].url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.appendChild(document.createTextNode(BROWSERS[i].name));
      a.style.cssText =
        'color:#ffffff;font-weight:700;text-decoration:underline;margin:0 6px;white-space:nowrap;';
      links.appendChild(a);
    }
    bar.appendChild(links);

    var close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', t.close);
    close.appendChild(document.createTextNode('\u2715 ' + t.close));
    close.style.cssText =
      'flex-shrink:0;background:rgba(255,255,255,0.16);color:#ffffff;border:1px solid rgba(255,255,255,0.55);border-radius:4px;padding:4px 12px;cursor:pointer;font-size:13px;';
    close.onclick = function () {
      try {
        if (window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY, '1');
        }
      } catch (_e) {
        // localStorage 不可用时仅本次关闭
      }
      if (bar.parentNode) {
        bar.parentNode.removeChild(bar);
      }
    };
    bar.appendChild(close);

    (document.body || document.documentElement).appendChild(bar);
  }

  if (document.body) {
    buildBanner();
  } else {
    document.addEventListener('DOMContentLoaded', buildBanner);
  }
})();
