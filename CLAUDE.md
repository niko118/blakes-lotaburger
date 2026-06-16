# Claude Code Rules — Next.js GraphQL Template (Root)

## Scope

These rules apply repo-wide. If a subfolder needs different guidance later, it may add its own CLAUDE.md that overrides this one.

## AI Assistant Guidelines

- Be concise but complete. Prioritize correctness over brevity.
- Read files strategically: understand context and maintain consistency with existing patterns.
- When showing code, use `// ... existing code ...` to skip unchanged sections.
- Do what is asked, but check related files to ensure consistency.
- If you see issues or improvements beyond the request, mention them but don't implement unless asked.
- When in doubt about scope or approach, ask clarifying questions.

## Language Policy

All technical content MUST be in English:

- Code comments (inline, block, JSDoc)
- Documentation files (README, guides, inline docs)
- Variable names, function names, type names, file names
- Commit messages
- PR descriptions and issue comments
- Code review feedback

**Exceptions:**

- User-facing UI text (labels, error messages) can be in Spanish
- Business domain terms that are Spanish-specific (add English comment explaining the term)
- SQL comments intended for business users may be in Spanish (but technical SQL comments should be in English)

**Enforcement:**

AI will write all new code in English and flag Spanish content in code reviews. This ensures maintainability, global collaboration, and consistency with industry standards.

## Code Quality & Maintainability

### Readability

- **Descriptive names**: Variables, functions, and components should be self-explanatory
- **Small functions**: Maximum 50 lines; if it grows, extract helpers
- **One purpose per function**: Single Responsibility Principle
- **Avoid deep nesting**: Maximum 3 levels; use early returns
- **Comments in English**: Only when the code is not self-explanatory

### Component Reusability

