"use client";

import { ResourceListView } from "@/components/crud/ResourceListView";
import { newsConfig } from "@/features/resources/news";

export default function NewsPage() {
  return <ResourceListView config={newsConfig} />;
}
