import { redirect } from 'next/navigation';

export default function CustomersIndex() {
  redirect('/customers/mine');
}
