import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["apps/api/src/integration.test.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
