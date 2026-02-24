import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/acceptance/**/*.test.ts", "tests/acceptance/**/*.test.tsx"],
    clearMocks: true,
    setupFiles: ["tests/setup.ts"],
    globalSetup: ["tests/acceptance/global-setup.ts"],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    maxWorkers: 1,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
