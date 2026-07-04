"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Alert, Button, Card, CardContent } from "@tzj/ui";
import { useOne, useCreate, useUpdate } from "@/features/hooks";
import { ApiError } from "@/lib/apiClient";
import type { UserItem } from "@/features/types";
import {
  createUserSchema,
  updateUserSchema,
  userCreateDefaults,
  userEditDefaults,
  buildUserCreateFields,
  buildUserEditFields,
  FALLBACK_ROLE_OPTIONS,
} from "@/features/users";
import { useRoleOptions } from "@/features/access";
import { ResourceForm } from "@/components/crud/ResourceForm";

const FORM_ID = "user-editor-form";

export function UserEditor({ id }: { id?: string }) {
  const router = useRouter();
  const isEdit = Boolean(id);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: item, isLoading, isError, error } = useOne<UserItem>("users", id);
  const createMut = useCreate<UserItem>("users");
  const updateMut = useUpdate<UserItem>("users");
  const { data: roleOptions = FALLBACK_ROLE_OPTIONS } = useRoleOptions();
  const isSaving = createMut.isPending || updateMut.isPending;

  const fields = useMemo(
    () =>
      isEdit
        ? buildUserEditFields(roleOptions)
        : buildUserCreateFields(roleOptions),
    [isEdit, roleOptions],
  );

  const defaults = useMemo(() => {
    if (!isEdit) return userCreateDefaults;
    if (!item) return null;
    return {
      username: item.username,
      nickname: item.nickname ?? "",
      email: item.email ?? "",
      phone: item.phone ?? "",
      role: item.role,
      isActive: item.isActive,
      password: "",
    };
  }, [isEdit, item]);

  async function handleSubmit(values: Record<string, unknown>) {
    setFormError(null);
    const payload = { ...values };
    if (isEdit && !payload.password) delete payload.password;
    if (!payload.email) payload.email = undefined;
    if (!payload.nickname) payload.nickname = undefined;
    if (!payload.phone) payload.phone = undefined;

    try {
      if (isEdit && item) {
        await updateMut.mutateAsync({ id: item.id, payload });
      } else {
        await createMut.mutateAsync(payload);
      }
      router.push("/users");
      router.refresh();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "保存失败");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const title = isEdit ? "编辑账号" : "新建账号";

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
            <Link href="/users" aria-label="返回列表">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
          <Button variant="ghost" asChild>
            <Link href="/users">取消</Link>
          </Button>
          <Button
            form={FORM_ID}
            type="submit"
            disabled={isSaving || (isEdit && !item)}
          >
            {isSaving ? "保存中…" : "保存"}
          </Button>
        </div>
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

      <Card>
        <CardContent className="pt-6">
          {isEdit && isLoading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">加载中…</p>
          ) : defaults ? (
            <ResourceForm
              formId={FORM_ID}
              fields={fields}
              schema={isEdit ? updateUserSchema : createUserSchema}
              defaultValues={defaults}
              onSubmit={handleSubmit}
              autoSlug={false}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
