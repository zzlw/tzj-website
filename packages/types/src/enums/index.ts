/**
 * 工程案例分类枚举
 */
export enum CaseType {
  MILITARY = "MILITARY",
  FIRE_DEPARTMENT = "FIRE_DEPARTMENT",
  POLICE = "POLICE",
  SCENIC_AREA = "SCENIC_AREA",
  SCHOOL = "SCHOOL",
  ENTERPRISE = "ENTERPRISE",
}

/**
 * 工程案例分类中文标签映射
 */
export const CaseTypeLabels: Record<CaseType, string> = {
  [CaseType.MILITARY]: "部队类",
  [CaseType.FIRE_DEPARTMENT]: "消防类",
  [CaseType.POLICE]: "公安类",
  [CaseType.SCENIC_AREA]: "景区类",
  [CaseType.SCHOOL]: "学校类",
  [CaseType.ENTERPRISE]: "企业类",
};

/**
 * 新闻分类枚举
 */
export enum NewsCategory {
  COMPANY = "COMPANY",
  INDUSTRY = "INDUSTRY",
  TRAINING_KNOWLEDGE = "TRAINING_KNOWLEDGE",
  EQUIPMENT_KNOWLEDGE = "EQUIPMENT_KNOWLEDGE",
}

/**
 * 新闻分类中文标签映射
 */
export const NewsCategoryLabels: Record<NewsCategory, string> = {
  [NewsCategory.COMPANY]: "公司动态",
  [NewsCategory.INDUSTRY]: "行业资讯",
  [NewsCategory.TRAINING_KNOWLEDGE]: "拓展知识",
  [NewsCategory.EQUIPMENT_KNOWLEDGE]: "器材知识",
};

/**
 * 博客分类枚举
 */
export enum BlogCategory {
  TRAINING_FACILITY = "training_facility",
  BURN_ROOM = "burn_room",
  MODULAR = "modular",
  PRACTICE = "practice",
  INDUSTRY = "industry",
}

/**
 * 博客分类中文标签映射
 */
export const BlogCategoryLabels: Record<BlogCategory, string> = {
  [BlogCategory.TRAINING_FACILITY]: "训练设施",
  [BlogCategory.BURN_ROOM]: "燃烧室技术",
  [BlogCategory.MODULAR]: "模块化系统",
  [BlogCategory.PRACTICE]: "训练实践",
  [BlogCategory.INDUSTRY]: "行业洞察",
};

/**
 * 展会活动类型枚举
 */
export enum TradeShowType {
  EXHIBITION = "exhibition",
  SEMINAR = "seminar",
  ROADSHOW = "roadshow",
}

/**
 * 展会活动类型中文标签映射
 */
export const TradeShowTypeLabels: Record<TradeShowType, string> = {
  [TradeShowType.EXHIBITION]: "展览会",
  [TradeShowType.SEMINAR]: "研讨会",
  [TradeShowType.ROADSHOW]: "巡回活动",
};

/**
 * 内容发布状态
 */
export enum PublishStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  ARCHIVED = "ARCHIVED",
}

/**
 * 用户角色
 */
export enum UserRole {
  ADMIN = "ADMIN",
  EDITOR = "EDITOR",
  VIEWER = "VIEWER",
}
