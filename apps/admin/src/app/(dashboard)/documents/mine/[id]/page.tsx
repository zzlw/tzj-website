"use client";

import { use } from "react";
import { DocumentReadPageContent } from "@/components/documents/DocumentReadPageContent";

export default function MyDocumentReadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <DocumentReadPageContent id={id} />;
}