- **DRY (Don't Repeat Yourself)**: If a pattern repeats 3+ times, extract component
- **Composition over inheritance**: Use children, render props, compound components
- **Props over hardcoding**: Components configurable via props, not fixed values
- **Separation of concerns**:
  - Business logic → `@lib/`
  - UI components → `@components/ui/`
  - Domain components → `@components/[domain]/`
  - Custom hooks → `@hooks/`

### Component Structure

```typescript
// 1. Imports (grouped: React, third-party, local)
// 2. Types/Interfaces
// 3. Constants
// 4. Component definition
// 5. Helpers (if small and component-specific)
```

### Refactoring Triggers

- Component > 250 lines → consider dividing (suggested, not absolute)
- Function > 50 lines → extract helpers
- Props > 10 → consider compound component or context
- className repeated 3+ times → create CVA wrapper

## Tech context

- Monorepo with Turborepo
- Next.js (App Router) in apps/web, API runtime = "nodejs"
- GraphQL Yoga at /app/api/graphql
- Drizzle ORM (Postgres on Supabase)
- Tailwind + shadcn/ui + lucide-react
- TS path aliases: "@/*", "@lib/*", "@graphql/*", "@components/*", "@hooks/*", "@app-types"

## Local Development Commands

**Available npm scripts for local database management:**

```bash
# Quick reference
npm run db:help             # Show all database commands and workflows (RECOMMENDED!)

# Local Supabase (PostgreSQL 17 + Auth + Storage + Functions)
npm run db:local:start      # Start local Supabase stack (requires Docker)
npm run db:local:stop       # Stop local Supabase
npm run db:local:reset      # Reset local DB to clean state
npm run db:local:status     # Show local services status (ports, URLs)

# Migrations (work with local or remote via DATABASE_URL)
npm run db:migrate          # Apply Drizzle migrations
npm run db:generate         # Create new migration from schema changes

# Seeding
npm run -w web db:seed      # Create initial admin user
```

**Local Development Workflow:**

1. **First time setup:**
   ```bash
   cp apps/web/env.example apps/web/.env.local  # Copy env template
   # Edit apps/web/.env.local with your values
   npm run db:local:start           # Start local Supabase
   npm run db:migrate               # Apply migrations
   npm run -w web db:seed           # Create admin user
   npm run dev                      # Start Next.js dev server
   ```

2. **Daily workflow:**
   ```bash
   npm run db:local:start  # Start local DB
   npm run dev             # Develop
   # ... work ...
   npm run db:local:stop   # Stop local DB
   ```

3. **Creating a migration:**
   ```bash
   # Edit apps/web/lib/db/schema.ts
   npm run db:generate     # Create migration
   npm run db:migrate      # Apply locally
   # Test changes, commit, push to dev branch
   # GitHub Actions will apply to DEV automatically
   ```

**Local Environment:**

- Local DATABASE_URL: `postgresql://postgres:postgres@localhost:54322/postgres`
- Supabase Studio UI: `http://localhost:54323`
- API endpoint: `http://localhost:54321`
- Your apps/web/.env.local should have DATABASE_URL pointing to localhost:54322

**Prerequisites:**

- Docker Desktop running
- Supabase CLI installed: `brew install supabase/tap/supabase` (macOS)
- PostgreSQL client tools (pg_dump, psql) for sync: `brew install postgresql@17`

## Naming conventions

- GraphQL
  - **Types/Inputs**: PascalCase (e.g., AppUser, CreateUserInput)
  - **Fields & arguments**: **camelCase** (e.g., userId, isAdmin, roleId)
  - **Enums**: Type in PascalCase; values in **UPPER_SNAKE** (single style across the repo)
- TypeScript
  - Variables/functions: camelCase
  - Interfaces/Types/Enums: PascalCase
  - Filenames: kebab-case (e.g., users-table.tsx)
- Database (Drizzle)
  - Tables/columns: **snake_case** only
  - Map to camelCase in TS (e.g., `isAdmin: boolean("is_admin")`)

## Shared types

- Do **not** declare interfaces inline inside pages/components.
- Use **@app-types** (apps/web/types/index.ts) for all shared UI types.
- If types must be shared across apps in the future, move them to packages/types (not now).

### Type synchronization

- When adding/modifying fields, update in this order:
  1. **Database schema** (lib/db/schema.ts) - use snake_case for columns
  2. **GraphQL schema** (graphql/type-defs.ts) - use camelCase for fields
  3. **TypeScript types** (@app-types) - match GraphQL exactly (camelCase)
- Field names MUST be consistent across all three layers (accounting for case convention)
- Example: DB `is_admin` → GraphQL `isAdmin` → Types `isAdmin`

## GraphQL API rules

- Filter/pagination changes require explicit approval and must be generic/reusable.
- Avoid adding filters for single-use cases; prefer flexible existing filters.
- Implement resolvers using Drizzle (avoid raw SQL unless explicitly requested).
- Return empty lists `[]` for "no data" rather than `null`.
- Compute derived fields in resolvers, not in UI.
- View-only fields (labels/colors/icons) go to **View Models** (`*View`/`*VM`) in `@app-types/view.ts`.
- Map Domain → View with adapters in `@lib/presentation/*` (pure functions).
- Do NOT add view-only fields to GraphQL or Domain types.
- Keep schema fields **camelCase** even if DB is snake_case.
- **No REST endpoints.** Do not create REST routes in this repo.
- **Single data gateway:** All server data access MUST go through GraphQL (schema + resolvers).
- **Frontend access:** UI must fetch data ONLY via `/api/graphql`—never direct DB access, never calling server-side libs from client.
- **DB access policy:** Only GraphQL resolvers (and server-only libs called by them) may touch the database.
- **Rare exceptions:** Webhooks/auth callbacks/uploads may exist, but they cannot expose or duplicate data models and require explicit approval.

### GraphQL N+1 Query Prevention (CRITICAL)

**NEVER use field resolvers that query the database for related entities.**

#### ❌ BAD - N+1 Problem
```typescript
User: {
  role: async (parent) => db.select()...  // 1 query per item!
}
```

#### ✅ GOOD - Bulk Fetching
```typescript
Query: {
  users: async (...) => {
    const results = await db.select().from(appUsers);

    // Bulk fetch related data
    const roleIds = [...new Set(results.map(r => r.roleId).filter(Boolean))];
    const roles = await db.select().where(sql`IN (...)`);
    const roleMap = new Map(roles.map(r => [r.id, r]));

    // Include relations directly
    return results.map(r => ({ ...r, role: roleMap.get(r.roleId) }));
  },
}
```

**Rule:** If a resolver returns a list with relations, use bulk fetching with Maps.

## Security & Authorization

### GraphQL Context (mandatory)

- All GraphQL resolvers MUST use a **shared Context type** defined in:
  - `apps/web/graphql/types.ts`
- The Context interface is the single source of truth:
  - `export interface Context { session: Session }`
  - **Important**: Session is non-nullable because `/api/graphql` route enforces authentication globally
- All resolvers must:
  - Accept `ctx: Context` as the third parameter
  - Read the authenticated user **only** from `ctx.session`
  - Session is guaranteed to exist - no need to check for null
  - MUST NOT call `getServerSession` directly inside resolvers
  - MUST NOT add redundant `if (!ctx.session)` checks (route already validates)

### Permission-Based Access Model

- Roles and access rules:
  - `isAdmin: true`: Full system access, bypasses all permission checks
  - Regular users: Access controlled by role permissions
- Permissions are stored as string arrays in the role's `permissions` field
- Common permissions: `users.view`, `users.manage`, `roles.view`, `roles.manage`, `dashboard.view`

### Server-Side Data Scoping

- **All** queries and mutations MUST enforce permission checks at the resolver level
- Do NOT rely on client-side filtering to hide unauthorized data
- Admin users bypass permission checks

### GraphQL structure

- Split resolvers by domain object in separate files:
  - `graphql/resolvers/[entity].resolvers.ts` (e.g., app-user.resolvers.ts)
  - Each file exports Query, Mutation, and field resolvers for that entity
  - Main `graphql/resolvers.ts` imports and combines all resolvers
- Keep scalars (DateTime, etc.) in `graphql/resolvers/scalars.ts`

## External API Integration (Optional)

If integrating with an external OAuth-based GraphQL API, use the provided helper:

```typescript
import { externalGQL } from "@lib/server/external/external-graphql-client";

// In resolvers, server actions, or any server-side code
const query = `query { me { email } }`;
const data = await externalGQL<{ me: { email: string } }>(query, integrationId);
```

### Usage Rules

1. **Server-Only**: The helper is server-only. Use it in:
   - GraphQL resolvers (`graphql/resolvers/`)
   - Server actions (`app/actions/`)
   - API routes (`app/api/`)
   - Never in client components or browser code

2. **Required Parameters**:
   - `document`: GraphQL query/mutation as string
   - `integrationId`: Unique identifier for the integration (from api_credentials table)

3. **Token Management**: The helper automatically:
   - Retrieves and caches access tokens
   - Refreshes expired tokens
   - Retries failed requests
   - Handles authentication errors

4. **Setup Required**:
   - Environment variables in `.env.local`:
     ```
     EXTERNAL_API_BASE_URL=https://api.example.com/graphql
     EXTERNAL_OAUTH_REFRESH_URL=https://api.example.com/auth/refresh
     EXTERNAL_TOKENS_ENC_KEY=<32-byte base64 key>
     ```
   - Credentials seeded in `api_credentials` table

## Next.js (App Router)

- Use **Client Components** by default for pages. Only use Server Components when explicitly requested.
- Frontend data fetching: Use `fetchGraphQL` helper from `@lib/graphql/client` to call `/api/graphql`.
- The helper uses relative path `/api/graphql` (works in all environments: local, preview, production).
- For auto-refresh dashboards: Use `useEffect` with `setInterval` for polling (only when explicitly requested).
- No business logic in UI components. Put shared logic in **@lib/**.
- Do NOT import `@lib/server/db` or Drizzle schema from `apps/web` code. Database access is server-only inside GraphQL resolvers.
- **Loading states**: In Client Components, use `useState` for loading state with inline spinner. Server Components can use `app/loading.tsx`.

## UI guidelines

- Use **shadcn/ui** + Tailwind. Do **not** add MUI/Chakra/etc.
- Icons via **lucide-react**.
- Keep UI clean, accessible, and consistent. Avoid custom CSS frameworks.

## Imports & structure

- Prefer path aliases over deep relative paths: `@components/*`, `@graphql/*`, `@lib/*`, `@app-types`.
- Avoid duplication. If a helper is reused, place it in **@lib/**.

## Supabase Edge Functions

- Located in `supabase/functions/`
- Primary use: Data imports from external webhooks (e.g., Make, Zapier, external APIs)
- Secondary use: Heavy computations or external integrations that don't fit in the main app
- Use Deno runtime (not Node.js)
- Require Service Role Key authentication (never expose in frontend)
- Structure: `_shared/` for common code, individual function folders for handlers
- Do NOT duplicate business logic from GraphQL resolvers in Edge Functions

## Database & migrations

- Every schema change requires a migration.
- Commands (web workspace):
  - `npm run -w web db:generate`
  - `npm run -w web db:migrate`

### Database Migration Policy (CRITICAL)

**⚠️ Migrations are NEVER run from application runtime code.**

#### Where migrations run:
- ✅ **CI (GitHub Actions):**
  - `deploy-dev.yml` - Runs on push to `dev` branch OR PRs to `master` → migrates DEV DB
  - `deploy-prod.yml` - Runs on push to `master` branch → migrates PROD DB
- ✅ **Local development:**
  - `npm run -w web db:generate` - Generate migration from schema changes
  - `npm run -w web db:migrate` - Apply migrations to local DB

#### Where migrations DON'T run:
- ❌ **Vercel deployments** (production, preview, development)
- ❌ **Application runtime** (API routes, server components, middleware)
- ❌ **Build process** (`npm run build`)
- ❌ **Edge Functions** (Supabase Functions)

#### Developer workflow:
```bash
# 1. Edit schema
vim apps/web/lib/db/schema.ts

# 2. Generate migration
npm run -w web db:generate

# 3. Review SQL
cat apps/web/lib/db/migrations/XXXX_*.sql

# 4. Test locally
npm run -w web db:migrate
npm run dev

# 5. Commit
git add apps/web/lib/db/schema.ts apps/web/lib/db/migrations/
git commit -m "feat: add new_table"

# 6. Push and let CI apply to DEV/PROD
git push origin feature-branch
```

### Migration Safety & Best Practices

**Always use idempotent migrations:**

```sql
-- Drop existing columns if they exist (handles re-runs or corrections)
ALTER TABLE "table_name" DROP COLUMN IF EXISTS "column_name";

-- Add columns with correct definition
ALTER TABLE "table_name" ADD COLUMN "column_name" type constraints;
```

### Foreign Key Constraints Policy

**DO NOT use Foreign Key (FK) constraints in the database schema.**

- ❌ Never add `.references()` to column definitions in Drizzle schema
- ✅ Use plain integer/varchar columns for relationships
- ✅ GraphQL resolvers handle relationships via manual queries

## Error handling & logging

- Use typed errors and narrow catches. No empty catch blocks.
- Log concisely and never include sensitive data.

## Quality guardrails

- TypeScript strict. Avoid `any` unless justified with a short comment.
- Keep functions small and focused. Extract helpers when a component grows.
- Write simple unit tests for non-trivial helpers in **@lib/** when adding complex logic.
- **Code comments**: Write all comments in English for consistency.

## Never

- **Never** rename DB columns to camelCase in the database. Keep snake_case in DB.
- **Never** introduce parallel REST routes duplicating GraphQL without explicit approval.
- **Never** add new dependencies without necessity and prior agreement.
- **Never** place inline interfaces/types inside pages/components—use **@app-types**.

## UI Styling Rules (Tailwind + CVA)

### No Inline CSS Strings

**NEVER** use `className="string literal"` in JSX. Always extract to named constants.

```typescript
// ❌ BAD - Inline string
<div className="p-6 space-y-6">

// ✅ GOOD - Named constant
const styles = {
  pageContainer: "p-6 space-y-6",
} as const;
<div className={styles.pageContainer}>

// ✅ GOOD - CVA component
<Text size="lg" weight="bold">
```

### When to Use Each Pattern

**CVA Components** (for semantic patterns):

- Repeated across files
- Has variants (size, tone, weight)
- Semantic meaning (StatusBadge, MetricCard, Text)
- Example: `<Text tone="gray900" size="lg" weight="bold">`

**Style Constants** (for layout/utilities):

- Layout classes (grid, flex, padding)
- Table column widths
- One-off positioning
- shadcn overrides
- Only used in one file

### CVA Wrapper Structure

```typescript
// apps/web/components/ui/[component-name].tsx
"use client";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@lib/utils";

// 1. Define variants with empty base
const variants = cva("", {
  variants: {
    tone: { inherit: "", primary: "...", secondary: "..." },
    size: { inherit: "", sm: "...", md: "...", lg: "..." },
  },
  defaultVariants: { tone: "inherit", size: "inherit" },
});

// 2. Interface with escape hatch
export interface Props
  extends React.ComponentPropsWithoutRef<"div">,
  VariantProps<typeof variants> {
  className?: string;
}

// 3. Component with forwarded ref if needed
export function Component({ tone, size, className, ...props }: Props) {
  return <div className={cn(variants({ tone, size }), className)} {...props} />;
}
```

## Color System Rules

### Custom Color Palette (Mandatory)

All UI components MUST use the custom color palette defined in `globals.css`, not Tailwind's default colors.

**Colors defined in globals.css:**

- Text colors: `steel`, `dark-grey`, `silver`, `rain` (grayscale)
- Accent colors: `primary`, `primary-soft`, `primary-dark` (purple)
- Status colors: `red`, `green`, `yellow` (with variants)
- Neutral colors: `cloud`, `fog`, `white`

**When to use each text color:**

- `steel` (#3d423b) - Primary text, high emphasis (replaces gray-900)
- `dark-grey` (#5c605b) - Secondary text, medium emphasis (replaces gray-600)
- `silver` (#6e746c) - Tertiary text, labels (replaces gray-500)
- `rain` (#99a096) - Muted text, placeholders (replaces gray-400)

## Code Cleanup & Unused Code

### AI MUST Before Task Completion

- Scan modified files: unused imports, orphaned files, dead code, added deps
- Offer removal explicitly; do NOT wait for user
- Empty directories: Propose deletion (not `app/`, `components/`, `lib/` roots)
- Console.logs/debug code removed
- Run `npm run -w web deadcode` to verify no baseline increase

### Pre-PR Checklist

- Run `npm run cleanup:scan`
- Fix all ESLint/TS warnings
- Confirm no unused code remains

## Pull Request Guidelines

**PR Title MUST match the branch name exactly.**

**PRs are ALWAYS created against `master` branch.**

When user requests to create a PR:

1. Execute all validations in checklist
2. Run `npm run -w web cleanup:scan` to detect unused code/imports
3. Fix any issues found (unused imports, dead code, etc.)
4. Get current branch name from git
5. Use that exact name as PR title (includes ticket number)
6. Create PR against `master` branch (use `--base master` flag)
7. Create a body with all the information of what was done in the current branch

## Pull Request checklist (must pass)

- [ ] Types live in **@app-types** (no inline interfaces in UI).
- [ ] GraphQL uses **camelCase** fields; DB remains **snake_case**.
- [ ] **Types in @app-types match GraphQL schema exactly (same fields, same names, camelCase).**
- [ ] **If schema changed: DB → GraphQL → @app-types all updated consistently.**
- [ ] **New resolvers are in separate files under graphql/resolvers/ (not in main resolvers.ts).**
- [ ] **Loading states handled appropriately (useState in Client Components, loading.tsx for Server Components).**
- [ ] No new filters/pagination added unless explicitly requested.
- [ ] Migrations generated/applied if schema changed.
- [ ] Lint & types pass; no unjustified `any`.
- [ ] **Code comments are in English.**
- [ ] No duplicated helpers—shared logic is in **@lib/**.
- [ ] No repeated className patterns (3+ times = extract to component).
- [ ] Reusable components are in `@components/` with proper props.
