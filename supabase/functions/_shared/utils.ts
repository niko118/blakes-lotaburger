/**
 * Shared utilities for Supabase Edge Functions
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { ImportResponse, ImportOptions } from './types.ts';

export function corsHeaders(origin?: string) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

export function createSuccessResponse(data: unknown, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    }
  );
}

export function createErrorResponse(message: string, status = 400) {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Fetch with timeout and retry logic for external URLs
 * Handles transient network errors and server failures
 * 
 * @param url - URL to fetch
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param timeoutMs - Timeout in milliseconds per attempt (default: 30000)
 * @returns Response from the fetch
 * @throws Error if all retry attempts fail
 */
export async function fetchWithRetry(
  url: string,
  maxRetries = 3,
  timeoutMs = 30000
): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(url, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Don't retry on client errors (4xx) - these are permanent
      if (response.status >= 400 && response.status < 500) {
        return response;
      }
      
      // Retry on server errors (5xx)
      if (!response.ok && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff: 1s, 2s, 4s, max 10s
        console.log(`Attempt ${attempt}/${maxRetries} failed with ${response.status}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return response;
      
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === 'AbortError';
      const isNetworkError = error instanceof TypeError;
      
      // Retry on timeout or network errors
      if ((isTimeout || isNetworkError) && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        const errorType = isTimeout ? 'timeout' : 'network error';
        console.log(`Attempt ${attempt}/${maxRetries} failed (${errorType}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Last attempt failed or non-retryable error
      throw error;
    }
  }
  
  throw new Error(`Failed after ${maxRetries} attempts`);
}

/**
 * Initialize Supabase client with service role key
 */
export function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Import data using specified strategy
 */
export async function importData(options: ImportOptions): Promise<ImportResponse> {
  const { tableName, records, strategy, upsertKey, batchSize = 500 } = options;
  const supabase = getSupabaseClient();
  
  let recordsDeleted = 0;
  let totalProcessed = 0;
  const errors: string[] = [];

  try {
    // REPLACE strategy: Delete all existing records first
    if (strategy === 'replace') {
      console.log(`Deleting all records from ${tableName}...`);
      const startDelete = Date.now();
      
      // Delete with count - need to select something to get count back
      const { error: deleteError, count } = await supabase
        .from(tableName)
        .delete({ count: 'exact' })
        .gte('imported_at', '1970-01-01')
        .select('id', { count: 'exact' });
      
      recordsDeleted = count || 0;
      
      if (deleteError) {
        errors.push(`Delete error: ${deleteError.message}`);
        console.error(`Delete error in ${tableName}:`, deleteError);
      }
      
      const deleteTime = Date.now() - startDelete;
      console.log(`Deleted ${recordsDeleted} records in ${deleteTime}ms`);
    }

    // UPSERT-CLEANUP strategy: Delete records NOT in import, then upsert
    if (strategy === 'upsert-cleanup') {
      if (!upsertKey) {
        return {
          success: false,
          message: 'upsertKey is required for upsert-cleanup strategy',
          recordsProcessed: 0,
          errors: ['upsertKey missing'],
        };
      }

      console.log(`Cleaning up ${tableName} - deleting records not in import...`);
      const startDelete = Date.now();
      
      // Extract IDs from records to import
      const idsInImport = records.map((record: any) => record[upsertKey]);
      
      // Delete records NOT in the import list
      const { error: deleteError, count } = await supabase
        .from(tableName)
        .delete({ count: 'exact' })
        .not(upsertKey, 'in', `(${idsInImport.join(',')})`)
        .select(upsertKey, { count: 'exact' });
      
      recordsDeleted = count || 0;
      
      if (deleteError) {
        errors.push(`Delete error: ${deleteError.message}`);
        console.error(`Delete error in ${tableName}:`, deleteError);
      }
      
      const deleteTime = Date.now() - startDelete;
      console.log(`Deleted ${recordsDeleted} records not in import in ${deleteTime}ms`);
    }

    // Process records in batches
    console.log(`Processing ${records.length} records in batches of ${batchSize}...`);
    const totalBatches = Math.ceil(records.length / batchSize);
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const startBatch = Date.now();

      let result;

      switch (strategy) {
        case 'upsert':
        case 'upsert-cleanup':
          if (!upsertKey) {
            errors.push(`Batch ${batchNumber}: upsertKey is required for ${strategy} strategy`);
            continue;
          }
          result = await supabase
            .from(tableName)
            .upsert(batch, { onConflict: upsertKey });
          break;

        case 'replace':
        case 'append':
        default:
          result = await supabase
            .from(tableName)
            .insert(batch);
          break;
      }

      const batchTime = Date.now() - startBatch;

      if (result.error) {
        errors.push(`Batch ${batchNumber}: ${result.error.message}`);
        console.error(`Batch ${batchNumber}/${totalBatches} failed in ${batchTime}ms:`, result.error);
      } else {
        totalProcessed += batch.length;
        
        // Log progress every 10 batches or last batch
        if (batchNumber % 10 === 0 || batchNumber === totalBatches) {
          console.log(`Progress: ${batchNumber}/${totalBatches} batches (${totalProcessed}/${records.length} records) - ${batchTime}ms`);
        }
      }
    }

    const success = errors.length === 0;
    const message = strategy === 'replace'
      ? `Replaced ${recordsDeleted} old records with ${totalProcessed} new records in ${tableName}`
      : strategy === 'upsert'
      ? `Upserted ${totalProcessed} records in ${tableName}`
      : strategy === 'upsert-cleanup'
      ? `Synced ${totalProcessed} records in ${tableName} (deleted ${recordsDeleted} old records)`
      : `Inserted ${totalProcessed} records into ${tableName}`;

    return {
      success,
      message: success ? message : `${message} (with ${errors.length} errors)`,
      recordsProcessed: totalProcessed,
      recordsDeleted: strategy === 'replace' ? recordsDeleted : undefined,
      errors: errors.length > 0 ? errors : undefined,
    };

  } catch (error) {
    console.error(`Import error in ${tableName}:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      recordsProcessed: totalProcessed,
      recordsDeleted,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

