import { resolveVisitorPresence } from '../../../web/src/features/chat/presence';

describe('resolveVisitorPresence（访客侧 away 防抖）', () => {
  it('坐席在线 → 访客可见在线', () => {
    expect(resolveVisitorPresence({ status: 'online', stableAway: false })).toBe('online');
    expect(resolveVisitorPresence({ status: 'online', stableAway: true })).toBe('online');
  });

  it('坐席真正离线 → 访客可见离线（文案由 noAgentOnline 处理，此处透传）', () => {
    expect(resolveVisitorPresence({ status: 'offline', stableAway: false })).toBe('offline');
    expect(resolveVisitorPresence({ status: 'offline', stableAway: true })).toBe('offline');
  });

  it('核心回归：坐席切桌面/切标签页导致瞬时 away → 访客仍见在线（不闪「离开中」）', () => {
    expect(resolveVisitorPresence({ status: 'away', stableAway: false })).toBe('online');
  });

  it('away 持续超过显示宽限（stableAway=true） → 访客才降级为离开中', () => {
    expect(resolveVisitorPresence({ status: 'away', stableAway: true })).toBe('away');
  });
});
