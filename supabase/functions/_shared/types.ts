/**
 * Shared types for Supabase Edge Functions
 */

export interface ImportResponse {
  success: boolean;
  message: string;
  recordsProcessed?: number;
  recordsDeleted?: number;
  errors?: string[];
}

export interface ImportRequest {
  data: unknown[];
  dryRun?: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
}

export type ImportStrategy = 'replace' | 'upsert' | 'append' | 'upsert-cleanup';

export interface ImportOptions {
  tableName: string;
  records: unknown[];
  strategy: ImportStrategy;
  upsertKey?: string; // For upsert strategy (e.g., 'id', 'po_number')
  batchSize?: number;
}

