'use client';

import { createContext, useContext, type PropsWithChildren } from 'react';

/**
 * 站点客服电话 Context：供「预约咨询」按钮在无人在线时拨号使用。
 * 在根 layout 中通过 <AgentPhoneProvider> 注入 siteSettings.contact.phone，
 * 全站客户端组件通过 useAgentPhone() 消费，避免 25+ 处逐 prop 透传。
 */
const AgentPhoneContext = createContext<string | undefined>(undefined);

export function AgentPhoneProvider({
  children,
  phone,
}: PropsWithChildren<{ phone?: string }>) {
  return (
    <AgentPhoneContext.Provider value={phone}>{children}</AgentPhoneContext.Provider>
  );
}

export function useAgentPhone(): string | undefined {
  return useContext(AgentPhoneContext);
}
