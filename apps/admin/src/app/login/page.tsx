"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@tzj/ui";
import { BASE_PATH } from "@/lib/config";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${BASE_PATH}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        setError(body.message || "登录失败，请检查用户名或密码");
        return;
      }
      const from = params.get("from");
      router.replace(from && from.startsWith("/") ? from : "/");
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-border/80 bg-card/95 shadow-xl backdrop-blur-sm">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-md">
            TZJ
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl">管理后台登录</CardTitle>
            <CardDescription>拓之迹企业内容管理系统</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                name="username"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                name="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
              />
            </div>

            {error && (
              <Alert variant="destructive" icon="error">
                {error}
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "登录中…" : "登录"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} 河南拓之迹实业有限公司
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
