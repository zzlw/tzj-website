'use client';

import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@tzj/ui';
import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { DocumentPermissionDialog } from '@/components/DocumentPermissionDialog';

export function DocumentPermissionButton({
  documentId,
  documentTitle,
}: {
  documentId: string;
  documentTitle?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)}>
            <ShieldCheck className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>权限管理</TooltipContent>
      </Tooltip>
      <DocumentPermissionDialog
        documentId={documentId}
        documentTitle={documentTitle}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
