# Authentication Guide

This guide explains the credentials-based authentication system in the template.

## Overview

The template uses **NextAuth.js** with a **CredentialsProvider** for email/password authentication:

- Passwords are hashed with **bcrypt** (12 salt rounds)
- Sessions are stored as **JWT tokens** in cookies
- Admin users bypass all permission checks
- Regular users have role-based permissions

## Authentication Flow

1. User submits email and password on `/login`
2. NextAuth validates credentials against `app_users` table
3. Password is verified using bcrypt
4. JWT session is created with user data and permissions
5. User is redirected to `/dashboard`

## User Model

```typescript
// Database: app_users table
{
  id: uuid,
  email: string,           // Unique
  passwordHash: string,    // bcrypt hash
  name: string | null,
  isAdmin: boolean,        // Bypass permissions
  isActive: boolean,       // Can login
  roleId: uuid | null,     // Link to app_roles
  lastLoginAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
}
```

## Role Model

```typescript
// Database: app_roles table
{
  id: uuid,
  name: string,            // Unique
  description: string | null,
  permissions: string[],   // Array of permission keys
  isSystem: boolean,       // Cannot be deleted
  createdAt: timestamp,
  updatedAt: timestamp,
}
```

## Session Structure

After login, the session contains:

```typescript
{
  user: {
    id: string,
    email: string,
    name: string | null,
    isAdmin: boolean,
    permissions: string[],  // From role
  }
}
```

## Permission System

### Default Permissions

| Permission | Description |
|------------|-------------|
| `users.view` | View users list |
| `users.manage` | Create, edit, delete users |
| `roles.view` | View roles list |
| `roles.manage` | Create, edit, delete roles |
| `dashboard.view` | View main dashboard |

### Admin Users

Users with `isAdmin: true`:
- Bypass all permission checks
- Can access all routes
- Can manage all users and roles

### Regular Users

Users with `isAdmin: false`:
- Access controlled by role permissions
- Cannot access routes without required permission
- Cannot modify admin users

## Creating Users

### Via Seed Script (First Admin)

```bash
npm run -w web db:seed
# Follow prompts for email, password, name
```

### Via Admin UI

1. Login as admin
2. Go to `/admin/users`
3. Click "Add User"
4. Fill email, password, select role
5. Save

### Via GraphQL

```graphql
mutation CreateUser {
  createUser(input: {
    email: "user@example.com"
    password: "password123"
    name: "User Name"
    isAdmin: false
    roleId: "role-uuid-here"
    isActive: true
  }) {
    id
    email
  }
}
```

## Password Requirements

- Minimum 8 characters
- Hashed with bcrypt (12 rounds)
- Never stored in plain text
- Can be updated without knowing old password (admin only)

## Environment Variables

```bash
# Required
NEXTAUTH_SECRET=<32-character-random-string>
NEXTAUTH_URL=http://localhost:3000

# Optional (auto-create admin on first login)
ADMIN_EMAILS=admin@example.com
```

## Route Protection

### Middleware Configuration

Routes are protected in `middleware.ts`:

```typescript
// Public routes (no auth required)
const PUBLIC_ROUTES = [
  "/",
  "/dashboard",
  "/permission-denied",
];

// Routes requiring specific permissions
const ROUTE_PERMISSIONS = {
  "/admin/users": ["users.manage"],
  "/admin/roles": ["roles.manage"],
};
```

### Adding Protected Routes

1. Add route to `ROUTE_PERMISSIONS` in `middleware.ts`
2. Add permission to `PERMISSIONS_CATALOG` in `lib/auth/permissions-catalog.ts`
3. Assign permission to appropriate roles

## GraphQL Authorization

All resolvers receive the session via context:

```typescript
// In resolver
export const resolvers = {
  Query: {
    users: async (_: unknown, args: unknown, ctx: Context) => {
      // Session is guaranteed to exist
      const { session } = ctx;

      // Check permissions
      if (!session.user.isAdmin && !session.user.permissions.includes("users.view")) {
        throw new Error("Not authorized");
      }

      // ... fetch and return data
    },
  },
};
```

## Security Best Practices

1. **NEXTAUTH_SECRET**
   - Generate with: `openssl rand -base64 32`
   - Never commit to version control
   - Different value for each environment

2. **Password Storage**
   - Only bcrypt hashes stored
   - Salt rounds = 12 (secure but fast)
   - No plain text passwords anywhere

3. **Session Security**
   - JWT stored in httpOnly cookie
   - Signed with NEXTAUTH_SECRET
   - Contains minimal user data

4. **Route Protection**
   - All private routes require authentication
   - Permission checks at route AND resolver level
   - Admin bypass clearly documented

## Troubleshooting

### "Invalid credentials" on login

- Check email exists in `app_users` table
- Verify `is_active = true`
- Check password hash is valid bcrypt
- Try resetting password via seed script

### "Session expired" frequently

- Check NEXTAUTH_SECRET is consistent
- Verify server time is correct
- Check for cookie issues in browser

### "Not authorized" errors

- Verify user has required permission
- Check role is assigned to user
- Confirm role has the permission
- Admin users should never see this
