/** "yyyy-MM-dd" → Date（本地时区，避免 UTC 偏移导致日期漂移） */
export function parseDateValue(value?: string): Date | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function toDateValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const formatDateLabel = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'long',
});
