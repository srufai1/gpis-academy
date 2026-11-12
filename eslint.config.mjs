import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

const web = (configs) => configs.map((c) => ({ ...c, files: ["apps/web/**/*.{ts,tsx,js,mjs}"] }));

export default defineConfig([
  globalIgnores(["**/node_modules/**", "**/.next/**", "**/out/**", "**/build/**", "**/dist/**", "**/next-env.d.ts"]),
  ...web(nextVitals),
  ...web(nextTs),
  { files: ["apps/web/**"], settings: { next: { rootDir: "apps/web/" } } },
  {
    files: ["packages/**/*.ts", "scripts/**/*.{ts,mjs}"],
    extends: [tseslint.configs.recommended],
  },
]);
