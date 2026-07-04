"use client";

import { use } from "react";
import { ResourceEditor } from "@/components/crud/ResourceEditor";
import { casesConfig } from "@/features/resources/cases";

export default function EditCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ResourceEditor config={casesConfig} id={id} />;
}
