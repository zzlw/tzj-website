"use client";

import { DocumentsHub } from "@/components/documents/DocumentsHub";
import { documentsConfig } from "@/features/resources/documents";

export default function DocumentsPage() {
  return <DocumentsHub config={documentsConfig} />;
}
