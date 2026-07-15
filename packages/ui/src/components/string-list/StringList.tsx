'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../button';
import { Input } from '../input';

export interface StringListProps {
  value: string[];
  onChange: (v: string[]) => void;
  itemPlaceholder?: string;
  addLabel?: string;
}

/** 可增删的字符串列表，适用于项目亮点等条目型字段。 */
export function StringList({
  value,
  onChange,
  itemPlaceholder = '请输入内容',
  addLabel = '添加一条',
}: StringListProps) {
  const rows = Array.isArray(value) && value.length > 0 ? value : [''];

  function updateRow(index: number, text: string) {
    const next = rows.map((row, i) => (i === index ? text : row));
    onChange(next);
  }

  function addRow() {
    onChange([...rows, '']);
  }

  function removeRow(index: number) {
    const next = rows.filter((_, i) => i !== index);
    onChange(next.length ? next : ['']);
  }

  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={index} className="flex gap-2">
          <Input
            type="text"
            value={row}
            onChange={(e) => updateRow(index, e.target.value)}
            placeholder={itemPlaceholder}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => removeRow(index)}
            aria-label="删除行"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="mr-1 h-4 w-4" />
        {addLabel}
      </Button>
    </div>
  );
}
