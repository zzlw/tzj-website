import { env } from '@/lib/env';

/** 弹窗曝光/点击上报：sendBeacon 优先（页面卸载/关标签也可靠送达），fetch keepalive 兜底（对齐 analytics.ts 先例）；计数失败不影响交互 */
export function sendPopupEvent(id: string, type: 'view' | 'click'): void {
  if (typeof window === 'undefined') return;
  const url = `${env.apiUrl}/trade-shows/${id}/popup-event`;
  const payload = JSON.stringify({ type });
  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    if (navigator.sendBeacon(url, blob)) return;
  }
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {
    /* 计数失败不影响交互 */
  });
}
