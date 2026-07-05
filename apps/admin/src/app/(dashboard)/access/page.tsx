"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  Loader2,
  Pencil,
  Plus,
  Shield,
  Trash2,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  PageHeader,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
} from "@tzj/ui";
import {
  useAccessOverview,
  useCreateRole,
  useRemoveRole,
  useUpdateRole,
} from "@/features/access";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { PermissionGroup, RoleAccessItem } from "@/features/types";
import {
  RoleFormDialog,
  type RoleFormValues,
} from "@/components/access/RoleFormDialog";

function RolePermissionView({
  groups,
  permissions,
}: {
  groups: PermissionGroup[];
  permissions: string[];
}) {
  return (
    <>
      {groups.map((group) => (
        <div key={group.id}>
          <h3 className="mb-3 text-sm font-medium text-foreground">
            {group.label}
          </h3>
          <div className="divide-y divide-border rounded-md border border-border">
            {group.permissions.map((perm) => {
              const granted = permissions.includes(perm.id);
              return (
                <div
                  key={perm.id}
                  className="flex items-start gap-3 px-4 py-3"
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                      granted
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted/30 text-transparent",
                    )}
                  >
                    <Check className="h-3 w-3" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{perm.label}</p>
                    {perm.description ? (
                      <p className="text-xs text-muted-foreground">
                        {perm.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function toFormValues(role: RoleAccessItem): RoleFormValues {
  return {
    name: role.label,
    slug: role.slug,
    description: role.description,
    permissions: [...role.permissions],
  };
}

export default function AccessPage() {
  const { data, isLoading, isError, error } = useAccessOverview();
  const createMut = useCreateRole();
  const updateMut = useUpdateRole();
  const removeMut = useRemoveRole();

  const roles = data?.roles ?? [];
  const groups = data?.groups ?? [];
  const systemRoles = roles.filter((r) => r.system);
  const customRoles = roles.filter((r) => !r.system);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RoleAccessItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleAccessItem | null>(null);

  const selected = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  );

  useEffect(() => {
    if (!roles.length) return;
    if (!selectedRoleId || !roles.some((r) => r.id === selectedRoleId)) {
      setSelectedRoleId(roles[0]!.id);
    }
  }, [roles, selectedRoleId]);

  async function handleCreate(values: RoleFormValues) {
    const created = await createMut.mutateAsync({
      name: values.name.trim(),
      slug: values.slug.trim() || undefined,
      description: values.description.trim() || undefined,
      permissions: values.permissions,
    });
    if (created?.id) setSelectedRoleId(created.id);
    notifySuccess("角色已创建");
  }

  async function handleEdit(values: RoleFormValues) {
    if (!editTarget) return;
    await updateMut.mutateAsync({
      id: editTarget.id,
      payload: {
        name: values.name.trim(),
        description: values.description.trim(),
        permissions: values.permissions,
      },
    });
    setEditTarget(null);
    notifySuccess("角色已更新");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await removeMut.mutateAsync(deleteTarget.id);
      if (selectedRoleId === deleteTarget.id) setSelectedRoleId(null);
      setDeleteTarget(null);
      notifySuccess("角色已删除");
    } catch (e) {
      notifyError(e, "删除失败");
      setDeleteTarget(null);
    }
  }

  function openEdit(role: RoleAccessItem) {
    setEditTarget(role);
    setSelectedRoleId(role.id);
  }

  function renderRoleItem(role: RoleAccessItem) {
    return (
      <button
        key={role.id}
        type="button"
        onClick={() => setSelectedRoleId(role.id)}
        className={cn(
          "flex w-full cursor-pointer items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
          selected?.id === role.id
            ? "bg-accent text-accent-foreground"
            : "hover:bg-muted/60",
        )}
      >
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{role.label}</span>
            {role.system ? (
              <Badge variant="secondary" className="text-[10px]">
                系统
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {role.description || "—"}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {role.userCount} 个启用账号 · {role.slug}
          </p>
        </div>
      </button>
    );
  }

  return (
    <TooltipProvider>
      <div>
        <PageHeader
          title="角色与权限"
          description="管理系统预置角色与自定义角色。在「账号管理」中为成员分配角色即可生效。"
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              创建角色
            </Button>
          }
        />

        <Alert icon="info" className="mb-6">
          系统预置角色不可修改或删除。自定义角色支持编辑与删除；若仍有账号使用，需先在
          <Link href="/users" className="mx-1 font-medium underline underline-offset-2">
            账号管理
          </Link>
          中调整角色后再删除。
        </Alert>

        {isError && (
          <Alert variant="destructive" icon="error" className="mb-4">
            加载失败：{error instanceof Error ? error.message : "未知错误"}
          </Alert>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <Card className="h-fit">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">角色列表</CardTitle>
                <CardDescription>选择角色查看权限明细</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-2 pt-0">
                {systemRoles.length > 0 ? (
                  <div>
                    <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      系统角色
                    </p>
                    <div className="space-y-0.5">{systemRoles.map(renderRoleItem)}</div>
                  </div>
                ) : null}
                {customRoles.length > 0 ? (
                  <div>
                    <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      自定义角色
                    </p>
                    <div className="space-y-0.5">{customRoles.map(renderRoleItem)}</div>
                  </div>
                ) : (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                    暂无自定义角色，点击右上角创建
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="text-base">
                    {selected?.label ?? "—"} · 权限明细
                  </CardTitle>
                  <CardDescription>
                    {selected?.system
                      ? "系统预置角色，权限由平台定义，不可修改。"
                      : "自定义角色。修改权限后，使用该角色的账号需重新登录生效。"}
                  </CardDescription>
                </div>
                {selected && !selected.system ? (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(selected)}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      编辑
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={selected.userCount > 0 || removeMut.isPending}
                            onClick={() => setDeleteTarget(selected)}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            删除
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {selected.userCount > 0 ? (
                        <TooltipContent>
                          仍有 {selected.userCount} 个账号使用此角色，请先在账号管理中调整
                        </TooltipContent>
                      ) : null}
                    </Tooltip>
                  </div>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-6">
                {selected ? (
                  <RolePermissionView
                    groups={groups}
                    permissions={selected.permissions}
                  />
                ) : null}
              </CardContent>
            </Card>
          </div>
        )}

        <RoleFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          groups={groups}
          title="创建自定义角色"
          description="为团队成员定义专属权限组合。创建后可在账号管理中分配。"
          onSubmit={handleCreate}
        />

        <RoleFormDialog
          open={editTarget !== null}
          onOpenChange={(open) => !open && setEditTarget(null)}
          groups={groups}
          title="编辑角色"
          description="修改名称、描述或权限范围。权限变更后，相关账号需重新登录。"
          submitLabel="保存"
          initialValues={editTarget ? toFormValues(editTarget) : undefined}
          onSubmit={handleEdit}
        />

        <ConfirmDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title="删除角色"
          description={
            deleteTarget
              ? `确定删除「${deleteTarget.label}」？此操作不可撤销。`
              : undefined
          }
          confirmLabel="删除"
          onConfirm={handleDelete}
          loading={removeMut.isPending}
        />
      </div>
    </TooltipProvider>
  );
}
