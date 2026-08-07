import { describe, expect, it } from 'vitest';
import { isUsableExternalUrl } from '../external-url.js';

describe('isUsableExternalUrl', () => {
  it('空值 / 空白视为未填写', () => {
    expect(isUsableExternalUrl(undefined)).toBe(false);
    expect(isUsableExternalUrl(null)).toBe(false);
    expect(isUsableExternalUrl('')).toBe(false);
    expect(isUsableExternalUrl('   ')).toBe(false);
  });

  it('仅协议无域名的占位值视为未填写', () => {
    expect(isUsableExternalUrl('https://')).toBe(false);
    expect(isUsableExternalUrl('http://')).toBe(false);
    expect(isUsableExternalUrl('localhost')).toBe(false);
    expect(isUsableExternalUrl('http://localhost:9000/a.jpg')).toBe(false);
  });

  it('合法 http(s) 外链通过（含两侧空白）', () => {
    expect(isUsableExternalUrl('https://www.example.com')).toBe(true);
    expect(isUsableExternalUrl('  https://expo.example.cn/register?x=1  ')).toBe(true);
    expect(isUsableExternalUrl('http://example.com')).toBe(true);
  });

  it('非 http(s) 协议与非法字符串拒绝', () => {
    expect(isUsableExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isUsableExternalUrl('ftp://files.example.com')).toBe(false);
    expect(isUsableExternalUrl('not a url')).toBe(false);
  });
});
