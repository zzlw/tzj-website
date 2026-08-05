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
  detailCoverImage?: string | null;
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
  // 营销弹窗（docs/activity-system-design.md）
  isMarketing: boolean;
  triggerMode: string;
  delaySeconds: number;
  frequency: string;
  excludePages: string[];
  targetDevice: string;
  ctaText: string;
  /** 弹窗专用头图；留空前台回退 coverImage */
  popupImage?: string | null;
  /** 弹窗专用文案（Markdown）；留空前台回退 content */
  popupContent?: string | null;
  popupViewCount: number;
  popupClickCount: number;
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
  /** 水印烧录状态：true=已烧录；false=确认未烧录；null/undefined=未知（历史数据/直传登记） */
  watermarked?: boolean | null;
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
  /** 来源会话对应的匿名访客 ID（可点击跳转访客抽屉）。 */
  visitorId?: string | null;
  /** 已转化的客户 ID（该询盘已转为客户线索时有值）。 */
  convertedCustomerId?: string | null;
  /** 最近一次访问的明文 IP（与客户表一致，列表明文展示）。 */
  lastIp?: string | null;
  /** 最近一次访问的脱敏 IP（用于抽屉头部提示等场景）。 */
  lastIpMasked?: string | null;
  /** 最近一次访问 IP 的哈希（用于打开 IP 详情抽屉下钻）。 */
  lastIpHash?: string | null;
  /** 最近一次访问的入库地区标签（省 · 市，无则 null）。 */
  lastRegion?: string | null;
  /** 首触来源渠道（与访客中心「来源」列口径一致，无浏览轨迹则 null）。 */
  channel?: string | null;
  /** 首触引荐域名。 */
  referrerHost?: string | null;
  /** 软删时间（回收站行非空；30 天后自动永久清理）。 */
  deletedAt?: string | null;
}

export interface UserItem extends BaseEntity {
  username: string;
  nickname?: string | null;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
  role: string;
  isActive: boolean;
  twoFactorEnabled?: boolean;
  lockedUntil?: string | null;
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

export interface AuditLogItem {
  id: string;
  userId?: string | null;
  /** 操作人关联账号（含资料卡字段，与内容列表「最后操作人」同构） */
  user?: ContentOperatorUser | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  detail?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  traceId?: string | null;
  createdAt: string;
}

export interface CustomerItem extends BaseEntity {
  name: string;
  company?: string | null;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  customerType: string;
  source?: string | null;
  level: string;
  stage: string;
  amount?: number | null;
  region?: string | null;
  address?: string | null;
  tags: string[];
  notes?: string | null;
  ownerId?: string | null;
  owner?: ContentOperatorUser | null;
  lastContactAt?: string | null;
  nextFollowAt?: string | null;
  createdBy?: string | null;
  createdByUser?: ContentOperatorUser | null;
  lastOperator?: string | null;
  lastOperatorUser?: ContentOperatorUser | null;
  /** 来源会话对应的匿名访客 ID（来自 ChatRoom.visitorId，可点击跳转访客抽屉）。 */
  visitorId?: string | null;
  /** 最后访问 IP（明文，后端按 visitorId/userId 聚合 page_views 得出）。 */
  lastIp?: string | null;
  /** 最后访问 IP（脱敏，如 183.14.*.*；下钻 IP 抽屉时的展示兜底）。 */
  lastIpMasked?: string | null;
  /** 最后访问 IP 的 hash（用于点击下钻 IP 详情抽屉，原始 IP 不外泄）。 */
  lastIpHash?: string | null;
  /** 首触来源渠道（流量归因维度，后端富化；区别于业务维度的 source 客户来源）。 */
  channel?: string | null;
  /** 首触引荐域名（来源渠道列的副行展示）。 */
  referrerHost?: string | null;
  /** 软删时间（回收站行非空；30 天后自动永久清理）。 */
  deletedAt?: string | null;
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
  sortOrder?: number;
  viewCount: number;
  publishedAt?: string | null;
  createdBy?: string | null;
  createdByUser?: ContentOperatorUser | null;
  lastOperator?: string | null;
  lastOperatorUser?: ContentOperatorUser | null;
  /** 可见范围：private(仅自己) | partial(部分人) | public(全局) */
  visibility?: 'private' | 'partial' | 'public';
}

export interface DocRevisionItem {
  id: string;
  title: string;
  editor: { id: string; username: string; nickname?: string | null } | null;
  createdAt: string;
}
