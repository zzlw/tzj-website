"use client";

import { use } from "react";
import { DocumentReadPageContent } from "@/components/documents/DocumentReadPageContent";

export default function DocumentReadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <DocumentReadPageContent id={id} expectedScope="shared" />;
}
