import type { Contact } from '@prisma/client/index';

const BRAND = '拓之迹';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderContactStaffNotifyHtml(contact: Contact, adminUrl: string): string {
  const rows = [
    ['姓名', contact.name],
    ['电话', contact.phone ?? '—'],
    ['邮箱', contact.email ?? '—'],
    ['公司', contact.company ?? '—'],
    ['主题', contact.subject ?? '—'],
    ['留言', contact.message],
    ['来源', contact.source ?? 'website'],
    ['提交时间', contact.createdAt.toISOString()],
  ];

  const body = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;border:1px solid #e5e7eb;color:#6b7280;width:120px">${escapeHtml(String(label))}</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${escapeHtml(String(value))}</td></tr>`,
    )
    .join('');

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#111827">
<h2 style="margin:0 0 16px">新询盘通知</h2>
<p>官网收到新的联系表单提交，请及时跟进。</p>
<table style="border-collapse:collapse;width:100%;max-width:640px">${body}</table>
<p style="margin-top:20px"><a href="${escapeHtml(adminUrl)}" style="color:#2563eb">在后台查看询盘 →</a></p>
<p style="font-size:12px;color:#9ca3af">${BRAND} · 系统自动通知，请勿直接回复本邮件</p>
</body></html>`;
}

export function renderContactStaffNotifyText(contact: Contact, adminUrl: string): string {
  return [
    '新询盘通知',
    '',
    `姓名：${contact.name}`,
    `电话：${contact.phone ?? '—'}`,
    `邮箱：${contact.email ?? '—'}`,
    `公司：${contact.company ?? '—'}`,
    `主题：${contact.subject ?? '—'}`,
    `留言：${contact.message}`,
    '',
    `后台查看：${adminUrl}`,
  ].join('\n');
}

export function renderContactAutoReplyHtml(contact: Contact): string {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#111827;line-height:1.6">
<p>尊敬的 ${escapeHtml(contact.name)}，您好！</p>
<p>感谢联系${BRAND}，我们已收到您的留言，工作人员会尽快与您取得联系。</p>
<p style="color:#6b7280;font-size:14px">您提交的信息摘要：</p>
<ul style="color:#374151">
<li>主题：${escapeHtml(contact.subject ?? '咨询')}</li>
<li>留言：${escapeHtml(contact.message.slice(0, 200))}${contact.message.length > 200 ? '…' : ''}</li>
</ul>
<p>如有紧急事项，欢迎直接拨打官网服务热线。</p>
<p style="margin-top:24px">${BRAND} 团队</p>
</body></html>`;
}

export function renderContactAutoReplyText(contact: Contact): string {
  return [
    `尊敬的 ${contact.name}，您好！`,
    '',
    `感谢联系${BRAND}，我们已收到您的留言，工作人员会尽快与您取得联系。`,
    '',
    `主题：${contact.subject ?? '咨询'}`,
    `留言：${contact.message.slice(0, 200)}${contact.message.length > 200 ? '…' : ''}`,
    '',
    `${BRAND} 团队`,
  ].join('\n');
}

export const DEFAULT_AUTO_REPLY_SUBJECT = `我们已收到您的留言 — ${BRAND}`;
