# GraphQL Security & Authorization Architecture

This document outlines the security patterns and authorization rules for the GraphQL API.

---

## Core Principles

1. **Defense in Depth**: Multiple layers of security validation
2. **Fail Secure**: Deny by default, grant access explicitly
3. **Server-Side Enforcement**: Never trust client-side filtering for security
4. **Explicit Context**: All resolvers must use the shared `Context` type

---

## Authentication Layer

### Entry Point: `/api/graphql` Route

**File**: `apps/web/app/api/graphql/route.ts`

```typescript
context: async (): Promise<Context> => {
  const session = await getServerSession();

  // Global authentication check - first line of defense
  if (!session) {
    throw new GraphQLError("Unauthorized: Authentication required", {
      extensions: {
        code: "UNAUTHENTICATED",
        http: { status: 401 },
      },
    });
  }

  return { session };
};
```

**Rules**:

- All GraphQL requests must have a valid session
- Unauthenticated requests receive `401 Unauthorized`
- Session is validated before any resolver executes

---

## Context Pattern (Mandatory)

### Shared Context Interface

**File**: `apps/web/graphql/types.ts`

```typescript
export interface Context {
  session: Session;
}
```

**Important**: The `session` is guaranteed to be present (non-nullable) because the `/api/graphql` route enforces authentication globally before any resolver executes. All GraphQL operations require authentication.

**Rules**:

- All resolvers **MUST** accept `ctx: Context` as third parameter
- Import Context from `"../types"` (relative path from resolvers)
- Session is always present - no need to check for null
- Never call `getServerSession()` directly inside resolvers
- Never create local Context interfaces in resolver files

**Example**:

```typescript
import type { Context } from "../types";

export const myResolvers = {
  Query: {
    myQuery: async (_: unknown, args: Args, ctx: Context) => {
      // Session is guaranteed to exist
      const { isAdmin, permissions } = ctx.session.user;
      // ... use for authorization
    },
  },
};
```

---

## Authorization Patterns

### Permission-Based Access Control

The system uses a flexible permission-based model:

- **Admin Users** (`isAdmin: true`): Full system access, bypass all permission checks
- **Regular Users**: Access controlled by assigned permissions via roles

### Permission Helper Functions

**File**: `apps/web/lib/auth/permissions.ts`

```typescript
// Check single permission
hasPermission(user, "items.view");

// Check if user has ANY of the permissions
hasAnyPermission(user, ["items.view", "items.edit"]);

// Check if user has ALL permissions
hasAllPermissions(user, ["items.view", "reports.view"]);

// Throw GraphQL error if permission missing
requirePermission(user, "items.edit");
requireAnyPermission(user, ["items.view", "items.edit"]);
requireAllPermissions(user, ["items.view", "reports.view"]);
```

**Admin Bypass**: All helper functions automatically return `true` for admin users.

---

## Server-Side Data Scoping

### Permission-Scoped Queries

All queries returning protected data **MUST** check permissions at the resolver level.

**Pattern**:

```typescript
items: async (_, { filters }, ctx: Context) => {
  // Check permission (throws 403 if denied)
  requirePermission(ctx.session.user, "items.view");

  // Proceed with query
  return await db
    .select()
    .from(items)
    .where(buildFilters(filters));
};
```

---

## Mutation Security

### Example: Resource Management

| Mutation       | Admin | Has `items.edit` | No Permission |
| -------------- | ----- | ---------------- | ------------- |
| createItem     | ✅    | ✅               | ❌            |
| updateItem     | ✅    | ✅               | ❌            |
| deleteItem     | ✅    | ❌               | ❌            |

**Key Pattern**:

```typescript
createItem: async (_, { input }, ctx: Context) => {
  requirePermission(ctx.session.user, "items.edit");

  // Proceed with mutation
  return await db.insert(items).values(input).returning();
};
```

### User Management

**File**: `apps/web/graphql/resolvers/app-user.resolvers.ts`

User management mutations require admin access:

```typescript
updateUser: async (_, { id, input }, ctx: Context) => {
  // Only admins can manage users
  if (!ctx.session.user.isAdmin) {
    throw new GraphQLError("Forbidden: Admin access required");
  }

  // Self-protection: cannot demote or deactivate own account
  if (id === ctx.session.user.id) {
    if (input.isAdmin === false) {
      throw new GraphQLError("Cannot demote your own admin status");
    }
  }

  // Proceed with update
};
```

---

## Security Checklist for New Resolvers

When adding a new resolver:

1. Import and use `Context` from `"../types"`
2. Access session directly via `ctx.session` (guaranteed to exist)
3. Check permissions using helper functions from `lib/auth/permissions.ts`
4. For mutations, validate user has appropriate edit permissions
5. Return appropriate GraphQL errors with clear messages

---

## Common Security Pitfalls

### DON'T: Skip permission checks

```typescript
// BAD - No authorization
items: async (_, __, ctx: Context) => {
  return await db.select().from(items);
};
```

### DO: Check permissions first

```typescript
// GOOD - Permission enforced
items: async (_, __, ctx: Context) => {
  requirePermission(ctx.session.user, "items.view");
  return await db.select().from(items);
};
```

### DON'T: Trust client-provided data blindly

```typescript
// BAD - Client could pass any ID
deleteItem: async (_, { id }, ctx: Context) => {
  return await db.delete(items).where(eq(items.id, id));
};
```

### DO: Validate permissions and ownership

```typescript
// GOOD - Check permission and validate
deleteItem: async (_, { id }, ctx: Context) => {
  requirePermission(ctx.session.user, "items.delete");

  const item = await db.select().from(items).where(eq(items.id, id));
  if (!item) {
    throw new GraphQLError("Item not found");
  }

  return await db.delete(items).where(eq(items.id, id));
};
```

---

## Testing Security

### Quick Validation Checklist

**Admin User**:
- Can access all queries
- Can perform all mutations
- Can manage users and roles

**User with `items.view` permission**:
- Can view items
- Cannot edit or delete items (unless also has `items.edit`)
- Cannot access user management

**User with no permissions**:
- Cannot access protected queries (403 Forbidden)
- Cannot perform mutations

**Critical Negative Tests**:
- User without permission cannot access protected data
- Non-admin cannot manage other users
- User cannot escalate own permissions

---

## Summary

**Security Layers**:

1. **Route** (`/api/graphql`) - Global authentication (401 if no session)
2. **Resolver** - Permission-based authorization (403 if insufficient permissions)
3. **Database** - Data validation and constraints

**Key Files**:

- `apps/web/app/api/graphql/route.ts` - Entry point authentication
- `apps/web/graphql/types.ts` - Shared Context interface
- `apps/web/lib/auth/permissions.ts` - Permission helper functions
- `apps/web/lib/auth/permissions-catalog.ts` - Available permissions
- `apps/web/graphql/resolvers/*.resolvers.ts` - Individual resolver authorization

**Remember**: Security is enforced server-side. Client-side filtering is for UX only.
