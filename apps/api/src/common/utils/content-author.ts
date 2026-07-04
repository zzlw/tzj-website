import type { PrismaService } from "../../prisma/prisma.service";

/** 后台内容作者展示：账户名（昵称优先）+ 手机号。 */
export function formatAuthorLabel(user: {
  nickname: string | null;
  username: string;
  phone: string | null;
}): string {
  const name = (user.nickname?.trim() || user.username).trim();
  const phone = user.phone?.trim();
  return phone ? `${name} ${phone}` : name;
}

export async function resolveContentAuthor(
  prisma: PrismaService,
  userId: string,
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { nickname: true, username: true, phone: true },
  });
  if (!user) return "未知用户";
  return formatAuthorLabel(user);
}
