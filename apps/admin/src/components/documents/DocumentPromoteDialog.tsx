"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@tzj/ui";
import {
  useDocFolderOptions,
  usePromoteDocument,
} from "@/features/documents";
import { notifyError, notifySuccess } from "@/lib/notify";

export function DocumentPromoteDialog({
  documentId,
  documentTitle,
  open,
  onOpenChange,
  onSuccess,
}: {
  documentId: string;
  documentTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { options, isLoading: foldersLoading } = useDocFolderOptions("shared");
  const promoteMut = usePromoteDocument(documentId);
  const [folderId, setFolderId] = useState("");
  const [publish, setPublish] = useState(true);

  useEffect(() => {
    if (open) {
      setPublish(true);
    }
  }, [open]);

  async function handleConfirm() {
    try {
      await promoteMut.mutateAsync({
        folderId: folderId || null,
        publish,
      });
      notifySuccess(
        publish
          ? "已分享到公司知识库，同事现在可以阅读"
          : "已移入内部文档草稿，发布前仅编辑者可见",
      );
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      notifyError(e, "分享失败");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            分享到公司知识库
          </DialogTitle>
          <DialogDescription className="space-y-2 pt-1">
            <span className="block">
              「{documentTitle}」将移入「内部文档」，从「我的文档」中移除。
            </span>
            <span className="block text-xs">
              与 Notion「移入团队空间」、Confluence「发布到团队空间」相同：个人草稿区 → 组织知识库。
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="promote-folder">放入文件夹</Label>
            <Select
              value={folderId || "__none__"}
              onValueChange={(v) => setFolderId(v === "__none__" ? "" : v)}
              disabled={foldersLoading}
            >
              <SelectTrigger id="promote-folder">
                <SelectValue placeholder="选择内部分类" />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) => (
                  <SelectItem
                    key={opt.value || "__none__"}
                    value={opt.value || "__none__"}
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-border/80 bg-muted/30 px-3 py-3">
            <div className="space-y-0.5">
              <Label htmlFor="promote-publish" className="text-sm font-medium">
                立即对同事可见
              </Label>
              <p className="text-xs text-muted-foreground">
                开启后拥有「查看内部文档」权限的同事即可阅读；关闭则先进入内部草稿，需另行发布
              </p>
            </div>
            <Switch
              id="promote-publish"
              checked={publish}
              onCheckedChange={setPublish}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={promoteMut.isPending}>
            {promoteMut.isPending
              ? "处理中…"
              : publish
                ? "确认分享"
                : "移入内部草稿"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
