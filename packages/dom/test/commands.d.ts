// The tests' own browser commands (vitest.config.ts): the page as printed, or back on screen; reduced motion. A module (the export
// below), so this adds to vitest's commands instead of replacing its module.
export {};

declare module 'vitest/internal/browser' {
  interface BrowserCommands {
    printMedia: (on: boolean) => Promise<void>;
    reducedMotion: (on: boolean) => Promise<void>;
  }
}
