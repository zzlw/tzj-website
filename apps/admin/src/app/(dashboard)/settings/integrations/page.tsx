"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  KeyRound,
  Loader2,
  Plug,
  Shield,
  XCircle,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Input,
  Label,
  PageHeader,
  Switch,
} from "@tzj/ui";
import type { IntegrationAdminItem, UpdateIntegrationDto } from "@tzj/types";
import { Can } from "@/components/Can";
import { LastOperatorCell } from "@/components/LastOperatorCell";
import { RichHint } from "@/components/RichHint";
import { formatDateTime } from "@/features/constants";
import {
  useIntegrationsOverview,
  useTestIntegration,
  useUpdateIntegration,
} from "@/features/integrations";
import { notifyError, notifySuccess } from "@/lib/notify";

function FieldLabel({
  htmlFor,
  label,
  helpUrl,
  publicField,
}: {
  htmlFor?: string;
  label: string;
  helpUrl?: string;
  publicField?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {publicField && (
        <span className="text-xs font-normal text-muted-foreground">（可公开）</span>
      )}
      {helpUrl && (
        <a
          href={helpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
        >
          查看文档
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function IntegrationSetupGuide({ item }: { item: IntegrationAdminItem }) {
  if (!item.setupGuide?.length) return null;

  return (
    <Collapsible className="rounded-lg border bg-muted/30">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-muted/50 [&[data-state=open]>svg.chevron]:rotate-180">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          配置教程
        </span>
        {(item.updatedAt || item.updatedBy) && (
          <span
            className="hidden shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-normal text-muted-foreground sm:inline-flex"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {item.updatedAt && (
              <time dateTime={item.updatedAt}>{formatDateTime(item.updatedAt)}</time>
            )}
            {item.updatedBy && (
              <>
                {item.updatedAt ? <span aria-hidden>·</span> : null}
                <LastOperatorCell user={item.updatedBy} />
              </>
            )}
          </span>
        )}
        <ChevronDown className="chevron h-4 w-4 shrink-0 text-muted-foreground transition-transform" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 border-t px-4 py-4">
        {item.docUrl && (
          <p className="text-xs">
            <a
              href={item.docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              官方文档
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        )}
        <ol className="space-y-4">
          {item.setupGuide.map((step) => (
            <li key={step.title} className="text-sm">
              <p className="font-medium text-foreground">{step.title}</p>
              <RichHint
                text={step.content}
                className="mt-1 text-xs leading-relaxed text-muted-foreground"
              />
            </li>
          ))}
        </ol>
        {(item.updatedAt || item.updatedBy) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground sm:hidden">
            {item.updatedAt && (
              <span>
                最后更新：
                <time dateTime={item.updatedAt} className="text-foreground">
                  {formatDateTime(item.updatedAt)}
                </time>
              </span>
            )}
            {item.updatedBy && (
              <span className="inline-flex items-center gap-1.5">
                <span>操作人：</span>
                <LastOperatorCell user={item.updatedBy} />
              </span>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function IntegrationCard({ item }: { item: IntegrationAdminItem }) {
  const updateMut = useUpdateIntegration(item.slug);
  const testMut = useTestIntegration(item.slug);

  const [enabled, setEnabled] = useState(item.enabled);
  const [config, setConfig] = useState<Record<string, string>>({ ...item.config });
  const [secretsDraft, setSecretsDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    setEnabled(item.enabled);
    setConfig({ ...item.config });
    setSecretsDraft({});
  }, [item]);

  async function onSave() {
    const payload: UpdateIntegrationDto = { enabled, config };
    const secrets: Record<string, string> = {};
    for (const [key, value] of Object.entries(secretsDraft)) {
      if (value.trim()) secrets[key] = value.trim();
    }
    if (Object.keys(secrets).length > 0) payload.secrets = secrets;

    try {
      await updateMut.mutateAsync(payload);
      setSecretsDraft({});
      notifySuccess(`${item.label} 已保存`);
    } catch (e) {
      notifyError(e, "保存失败");
    }
  }

  async function onTest() {
    try {
      const result = await testMut.mutateAsync();
      if (result.ok) notifySuccess(result.message);
      else notifyError(result.message);
    } catch (e) {
      notifyError(e, "测试失败");
    }
  }

  const saving = updateMut.isPending;
  const testing = testMut.isPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            <Plug className="h-4 w-4 text-muted-foreground" />
            {item.label}
            {item.secretsConfigured && (
              <Badge variant="secondary">DB 已配置</Badge>
            )}
            {item.envFallbackActive && (
              <Badge variant="outline">Env 兜底</Badge>
            )}
          </CardTitle>
          <CardDescription>{item.description}</CardDescription>
        </div>
        <Can perm="integrations.manage">
          <div className="flex items-center gap-2">
            <Label htmlFor={`enabled-${item.slug}`} className="text-sm text-muted-foreground">
              启用
            </Label>
            <Switch
              id={`enabled-${item.slug}`}
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
        </Can>
      </CardHeader>
      <CardContent className="space-y-4">
        <IntegrationSetupGuide item={item} />

        {item.configFields.map((field) => (
          <Can
            key={field.key}
            perm="integrations.manage"
            fallback={
              <div>
                <FieldLabel
                  label={field.label}
                  helpUrl={field.helpUrl}
                  publicField={field.public}
                />
                <p className="mt-1.5 font-mono text-sm text-muted-foreground">
                  {config[field.key] || "—"}
                </p>
              </div>
            }
          >
            <div>
              <FieldLabel
                htmlFor={`${item.slug}-config-${field.key}`}
                label={field.label}
                helpUrl={field.helpUrl}
                publicField={field.public}
              />
              {field.description && (
                <RichHint
                  text={field.description}
                  className="mt-0.5 text-xs text-muted-foreground"
                />
              )}
              <Input
                id={`${item.slug}-config-${field.key}`}
                value={config[field.key] ?? ""}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                className="mt-1.5"
                disabled={!enabled}
              />
            </div>
          </Can>
        ))}

        {item.secretFields.map((field) => (
          <div key={field.key}>
            <FieldLabel
              htmlFor={`${item.slug}-secret-${field.key}`}
              label={field.label}
              helpUrl={field.helpUrl}
            />
            {field.description && (
              <RichHint
                text={field.description}
                className="mt-0.5 text-xs text-muted-foreground"
              />
            )}
            {item.secretsMask[field.key] && (
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                当前：{item.secretsMask[field.key]}
              </p>
            )}
            <Can perm="integrations.manage">
              <Input
                id={`${item.slug}-secret-${field.key}`}
                type="password"
                autoComplete="new-password"
                placeholder={
                  item.secretsMask[field.key]
                    ? "留空则不修改"
                    : "输入密钥"
                }
                value={secretsDraft[field.key] ?? ""}
                onChange={(e) =>
                  setSecretsDraft((prev) => ({
                    ...prev,
                    [field.key]: e.target.value,
                  }))
                }
                className="mt-1.5"
              />
            </Can>
          </div>
        ))}

        <Can perm="integrations.manage">
          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={onSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
            <Button variant="outline" onClick={onTest} disabled={testing}>
              {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              测试连接
            </Button>
          </div>
        </Can>
      </CardContent>
    </Card>
  );
}

export default function IntegrationsSettingsPage() {
  const { data, isLoading, isError, error } = useIntegrationsOverview();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "加载失败"}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="集成与凭证"
        description="管理第三方 API 密钥（加密存储）与公开配置。展开各集成卡片中的「配置教程」可查看分步说明与官方文档链接。基础设施级密钥（JWT、数据库等）仅能在部署环境变量中配置。"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            基础设施密钥（只读）
          </CardTitle>
          <CardDescription>
            以下凭证涉及系统安全，不可通过后台写入，需在服务器 / CI 环境变量或云密钥服务中配置。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y rounded-lg border">
            {data.infrastructure.map((item) => (
              <li
                key={item.key}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{item.key}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {item.configured ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="text-emerald-700">已配置</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-amber-600" />
                      <span className="text-amber-700">未配置</span>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <KeyRound className="h-4 w-4" />
          第三方集成
        </h2>
        {data.integrations.map((item) => (
          <IntegrationCard key={item.slug} item={item} />
        ))}
      </div>
    </div>
  );
}
