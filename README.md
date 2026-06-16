# Next.js + GraphQL Template

Full-stack monorepo template with authentication, GraphQL BFF, and modern tooling.

---

## Using This Template

Click **"Use this template"** → **"Create a new repository"** on GitHub to create your own project.

### After Creating Your Repository

```bash
# 1. Clone your new repo
git clone https://github.com/your-user/your-project.git
cd your-project

# 2. Install dependencies
npm install

# 3. Setup environment
cp apps/web/.env.example apps/web/.env.local
# Edit .env.local — see Quick Start below for options

# 4. Start development
npm run dev
```

### Things to Customize

- `package.json` → project name
- `apps/web/.env.local` → set `NEXT_PUBLIC_APP_NAME` and auth/database credentials
- `apps/web/lib/navigation/config.ts` → sidebar navigation items

---

## Tech Stack

- **Frontend**: Next.js 15 (App Router) + React 19
- **Styling**: Tailwind CSS + shadcn/ui (65+ components)
- **API**: GraphQL Yoga (BFF pattern)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Credentials (email/password) via NextAuth.js
- **Infra**: Supabase + Vercel + GitHub Actions

---

## Quick Start

### Without a database (fastest)

No Docker, no Supabase — just run the app.

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp apps/web/.env.example apps/web/.env.local
# Uncomment DEV_ADMIN_EMAIL and DEV_ADMIN_PASSWORD in .env.local

# 3. Start development
npm run dev
# Login at http://localhost:3000/login with your DEV_ADMIN_EMAIL + DEV_ADMIN_PASSWORD
```

> **Note:** In bypass mode, all database-dependent features (user management, roles) are unavailable.
> Use this for frontend development and UI work.

### With a local database (full features)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp apps/web/.env.example apps/web/.env.local
# Set DATABASE_URL (keep DEV bypass vars commented out)

# 3. Start local database
npm run db:local:start
npm run db:migrate
npm run db:seed     # creates an initial admin user

# 4. Start development
npm run dev
# Open http://localhost:3000
```

---

## Project Structure

```
├── apps/
│   └── web/                    # Next.js application
│       ├── app/                # App Router pages
│       │   ├── (public)/       # Unauthenticated routes
│       │   ├── (private)/      # Protected routes
│       │   └── api/            # API routes (GraphQL, auth)
│       ├── components/         # React components
│       │   └── ui/             # shadcn/ui components
│       ├── graphql/            # GraphQL schema + resolvers
│       ├── lib/                # Utilities and helpers
│       │   ├── auth/           # Authentication logic
│       │   ├── db/             # Database schema + migrations
│       │   └── server/         # Server-only code
│       ├── hooks/              # Custom React hooks
│       └── types/              # TypeScript types
├── packages/
│   ├── eslint-config/          # Shared ESLint config
│   └── typescript-config/      # Shared TSConfig
├── supabase/
│   └── functions/              # Edge Functions (Deno)
├── docs/                       # Documentation
└── .github/workflows/          # CI/CD pipelines
```

---

## Available Scripts

### Development

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run check-types` | TypeScript check |
| `npm run test` | Run tests (Vitest) |

### Database

| Script | Description |
|--------|-------------|
| `npm run db:local:start` | Start local Supabase (Docker) |
| `npm run db:local:stop` | Stop local Supabase |
| `npm run db:local:reset` | Reset local DB |
| `npm run db:local:sync` | Sync data from PROD to local |
| `npm run db:migrate` | Apply migrations |
| `npm run db:generate` | Generate migration from schema |
| `npm run db:seed` | Create initial admin user |
| `npm run db:help` | Show all DB commands |

### Quality

| Script | Description |
|--------|-------------|
| `npm run cleanup:scan` | Lint + deadcode + deps check |
| `npm run format` | Format with Prettier |

---

## Development Workflows

### Daily Development

```bash
npm run db:local:start    # Start local DB
npm run dev               # Start dev server
# ... work ...
npm run db:local:stop     # End of day
```

### Creating a Feature

```bash
git checkout -b feature/my-feature
npm run db:local:start
npm run dev
# ... develop and test ...
git add .
git commit -m "feat: my feature"
git push origin feature/my-feature
# Create PR to master
```

### Database Changes

```bash
# 1. Edit schema
# apps/web/lib/db/schema.ts

# 2. Generate migration
npm run db:generate

# 3. Apply locally
npm run db:migrate

# 4. Test, then commit
git add apps/web/lib/db/
git commit -m "feat: add new table"
```

---

## Authentication

This template uses credentials-based authentication (email/password):

- **Password hashing**: bcrypt
- **Session strategy**: JWT tokens
- **Session duration**: 12 hours
- **Role-based access**: Admin flag + custom roles with permissions

### Default Permissions

| Permission | Description |
|------------|-------------|
| `users.view` | View user list |
| `users.manage` | Create, edit, delete users |
| `roles.view` | View roles list |
| `roles.manage` | Create, edit, delete roles |
| `dashboard.view` | Access dashboard |

For detailed auth documentation, see: [docs/auth.md](docs/auth.md)

---

## Deployment

### Branches

| Branch | Environment | Auto-deploy |
|--------|-------------|-------------|
| `master` | Production | ✅ Vercel + Migrations |
| `dev` | Development | ✅ Vercel + Migrations |
| Feature branches | Preview | ✅ Vercel only |

### CI/CD Flow

```
Push to feature branch → Vercel Preview
Merge to dev → DEV deploy + migrations
Merge to master → PROD deploy + migrations
```

### Required GitHub Secrets

```
SUPABASE_DEV_DB_URL      # DEV database connection
SUPABASE_PROD_DB_URL     # PROD database connection
SUPABASE_ACCESS_TOKEN    # Supabase CLI token
```

---

## Environment Variables

```bash
# Bypass mode — skip database (requires DEV_ADMIN_EMAIL set + DATABASE_URL absent)
DEV_ADMIN_EMAIL=admin@dev.local
DEV_ADMIN_PASSWORD=admin123

