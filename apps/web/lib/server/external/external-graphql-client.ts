import "server-only";
/* eslint-disable no-console */
import { getAccessToken, refreshAccessToken } from "./auth-helper";

// Environment variables validation
if (!process.env.EXTERNAL_API_BASE_URL) {
  throw new Error("EXTERNAL_API_BASE_URL is required");
}

const API_BASE_URL = process.env.EXTERNAL_API_BASE_URL;
const RETRY_MAX = parseInt(process.env.EXT_API_RETRY_MAX || "3", 10);
const RETRY_BASE_MS = parseInt(process.env.EXT_API_RETRY_BASE_MS || "250", 10);

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

/**
 * Execute a GraphQL query/mutation against an external API for a given integration.
 * Internally handles access/refresh tokens, encryption at rest, retries, and 401 refresh.
 *
 * @param document GraphQL document string (query or mutation)
 * @param integrationId External integration identifier
 * @returns Typed data response
 * @throws Error if GraphQL errors are present or network/auth fails
 */
export async function externalGQL<T>(
  document: string,
  integrationId: string
): Promise<T> {
  let accessToken = await getAccessToken(integrationId);
  let attempt = 0;
  let lastError: Error | null = null;
  let has401Refreshed = false;

  while (attempt < RETRY_MAX) {
    attempt++;
    const startTime = Date.now();

    try {
      const response = await fetch(API_BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ query: document }),
      });

      const duration = Date.now() - startTime;

      // Handle 401: refresh token and retry once
      if (response.status === 401) {
        if (!has401Refreshed) {
          console.log(
            JSON.stringify({
              event: "external_gql_401",
              integrationId,
              attempt,
              duration,
            })
          );

          // Force refresh
          accessToken = await refreshAccessToken(integrationId);
          has401Refreshed = true;
          continue; // Retry with new token
        } else {
          throw new Error(
            `Authentication failed for integration ${integrationId} after refresh`
          );
        }
      }

      // Handle 5xx: retry with exponential backoff
      if (response.status >= 500) {
        const backoffMs = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        lastError = new Error(
          `External API returned ${response.status} for integration ${integrationId}`
        );

        console.log(
          JSON.stringify({
            event: "external_gql_5xx",
            integrationId,
            attempt,
            status: response.status,
            duration,
            willRetry: attempt < RETRY_MAX,
            backoffMs: attempt < RETRY_MAX ? backoffMs : undefined,
          })
        );

        if (attempt < RETRY_MAX) {
          await sleep(backoffMs);
          continue; // Retry
        } else {
          throw lastError; // Max retries reached
        }
      }

      // Parse response
      if (!response.ok) {
        throw new Error(
          `External API returned ${response.status} ${response.statusText} for integration ${integrationId}`
        );
      }

      const jsonData: GraphQLResponse<T> = await response.json();

      // Check for GraphQL errors
      if (jsonData.errors && jsonData.errors.length > 0) {
        const firstError = jsonData.errors[0];
        throw new Error(
          `GraphQL error for integration ${integrationId}: ${firstError.message}`
        );
      }

      // Success
      console.log(
        JSON.stringify({
          event: "external_gql_success",
          integrationId,
          attempt,
          duration,
        })
      );

      if (!jsonData.data) {
        throw new Error(
          `No data in GraphQL response for integration ${integrationId}`
        );
      }

      return jsonData.data;
    } catch (error) {
      // If it's a fetch error (network), retry with backoff
      if (
        error instanceof TypeError &&
        error.message.includes("fetch failed")
      ) {
        const backoffMs = RETRY_BASE_MS * Math.pow(2, attempt - 1);
        lastError = error;

        console.log(
          JSON.stringify({
            event: "external_gql_network_error",
            integrationId,
            attempt,
            error: error.message,
            willRetry: attempt < RETRY_MAX,
            backoffMs: attempt < RETRY_MAX ? backoffMs : undefined,
          })
        );

        if (attempt < RETRY_MAX) {
          await sleep(backoffMs);
          continue; // Retry
        } else {
          throw new Error(
            `Network error after ${RETRY_MAX} attempts for integration ${integrationId}: ${error.message}`
          );
        }
      }

      // For other errors (auth, GraphQL, parsing), don't retry
      throw error;
    }
  }

  // Should not reach here, but just in case
  throw (
    lastError ||
    new Error(`Max retries reached for integration ${integrationId}`)
  );
}

/**
 * Sleep utility for exponential backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
