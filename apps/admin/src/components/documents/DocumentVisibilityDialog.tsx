"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
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
} from "@tzj/ui";
import { usePromoteDocument } from "@/features/documents";
import { notifyError, notifySuccess } from "@/lib/notify";

type Visibility = "private" | "public";

export function DocumentVisibilityDialog({
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
  const promoteMut = usePromoteDocument(documentId);
  const [visibility, setVisibility] = useState<Visibility>("private");

  useEffect(() => {
    if (open) {
      setVisibility("private");
    }
  }, [open]);

  async function handleConfirm() {
    if (visibility === "private") {
      // 已经是"仅自己可见"，无需操作
      onOpenChange(false);
      return;
    }

    // "全员可见" → 发布到内部文档（默认未分类）
    try {
      await promoteMut.mutateAsync({
        folderId: null,
        publish: true,
      });
      notifySuccess("已设为全员可见，同事现在可以阅读");
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      notifyError(e, "设置失败");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-muted-foreground" />
            可见范围
          </DialogTitle>
          <DialogDescription>
            设置「{documentTitle}」的可见范围。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="visibility-select">可见范围</Label>
          <Select
            value={visibility}
            onValueChange={(v) => setVisibility(v as Visibility)}
          >
            <SelectTrigger id="visibility-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">仅自己可见</SelectItem>
              <SelectItem value="public">全员可见</SelectItem>
            </SelectContent>
          </Select>
          {visibility === "public" ? (
            <p className="text-xs text-muted-foreground">
              文档将发布到内部文档库（未分类），同事即可阅读，同时从「我的文档」中移除。
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              文档仅自己可见，其他同事无法查看。
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={promoteMut.isPending}>
            {promoteMut.isPending ? "处理中…" : "确认"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
