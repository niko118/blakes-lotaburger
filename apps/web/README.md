# Next.js + GraphQL Template

Full-stack monorepo template with authentication, GraphQL BFF, and modern tooling.

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + React 19
- **Styling**: Tailwind CSS + shadcn/ui (65 components)
- **API**: GraphQL Yoga (BFF pattern)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Credentials (email/password with bcrypt)
- **Infra**: Supabase + Vercel + GitHub Actions

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp apps/web/.env.example apps/web/.env.local
# Edit .env.local with your values

# 3. Start local database (requires Docker)
npm run db:local:start
npm run db:migrate
npm run -w web db:seed

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
| `npm run -w web test` | Run tests (Vitest) |

### Database

| Script | Description |
|--------|-------------|
| `npm run db:local:start` | Start local Supabase (Docker) |
| `npm run db:local:stop` | Stop local Supabase |
| `npm run db:local:reset` | Reset local DB |
| `npm run db:migrate` | Apply migrations |
| `npm run db:generate` | Generate migration from schema |
| `npm run -w web db:seed` | Create initial admin user |
| `npm run db:help` | Show all DB commands |

### Quality

| Script | Description |
|--------|-------------|
| `npm run -w web cleanup:scan` | Lint + deadcode + deps check |
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

This template uses **credentials-based authentication** (email/password):

- Passwords are hashed with bcrypt (12 rounds)
- Sessions managed via NextAuth.js JWT
- Admin users bypass all permission checks
- Regular users have role-based permissions

### Default Permissions

| Permission | Description |
|------------|-------------|
| `users.view` | View users list |
| `users.manage` | Create, edit, delete users |
| `roles.view` | View roles list |
| `roles.manage` | Create, edit, delete roles |
| `dashboard.view` | View main dashboard |

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
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Auth
NEXTAUTH_SECRET=your-secret-min-32-chars
NEXTAUTH_URL=http://localhost:3000

# Admin (optional)
ADMIN_EMAILS=admin@example.com

# External API (optional)
EXTERNAL_API_BASE_URL=https://api.example.com/graphql
EXTERNAL_OAUTH_REFRESH_URL=https://api.example.com/auth/refresh
EXTERNAL_TOKENS_ENC_KEY=<32-byte-base64-key>
```

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

## Documentation

- [Local Development Setup](../../docs/local-development-setup.md)
- [Deployment Workflow](../../docs/deployment-workflow.md)
- [Migration Policy](../../docs/migration-policy.md)
- [UI Components](components/ui/README.md)
