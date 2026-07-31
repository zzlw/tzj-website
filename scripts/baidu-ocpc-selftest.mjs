#!/usr/bin/env node
/**
 * 百度 OCPC 转化回传自测脚本（一次性联调工具）
 *
 * 用途：用本地 .env 中的 BAIDU_OCPC_TOKEN / BAIDU_OCPC_CONVERT_TYPE / BAIDU_OCPC_SITE_URL
 * 调用百度 uploadConvertData 接口，验证凭证有效 + 请求格式正确（header.status=0）。
 *
 * 请求体与 logidUrl 拼法与 apps/api/src/integrations/baidu-ocpc.service.ts 保持一致。
 *
 * 用法：
 *   node scripts/baidu-ocpc-selftest.mjs                 # 用默认测试 bd_vid
 *   node scripts/baidu-ocpc-selftest.mjs <bd_vid>        # 指定真实 bd_vid（更贴近生产）
 *   node scripts/baidu-ocpc-selftest.mjs <bd_vid> <path> # 再指定首触路径，如 /products
 *
 * 说明：status=0 表示百度成功「接收」到回传数据（凭证与格式正确）；bd_vid 与真实点击的
 * 匹配由百度离线完成，故用测试 bd_vid 也应返回 0，可用于校验 token/格式是否可用。
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const UPLOAD_ENDPOINT = 'https://ocpc.baidu.com/ocpcapi/api/uploadConvertData';
const MAX_LOGID_URL_LEN = 1024;
const REQUEST_TIMEOUT_MS = 5000;

const STATUS_MEANING = {
  0: '成功：百度已接收回传数据（凭证与格式正确）',
  1: '部分失败：部分转化数据未被接收',
  2: '全部失败：转化数据均未被接收',
  3: 'token 失败：Token 无效或不匹配（请检查 BAIDU_OCPC_TOKEN）',
  4: '服务端异常：需重试',
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

/** 极简 .env 解析：KEY=VALUE / KEY="VALUE"，忽略注释与空行。 */
function loadDotEnv() {
  const out = {};
  try {
    const raw = readFileSync(resolve(ROOT, '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      out[key] = val;
    }
  } catch {
    // .env 不存在时回退到 process.env
  }
  return out;
}

/** 与服务端 buildLogidUrl 完全一致的拼接逻辑。 */
function buildLogidUrl(siteUrl, path, bdVid) {
  const base = siteUrl.replace(/\/$/, '');
  const cleanPath = path?.startsWith('/') ? path.split('?')[0] : '/';
  const url = `${base}${cleanPath}`;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}bd_vid=${encodeURIComponent(bdVid)}`.slice(0, MAX_LOGID_URL_LEN);
}

function mask(secret) {
  if (!secret) return '(空)';
  if (secret.length <= 12) return `${secret.slice(0, 3)}***`;
  return `${secret.slice(0, 6)}…${secret.slice(-6)}`;
}

async function main() {
  const dotenv = loadDotEnv();
  const env = { ...dotenv, ...process.env };

  const token = env.BAIDU_OCPC_TOKEN?.trim();
  const convertTypeRaw = env.BAIDU_OCPC_CONVERT_TYPE?.trim();
  const siteUrl = env.BAIDU_OCPC_SITE_URL?.trim();
  const newType = Number(convertTypeRaw);

  const bdVid = process.argv[2] ?? `selftest-${Date.now()}`;
  const path = process.argv[3] ?? '/';

  console.log('── 百度 OCPC 回传自测 ─────────────────────────────');
  console.log(`Token        : ${mask(token)}`);
  console.log(`ConvertType  : ${convertTypeRaw} (newType=${newType})`);
  console.log(`SiteUrl      : ${siteUrl ?? '(空)'}`);
  console.log(`bd_vid       : ${bdVid}${process.argv[2] ? '' : ' (测试值)'}`);
  console.log('');

  if (!token || !siteUrl || !convertTypeRaw || Number.isNaN(newType)) {
    console.error(
      '❌ 配置缺失：需要 BAIDU_OCPC_TOKEN / BAIDU_OCPC_CONVERT_TYPE / BAIDU_OCPC_SITE_URL 三项齐全。',
    );
    process.exit(1);
  }

  const logidUrl = buildLogidUrl(siteUrl, path, bdVid);
  const body = JSON.stringify({ token, conversionTypes: [{ logidUrl, newType }] });

  console.log(`请求地址     : POST ${UPLOAD_ENDPOINT}`);
  console.log(`logidUrl     : ${logidUrl}`);
  console.log(`请求体       : ${body.replace(token, mask(token))}`);
  console.log('');

  let res;
  try {
    res = await fetch(UPLOAD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    console.error(`❌ 网络请求失败：${err.message}`);
    process.exit(2);
  }

  const text = await res.text();
  console.log(`HTTP 状态    : ${res.status} ${res.statusText}`);
  console.log(`原始响应     : ${text}`);
  console.log('');

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('❌ 响应非 JSON，无法解析。');
    process.exit(3);
  }

  const status = data?.header?.status;
  const meaning = STATUS_MEANING[status] ?? '未知状态码';
  console.log(`header.status: ${status} — ${meaning}`);

  if (status === 0) {
    console.log('\n✅ 自测通过：Token 与请求格式有效，百度已成功接收回传。');
    process.exit(0);
  }
  console.log('\n⚠️ 自测未通过 status=0，请按上方状态码含义排查。');
  process.exit(4);
}

main();
