'use client';

import { ResourceEditor } from '@/components/crud/ResourceEditor';
import { blogConfig } from '@/features/resources/blog';

export default function NewBlogPage() {
  return <ResourceEditor config={blogConfig} />;
}
