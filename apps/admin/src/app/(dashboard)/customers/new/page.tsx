'use client';

import { ResourceEditor } from '@/components/crud/ResourceEditor';
import { customersConfig } from '@/features/resources/customers';

export default function NewCustomerPage() {
  return <ResourceEditor config={customersConfig} />;
}
