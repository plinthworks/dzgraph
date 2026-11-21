import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { fileURLToPath } from 'node:url';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const alias = {
  '@dzgraph/core/internal': here('./packages/core/src/internal.ts'),
  '@dzgraph/core': here('./packages/core/src/index.ts'),
  '@dzgraph/dom': here('./packages/dom/src/index.ts'),
};

/**
 * Real browsers wherever a test can run in one (owner, 2026-11-21: « des tests sur browser quand c'est possible »):
 * the DOM layer's tests run only there (jsdom sees no layout, no pixels, no engine differences), and the core's tests
 * run there too, besides node, because engines differ (Intl, spike S4). Chrome by default; `BROWSERS=all` adds Firefox
 * and WebKit, one after another (fileParallelism off: one browser at a time keeps the machine cool).
 */
const which = (process.env['BROWSERS'] ?? 'chromium').replace('all', 'chromium,firefox,webkit').split(',');
// System Chrome for Chromium (the same as the spikes and the sister projects); Playwright's builds for the others.
const instances = which.map((browser) => ({
  browser: browser as 'chromium' | 'firefox' | 'webkit',
  provider: playwright(browser === 'chromium' ? { launchOptions: { channel: 'chrome' } } : {}),
}));

export default defineConfig({
  test: {
    globals: true,
    projects: [
      // The core runs in node: no DOM to lean on by accident.
      { resolve: { alias }, test: { name: 'core', globals: true, environment: 'node', include: ['packages/core/test/**/*.test.ts'] } },
      {
        resolve: { alias },
        test: {
          name: 'browser',
          globals: true,
          include: ['packages/core/test/**/*.test.ts', 'packages/dom/test/**/*.test.ts'],
          fileParallelism: false,
          browser: { enabled: true, headless: true, provider: playwright(), instances, screenshotFailures: false },
        },
      },
      { test: { name: 'theme', globals: true, environment: 'node', passWithNoTests: true, include: ['packages/theme/test/**/*.test.ts'] } },
      { test: { name: 'tools', globals: true, environment: 'node', include: ['scripts/test/**/*.test.ts'] } },
    ],
  },
});
