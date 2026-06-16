# Deployment Workflow

## Overview

This project uses automated GitHub Actions workflows to manage deployments to DEV and PROD environments, including database migrations, Edge Functions, and data synchronization.

## Environments

### PROD (Production)
- **Branch**: `master`
- **Database**: Supabase PROD project
- **Trigger**: Push to `master` branch

### DEV (Development)
- **Branch**: `dev`
- **Database**: Supabase DEV project
- **Trigger**: Push to `dev` branch
- **Data**: Synced daily from PROD

## Automated Workflows

### 1. Deploy to DEV (`.github/workflows/deploy-dev.yml`)

**Triggers:**
- Push to `dev` branch
- Manual trigger via GitHub UI

**Steps:**
1. Checkout code
2. Install Node.js dependencies
3. **Run Drizzle migrations** on DEV database
4. **Deploy Supabase Edge Functions** to DEV project

**Required Secrets:**
- `SUPABASE_DEV_DB_URL` - Direct connection to DEV database (port 5432, already configured for sync)
- `SUPABASE_DEV_PROJECT_REF` - DEV project reference ID
- `SUPABASE_ACCESS_TOKEN` - Personal access token for Supabase CLI

### 2. Deploy to PROD (`.github/workflows/deploy-prod.yml`)

**Triggers:**
- Push to `master` branch
- Manual trigger via GitHub UI

**Steps:**
1. Checkout code
2. Install Node.js dependencies
3. **Run Drizzle migrations** on PROD database
4. **Deploy Supabase Edge Functions** to PROD project

**Required Secrets:**
- `SUPABASE_PROD_DB_URL` - Direct connection to PROD database (port 5432, already configured for sync)
- `SUPABASE_PROD_PROJECT_REF` - PROD project reference ID
- `SUPABASE_ACCESS_TOKEN` - Personal access token for Supabase CLI

### 3. Sync Data PROD → DEV (`.github/workflows/sync-supabase-prod-to-dev.yml`)

**Triggers:**
- Daily at 06:00 UTC (cron)
- After "Deploy to DEV" workflow completes
- Manual trigger via GitHub UI

**Steps:**
1. Install PostgreSQL 17 client
2. Dump PROD database (public schema only)
3. Restore to DEV database

**Required Secrets:**
- `SUPABASE_PROD_DB_URL` - Connection string for PROD (pooler, port 5432)
- `SUPABASE_DEV_DB_URL` - Connection string for DEV (pooler, port 5432)

## Complete Flow Examples

### DEV Deployment Flow

```
1. Developer pushes to `dev` branch
2. → "Deploy to DEV" workflow starts
3.   ├─ Runs migrations on DEV
4.   └─ Deploys Edge Functions to DEV
5. → "Sync Data PROD → DEV" workflow starts automatically
6.   └─ Syncs data from PROD to DEV
7. ✅ DEV environment fully updated
```

### PROD Deployment Flow

```
1. Developer pushes to `master` branch
2. → "Deploy to PROD" workflow starts
3.   ├─ Runs migrations on PROD
4.   └─ Deploys Edge Functions to PROD
5. ✅ PROD environment fully updated
```

## GitHub Secrets Configuration

### Required Secrets

Go to: **GitHub Repository → Settings → Secrets and variables → Actions**

### Already Configured (for sync and migrations)
```bash
# Database URLs (port 5432, no pgbouncer - used for sync and migrations)
SUPABASE_DEV_DB_URL=postgresql://postgres.DEV_REF:PASSWORD@aws-1-us-east-2.pooler.supabase.com:5432/postgres
SUPABASE_PROD_DB_URL=postgresql://postgres.PROD_REF:PASSWORD@aws-1-us-east-1.pooler.supabase.com:5432/postgres
```

