"use client";

import { DocumentsHub } from "@/components/documents/DocumentsHub";
import { myDocumentsConfig } from "@/features/resources/documents";

export default function MyDocumentsPage() {
  return (
    <DocumentsHub
      config={myDocumentsConfig}
      staticListParams={{ mine: "1" }}
      loadingLabel="加载文档中心…"
    />
  );
}
