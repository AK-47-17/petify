-- Run once in the Supabase SQL Editor. Safe to rerun; existing records are kept.
-- The application connects from its server. Nothing is exposed to browser roles.
BEGIN;
CREATE SCHEMA IF NOT EXISTS petify;
REVOKE ALL ON SCHEMA petify FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS petify.records (
 id text PRIMARY KEY, owner text NOT NULL, kind text NOT NULL, payload text NOT NULL,
 status text NOT NULL DEFAULT 'pending', amount integer NOT NULL DEFAULT 0 CHECK (amount>=0),
 request_key text NOT NULL, created_at text NOT NULL, updated_at text NOT NULL,
 UNIQUE(owner,request_key)
);
CREATE INDEX IF NOT EXISTS records_owner_kind ON petify.records(owner,kind);
CREATE INDEX IF NOT EXISTS records_created_at ON petify.records(created_at DESC);
CREATE TABLE IF NOT EXISTS petify.customers (
 id text PRIMARY KEY, email text NOT NULL, name text NOT NULL, provider text NOT NULL,
 created_at text NOT NULL, last_seen text NOT NULL
);
CREATE TABLE IF NOT EXISTS petify.rate_limits (
 key text PRIMARY KEY, count integer NOT NULL, expires bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS petify.audit_log (
 id text PRIMARY KEY, actor text NOT NULL, action text NOT NULL, record_id text NOT NULL, created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_created_at ON petify.audit_log(created_at DESC);
CREATE TABLE IF NOT EXISTS petify.record_operations (
 record_id text PRIMARY KEY REFERENCES petify.records(id), notes text NOT NULL DEFAULT '',
 assigned_to text NOT NULL DEFAULT '', payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','refunded')),
 paid_amount integer NOT NULL DEFAULT 0 CHECK(paid_amount>=0), version integer NOT NULL DEFAULT 0,
 updated_at text NOT NULL
);

ALTER TABLE petify.records ENABLE ROW LEVEL SECURITY;
ALTER TABLE petify.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE petify.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE petify.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE petify.record_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA petify FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA petify REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
COMMIT;
