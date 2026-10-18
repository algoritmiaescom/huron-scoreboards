import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      exclude: ['src/main.tsx', 'src/test/**'],
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: {
        // React Compiler emits memoization code that v8 counts but tests cannot reach, so
        // lines and functions are the meaningful gates. Raise these as real logic lands.
        branches: 50,
        functions: 80,
        lines: 90,
        statements: 70,
      },
    },
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
