'use client';

/** Dashboard 分组的就近错误边界：承接嵌套 layout/page 抛出的错误（如权限守卫探测到 API 不可用）。 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h2 className="text-lg font-semibold">页面加载出错</h2>
        <p className="mt-2 text-sm text-muted-foreground break-words">
          {error.message || '发生未知错误'}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-sm bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
        >
          重试
        </button>
      </div>
    </div>
  );
}
