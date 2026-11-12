import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["**/node_modules/**", "**/.next/**", "**/out/**", "**/build/**", "**/dist/**", "**/next-env.d.ts"]),
  {
    files: ["packages/**/*.ts", "scripts/**/*.{ts,mjs}"],
    extends: [tseslint.configs.recommended],
  },
]);
