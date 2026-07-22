export type AgentPresenceStatus = 'online' | 'away' | 'offline';

export interface ResolveVisitorPresenceInput {
  /** 网关下发的坐席状态（聚合态） */
  status: AgentPresenceStatus;
  /** 「离开中」是否已稳定超过显示宽限（用于防抖瞬时 away） */
  stableAway: boolean;
}

/**
 * 解析「访客可见」的坐席可用性档位。
 *
 * 关键防抖：坐席切桌面 / 切标签页会经 user-idle 瞬间置为 away，但这是瞬时缺口，
 * 不应让访客立即看到「离开中 · 留言后我们会尽快回复」。仅当 away 持续超过显示宽限
 * （stableAway=true）才在访客侧降级为 away；否则乐观呈现为 online。
 * 与网关断线宽限（乐观保持在线、到期才 offline）同一思路。
 */
export function resolveVisitorPresence(input: ResolveVisitorPresenceInput): AgentPresenceStatus {
  const { status, stableAway } = input;
  if (status === 'away') return stableAway ? 'away' : 'online';
  return status;
}