### New Secrets to Add
```bash
# Supabase Project References
SUPABASE_DEV_PROJECT_REF=xxxxxxxxxxxxx
SUPABASE_PROD_PROJECT_REF=yyyyyyyyyyyyy

# Supabase Access Token (get from: https://supabase.com/dashboard/account/tokens)
SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Note About App vs Migrations
Your app uses a different `DATABASE_URL` (port 6543 with pgbouncer) for better performance. The workflows use the port 5432 URLs (already configured) for migrations and sync.

### How to Get Supabase Access Token

1. Go to: https://supabase.com/dashboard/account/tokens
2. Click "Generate new token"
3. Name it: `GitHub Actions`
4. Copy the token and save it as `SUPABASE_ACCESS_TOKEN` secret in GitHub

### How to Get Project References

1. Go to your Supabase project
2. Settings → General → Reference ID
3. Copy the reference ID (e.g., `abcdefghijklmnop`)

## Manual Triggers

All workflows can be triggered manually:

1. Go to: **GitHub → Actions**
2. Select the workflow you want to run
3. Click **"Run workflow"**
4. Select the branch
5. Click **"Run workflow"** button

## What Gets Deployed/Synced

| Component | DEV | PROD | Automatic? |
|-----------|-----|------|------------|
| **App Code** | Vercel | Vercel | ✅ Yes (Vercel) |
| **Database Schema** | Migrations | Migrations | ✅ Yes (GH Actions) |
| **Database Data** | ← From PROD | Production | ✅ Yes (Daily + After DEV deploy) |
| **Edge Functions** | Deploy | Deploy | ✅ Yes (GH Actions) |

## Best Practices

### Development Workflow

1. **Create feature branch** from `dev`
2. **Develop locally** with local Supabase or DEV connection
3. **Create migrations** if needed: `npm run -w web db:generate`
4. **Test locally**
5. **Push to feature branch** and create PR to `dev`
6. **Merge to `dev`** → DEV auto-deploys
7. **Test in DEV** with production-like data
8. **Create PR to `master`** when ready
9. **Merge to `master`** → PROD auto-deploys

### Migration Best Practices

- Always test migrations in DEV before PROD
- Migrations run automatically on push to `dev`/`master`
- If migration fails, the workflow fails (safe)
- Migrations are transactional (all or nothing)

### Edge Functions

- All functions in `supabase/functions/` are deployed together
- Test functions in DEV before merging to `master`
- Functions share the `SUPABASE_ACCESS_TOKEN` for deployment

## Monitoring

### Check Workflow Status

1. Go to: **GitHub → Actions**
2. View recent workflow runs
3. Click on a run to see detailed logs

### Verify Deployment

**After DEV deployment:**
- Check DEV database for new migrations: `_drizzle_migrations` table
- Test Edge Functions in DEV environment
- Verify data sync completed

**After PROD deployment:**
- Check PROD database for new migrations
- Test Edge Functions in PROD environment
- Monitor application for issues

## Troubleshooting

### Migration Fails

**Check:**
- Database connection string is correct
- Database has sufficient permissions
- Migration SQL is valid
- No conflicting changes in database

**Solution:**
- Review migration file in `apps/web/lib/db/migrations/`
- Test migration locally
- Fix and push again

### Edge Function Deploy Fails

**Check:**
- `SUPABASE_ACCESS_TOKEN` is valid
- Project reference is correct
- Function code is valid Deno/TypeScript

**Solution:**
- Regenerate access token if expired
- Test function locally with Supabase CLI
- Check function logs in Supabase dashboard

### Data Sync Fails

**Check:**
- Both database URLs are correct
- Password special characters are URL-encoded (`@` → `%40`)
- Network connectivity between GitHub and Supabase

**Solution:**
- Verify secrets in GitHub settings
- Check workflow logs for specific error
- Test connection strings manually

## Related Documentation

- [Supabase Sync Setup](./supabase-sync-prod-to-dev.md)
- [Database Migrations (Drizzle)](../apps/web/lib/db/README.md)
- [Edge Functions](../supabase/README.md)

