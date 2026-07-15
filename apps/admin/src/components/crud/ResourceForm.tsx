'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  DatePicker,
  DateTimePicker,
  FieldDescription,
  ImagePreview,
  Input,
  KeyValueList,
  type KeyValuePair,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StringList,
  Switch,
  TagsInput,
  Textarea,
} from '@tzj/ui';
import { ImagePlus, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import {
  type Control,
  Controller,
  type FieldErrors,
  type FieldValues,
  type Resolver,
  useForm,
} from 'react-hook-form';
import type { ZodType } from 'zod';
import { slugifyTitle } from '@/features/constants';
import { resolveMediaUrl } from '@/lib/media-url';
import { notifyError } from '@/lib/notify';
import type { FieldDef, Option } from './config';
import { MediaPicker } from './MediaPicker';

/** 校验前补全 slug，避免隐藏字段校验失败却无任何提示 */
function createFormResolver(schema: ZodType, autoSlug: boolean): Resolver<FieldValues> {
  const base = zodResolver(schema as never) as Resolver<FieldValues>;
  return async (values, context, options) => {
    const prepared = { ...values } as FieldValues;
    if (autoSlug && !String(prepared.slug ?? '').trim()) {
      prepared.slug = slugifyTitle(String(prepared.title ?? ''));
    }
    return base(prepared, context, options);
  };
}

function firstValidationMessage(errors: FieldErrors<FieldValues>): string {
  for (const err of Object.values(errors)) {
    if (!err) continue;
    if (typeof err.message === 'string' && err.message) return err.message;
    if (typeof err === 'object') {
      const nested = firstValidationMessage(err as FieldErrors<FieldValues>);
      if (nested) return nested;
    }
  }
  return '请检查表单中标红的必填项';
}

function focusFirstInvalidField(formId: string, errors: FieldErrors<FieldValues>) {
  const firstKey = Object.keys(errors)[0];
  if (!firstKey) return;
  const targetId = firstKey === 'slug' ? `${formId}-title` : `${formId}-${firstKey}`;
  const el = document.getElementById(targetId);
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (el instanceof HTMLElement && 'focus' in el) {
    el.focus();
  }
}

/** 按字段类型/名称生成 placeholder；配置项优先。 */
function fieldPlaceholder(f: FieldDef): string | undefined {
  if (f.placeholder) return f.placeholder;
  if (
    f.type === 'switch' ||
    f.type === 'image' ||
    f.type === 'gallery' ||
    f.type === 'markdown' ||
    f.type === 'key-value-list' ||
    f.type === 'string-list'
  ) {
    return undefined;
  }
  if (f.name === 'seoTitle') return '不懂不要填，留空则使用标题，建议 50 字以内';
  if (f.name === 'seoDesc') return '不懂不要填，留空则使用摘要，建议 120–160 字';
  if (f.name === 'location') return '如 上海 · 国家会展中心';
  if (f.name === 'client') return '如 XX 消防局';
  if (f.name === 'externalUrl') return 'https://';
  if (f.name === 'eventDateLabel') return '如 2026年5月、年度展会';
  if (f.name === 'boothNumber') return '如 A1-08';
  if (f.type === 'tags') return '每行一条';
  if (f.type === 'select') return `请选择${f.label}`;
  if (f.type === 'textarea') return `请输入${f.label}…`;
  if (f.type === 'text' || f.type === 'number') return `请输入${f.label}`;
  if (f.type === 'date') return '选择日期';
  if (f.type === 'datetime') return '选择日期和时间';
  return undefined;
}

const MarkdownEditor = dynamic(
  () => import('./MarkdownEditor').then((mod) => ({ default: mod.MarkdownEditor })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[360px] items-center justify-center rounded-md border border-border bg-muted/20 text-sm text-muted-foreground">
        编辑器加载中…
      </div>
    ),
  },
);

