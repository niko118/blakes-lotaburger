-- Initialize _drizzle_migrations table for existing databases
-- 
-- This script should be run ONCE on PROD and DEV databases where:
-- 1. The schema already exists (tables created)
-- 2. The _drizzle_migrations table is empty or doesn't exist
-- 
-- Purpose: Tell Drizzle ORM which migrations have already been applied
-- so it doesn't try to re-run them and cause errors.
--
-- Usage:
--   Run this in Supabase SQL Editor or via psql:
--   psql $DATABASE_URL -f scripts/sql/init-drizzle-migrations.sql
--
-- Last updated: 2025-01-20
-- Migration count: 15 (0000 through 0014)

-- Create _drizzle_migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS "_drizzle_migrations" (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

-- Insert all existing migrations (0000 through 0014)
-- Only insert if they don't already exist
INSERT INTO "_drizzle_migrations" (hash, created_at)
SELECT migration_hash, extract(epoch from now())::bigint * 1000
FROM (
  VALUES
    ('0000_lumpy_morph'),
    ('0001_equal_prima'),
    ('0002_fantastic_vivisector'),
    ('0003_futuristic_eternity'),
    ('0004_youthful_nighthawk'),
    ('0005_create_app_users'),
    ('0006_tired_venus'),
    ('0007_calm_ken_ellis'),
    ('0008_overjoyed_apocalypse'),
    ('0009_dear_red_shift'),
    ('0010_cool_romulus'),
    ('0011_abandoned_thunderbolts'),
    ('0012_sticky_bushwacker'),
    ('0013_huge_bug'),
    ('0014_change_customer_to_customer_id')
) AS migrations(migration_hash)
WHERE NOT EXISTS (
  SELECT 1 FROM "_drizzle_migrations" WHERE hash = migration_hash
);

-- Verify the migrations were inserted
SELECT 
  COUNT(*) as total_migrations,
  MIN(created_at) as first_migration_time,
  MAX(created_at) as last_migration_time
FROM "_drizzle_migrations";

-- Display all migrations for verification
SELECT id, hash, to_timestamp(created_at/1000) as created_at
FROM "_drizzle_migrations"
ORDER BY id;

