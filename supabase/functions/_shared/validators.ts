/**
 * Shared validation utilities for Supabase Edge Functions
 */

import type { ValidationError } from './types.ts';

export function validateRequired(value: unknown, field: string): ValidationError | null {
  if (value === null || value === undefined || value === '') {
    return { field, message: `${field} is required` };
  }
  return null;
}

export function validateArray(value: unknown, field: string): ValidationError | null {
  if (!Array.isArray(value)) {
    return { field, message: `${field} must be an array` };
  }
  return null;
}

export function collectErrors(validators: Array<ValidationError | null>): ValidationError[] {
  return validators.filter((error): error is ValidationError => error !== null);
}

