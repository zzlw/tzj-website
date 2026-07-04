"use client";

import { use } from "react";
import { ResourceEditor } from "@/components/crud/ResourceEditor";
import { newsConfig } from "@/features/resources/news";

export default function EditNewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ResourceEditor config={newsConfig} id={id} />;
}
