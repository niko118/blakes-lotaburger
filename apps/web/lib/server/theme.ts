import "server-only";

/**
 * Maps THEME_* environment variables to CSS custom properties.
 * Override any of these in .env.local to retheme the app without touching code.
 *
 * All values must be valid CSS color strings (hex, rgb, hsl).
 *
 * Tailwind v4 exposes colors as both `--primary` and `--color-primary`
 * (where `--color-primary: var(--primary)`). We override both to ensure
 * the change propagates regardless of which variable Tailwind resolves at runtime.
 */

interface ThemeEntry {
  vars: string[];
  value: string | undefined;
}

const THEME_ENTRIES: ThemeEntry[] = [
  {
    // Main accent — buttons, active nav items, links
    // Default: #6366f1 (indigo)
    vars: ["--primary", "--color-primary"],
    value: process.env.THEME_PRIMARY,
  },
  {
    // Darker shade — hover states on primary elements
    // Default: #4338ca
    vars: ["--primary-dark", "--color-primary-dark"],
    value: process.env.THEME_PRIMARY_DARK,
  },
  {
    // Lighter shade — focus rings, secondary accents
    // Default: #818cf8
    vars: ["--primary-soft", "--color-primary-soft"],
    value: process.env.THEME_PRIMARY_SOFT,
  },
  {
    // Very light shade — subtle tinted backgrounds
    // Default: #c7d2fe
    vars: ["--primary-light", "--color-primary-light"],
    value: process.env.THEME_PRIMARY_LIGHT,
  },
  {
    // Near-white tint — primary-hued surfaces
    // Default: #eef2ff
    vars: ["--primary-extra-light", "--color-primary-extra-light"],
    value: process.env.THEME_PRIMARY_EXTRA_LIGHT,
  },
  {
    // Sidebar background
    // Default: #2d322b (dark olive)
    vars: ["--pickled-black", "--color-pickled-black"],
    value: process.env.THEME_SIDEBAR_BG,
  },
  {
    // Main page background
    // Default: #f7f9f6 (off-white)
    vars: ["--fog", "--color-fog"],
    value: process.env.THEME_PAGE_BG,
  },
];

/**
 * Returns a <style> block string that overrides CSS custom properties
 * based on THEME_* env vars. Returns null if no overrides are set.
 */
export function buildThemeStyle(): string | null {
  const declarations: string[] = [];

  for (const entry of THEME_ENTRIES) {
    if (!entry.value) continue;
    for (const cssVar of entry.vars) {
      declarations.push(`${cssVar}: ${entry.value};`);
    }
  }

  if (!declarations.length) return null;
  return `:root { ${declarations.join(" ")} }`;
}