function ImageField({
  value,
  onChange,
  folder,
}: {
  value: string;
  onChange: (v: string) => void;
  folder?: string;
}) {
  const [open, setOpen] = useState(false);
  const displayUrl = resolveMediaUrl(value);
  return (
    <div className="flex items-center gap-3">
      {value ? (
        <div className="relative h-24 w-24 overflow-hidden rounded-sm border border-border">
          <ImagePreview src={displayUrl}>
            <button
              type="button"
              className="block h-full w-full cursor-pointer overflow-hidden"
              aria-label="预览封面图"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayUrl}
                alt=""
                className="h-full w-full object-cover transition-opacity hover:opacity-90"
                draggable={false}
              />
            </button>
          </ImagePreview>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="absolute top-1 right-1 z-10 rounded-full bg-black/60 p-0.5 text-white hover:bg-red-500"
            title="移除"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-24 h-24 flex flex-col items-center justify-center gap-1 border border-dashed border-border rounded-sm text-secondary-text hover:border-primary hover:text-primary transition-colors"
        >
          <ImagePlus className="w-5 h-5" />
          <span className="text-xs">选择</span>
        </button>
      )}
      {value && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-primary hover:underline"
        >
          更换图片
        </button>
      )}
      <MediaPicker
        open={open}
        onClose={() => setOpen(false)}
        accept="image"
        folder={folder}
        onSelect={(urls) => {
          if (urls[0]) onChange(urls[0]);
          setOpen(false);
        }}
      />
    </div>
  );
}

