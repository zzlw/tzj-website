/**
 * CI 校验：重新生成 token 产物并与已提交文件比对，diff 非零即失败。
 * 用法：pnpm --filter @tzj/legacy-css theme:check
 */
import { generate } from './sync-theme.mjs';

const { diffs } = generate({ check: true });
if (diffs.length > 0) {
  console.error(`[theme-check] token 产物与最新生成不一致：${diffs.join(', ')}`);
  console.error('请运行 pnpm --filter @tzj/legacy-css sync 并提交更新。');
  process.exit(1);
}
console.log('[theme-check] OK：token 产物与最新生成一致');
