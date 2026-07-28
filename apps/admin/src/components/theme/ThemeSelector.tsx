'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@tzj/ui';
import { Palette } from 'lucide-react';
import { THEME_PRESETS, type ThemePreset, useActiveTheme } from './ActiveThemeProvider';

/** 配色预设切换器：10 套预设，选择后经 cookie 持久化（active_theme） */
export function ThemeSelector() {
  const { activeTheme, setActiveTheme } = useActiveTheme();

  return (
    <Select value={activeTheme} onValueChange={(value) => setActiveTheme(value as ThemePreset)}>
      <SelectTrigger aria-label="切换配色预设" className="w-32 gap-1.5 text-xs [&_svg]:size-3.5">
        <Palette className="shrink-0 text-muted-foreground" />
        <SelectValue placeholder="配色" />
      </SelectTrigger>
      <SelectContent align="end">
        {THEME_PRESETS.map((preset) => (
          <SelectItem key={preset.value} value={preset.value} className="text-xs">
            {preset.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
