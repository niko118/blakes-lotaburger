// Minimal ESLint config for standalone use (pre-commit hooks)
// Note: Next.js build process uses full linting with all rules
// This simplified config avoids circular dependency issues with ESLint 9 + FlatCompat
// Full validation happens at build time and in CI

import tsParser from "@typescript-eslint/parser";

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "components/ui/**",
      "scripts/**",
      "**/__tests__/**",
    ],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      // Console statements (warn, allow warn/error)
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // Enforce no inline className strings
      "no-restricted-syntax": [
        "error",
        {
          selector: 'JSXAttribute[name.name="className"][value.type="Literal"]',
          message:
            "No inline className strings. Extract to named constant in camelCase (e.g., styles.pageContainer) or use CVA component for semantic patterns.",
        },
      ],
    },
  },
];

export default eslintConfig;