# Database — required when not using bypass mode
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Auth
NEXTAUTH_SECRET=your-secret-min-32-chars    # generate: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

# Theme (optional — see Theming section below; hex values must be quoted)
THEME_PRIMARY="#6366f1"
THEME_SIDEBAR_BG="#2d322b"
# ... see .env.example for full list

# External API (optional)
EXTERNAL_API_BASE_URL=https://api.example.com/graphql
EXTERNAL_OAUTH_REFRESH_URL=https://api.example.com/auth/refresh
EXTERNAL_TOKENS_ENC_KEY=<32-byte-base64-key>
```

> Bypass mode activates when `DEV_ADMIN_EMAIL` is set **and** `DATABASE_URL` is not. If `DATABASE_URL` is present it always takes precedence.

---

## Theming

The color palette can be overridden at runtime via environment variables — no code changes needed. This lets you deploy the same codebase with different branding per client or environment.

### How it works

At startup, `app/layout.tsx` reads `THEME_*` env vars and injects them as a `<style>` block that overrides the CSS custom properties defined in `globals.css`.

### Available variables

| Variable | CSS property | Default | Description |
|---|---|---|---|
| `THEME_PRIMARY` | `--primary` | `#6366f1` | Main accent — buttons, active nav, links |
| `THEME_PRIMARY_DARK` | `--primary-dark` | `#4338ca` | Hover states on primary elements |
| `THEME_PRIMARY_SOFT` | `--primary-soft` | `#818cf8` | Focus rings, secondary accents |
| `THEME_PRIMARY_LIGHT` | `--primary-light` | `#c7d2fe` | Subtle tinted backgrounds |
| `THEME_PRIMARY_EXTRA_LIGHT` | `--primary-extra-light` | `#eef2ff` | Near-white primary-hued surfaces |
| `THEME_SIDEBAR_BG` | `--pickled-black` | `#2d322b` | Sidebar background |
| `THEME_PAGE_BG` | `--fog` | `#f7f9f6` | Main page background |

> **Important:** hex values must be quoted in `.env` files — `#` is treated as a comment character by dotenv.

### Example — red brand

```bash
THEME_PRIMARY="#dc2626"
THEME_PRIMARY_DARK="#b91c1c"
THEME_PRIMARY_SOFT="#ef4444"
THEME_PRIMARY_LIGHT="#fecaca"
THEME_PRIMARY_EXTRA_LIGHT="#fef2f2"
THEME_SIDEBAR_BG="#1c0a0a"
```

### Example — blue brand

```bash
THEME_PRIMARY="#2563eb"
THEME_PRIMARY_DARK="#1d4ed8"
THEME_PRIMARY_SOFT="#3b82f6"
THEME_PRIMARY_LIGHT="#bfdbfe"
THEME_PRIMARY_EXTRA_LIGHT="#eff6ff"
THEME_SIDEBAR_BG="#0f172a"
```

Any variables not set fall back to the defaults in `globals.css`. You only need to set the ones you want to change.

---

## Local Services

After `npm run db:local:start`:

| Service | URL |
|---------|-----|
| Next.js App | http://localhost:3000 |
| GraphQL Playground | http://localhost:3000/api/graphql |
| Supabase Studio | http://localhost:54323 |
| PostgreSQL | localhost:54322 |

---

## Database Migrations Policy

**⚠️ CRITICAL: Migrations are NEVER run from the application runtime.**

### Where Migrations Run

- **CI (GitHub Actions)**: Automatically on push to `dev` or `master`
- **Local Development**: Manually via `npm run db:migrate`

### Where Migrations DON'T Run

- ❌ Vercel deployments
- ❌ Application runtime
- ❌ Build process

For detailed migration policy, see: [docs/migration-policy.md](docs/migration-policy.md)

---

## Coding Standards

- All technical content (code, comments, docs, commits, PRs) must be in **English**
- All server data access goes through **GraphQL + Drizzle**
- Frontend calls data only via `/api/graphql` using the shared client helper
- No inline `className="..."` in JSX: use style constants or CVA-based UI components

**Before merging:**

- Types live in `@app-types`
- GraphQL schema ↔ Drizzle schema ↔ TS types are consistent
- Lint & type checks pass
- No unused code or imports

---

## Documentation

- [Local Development Setup](docs/local-development-setup.md)
- [Deployment Workflow](docs/deployment-workflow.md)
- [Migration Policy](docs/migration-policy.md)
- [Authentication](docs/auth.md)
- [UI Components](apps/web/components/ui/README.md)
- [GraphQL Security](apps/web/graphql/SECURITY_ARCHITECTURE.md)
