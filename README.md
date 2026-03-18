# cpk-e2e

E2E render testing for [cpk-ui](https://github.com/crossplatformkorea/cpk-ui) React Native components.

Automatically discovers all components, crawls their Storybook stories, and verifies they render without errors in both light and dark mode.

## Quick Start

```bash
# Install
bun install
npx playwright install chromium

# Build cpk-ui's Storybook first
cd ../cpk-ui && bun run build-storybook && cd ../cpk-e2e

# Run tests
bun run test

# Or run the full pipeline
bun run e2e
```

## What It Tests

- **Console errors** - catches runtime errors like version mismatches
- **React error boundaries** - detects component crashes
- **Empty renders** - finds components that fail silently
- **Uncaught exceptions** - catches unhandled promise rejections
- **Dark mode** - verifies all stories render in both themes
- **Screenshots** - saves every story (light + dark) for visual review

## Commands

| Command | Description |
|---------|-------------|
| `bun run discover` | List all components found in cpk-ui |
| `bun run discover -- --json` | Output as JSON |
| `bun run check-coverage` | Show which components are missing stories |
| `bun run check-coverage -- --json` | Output coverage as JSON |
| `bun run test` | Run all E2E tests (Desktop + Mobile Chrome) |
| `bun run test:headed` | Run with visible browser |
| `bun run test:ui` | Interactive Playwright UI |
| `bun run e2e` | Full pipeline (discover + build + test) |
| `bun run e2e -- --skip-build` | Skip Storybook rebuild |
| `bun run report` | View HTML test report |

## Configuration

Edit [`cpk-e2e.config.ts`](cpk-e2e.config.ts) to customize for your project:

```ts
const config: CpkE2eConfig = {
  targetRoot: '../cpk-ui',           // Path to UI library
  indexPath: 'src/index.tsx',        // Main export file
  storybookStaticPath: 'storybook-static',
  storybookBuildCommand: 'STORYBOOK=1 npx storybook build -o storybook-static',
  storybookPort: 6006,
  ignoredErrors: [...],              // Console errors to skip
};
```

## CI

The CI workflow automatically:
1. Builds the project
2. Clones cpk-ui and builds Storybook (with caching)
3. Runs all E2E tests
4. Uploads test reports and screenshots as artifacts

cpk-ui can trigger this workflow via `repository_dispatch` event.

## Requirements

- [cpk-ui](https://github.com/crossplatformkorea/cpk-ui) cloned as sibling directory (`../cpk-ui`)
- Bun
- Node.js 20+
