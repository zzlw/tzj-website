'use client';

import { DEVICE_LABELS, SOURCE_LABELS } from '@/features/analytics';

/** 来源渠道 facet 选项（direct/organic/paid/social/email/referral/other） */
export const SOURCE_FACET_OPTIONS = Object.entries(SOURCE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/** 设备类型 facet 选项（桌面/移动/平板，不含 unknown） */
export const DEVICE_FACET_OPTIONS = (['desktop', 'mobile', 'tablet'] as const).map((value) => ({
  value,
  label: DEVICE_LABELS[value] ?? value,
}));
