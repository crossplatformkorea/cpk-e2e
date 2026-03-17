# cpk-e2e

E2E render testing for [cpk-ui](https://github.com/crossplatformkorea/cpk-ui) React Native components.

Automatically discovers all components, crawls their Storybook stories, and verifies they render without errors.

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
- **Screenshots** - saves every story for visual review

## Commands

| Command | Description |
|---------|-------------|
| `bun run discover` | List all components found in cpk-ui |
| `bun run check-coverage` | Show which components are missing stories |
| `bun run test` | Run all E2E tests |
| `bun run test:headed` | Run with visible browser |
| `bun run test:ui` | Interactive Playwright UI |
| `bun run e2e` | Full pipeline (discover + build + test) |
| `bun run report` | View HTML test report |

## Requirements

- [cpk-ui](https://github.com/crossplatformkorea/cpk-ui) cloned as sibling directory (`../cpk-ui`)
- Bun
- Node.js 20+
