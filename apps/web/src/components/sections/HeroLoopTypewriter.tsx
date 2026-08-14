'use client';

import { useEffect, useMemo, useState } from 'react';
import type { TypewriterClass } from 'typewriter-effect';
import Typewriter from 'typewriter-effect';

/** 删除速度 ms/字：约为 natural 删除（40–80ms）的一半，观感干脆不拖沓 */
const DELETE_SPEED_MS = 30;
/** 每条短语打完后的停留时长（读完即可，过长会拖慢轮换节奏） */
const PAUSE_FOR_MS = 1800;
/** 意群间停顿 ms：模拟「想下一个词」的思考间隙，是人味的主要来源 */
const CHUNK_PAUSE_MS = 150;
/** CJK 无空格，按 3 字一个意群切分（模拟拼音输入法按词组上屏的节奏） */
const CJK_CHUNK_SIZE = 3;

const CJK_PATTERN = /[\u3000-\u9fff\uf900-\ufaff]/;

/** CJK 按固定字数切意群 */
function splitCjkChunks(phrase: string): string[] {
  const chars = Array.from(phrase);
  const chunks: string[] = [];
  for (let i = 0; i < chars.length; i += CJK_CHUNK_SIZE) {
    chunks.push(chars.slice(i, i + CJK_CHUNK_SIZE).join(''));
  }
  return chunks;
}

/** 含空格的文字按词切，空格随前一个词一起打出（打字机习惯） */
function splitWordChunks(phrase: string): string[] {
  const chunks: string[] = [];
  let buf = '';
  for (const token of phrase.split(/(\s+)/)) {
    if (/^\s+$/.test(token)) {
      buf += token;
    } else if (buf.trim()) {
      chunks.push(buf);
      buf = token;
    } else {
      buf = token;
    }
  }
  if (buf.trim()) chunks.push(buf);
  return chunks;
}

/**
 * 把短语切成意群，返回 [片段, 片段后是否停顿] 列表；
 * 最后一个意群后不停顿（交给整句停留）。
 */
function splitChunks(phrase: string): Array<[string, boolean]> {
  const chunks = CJK_PATTERN.test(phrase) ? splitCjkChunks(phrase) : splitWordChunks(phrase);
  return chunks.map((chunk, i) => [chunk, i < chunks.length - 1]);
}

/**
 * Hero 主标题「固定前缀 + 后缀循环打字机」（三语通用）。
 *
 * 前缀（line1）静态展示，后缀按短语循环：意群连打（delay 'natural'，
 * 120–160ms 随机抖动，真打字手感）→ 意群间停顿 150ms → 整句停留 1.8s
 * → 快速删除（30ms/字）→ 下一条。
 * 注意：onInit 必须作为顶层 prop 传入，库不会读取 options.onInit；
 * autoStart 关闭，队列在 onInit 里组装完再手动 start()；循环用 options.loop
 * （库无 .loop() 链式方法）。
 * 服务端渲染完整标题（首条短语）保证 SEO 与无 JS 可见；客户端水合后
 * 切换为打字机层。占位层按最长短语预留宽高，轮换全程无布局跳动；
 * 屏幕阅读器经 sr-only 锚定品牌主标语，不朗读逐字碎片。
 * 用户偏好减少动效或短语不足两条时保持静态全文。
 */
export function HeroLoopTypewriter({ line1, phrases }: { line1: string; phrases: string[] }) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(
      phrases.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
  }, [phrases.length]);

  // options 稳定引用：Typewriter wrapper 对 options 做深比较，
  // 每次渲染新建对象会导致实例反复重建、动画从头开始
  const options = useMemo(
    () =>
      ({
        autoStart: false,
        loop: true,
        delay: 'natural',
        deleteSpeed: DELETE_SPEED_MS,
      }) as const,
    [],
  );

  // 意群队列：onInit 只在实例创建时调用一次，回调身份变化不会触发重建；
  // 循环靠 options.loop（库无 .loop() 实例方法），队列末尾 deleteAll 清空后回放
  const handleInit = (tw: TypewriterClass) => {
    let chain = tw;
    for (const phrase of phrases) {
      for (const [chunk, pauseAfter] of splitChunks(phrase)) {
        chain = chain.typeString(chunk);
        if (pauseAfter) chain = chain.pauseFor(CHUNK_PAUSE_MS);
      }
      chain = chain.pauseFor(PAUSE_FOR_MS).deleteAll();
    }
    chain.start();
  };

  const first = phrases[0] ?? '';

  if (!animate) {
    return (
      <>
        {line1}
        <br />
        <span className="text-primary">{first}</span>
      </>
    );
  }

  // 最长短语决定占位宽高，其余短语都不会撑破预留空间
  const longest = phrases.reduce((a, b) => (b.length > a.length ? b : a), first);

  return (
    <>
      {line1}
      <br />
      <span className="text-primary">
        {/* pr 为光标 '|' 预留宽度：占位层只按最长短语的文字宽高预留，
            打字层实际渲染「文字 + 光标」，打满最长短语时光标会把末字挤到下一行，
            溢出行会压到下方区块，故容器需额外留出光标位 */}
        <span className="relative inline-block max-w-full pr-[0.5em]">
          {/* 占位层：在容器宽度内自然换行撑起盒模型（宽高均以最长短语为准），
              长英文短语超出可用宽度时正常折行而非溢出 */}
          <span className="invisible block" aria-hidden="true">
            {longest}
          </span>
          {/* 打字机层与占位盒同宽（inset-0），换行行为一致；aria-hidden 避免朗读逐字碎片 */}
          <span aria-hidden="true" className="absolute inset-0">
            <Typewriter
              key={phrases.join('|')}
              component="span"
              options={options}
              onInit={handleInit}
            />
          </span>
        </span>
        {/* 屏幕阅读器锚定品牌主标语（打字机层 aria-hidden） */}
        <span className="sr-only">{first}</span>
      </span>
    </>
  );
}
