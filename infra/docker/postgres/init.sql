-- ============================================================
-- TZJ Database Initialization Script
-- ============================================================
-- Executed automatically on first container start.
-- Creates extensions and seed schemas.
-- ============================================================

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- Trigram search (fuzzy matching)
CREATE EXTENSION IF NOT EXISTS "btree_gist";  -- GiST indexes for range types

-- Set timezone
ALTER DATABASE tzj_dev SET timezone TO 'Asia/Shanghai';

-- Create a read-only role for monitoring/reporting
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tzj_readonly') THEN
    CREATE ROLE tzj_readonly WITH LOGIN PASSWORD 'tzj_readonly_dev';
    GRANT CONNECT ON DATABASE tzj_dev TO tzj_readonly;
    GRANT USAGE ON SCHEMA public TO tzj_readonly;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO tzj_readonly;
  END IF;
END
$$;
