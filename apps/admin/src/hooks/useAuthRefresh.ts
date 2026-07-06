"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { refreshAccessToken } from "@/lib/tokenRefresh";
import { COOKIE } from "@/lib/config";

/**
 * useAuthRefresh: 客户端自动刷新 Token Hook
 * 
 * 职责：
 * 1. 拦截所有 fetch/API 请求的 401 响应
 * 2. 自动使用 refresh token 换取新的 access token
 * 3. 刷新成功 → 重试原请求
 * 4. 刷新失败 → 重定向到登录页
 * 
 * 用法：在 Providers 或根 layout 中调用一次即可全局生效
 */
export function useAuthRefresh() {
  const router = useRouter();
  
  // 防止并发刷新（多个 401 同时触发）
  let isRefreshing = false;
  let pendingRequests: Array<{ resolve: (value: Response | null) => void; reject: (reason?: any) => void }> = [];

  /**
   * 处理 401 错误：尝试刷新 token 并重试
   */
  const handle401 = useCallback(async (originalRequest: RequestInit): Promise<Response | null> => {
    if (isRefreshing) {
      // 正在刷新，将请求加入队列等待
      return new Promise((resolve, reject) => {
        pendingRequests.push({ resolve, reject });
      });
    }

    isRefreshing = true;

    try {
      // 尝试刷新 token
      const refreshToken = document.cookie.split('; ').find(row => row.startsWith(`${COOKIE.refresh}=`))?.split('=')[1];
      const refreshed = await refreshAccessToken(refreshToken);
      
      if (!refreshed) {
        // 刷新失败 → 登出
        console.warn("[AuthRefresh] Token refresh failed, redirecting to login...");
        document.cookie = `${COOKIE.access}=; path=/; max-age=0`;
        document.cookie = `${COOKIE.refresh}=; path=/; max-age=0`;
        router.replace("/login?reason=token_refresh_failed");
        return null;
      }

      // 刷新成功 → 更新 cookie
      document.cookie = `${COOKIE.access}=${refreshed.accessToken}; path=/; max-age=3600; SameSite=Lax`;
      document.cookie = `${COOKIE.refresh}=${refreshed.refreshToken}; path=/; max-age=604800; SameSite=Lax`;

      // 通知等待的请求可以重试
      pendingRequests.forEach(({ resolve }) => resolve(null));
      pendingRequests = [];

      // 返回 null 表示需要重试原请求
      return null;
    } catch (error) {
      console.error("[AuthRefresh] Token refresh error:", error);
      // 刷新出错 → 登出
      document.cookie = `${COOKIE.access}=; path=/; max-age=0`;
      document.cookie = `${COOKIE.refresh}=; path=/; max-age=0`;
      router.replace("/login?reason=token_refresh_error");
      return null;
    } finally {
      isRefreshing = false;
    }
  }, [router]);

  /**
   * 包装 fetch 函数，自动处理 401
   */
  useEffect(() => {
    // 保存原始 fetch
    const originalFetch = window.fetch;

    // 重写 fetch
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const response = await originalFetch(input, init || {});

      // 如果是 401 且不是登录/刷新接口本身
      if (response.status === 401) {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : '';
        if (!url.includes('/auth/login') && !url.includes('/auth/refresh')) {
          // 尝试刷新 token
          const retryResult = await handle401(init || {});
          
          if (retryResult === null) {
            // 刷新成功，重试原请求
            console.log("[AuthRefresh] Retrying request with new token...");
            return originalFetch(input, {
              ...init,
              headers: {
                ...init?.headers,
                Authorization: `Bearer ${document.cookie.split('; ').find(row => row.startsWith(`${COOKIE.access}=`))?.split('=')[1]}`,
              },
            });
          }
        }
      }

      return response;
    };

    // 清理：恢复原始 fetch
    return () => {
      window.fetch = originalFetch;
    };
  }, [handle401]);
}
