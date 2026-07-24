'use client';

/**
 * 全局访客/IP 详情抽屉的命令式上下文（Intercom/Segment 全局实体抽屉模式）。
 * Context 与 hook 单独成文件，避免 Provider ↔ 抽屉组件之间的循环 import。
 */
import { createContext, useContext } from 'react';
import type { IpDrawerSeed, VisitorProfileIdentity } from '@/features/analytics';

export interface VisitorDrawerApi {
  /** 按 visitorId 打开人物抽屉；已有 IP 抽屉时压栈为顶（桥跳转），否则单层。 */
  openPerson(visitorId: string, seed?: Partial<VisitorProfileIdentity>): void;
  /** 按 ipHash 打开 IP 抽屉；重置栈为单层（IP 为底）。 */
  openIp(ipHash: string, seed?: Partial<IpDrawerSeed>): void;
  /** 关闭栈顶（有人物层则先关人物，回到 IP 层；否则关 IP 层）。 */
  close(): void;
}

export const VisitorDrawerContext = createContext<VisitorDrawerApi | null>(null);

export function useVisitorDrawer(): VisitorDrawerApi {
  const ctx = useContext(VisitorDrawerContext);
  if (!ctx) {
    throw new Error('useVisitorDrawer 必须在 <VisitorDrawerProvider> 内使用');
  }
  return ctx;
}
