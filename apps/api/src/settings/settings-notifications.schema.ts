import { z } from "zod";

export const siteNotificationSettingsSchema = z
  .object({
    enabled: z.boolean(),
    contact: z.object({
      notifyEmails: z.array(z.string().email().max(200)).max(10),
      autoReplyEnabled: z.boolean(),
      autoReplySubject: z.string().max(200).optional(),
    }),
  })
  .superRefine((value, ctx) => {
    if (!value.enabled) return;
    const emails = value.contact.notifyEmails.map((e) => e.trim()).filter(Boolean);
    if (emails.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "启用邮件通知时至少配置一个收件邮箱",
        path: ["contact", "notifyEmails"],
      });
    }
  });

export type SiteNotificationSettingsInput = z.infer<typeof siteNotificationSettingsSchema>;
