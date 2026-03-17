# CPK-E2E

E2E render testing tool for [cpk-ui](https://github.com/crossplatformkorea/cpk-ui) React Native components.

## Project Structure

```
cpk-e2e/
├── scripts/
│   ├── discover-components.ts   # Parse cpk-ui source to find all components
│   ├── check-coverage.ts        # Verify all components have story coverage
│   └── run-e2e.ts               # Full E2E pipeline orchestrator
├── tests/
│   └── components.spec.ts       # Playwright tests that crawl all stories
├── screenshots/                 # Auto-generated screenshots (gitignored)
├── playwright.config.ts
└── package.json
```

## How It Works

1. **Discover**: Parses `cpk-ui/src/index.tsx` to find all exported components
2. **Build**: Builds cpk-ui's Storybook as static web app
3. **Coverage**: Checks which components have stories (and which don't)
4. **Test**: Playwright opens each story in a headless browser and checks:
   - No console errors
   - No React error boundaries
   - No uncaught exceptions
   - Component actually renders (not empty)
5. **Screenshot**: Saves a screenshot of each story for visual regression

## Prerequisites

- cpk-ui must be cloned at `../cpk-ui` (sibling directory)
- Storybook must be buildable in cpk-ui (`bun run build-storybook`)

## Commands

```bash
bun install                    # Install dependencies
bun run discover               # List all cpk-ui components
bun run check-coverage         # Check story coverage
bun run test                   # Run Playwright tests (auto-starts server)
bun run test:headed            # Run with visible browser
bun run test:ui                # Interactive Playwright UI
bun run e2e                    # Full pipeline (discover + build + test)
bun run e2e -- --skip-build    # Skip Storybook rebuild
bun run report                 # View HTML test report
```

## Adding New Tests

### Testing a specific component

Add a new test file in `tests/`:

```ts
// tests/button.spec.ts
import {test, expect} from '@playwright/test';

test('Button renders all variants', async ({page}) => {
  // Story ID format: category-componentname--storyname
  await page.goto('/iframe.html?id=ui-button--primary&viewMode=story');
  await expect(page.locator('button')).toBeVisible();
});
```

### Testing interactions

```ts
test('Button click triggers action', async ({page}) => {
  await page.goto('/iframe.html?id=ui-button--primary&viewMode=story');
  await page.click('button');
  // Check for state changes, navigation, etc.
});
```

## Architecture Decisions

- **Storybook as render target**: Components are already configured with proper props in stories. No need to guess default props.
- **Playwright over Detox/Maestro**: Tests run on web (react-native-web) which catches most render errors. No simulator needed.
- **Separate repo**: Keeps E2E concerns isolated from the component library. Can test multiple versions/branches.
- **Screenshot-based**: Every story gets a screenshot saved. Future: add visual regression comparison.

## Future Roadmap

- [ ] Visual regression with screenshot comparison (baseline vs current)
- [ ] Accessibility audits (axe-core integration)
- [ ] Performance metrics (render time per component)
- [ ] Mobile viewport testing
- [ ] Dark mode testing
- [ ] CI integration with cpk-ui (trigger on PR)
- [ ] Test interaction stories (click, input, gesture)
- [ ] Cross-browser testing (Firefox, Safari)
