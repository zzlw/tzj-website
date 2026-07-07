"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Globe,
  Loader2,
  Lock,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@tzj/ui";
import { api } from "@/lib/apiClient";
import { useRoleOptions } from "@/features/access";
import { notifyError, notifySuccess } from "@/lib/notify";

// ─── Types ────────────────────────────────────────────

type PermissionRole = "viewer" | "editor";
type PermissionTargetType = "user" | "role" | "public";

interface PermissionItem {
  id: string;
  documentId: string;
  role: PermissionRole;
  targetType: PermissionTargetType;
  targetId: string | null;
  targetName?: string | null;
  grantedBy?: string | null;
  grantorName?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserOption {
  id: string;
  username: string;
  nickname?: string | null;
}

// ─── Props ────────────────────────────────────────────

export interface DocumentPermissionDialogProps {
  documentId: string | null;
  documentTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Helpers ──────────────────────────────────────────

const ROLE_LABELS: Record<PermissionRole, string> = {
  viewer: "可查看",
  editor: "可编辑",
};

const TARGET_LABELS: Record<PermissionTargetType, string> = {
  user: "指定用户",
  role: "指定角色",
  public: "所有人",
};

// ─── Component ────────────────────────────────────────

export function DocumentPermissionDialog({
  documentId,
  documentTitle,
  open,
  onOpenChange,
}: DocumentPermissionDialogProps) {
  const qc = useQueryClient();

  // ── Fetch current permissions ──
  const {
    data: permissions = [],
    isLoading: loadingPerms,
  } = useQuery<PermissionItem[]>({
    queryKey: ["documents", documentId, "permissions"],
    queryFn: () =>
      api.query<PermissionItem[]>(`documents/${documentId}/permissions`),
    enabled: open && !!documentId,
  });

  // ── Fetch available users ──
  const { data: usersData } = useQuery<{ data: UserOption[] }>({
    queryKey: ["users", "list", "all"],
    queryFn: () =>
      api
        .list<UserOption>("users", { limit: 200 })
        .then((r) => ({ data: r.data })),
    enabled: open,
    staleTime: 60_000,
  });
  const users = usersData?.data ?? [];

  // ── Fetch role options ──
  const { data: roleOptions = [] } = useRoleOptions();

  // ── Add permission mutation ──
  const addMut = useMutation({
    mutationFn: (payload: {
      role: PermissionRole;
      targetType: PermissionTargetType;
      targetId?: string | null;
    }) =>
      api.post<PermissionItem>(`documents/${documentId}/permissions`, payload),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["documents", documentId, "permissions"],
      });
      notifySuccess("已添加权限");
    },
    onError: (e) => notifyError(e, "添加权限失败"),
  });

  // ── Remove permission mutation ──
  const removeMut = useMutation({
    mutationFn: (permId: string) =>
      api.remove(`documents/${documentId}/permissions`, permId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["documents", documentId, "permissions"],
      });
      notifySuccess("已移除权限");
    },
    onError: (e) => notifyError(e, "移除权限失败"),
  });

  // ── Local form state for adding a new permission ──
  const [addType, setAddType] = useState<PermissionTargetType | undefined>(
    undefined,
  );
  const [addTarget, setAddTarget] = useState("");
  const [addRole, setAddRole] = useState<PermissionRole | undefined>(undefined);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setAddType(undefined);
      setAddTarget("");
      setAddRole(undefined);
    }
  }, [open]);

  // ── Check if public access is already configured ──
  const hasPublic = useMemo(
    () => permissions.some((p) => p.targetType === "public"),
    [permissions],
  );

  // ── Handle add ──
  const handleAdd = useCallback(() => {
    if (!addType || !addRole) return;

    if (addType === "public") {
      addMut.mutate({ role: addRole, targetType: "public" });
      setAddType(undefined);
      setAddRole(undefined);
    } else if (addTarget) {
      addMut.mutate({
        role: addRole,
        targetType: addType,
        targetId: addTarget,
      });
      setAddType(undefined);
      setAddTarget("");
      setAddRole(undefined);
    }
  }, [addType, addTarget, addRole, addMut]);

  // ── Available users (excluding already-added) ──
  const addedUserIds = useMemo(
    () =>
      new Set(
        permissions
          .filter((p) => p.targetType === "user")
          .map((p) => p.targetId),
      ),
    [permissions],
  );
  const availableUsers = useMemo(
    () => users.filter((u) => !addedUserIds.has(u.id)),
    [users, addedUserIds],
  );

  // ── Available roles (excluding already-added) ──
  const addedRoleSlugs = useMemo(
    () =>
      new Set(
        permissions
          .filter((p) => p.targetType === "role")
          .map((p) => p.targetId),
      ),
    [permissions],
  );
  const availableRoles = useMemo(
    () => roleOptions.filter((r) => !addedRoleSlugs.has(r.value)),
    [roleOptions, addedRoleSlugs],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            权限管理
          </DialogTitle>
          <DialogDescription>
            管理「{documentTitle ?? "文档"}」的可见范围和编辑权限
          </DialogDescription>
        </DialogHeader>

        <TooltipProvider>
          <div className="space-y-4">
            {/* ── Add permission form ── */}
            <div className="flex items-end gap-2">
              {/* Target type */}
              <div className="w-[110px] space-y-1">
                <label className="text-xs text-muted-foreground">
                  授权对象
                </label>
                <Select
                  onValueChange={(v) => {
                    setAddType(v as PermissionTargetType);
                    setAddTarget("");
                  }}
                >
                  <SelectTrigger className="h-9">
                    {addType ? (
                      <SelectValue />
                    ) : (
                      <span className="text-muted-foreground">选择类型</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        用户
                      </span>
                    </SelectItem>
                    <SelectItem value="role">
                      <span className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="h-4 px-1 text-[10px]"
                        >
                          R
                        </Badge>
                        角色
                      </span>
                    </SelectItem>
                    {!hasPublic && (
                      <SelectItem value="public">
                        <span className="flex items-center gap-1.5">
                          <Globe className="h-3.5 w-3.5" />
                          所有人
                        </span>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Target selector */}
              {!addType && (
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">
                    选择目标
                  </label>
                  <div className="flex h-9 items-center rounded-md border px-3 text-sm text-muted-foreground">
                    请先选择授权对象类型
                  </div>
                </div>
              )}

              {addType === "user" && (
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">
                    选择用户
                  </label>
                  <Select
                    onValueChange={setAddTarget}
                  >
                    <SelectTrigger className="h-9">
                      {addTarget ? (
                        <SelectValue />
                      ) : (
                        <span className="text-muted-foreground">选择用户…</span>
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          无可用用户
                        </div>
                      ) : (
                        availableUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.nickname || u.username}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {addType === "role" && (
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">
                    选择角色
                  </label>
                  <Select
                    onValueChange={setAddTarget}
                  >
                    <SelectTrigger className="h-9">
                      {addTarget ? (
                        <SelectValue />
                      ) : (
                        <span className="text-muted-foreground">选择角色…</span>
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.length === 0 ? (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          无可用角色
                        </div>
                      ) : (
                        availableRoles.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {addType === "public" && (
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">
                    公开访问
                  </label>
                  <div className="flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm text-muted-foreground">
                    <Globe className="h-3.5 w-3.5" />
                    所有人可访问
                  </div>
                </div>
              )}

              {/* Role selector */}
              <div className="w-[110px] space-y-1">
                <label className="text-xs text-muted-foreground">权限</label>
                <Select
                  onValueChange={(v) => setAddRole(v as PermissionRole)}
                >
                  <SelectTrigger className="h-9">
                    {addRole ? (
                      <SelectValue />
                    ) : (
                      <span className="text-muted-foreground">选择权限</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">可查看</SelectItem>
                    <SelectItem value="editor">可编辑</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Add button */}
              <Button
                size="sm"
                className="h-9 w-9 shrink-0 p-0"
                disabled={
                  addMut.isPending ||
                  !addType ||
                  !addRole ||
                  (addType !== "public" && !addTarget)
                }
                onClick={handleAdd}
              >
                {addMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
              </Button>
            </div>

            <Separator />

            {/* ── Current permissions list ── */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                已授权 ({permissions.length})
              </h4>

              {loadingPerms ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : permissions.length === 0 ? (
                <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                  尚未设置任何权限，仅文档所有者和管理员可访问
                </div>
              ) : (
                <ul className="max-h-[280px] space-y-1 overflow-y-auto">
                  {permissions.map((perm) => (
                    <li
                      key={perm.id}
                      className="group flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        {/* Icon */}
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                          {perm.targetType === "public" ? (
                            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : perm.targetType === "user" ? (
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <Badge
                              variant="outline"
                              className="h-4 px-1 text-[10px]"
                            >
                              R
                            </Badge>
                          )}
                        </span>
                        {/* Name + type badge */}
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <span className="truncate text-sm">
                            {perm.targetName ??
                              TARGET_LABELS[perm.targetType]}
                          </span>
                          <Badge
                            variant="secondary"
                            className="shrink-0 text-[10px]"
                          >
                            {TARGET_LABELS[perm.targetType]}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant={
                            perm.role === "editor" ? "default" : "outline"
                          }
                          className="text-[11px]"
                        >
                          {ROLE_LABELS[perm.role] ?? perm.role}
                        </Badge>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 transition-opacity"
                              disabled={removeMut.isPending}
                              onClick={() => removeMut.mutate(perm.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>移除权限</TooltipContent>
                        </Tooltip>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}
