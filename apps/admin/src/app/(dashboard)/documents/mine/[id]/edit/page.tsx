"use client";

import { use } from "react";
import { DocumentEditorPage } from "@/components/documents/DocumentEditorPage";
import { myDocumentsConfig } from "@/features/resources/documents";

export default function EditMyDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <DocumentEditorPage config={myDocumentsConfig} id={id} />;
}
