# Local Development Setup Guide

Complete guide for setting up and using local Supabase for development.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Available Commands](#available-commands)
- [Developer Workflows](#developer-workflows)
- [Database Migrations](#database-migrations)
- [Data Synchronization](#data-synchronization)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

## Overview

We use local Supabase instances for development to provide each developer with:

- **Isolated environment**: Your own PostgreSQL database
- **Full Supabase stack**: Database, Auth, Storage, Edge Functions
- **Data sync**: Easily sync data from DEV environment
- **Fast development**: No network latency, instant resets
- **Safe testing**: Experiment without affecting shared environments

## Prerequisites

### Required Software

1. **Docker Desktop** (required for local Supabase)
   - macOS: [Download Docker Desktop](https://www.docker.com/products/docker-desktop)
   - Ubuntu: `sudo apt-get install docker.io docker-compose`
   - Verify: `docker --version`

2. **Supabase CLI**
   - macOS: `brew install supabase/tap/supabase`
   - Ubuntu: See [Supabase CLI docs](https://supabase.com/docs/guides/cli)
   - Verify: `supabase --version`

3. **PostgreSQL 17 Client Tools** (for data sync)
   - macOS: `brew install postgresql@17`
   - Ubuntu: `sudo apt-get install postgresql-client-17`
   - Verify: `pg_dump --version` (should be 17.x)
   - **Note:** The sync script automatically finds PostgreSQL 17 if installed via Homebrew

4. **Node.js 18+** (already required for the project)
   - Verify: `node --version`

## Quick Start

**Get up and running in 3 steps:**

```bash
# 1. Set up your local environment file
cp apps/web/env.example apps/web/.env.local
# Edit apps/web/.env.local and add your values

# 2. Start local Supabase
npm run db:local:start

# 3. (Optional) Sync data from DEV
npm run db:local:sync
```

That's it! Your local database is ready at `localhost:54322`.

## Detailed Setup

### Step 1: Clone and Install

```bash
cd /path/to/your-project
npm install
```

### Step 2: Environment Configuration

Create your `apps/web/.env.local` file with the correct configuration:

**Copy the example file and fill in values:**

```bash
cp apps/web/env.example apps/web/.env.local
```

Edit `apps/web/.env.local`:

```bash
# Required for local development
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-local-secret-min-32-chars

# Optional: For syncing data from DEV
# Get from Supabase dashboard:
#   1. Go to https://supabase.com/dashboard/project/your-project-dev
#   2. Connect → ORMs → Drizzle
#   3. Select 'Use Shared connection pooler (supports both IPv4/IPv6)'
#   4. Replace [YOUR_PASSWORD] with the actual password from 1Password
#
# ⚠️  MUST be SESSION pooler (port 6543, NOT Transaction 5432):
SUPABASE_DEV_DB_URL=postgresql://postgres.XXX:PASSWORD@aws-1-us-east-2.pooler.supabase.com:6543/postgres

# Add other environment-specific variables as needed
```

### Step 3: Start Local Supabase

```bash
npm run db:local:start
```

This command:

- Starts PostgreSQL 17 on port `54322`
- Starts Supabase Studio UI on port `54323`
- Starts Auth, Storage, and other services
- Creates a fresh local database

**First time start takes 2-3 minutes** as Docker downloads images.

Verify it's running:

```bash
npm run db:local:status
```

You should see:

```
API URL: http://localhost:54321
DB URL: postgresql://postgres:postgres@localhost:54322/postgres
Studio URL: http://localhost:54323
...
```

### Step 4: Apply Migrations

Apply the database schema to your local database:

```bash
npm run db:migrate
```

This runs all Drizzle migrations in `apps/web/lib/db/migrations/`.

### Step 5: Sync Data (Optional)

If you want real data from DEV environment:

```bash
npm run db:local:sync
```

This will:

1. Dump DEV database (public schema only)
2. Clean and restore to your local database
3. Give you a full copy of DEV data

**Note:** This requires `SUPABASE_DEV_DB_URL` in `apps/web/.env.local`.

## Available Commands

### Quick Reference

| Command           | Description                                  |
| ----------------- | -------------------------------------------- |
| `npm run db:help` | **Show all database commands and workflows** |

### Database Management

| Command                   | Description                            |
| ------------------------- | -------------------------------------- |
| `npm run db:local:start`  | Start local Supabase (requires Docker) |
| `npm run db:local:stop`   | Stop local Supabase                    |
| `npm run db:local:reset`  | Reset local DB to clean state          |
| `npm run db:local:status` | Show status of local services          |

### Data Sync

| Command                 | Description                 |
| ----------------------- | --------------------------- |
| `npm run db:local:sync` | Sync data from DEV to local |

### Migrations

| Command               | Description                      |
| --------------------- | -------------------------------- |
| `npm run db:migrate`  | Apply Drizzle migrations         |
| `npm run db:generate` | Create new migration from schema |

### Development

| Command       | Description              |
| ------------- | ------------------------ |
| `npm run dev` | Start Next.js dev server |

## Developer Workflows

### Daily Development Workflow

```bash
# Morning: Start local environment
npm run db:local:start
npm run dev

# ... work on features ...

# Evening: Stop local environment
npm run db:local:stop
```

### Working on a New Feature

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Start local environment
npm run db:local:start

# 3. If you need fresh data
npm run db:local:sync

# 4. Develop and test
npm run dev

# 5. Commit and push
git add .
git commit -m "feat: my feature"
git push origin feature/my-feature
```

### Creating a Database Migration

When you need to change the database schema:

```bash
# 1. Edit the schema
# Edit: apps/web/lib/db/schema.ts

# 2. Generate migration
npm run db:generate
# This creates a new file in apps/web/lib/db/migrations/

# 3. Apply migration locally
npm run db:migrate

# 4. Test the changes
npm run dev

# 5. Commit the migration
git add apps/web/lib/db/migrations/
git add apps/web/lib/db/schema.ts
git commit -m "feat: add new table for X"

# 6. Push to dev branch
git push origin your-branch

# GitHub Actions will automatically apply the migration to DEV
```

### Pulling New Migrations

When someone else adds a migration:

```bash
# 1. Pull latest code
git pull origin dev

# 2. Apply new migrations
npm run db:migrate

# 3. Continue developing
npm run dev
```

## Database Migrations

### How Migrations Work

- **Schema definition**: `apps/web/lib/db/schema.ts`
- **Migrations folder**: `apps/web/lib/db/migrations/`
- **Tracking**: Drizzle uses `_drizzle_migrations` table to track applied migrations

### Creating a Migration

1. **Edit schema.ts**: Add/modify tables, columns, indexes
2. **Generate migration**: `npm run db:generate`
3. **Review migration**: Check the generated SQL file
4. **Apply locally**: `npm run db:migrate`
5. **Test thoroughly**: Make sure app works with new schema
6. **Commit**: Include both schema.ts and migration files

### Migration Best Practices

- **Always generate migrations** - Never edit schema.ts without running `db:generate`
- **Test locally first** - Apply and test migrations on local DB before pushing
- **One change per migration** - Don't bundle unrelated schema changes
- **Review generated SQL** - Make sure it does what you expect
- **Never edit applied migrations** - If a migration has been applied to DEV/PROD, create a new one to fix issues

## Data Synchronization

### Syncing from DEV to Local

The sync script (`npm run db:local:sync`) performs these steps:

1. **Dump DEV database** using `pg_dump`
   - Only `public` schema (not auth, storage)
   - Includes `DROP` statements to clean existing data
   - Removes system objects and permissions

2. **Post-process dump**
   - Removes `ALTER SCHEMA OWNER` commands
   - Ensures compatibility with local Supabase

3. **Restore to local** using `psql`
   - Runs in a single transaction
   - Stops on any error

### When to Sync

- **First time setup**: Get initial data
- **After major data changes**: Pull latest test data
- **Before testing**: Ensure consistent test environment
- **After DB reset**: Repopulate clean database

### Sync Considerations

- **Sync is destructive**: Replaces all data in local DB
- **Takes 1-5 minutes**: Depending on data size
- **Requires DEV access**: Need `SUPABASE_DEV_DB_URL` configured
- **Schema must match**: Local migrations should be up to date

## Troubleshooting

### Local Supabase Won't Start

**Error: "Cannot connect to Docker daemon"**

```bash
# Solution: Start Docker Desktop
open -a Docker  # macOS
# Or launch Docker Desktop from Applications
```

**Error: "Port 54322 already in use"**

```bash
# Solution 1: Stop existing Supabase
npm run db:local:stop

# Solution 2: Find and kill process using port
lsof -ti:54322 | xargs kill -9

# Solution 3: Change port in supabase/config.toml
```

### Sync Fails

**Error: "Local Supabase is not running"**

```bash
# Solution: Start local Supabase first
npm run db:local:start
npm run db:local:sync
```

**Error: "SUPABASE_DEV_DB_URL not found"**

```bash
# Solution: Add DEV URL to apps/web/.env.local
# Get URL from: https://supabase.com/dashboard/project/your-project-dev
# 1. Go to project dashboard
# 2. Connect → ORMs → Drizzle
# 3. Select 'Use Shared connection pooler (supports both IPv4/IPv6)'
# 4. Replace [YOUR_PASSWORD] with the actual password from 1Password
echo 'SUPABASE_DEV_DB_URL=postgresql://postgres.xxx:pass@aws-X-XX.pooler.supabase.com:6543/postgres' >> apps/web/.env.local
```

**Error: "connection to server... failed: Operation timed out"**

```bash
# This usually means you're using the DIRECT connection URL instead of POOLER
#
# ❌ Wrong (Direct): postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres
# ✅ Correct (Session Pooler): postgresql://postgres.xxx:pass@aws-X-XX.pooler.supabase.com:6543/postgres
#
# Solution: Get the correct SESSION POOLER URL:
# 1. Supabase dashboard
# 2. Connect → ORMs → Drizzle
# 3. Select 'Use Shared connection pooler (supports both IPv4/IPv6)'
# 4. Replace [YOUR_PASSWORD] with password from 1Password
# 5. Update SUPABASE_DEV_DB_URL in apps/web/.env.local with the session pooler URL
```

**Error: "Does not support PREPARE statements"**

```bash
# This means you're using TRANSACTION pooler instead of SESSION pooler
#
# ❌ Wrong (Transaction): postgresql://...pooler.supabase.com:5432/postgres
# ✅ Correct (Session):    postgresql://...pooler.supabase.com:6543/postgres
#                                                                ^^^^
#                                                           Port 6543 = Session
#
# Transaction pooler (port 5432) does NOT support pg_dump.
# Session pooler (port 6543) supports all PostgreSQL features.
#
# Solution:
# 1. Supabase dashboard
# 2. Connect → ORMs → Drizzle
# 3. Select 'Use Shared connection pooler (supports both IPv4/IPv6)'
# 4. Update SUPABASE_DEV_DB_URL in apps/web/.env.local
```

**Error: "pg_dump: command not found"**

```bash
# Solution: Install PostgreSQL client tools
brew install postgresql@17  # macOS
sudo apt-get install postgresql-client-17  # Ubuntu
```

### Migration Errors

**Error: "relation already exists"**

```bash
# Solution: Reset local database
npm run db:local:reset
npm run db:migrate
```

**Error: "migration X has already been applied"**

This is normal and safe - Drizzle skips already-applied migrations.

### Next.js Connection Errors

**Error: "connect ECONNREFUSED ::1:54322"**

```bash
# Solution: Check DATABASE_URL in apps/web/.env.local
# Make sure it uses 'localhost' not '::1'
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

### Supabase Studio Not Loading

1. Check status: `npm run db:local:status`
2. Open Studio: `http://localhost:54323`
3. If still not working: `npm run db:local:stop && npm run db:local:start`

## FAQ

### Q: Do I need to stop local Supabase when I'm done?

**A:** Not required, but recommended to free up resources. Docker containers consume memory even when idle.

### Q: Can I use the same local DB across different branches?

**A:** Yes, but be careful with migrations. If branches have conflicting schema changes, reset the DB when switching:

```bash
git checkout feature-a
npm run db:local:reset
npm run db:migrate
```

### Q: How do I access Supabase Studio?

**A:** Open `http://localhost:54323` in your browser after running `npm run db:local:start`.

### Q: Can multiple developers share the same local Supabase?

**A:** No - each developer should run their own local instance. Supabase runs on `localhost`, so it's isolated per machine.

### Q: What if I accidentally delete important data locally?

**A:** Just sync again: `npm run db:local:sync`. Local data is disposable - DEV is the source of truth.

### Q: How often should I sync from DEV?

**A:** Whenever you need fresh data. Many developers sync once per week or before starting a new feature.

### Q: Can I use the local DB for automated tests?

**A:** Yes! Tests can connect to `localhost:54322`. Consider using `db:local:reset` in your test setup.

### Q: Do I need to initialize `_drizzle_migrations` table locally?

**A:** No - running `npm run db:migrate` will create it automatically on first run.

### Q: What about PROD data - can I sync from PROD?

**A:** Not directly - we only sync DEV → Local. PROD → DEV sync happens via GitHub Actions (see `docs/supabase-sync-prod-to-dev.md`).

### Q: How do I know which migrations are applied?

**A:** Query the tracking table:

```sql
SELECT * FROM _drizzle_migrations ORDER BY id;
```

Or check in Supabase Studio at `http://localhost:54323`.

### Q: Can I run multiple Next.js apps against the same local DB?

**A:** Yes - as long as they use the same `DATABASE_URL` pointing to `localhost:54322`.

## Additional Resources

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [GitHub Actions Deployment](./deployment-workflow.md)
- [Database Sync Documentation](./supabase-sync-prod-to-dev.md)

## Getting Help

- Check existing issues in the repo
- Ask in team Slack channel
- Review Supabase logs: `supabase db logs`
- Check Next.js console for connection errors

---

**Last Updated:** 2025-01-20
