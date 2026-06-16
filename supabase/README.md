# Supabase Edge Functions

This directory contains Supabase Edge Functions for data processing and imports.

## Structure

```
supabase/
├── functions/
│   ├── _shared/              # Shared code between functions
│   │   ├── types.ts          # Shared types
│   │   ├── utils.ts          # Utilities (CORS, responses)
│   │   └── validators.ts     # Common validations
│   └── import-data/          # Data import function
│       ├── index.ts          # Entry point with routing
│       └── handlers/         # Import handlers by type
└── config.toml               # Supabase configuration
```

## Local Development

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Login (first time)
supabase login

# Link to your project
supabase link --project-ref <project-ref>

# Start Supabase locally
supabase start

# Serve functions locally
supabase functions serve
```

## Deploy

```bash
# Deploy the import-data function
supabase functions deploy import-data

# Verify deployment
supabase functions list
```

## Usage

The function accepts POST requests with data to import.

### Option 1: Provide data directly

```json
{
  "name": "items",
  "data": [...],
  "dryRun": false
}
```

### Option 2: Provide URL to fetch data

```json
{
  "name": "items",
  "url": "https://api.example.com/data.json",
  "dryRun": false
}
```

### Option 3: Use Supabase Storage (recommended for large files)

```json
{
  "name": "items",
  "storagePath": "imports/data.csv",
  "strategy": "replace"
}
```

## Import Strategies

### REPLACE
Deletes all existing records, then inserts new data.
```typescript
strategy: 'replace'
```

### UPSERT
Updates existing records by key, inserts new ones.
```typescript
strategy: 'upsert',
upsertKey: 'id'
```

### APPEND
Only inserts new records, never updates or deletes.
```typescript
strategy: 'append'
```

## Adding New Import Types

1. Create handler in `functions/import-data/handlers/your-type.ts`
2. Define data structure and validation
3. Choose import strategy
4. Add to switch in `index.ts`

Example handler:

```typescript
// handlers/items.ts
import { createSuccessResponse, createErrorResponse, importData } from '../../_shared/utils.ts';

export async function handleItems(data: unknown[], dryRun: boolean): Promise<Response> {
  try {
    // Validate and transform data
    const records = data.map(item => ({
      id: item.id,
      name: item.name,
    }));

    if (dryRun) {
      return createSuccessResponse({
        success: true,
        message: 'Dry run completed',
        recordsProcessed: records.length,
      });
    }

    const result = await importData({
      tableName: 'items',
      records,
      strategy: 'upsert',
      upsertKey: 'id',
    });

    return createSuccessResponse(result);
  } catch (error) {
    return createErrorResponse(error.message, 500);
  }
}
```

## Authentication

The function requires authentication (`verify_jwt = true`).

Use the Service Role Key for external webhooks:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/import-data \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "items", "data": [...]}'
```

**Security Note:** The Service Role Key bypasses RLS. Never expose it in frontend code.

## Notes

- Functions use Deno runtime (not Node.js)
- The `_shared/` directory contains reusable utilities
- Use `dryRun: true` to validate without inserting
