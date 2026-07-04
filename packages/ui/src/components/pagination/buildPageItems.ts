/** 生成带省略号的页码序列（shadcn / Ant Design 同款策略） */
export function buildPageItems(
  page: number,
  totalPages: number,
): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items: (number | "ellipsis")[] = [1];
  if (page > 3) items.push("ellipsis");

  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  for (let i = start; i <= end; i += 1) items.push(i);

  if (page < totalPages - 2) items.push("ellipsis");
  if (totalPages > 1) items.push(totalPages);
  return items;
}
