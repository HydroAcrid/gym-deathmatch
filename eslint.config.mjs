import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Debt-ratchet: keep visibility while unblocking CI. These will be tightened incrementally.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      // User-provided remote avatar/photo URLs make next/image host allowlists brittle;
      // we intentionally use native img elements in many UIs.
      "@next/next/no-img-element": "off",
      // This rule is currently too noisy for existing async polling/loading patterns.
      // Keep exhaustive-deps on, and revisit once hooks are refactored.
      "react-hooks/set-state-in-effect": "off",
      "react/no-unescaped-entities": "off",
    },
  },
  {
    files: ["scripts/**/*.{js,cjs,mjs}", "tailwind.config.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["app/api/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/*", "@/src/ui2/*"],
              message: "API routes must not import UI modules. Use domain services only.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["domains/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/*", "@/components/*", "@/src/*"],
              message: "Domain modules must not depend on app or UI layers.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["platform/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/*", "@/components/*", "@/src/*", "@/domains/*"],
              message: "Platform modules must remain framework/domain-agnostic.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
