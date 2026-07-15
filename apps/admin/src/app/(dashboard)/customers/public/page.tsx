'use client';

import { CustomerList } from '@/components/customers/CustomerList';

export default function PublicCustomersPage() {
  return <CustomerList scope="public" />;
}
