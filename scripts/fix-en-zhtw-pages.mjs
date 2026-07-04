#!/usr/bin/env node
/** Fix en/pages JSON (remove [EN]) and sync zh-TW/pages from zh-CN with proper Traditional Chinese */
import fs from 'fs';
import path from 'path';

const EN = 'apps/web/src/messages/en/pages';
const ZH_TW = 'apps/web/src/messages/zh-TW/pages';

const files = {
  'solution-detail.json': {
    en: {
      meta: { titleSuffix: 'Training Solutions' },
      hero: { eyebrowPrefix: 'Solutions · ' },
      intro: { eyebrow: 'Needs Assessment', titleSuffix: 'Training Facilities You Need' },
      focus: { eyebrow: 'Key Focus', title: 'How We Align With Your Mission' },
      recommended: {
        eyebrow: 'Recommended Configuration',
        title: 'Recommended Training Facility Package',
        description: 'The products below can be combined into a training program tailored to your needs, with phased construction based on site and budget.',
      },
      programs: {
        eyebrow: 'Typical Disciplines',
        title: 'Supported Training Disciplines',
        caseLink: 'View related project case studies',
      },
      others: { title: 'Other Customer Solutions' },
      cta: {
        titlePrefix: 'Custom training solutions for ',
        titleSuffix: '',
        description: 'Tell us your site, disciplines, and budget — our engineers and fire service experts will design a complete program for you.',
        backLink: 'Back to all solutions',
      },
    },
    zhTW: {
      meta: { titleSuffix: '訓練解決方案' },
      hero: { eyebrowPrefix: '解決方案 · ' },
      intro: { eyebrow: '需求洞察', titleSuffix: '需要怎樣的訓練設施' },
      focus: { eyebrow: '關注重點', title: '我們如何貼合您的任務' },
      recommended: {
        eyebrow: '推薦配置',
        title: '為您推薦的訓練設施組合',
        description: '以下產品可組合成貼合您需求的整體訓練方案，也可按場地與預算分期建設。',
      },
      programs: {
        eyebrow: '典型科目',
        title: '可支撐的訓練科目',
        caseLink: '查看相關工程案例',
      },
      others: { title: '其他客戶解決方案' },
      cta: {
        titlePrefix: '為',
        titleSuffix: '定制專屬訓練方案',
        description: '告訴我們您的場地、科目與預算，我們的工程師與消防專家團隊將為您量身設計整體方案。',
        backLink: '返回全部解決方案',
      },
    },
  },
};

function write(id, en, zhTW) {
  fs.writeFileSync(path.join(EN, id), JSON.stringify(en, null, 2) + '\n');
  fs.writeFileSync(path.join(ZH_TW, id), JSON.stringify(zhTW, null, 2) + '\n');
}

write('solution-detail.json', files['solution-detail.json'].en, files['solution-detail.json'].zhTW);
console.log('1/20 solution-detail');
