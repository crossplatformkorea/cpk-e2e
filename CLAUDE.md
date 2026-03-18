# CPK-E2E

E2E render testing tool for [cpk-ui](https://github.com/crossplatformkorea/cpk-ui) React Native components.

## Project Structure

```text
cpk-e2e/
├── cpk-e2e.config.ts             # Project configuration (target paths, options)
├── scripts/
│   ├── discover-components.ts     # Parse target source to find all components
│   ├── check-coverage.ts          # Verify all components have story coverage
│   ├── run-e2e.ts                 # Full E2E pipeline orchestrator
│   ├── cli.ts                     # CLI entry point (npx cpk-e2e)
│   └── index.ts                   # Library exports
├── tests/
│   └── components.spec.ts         # Playwright tests (light + dark mode)
├── screenshots/                   # Auto-generated screenshots (gitignored)
├── playwright.config.ts
└── package.json
```

## How It Works

1. **Discover**: Parses target project's index file to find all exported React components (filters out types/interfaces/hooks)
2. **Build**: Builds target project's Storybook as static web app
3. **Coverage**: Checks which components have stories (and which don't)
4. **Test**: Playwright opens each story via `/iframe.html?id=` and checks:
   - No console errors
   - No React error boundaries
   - No uncaught exceptions
   - Component actually renders (not empty)
   - Both light and dark mode render correctly
5. **Screenshot**: Saves light + dark screenshots of each story for visual regression

## Prerequisites

- cpk-ui must be cloned at `../cpk-ui` (sibling directory, configurable in `cpk-e2e.config.ts`)
- Storybook must be buildable in cpk-ui

## Commands

```bash
bun install                    # Install dependencies
bun run discover               # List all cpk-ui components
bun run discover -- --json     # Output as JSON
bun run check-coverage         # Check story coverage
bun run check-coverage -- --json  # Output coverage as JSON
bun run test                   # Run Playwright tests (auto-starts server)
bun run test:headed            # Run with visible browser
bun run test:ui                # Interactive Playwright UI
bun run e2e                    # Full pipeline (discover + build + test)
bun run e2e -- --skip-build    # Skip Storybook rebuild
bun run report                 # View HTML test report
bun run build                  # Build npm package
```

## Configuration

Edit `cpk-e2e.config.ts` to adapt for different React Native projects:

- `targetRoot` - Path to target UI library
- `indexPath` - Main export file (relative to targetRoot)
- `storybookStaticPath` - Built Storybook directory
- `storybookBuildCommand` - How to build Storybook
- `storybookPort` - Port for serving
- `ignoredErrors` - Console error patterns to skip

## Adding New Tests

### Testing a specific component

```ts
// tests/button.spec.ts
import {test, expect} from '@playwright/test';

test('Button renders all variants', async ({page, baseURL}) => {
  await page.goto(`${baseURL}/iframe.html?id=button--basic&viewMode=story`);
  await expect(page.locator('button')).toBeVisible();
});
```

### Testing interactions

```ts
test('Button click triggers action', async ({page, baseURL}) => {
  await page.goto(`${baseURL}/iframe.html?id=button--basic&viewMode=story`);
  await page.click('button');
  // Check for state changes, navigation, etc.
});
```

## Architecture Decisions

- **Storybook as render target**: Components are already configured with proper props in stories
- **iframe.html direct access**: Bypasses Storybook shell for faster, more reliable tests
- **Playwright over Detox/Maestro**: Tests run on web (react-native-web). No simulator needed
- **Separate repo**: Keeps E2E concerns isolated from the component library
- **Light + Dark mode**: Tests both themes via Storybook globals parameter
- **Screenshot-based**: Every story gets light + dark screenshots saved

## CI

- **ci.yml**: Runs on push/PR. Clones cpk-ui, builds Storybook (cached), runs E2E tests. Uploads reports + screenshots as artifacts.
- **publish.yml**: Publishes to npm on release or manual dispatch.
- **repository_dispatch**: cpk-ui can trigger E2E tests via `cpk-ui-updated` event.

## Future Roadmap

- [ ] Visual regression with screenshot comparison (baseline vs current)
- [ ] Accessibility audits (axe-core integration)
- [ ] Performance metrics (render time per component)
- [ ] Cross-browser testing (Firefox, Safari)
- [ ] Test interaction stories (click, input, gesture)
