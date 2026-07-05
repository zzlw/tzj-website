"use client";

import { useState } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  ScrollArea,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@tzj/ui";
import { Can } from "@/components/Can";
import type { DocFolderScope } from "@/features/documents";
import {
  useCreateDocTag,
  useDeleteDocTag,
  useDocTags,
  useMergeDocTags,
  useRenameDocTag,
} from "@/features/documents";
import { notifyError, notifySuccess } from "@/lib/notify";

export function DocumentTagsManageDialog({
  open,
  onOpenChange,
  folderScope,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderScope: DocFolderScope;
}) {
  const { data: tags, isLoading } = useDocTags(folderScope);
  const createMut = useCreateDocTag(folderScope);
  const renameMut = useRenameDocTag(folderScope);
  const mergeMut = useMergeDocTags(folderScope);
  const deleteMut = useDeleteDocTag(folderScope);

  const [newName, setNewName] = useState("");
  const [renameFrom, setRenameFrom] = useState<string | null>(null);
  const [renameTo, setRenameTo] = useState("");
  const [mergeFrom, setMergeFrom] = useState<string | null>(null);
  const [mergeTo, setMergeTo] = useState("");

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    try {
      await createMut.mutateAsync(name);
      setNewName("");
      notifySuccess(`标签「${name}」已创建`);
    } catch (e) {
      notifyError(e, "创建失败");
    }
  }

  async function handleRenameConfirm() {
    if (!renameFrom || !renameTo.trim()) return;
    try {
      await renameMut.mutateAsync({ from: renameFrom, to: renameTo.trim() });
      setRenameFrom(null);
      setRenameTo("");
      notifySuccess("标签已重命名");
    } catch (e) {
      notifyError(e, "重命名失败");
    }
  }

  async function handleMergeConfirm() {
    if (!mergeFrom || !mergeTo.trim()) return;
    try {
      await mergeMut.mutateAsync({ from: mergeFrom, to: mergeTo.trim() });
      setMergeFrom(null);
      setMergeTo("");
      notifySuccess("标签已合并");
    } catch (e) {
      notifyError(e, "合并失败");
    }
  }

  async function handleDelete(tag: string) {
    if (!window.confirm(`删除标签「${tag}」？将从所有文档中移除。`)) return;
    try {
      await deleteMut.mutateAsync(tag);
      notifySuccess("标签已删除");
    } catch (e) {
      notifyError(e, "删除失败");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5 text-muted-foreground" />
            标签管理
          </DialogTitle>
          <DialogDescription>
            统一管理标签命名；重命名与合并会同步更新所有文档。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <Can anyPerm={["docs.create"]}>
            <div className="space-y-1.5">
              <Label htmlFor="new-tag-name">新建标签</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="new-tag-name"
                  className="min-w-0 flex-1"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="输入标签名称"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleCreate();
                  }}
                />
                <Button
                  className="shrink-0"
                  onClick={() => void handleCreate()}
                  disabled={!newName.trim() || createMut.isPending}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  添加
                </Button>
              </div>
            </div>
          </Can>

          <ScrollArea className="h-[min(360px,50vh)] rounded-md border border-border/80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标签</TableHead>
                  <TableHead className="w-16 text-right">文档</TableHead>
                  <TableHead className="w-28 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      加载中…
                    </TableCell>
                  </TableRow>
                ) : !tags?.length ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      暂无标签，可在上方新建或在编辑文档时添加
                    </TableCell>
                  </TableRow>
                ) : (
                  tags.map((row) => (
                    <TableRow key={row.id ?? row.tag}>
                      <TableCell className="font-medium">{row.tag}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {row.count}
                      </TableCell>
                      <TableCell className="text-right">
                        <Can anyPerm={["docs.manage"]}>
                          <div className="flex justify-end gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="重命名"
                              onClick={() => {
                                setRenameFrom(row.tag);
                                setRenameTo(row.tag);
                                setMergeFrom(null);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              title="删除"
                              onClick={() => void handleDelete(row.tag)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </Can>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          {renameFrom ? (
            <div className="rounded-lg border border-border/80 bg-muted/30 p-3 space-y-2">
              <p className="text-sm font-medium">重命名「{renameFrom}」</p>
              <Input
                value={renameTo}
                onChange={(e) => setRenameTo(e.target.value)}
                placeholder="新名称"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => void handleRenameConfirm()}
                  disabled={renameMut.isPending}
                >
                  确认重命名
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRenameFrom(null)}
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={() => {
                    setMergeFrom(renameFrom);
                    setMergeTo("");
                    setRenameFrom(null);
                  }}
                >
                  改为合并…
                </Button>
              </div>
            </div>
          ) : null}

          {mergeFrom ? (
            <div className="rounded-lg border border-border/80 bg-muted/30 p-3 space-y-2">
              <p className="text-sm font-medium">
                将「{mergeFrom}」合并到
              </p>
              <Input
                value={mergeTo}
                onChange={(e) => setMergeTo(e.target.value)}
                placeholder="目标标签名"
                list="tag-suggestions"
              />
              <datalist id="tag-suggestions">
                {tags?.map((t) => (
                  <option key={t.tag} value={t.tag} />
                ))}
              </datalist>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => void handleMergeConfirm()}
                  disabled={mergeMut.isPending}
                >
                  确认合并
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setMergeFrom(null)}
                >
                  取消
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border/60 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
