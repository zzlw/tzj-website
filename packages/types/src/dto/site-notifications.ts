/** 后台邮件通知设置（不暴露给 C 端） */
export interface SiteNotificationSettings {
  /** 是否启用邮件通知（关闭后不发送询盘通知与自动回复） */
  enabled: boolean;
  contact: {
    /** 新询盘通知收件人（可多个） */
    notifyEmails: string[];
    /** 是否向访客发送自动确认邮件 */
    autoReplyEnabled: boolean;
    /** 自动回复邮件主题（留空则用系统默认） */
    autoReplySubject?: string;
  };
}

export type NotificationChannel = 'email';

export type NotificationStatus = 'pending' | 'sent' | 'failed';

/** 通知模板标识 */
export type NotificationTemplate = 'contact.staff-notify' | 'contact.auto-reply';

export interface NotificationLogItem {
  id: string;
  channel: NotificationChannel;
  template: NotificationTemplate;
  recipient: string;
  subject: string;
  status: NotificationStatus;
  error: string | null;
  sentAt: string | null;
  createdAt: string;
}
