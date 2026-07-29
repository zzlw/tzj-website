'use client';

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
} from '@tzj/ui';
import { FolderInput } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDocFolderOptions } from '@/features/documents';
import { useUpdate } from '@/features/hooks';
import type { InternalDocumentItem } from '@/features/types';
import { notifyError, notifySuccess } from '@/lib/notify';

export function DocumentMoveDialog({
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
  const { options, isLoading: foldersLoading } = useDocFolderOptions();
  const moveMut = useUpdate<InternalDocumentItem>('documents');
  const [folderId, setFolderId] = useState('');

  useEffect(() => {
    if (open) {
      setFolderId(currentFolderId ?? '');
    }
  }, [open, currentFolderId]);

  async function handleConfirm() {
    const nextFolderId = folderId || null;
    if (nextFolderId === (currentFolderId ?? null)) {
      onOpenChange(false);
      return;
    }
    try {
      await moveMut.mutateAsync({
        id: documentId,
        payload: { folderId: nextFolderId },
      });
      notifySuccess('文档已移动');
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      notifyError(e, '移动失败');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderInput className="h-5 w-5 text-muted-foreground" />
            移动到文件夹
          </DialogTitle>
          <DialogDescription>将「{documentTitle}」移动到新的分类位置。</DialogDescription>
        </DialogHeader>

        {/* flex-col gap-2 而非 space-y-2：Select 末尾的隐藏 input 会让 space-y 给 Trigger 多加下边距 */}
        <div className="flex flex-col gap-2 py-2">
          <Label htmlFor="move-folder">目标文件夹</Label>
          <Select
            value={folderId || '__none__'}
            onValueChange={(v) => setFolderId(v === '__none__' ? '' : v)}
            disabled={foldersLoading}
          >
            <SelectTrigger id="move-folder">
              <SelectValue placeholder="选择文件夹" />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value || '__none__'} value={opt.value || '__none__'}>
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
          <Button onClick={() => void handleConfirm()} disabled={moveMut.isPending}>
            {moveMut.isPending ? '移动中…' : '确认移动'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
