#!/usr/bin/env node
/** Generate i18n JSON + refactored page.tsx for remaining 12 pages */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(process.cwd(), 'apps/web/src');
const APP = path.join(ROOT, 'app/[locale]');

function writeJson(id, zhCN, en, zhTW) {
  for (const [locale, data] of [['zh-CN', zhCN], ['en', en], ['zh-TW', zhTW]]) {
    fs.writeFileSync(path.join(ROOT, `messages/${locale}/pages/${id}.json`), JSON.stringify(data, null, 2) + '\n');
  }
}
function writePage(rel, content) {
  fs.writeFileSync(path.join(APP, rel), content);
}

// Shared page template helpers embedded in each page file below via writePage calls
console.log('Script placeholder - pages written via direct file writes');
