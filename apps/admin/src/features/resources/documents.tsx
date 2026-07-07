import { z } from "zod";
import type { ResourceConfig } from "@/components/crud/config";
import type { InternalDocumentItem } from "@/features/types";
import { contentAuditColumns } from "@/components/LastOperatorCell";
import { DocumentPermissionButton } from "@/components/DocumentPermissionButton";
import { StatusBadge, formatDate, toDateInput } from "@/features/constants";

const schema = z.object({
  title: z.string().min(1, "请输入标题"),
  slug: z.string().min(1, "请填写标题"),
  folderId: z.string().optional(),
  content: z.string().optional(),
  tags: z.string().optional(),
  isPinned: z.boolean().optional(),
  publishedAt: z.string().optional(),
});

export type DocumentsResourceConfig = ResourceConfig<InternalDocumentItem>;

function buildDocumentsConfig(): DocumentsResourceConfig {
  return {
    resource: "documents",
    basePath: "/documents/mine",
    createPayloadExtra: { personal: true },
    title: "文档中心",
    singular: "文档",
    searchable: true,
    defaultSort: { column: "updatedAt", order: "desc" },
    permissions: {
      create: ["docs.create"],
      edit: ["docs.edit"],
      delete: "docs.delete",
      publish: ["docs.publish"],
    },
    columns: [
      {
        key: "title",
        header: "标题",
        sortable: true,
        cell: (r) => (
          <span className="inline-flex items-center gap-1.5">
            {r.isPinned ? (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                置顶
              </span>
            ) : null}
            {r.title}
          </span>
        ),
      },
      {
        key: "folder",
        header: "文件夹",
        cell: (r) => r.folder?.name ?? "未分类",
      },
      {
        key: "status",
        header: "状态",
        sortable: true,
        cell: (r) => <StatusBadge status={r.status} />,
      },
      {
        key: "viewCount",
        header: "阅读",
        sortable: true,
        className: "text-muted-foreground",
      },
      {
        key: "publishedAt",
        header: "发布时间",
        sortable: true,
        cell: (r) => formatDate(r.publishedAt),
      },
      ...contentAuditColumns<InternalDocumentItem>(),
    ],
    fields: [
      { name: "title", label: "标题", type: "text", required: true, colSpan: 2 },
      {
        name: "folderId",
        label: "所属文件夹",
        type: "select",
        optionsFrom: "folders",
        emptyAsNull: true,
        help: "留空表示未分类",
      },
      {
        name: "publishedAt",
        label: "发布时间",
        type: "date",
        help: "留空则发布时自动取当前时间",
      },
      { name: "isPinned", label: "置顶", type: "switch", placeholder: "置顶显示" },
      {
        name: "content",
        label: "正文",
        type: "markdown",
        colSpan: 2,
        folder: "documents",
        help: "摘要将根据正文自动生成；可直接粘贴 Markdown 源码，或使用工具栏「源码模式」编辑",
      },
      {
        name: "tags",
        label: "标签",
        type: "tags",
        colSpan: 2,
        help: "逗号或换行分隔；建议复用已有标签，便于筛选与检索",
      },
    ],
    schema,
    defaults: {
      title: "",
      slug: "",
      folderId: "",
      content: "",
      tags: "",
      isPinned: false,
      publishedAt: "",
    },
    toForm: (r) => ({
      title: r.title,
      slug: r.slug,
      folderId: r.folderId ?? r.folder?.id ?? "",
      content: r.content ?? "",
      tags: (r.tags ?? []).join(", "),
      isPinned: r.isPinned,
      publishedAt: toDateInput(r.publishedAt),
    }),
    detailPath: (r) => `/documents/mine/${r.id}`,
    extraActions: (r) => (
      <DocumentPermissionButton documentId={r.id} documentTitle={r.title} />
    ),
  };
}

export const myDocumentsConfig = buildDocumentsConfig();
