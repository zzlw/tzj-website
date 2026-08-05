import { describe, expect, it } from 'vitest';
import { isBaiduAppUserAgent, isMobileUserAgent, parseUserAgent } from '../index.js';

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1';
const IPAD_UA =
  'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1';
const ANDROID_PHONE_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const ANDROID_TABLET_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const BAIDU_HARMONY_UA =
  'Mozilla/5.0 (Phone; OpenHarmony 5.0) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 ArkWeb/4.1.6.1 ' +
  'Mobile bdapp/1.0 (baiduboxapp; baiduboxapp) baiduboxapp/15.5.0.0 ' +
  '(Baidu; P5 5.0.0.135) NABar/1.0';
const HARMONY_NEXT_BROWSER_UA =
  'Mozilla/5.0 (Phone; OpenHarmony 5.0; HUAWEI ALN-AL00) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 ArkWeb/4.1.6.1 Mobile';
const HARMONY_3_COMPAT_UA =
  'Mozilla/5.0 (Linux; Android 10; HUAWEI VOG-L29; HarmonyOS; HMSCore 6.0.0) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Mobile Safari/537.36';
const HARMONY_3_VERSIONED_UA =
  'Mozilla/5.0 (Linux; Android 10; HUAWEI VOG-L29; HarmonyOS 3.0.0; HMSCore 6.0.0) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Mobile Safari/537.36';
const HARMONY_2_ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 10; HUAWEI ELE-AL00) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/83.0.4103.106 Mobile Safari/537.36';
const HUAWEI_ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 13; HUAWEI ALN-AL00) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const BAIDU_DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 BaiduBrowser/7.36';
const WECHAT_UA =
  'Mozilla/5.0 (Linux; Android 12; V2254A) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36 ' +
  'MicroMessenger/8.0.49.2560(0x28003137) NetType/WIFI';

describe('parseUserAgent / isMobileUserAgent', () => {
  it('区分手机与平板（iPad 的 UA 也含 Mobile，不应误判为可拨号手机）', () => {
    expect(parseUserAgent(IPHONE_UA).deviceType).toBe('mobile');
    expect(isMobileUserAgent(IPHONE_UA)).toBe(true);
    expect(parseUserAgent(IPAD_UA).deviceType).toBe('tablet');
    expect(isMobileUserAgent(IPAD_UA)).toBe(false);
    expect(parseUserAgent(ANDROID_PHONE_UA).deviceType).toBe('mobile');
    expect(isMobileUserAgent(ANDROID_PHONE_UA)).toBe(true);
    expect(parseUserAgent(ANDROID_TABLET_UA).deviceType).toBe('tablet');
    expect(isMobileUserAgent(ANDROID_TABLET_UA)).toBe(false);
  });

  it('桌面端归为 desktop，空 UA 归为 unknown', () => {
    expect(parseUserAgent(DESKTOP_UA).deviceType).toBe('desktop');
    expect(isMobileUserAgent(DESKTOP_UA)).toBe(false);
    expect(parseUserAgent('').deviceType).toBe('unknown');
    expect(parseUserAgent(undefined).deviceType).toBe('unknown');
  });

  it('解析浏览器与操作系统信息', () => {
    const parsed = parseUserAgent(ANDROID_PHONE_UA);
    expect(parsed.browser).toBe('Mobile Chrome');
    expect(parsed.browserVersion).toMatch(/^120/);
    expect(parsed.os).toBe('Android');
    expect(parsed.osVersion).toBe('13');
    expect(parseUserAgent(IPHONE_UA).os).toBe('iOS');
  });
});

