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

  useEffect(() => {
    if (open) {
      setFolderId(""); // 默认选择"未分类"
    }
  }, [open]);

  async function handleConfirm() {
    try {
      await promoteMut.mutateAsync({
        folderId: folderId || null,
        publish: true,
      });
      notifySuccess("已发布到内部文档，同事现在可以阅读");
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      notifyError(e, "发布失败");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            发布到内部文档
          </DialogTitle>
          <DialogDescription>
            将「{documentTitle}」发布到内部文档库，同事即可阅读。发布后将从「我的文档」中移除。
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

        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={promoteMut.isPending}>
            {promoteMut.isPending ? "发布中…" : "确认发布"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
