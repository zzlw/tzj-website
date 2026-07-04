/**
 * Context Pipeline — 上下文构建流水线
 *
 * 负责加载、解析和规约项目上下文（文件、Schema、依赖图）。
 *
 * @module harness/pipeline/ContextPipeline
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { HarnessContext, ReducedContext, FileContext, ModelContext } from '../contracts/Context';

export class ContextPipeline {
  /**
   * 构建规约后的上下文
   */
  async execute(context: HarnessContext): Promise<ReducedContext> {
    const files = this.loadFiles(context.targetFiles);
    const prismaModels = this.parsePrismaSchema(context.schema ?? 'apps/api/prisma/schema.prisma');
    const models = prismaModels.map((m) => m.name);
    const bentoGrid = this.generateBentoGrid(models);

    return {
      models,
      files,
      prismaModels,
      bentoGrid,
      metadata: {
        totalModels: models.length,
        totalFiles: files.length,
        totalRelations: prismaModels.reduce((sum, m) => sum + m.relations.length, 0),
        generatedAt: new Date().toISOString(),
        schemaVersion: '1.0.0',
      },
    };
  }

  private loadFiles(targetFiles: string[]): FileContext[] {
    return targetFiles
      .filter((f) => fs.existsSync(f))
      .map((f) => {
        const content = fs.readFileSync(f, 'utf-8');
        const ext = path.extname(f).slice(1);
        const langMap: Record<string, FileContext['language']> = {
          ts: 'typescript', tsx: 'tsx', js: 'javascript',
          json: 'json', css: 'css', prisma: 'prisma',
        };

        return {
          path: f,
          content,
          language: langMap[ext] ?? 'unknown',
          lineCount: content.split('\n').length,
          isModified: false,
        };
      });
  }

  private parsePrismaSchema(schemaPath: string): ModelContext[] {
    if (!fs.existsSync(schemaPath)) return [];
    const content = fs.readFileSync(schemaPath, 'utf-8');
    const models: ModelContext[] = [];
    const modelRegex = /^model\s+(\w+)\s*\{([^}]+)\}/gm;
    let match: RegExpExecArray | null;

    while ((match = modelRegex.exec(content)) !== null) {
      const [, name, body] = match;
      const fields = this.parseFields(body!);
      const relations = this.parseRelations(name!, body!);

      models.push({ name: name!, fields, relations, indexes: [] });
    }

    return models;
  }

  private parseFields(body: string): ModelContext['fields'] {
    const fields: ModelContext['fields'] = [];
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      const fieldMatch = line.match(/^(\w+)\s+(\w+)(\[\])?\s*(.*)?$/);
      if (!fieldMatch) continue;

      const [, name, type, isArray, rest] = fieldMatch;
      fields.push({
        name: name!,
        type: type!,
        isOptional: (rest ?? '').includes('?'),
        isList: !!isArray,
        isId: (rest ?? '').includes('@id'),
        isUnique: (rest ?? '').includes('@unique'),
        hasDefault: (rest ?? '').includes('@default'),
      });
    }

    return fields;
  }

  private parseRelations(modelName: string, body: string): ModelContext['relations'] {
    const relations: ModelContext['relations'] = [];
    const lines = body.split('\n').map((l) => l.trim());

    for (const line of lines) {
      const relMatch = line.match(/(\w+)\s+(\w+)(\[\])?\s+@relation/);
      if (relMatch) {
        relations.push({
          from: modelName,
          to: relMatch[2]!,
          type: relMatch[3] ? 'one-to-many' : 'one-to-one',
          field: relMatch[1]!,
        });
      }
    }

    return relations;
  }

  private generateBentoGrid(models: string[]): ReducedContext['bentoGrid'] {
    const defaultColors = ['#E60012', '#053962', '#E68922', '#10B981', '#8B5CF6', '#F59E0B'];
    const items = models.map((model, i) => ({
      id: `bento-${model.toLowerCase()}`,
      model,
      title: model.replace(/([A-Z])/g, ' $1').trim(),
      description: `${model} management`,
      colSpan: i === 0 ? 4 : 3,
      rowSpan: i === 0 ? 2 : 1,
      colorScheme: {
        background: '#1B1C20',
        foreground: '#FFFFFF',
        accent: defaultColors[i % defaultColors.length]!,
      },
      content: { type: 'card' as const, data: { model } },
      position: { col: 0, row: Math.floor(i / 4) * 2 },
    }));

    return { columns: 12, items };
  }
}
