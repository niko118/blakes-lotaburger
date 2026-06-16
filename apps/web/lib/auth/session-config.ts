/**
 * Session configuration constants
 */

// Maximum session age in hours
export const SESSION_MAX_AGE_HOURS = 12;

// Maximum session age in seconds (for NextAuth)
export const SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE_HOURS * 60 * 60; // 43200 seconds
