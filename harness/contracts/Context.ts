/**
 * Context Contract — 上下文数据结构
 *
 * 定义 Harness Pipeline 各阶段共享的上下文类型。
 *
 * @module harness/contracts/Context
 */

/** 运行模式 */
export type HarnessMode = 'cli' | 'repl' | 'mcp';

/** Agent 标识 */
export type AgentId = 'A1' | 'A2';

/** Pipeline 阶段 */
export type PipelinePhase =
  | 'receive'
  | 'inspect'
  | 'reflect'
  | 'evaluate'
  | 'generate'
  | 'complete'
  | 'rollback';

/** 文件上下文 */
export interface FileContext {
  path: string;
  content: string;
  language: 'typescript' | 'tsx' | 'javascript' | 'json' | 'css' | 'prisma' | 'unknown';
  lineCount: number;
  isModified: boolean;
}

/** Prisma Model 上下文 */
export interface ModelContext {
  name: string;
  fields: ModelField[];
  relations: ModelRelation[];
  indexes: string[];
}

/** Prisma Model 字段 */
export interface ModelField {
  name: string;
  type: string;
  isOptional: boolean;
  isList: boolean;
  isId: boolean;
  isUnique: boolean;
  hasDefault: boolean;
}

/** Model 关系 */
export interface ModelRelation {
  from: string;
  to: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many' | 'self-relation';
  field: string;
}

/** Bento Grid 布局项 */
export interface BentoGridItem {
  id: string;
  model: string;
  title: string;
  description: string;
  colSpan: number;
  rowSpan: number;
  colorScheme: {
    background: string;
    foreground: string;
    accent: string;
  };
  content: {
    type: 'card' | 'stat' | 'list' | 'hero' | 'form';
    data: Record<string, unknown>;
  };
  position: { col: number; row: number };
}

/** 规约后的上下文 */
export interface ReducedContext {
  models: string[];
  files: FileContext[];
  prismaModels: ModelContext[];
  bentoGrid: {
    columns: number;
    items: BentoGridItem[];
  };
  metadata: {
    totalModels: number;
    totalFiles: number;
    totalRelations: number;
    generatedAt: string;
    schemaVersion: string;
  };
}

/** Harness 运行上下文 */
export interface HarnessContext {
  mode: HarnessMode;
  agentId: AgentId;
  correlationId: string;
  targetFiles: string[];
  schema?: string;
  branch?: string;
  commitHash?: string;
  startedAt: string;
  reduced?: ReducedContext;
}
