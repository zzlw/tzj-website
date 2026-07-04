"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
  cn,
} from "@tzj/ui";
import type { PermissionGroup } from "@/features/types";
import { ApiError } from "@/lib/apiClient";

export interface RoleFormValues {
  name: string;
  slug: string;
  description: string;
  permissions: string[];
}

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: PermissionGroup[];
  title: string;
  description?: string;
  submitLabel?: string;
  initialValues?: RoleFormValues;
  onSubmit: (values: RoleFormValues) => Promise<void>;
}

const EMPTY: RoleFormValues = {
  name: "",
  slug: "",
  description: "",
  permissions: [],
};

export function PermissionMatrix({
  groups,
  selected,
  onChange,
}: {
  groups: PermissionGroup[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((p) => p !== id)
        : [...selected, id],
    );
  }

  function toggleGroup(group: PermissionGroup) {
    const ids = group.permissions.map((p) => p.id);
    const allOn = ids.every((id) => selected.includes(id));
    if (allOn) {
      onChange(selected.filter((p) => !ids.includes(p)));
    } else {
      onChange([...new Set([...selected, ...ids])]);
    }
  }

  return (
    <div className="max-h-[min(50vh,420px)] space-y-4 overflow-y-auto pr-1">
      {groups.map((group) => {
        const ids = group.permissions.map((p) => p.id);
        const allOn = ids.every((id) => selected.includes(id));
        const someOn = ids.some((id) => selected.includes(id));
        return (
          <div key={group.id}>
            <button
              type="button"
              onClick={() => toggleGroup(group)}
              className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-medium hover:text-foreground"
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded border text-[10px]",
                  allOn
                    ? "border-primary bg-primary text-primary-foreground"
                    : someOn
                      ? "border-primary bg-primary/20"
                      : "border-border",
                )}
              >
                {allOn ? "✓" : someOn ? "−" : ""}
              </span>
              {group.label}
            </button>
            <div className="space-y-1 rounded-md border border-border p-2">
              {group.permissions.map((perm) => {
                const checked = selected.includes(perm.id);
                return (
                  <label
                    key={perm.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 accent-primary"
                      checked={checked}
                      onChange={() => toggle(perm.id)}
                    />
                    <span>
                      <span className="text-sm font-medium">{perm.label}</span>
                      {perm.description ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {perm.description}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RoleFormDialog({
  open,
  onOpenChange,
  groups,
  title,
  description,
  submitLabel = "创建",
  initialValues,
  onSubmit,
}: RoleFormDialogProps) {
  const [values, setValues] = useState<RoleFormValues>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEdit = Boolean(initialValues);

  useEffect(() => {
    if (open) {
      setValues(initialValues ?? EMPTY);
      setError(null);
    }
  }, [open, initialValues]);

  const canSubmit = useMemo(
    () => values.name.trim().length > 0 && values.permissions.length > 0,
    [values.name, values.permissions.length],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : null}
          </DialogHeader>

          {error ? (
            <Alert variant="destructive" icon="error" className="mt-4">
              {error}
            </Alert>
          ) : null}

          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">角色名称</Label>
              <Input
                id="role-name"
                value={values.name}
                onChange={(e) =>
                  setValues((v) => ({ ...v, name: e.target.value }))
                }
                placeholder="例如：内容审核员"
                maxLength={64}
                required
              />
            </div>

            {!isEdit ? (
              <div className="space-y-2">
                <Label htmlFor="role-slug">标识（可选）</Label>
                <Input
                  id="role-slug"
                  value={values.slug}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, slug: e.target.value }))
                  }
                  placeholder="留空则根据名称自动生成"
                  maxLength={64}
                />
                <p className="text-xs text-muted-foreground">
                  小写字母、数字与连字符，创建后不可修改。
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="role-slug-readonly">标识</Label>
                <Input id="role-slug-readonly" value={values.slug} disabled />
                <p className="text-xs text-muted-foreground">
                  角色标识创建后不可修改。
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="role-desc">描述（可选）</Label>
              <Textarea
                id="role-desc"
                value={values.description}
                onChange={(e) =>
                  setValues((v) => ({ ...v, description: e.target.value }))
                }
                rows={2}
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label>权限</Label>
              <PermissionMatrix
                groups={groups}
                selected={values.permissions}
                onChange={(permissions) => setValues((v) => ({ ...v, permissions }))}
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              取消
            </Button>
            <Button type="submit" disabled={!canSubmit || saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中…
                </>
              ) : (
                submitLabel
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
