import { redirect } from 'next/navigation';

/**
 * 客户档案落地页：目前客户没有独立只读详情页，编辑页即档案页。
 * 访客抽屉「已转客户 · 查看档案」、询盘列表等多处以 /customers/{id} 为规范入口，
 * 统一在此重定向，避免 404。
 */
export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/customers/${id}/edit`);
}
