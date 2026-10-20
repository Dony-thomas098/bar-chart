import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist-mobile/**",
    "next-env.d.ts",
    "android/**",
    "ios/**",
    "node_modules/**",
  ]),
  {
    rules: {
      "no-unused-vars": "off",
    },
  },
]);

export default eslintConfig;
