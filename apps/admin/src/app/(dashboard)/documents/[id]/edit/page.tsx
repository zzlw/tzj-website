"use client";

import { use } from "react";
import { DocumentEditorPage } from "@/components/documents/DocumentEditorPage";
import { documentsConfig } from "@/features/resources/documents";

export default function EditDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <DocumentEditorPage config={documentsConfig} id={id} />;
}
