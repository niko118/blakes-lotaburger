import "server-only";
/* eslint-disable no-console */
import { db } from "@lib/server/db";
import { apiCredentials } from "@lib/db/schema";
import { eq } from "drizzle-orm";
import { encrypt, decrypt, fingerprint } from "./crypto";

// Environment variables validation
if (!process.env.EXTERNAL_OAUTH_REFRESH_URL) {
  throw new Error("EXTERNAL_OAUTH_REFRESH_URL is required");
}

const REFRESH_URL = process.env.EXTERNAL_OAUTH_REFRESH_URL;
const REFRESH_SKEW_SECONDS = parseInt(
  process.env.TOKEN_REFRESH_SKEW_SECONDS || "60",
  10
);
const ACCESS_TTL_FALLBACK = parseInt(
  process.env.TOKEN_ACCESS_TTL_FALLBACK || "2419200",
  10
);

// In-memory cache for access tokens: integrationId -> { token, expiresAt }
const accessTokenCache = new Map<
  string,
  { token: string; expiresAt: Date }
>();

// Singleflight pattern: integrationId -> Promise<string>
const inflightRefreshes = new Map<string, Promise<string>>();

interface RefreshTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
  scope: string;
}

/**
 * Get a valid access token for an integration
 * Checks memory cache -> DB cache -> performs refresh if needed
 */
export async function getAccessToken(integrationId: string): Promise<string> {
  const now = new Date();

  // 1. Check memory cache
  const cached = accessTokenCache.get(integrationId);
  if (cached && isTokenValid(cached.expiresAt, now)) {
    return cached.token;
  }

  // 2. Check DB cache
  const [record] = await db
    .select()
    .from(apiCredentials)
    .where(eq(apiCredentials.integrationId, integrationId))
    .limit(1);

  if (!record) {
    throw new Error(
      `No credentials found for integration ${integrationId}. Please seed the credentials first.`
    );
  }

  if (
    record.accessTokenEncrypted &&
    record.accessExpiresAt &&
    isTokenValid(record.accessExpiresAt, now)
  ) {
    // Decrypt and memoize
    const token = decrypt(record.accessTokenEncrypted);
    accessTokenCache.set(integrationId, {
      token,
      expiresAt: record.accessExpiresAt,
    });
    return token;
  }

  // 3. Need to refresh
  return refreshAccessToken(integrationId);
}

/**
 * Refresh the access token for an integration
 * Uses singleflight pattern to avoid concurrent refreshes
 */
export async function refreshAccessToken(integrationId: string): Promise<string> {
  // Singleflight: if a refresh is in progress, return the same promise
  const inflight = inflightRefreshes.get(integrationId);
  if (inflight) {
    return inflight;
  }

  const refreshPromise = performRefresh(integrationId);
  inflightRefreshes.set(integrationId, refreshPromise);

  try {
    const token = await refreshPromise;
    return token;
  } finally {
    inflightRefreshes.delete(integrationId);
  }
}

/**
 * Perform the actual refresh operation
 */
async function performRefresh(integrationId: string): Promise<string> {
  // 1. Load refresh token from DB
  const [record] = await db
    .select()
    .from(apiCredentials)
    .where(eq(apiCredentials.integrationId, integrationId))
    .limit(1);

  if (!record) {
    throw new Error(
      `No credentials found for integration ${integrationId}. Please seed the credentials first.`
    );
  }

  const refreshToken = decrypt(record.refreshTokenEncrypted);

  // 2. Call refresh endpoint
  const startTime = Date.now();
  let response: Response;
  try {
    response = await fetch(REFRESH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch (error) {
    throw new Error(
      `Failed to call refresh endpoint for integration ${integrationId}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const duration = Date.now() - startTime;

  if (!response.ok) {
    throw new Error(
      `Refresh failed for integration ${integrationId}: ${response.status} ${response.statusText}`
    );
  }

  const data: RefreshTokenResponse = await response.json();

  if (!data.access_token) {
    throw new Error(
      `Refresh response missing access_token for integration ${integrationId}`
    );
  }

  // 3. Calculate expiry
  const expiresInSeconds = data.expires_in || ACCESS_TTL_FALLBACK;
  const now = new Date();
  const accessExpiresAt = new Date(
    now.getTime() + (expiresInSeconds - REFRESH_SKEW_SECONDS) * 1000
  );

  // 4. Encrypt access token
  const accessTokenEncrypted = encrypt(data.access_token);

  // 5. Handle refresh token rotation (if new refresh_token is provided)
  let updateData: Record<string, unknown> = {
    accessTokenEncrypted,
    accessExpiresAt,
    lastAccessTtlSeconds: expiresInSeconds,
    lastRefreshedAt: now,
    updatedAt: now,
  };

  if (data.refresh_token) {
    // Provider rotated the refresh token
    updateData = {
      ...updateData,
      refreshTokenEncrypted: encrypt(data.refresh_token),
      refreshTokenFingerprint: fingerprint(data.refresh_token),
      rotatedAt: now,
    };
  }

  // 6. Persist to DB
  await db
    .update(apiCredentials)
    .set(updateData)
    .where(eq(apiCredentials.integrationId, integrationId));

  // 7. Update memory cache
  accessTokenCache.set(integrationId, {
    token: data.access_token,
    expiresAt: accessExpiresAt,
  });

  // Log success (structured, no secrets)
  console.log(
    JSON.stringify({
      event: "token_refreshed",
      integrationId,
      integrationName: record.integrationName,
      duration,
      expiresInSeconds,
      rotated: !!data.refresh_token,
    })
  );

  return data.access_token;
}

/**
 * Check if a token is valid (not expired considering skew)
 */
function isTokenValid(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() > now.getTime();
}

/**
 * Clear memory cache for a specific integration (for testing)
 */
export function clearCache(integrationId?: string): void {
  if (integrationId !== undefined) {
    accessTokenCache.delete(integrationId);
  } else {
    accessTokenCache.clear();
  }
}

