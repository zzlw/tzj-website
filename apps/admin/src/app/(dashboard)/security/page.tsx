import { redirect } from 'next/navigation';

export default function SecurityIndexPage() {
  redirect('/security/ip-block');
}
