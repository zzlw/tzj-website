'use client';

import { ResourceEditor } from '@/components/crud/ResourceEditor';
import { casesConfig } from '@/features/resources/cases';

export default function NewCasePage() {
  return <ResourceEditor config={casesConfig} />;
}
