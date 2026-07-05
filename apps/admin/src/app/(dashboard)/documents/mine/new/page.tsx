"use client";

import { DocumentEditorPage } from "@/components/documents/DocumentEditorPage";
import { myDocumentsConfig } from "@/features/resources/documents";

export default function NewMyDocumentPage() {
  return <DocumentEditorPage config={myDocumentsConfig} />;
}
