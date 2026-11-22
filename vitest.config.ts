import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import angular from '@analogjs/vite-plugin-angular';
import { fileURLToPath } from 'node:url';
import type { BrowserCommand } from 'vitest/node';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const alias = {
  '@dzgraph/core/internal': here('./packages/core/src/internal.ts'),
  '@dzgraph/core/sparkline': here('./packages/core/src/sparkline.ts'),
  '@dzgraph/dom/sparkline': here('./packages/dom/src/sparkline.ts'),
  '@dzgraph/core': here('./packages/core/src/index.ts'),
  '@dzgraph/dom': here('./packages/dom/src/index.ts'),
  '@dzgraph/angular': here('./packages/angular/src/index.ts'),
};

/**
 * Real browsers wherever a test can run in one (owner, 2026-11-21: « des tests sur browser quand c'est possible »):
 * the DOM layer's tests run only there (jsdom sees no layout, no pixels, no engine differences), and the core's tests
 * run there too, besides node, because engines differ (Intl, spike S4). Chrome by default; `BROWSERS=all` adds Firefox
 * and WebKit, one after another (fileParallelism off: one browser at a time keeps the machine cool).
 */
const which = (process.env['BROWSERS'] ?? 'chromium').replace('all', 'chromium,firefox,webkit').split(',');
// System Chrome for Chromium (the same as the spikes and the sister projects); Playwright's builds for the others.
// A fresh list for each project: vitest writes the project's name into each instance.
const instances = () =>
  which.map((browser) => ({
    browser: browser as 'chromium' | 'firefox' | 'webkit',
    provider: playwright(browser === 'chromium' ? { launchOptions: { channel: 'chrome' } } : {}),
  }));

/** The page as printed, or back on screen (print.md 3): the theme's print rules, tested where they apply. */
const printMedia: BrowserCommand<[on: boolean]> = async (ctx, on) => {
  await ctx.page.emulateMedia({ media: on ? 'print' : null });
};

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
          browser: { enabled: true, headless: true, provider: playwright(), instances: instances(), screenshotFailures: false, commands: { printMedia } },
        },
      },
      // Angular components compiled for the tests (not stubbed: only a rendered template catches a binding that fails),
      // run in the same real browsers.
      {
        plugins: [angular({ jit: false, tsconfig: here('./packages/angular/tsconfig.spec.json') })],
        resolve: { alias },
        test: {
          name: 'angular',
          globals: true,
          include: ['packages/angular/test/**/*.test.ts'],
          setupFiles: ['packages/angular/test/setup.ts'],
          fileParallelism: false,
          browser: { enabled: true, headless: true, provider: playwright(), instances: instances(), screenshotFailures: false, commands: { printMedia } },
        },
      },
      { test: { name: 'theme', globals: true, environment: 'node', passWithNoTests: true, include: ['packages/theme/test/**/*.test.ts'] } },
      { test: { name: 'tools', globals: true, environment: 'node', include: ['scripts/test/**/*.test.ts'] } },
    ],
  },
});
