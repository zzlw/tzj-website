"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "../button";
import { Input } from "../input";

export interface KeyValuePair {
  label: string;
  value: string;
}

export interface KeyValueListProps {
  value: KeyValuePair[];
  onChange: (v: KeyValuePair[]) => void;
  labelPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
}

/** 可增删的键值对列表，适用于表单动态参数。 */
export function KeyValueList({
  value,
  onChange,
  labelPlaceholder = "参数名",
  valuePlaceholder = "参数值",
  addLabel = "添加参数",
}: KeyValueListProps) {
  const rows =
    Array.isArray(value) && value.length > 0
      ? value
      : [{ label: "", value: "" }];

  function updateRow(index: number, patch: Partial<KeyValuePair>) {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  }

  function addRow() {
    onChange([...rows, { label: "", value: "" }]);
  }

  function removeRow(index: number) {
    const next = rows.filter((_, i) => i !== index);
    onChange(next.length ? next : [{ label: "", value: "" }]);
  }

  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={index} className="flex gap-2">
          <Input
            type="text"
            value={row.label}
            onChange={(e) => updateRow(index, { label: e.target.value })}
            placeholder={labelPlaceholder}
          />
          <Input
            type="text"
            value={row.value}
            onChange={(e) => updateRow(index, { value: e.target.value })}
            placeholder={valuePlaceholder}
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
