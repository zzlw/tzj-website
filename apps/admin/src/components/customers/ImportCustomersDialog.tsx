'use client';

/**
 * 客户 CSV 导入弹窗：模板下载 → 选文件解析 → 预览 + 预校验 → 批量提交 → 结果反馈。
 * 归属由 scope 决定（公海 / 我的私海），提交 POST /customers/import（后端逐条 upsert 并按 email 去重）。
 */
import { Alert, Button, SimpleDialog } from '@tzj/ui';
import { Download, FileUp, Loader2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import {
  downloadCustomerTemplate,
  type ParsedImportRow,
  parseCustomerCsv,
} from '@/features/customers-import';
import { api } from '@/lib/apiClient';
import { notifyError, notifySuccess } from '@/lib/notify';

interface ImportResult {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  errors: { row: number; message: string }[];
}

interface Props {
  scope: 'mine' | 'public';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

/** 预览上限：仅渲染前 N 行避免超大文件卡顿（校验与提交仍覆盖全部行）。 */
const PREVIEW_LIMIT = 50;

export function ImportCustomersDialog({ scope, open, onOpenChange, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedImportRow[]>([]);
  const [headerMissing, setHeaderMissing] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidCount = rows.length - validRows.length;

  function reset() {
    setFileName('');
    setRows([]);
    setHeaderMissing([]);
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleClose() {
    if (submitting) return;
    onOpenChange(false);
    reset();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = parseCustomerCsv(text);
      setRows(parsed.rows);
      setHeaderMissing(parsed.headerMissing);
    } catch (err) {
      notifyError(err, '文件读取失败');
      reset();
    }
  }

  async function submit() {
    if (validRows.length === 0) return;
    setSubmitting(true);
    try {
      const res = await api.post<ImportResult>('/customers/import', {
        scope,
        items: validRows.map((r) => r.data),
      });
      setResult(res);
      notifySuccess(`导入完成：新增 ${res.created} 条`);
      onImported();
    } catch (err) {
      notifyError(err, '导入失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SimpleDialog
      open={open}
      onClose={handleClose}
      title={`导入客户到${scope === 'public' ? '公海' : '我的私海'}`}
      xl
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={downloadCustomerTemplate}>
            <Download className="mr-1 h-4 w-4" />
            下载模板
          </Button>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" disabled={submitting} onClick={handleClose}>
              {result ? '关闭' : '取消'}
            </Button>
            {!result ? (
              <Button
                type="button"
                disabled={submitting || validRows.length === 0}
                onClick={submit}
              >
                {submitting ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-1 h-4 w-4" />
                )}
                导入 {validRows.length} 条
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* 文件选择 */}
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="hidden"
          />
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
            <FileUp className="mr-1 h-4 w-4" />
            选择 CSV 文件
          </Button>
          {fileName ? (
            <span className="text-muted-foreground ml-3 text-sm">{fileName}</span>
          ) : (
            <span className="text-muted-foreground ml-3 text-sm">
              请先下载模板，按列填写后上传（必填：联系人姓名）
            </span>
          )}
        </div>

        {headerMissing.length > 0 ? (
          <Alert variant="destructive" icon="error">
            模板缺少必填列：{headerMissing.join('、')}。请使用「下载模板」的表头。
          </Alert>
        ) : null}

        {/* 导入结果 */}
        {result ? (
          <Alert variant={result.failed > 0 ? 'destructive' : 'default'} icon="info">
            <div className="space-y-1 text-sm">
              <div>
                共 {result.total} 条：成功新增 <b>{result.created}</b>，跳过（重复）
                <b>{result.skipped}</b>，失败 <b>{result.failed}</b>。
              </div>
              {result.errors.length > 0 ? (
                <ul className="mt-1 max-h-32 list-disc overflow-auto pl-5 text-xs">
                  {result.errors.map((err) => (
                    <li key={err.row}>
                      第 {err.row} 行：{err.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Alert>
        ) : null}

        {/* 预览 + 预校验 */}
        {rows.length > 0 && !result ? (
          <div className="space-y-2">
            <div className="text-muted-foreground text-sm">
              解析到 <b className="text-foreground">{rows.length}</b> 行，可导入{' '}
              <b className="text-success-foreground">{validRows.length}</b> 行
              {invalidCount > 0 ? (
                <>
                  ，<b className="text-destructive">{invalidCount}</b> 行有误将跳过
                </>
              ) : null}
              。
            </div>
            <div className="max-h-72 overflow-auto rounded-lg border border-border/70">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">#</th>
                    <th className="px-2 py-1.5 font-medium">姓名</th>
                    <th className="px-2 py-1.5 font-medium">单位</th>
                    <th className="px-2 py-1.5 font-medium">电话</th>
                    <th className="px-2 py-1.5 font-medium">邮箱</th>
                    <th className="px-2 py-1.5 font-medium">校验</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, PREVIEW_LIMIT).map((r) => (
                    <tr key={r.rowNo} className="border-t border-border/60">
                      <td className="text-muted-foreground px-2 py-1.5">{r.rowNo}</td>
                      <td className="px-2 py-1.5">{r.data.name || '—'}</td>
                      <td className="px-2 py-1.5">{r.data.company || '—'}</td>
                      <td className="px-2 py-1.5">{r.data.phone || '—'}</td>
                      <td className="px-2 py-1.5">{r.data.email || '—'}</td>
                      <td className="px-2 py-1.5">
                        {r.errors.length === 0 ? (
                          <span className="text-success-foreground">✓</span>
                        ) : (
                          <span className="text-destructive">{r.errors.join('；')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > PREVIEW_LIMIT ? (
                <div className="text-muted-foreground bg-muted/40 px-2 py-1.5 text-center text-xs">
                  仅预览前 {PREVIEW_LIMIT} 行，导入将处理全部 {rows.length} 行
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </SimpleDialog>
  );
}
