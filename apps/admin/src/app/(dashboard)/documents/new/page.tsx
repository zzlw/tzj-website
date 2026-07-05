"use client";

import { DocumentEditorPage } from "@/components/documents/DocumentEditorPage";
import { documentsConfig } from "@/features/resources/documents";

export default function NewDocumentPage() {
  return <DocumentEditorPage config={documentsConfig} />;
}
