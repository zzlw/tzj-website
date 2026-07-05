import type { ZodType } from "zod";

import type { DataTableColumn, DataTableSort } from "@tzj/ui";

export type FieldType =
  | "text"
  | "textarea"
  | "markdown"
  | "number"
  | "switch"
  | "select"
  | "tags"
  | "image"
  | "gallery"
  | "datetime"
  | "date"
  | "key-value-list"
  | "string-list";

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
  filters?: FilterDef[];
  /** 从实体映射为表单初始值（编辑时）。 */
  toForm?: (row: T) => Record<string, unknown>;
  /** 是否支持一键发布/下线（依据 status 字段）。 */
  publishable?: boolean;
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
}
