"use client";

import { ResourceListView } from "@/components/crud/ResourceListView";
import { blogConfig } from "@/features/resources/blog";

export default function BlogPage() {
  return <ResourceListView config={blogConfig} />;
}
