'use client';

/**
 * 客户 CSV 导入：模板生成 + 解析 + 列映射 + 预校验（纯前端，项目无 CSV 依赖库）。
 * 解析遵循 RFC-4180（引号包裹、"" 转义、字段内逗号/换行），并处理 UTF-8 BOM。
 * 枚举列（类型/来源/等级/阶段）同时接受中文标签或英文值，空值交后端取默认。
 */
import {
  CUSTOMER_LEVEL_OPTIONS,
  CUSTOMER_SOURCE_OPTIONS,
  CUSTOMER_STAGE_OPTIONS,
  CUSTOMER_TYPE_OPTIONS,
} from '@/features/constants';

/** 导入行提交后端的载荷（对齐 CreateCustomerDto 的可导入子集）。 */
export interface ImportCustomerPayload {
  name: string;
  company?: string;
  title?: string;
  phone?: string;
  email?: string;
  customerType?: string;
  source?: string;
  level?: string;
  stage?: string;
  amount?: number;
  region?: string;
  address?: string;
  tags?: string[];
  notes?: string;
}

/** 单行解析结果：行号（数据行序，从 1 起）+ 载荷 + 错误明细。 */
export interface ParsedImportRow {
  rowNo: number;
  data: ImportCustomerPayload;
  errors: string[];
}

interface Option {
  label: string;
  value: string;
}

/** 枚举列定义：字段名 + 表头标签 + 取值枚举 + 是否必填。 */
interface ColumnSpec {
  field: keyof ImportCustomerPayload;
  header: string;
  options?: Option[];
  required?: boolean;
}

/** 模板列（顺序即模板列序）。带 * 者为必填。 */
const COLUMNS: ColumnSpec[] = [
  { field: 'name', header: '联系人姓名', required: true },
  { field: 'company', header: '客户单位' },
  { field: 'title', header: '联系人职务' },
  { field: 'phone', header: '联系电话' },
  { field: 'email', header: '邮箱' },
  { field: 'customerType', header: '客户类型', options: CUSTOMER_TYPE_OPTIONS },
  { field: 'source', header: '客户来源', options: CUSTOMER_SOURCE_OPTIONS },
  { field: 'level', header: '客户等级', options: CUSTOMER_LEVEL_OPTIONS },
  { field: 'stage', header: '跟进阶段', options: CUSTOMER_STAGE_OPTIONS },
  { field: 'amount', header: '预估金额' },
  { field: 'region', header: '地区' },
  { field: 'address', header: '详细地址' },
  { field: 'tags', header: '标签（分号分隔）' },
  { field: 'notes', header: '备注' },
];

/** 归一表头：去空白、去尾部 *、去括号说明，供列名匹配（容忍模板注释差异）。 */
function normalizeHeader(h: string): string {
  return h
    .trim()
    .replace(/\*+$/, '')
    .replace(/（.*?）|\(.*?\)/g, '')
    .trim();
}

