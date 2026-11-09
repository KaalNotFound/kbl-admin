import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 10000,
    projects: [
      {
        // Server-side suites (frame generators, use-cases, contract): node env.
        test: {
          name: 'server',
          environment: 'node',
          include: ['server/__tests__/**/*.test.js'],
        },
      },
      {
        // Frontend component suites: jsdom env (RTL) — issue #4 C1 harness.
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['src/__tests__/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
})
