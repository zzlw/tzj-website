'use client';

import { ResourceEditor } from '@/components/crud/ResourceEditor';
import { newsConfig } from '@/features/resources/news';

export default function NewNewsPage() {
  return <ResourceEditor config={newsConfig} />;
}
