'use client';

import { use } from 'react';
import { ResourceEditor } from '@/components/crud/ResourceEditor';
import { customersConfig } from '@/features/resources/customers';

export default function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ResourceEditor config={customersConfig} id={id} />;
}
