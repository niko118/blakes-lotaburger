/**
 * GraphQL client helper for client-side data fetching
 */

/**
 * Fetch data from GraphQL endpoint (client-side only)
 * Uses relative path /api/graphql
 * Throws error if GraphQL returns errors
 */
export async function fetchGraphQL<T = any>(
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  const response = await fetch("/api/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const contentType = response.headers.get("content-type");

  // Try to parse JSON response (GraphQL returns errors in body even with non-200 status)
  if (contentType?.includes("application/json")) {
    const result = await response.json();

    // GraphQL can return errors with any HTTP status
    if (result.errors && result.errors.length > 0) {
      const error = result.errors[0];
      throw new Error(error.message || "GraphQL error occurred");
    }

    // If no errors but response not ok, something unexpected happened
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return result.data;
  }

  // Non-JSON response - log and throw
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  console.error("Response is not JSON:", contentType);
  console.error("Response body:", text.substring(0, 200));
  throw new Error("Response is not JSON");
}
