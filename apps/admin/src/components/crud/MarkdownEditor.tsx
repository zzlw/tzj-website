"use client";

import { useEffect, useRef, useState } from "react";
import type Vditor from "vditor";
import { uploadMedia } from "@/features/media";
import type { MediaAsset } from "@/features/types";
import { VDITOR_I18N_ZH_CN } from "@/lib/vditor-i18n-zh-cn";

export interface MarkdownEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  /** 上传子目录，对接媒体库 */
  folder?: string;
  minHeight?: number;
  placeholder?: string;
  /** 默认编辑模式；知识库文档建议 ir（即时渲染，粘贴 Markdown 源码更可靠） */
  defaultMode?: "wysiwyg" | "ir" | "sv";
}

type VditorInternal = Vditor & {
  vditor?: { element?: HTMLElement };
};

/** 单文件上限：与后端 multipart 限制（media.controller）保持一致 */
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_FILE_SIZE_LABEL = "100MB";

const UPLOAD_ACCEPT = [
  "image/*",
  "video/*",
  "audio/*",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".zip",
  ".rar",
].join(",");

const textareaCls =
  "flex min-h-[360px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function isVditorInitialized(v: VditorInternal | null | undefined): boolean {
  return Boolean(v?.vditor?.element);
}

function safeDestroy(vditor: VditorInternal | null | undefined): void {
  if (!isVditorInitialized(vditor)) return;
  try {
    vditor!.destroy();
  } catch {
    // 初始化未完成时忽略
  }
}

function vditorCdn(): string {
  // Vditor 官方 CDN（生产环境）
  // 注意：不要包含 /dist，Vditor 内部会自动追加 /dist/js/lute/lute.min.js
  if (process.env.NODE_ENV === "production") {
    return "https://unpkg.com/vditor@3.11.2";
  }
  // 开发环境：从 public/vditor-assets 加载
  return "/vditor-assets";
}

/** 源码模式按钮图标（Material “code”，fill 风格与 vditor 图标一致） */
const SOURCE_MODE_ICON =
  '<svg viewBox="0 0 24 24"><path d="M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>';

/** 源码模式 = sv 编辑器可见且预览列隐藏 */
function isSourceMode(root: HTMLElement): boolean {
  const sv = root.querySelector<HTMLElement>(".vditor-sv");
  const preview = root.querySelector<HTMLElement>(".vditor-preview");
  return sv?.style.display === "block" && preview?.style.display !== "block";
}

function updateSourceButton(root: HTMLElement): void {
  const btn = root.querySelector<HTMLElement>(
    '.vditor-toolbar button[data-type="source-mode"]',
  );
  btn?.classList.toggle("vditor-menu--current", isSourceMode(root));
}