function GalleryField({
  value,
  onChange,
  folder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  folder?: string;
}) {
  const [open, setOpen] = useState(false);
  const list = Array.isArray(value) ? value : [];
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {list.map((url) => {
          const displayUrl = resolveMediaUrl(url);
          return (
            <div
              key={url}
              className="relative w-20 h-20 rounded-sm overflow-hidden border border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={displayUrl} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(list.filter((u) => u !== url))}
                className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white hover:bg-red-500"
                title="移除"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-20 h-20 flex flex-col items-center justify-center gap-1 border border-dashed border-border rounded-sm text-secondary-text hover:border-primary hover:text-primary transition-colors"
        >
          <ImagePlus className="w-4 h-4" />
          <span className="text-[10px]">添加</span>
        </button>
      </div>
      <MediaPicker
        open={open}
        onClose={() => setOpen(false)}
        accept="image"
        multiple
        folder={folder}
        onSelect={(urls) => {
          const merged = Array.from(new Set([...list, ...urls]));
          onChange(merged);
          setOpen(false);
        }}
      />
    </div>
  );
}

function ControlledField({ field, control }: { field: FieldDef; control: Control<FieldValues> }) {
  return (
    <Controller
      name={field.name}
      control={control}
      render={({ field: rhf }) => {
        if (field.type === 'markdown') {
          return (
            <MarkdownEditor
              value={(rhf.value as string) ?? ''}
              onChange={rhf.onChange}
              folder={field.folder}
            />
          );
        }
        if (field.type === 'image') {
          return (
            <ImageField
              value={(rhf.value as string) ?? ''}
              onChange={rhf.onChange}
              folder={field.folder}
            />
          );
        }
        if (field.type === 'key-value-list') {
          return (
            <KeyValueList value={(rhf.value as KeyValuePair[]) ?? []} onChange={rhf.onChange} />
          );
        }
        if (field.type === 'string-list') {
          return (
            <StringList
              value={(rhf.value as string[]) ?? []}
              onChange={rhf.onChange}
              itemPlaceholder={field.placeholder ?? `请输入${field.label}`}
              addLabel={`添加${field.label.replace(/^项目/, '')}`}
            />
          );
        }
        // gallery
        return (
          <GalleryField
            value={(rhf.value as string[]) ?? []}
            onChange={rhf.onChange}
            folder={field.folder}
          />
        );
      }}
    />
  );
}

export function ResourceForm({
  formId,
  fields,
  schema,
  defaultValues,
  dynamicOptions,
  tagSuggestions,
  onSubmit,
  autoSlug = true,
}: {
  formId: string;
  fields: FieldDef[];
  schema: ZodType;
  defaultValues: Record<string, unknown>;
  dynamicOptions?: Record<string, Option[]>;
  tagSuggestions?: string[];
  onSubmit: (values: Record<string, unknown>) => void;
  autoSlug?: boolean;
}) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FieldValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: createFormResolver(schema, autoSlug),
    defaultValues: defaultValues as FieldValues,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  function handleInvalid(errors: FieldErrors<FieldValues>) {
    notifyError(firstValidationMessage(errors), '无法保存');
    focusFirstInvalidField(formId, errors);
  }

  const titleValue = watch('title') as string | undefined;
  const slugLockedRef = useRef(
    Boolean(defaultValues.slug && String(defaultValues.slug).length > 0),
  );

  useEffect(() => {
    if (!autoSlug || slugLockedRef.current) return;
    const next = slugifyTitle(titleValue ?? '');
    if (next) setValue('slug', next, { shouldDirty: true });
  }, [autoSlug, titleValue, setValue]);

  const optionsFor = (f: FieldDef): Option[] =>
    f.options ?? (f.optionsFrom ? (dynamicOptions?.[f.optionsFrom] ?? []) : []);

  const controlled = (t: FieldDef['type']) =>
    t === 'markdown' ||
    t === 'image' ||
    t === 'gallery' ||
    t === 'key-value-list' ||
    t === 'string-list';

  return (
    <form
      id={formId}
      onSubmit={handleSubmit((v) => {
        const values = { ...v } as Record<string, unknown>;
        if (autoSlug && !String(values.slug ?? '').trim()) {
          values.slug = slugifyTitle(String(values.title ?? ''));
        }
        onSubmit(values);
      }, handleInvalid)}
      className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2"
    >
      {autoSlug ? <input type="hidden" {...register('slug')} /> : null}
      {fields.map((f) => {
        const err = errors[f.name]?.message as string | undefined;
        const span = f.colSpan === 2 ? 'sm:col-span-2' : '';
        const placeholder = fieldPlaceholder(f);
        const fieldId = `${formId}-${f.name}`;
        const describedBy = f.help ? `${fieldId}-desc` : undefined;
        return (
          <div key={f.name} className={`space-y-2 ${span}`}>
            <Label htmlFor={fieldId} className="text-foreground/90">
              {f.label}
              {f.required && <span className="text-destructive"> *</span>}
            </Label>

            {controlled(f.type) ? (
              <ControlledField field={f} control={control} />
            ) : f.type === 'tags' ? (
              <Controller
                name={f.name}
                control={control}
                render={({ field: rhf }) => (
                  <TagsInput
                    id={fieldId}
                    value={String(rhf.value ?? '')}
                    onChange={rhf.onChange}
                    suggestions={tagSuggestions}
                    placeholder={placeholder ?? '输入标签后按 Enter 添加…'}
                  />
                )}
              />
            ) : f.type === 'textarea' ? (
              <Textarea
                id={fieldId}
                {...register(f.name)}
                rows={4}
                placeholder={placeholder}
                className="min-h-24 resize-y leading-relaxed"
                aria-invalid={Boolean(err)}
              />
            ) : f.type === 'select' ? (
              <Controller
                name={f.name}
                control={control}
                render={({ field: rhf }) => (
                  <Select value={(rhf.value as string) || undefined} onValueChange={rhf.onChange}>
                    <SelectTrigger id={fieldId} aria-invalid={Boolean(err)}>
                      <SelectValue placeholder={placeholder ?? '请选择…'} />
                    </SelectTrigger>
                    <SelectContent>
                      {optionsFor(f).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            ) : f.type === 'switch' ? (
              <Controller
                name={f.name}
                control={control}
                render={({ field: rhf }) => (
                  <div className="flex h-9 items-center justify-between rounded-md border border-input px-3 shadow-sm">
                    <span className="text-sm text-muted-foreground">{f.placeholder ?? '启用'}</span>
                    <Switch
                      id={fieldId}
                      checked={Boolean(rhf.value)}
                      onCheckedChange={rhf.onChange}
                    />
                  </div>
                )}
              />
            ) : f.type === 'number' ? (
              <Input
                id={fieldId}
                type="number"
                {...register(f.name, { valueAsNumber: true })}
                placeholder={placeholder}
              />
            ) : f.type === 'datetime' ? (
              <Controller
                name={f.name}
                control={control}
                render={({ field: rhf }) => (
                  <DateTimePicker
                    id={fieldId}
                    value={(rhf.value as string) ?? ''}
                    onChange={rhf.onChange}
                    placeholder={placeholder}
                  />
                )}
              />
            ) : f.type === 'date' ? (
              <Controller
                name={f.name}
                control={control}
                render={({ field: rhf }) => (
                  <DatePicker
                    id={fieldId}
                    value={(rhf.value as string) ?? ''}
                    onChange={rhf.onChange}
                    placeholder={placeholder}
                  />
                )}
              />
            ) : f.name === 'password' ? (
              <Input
                id={fieldId}
                type="password"
                autoComplete="new-password"
                {...register(f.name)}
                placeholder={placeholder}
              />
            ) : (
              <Input id={fieldId} type="text" {...register(f.name)} placeholder={placeholder} />
            )}

            {f.help ? <FieldDescription id={`${fieldId}-desc`}>{f.help}</FieldDescription> : null}
            {err ? (
              <p className="text-xs font-medium text-destructive" role="alert">
                {err}
              </p>
            ) : null}
          </div>
        );
      })}
    </form>
  );
}
