# External API Client

Server-only helper module for calling external GraphQL APIs with automatic OAuth token management, caching, and retry logic.

## Features

- **Automatic Token Management**: Handles access/refresh tokens per integration with encryption at rest
- **Multi-Level Caching**: Memory cache → Database cache → Refresh
- **Singleflight Refresh**: Prevents concurrent refresh requests for the same integration
- **Smart Retry Logic**: Automatic retry with exponential backoff for 5xx and network errors
- **401 Handling**: Automatically refreshes token and retries on authentication failure
- **Secure**: All tokens encrypted at rest using AES-256-GCM
- **Server-Only**: Cannot be imported in client code

## When to Use This Module

Use this module when you need to integrate with an external API that:
- Uses OAuth 2.0 with refresh tokens
- Provides a GraphQL endpoint
- Requires per-tenant/per-integration credentials

## Environment Variables

Add these to your `.env.local`:

```bash
# External API endpoints
EXTERNAL_API_BASE_URL=https://api.example.com/graphql
EXTERNAL_OAUTH_REFRESH_URL=https://api.example.com/auth/refresh

# Token management (optional - defaults shown)
TOKEN_REFRESH_SKEW_SECONDS=60          # Refresh tokens 60s before expiry
TOKEN_ACCESS_TTL_FALLBACK=2419200      # 28 days default TTL

# Retry configuration (optional - defaults shown)
EXT_API_RETRY_MAX=3                    # Max retry attempts
EXT_API_RETRY_BASE_MS=250              # Base delay for exponential backoff

# Encryption key (required - generate with: openssl rand -base64 32)
EXTERNAL_TOKENS_ENC_KEY=your_base64_key_here
```

### Generate Encryption Key

```bash
openssl rand -base64 32
```

Copy the output and set it as `EXTERNAL_TOKENS_ENC_KEY` in your `.env.local`.

## Database Setup

The module uses the `api_credentials` table (defined in `lib/db/schema.ts`). Ensure migrations are applied:

```bash
npm run db:migrate
```

## Usage

### Basic Query

```typescript
import { externalGQL } from "@lib/server/external/external-graphql-client";

// In a GraphQL resolver, server action, or server component
export async function getExternalData(integrationId: string) {
  const query = `
    query {
      me {
        email
        organization {
          id
          name
        }
      }
    }
  `;

  const data = await externalGQL<{
    me: {
      email: string;
      organization: {
        id: string;
        name: string;
      };
    };
  }>(query, integrationId);

  return data;
}
```

### In a GraphQL Resolver

```typescript
// apps/web/graphql/resolvers/example.resolvers.ts
import { externalGQL } from "@lib/server/external/external-graphql-client";

export const ExampleResolvers = {
  Query: {
    externalData: async (_parent, { integrationId }) => {
      const query = `
        query {
          items {
            id
            name
          }
        }
      `;

      const data = await externalGQL(query, integrationId);
      return data.items;
    },
  },
};
```

### In a Server Action

```typescript
// app/actions/sync.ts
"use server";

import { externalGQL } from "@lib/server/external/external-graphql-client";

export async function syncData(integrationId: string) {
  const query = `
    query {
      data {
        id
        value
      }
    }
  `;

  try {
    const data = await externalGQL(query, integrationId);
    return { success: true, data };
  } catch (error) {
    console.error("Failed to sync:", error);
    return { success: false, error: error.message };
  }
}
```

## Seeding Integration Credentials

Before you can use the API, you need to seed the initial credentials for each integration.

### Manual SQL Insert

```sql
-- First, encrypt the refresh token using the crypto utilities
-- Then insert into the database:

INSERT INTO api_credentials (
  integration_id,
  integration_name,
  refresh_token_encrypted,
  refresh_token_fingerprint,
  created_at,
  updated_at
) VALUES (
  'my-integration-123',           -- integration_id (unique identifier)
  'My External API',              -- human-readable name
  'iv:authTag:ciphertext',        -- encrypted token (use crypto.ts to encrypt)
  'sha256_fingerprint',           -- fingerprint for audit
  NOW(),
  NOW()
);
```

## Error Handling

The helper throws errors in the following cases:

1. **No refresh token found**: Integration not seeded in database
2. **Authentication failure**: 401 persists after refresh
3. **GraphQL errors**: API returns errors in response
4. **Network errors**: After max retries
5. **5xx errors**: After max retries with exponential backoff

```typescript
try {
  const data = await externalGQL(query, integrationId);
  // Handle success
} catch (error) {
  if (error.message.includes("No refresh token found")) {
    // Integration not seeded - handle accordingly
  } else if (error.message.includes("Authentication failed")) {
    // Invalid/expired refresh token - re-seed required
  } else if (error.message.includes("GraphQL error")) {
    // Query syntax error or invalid field
  } else if (error.message.includes("Network error")) {
    // Network connectivity issue
  } else {
    // Other errors (5xx, etc.)
  }
}
```

## Retry Behavior

- **401 Unauthorized**: Refreshes token once and retries (total: 2 attempts)
- **5xx Errors**: Retries with exponential backoff (default: 3 attempts with 250ms, 500ms, 1000ms delays)
- **Network Errors**: Retries with exponential backoff (default: 3 attempts)
- **4xx Errors** (except 401): No retry, fails immediately
- **GraphQL Errors**: No retry, fails immediately

## Token Lifecycle

1. **First Call**: Memory cache empty → Load from DB → Decrypt → Memoize
2. **Subsequent Calls**: Return from memory cache if valid
3. **Near Expiry**: When `now >= access_expires_at`, trigger refresh
4. **Refresh Process**:
   - Decrypt refresh token from DB
   - Call external refresh endpoint
   - Encrypt and persist new access token
   - Update `last_refreshed_at`, `last_access_ttl_seconds`
   - If provider rotates refresh token: Update and mark `rotated_at`
5. **Concurrent Requests**: Singleflight pattern ensures only one refresh per integration

## Security Notes

- **Never log tokens**: The helper never logs plaintext tokens
- **Encryption at rest**: All tokens stored encrypted with AES-256-GCM
- **Server-only**: Module cannot be imported in client code (enforced by `server-only` package)
- **Fingerprints**: SHA-256 hashes stored for audit purposes without exposing secrets

## Module Structure

```
lib/server/external/
├── external-graphql-client.ts   # Main client (externalGQL function)
├── auth-helper.ts               # Token management and refresh logic
├── crypto.ts                    # AES-256-GCM encryption/decryption
└── README.md                    # This file
```

## Troubleshooting

### Error: "EXTERNAL_TOKENS_ENC_KEY is required"

Generate a key and add it to `.env.local`:

```bash
openssl rand -base64 32
```

### Error: "No refresh token found for integration X"

Seed the integration's refresh token using the SQL insert above.

### Error: "Authentication failed after refresh"

The refresh token is invalid or expired. Obtain a new refresh token from your external API provider and re-seed.

### Error: "Invalid encrypted format"

The encrypted token in the database is corrupted. Re-seed with a fresh token.

## Future Enhancements

Potential improvements (not yet implemented):

- Add `variables` parameter to avoid inline string interpolation
- Postgres advisory locks for cross-instance singleflight
- Metrics/observability integration
- Rate limiting awareness
- GraphQL query complexity analysis