/** RFC-4180 CSV 解析：返回二维字符串数组（含表头行）；处理 BOM 与 CRLF。 */
export function parseCsv(text: string): string[][] {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  // 收尾最后一个字段/行（无末尾换行时）
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** 枚举值归一：接受中文标签或英文值（忽略大小写）；无法识别返回 null。 */
function resolveEnum(raw: string, options: Option[]): string | null {
  const v = raw.trim();
  if (!v) return '';
  const lower = v.toLowerCase();
  const hit = options.find((o) => o.value.toLowerCase() === lower || o.label === v);
  return hit ? hit.value : null;
}

/** 单元格取值：按表头映射定位列索引，缺列返回空串。 */
function cellOf(record: string[], indexByField: Map<string, number>, field: string): string {
  const idx = indexByField.get(field);
  if (idx === undefined) return '';
  return (record[idx] ?? '').trim();
}

/** 生成「表头字段 → 列索引」映射（未识别的表头忽略）。 */
function buildHeaderIndex(headerRow: string[]): Map<string, number> {
  const headerToField = new Map<string, keyof ImportCustomerPayload>();
  for (const col of COLUMNS) {
    headerToField.set(normalizeHeader(col.header), col.field);
    headerToField.set(col.field, col.field); // 也接受英文字段名作表头
  }
  const map = new Map<string, number>();
  headerRow.forEach((h, i) => {
    const field = headerToField.get(normalizeHeader(h));
    if (field && !map.has(field)) map.set(field, i);
  });
  return map;
}

/** 解析单条数据行为载荷 + 错误明细。 */
function parseRow(
  record: string[],
  indexByField: Map<string, number>,
  rowNo: number,
): ParsedImportRow {
  const errors: string[] = [];
  const get = (f: string) => cellOf(record, indexByField, f);

  const name = get('name');
  if (!name) errors.push('缺少必填项「联系人姓名」');

  const data: ImportCustomerPayload = { name };
  const company = get('company');
  if (company) data.company = company;
  const title = get('title');
  if (title) data.title = title;
  const phone = get('phone');
  if (phone) data.phone = phone;
  const email = get('email');
  if (email) data.email = email;
  const region = get('region');
  if (region) data.region = region;
  const address = get('address');
  if (address) data.address = address;
  const notes = get('notes');
  if (notes) data.notes = notes;

  // 枚举列：中文标签或英文值均可，非法值记错误
  for (const col of COLUMNS) {
    if (!col.options) continue;
    const resolved = resolveEnum(get(col.field), col.options);
    if (resolved === null) {
      errors.push(`「${col.header}」取值无效：${get(col.field)}`);
    } else if (resolved) {
      (data as unknown as Record<string, unknown>)[col.field] = resolved;
    }
  }

  // 金额：去除货币符号/千分位后转整数
  const amountRaw = get('amount').replace(/[¥￥,，\s]/g, '');
  if (amountRaw) {
    const n = Number(amountRaw);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      errors.push(`「预估金额」需为非负整数：${get('amount')}`);
    } else if (n > 0) {
      data.amount = n;
    }
  }

  // 标签：分号 / 竖线分隔
  const tagsRaw = get('tags');
  if (tagsRaw) {
    const tags = tagsRaw
      .split(/[;；|]/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length) data.tags = tags;
  }

  return { rowNo, data, errors };
}

/**
 * 解析整份 CSV 文本为导入行集合。
 * 返回 rows（含错误标记）与 headerMissing（模板缺少必填「联系人姓名」列时非空）。
 */
export function parseCustomerCsv(text: string): {
  rows: ParsedImportRow[];
  headerMissing: string[];
} {
  const table = parseCsv(text);
  const headerRow = table[0];
  if (!headerRow) return { rows: [], headerMissing: ['联系人姓名'] };

  const indexByField = buildHeaderIndex(headerRow);
  const headerMissing = COLUMNS.filter((c) => c.required && !indexByField.has(c.field)).map(
    (c) => c.header,
  );

  const rows: ParsedImportRow[] = [];
  for (let i = 1; i < table.length; i++) {
    const record = table[i];
    if (!record) continue;
    // 跳过全空行
    if (record.every((v) => !v.trim())) continue;
    rows.push(parseRow(record, indexByField, rows.length + 1));
  }
  return { rows, headerMissing };
}

/** CSV 单元格转义（供模板生成）。 */
function escapeCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** 下载导入模板：表头行（必填带 *）+ 一行示例，UTF-8 BOM 兼容 Excel。 */
export function downloadCustomerTemplate(): void {
  const header = COLUMNS.map((c) => (c.required ? `${c.header}*` : c.header));
  const example = [
    '张经理',
    '示例科技有限公司',
    '采购经理',
    '13800000000',
    'zhang@example.com',
    '企业',
    '展会',
    'B',
    '跟进中',
    '500000',
    '上海',
    '上海市浦东新区xx路1号',
    '重点;展会线索',
    '展会现场登记，计划本月回访',
  ];
  const csv = `${header.map(escapeCell).join(',')}\r\n${example.map(escapeCell).join(',')}`;
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '客户导入模板.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
