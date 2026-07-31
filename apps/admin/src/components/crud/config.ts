import type { DataTableColumn, DataTableSort } from '@tzj/ui';
import type { ReactNode } from 'react';
import type { ZodType } from 'zod';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'markdown'
  | 'number'
  | 'switch'
  | 'select'
  | 'tags'
  | 'image'
  | 'gallery'
  | 'datetime'
  | 'date'
  | 'key-value-list'
  | 'string-list';

export interface Option {
  label: string;
  value: string;
}

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  /** 字段说明：仅写 label/placeholder 无法表达的行为或规则，避免重复。 */
  help?: string;
  options?: Option[];
  /** 动态选项来源键（由页面注入，如 "categories"）。 */
  optionsFrom?: string;
  /** 表单中占据的列数（1 或 2），默认 1。 */
  colSpan?: 1 | 2;
  /** 媒体上传时的子目录（image/gallery/markdown 字段使用）。 */
  folder?: string;
  /** 空值时向 API 提交 null（用于可清空的关联字段）。 */
  emptyAsNull?: boolean;
  /** 条件显示：返回 false 时该字段不渲染（纯显示过滤，提交值不做剔除——
   *  隐藏字段随表单提交默认值，服务端以总开关字段为准）。
   *  注意：zod resolver 仍会校验隐藏字段，条件字段的 zod 端应保持宽松（严格校验放服务端 DTO）。 */
  visibleWhen?: (values: Record<string, unknown>) => boolean;
}

export type ColumnDef<T> = DataTableColumn<T>;

export interface FilterDef {
  key: string;
  label: string;
  options: Option[];
}

export interface ResourceConfig<T> {
  resource: string;
  /** 列表/新建/编辑页的路由前缀（如 "/cases"、"/blog"）。 */
  basePath: string;
  title: string;
  singular: string;
  columns: ColumnDef<T>[];
  fields: FieldDef[];
  schema: ZodType;
  defaults: Record<string, unknown>;
  searchable?: boolean;
  /** 搜索框占位文案；应准确列出后端实际检索的字段，默认「搜索标题…」。 */
  searchPlaceholder?: string;
  filters?: FilterDef[];
  /** 从实体映射为表单初始值（编辑时）。 */
  toForm?: (row: T) => Record<string, unknown>;
  /** 是否支持一键发布/下线（依据 status 字段）。 */
  publishable?: boolean;
  /** 表单是否自动根据标题生成 slug 隐藏字段（无 slug 字段的实体设为 false）。 */
  autoSlug?: boolean;
  /** 返回前台预览的相对路径（如 `/products/foo`）。 */
  previewPath?: (row: T) => string;
  /** 列表默认排序（通常为发布日期倒序）。 */
  defaultSort?: DataTableSort;
  /** 自定义 RBAC（默认 content.*） */
  permissions?: {
    create?: readonly string[];
    edit?: readonly string[];
    delete?: string;
    publish?: readonly string[];
  };
  /** 新建时额外合并进 API 请求体的字段（如 personal: true） */
  createPayloadExtra?: Record<string, unknown>;
  /** 后台内部阅读页路径（如内部文档 `/documents/:id`） */
  detailPath?: (row: T) => string;
  /** 自定义操作按钮（插入到默认操作之前） */
  extraActions?: (row: T) => ReactNode;
  /** 固定操作列到右侧（列多、横向溢出时保持可见）。 */
  pinActions?: boolean;
  /** 删除确认弹窗文案覆盖（软删除资源用：说明回收站去向与联动后果）。 */
  deleteConfirm?: {
    title?: string;
    description?: string | ((row: T) => string);
    confirmLabel?: string;
    successMessage?: string;
  };
}