/** 粘贴内容是否像 Markdown 源码（多行结构） */
function looksLikeMarkdown(text: string): boolean {
  const lines = text.split("\n");
  if (lines.length < 2) return false;
  let score = 0;
  for (const line of lines.slice(0, 40)) {
    const t = line.trim();
    if (/^#{1,6}\s/.test(t)) score += 2;
    if (/^[-*+]\s/.test(t)) score++;
    if (/^\d+\.\s/.test(t)) score++;
    if (/^\|.+\|/.test(t)) score += 2;
    if (/^```/.test(t)) score += 2;
    if (/^>\s/.test(t)) score++;
    if (/^[-*]\s\[[ xX]\]/.test(t)) score += 2;
  }
  return score >= 2;
}

/**
 * 从 IDE / 网页复制的 Markdown 常带畸形 text/html（丢换行），
 * 应优先用 text/plain 走 Markdown 解析，避免 wysiwyg 糊成一段。
 */
function shouldPreferPlainMarkdownPaste(plain: string, html: string): boolean {
  if (!plain.trim() || !looksLikeMarkdown(plain)) return false;
  if (!html.trim()) return false;
  const plainLines = plain.split("\n").length;
  const htmlLines = html.split("\n").length;
  if (plainLines >= 3 && plainLines > htmlLines) return true;
  if (!/<(?:p|div|br|h[1-6]|ul|ol|li|table|tr|pre|blockquote)\b/i.test(html)) {
    return true;
  }
  return false;
}

/** 按 MIME 类型生成插入编辑器的 Markdown 片段 */
function mediaMarkdown(asset: MediaAsset): string {
  const name = asset.filename || "file";
  if (asset.mimeType.startsWith("image/")) {
    return `![${name}](${asset.url})`;
  }
  if (asset.mimeType.startsWith("video/")) {
    return `<video controls src="${asset.url}" style="max-width:100%"></video>`;
  }
  if (asset.mimeType.startsWith("audio/")) {
    return `<audio controls src="${asset.url}"></audio>`;
  }
  return `[${name}](${asset.url})`;
}

/**
 * Vditor Markdown 编辑器。
 *
 * - 知识库（documents）默认 ir 即时渲染：粘贴 .md 源码、Typora/GitBook 体验
 * - 官网 CMS 默认 wysiwyg：富文本粘贴、表格浮层编辑
 * - 粘贴 / 拖拽 / 工具栏上传均走媒体库接口（MinIO / 阿里 OSS 由后端切换）
 * - 图片、视频、音频、文档按类型插入对应 Markdown
 * - 动态加载 vditor 包，加载完成前用 textarea 兜底
 */
export function MarkdownEditor({
  value,
  onChange,
  folder = "cms",
  minHeight = 420,
  placeholder = "支持 Markdown / GFM，可直接粘贴或拖拽图片、视频、音频、文档…",
  defaultMode: defaultModeProp,
}: MarkdownEditorProps) {
  const defaultMode =
    defaultModeProp ?? (folder === "documents" ? "ir" : "wysiwyg");
  const containerRef = useRef<HTMLDivElement>(null);
  const vditorRef = useRef<Vditor | null>(null);
  const mountIdRef = useRef(0);
  const onChangeRef = useRef(onChange);
  const folderRef = useRef(folder);
  const valueRef = useRef(value);
  /** 编辑器最近一次向外发出的值，用于区分「内部输入」与「外部赋值」，避免 setValue 导致光标跳动 */
  const lastEmittedRef = useRef(value);
  const defaultModeRef = useRef(defaultMode);
  const [editorReady, setEditorReady] = useState(false);
  onChangeRef.current = onChange;
  folderRef.current = folder;
  valueRef.current = value;
  defaultModeRef.current = defaultMode;

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    const mountId = ++mountIdRef.current;
    let cancelled = false;
    let pending: Vditor | null = null;
    let fullscreenObserver: MutationObserver | null = null;
    let layoutObserver: MutationObserver | null = null;

    let removePasteListener: (() => void) | null = null;

    async function bootstrap() {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      if (cancelled || mountId !== mountIdRef.current || !containerRef.current) return;

      const [{ default: VditorCtor }] = await Promise.all([
        import("vditor"),
        import("vditor/dist/index.css"),
      ]);
      if (cancelled || mountId !== mountIdRef.current || !containerRef.current) return;

      // 模式设计（对齐 Typora / GitBook / 语雀）：
      // - ir（即时渲染）：知识库默认，粘贴 Markdown 源码、写标题/列表体验最佳
      // - wysiwyg：CMS 默认，表格/图片浮层编辑
      // - sv：工具栏「源码模式」，纯 Markdown 文本编辑
      let sourceModeOn = false;
      const editMode = defaultModeRef.current;

      const toggleSourceMode = () => {
        const vd = vditorRef.current as VditorInternal | null;
        const rootEl = vd?.vditor?.element;
        if (!vd || !rootEl) return;
        const modeBtn = (m: string) =>
          rootEl.querySelector<HTMLButtonElement>(
            `.vditor-toolbar button[data-mode="${m}"]`,
          );
        if (isSourceMode(rootEl)) {
          sourceModeOn = false;
          modeBtn(editMode)?.click();
        } else {
          sourceModeOn = true;
          modeBtn("sv")?.click();
          vd.setPreviewMode("editor");
        }
        requestAnimationFrame(() => updateSourceButton(rootEl));
      };

      const el = containerRef.current;
      pending = new VditorCtor(el, {
        height: minHeight,
        mode: editMode,
        theme: "classic",
        icon: "material",
        cdn: vditorCdn(),
        i18n: VDITOR_I18N_ZH_CN,
        placeholder,
        cache: { enable: false },
        value: valueRef.current || "",
        // 全屏需盖住 Admin 的侧边栏（z-40/50）与顶栏（z-30）
        fullscreen: { index: 100 },
        toolbarConfig: { pin: true },
        // vditor 3.11 缺陷：wysiwyg 模式弹出工具栏会无条件调用该可选回调，缺省时报
        // "customWysiwygToolbar is not a function"，必须显式提供空实现
        customWysiwygToolbar: () => {},
        counter: { enable: true, type: "markdown" },
        input: (md) => {
          if (!cancelled && mountId === mountIdRef.current) {
            lastEmittedRef.current = md;
            onChangeRef.current(md);
          }
        },
        upload: {
          accept: UPLOAD_ACCEPT,
          multiple: true,
          // 自定义上传：成功后自行 insertValue，返回 null；返回字符串会被 Vditor 当作错误提示
          handler: async (files: File[]) => {
            const vd = vditorRef.current;
            if (!vd || files.length === 0) return null;

            const oversize = files.filter((f) => f.size > MAX_FILE_SIZE);
            const accepted = files.filter((f) => f.size <= MAX_FILE_SIZE);
            if (oversize.length > 0) {
              vd.tip(
                `${oversize.map((f) => `「${f.name}」`).join("、")}超过 ${MAX_FILE_SIZE_LABEL}，已跳过`,
                4000,
              );
            }
            if (accepted.length === 0) return null;

            vd.tip(`正在上传 ${accepted.length} 个文件…`, 2000);
            const snippets: string[] = [];
            const failed: string[] = [];
            for (const file of accepted) {
              try {
                const asset = await uploadMedia(file, folderRef.current);
                snippets.push(mediaMarkdown(asset));
              } catch {
                failed.push(file.name);
              }
            }
            if (snippets.length > 0) {
              vd.insertValue(`\n${snippets.join("\n\n")}\n`);
            }
            if (failed.length > 0) {
              vd.tip(`${failed.map((n) => `「${n}」`).join("、")}上传失败`, 4000);
            }
            return null;
          },
        },
        preview: {
          theme: { current: "light" },
          markdown: { toc: true },
          hljs: { style: "github" },
          // 默认 800：内容会被排成居中窄栏，且初始化时机不同会导致
          // 首次加载与切换模式后对齐不一致；调大后始终通栏左对齐
          maxWidth: 10240,
          // 默认还含 mp-wechat / zhihu（复制到公众号/知乎），此处不需要
          actions: ["desktop", "tablet", "mobile"],
        },
        toolbar: [
          "emoji",
          "headings",
          "bold",
          "italic",
          "strike",
          "|",
          "line",
          "quote",
          "list",
          "ordered-list",
          "check",
          "outdent",
          "indent",
          "|",
          "code",
          "inline-code",
          "upload",
          "link",
          "table",
          "|",
          "undo",
          "redo",
          "|",
          // edit-mode 仍需注册（源码切换依赖其隐藏的 data-mode 按钮），
          // 但通过 CSS 隐藏入口，用户可见的模式只有：编辑（默认）/ 源码 / 预览
          "edit-mode",
          {
            name: "source-mode",
            tip: "源码模式",
            tipPosition: "n",
            icon: SOURCE_MODE_ICON,
            click: toggleSourceMode,
          },
          "preview",
          "outline",
          "fullscreen",
        ],
        after: () => {
          if (cancelled || mountId !== mountIdRef.current) {
            safeDestroy(pending);
            pending = null;
            return;
          }
          vditorRef.current = pending;
          setEditorReady(true);
          const initial = valueRef.current || "";
          try {
            if (pending && pending.getValue() !== initial) {
              pending.setValue(initial);
              lastEmittedRef.current = initial;
            }
          } catch {
            // lute 尚未就绪
          }
          // 初始化时容器为 display:none，宽度为 0；显示后触发 resize 让 Vditor 重算内边距
          requestAnimationFrame(() => {
            window.dispatchEvent(new Event("resize"));
          });
          // vditor 退出全屏时会重写所有工具按钮的 className（恢复 tooltip 方向），
          // 连带抹掉预览按钮的激活类，导致预览模式下工具栏被错误恢复可用。
          // 监听根元素 class 变化（全屏切换），预览面板仍可见时补回激活类。
          const rootEl = (pending as VditorInternal).vditor?.element;
          if (rootEl) {
            fullscreenObserver = new MutationObserver(() => {
              const previewEl = rootEl.querySelector<HTMLElement>(".vditor-preview");
              const previewBtn = rootEl.querySelector<HTMLElement>(
                '.vditor-toolbar button[data-type="preview"]',
              );
              if (previewEl?.style.display === "block") {
                previewBtn?.classList.add("vditor-menu--current");
              }
              updateSourceButton(rootEl);
            });
            fullscreenObserver.observe(rootEl, {
              attributes: true,
              attributeFilter: ["class"],
            });

            // 监听 sv / 预览两列可见性，同步源码按钮高亮与标志位
            const svEl = rootEl.querySelector<HTMLElement>(".vditor-sv");
            const previewEl = rootEl.querySelector<HTMLElement>(".vditor-preview");
            if (svEl && previewEl) {
              layoutObserver = new MutationObserver(() => {
                const svVisible = svEl.style.display === "block";
                const previewVisible = previewEl.style.display === "block";
                if (!svVisible && !previewVisible) {
                  sourceModeOn = false; // 回到默认编辑
                }
                updateSourceButton(rootEl);
              });
              layoutObserver.observe(svEl, {
                attributes: true,
                attributeFilter: ["style"],
              });
              layoutObserver.observe(previewEl, {
                attributes: true,
                attributeFilter: ["style"],
              });
            }

            // 屏蔽 vditor 的编辑模式快捷键（⌥⌘7/8/9：所见即所得/即时渲染/分屏），
            // 避免用户误入已从 UI 移除的模式
            rootEl.addEventListener(
              "keydown",
              (e: KeyboardEvent) => {
                if (
                  e.altKey &&
                  (e.metaKey || e.ctrlKey) &&
                  ["Digit7", "Digit8", "Digit9"].includes(e.code)
                ) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              },
              true,
            );

            // 粘贴 Markdown 源码时优先 plain text，避免 IDE/网页 HTML 丢换行
            const onPasteCapture = (event: ClipboardEvent) => {
              if (sourceModeOn) return;
              const vd = vditorRef.current;
              if (!vd) return;
              const plain = event.clipboardData?.getData("text/plain") ?? "";
              const html = event.clipboardData?.getData("text/html") ?? "";
              if (!shouldPreferPlainMarkdownPaste(plain, html)) return;
              event.preventDefault();
              event.stopImmediatePropagation();
              vd.insertValue(plain);
              const md = vd.getValue();
              lastEmittedRef.current = md;
              onChangeRef.current(md);
            };
            rootEl.addEventListener("paste", onPasteCapture, true);
            removePasteListener = () =>
              rootEl.removeEventListener("paste", onPasteCapture, true);
          }
        },
      });
    }

    void bootstrap();

    // Vditor 只在编辑器内部处理面板关闭；点击编辑器外部时手动收起所有下拉面板
    const closePanelsOnOutsideClick = (evt: MouseEvent) => {
      const root = containerRef.current;
      if (!root || root.contains(evt.target as Node)) return;
      root
        .querySelectorAll<HTMLElement>(".vditor-panel, .vditor-hint")
        .forEach((panel) => {
          if (panel.style.display !== "none") panel.style.display = "none";
        });
    };
    document.addEventListener("mousedown", closePanelsOnOutsideClick);

    return () => {
      cancelled = true;
      setEditorReady(false);
      document.removeEventListener("mousedown", closePanelsOnOutsideClick);
      fullscreenObserver?.disconnect();
      layoutObserver?.disconnect();
      removePasteListener?.();
      const instance = vditorRef.current ?? pending;
      vditorRef.current = null;
      pending = null;
      safeDestroy(instance);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minHeight, placeholder, defaultMode]);

  // 编辑器从隐藏容器切换为可见后，让 Vditor 以真实宽度重算布局
  useEffect(() => {
    if (editorReady) window.dispatchEvent(new Event("resize"));
  }, [editorReady]);

  // 仅当值来自外部（表单 reset、加载完成等）时回写编辑器；
  // 与 getValue() 比较不可靠（Vditor 会规范化 markdown），会导致输入过程中光标被重置
  useEffect(() => {
    const vd = vditorRef.current;
    if (!vd || !editorReady) return;
    if (value === lastEmittedRef.current) return;
    try {
      vd.setValue(value || "");
      lastEmittedRef.current = value;
    } catch {
      // 编辑器尚未 ready
    }
  }, [value, editorReady]);

  return (
    <div className="markdown-editor">
      {!editorReady && (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={14}
          placeholder={`${placeholder}（富文本编辑器加载中，可先在此输入 Markdown）`}
          className={textareaCls}
        />
      )}
      {/* 隐藏类放在外层包裹 div 上：Vditor 会改写挂载元素的 className，
          若由 React 管理该属性，再次渲染会把 vditor 的 class 全部抹掉导致样式崩坏 */}
      <div className={editorReady ? undefined : "hidden"}>
        <div ref={containerRef} />
      </div>
    </div>
  );
}
