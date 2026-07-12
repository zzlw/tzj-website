"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Alert, Button, Card, CardContent } from "@tzj/ui";
import { Can } from "@/components/Can";
import { useOne, useCreate, useUpdate } from "@/features/hooks";
import { normalizeValues } from "@/features/normalize";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { ResourceConfig } from "./config";
import { ResourceForm } from "./ResourceForm";
import { ImagePreviewProvider } from "@/components/media/ImagePreviewProvider";

function editPerms<T>(config: ResourceConfig<T>) {
  return [...(config.permissions?.edit ?? ["content.create", "content.edit"])];
}

const FORM_ID = "resource-editor-form";

export function ResourceEditor<T extends { id: string }>({
  config,
  id,
  dynamicOptions,
  tagSuggestions,
  defaultOverrides,
}: {
  config: ResourceConfig<T>;
  /** 传入则为编辑模式；不传为新建。 */
  id?: string;
  dynamicOptions?: Record<string, { label: string; value: string }[]>;
  /** tags 字段：已有标签建议列表 */
  tagSuggestions?: string[];
  /** 新建时覆盖 config.defaults 中的字段值 */
  defaultOverrides?: Record<string, unknown>;
}) {
  const router = useRouter();
  const isEdit = Boolean(id);

  const { data: item, isLoading, isError, error } = useOne<T>(
    config.resource,
    id,
  );
  const createMut = useCreate<T>(config.resource);
  const updateMut = useUpdate<T>(config.resource);
  const isSaving = createMut.isPending || updateMut.isPending;

  const defaults = useMemo(() => {
    if (!isEdit)
      return defaultOverrides
        ? { ...config.defaults, ...defaultOverrides }
        : config.defaults;
    if (!item) return null;
    return config.toForm ? config.toForm(item) : { ...config.defaults, ...item };
  }, [isEdit, item, config, defaultOverrides]);

  async function handleSubmit(values: Record<string, unknown>) {
    const payload = normalizeValues(config.fields, values);
    try {
      if (isEdit && item) {
        await updateMut.mutateAsync({ id: item.id, payload });
        notifySuccess(`${config.singular}已更新`);
      } else {
        await createMut.mutateAsync({
          ...payload,
          ...config.createPayloadExtra,
        });
        notifySuccess(`${config.singular}已创建`);
      }
      router.push(config.basePath);
      router.refresh();
    } catch (e) {
      notifyError(e, "保存失败");
    }
  }

  const title = `${isEdit ? "编辑" : "新增"}${config.singular}`;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
            <Link href={config.basePath} aria-label="返回列表">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
        </div>
        <Can
          anyPerm={
            isEdit
              ? editPerms(config)
              : [...(config.permissions?.create ?? editPerms(config))]
          }
        >
          <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
            <Button variant="ghost" asChild>
              <Link href={config.basePath}>取消</Link>
            </Button>
            <Button form={FORM_ID} type="submit" disabled={isSaving || (isEdit && !item)}>
              {isSaving ? "保存中…" : "保存"}
            </Button>
          </div>
        </Can>
      </div>

      {isEdit && isError && (
        <Alert variant="destructive" icon="error" className="mb-4">
          加载失败：{error instanceof Error ? error.message : "未知错误"}
        </Alert>
      )}

      <Card className="border-border/80 shadow-sm">
        <CardContent className="p-6">
          {isEdit && isLoading ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              加载中…
            </div>
          ) : defaults ? (
            <ImagePreviewProvider>
              <ResourceForm
                formId={FORM_ID}
                fields={config.fields}
                schema={config.schema}
                defaultValues={defaults}
                dynamicOptions={dynamicOptions}
                tagSuggestions={tagSuggestions}
                onSubmit={handleSubmit}
              />
            </ImagePreviewProvider>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
