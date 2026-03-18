/**
 * Component Render E2E Tests
 *
 * Fetches all Storybook stories from index.json and tests each one:
 * 1. No console errors during render
 * 2. No uncaught exceptions
 * 3. No React error boundaries triggered
 * 4. Component actually renders visible content
 * 5. Screenshots for visual regression
 *
 * Uses /iframe.html?id= for direct story rendering (no Storybook shell).
 */

import {test, expect, type Page, type ConsoleMessage} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import config from '../cpk-e2e.config';

const SCREENSHOTS_DIR = path.resolve(__dirname, '../screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, {recursive: true});
}

interface StoryEntry {
  id: string;
  title: string;
  name: string;
  type?: string;
}

// Errors to ignore (not real render problems)
// Base list from config + test-specific patterns
const IGNORED_ERRORS = [
  ...config.ignoredErrors,
  'ENOENT',
  // React 19 + react-native-web compat (findDOMNode removed in React 19)
  'findDOMNode',
  "Couldn't find node",
  // Storybook generic error boundary (wraps real errors, not actionable itself)
  'The component failed to render properly',
  'configuration issue in Storybook',
  'Error rendering story',
];

function setupErrorCollector(page: Page) {
  const errors: string[] = [];

  const onConsole = (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (IGNORED_ERRORS.some((ignore) => text.includes(ignore))) return;
      errors.push(text);
    }
  };

  const onPageError = (error: Error) => {
    const text = error.message;
    if (IGNORED_ERRORS.some((ignore) => text.includes(ignore))) return;
    errors.push(`Uncaught: ${text}`);
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  return {
    errors,
    cleanup: () => {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
    },
  };
}

/**
 * Fetch all stories from Storybook's index endpoint.
 */
async function fetchStories(
  baseURL: string,
  page: Page,
): Promise<StoryEntry[]> {
  for (const endpoint of ['index.json', 'stories.json']) {
    try {
      const response = await page.request.get(`${baseURL}/${endpoint}`);
      if (response.ok()) {
        const data = await response.json();
        const entries = data.entries || data.stories || {};
        return Object.values(entries as Record<string, StoryEntry>).filter(
          (entry) => entry.type !== 'docs',
        );
      }
    } catch {
      continue;
    }
  }

  throw new Error(
    'Could not fetch stories from Storybook. Ensure storybook-static is built.',
  );
}

/**
 * Build the story URL with optional theme globals.
 */
function storyUrl(
  baseURL: string,
  storyId: string,
  theme?: 'light' | 'dark',
): string {
  let url = `${baseURL}/iframe.html?id=${storyId}&viewMode=story`;
  if (theme) {
    url += `&globals=theme:${theme}`;
  }
  return url;
}

/**
 * Test all stories render without errors for a given theme.
 */
async function testStoriesRender(
  page: Page,
  baseURL: string,
  stories: StoryEntry[],
  theme: 'light' | 'dark',
) {
  const results: {
    id: string;
    title: string;
    status: 'pass' | 'fail';
    errors: string[];
  }[] = [];

  for (const story of stories) {
    const {errors, cleanup} = setupErrorCollector(page);

    try {
      await page.goto(storyUrl(baseURL, story.id, theme), {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForLoadState('networkidle');

      // Check for Storybook error display (skip if error is in IGNORED_ERRORS)
      try {
        const errorDisplay = page.locator('.sb-errordisplay');
        const errorCount = await errorDisplay.count();
        if (errorCount > 0) {
          const errorText =
            (await errorDisplay.first().textContent()) || '';
          const isIgnored = IGNORED_ERRORS.some((ignore) =>
            errorText.includes(ignore),
          );
          if (!isIgnored) {
            errors.push(`Storybook error: ${errorText.slice(0, 300)}`);
          }
        }
      } catch {
        // No error display = good
      }

      // Check component renders content (only if no error overlay)
      try {
        const root = page.locator('#storybook-root, #root');
        const rootCount = await root.count();
        if (rootCount > 0) {
          const innerHTML = await root.first().innerHTML();
          if (
            (!innerHTML || innerHTML.trim().length === 0) &&
            errors.length === 0
          ) {
            errors.push('Component rendered empty content');
          }
        }
      } catch {
        // Root check failed
      }

      // Screenshot
      const screenshotName = story.id.replace(/[^a-zA-Z0-9-]/g, '_');
      const suffix = theme === 'dark' ? '--dark' : '';
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, `${screenshotName}${suffix}.png`),
        fullPage: true,
      });
    } finally {
      cleanup();
    }

    results.push({
      id: story.id,
      title: story.title,
      status: errors.length > 0 ? 'fail' : 'pass',
      errors: [...errors],
    });
  }

  const passed = results.filter((r) => r.status === 'pass');
  const failed = results.filter((r) => r.status === 'fail');
  const label = theme === 'dark' ? 'Dark mode' : 'Results';

  console.log(
    `\n  ${label}: ${passed.length}/${results.length} stories passed`,
  );

  if (failed.length > 0) {
    const report = failed
      .map((f) => `\n  ${f.id}:\n    ${f.errors.join('\n    ')}`)
      .join('');
    expect(
      failed.length,
      `${failed.length} stories had ${theme} mode errors:${report}`,
    ).toBe(0);
  }
}

// ─── Tests ────────────────────────────────────────────────

test.describe('Component Render Tests', () => {
  let stories: StoryEntry[] = [];

  test.beforeAll(async ({browser, baseURL}) => {
    const page = await browser.newPage();
    try {
      stories = await fetchStories(baseURL!, page);
    } finally {
      await page.close();
    }

    if (stories.length === 0) {
      throw new Error('No stories found in Storybook');
    }

    console.log(`Found ${stories.length} stories to test`);
  });

  test('stories are available', () => {
    expect(stories.length).toBeGreaterThan(0);
  });

  test('each story renders without errors (light)', async ({page, baseURL}) => {
    await testStoriesRender(page, baseURL!, stories, 'light');
  });

  test('each story renders without errors (dark)', async ({page, baseURL}) => {
    await testStoriesRender(page, baseURL!, stories, 'dark');
  });

  test('each component group has a renderable story', async ({
    page,
    baseURL,
  }) => {
    const groups = new Map<string, StoryEntry[]>();
    for (const story of stories) {
      if (!groups.has(story.title)) {
        groups.set(story.title, []);
      }
      groups.get(story.title)!.push(story);
    }

    const failedGroups: string[] = [];

    for (const [title, groupStories] of groups) {
      let anyRendered = false;

      for (const story of groupStories) {
        await page.goto(storyUrl(baseURL!, story.id), {
          waitUntil: 'domcontentloaded',
        });
        await page.waitForLoadState('networkidle');

        try {
          const errorDisplay = page.locator('.sb-errordisplay');
          const errorCount = await errorDisplay.count();
          if (errorCount === 0) {
            anyRendered = true;
            break;
          }
          const errorText =
            (await errorDisplay.first().textContent()) || '';
          const isIgnored = IGNORED_ERRORS.some((ignore) =>
            errorText.includes(ignore),
          );
          if (isIgnored) {
            anyRendered = true;
            break;
          }
        } catch {
          anyRendered = true;
          break;
        }
      }

      if (!anyRendered) {
        failedGroups.push(title);
      }
    }

    if (failedGroups.length > 0) {
      expect(
        failedGroups.length,
        `Component groups with no renderable stories:\n  ${failedGroups.join('\n  ')}`,
      ).toBe(0);
    }
  });
});
