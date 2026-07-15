export type SortOrder = 'asc' | 'desc';

export interface ListSortParams {
  sortBy?: string;
  sortOrder?: SortOrder;
}

type OrderByEntry = Record<string, SortOrder | { sort: SortOrder; nulls?: 'first' | 'last' }>;

export type { OrderByEntry };

/** 可空日期字段：排序时空值置后。 */
const NULLABLE_DATE_FIELDS = new Set(['completionDate', 'publishedAt', 'startDate', 'endDate']);

/** 可空字符串字段：排序时空值置后。 */
const NULLABLE_STRING_FIELDS = new Set(['location']);

/** 校验并解析列表排序参数（白名单字段）。 */
export function parseListSort(
  sortBy: string | undefined,
  sortOrder: string | undefined,
  allowedFields: readonly string[],
): ListSortParams {
  if (!sortBy || !allowedFields.includes(sortBy)) return {};
  return { sortBy, sortOrder: sortOrder === 'desc' ? 'desc' : 'asc' };
}

function buildPrimarySortEntry(sortBy: string, sortOrder: SortOrder): OrderByEntry {
  if (NULLABLE_DATE_FIELDS.has(sortBy) || NULLABLE_STRING_FIELDS.has(sortBy)) {
    return { [sortBy]: { sort: sortOrder, nulls: 'last' } };
  }
  return { [sortBy]: sortOrder };
}

/** 有显式排序时以用户选择为主，否则使用默认 orderBy。 */
export function buildListOrderBy(
  sort: ListSortParams,
  defaultOrderBy: OrderByEntry[],
): OrderByEntry[] {
  if (!sort.sortBy || !sort.sortOrder) return defaultOrderBy;
  return [buildPrimarySortEntry(sort.sortBy, sort.sortOrder), { createdAt: 'desc' }];
}

const descDate = (field: string): OrderByEntry => ({
  [field]: { sort: 'desc', nulls: 'last' },
});

/** 各内容模块默认按发布日期倒序（草稿/未填日期置后，同日期按创建时间倒序）。 */
export const DEFAULT_CONTENT_LIST_ORDER = {
  cases: [descDate('completionDate'), { createdAt: 'desc' }],
  news: [descDate('publishedAt'), { createdAt: 'desc' }],
  blogs: [descDate('publishedAt'), { createdAt: 'desc' }],
  tradeShows: [descDate('publishedAt'), { createdAt: 'desc' }],
} satisfies Record<string, OrderByEntry[]>;
