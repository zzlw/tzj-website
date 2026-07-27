# 访客数据合规抹除操作手册（Runbook）

> 依据：`docs/design/deletion-strategy.md` §3.2-D。访客行为数据（Visitor/PageView）**不做产品化删除**，
> 收到访客/监管的数据删除请求（GDPR「被遗忘权」类）时，由管理员按本手册人工执行。
> 出现频率上升（> 1 次/季度）时再评估产品化（见设计文档 §8 Backlog）。

## 0. 原则

1. **先查后删**：每一步先跑「定位 SQL」确认命中范围，再执行删除/置空。
2. **业务记录与行为流水分开**：Contact（询盘）/ Customer（客户）行是企业业务记录，
   **不自动删除**；如需删除走各自后台回收站流程，删除决策独立作出。
3. **会话优先走产品流程**：ChatRoom 尽量在后台「聊天工作台 → 回收站 → 永久删除」执行
   （自动清 S3 附件 + 审计快照 + 客户断链）；直接 SQL 仅作兜底。
4. **留痕记"删过"而非"删了什么"**：登记访客标识哈希、操作者、时间，不留原始 PII。

## 1. 前置：确定访客标识

删除请求通常携带**邮箱**。先反查出持久匿名访客 ID（`anonymousId`，即前端 `_tzj_vid`）：

```sql
-- 按邮箱反查访客标识（可能多条：多浏览器/多设备）
SELECT "anonymousId", email, name, phone, company, "firstSeenAt", "lastSeenAt"
FROM visitors WHERE email = '<请求者邮箱>';

-- 会话侧补充（访客可能未 identify，仅在聊天中留过邮箱）
SELECT "roomId", "visitorId", "clientEmail", "clientName", status
FROM chat_rooms WHERE "clientEmail" = '<请求者邮箱>';
```

下文以 `:vid`（anonymousId）与 `:email` 指代确认后的标识。多个 `anonymousId` 时逐个执行。

## 2. 定位散落数据（只读盘点）

```sql
-- ① 行为流水
SELECT count(*) FROM page_views WHERE "visitorId" = :vid;
SELECT count(*) FROM visitors   WHERE "anonymousId" = :vid;

-- ② 关联会话（消息/附件随会话删除；附件对象 key 见下）
SELECT "roomId", status, "deletedAt" FROM chat_rooms
WHERE "visitorId" = :vid OR "clientEmail" = :email;

-- ③ 会话附件的 S3/OSS 对象 key 清单（产品内 purge 会自动删除；SQL 兜底时需手工删对象）
SELECT ca.key FROM chat_attachments ca
JOIN chat_messages cm ON cm.id = ca."chatMessageId"
JOIN chat_rooms cr ON cr.id = cm."chatRoomId"
WHERE cr."visitorId" = :vid OR cr."clientEmail" = :email;

-- ④ 业务记录中的访客锚点（仅置空，行不删）
SELECT id, name, email FROM contacts  WHERE "visitorId" = :vid;
SELECT id, name, email FROM customers WHERE "visitorId" = :vid;

-- ⑤ 通知日志中含该访客 PII 的邮件记录（询盘通知的收件人/正文快照）
SELECT id, template, recipient, subject, "created_at" FROM notification_logs
WHERE recipient = :email OR payload::text ILIKE '%' || :email || '%';
```

## 3. 抹除执行

### 3.1 关联会话（优先产品流程）

后台「聊天工作台」→ 打开该访客会话 →「更多操作」→ 移入回收站 →
回收站中「永久删除」（仅管理员可见）。此流程自动：删 S3 附件对象 → 级联删消息/附件行 →
置空 `Customer.chatRoomId` → 写审计快照。

SQL 兜底（仅产品流程不可用时）：先按 §2-③ 清单手工删除 S3/OSS 对象，再：

```sql
BEGIN;
UPDATE customers SET "chatRoomId" = NULL
WHERE "chatRoomId" IN (SELECT "roomId" FROM chat_rooms WHERE "visitorId" = :vid OR "clientEmail" = :email);
DELETE FROM chat_rooms WHERE "visitorId" = :vid OR "clientEmail" = :email; -- 消息/附件行级联删除
COMMIT;
```

### 3.2 行为流水

```sql
BEGIN;
DELETE FROM page_views WHERE "visitorId" = :vid;
DELETE FROM visitors   WHERE "anonymousId" = :vid;
COMMIT;
```

### 3.3 业务记录锚点置空（行保留）

```sql
UPDATE contacts  SET "visitorId" = NULL WHERE "visitorId" = :vid;
UPDATE customers SET "visitorId" = NULL WHERE "visitorId" = :vid;
```

> 若请求方明确要求连询盘/客户记录一并删除，且业务确认可删：走后台各自的
> 回收站 → 永久删除流程（自带断链与审计），不要直接 SQL 删行。

### 3.4 通知日志 PII 抹除（行保留，内容脱敏）

`notification_logs.payload` 中保存了询盘邮件正文快照（含姓名/电话/留言）：

```sql
UPDATE notification_logs
SET recipient = '[erased]', subject = '[erased]', payload = '{"erased": true}'::jsonb
WHERE recipient = :email OR payload::text ILIKE '%' || :email || '%';
```

## 4. 操作留痕（必做）

执行完成后写入审计日志——只登记标识哈希与操作者，不留原始邮箱/ID：

```sql
INSERT INTO audit_logs (id, "userId", action, resource, "resourceId", detail, "createdAt")
VALUES (
  gen_random_uuid()::text,
  '<操作者 users.id>',
  'erase',
  'visitor',
  md5(:vid || ':' || :email),                 -- 标识哈希，"删过"而非"删了什么"
  jsonb_build_object(
    'reason', 'GDPR/合规删除请求',
    'scope',  'page_views + visitors + chat_rooms + notification_logs 脱敏 + 锚点置空',
    'requestReceivedAt', '<请求接收日期 YYYY-MM-DD>'
  ),
  now()
);
```

## 5. 核验清单

- [ ] §2 各定位 SQL 复跑，`page_views`/`visitors`/`chat_rooms` 命中数为 0；
- [ ] §2-③ 附件对象 key 在 MinIO/OSS 控制台确认已不存在；
- [ ] `contacts`/`customers` 中 `visitorId` 已置空（行仍在，除非另行走回收站删除）；
- [ ] `notification_logs` 命中行 recipient/subject/payload 已脱敏；
- [ ] `audit_logs` 留痕行存在（action = 'erase'）；
- [ ] 向请求方回复删除完成（附完成日期，不附数据明细）。
