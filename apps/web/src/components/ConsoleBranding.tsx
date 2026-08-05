'use client';

import { useEffect } from 'react';
import { isProduction } from '@/lib/env';

/**
 * 控制台品牌欢迎语 —— 仅在生产环境客户端执行
 * 在浏览器控制台展示公司品牌格调，增加高级感
 */
export function ConsoleBranding() {
  useEffect(() => {
    // 仅在生产环境执行，避免 React DevTools 冲突
    if (!isProduction) return;
    if (typeof window === 'undefined') return;

    const timer = window.setTimeout(() => {
      const styles = {
        logo: `
          background: linear-gradient(135deg, #1a1c2e 0%, #2d3561 50%, #8b7f9c 100%);
          color: #d4af7a;
          font-size: 28px;
          font-weight: 700;
          padding: 24px 40px;
          border-radius: 12px 12px 0 0;
          letter-spacing: 3px;
          text-shadow: 0 2px 8px rgba(212, 175, 122, 0.3);
        `,
        slogan: `
          background: linear-gradient(135deg, #2d3561 0%, #4a5285 100%);
          color: #e8dcc4;
          font-size: 13px;
          font-weight: 400;
          font-style: italic;
          padding: 12px 40px;
          letter-spacing: 2px;
          text-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
        `,
        company: `
          background: linear-gradient(135deg, #4a5285 0%, #6b7399 100%);
          color: #f5f0e6;
          font-size: 11px;
          font-weight: 300;
          padding: 16px 40px;
          border-radius: 0 0 12px 12px;
          letter-spacing: 1.5px;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
        `,
      };

      console.log(
        `%c拓 之 迹%c\n%cEmpowering Resilience · Innovating with Purpose%c\n%c© ${new Date().getFullYear()} Henan TZJ Industrial Co., Ltd.%c`,
        styles.logo,
        '',
        styles.slogan,
        '',
        styles.company,
        '',
      );
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
