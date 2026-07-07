"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
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
import { useDocFolderOptions } from "@/features/documents";
import { useUpdate } from "@/features/hooks";
import type { InternalDocumentItem } from "@/features/types";
import { notifyError, notifySuccess } from "@/lib/notify";

export function DocumentPublishDialog({
  documentId,
  documentTitle,
  currentFolderId,
  open,
  onOpenChange,
  onSuccess,
}: {
  documentId: string;
  documentTitle: string;
  currentFolderId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const { options, isLoading: foldersLoading } = useDocFolderOptions("shared");
  const publishMut = useUpdate<InternalDocumentItem>("documents");
  const [folderId, setFolderId] = useState("");

  useEffect(() => {
    if (open) {
      setFolderId(currentFolderId ?? "");
    }
  }, [open, currentFolderId]);

  async function handleConfirm() {
    try {
      await publishMut.mutateAsync({
        id: documentId,
        payload: {
          status: "published",
          folderId: folderId || null,
        },
      });
      notifySuccess("已发布，同事现在可以阅读");
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      notifyError(e, "发布失败");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-muted-foreground" />
            发布供同事阅读
          </DialogTitle>
          <DialogDescription>
            将「{documentTitle}」发布到内部文档库，同事现在可以阅读。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="publish-folder">放入文件夹</Label>
          <Select
            value={folderId || "__none__"}
            onValueChange={(v) => setFolderId(v === "__none__" ? "" : v)}
            disabled={foldersLoading}
          >
            <SelectTrigger id="publish-folder">
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

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={publishMut.isPending}>
            {publishMut.isPending ? "发布中…" : "确认发布"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
