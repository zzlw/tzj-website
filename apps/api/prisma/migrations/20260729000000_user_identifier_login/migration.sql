-- 多标识登录：email 归一化清洗 + phone 清洗去重 + phone 唯一索引
-- 见 docs/login-multi-identifier-and-2fa-guide-design.md §3.3
-- 顺序必须是「清洗 → 去重 → 建索引」：先去重后清洗会因归一化制造新重复，照样撞唯一索引

-- ① email：先按 lower(email) 去重再统一小写。
--    顺序不可反：现有 unique(email) 大小写敏感，直接 lower() 清洗会自撞唯一约束。
--    去重比较用 (updatedAt, id) 复合序：同刻批量写入时 updatedAt 并列，仅比 updatedAt 会两行都保留
UPDATE "users" u SET "email" = NULL
WHERE "email" IS NOT NULL AND EXISTS (
  SELECT 1 FROM "users" x
  WHERE lower(x."email") = lower(u."email") AND x."id" <> u."id"
    AND (x."updatedAt", x."id") > (u."updatedAt", u."id")
);
UPDATE "users" SET "email" = lower("email") WHERE "email" IS NOT NULL AND "email" <> lower("email");

-- ② phone：清洗（去空格/连字符、剥 +86 前缀）；非 ^1\d{10}$ 形态的存量值（座机/国际号）原样保留
UPDATE "users" SET "phone" = regexp_replace("phone", '[\s-]', '', 'g') WHERE "phone" IS NOT NULL;
UPDATE "users" SET "phone" = regexp_replace("phone", '^\+?86(?=1\d{10}$)', '') WHERE "phone" IS NOT NULL;

-- ③ phone：按清洗后的值去重（同值保留 updatedAt 最新的一条，其余置 NULL；同样复合序兜底并列）
UPDATE "users" u SET "phone" = NULL
WHERE "phone" IS NOT NULL AND EXISTS (
  SELECT 1 FROM "users" x
  WHERE x."phone" = u."phone" AND x."id" <> u."id"
    AND (x."updatedAt", x."id") > (u."updatedAt", u."id")
);

-- ④ 唯一索引（Postgres 对 nullable 列天然允许多行 NULL）
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
