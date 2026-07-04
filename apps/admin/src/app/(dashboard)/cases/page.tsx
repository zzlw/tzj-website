"use client";

import { ResourceListView } from "@/components/crud/ResourceListView";
import { casesConfig } from "@/features/resources/cases";

export default function CasesPage() {
  return <ResourceListView config={casesConfig} />;
}
