'use client';

import { CustomerList } from '@/components/customers/CustomerList';

export default function MyCustomersPage() {
  return <CustomerList scope="mine" />;
}
