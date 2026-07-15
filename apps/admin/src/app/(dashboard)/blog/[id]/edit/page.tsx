'use client';

import { use } from 'react';
import { ResourceEditor } from '@/components/crud/ResourceEditor';
import { blogConfig } from '@/features/resources/blog';

export default function EditBlogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ResourceEditor config={blogConfig} id={id} />;
}
