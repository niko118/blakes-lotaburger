/**
 * Generic Import Edge Function
 *
 * This edge function provides a template for importing data.
 * Customize the handlers for your specific use case.
 */

import { corsHeaders, createSuccessResponse, createErrorResponse } from '../_shared/utils.ts';

interface ImportRequest {
  name: string;
  data?: unknown[];
  dryRun?: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() });
  }

  try {
    const { name, data, dryRun = false } = await req.json() as ImportRequest;

    // Validate required parameter
    if (!name) {
      return createErrorResponse('Parameter "name" is required', 400);
    }

    // Validate we have data to import
    if (!data || !Array.isArray(data)) {
      return createErrorResponse('"data" array is required', 400);
    }

    // Route to appropriate handler based on name
    // TODO: Add your custom handlers here
    switch (name.toLowerCase()) {
      // Example handler:
      // case 'users':
      //   return await handleUsers(data, dryRun);

      default:
        return createErrorResponse(
          `Unknown import type: "${name}". Add a handler for this type.`,
          400
        );
    }
  } catch (error) {
    console.error('Import error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
});
