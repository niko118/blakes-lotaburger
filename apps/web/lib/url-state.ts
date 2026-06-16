/**
 * URL State Management Utilities
 *
 * Provides helpers for syncing component state with URL query strings.
 * Query strings are the source of truth - all state changes must update the URL.
 */

/**
 * Safely gets a string value from URLSearchParams
 */
export function getStringParam(
  params: URLSearchParams,
  key: string,
  defaultValue: string
): string {
  const value = params.get(key);
  return value !== null ? value : defaultValue;
}

/**
 * Safely gets a number value from URLSearchParams
 */
export function getNumberParam(
  params: URLSearchParams,
  key: string,
  defaultValue: number
): number {
  const value = params.get(key);
  if (value === null) return defaultValue;

  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Safely gets a boolean value from URLSearchParams
 */
export function getBooleanParam(
  params: URLSearchParams,
  key: string,
  defaultValue: boolean
): boolean {
  const value = params.get(key);
  if (value === null) return defaultValue;

  return value === "true";
}

/**
 * Gets an array of strings from URLSearchParams (repeated params)
 * Example: ?locationTypes=PALLET&locationTypes=RACK => ["PALLET", "RACK"]
 */
export function getArrayParam(
  params: URLSearchParams,
  key: string,
  defaultValue: string[] = []
): string[] {
  const values = params.getAll(key);
  return values.length > 0 ? values : defaultValue;
}

/**
 * Gets a value that must match one of the allowed values (enum-like)
 */
export function getEnumParam<T extends string>(
  params: URLSearchParams,
  key: string,
  allowedValues: readonly T[],
  defaultValue: T
): T {
  const value = params.get(key);
  if (value === null) return defaultValue;

  const isValid = allowedValues.includes(value as T);
  return isValid ? (value as T) : defaultValue;
}

/**
 * Builds a new URLSearchParams object from a partial params object
 * Only includes non-default values to keep URLs clean
 */
export function buildQueryString(
  params: Record<string, string | number | boolean | string[] | null | undefined>,
  defaults: Record<string, string | number | boolean | string[]>
): URLSearchParams {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    // Skip null/undefined values
    if (value === null || value === undefined) {
      return;
    }

    // Handle arrays (repeated params)
    if (Array.isArray(value)) {
      const defaultArray = defaults[key] as string[] | undefined;
      const isDefault =
        defaultArray &&
        value.length === defaultArray.length &&
        value.every((v, i) => v === defaultArray[i]);

      // Only add if not default
      if (!isDefault && value.length > 0) {
        value.forEach((v) => searchParams.append(key, v));
      }
      return;
    }

    // Skip default values to keep URL clean
    const defaultValue = defaults[key];
    if (value === defaultValue) {
      return;
    }

    // Add non-default value
    searchParams.set(key, String(value));
  });

  return searchParams;
}

/**
 * Updates the browser URL without causing a full page reload
 * Uses router.replace to avoid adding history entries for every filter change
 */
export function updateUrl(
  pathname: string,
  searchParams: URLSearchParams,
  router: { replace: (url: string) => void }
): void {
  const queryString = searchParams.toString();
  const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
  router.replace(newUrl);
}
