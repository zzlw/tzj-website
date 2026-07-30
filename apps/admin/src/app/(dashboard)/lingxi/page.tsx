import { LingxiChat } from '@/components/lingxi/LingxiChat';

export const metadata = { title: '灵犀 · AI 投放分析' };

/** 灵犀会话页：错误由 (dashboard)/error.tsx 就近边界承接。 */
export default function LingxiPage() {
  return <LingxiChat />;
}