describe('isBaiduAppUserAgent', () => {
  it('识别 Android / iOS / 鸿蒙百度 App', () => {
    expect(isBaiduAppUserAgent(BAIDU_HARMONY_UA)).toBe(true);
    expect(
      isBaiduAppUserAgent(
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36 ' +
          'baiduboxapp/13.8.0.10 (Baidu; P1 7.0.0) T5/2.0',
      ),
    ).toBe(true);
    expect(
      isBaiduAppUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) ' +
          'AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ' +
          'BaiduBoxAPP/6.9.10 (Baidu; P1 9.3) T5/2.0',
      ),
    ).toBe(true);
  });

  it('不识别桌面百度浏览器、百度爬虫与常规浏览器', () => {
    expect(isBaiduAppUserAgent(BAIDU_DESKTOP_UA)).toBe(false);
    expect(isBaiduAppUserAgent('Baiduspider+(+http://www.baidu.com/search/spider.htm)')).toBe(
      false,
    );
    expect(isBaiduAppUserAgent(WECHAT_UA)).toBe(false);
    expect(isBaiduAppUserAgent(DESKTOP_UA)).toBe(false);
    expect(isBaiduAppUserAgent('')).toBe(false);
  });
});

describe('parseUserAgent 兼容映射（保持与旧 ua-parser-js@2 统计口径一致）', () => {
  it('鸿蒙百度 App：浏览器名 Baidu + OS HarmonyOS + clientApp 百度App', () => {
    const parsed = parseUserAgent(BAIDU_HARMONY_UA);
    expect(parsed.browser).toBe('Baidu');
    expect(parsed.os).toBe('HarmonyOS');
    expect(parsed.osVersion).toBe('5.0');
    expect(parsed.clientApp).toBe('百度App');
    expect(parsed.deviceType).toBe('mobile');
  });

  it('桌面百度浏览器不会被误标为百度 App', () => {
    const parsed = parseUserAgent(BAIDU_DESKTOP_UA);
    expect(parsed.browser).toBe('BaiduBrowser');
    expect(parsed.clientApp).toBeNull();
    expect(parsed.deviceType).toBe('desktop');
  });

  it('Android 手机 Chrome 保持 Mobile Chrome 命名', () => {
    expect(parseUserAgent(ANDROID_PHONE_UA).browser).toBe('Mobile Chrome');
    expect(parseUserAgent(DESKTOP_UA).browser).toBe('Chrome');
  });

  it('微信/设备型号厂商解析正常', () => {
    const parsed = parseUserAgent(WECHAT_UA);
    expect(parsed.clientApp).toBe('微信');
    expect(parsed.deviceModel).toBe('V2254A');
    expect(parsed.deviceType).toBe('mobile');
  });
});

describe('parseUserAgent 鸿蒙设备识别', () => {
  it('鸿蒙 NEXT（OpenHarmony）浏览器：识别为 HarmonyOS + 华为型号', () => {
    const parsed = parseUserAgent(HARMONY_NEXT_BROWSER_UA);
    expect(parsed.os).toBe('HarmonyOS');
    expect(parsed.osVersion).toBe('5.0');
    expect(parsed.deviceVendor).toBe('Huawei');
    expect(parsed.deviceModel).toBe('ALN-AL00');
  });

  it('鸿蒙 3 兼容安卓且无显式版本：识别为 HarmonyOS，版本不再误取 Android 10', () => {
    const parsed = parseUserAgent(HARMONY_3_COMPAT_UA);
    expect(parsed.os).toBe('HarmonyOS');
    expect(parsed.osVersion).toBeNull();
    expect(parsed.deviceVendor).toBe('Huawei');
    expect(parsed.deviceModel).toBe('VOG-L29');
  });

  it('鸿蒙 3 带显式版本：取 HarmonyOS 3.0.0', () => {
    const parsed = parseUserAgent(HARMONY_3_VERSIONED_UA);
    expect(parsed.os).toBe('HarmonyOS');
    expect(parsed.osVersion).toBe('3.0.0');
  });

  it('鸿蒙 2 无标识：与普通华为安卓不可区分（UA 机制限制，保持 Android）', () => {
    const parsed = parseUserAgent(HARMONY_2_ANDROID_UA);
    expect(parsed.os).toBe('Android');
    expect(parsed.osVersion).toBe('10');
    expect(parsed.deviceVendor).toBe('Huawei');
  });

  it('普通华为安卓手机不受影响', () => {
    const parsed = parseUserAgent(HUAWEI_ANDROID_UA);
    expect(parsed.os).toBe('Android');
    expect(parsed.osVersion).toBe('13');
    expect(parsed.deviceVendor).toBe('Huawei');
  });
});
