"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Alert, Button, Card, CardContent } from "@tzj/ui";
import { Can } from "@/components/Can";
import { useOne, useCreate, useUpdate } from "@/features/hooks";
import { normalizeValues } from "@/features/normalize";
import { ApiError } from "@/lib/apiClient";
import type { ResourceConfig } from "./config";
import { ResourceForm } from "./ResourceForm";
import { ImagePreviewProvider } from "@/components/media/ImagePreviewProvider";

const FORM_ID = "resource-editor-form";

export function ResourceEditor<T extends { id: string }>({
  config,
  id,
  dynamicOptions,
}: {
  config: ResourceConfig<T>;
  /** 传入则为编辑模式；不传为新建。 */
  id?: string;
  dynamicOptions?: Record<string, { label: string; value: string }[]>;
}) {
  const router = useRouter();
  const isEdit = Boolean(id);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: item, isLoading, isError, error } = useOne<T>(
    config.resource,
    id,
  );
  const createMut = useCreate<T>(config.resource);
  const updateMut = useUpdate<T>(config.resource);
  const isSaving = createMut.isPending || updateMut.isPending;

  const defaults = useMemo(() => {
    if (!isEdit) return config.defaults;
    if (!item) return null;
    return config.toForm ? config.toForm(item) : { ...config.defaults, ...item };
  }, [isEdit, item, config]);

  async function handleSubmit(values: Record<string, unknown>) {
    setFormError(null);
    const payload = normalizeValues(config.fields, values);
    try {
      if (isEdit && item) {
        await updateMut.mutateAsync({ id: item.id, payload });
      } else {
        await createMut.mutateAsync(payload);
      }
      router.push(config.basePath);
      router.refresh();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "保存失败");
      window.scrollTo({ top: 0, behavior: "smooth" });
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
        <Can anyPerm={["content.create", "content.edit"]}>
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

      {formError && (
        <Alert variant="destructive" icon="error" className="mb-4">
          {formError}
        </Alert>
      )}

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
                onSubmit={handleSubmit}
              />
            </ImagePreviewProvider>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
