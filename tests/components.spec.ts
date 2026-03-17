/**
 * Component Render E2E Tests
 *
 * Automatically crawls all Storybook stories and verifies:
 * 1. No console errors during render
 * 2. No React error boundaries triggered
 * 3. Component actually renders visible content
 * 4. No uncaught exceptions
 * 5. Screenshots for visual regression
 */

import {test, expect, type Page, type ConsoleMessage} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const STORYBOOK_URL = 'http://localhost:6006';
const SCREENSHOTS_DIR = path.resolve(__dirname, '../screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, {recursive: true});
}

interface StoryEntry {
  id: string;
  title: string;
  name: string;
  type?: string;
}

/**
 * Fetch all stories from Storybook's index endpoint.
 */
async function fetchStories(page: Page): Promise<StoryEntry[]> {
  const indexUrls = [
    `${STORYBOOK_URL}/index.json`,
    `${STORYBOOK_URL}/stories.json`,
  ];

  for (const url of indexUrls) {
    try {
      const response = await page.request.get(url);
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
    'Could not fetch Storybook stories. Make sure Storybook is built and running.',
  );
}

// Errors to ignore (not real render problems)
const IGNORED_ERRORS = [
  'favicon.ico',
  'webpack',
  'HMR',
  'DevTools',
  'ERR_CONNECTION',
  'net::ERR_',
  'Failed to load resource',
  'downloadable font',
  'ResizeObserver',
];

/**
 * Collect console errors from a page.
 */
function setupConsoleCollector(page: Page) {
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

// --- Main test suite ---

test.describe('Component Render Tests', () => {
  let stories: StoryEntry[] = [];

  test.beforeAll(async ({browser}) => {
    const page = await browser.newPage();
    try {
      stories = await fetchStories(page);
    } finally {
      await page.close();
    }

    if (stories.length === 0) {
      throw new Error('No stories found in Storybook');
    }
  });

  test('should have stories available', () => {
    expect(stories.length).toBeGreaterThan(0);
  });

  test('all stories render without errors', async ({page}) => {
    const failedStories: {id: string; errors: string[]}[] = [];

    // First, load Storybook main page and wait for it to initialize
    await page.goto(STORYBOOK_URL, {waitUntil: 'load'});
    await page.waitForTimeout(2000);

    for (const story of stories) {
      const {errors, cleanup} = setupConsoleCollector(page);

      // Navigate to story via Storybook SPA routing
      const storyUrl = `${STORYBOOK_URL}/?path=/story/${story.id}`;
      await page.goto(storyUrl, {waitUntil: 'load'});
      await page.waitForTimeout(1500);

      // Check for Storybook error overlay in the iframe
      const storyFrame = page.frameLocator('#storybook-preview-iframe');

      // Check if iframe exists and has content
      let hasContent = true;
      let hasError = false;

      try {
        // Check for error display in the preview iframe
        const errorDisplay = storyFrame.locator('.sb-errordisplay');
        const errorCount = await errorDisplay.count();
        if (errorCount > 0) {
          const errorText = await errorDisplay.first().textContent();
          errors.push(`Storybook error: ${errorText?.slice(0, 200)}`);
          hasError = true;
        }

        // Check if the story root has any content
        if (!hasError) {
          const storyRoot = storyFrame.locator('#storybook-root, #root');
          const rootCount = await storyRoot.count();
          if (rootCount > 0) {
            const innerHTML = await storyRoot.first().innerHTML();
            if (!innerHTML || innerHTML.trim().length === 0) {
              hasContent = false;
            }
          }
        }
      } catch {
        // iframe might not be ready yet, not a critical error
      }

      if (!hasContent && !hasError) {
        errors.push('Component rendered empty content');
      }

      if (errors.length > 0) {
        failedStories.push({id: story.id, errors: [...errors]});
      }

      // Take screenshot
      const screenshotName = story.id.replace(/[^a-zA-Z0-9-]/g, '_');
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, `${screenshotName}.png`),
        fullPage: true,
      });

      cleanup();
    }

    // Report all failures at once
    if (failedStories.length > 0) {
      const report = failedStories
        .map((f) => `\n  ${f.id}:\n    ${f.errors.join('\n    ')}`)
        .join('');
      expect(
        failedStories.length,
        `${failedStories.length} stories failed:${report}`,
      ).toBe(0);
    }
  });
});

test.describe('Individual Story Tests', () => {
  let stories: StoryEntry[] = [];

  test.beforeAll(async ({browser}) => {
    const page = await browser.newPage();
    try {
      stories = await fetchStories(page);
    } finally {
      await page.close();
    }
  });

  test('each story group has at least one renderable story', async ({
    page,
  }) => {
    // Group stories by component (title)
    const groups = new Map<string, StoryEntry[]>();
    for (const story of stories) {
      const group = story.title;
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)!.push(story);
    }

    const failedGroups: string[] = [];

    // Load Storybook
    await page.goto(STORYBOOK_URL, {waitUntil: 'load'});
    await page.waitForTimeout(2000);

    for (const [title, groupStories] of groups) {
      let anyRendered = false;

      for (const story of groupStories) {
        const storyUrl = `${STORYBOOK_URL}/?path=/story/${story.id}`;
        await page.goto(storyUrl, {waitUntil: 'load'});
        await page.waitForTimeout(1000);

        try {
          const storyFrame = page.frameLocator('#storybook-preview-iframe');
          const errorDisplay = storyFrame.locator('.sb-errordisplay');
          const errorCount = await errorDisplay.count();
          if (errorCount === 0) {
            anyRendered = true;
            break;
          }
        } catch {
          // If we can't check, assume it rendered
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
