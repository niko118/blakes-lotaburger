# Supabase CLI - Local Development Setup

## Current Status ✅

Your Supabase CLI is **unlinked from production** and configured to work only with your local instance.

## Understanding Supabase Local Ports

Your local Supabase instance runs multiple services on different ports:

| Port  | Service      | URL                                                  | Purpose                          |
|-------|--------------|------------------------------------------------------|----------------------------------|
| 54321 | **API**      | `http://localhost:54321`                             | Real endpoint for functions/API  |
| 54322 | **Database** | `postgresql://postgres:postgres@localhost:54322/postgres` | Direct Postgres connection       |
| 54323 | **Studio**   | `http://localhost:54323`                             | Admin UI dashboard               |
| 54324 | **Inbucket** | `http://localhost:54324`                             | Email testing UI                 |

**Important:** Functions execute on port **54321**, but you manage them via Studio UI on port **54323**.

## Safe Commands for Local Development

### Start/Stop Local Supabase

```bash
# Start all local services (requires Docker)
npm run db:local:start

# Check local services status
npm run db:local:status

# Stop local services
npm run db:local:stop
```

### Running Edge Functions Locally

**For daily development (recommended):**

```bash
# Serve ONE function with hot-reload (no authentication required)
supabase functions serve import-data

# Or serve ALL functions
supabase functions serve
```

**What happens:**
- ✅ Function runs on `http://127.0.0.1:54321/functions/v1/import-data`
- ✅ Hot-reload when you edit code
- ✅ Logs appear in real-time in the same terminal
- ✅ **No authentication required** - works without login
- ❌ Function **won't appear** in Studio UI (`http://localhost:54323/project/default/functions`)
- Stop with `Ctrl+C`

### Testing Functions Locally

While `serve` is running, open a **new terminal** and execute:

```bash
# Test with curl (using local anon key)
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/import-data' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
  --data '{"entities": ["customers"]}'
```

**You'll see:**
- Logs in the terminal where `serve` is running
- Response in the terminal where you ran `curl`
- Execution logs in Studio: `http://localhost:54323/project/default/logs/edge-functions`

## ⚠️ WARNING: Avoiding Production Deploys

### ❌ NEVER Run These Commands Without Confirmation

```bash
# ❌ DO NOT link to production accidentally
supabase link --project-ref gzivwvdagcvpizthajix

# ❌ DO NOT deploy with project-ref flag
supabase functions deploy --project-ref gzivwvdagcvpizthajix
```

### ✅ Always Verify Before Deploying

**Check you're NOT linked to a remote project:**

```bash
# Verify link status
cat .supabase/config.toml 2>/dev/null || echo "✅ Not linked to remote project"

# If you see file content, you're linked to remote - run:
supabase unlink
```

## Safe Development Workflow

### 1. **Daily Local Development** (Recommended)

```bash
# 1. Start local Supabase (if not running)
npm run db:local:start

# 2. Serve your function
supabase functions serve import-data

# 3. In ANOTHER terminal, test it
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/import-data' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
  --data '{"entities": ["customers"]}'

# 4. Watch logs in the serve terminal
# 5. Edit code - changes auto-reload
# 6. Stop with Ctrl+C when done
```

### 2. **Deploying to Production** (When Ready)

⚠️ **Only after confirming everything works locally:**

```bash
# 1. Temporarily login and link to production
supabase login
supabase link --project-ref gzivwvdagcvpizthajix

# 2. Deploy to production
supabase functions deploy import-data --no-verify-jwt

# 3. IMPORTANT: Unlink immediately
supabase unlink

# 4. Logout for safety
supabase logout

# 5. Verify you're unlinked
cat .supabase/config.toml 2>/dev/null || echo "✅ Safely unlinked"
```

## Understanding `serve` vs `deploy`

| Command | `supabase functions serve` | `supabase functions deploy` |
|---------|----------------------------|----------------------------|
| **Authentication** | ❌ Not required | ✅ Requires login |
| **Hot reload** | ✅ Yes | ❌ No |
| **Shows in Studio UI** | ❌ No | ✅ Yes |
| **Logs** | Terminal only | Studio UI + logs endpoint |
| **Use case** | Daily development | Production or formal local deploy |
| **Stops when** | Ctrl+C | Until Supabase stops |

## Edge Functions Configuration

Your `supabase/config.toml` is already configured correctly:

```toml
[functions.import-data]
  verify_jwt = true
```

This means:
- In production: JWT verification is **enabled** (secure)
- During local `serve`: Use local anon key (shown in examples above)
- Can override with `--no-verify-jwt` flag when needed

## Database Management Commands

```bash
# See all available database commands
npm run db:help

# Reset local database (⚠️ destroys data)
npm run db:local:reset

# Sync data from DEV to LOCAL
npm run db:local:sync

# Run migrations
npm run -w web db:migrate

# Generate new migration from schema changes
npm run -w web db:generate
```

## Troubleshooting

### Error: "Cannot connect to Docker daemon"

**Solution:** Start Docker Desktop and retry.

```bash
open -a Docker
# Wait for Docker to be ready
npm run db:local:start
```

### Error: "Access token not provided"

**This is expected** when you're not logged in. For local development:

```bash
# ✅ Use serve instead (no login required)
supabase functions serve import-data
```

If you need to deploy:

```bash
# Login temporarily
supabase login
supabase functions deploy import-data
supabase logout
```

### Function not appearing in Studio UI

**This is normal** when using `supabase functions serve`. Functions in `serve` mode:
- ❌ Don't appear in `http://localhost:54323/project/default/functions`
- ✅ Still work perfectly on `http://127.0.0.1:54321/functions/v1/*`
- ✅ Execution logs appear in `http://localhost:54323/project/default/logs/edge-functions`

To see functions in Studio UI, you'd need to:
1. Login with `supabase login`
2. Deploy with `supabase functions deploy`
3. **Not recommended** for daily development (use `serve` instead)

### How do I know if I'm pointing to local or production?

Run these verification commands:

```bash
# 1. Check project link status
cat .supabase/config.toml 2>/dev/null || echo "✅ Not linked to remote"

# 2. Check authentication status
supabase projects list 2>&1 | head -3

# 3. Check local services
npm run db:local:status
```

**Safe state for development:**
- ✅ "Not linked to remote"
- ✅ "Access token not provided" (when checking projects)
- ✅ Local services running on localhost ports

**Dangerous state:**
- ⚠️ `.supabase/config.toml` exists with a project_id
- ⚠️ Can see remote projects list
- ⚠️ Solution: `supabase unlink && supabase logout`

## Summary

- ✅ **Always work unlinked** (no `.supabase/` directory)
- ✅ **Always work logged out** (unless deploying to prod)
- ✅ **Use `supabase functions serve`** for daily development
- ✅ **Use npm run `db:local:*` commands** for database management
- ⚠️ **Deploy to production:** Login → Link → Deploy → Unlink → Logout (all in one session)
- ❌ **Never leave project linked** between work sessions

## Quick Reference

```bash
# Daily workflow
npm run db:local:start              # Start local Supabase
supabase functions serve <name>     # Develop function
# ... test in another terminal ...
# ... Ctrl+C to stop ...
npm run db:local:stop               # Stop when done

# Production deploy (rare)
supabase login                      # Authenticate
supabase link --project-ref <id>    # Link to prod
supabase functions deploy <name>    # Deploy
supabase unlink                     # Disconnect
supabase logout                     # Remove auth
```
