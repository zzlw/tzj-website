'use client';

import { Toast } from '@base-ui/react/toast';

/** Toast manager 单例 — 供 React 组件外调用（toast.ts 适配层） */
export const toastManager = Toast.createToastManager();
