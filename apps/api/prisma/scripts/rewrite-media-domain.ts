/**
 * 一次性脚本：OSS 迁移时订正数据库中存储的媒体 URL 前缀。
 *
 * 正向（默认）：https://static.tzjii.com/tzj-uploads-prod → https://static.tzjii.com
 * 反向（--reverse）：https://static.tzjii.com → https://static.tzjii.com/tzj-uploads-prod
 *
 * 反向使用哨兵替换，避免把已带 tzj-uploads-prod 前缀的 URL 二次加前缀。
 *
 * 覆盖范围（与 docs/minio-to-aliyun-oss-migration-plan.md §3.3 / §5.4 对齐）：
 *   - cases / news / blogs / trade_shows / pages：coverImage、images[]、正文富文本等
 *   - trade_shows 营销弹窗：popupImage、popupContent、externalUrl、ctaUrl
 *   - users.avatar、media_assets.url、chat_messages.content
 *   - internal_documents（summary/content）、internal_document_revisions.content
 *   - settings.value、integrations.config（jsonb，逐字符串替换）
 *   - 其余表/列仅扫描报告命中，不自动订正（人工确认后决定）
 *
 * 前缀可通过 REWRITE_OLD_PREFIX / REWRITE_NEW_PREFIX 覆盖（默认线上 static 域名）；
 * 本地演练用同构的 localhost 前缀即可，SQL 语义与生产完全一致。
 *
 * 用法（apps/api 目录）：
 *   pnpm prisma:rewrite-media-domain                    # dry-run 正向（事务内执行后回滚）
 *   pnpm prisma:rewrite-media-domain -- --apply          # 实际写库（正向）
 *   pnpm prisma:rewrite-media-domain -- --reverse        # dry-run 反向
 *   pnpm prisma:rewrite-media-domain -- --reverse --apply # 实际写库（反向/回滚）
 *   REWRITE_OLD_PREFIX=http://localhost:9000/tzj-uploads-dev \
 *     REWRITE_NEW_PREFIX=http://localhost:9000 \
 *     pnpm prisma:rewrite-media-domain                    # 本地演练
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OLD_PREFIX = process.env.REWRITE_OLD_PREFIX ?? 'https://static.tzjii.com/tzj-uploads-prod';
const NEW_PREFIX = process.env.REWRITE_NEW_PREFIX ?? 'https://static.tzjii.com';
const SENTINEL = '__TZJ_OSS_OLD_PREFIX__';

const isReverse = process.argv.includes('--reverse');
const isApply = process.argv.includes('--apply');

type ColumnKind = 'text' | 'text[]' | 'jsonb';

interface ColumnSpec {
  column: string;
  kind: ColumnKind;
}

interface TableSpec {
  table: string;
  columns: ColumnSpec[];
}

const REWRITE_TABLES: TableSpec[] = [
  {
    table: 'cases',
    columns: [
      { column: 'summary', kind: 'text' },
      { column: 'description', kind: 'text' },
      { column: 'coverImage', kind: 'text' },
      { column: 'images', kind: 'text[]' },
    ],
  },
  {
    table: 'news',
    columns: [
      { column: 'summary', kind: 'text' },
      { column: 'content', kind: 'text' },
      { column: 'coverImage', kind: 'text' },
      { column: 'images', kind: 'text[]' },
    ],
  },
  {
    table: 'blogs',
    columns: [
      { column: 'excerpt', kind: 'text' },
      { column: 'content', kind: 'text' },
      { column: 'coverImage', kind: 'text' },
      { column: 'detailCoverImage', kind: 'text' },
      { column: 'images', kind: 'text[]' },
    ],
  },
  {
    table: 'trade_shows',
    columns: [
      { column: 'summary', kind: 'text' },
      { column: 'content', kind: 'text' },
      { column: 'coverImage', kind: 'text' },
      { column: 'detailCoverImage', kind: 'text' },
      { column: 'images', kind: 'text[]' },
      { column: 'externalUrl', kind: 'text' },
      { column: 'ctaUrl', kind: 'text' },
      { column: 'popupImage', kind: 'text' },
      { column: 'popupContent', kind: 'text' },
    ],
  },
  {
    table: 'pages',
    columns: [
      { column: 'content', kind: 'text' },
      { column: 'coverImage', kind: 'text' },
    ],
  },
  {
    table: 'users',
    columns: [{ column: 'avatar', kind: 'text' }],
  },
  {
    table: 'media_assets',
    columns: [{ column: 'url', kind: 'text' }],
  },
  {
    table: 'chat_messages',
    columns: [{ column: 'content', kind: 'text' }],
  },
  {
    table: 'internal_documents',
    columns: [
      { column: 'summary', kind: 'text' },
      { column: 'content', kind: 'text' },
    ],
  },
  {
    table: 'internal_document_revisions',
    columns: [{ column: 'content', kind: 'text' }],
  },
  {
    table: 'settings',
    columns: [{ column: 'value', kind: 'jsonb' }],
  },
  {
    table: 'integrations',
    columns: [{ column: 'config', kind: 'jsonb' }],
  },
];

function buildUpdateQuery(table: string, column: string, kind: ColumnKind): Prisma.Sql {
  const tableIdent = Prisma.raw(`"${table}"`);
  const columnIdent = Prisma.raw(`"${column}"`);

  if (kind === 'text[]') {
    if (isReverse) {
      return Prisma.sql`
        UPDATE ${tableIdent}
        SET ${columnIdent} = ARRAY(
          SELECT replace(
            replace(
              replace(x, ${OLD_PREFIX}, ${SENTINEL}),
              ${NEW_PREFIX},
              ${OLD_PREFIX}
            ),
            ${SENTINEL},
            ${OLD_PREFIX}
          )
          FROM unnest(${columnIdent}) x
        )
        WHERE EXISTS (
          SELECT 1 FROM unnest(${columnIdent}) x
          WHERE x LIKE '%' || ${OLD_PREFIX} || '%' OR x LIKE '%' || ${NEW_PREFIX} || '%'
        )
      `;
    }
    return Prisma.sql`
      UPDATE ${tableIdent}
      SET ${columnIdent} = ARRAY(
        SELECT replace(x, ${OLD_PREFIX}, ${NEW_PREFIX})
        FROM unnest(${columnIdent}) x
      )
      WHERE EXISTS (
        SELECT 1 FROM unnest(${columnIdent}) x
        WHERE x LIKE '%' || ${OLD_PREFIX} || '%'
      )
    `;
  }

  if (kind === 'jsonb') {
    if (isReverse) {
      return Prisma.sql`
        UPDATE ${tableIdent}
        SET ${columnIdent} = replace(
          replace(
            replace(${columnIdent}::text, ${OLD_PREFIX}, ${SENTINEL}),
            ${NEW_PREFIX},
            ${OLD_PREFIX}
          ),
          ${SENTINEL},
          ${OLD_PREFIX}
        )::jsonb
        WHERE ${columnIdent}::text LIKE '%' || ${OLD_PREFIX} || '%'
           OR ${columnIdent}::text LIKE '%' || ${NEW_PREFIX} || '%'
      `;
    }
    return Prisma.sql`
      UPDATE ${tableIdent}
      SET ${columnIdent} = replace(${columnIdent}::text, ${OLD_PREFIX}, ${NEW_PREFIX})::jsonb
      WHERE ${columnIdent}::text LIKE '%' || ${OLD_PREFIX} || '%'
    `;
  }

  if (isReverse) {
    return Prisma.sql`
      UPDATE ${tableIdent}
      SET ${columnIdent} = replace(
        replace(
          replace(${columnIdent}, ${OLD_PREFIX}, ${SENTINEL}),
          ${NEW_PREFIX},
          ${OLD_PREFIX}
        ),
        ${SENTINEL},
        ${OLD_PREFIX}
      )
      WHERE ${columnIdent} LIKE '%' || ${OLD_PREFIX} || '%'
         OR ${columnIdent} LIKE '%' || ${NEW_PREFIX} || '%'
    `;
  }
  return Prisma.sql`
    UPDATE ${tableIdent}
    SET ${columnIdent} = replace(${columnIdent}, ${OLD_PREFIX}, ${NEW_PREFIX})
    WHERE ${columnIdent} LIKE '%' || ${OLD_PREFIX} || '%'
  `;
}

interface ColumnResult {
  table: string;
  column: string;
  rows: number;
}

const DRY_RUN_ROLLBACK = 'DRY_RUN_ROLLBACK';

async function main(): Promise<void> {
  console.log(
    `[rewrite-media-domain] 方向=${isReverse ? '反向' : '正向'} 模式=${isApply ? '实际写库' : 'dry-run（事务回滚）'}`,
  );
  console.log(
    `[rewrite-media-domain] ${isReverse ? NEW_PREFIX : OLD_PREFIX} → ${isReverse ? OLD_PREFIX : NEW_PREFIX}`,
  );

  const results: ColumnResult[] = [];

  try {
    await prisma.$transaction(async (tx) => {
      for (const table of REWRITE_TABLES) {
        for (const col of table.columns) {
          const query = buildUpdateQuery(table.table, col.column, col.kind);
          const rows = await tx.$executeRaw(query);
          results.push({ table: table.table, column: col.column, rows });
        }
      }
      if (!isApply) {
        throw new Error(DRY_RUN_ROLLBACK);
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === DRY_RUN_ROLLBACK) {
      // dry-run：事务已回滚，仅保留统计
    } else {
      throw err;
    }
  }

  const total = results.reduce((sum, r) => sum + r.rows, 0);
  for (const r of results) {
    if (r.rows > 0) {
      console.log(`  ${r.table}.${r.column}: ${r.rows} 行`);
    }
  }
  console.log(`\n✅ ${isApply ? '已订正' : '将订正（未写库）'} ${total} 行`);

  await scanUncoveredColumns();
}

/** 全库扫描：报告白名单之外仍含两个前缀的表/列（只读，不订正）。 */
async function scanUncoveredColumns(): Promise<void> {
  const columns = await prisma.$queryRaw<
    Array<{ table: string; column: string; dataType: string }>
  >`
    SELECT table_name AS table, column_name AS column, data_type AS "dataType"
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN ('text', 'character varying', 'json', 'jsonb')
      AND table_name NOT LIKE '\\_%'
    ORDER BY table_name, column_name
  `;

  const covered = new Set(
    REWRITE_TABLES.flatMap((t) => t.columns.map((c) => `${t.table}.${c.column}`)),
  );

  let hits = 0;
  for (const col of columns) {
    const id = `${col.table}.${col.column}`;
    if (covered.has(id)) continue;

    const tableIdent = Prisma.raw(`"${col.table}"`);
    const columnIdent = Prisma.raw(`"${col.column}"`);
    const count = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n
      FROM ${tableIdent}
      WHERE ${columnIdent}::text LIKE '%' || ${OLD_PREFIX} || '%'
         OR ${columnIdent}::text LIKE '%' || ${NEW_PREFIX} || '%'
    `;
    const n = Number(count[0]?.n ?? 0);
    if (n > 0) {
      hits++;
      console.log(`⚠️  未纳入订正但命中：${id}（${n} 行）——请人工确认`);
    }
  }

  if (hits === 0) {
    console.log('✅ 全库扫描：白名单外无命中');
  }
}

main()
  .catch((err: unknown) => {
    console.error('❌ rewrite-media-domain 失败:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
