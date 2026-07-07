export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContentOperatorUser {
  id: string;
  username: string;
  nickname?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface CaseItem extends BaseEntity {
  title: string;
  slug: string;
  summary?: string | null;
  description?: string | null;
  coverImage?: string | null;
  images: string[];
  location?: string | null;
  client?: string | null;
  caseType: string;
  highlights: string[];
  specs?: { label: string; value: string }[] | null;
  completionDate?: string | null;
  seoTitle?: string | null;
  seoDesc?: string | null;
  sortOrder: number;
  isFeatured: boolean;
  status: string;
  scheduledAt?: string | null;
  viewCount: number;
  systemPublishedAt?: string | null;
  createdBy?: string | null;
  createdByUser?: ContentOperatorUser | null;
  lastOperator?: string | null;
  lastOperatorUser?: ContentOperatorUser | null;
}

export interface NewsItem extends BaseEntity {
  title: string;
  slug: string;
  summary?: string | null;
  content?: string | null;
  coverImage?: string | null;
  images: string[];
  category: string;
  author?: string | null;
  seoTitle?: string | null;
  seoDesc?: string | null;
  isTop: boolean;
  sortOrder: number;
  status: string;
  scheduledAt?: string | null;
  viewCount: number;
  publishedAt?: string | null;
  systemPublishedAt?: string | null;
  createdBy?: string | null;
  createdByUser?: ContentOperatorUser | null;
  lastOperator?: string | null;
  lastOperatorUser?: ContentOperatorUser | null;
}

export interface BlogItem extends BaseEntity {
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string | null;
  coverImage?: string | null;
  images: string[];
  category: string;
  readTime?: string | null;
  author?: string | null;
  seoTitle?: string | null;
  seoDesc?: string | null;
  isFeatured: boolean;
  sortOrder: number;
  status: string;
  scheduledAt?: string | null;
  viewCount: number;
  publishedAt?: string | null;
  systemPublishedAt?: string | null;
  createdBy?: string | null;
  createdByUser?: ContentOperatorUser | null;
  lastOperator?: string | null;
  lastOperatorUser?: ContentOperatorUser | null;
}

export interface TradeShowItem extends BaseEntity {
  title: string;
  slug: string;
  summary?: string | null;
  content?: string | null;
  location?: string | null;
  eventDateLabel?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  boothNumber?: string | null;
  eventType: string;
  coverImage?: string | null;
  images: string[];
  externalUrl?: string | null;
  seoTitle?: string | null;
  seoDesc?: string | null;
  isFeatured: boolean;
  sortOrder: number;
  status: string;
  scheduledAt?: string | null;
  viewCount: number;
  publishedAt?: string | null;
  systemPublishedAt?: string | null;
  createdBy?: string | null;
  createdByUser?: ContentOperatorUser | null;
  lastOperator?: string | null;
  lastOperatorUser?: ContentOperatorUser | null;
}

export interface MediaAsset {
  id: string;
  key: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  width?: number | null;
  height?: number | null;
  folder: string;
  alt?: string | null;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
  /** 站点同步静态资源（content 目录或静态清单） */
  isSiteResource?: boolean;
  /** 受保护：站点资源或 CMS 引用中 */
  isProtected?: boolean;
  /** CMS 引用条数（内容条目数，非字段数） */
  usageCount?: number;
  /** 是否可通过「替换站点资源」覆盖固定 key */
  isReplaceable?: boolean;
}

export interface ContactItem extends BaseEntity {
  name: string;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  subject?: string | null;
  message: string;
  source?: string | null;
  isRead: boolean;
  isHandled: boolean;
  remark?: string | null;
  lastOperator?: string | null;
  lastOperatorUser?: ContentOperatorUser | null;
}

export interface UserItem extends BaseEntity {
  username: string;
  nickname?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt?: string | null;
}

export interface PermissionGroup {
  id: string;
  label: string;
  permissions: { id: string; label: string; description?: string }[];
}

export interface RoleAccessItem {
  id: string;
  slug: string;
  label: string;
  description: string;
  system: boolean;
  userCount: number;
  permissions: string[];
}

export interface AccessOverview {
  groups: PermissionGroup[];
  roles: RoleAccessItem[];
}

export interface AuthProfile {
  id: string;
  username: string;
  role: string;
  permissions?: string[];
  nickname?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface AuditLogUser {
  id: string;
  username: string;
  nickname?: string | null;
}

export interface AuditLogItem {
  id: string;
  userId?: string | null;
  user?: AuditLogUser | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  detail?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  traceId?: string | null;
  createdAt: string;
}

export interface DocFolderTreeNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  children: DocFolderTreeNode[];
}

export interface InternalDocumentItem extends BaseEntity {
  ownerId?: string | null;
  title: string;
  slug: string;
  folderId?: string | null;
  folder?: { id: string; name: string; slug: string } | null;
  summary?: string | null;
  content?: string | null;
  status: string;
  tags: string[];
  isPinned: boolean;
  viewCount: number;
  publishedAt?: string | null;
  createdBy?: string | null;
  createdByUser?: ContentOperatorUser | null;
  lastOperator?: string | null;
  lastOperatorUser?: ContentOperatorUser | null;
  /** 可见范围：private(仅自己) | partial(部分人) | public(全局) */
  visibility?: "private" | "partial" | "public";
}

export interface DocRevisionItem {
  id: string;
  title: string;
  editor: { id: string; username: string; nickname?: string | null } | null;
  createdAt: string;
}
