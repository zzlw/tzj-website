'use client';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@tzj/ui';
import { BookOpen, ChevronDown, HelpCircle } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * 验证器 App 使用教程（纯静态内容，无 API 依赖——登录页处于未认证态，必须可独立渲染）。
 * 两种形态复用同一份内容：Dialog（登录页 / TwoFactorCard / 向导扫码步）与
 * Collapsible（向导第一步内嵌，默认收起避免视觉跳动）。
 * 见 docs/login-multi-identifier-and-2fa-guide-design.md §四。
 */

/** 教程内容单一事实来源：改这里全站生效 */
function AuthenticatorGuideContent() {
  return (
    <div className="space-y-4 text-sm text-muted-foreground">
      <section className="space-y-1">
        <h4 className="font-medium text-foreground">什么是验证器 App</h4>
        <p>
          基于 TOTP 标准的动态口令工具，每 30 秒生成一个 6 位验证码，离线可用、不依赖短信。
          登录时输入当前显示的验证码即可完成两步验证。
        </p>
      </section>
      <section className="space-y-1">
        <h4 className="font-medium text-foreground">第一步：安装（任选其一，均免费）</h4>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Microsoft Authenticator —— iOS App Store / 各安卓应用商店搜索「Microsoft
            Authenticator」；
          </li>
          <li>Google Authenticator；</li>
          <li>其他兼容 TOTP 的 App（1Password、Bitwarden、华为「花瓣密码」等）。</li>
        </ul>
      </section>
      <section className="space-y-1">
        <h4 className="font-medium text-foreground">第二步：添加账户</h4>
        <ol className="list-decimal space-y-1 pl-5">
          <li>打开 App，点「添加账户」或「+」；</li>
          <li>选择「扫描二维码」，对准绑定页面展示的二维码；</li>
          <li>无法扫码时选「手动输入」，粘贴页面展示的密钥（类型选「基于时间」）。</li>
        </ol>
      </section>
      <section className="space-y-1">
        <h4 className="font-medium text-foreground">第三步：登录时使用</h4>
        <p>
          输完密码后，打开 App 找到「TZJ Admin」条目，输入当前显示的 6 位数字。 验证码每 30
          秒刷新，输入超时就换下一个码重试。
        </p>
      </section>
      <section className="space-y-1">
        <h4 className="font-medium text-foreground">常见问题</h4>
        <ul className="list-disc space-y-1 pl-5">
          <li>验证码总是错误 → 检查手机系统时间是否为「自动同步」（TOTP 依赖时间一致）；</li>
          <li>
            换手机 → 旧手机可用时先在新设备重新扫码（到「设置 → 安全」重新绑定）；
            旧手机不可用时用恢复码登录后重新绑定；
          </li>
          <li>手机丢失且无恢复码 → 联系超级管理员重置。</li>
        </ul>
      </section>
    </div>
  );
}

/** Dialog 形态：默认 trigger 为「如何使用验证器 App？」文字链 */
export function AuthenticatorGuideDialog({ trigger }: { trigger?: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            如何使用验证器 App？
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>验证器 App 使用教程</DialogTitle>
          <DialogDescription>安装、绑定与日常登录使用说明</DialogDescription>
        </DialogHeader>
        <AuthenticatorGuideContent />
      </DialogContent>
    </Dialog>
  );
}

/** Collapsible 形态：内嵌在绑定向导第一步，默认收起（可能处于 form 内，显式 type="button" 避免误提交） */
export function AuthenticatorGuideCollapsible() {
  return (
    <Collapsible className="rounded-lg border bg-muted/30">
      <CollapsibleTrigger
        type="button"
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/50 [&[data-panel-open]>svg.chevron]:rotate-180"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          第一次使用？先看教程准备好验证器 App
        </span>
        <ChevronDown className="chevron h-4 w-4 shrink-0 text-muted-foreground transition-transform" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-4 py-4">
        <AuthenticatorGuideContent />
      </CollapsibleContent>
    </Collapsible>
  );
}
