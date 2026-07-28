'use client';

import { useEffect, useRef, useState } from 'react';
import {
  type AliyunCaptchaPublicConfig,
  getIntegrationsPublicConfig,
  resolveAliyunCaptchaConfig,
} from '@/lib/integrations-public';

const SCRIPT_URL = 'https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js';
const CAPTCHA_ELEMENT_ID = 'aliyun-captcha-element';
const SUBMIT_BUTTON_ID = 'contact-submit-btn';

declare global {
  interface Window {
    AliyunCaptchaConfig?: { region: string; prefix: string };
    initAliyunCaptcha?: (options: Record<string, unknown>) => void;
  }
}

export type CaptchaLanguage = 'cn' | 'tw' | 'en';

/** 从后台集成配置或 env 读取阿里云验证码公开参数 */
export function useAliyunCaptchaConfig() {
  const [config, setConfig] = useState<AliyunCaptchaPublicConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getIntegrationsPublicConfig().then((data) => {
      if (cancelled) return;
      setConfig(resolveAliyunCaptchaConfig(data));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { config, enabled: Boolean(config), loading };
}

function loadCaptchaScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.initAliyunCaptcha) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('验证码脚本加载失败'));
    document.head.appendChild(script);
  });
}

export function AliyunCaptchaEmbed({
  config,
  language,
  onSubmit,
  onSuccess,
  onError,
}: {
  config: AliyunCaptchaPublicConfig;
  language: CaptchaLanguage;
  onSubmit: (captchaVerifyParam: string) => Promise<boolean>;
  onSuccess: () => void;
  onError: () => void;
}) {
  const initialized = useRef(false);
  const callbacksRef = useRef({ onSubmit, onSuccess, onError });
  callbacksRef.current = { onSubmit, onSuccess, onError };

  useEffect(() => {
    if (initialized.current) return;

    window.AliyunCaptchaConfig = {
      region: config.region === 'sgp' ? 'sgp' : 'cn',
      prefix: config.prefix,
    };

    let cancelled = false;

    void loadCaptchaScript()
      .then(() => {
        if (cancelled || !window.initAliyunCaptcha || initialized.current) return;

        window.initAliyunCaptcha({
          SceneId: config.sceneId,
          mode: 'embed',
          element: `#${CAPTCHA_ELEMENT_ID}`,
          button: `#${SUBMIT_BUTTON_ID}`,
          captchaVerifyCallback: async (captchaVerifyParam: string) => {
            try {
              const ok = await callbacksRef.current.onSubmit(captchaVerifyParam);
              return { captchaResult: ok, bizResult: ok };
            } catch {
              return { captchaResult: false, bizResult: false };
            }
          },
          onBizResultCallback: (bizResult: boolean) => {
            if (bizResult) callbacksRef.current.onSuccess();
            else callbacksRef.current.onError();
          },
          getInstance: () => {},
          slideStyle: { width: 360, height: 40 },
          language,
          immediate: false,
        });
        initialized.current = true;
      })
      .catch(() => {
        callbacksRef.current.onError();
      });

    return () => {
      cancelled = true;
    };
  }, [config.prefix, config.sceneId, config.region, language]);

  return (
    // 第三方验证码挂载点，控件自身提供语义，容器不另设 aria 属性
    <div id={CAPTCHA_ELEMENT_ID} className="flex min-h-[44px] justify-center" />
  );
}

export { SUBMIT_BUTTON_ID };
