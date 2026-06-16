# Database Migration Policy

**Last Updated:** 2026-01-23
**Applies to:** All developers working on this project

---

## Table of Contents

1. [Core Principle](#core-principle)
2. [Migration Execution Environments](#migration-execution-environments)
3. [Developer Workflow](#developer-workflow)
4. [Safety Guarantees](#safety-guarantees)
5. [Team Rules](#team-rules)
6. [Troubleshooting](#troubleshooting)
7. [Emergency Procedures](#emergency-procedures)
8. [FAQ](#faq)

---

## Core Principle

> **Migrations are NEVER executed from the application runtime.**

All database schema changes must be applied via:
- **Automated CI/CD**: GitHub Actions workflows for DEV and PROD
- **Manual Local**: Developer workstations for local development and testing

**Never** in:
- Vercel deployments (production, preview, development)
- Application runtime (API routes, server components, middleware)
- Build processes (`next build`, `turbo build`)
- Edge Functions (Supabase Functions)

---

## Migration Execution Environments

### 1. Local Development (Manual)

**Purpose:** Test schema changes before committing

**Database:** Local Supabase instance (`localhost:54322`)

**Process:**
```bash
# Edit schema
vim apps/web/lib/db/schema.ts

# Generate migration
npm run -w web db:generate

# Review migration SQL
cat apps/web/lib/db/migrations/XXXX_*.sql

# Apply to local DB
npm run -w web db:migrate

# Test app
npm run dev
```

**Configuration:**
- Uses `DATABASE_URL` from `apps/web/.env.local`
- Points to local PostgreSQL: `postgresql://postgres:postgres@localhost:54322/postgres`

---

### 2. DEV Environment (Automated)

**Purpose:** Integration testing with shared development data

**Database:** Supabase DEV project

**Triggers:**
- Push to `dev` branch
- **Pull requests to `master` branch** (applies migrations to DEV for preview testing)

**Workflow:** `.github/workflows/deploy-dev.yml`

```yaml
- name: Run migrations on DEV
  env:
    DATABASE_URL: ${{ secrets.SUPABASE_DEV_DB_URL }}
  run: |
    npm run -w web db:migrate
```

**Flow (Push to dev):**
1. Developer pushes code to `dev` branch
2. GitHub Actions runs workflow
3. Migrations applied to DEV database
4. Vercel deploys app code (NO migrations in deployment)
5. Preview deployments use updated DEV schema

**Flow (PR to master):**
1. Developer opens PR from `feature/branch` to `master`
2. GitHub Actions runs workflow (if schema/migrations changed)
3. Migrations applied to DEV database
4. Vercel creates preview deployment (connects to DEV with updated schema)
5. Developer tests feature in preview before merging to production

---

### 3. PROD Environment (Automated)

**Purpose:** Production schema updates

**Database:** Supabase PROD project

**Trigger:** Push to `master` branch

**Workflow:** `.github/workflows/deploy-prod.yml`

```yaml
- name: Run migrations on PROD
  env:
    DATABASE_URL: ${{ secrets.SUPABASE_PROD_DB_URL }}
  run: |
    npm run -w web db:migrate
```

**Flow:**
1. PR merged to `master` branch
2. GitHub Actions runs workflow
3. Migrations applied to PROD database
4. Vercel deploys app code (NO migrations in deployment)
5. Production app uses updated schema

---

## Developer Workflow

### Step-by-Step: Making a Schema Change

```
┌─────────────────────────────────────────────────────────────┐
│ 1. LOCAL: Edit Schema                                       │
│    File: apps/web/lib/db/schema.ts                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. LOCAL: Generate Migration                                │
│    Command: npm run -w web db:generate                      │
│    Output: apps/web/lib/db/migrations/XXXX_description.sql  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. LOCAL: Review Migration SQL                              │
│    ├─ Check for correctness                                 │
│    ├─ Verify no destructive changes (unless intended)       │
│    └─ Ensure backwards compatibility if needed              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. LOCAL: Apply Migration                                   │
│    Command: npm run -w web db:migrate                       │
│    Target: Local DB (localhost:54322)                       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. LOCAL: Test Changes                                      │
│    ├─ Command: npm run dev                                  │
│    ├─ Test affected features                                │
│    └─ Verify GraphQL schema matches DB schema               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. GIT: Commit Migration                                    │
│    ├─ git add apps/web/lib/db/schema.ts                     │
│    ├─ git add apps/web/lib/db/migrations/                   │
│    └─ git commit -m "feat: add users table"                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. GIT: Push to Feature Branch                              │
│    Command: git push origin feature/users-table             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. PR: Open Pull Request to 'dev'                           │
│    ├─ PR checks run (migration-safety-check, etc.)          │
│    ├─ Code review                                           │
│    └─ Approval                                              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. CI: Merge to 'dev'                                       │
│    ├─ Trigger: deploy-dev.yml                               │
│    ├─ Migrations applied to DEV DB                          │
│    └─ Vercel preview deployed                               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 10. TESTING: Verify DEV Environment                         │
│     ├─ Test in Vercel preview                               │
│     ├─ Verify data integrity                                │
│     └─ Confirm GraphQL API works                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 11. PR: Open Pull Request to 'master'                       │
│     ├─ Final code review                                    │
│     ├─ QA approval                                          │
│     └─ Merge                                                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 12. CI: Merge to 'master'                                   │
│     ├─ Trigger: deploy-prod.yml                             │
│     ├─ Migrations applied to PROD DB                        │
│     └─ Vercel production deployed                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 13. DONE: Schema Updated in PROD                            │
│     └─ Monitor for errors                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Safety Guarantees

The codebase implements **multiple layers of protection** to prevent accidental migrations in Vercel:

### Layer 1: No Runtime Migration Code

**Protection:** The application never imports migration functions.

**Verification:**
```bash
grep -r "import.*migrate\|from.*drizzle-kit" apps/web/app apps/web/lib
# Result: No matches
```

**Enforcement:**
- GitHub Actions PR check: `migration-safety-check`
- Fails CI if migration imports found in runtime code

---

### Layer 2: Hard Block in db.ts

**File:** `apps/web/lib/server/db.ts`

**Protection:** If someone tries to call `db.migrate()` in Vercel, it throws:

```typescript
if (typeof process.env.VERCEL_ENV !== "undefined") {
  Object.defineProperty(db, "migrate", {
    get() {
      throw new Error(
        "❌ MIGRATION BLOCKED: Migrations cannot be run from application runtime code.\n" +
        "Migrations are executed exclusively via GitHub Actions"
      );
    }
  });
}
```

**Effect:** Even if someone imports `migrate()`, calling it in Vercel will crash immediately with a clear error.

---

### Layer 3: Environment Isolation

**Separation of concerns:**

| Environment | Variable | Access | Purpose |
|-------------|----------|--------|---------|
| **Local Dev** | `DATABASE_URL` | `apps/web/.env.local` | Local Supabase |
| **Vercel Preview** | `DATABASE_URL` | Vercel env var | DEV DB (read/write) |
| **Vercel Prod** | `DATABASE_URL` | Vercel env var | PROD DB (read/write) |
| **CI (DEV)** | `DATABASE_URL` | GitHub secret | DEV DB (migrations) |
| **CI (PROD)** | `DATABASE_URL` | GitHub secret | PROD DB (migrations) |

**Key insight:**
- Vercel **never** has access to `SUPABASE_DEV_DB_URL` or `SUPABASE_PROD_DB_URL`
- CI **never** deploys to Vercel
- Migrations run in CI, deployment happens in Vercel (separate processes)

---

### Layer 4: PR Validation

**Workflow:** `.github/workflows/pr-checks.yml`

**Checks:**

1. **migration-check**: If `schema.ts` changed, migration files must exist
2. **migration-safety-check**: No forbidden imports in runtime code
3. **No lifecycle hooks**: No `postinstall`/`postbuild` running migrations

**Effect:** Pull requests with unsafe migration code cannot pass CI.

---

## Team Rules

### ✅ DO

1. **Generate migrations locally:**
   ```bash
   npm run -w web db:generate
   ```

2. **Test migrations on local DB before committing:**
   ```bash
   npm run -w web db:migrate
   npm run dev  # Verify app works
   ```

3. **Commit migration files with schema changes:**
   ```bash
   git add apps/web/lib/db/schema.ts
   git add apps/web/lib/db/migrations/
   git commit -m "feat: add new_table for feature_x"
   ```

4. **Trust CI to apply migrations to DEV/PROD:**
   - Push to `dev` → CI migrates DEV
   - Merge to `master` → CI migrates PROD

5. **Use PR checks to validate:**
   - Schema changed? Migration must exist
   - No forbidden imports in runtime code

6. **Review migration SQL before committing:**
   - Check for `DROP TABLE` or destructive changes
   - Ensure backwards compatibility if needed
   - Consider data migrations (not just schema)

7. **Update GraphQL schema when DB schema changes:**
   - Edit `apps/web/graphql/type-defs.ts`
   - Update types in `apps/web/types/index.ts`
   - Ensure field names match (camelCase in GraphQL, snake_case in DB)

---

### ❌ DON'T

1. **NEVER import migration functions in app code:**
   ```typescript
   // ❌ FORBIDDEN in apps/web/app/ or apps/web/lib/
   import { migrate } from "drizzle-orm/postgres-js/migrator";
   import { drizzle } from "drizzle-kit";
   ```

2. **NEVER run migrations manually against DEV/PROD databases:**
   ```bash
   # ❌ DON'T connect to remote DB manually
   DATABASE_URL=postgresql://remote-db... npm run -w web db:migrate
   ```
   **Exception:** Emergency hotfix (see Emergency Procedures)

3. **NEVER add lifecycle hooks that run migrations:**
   ```json
   // ❌ FORBIDDEN in package.json
   {
     "postinstall": "npm run db:migrate",  // NO!
     "postbuild": "drizzle-kit push"       // NO!
   }
   ```

4. **NEVER add `SUPABASE_DEV_DB_URL` or `SUPABASE_PROD_DB_URL` to Vercel:**
   - These are for CI (GitHub Actions) only
   - Vercel should only have `DATABASE_URL` (read/write access)

5. **NEVER use `drizzle-kit push` in CI or production:**
   ```bash
   # ❌ DANGEROUS - bypasses migration history
   drizzle-kit push
   ```
   - `push` applies schema changes directly without migrations
   - Always use `drizzle-kit generate` + `drizzle-kit migrate`

6. **NEVER skip migration generation:**
   ```bash
   # ❌ BAD: Schema changed but no migration
   git add apps/web/lib/db/schema.ts
   git commit -m "Updated schema"  # Missing migration files!
   ```
   - CI will fail with: "Schema changed but no migration added"

---

## Troubleshooting

### Problem: "Schema changed but no migration added" in CI

**Cause:** You edited `apps/web/lib/db/schema.ts` but didn't generate a migration.

**Fix:**
```bash
npm run -w web db:generate
git add apps/web/lib/db/migrations/
git commit --amend --no-edit
git push --force-with-lease
```

---

### Problem: Migration fails in CI with "relation already exists"

**Cause:** Migration was already applied to DEV/PROD database.

**Fix:**
```bash
# Local: Mark migration as applied without running it
# Connect to DEV DB (get URL from Supabase dashboard)
psql $SUPABASE_DEV_DB_URL

-- In psql:
INSERT INTO _drizzle_migrations (version, created_at)
VALUES ('0015_description', NOW());
```

**Prevention:** Always test migrations locally first.

---

### Problem: Local migration fails with "database is locked"

**Cause:** Multiple connections to local Supabase or Next.js dev server is running.

**Fix:**
```bash
# Stop Next.js dev server
# Stop any other processes using the DB
npm run db:local:stop
npm run db:local:start
npm run -w web db:migrate
```

---

### Problem: "Cannot find migrations directory" in CI

**Cause:** Migration files not committed to Git.

**Fix:**
```bash
# Verify migration files exist locally
ls apps/web/lib/db/migrations/

# Add and commit
git add apps/web/lib/db/migrations/
git commit -m "chore: add missing migrations"
git push
```

---

### Problem: Vercel build fails with "DATABASE_URL not defined"

**Cause:** `DATABASE_URL` not set in Vercel environment variables.

**Fix:**
1. Go to Vercel → Project Settings → Environment Variables
2. Add `DATABASE_URL`:
   - **Production**: Use PROD database URL
   - **Preview**: Use DEV database URL
3. Redeploy

---

## Emergency Procedures

### Scenario 1: Critical Bug in Production Schema

**Problem:** A migration was applied to PROD that breaks the application.

**Immediate Action:**

1. **Revert deployment in Vercel:**
   ```bash
   # Go to Vercel dashboard → Deployments
   # Find previous working deployment
   # Click "..." → "Promote to Production"
   ```

2. **Rollback migration in database:**
   ```bash
   # Connect to PROD DB (carefully!)
   psql $SUPABASE_PROD_DB_URL
   
   # Manually reverse the migration
   # (Run the inverse of the migration SQL)
   ```

3. **Revert migration in code:**
   ```bash
   git revert <commit-hash>
   git push origin master
   ```

4. **Post-mortem:**
   - Document what went wrong
   - Update migration policy if needed
   - Add additional safeguards

---

### Scenario 2: DEV and PROD Schemas Out of Sync

**Problem:** DEV has migrations that PROD doesn't have.

**Diagnosis:**
```bash
# Check migration history in DEV
psql $SUPABASE_DEV_DB_URL -c "SELECT * FROM _drizzle_migrations ORDER BY created_at;"

# Check migration history in PROD
psql $SUPABASE_PROD_DB_URL -c "SELECT * FROM _drizzle_migrations ORDER BY created_at;"

# Compare
```

**Fix:**
```bash
# Option A: Apply missing migrations to PROD
# (Only if they were tested in DEV)
git checkout master
git merge dev
git push origin master
# CI will apply migrations

# Option B: Reset DEV to match PROD
# (If DEV has experimental changes)
# Use data sync workflow: sync-supabase-prod-to-dev.yml
```

---

### Scenario 3: Hotfix Needed in PROD (Bypass Normal Flow)

**Problem:** Critical schema change needed in PROD without waiting for full CI/CD.

**⚠️ WARNING:** Only use in true emergencies (data loss, security issue, etc.)

**Process:**

1. **Get approval from team lead**

2. **Connect to PROD DB directly:**
   ```bash
   psql $SUPABASE_PROD_DB_URL
   ```

3. **Run schema change manually:**
   ```sql
   -- Example: Add missing index
   CREATE INDEX idx_users_email ON app_users(email);
   ```

4. **Record in migrations table:**
   ```sql
   INSERT INTO _drizzle_migrations (version, created_at)
   VALUES ('manual_hotfix_2025_01_20', NOW());
   ```

5. **Backport to code:**
   ```bash
   # Create matching Drizzle migration
   npm run -w web db:generate
   # Edit migration file to match what was applied
   git add apps/web/lib/db/migrations/
   git commit -m "chore: backport PROD hotfix"
   git push origin master
   ```

6. **Document in incident log**

---

## FAQ

### Q1: Why can't we just run migrations in Vercel builds?

**A:** Running migrations in application deployments is dangerous:
- **Concurrency issues**: Multiple preview deployments could run migrations simultaneously
- **No rollback**: If a migration fails, the deployment is broken
- **No audit trail**: Hard to track who/when/why schema changed
- **Split-brain risk**: Different environments could have different schemas

CI-based migrations provide:
- ✅ Single source of truth (Git)
- ✅ Audit trail (Git commits + GitHub Actions logs)
- ✅ Sequential execution (only one workflow runs at a time)
- ✅ Rollback capability (Git revert + manual DB rollback)

---

### Q2: What happens if two developers create migrations at the same time?

**A:** Drizzle handles this gracefully:
- Each migration has a unique timestamp-based ID
- When merged to `dev`, CI applies both in order
- If they conflict (e.g., both modify same column), CI fails with clear error
- Developers must manually resolve conflict and create a new migration

---

### Q3: Can I test a migration against DEV DB from my local machine?

**A:** Technically yes, but **strongly discouraged**:
```bash
# ❌ Don't do this unless debugging a critical issue
DATABASE_URL=$SUPABASE_DEV_DB_URL npm run -w web db:migrate
```

**Instead:**
- Test on local DB: `npm run -w web db:migrate`
- Push to `dev` branch: CI applies to DEV
- Test in Vercel preview

This ensures migrations are always applied via CI, maintaining audit trail.

---

### Q4: What if I need to migrate data, not just schema?

**A:** Drizzle migrations support both schema and data changes:

```sql
-- Example: apps/web/lib/db/migrations/0016_data_migration.sql

-- Schema change
ALTER TABLE users ADD COLUMN full_name TEXT;

-- Data migration
UPDATE users SET full_name = first_name || ' ' || last_name;

-- Cleanup old columns (optional)
ALTER TABLE users DROP COLUMN first_name;
ALTER TABLE users DROP COLUMN last_name;
```

**Best practices:**
- Test data migrations thoroughly on local DB first
- Consider backwards compatibility (add new column, migrate data, then drop old column)
- For large data migrations, consider writing a script that runs separately

---

### Q5: How do I sync my local DB with DEV after migrations?

**A:** Use the local sync command:

```bash
# Sync data from DEV to local
npm run db:local:sync
```

This runs `scripts/sync-dev-to-local.js`, which:
1. Dumps DEV database schema + data
2. Restores to local Supabase (localhost:54322)
3. Preserves local migrations

**Note:** This overwrites local data. Commit any local work first.

---

### Q6: Can preview deployments run against a different database?

**A:** Currently, all previews use DEV database. This is intentional:
- Simplifies environment management
- Ensures previews reflect DEV state
- Avoids orphaned test databases

**Future enhancement:**
- Vercel could spin up ephemeral DBs per preview
- Requires additional CI setup and Supabase project management
- Not implemented yet

---

### Q7: What's the difference between `drizzle-kit migrate` and `drizzle-kit push`?

**A:**

| Command | Purpose | Creates SQL files? | Safe for production? |
|---------|---------|-------------------|---------------------|
| `drizzle-kit generate` | Create migration files | ✅ Yes | ✅ Yes (commit to Git) |
| `drizzle-kit migrate` | Apply migrations | ❌ No (reads existing) | ✅ Yes (via CI) |
| `drizzle-kit push` | Sync schema directly | ❌ No | ❌ **NEVER** (no history) |

**Rule:** Always use `generate` + `migrate`. Never use `push` in CI or production.

---

## Summary

- ✅ Migrations run **only** in CI (GitHub Actions) and local dev
- ✅ CI workflows: `deploy-dev.yml` (DEV), `deploy-prod.yml` (PROD)
- ✅ Vercel deployments **never** run migrations
- ✅ Multiple safety layers prevent accidental migrations
- ✅ PR checks validate migration safety
- ✅ Clear developer workflow: generate → test locally → commit → push → CI applies

**For questions or incidents, contact:**
- Technical Lead: [Add contact]
- DevOps: [Add contact]
- On-call: [Add contact]

---

**Related Documentation:**
- [Local Development Setup](./local-development-setup.md)
- [Deployment Workflow](./deployment-workflow.md)
- [Security Architecture](../apps/web/graphql/SECURITY_ARCHITECTURE.md)

