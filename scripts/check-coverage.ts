/**
 * Story Coverage Checker
 *
 * Compares discovered components against available Storybook stories
 * to find components that are missing E2E test coverage.
 *
 * Usage: tsx scripts/check-coverage.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import {discoverExports, type ComponentInfo} from './discover-components';

const CPK_UI_ROOT = path.resolve(__dirname, '../../cpk-ui');
const STORYBOOK_STATIC = path.join(CPK_UI_ROOT, 'storybook-static');

interface CoverageReport {
  covered: ComponentInfo[];
  uncovered: ComponentInfo[];
  totalComponents: number;
  coveragePercent: number;
}

/**
 * Get list of story IDs from built Storybook.
 */
function getStorybookStories(): string[] {
  // Storybook generates an index.json (or stories.json) with all stories
  const indexPaths = [
    path.join(STORYBOOK_STATIC, 'index.json'),
    path.join(STORYBOOK_STATIC, 'stories.json'),
  ];

  for (const p of indexPaths) {
    if (fs.existsSync(p)) {
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        // Storybook 7+ uses data.entries, older uses data.stories
        const entries = data.entries || data.stories || {};
        return Object.keys(entries);
      } catch {
        continue;
      }
    }
  }

  // Fallback: scan for .stories files in src
  const stories: string[] = [];
  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name));
      } else if (entry.name.match(/\.stories\.(tsx?|jsx?)$/)) {
        const content = fs.readFileSync(path.join(dir, entry.name), 'utf8');
        // Extract story title
        const titleMatch = content.match(/title:\s*['"]([^'"]+)['"]/);
        if (titleMatch) {
          stories.push(titleMatch[1].toLowerCase().replace(/\//g, '-'));
        }
        // Extract component name from filename
        const compName = entry.name.replace(/\.stories\.(tsx?|jsx?)$/, '');
        stories.push(compName.toLowerCase());
      }
    }
  }
  walk(path.join(CPK_UI_ROOT, 'src'));
  return stories;
}

function checkCoverage(): CoverageReport {
  const components = discoverExports().filter((c) => c.isComponent);
  const stories = getStorybookStories();
  const storyNamesLower = stories.map((s) => s.toLowerCase());

  const covered: ComponentInfo[] = [];
  const uncovered: ComponentInfo[] = [];

  for (const comp of components) {
    const nameLower = comp.name.toLowerCase();
    const hasCoverage =
      comp.hasStory ||
      storyNamesLower.some(
        (s) => s.includes(nameLower) || nameLower.includes(s.replace(/-/g, '')),
      );

    if (hasCoverage) {
      covered.push(comp);
    } else {
      uncovered.push(comp);
    }
  }

  return {
    covered,
    uncovered,
    totalComponents: components.length,
    coveragePercent:
      components.length > 0
        ? Math.round((covered.length / components.length) * 100)
        : 100,
  };
}

// --- CLI ---
if (require.main === module) {
  const report = checkCoverage();

  console.log(`\n\x1b[1mStory Coverage Report\x1b[0m\n`);
  console.log('─'.repeat(60));

  if (report.uncovered.length > 0) {
    console.log(
      `\n\x1b[31mUncovered Components (${report.uncovered.length}):\x1b[0m`,
    );
    for (const c of report.uncovered) {
      console.log(`  \x1b[31m✗\x1b[0m ${c.name} (${c.category})`);
    }
  }

  if (report.covered.length > 0) {
    console.log(
      `\n\x1b[32mCovered Components (${report.covered.length}):\x1b[0m`,
    );
    for (const c of report.covered) {
      console.log(`  \x1b[32m✓\x1b[0m ${c.name} (${c.category})`);
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  const color = report.coveragePercent === 100 ? '\x1b[32m' : '\x1b[33m';
  console.log(
    `${color}Coverage: ${report.coveragePercent}%\x1b[0m (${report.covered.length}/${report.totalComponents} components)`,
  );
  console.log();

  if (report.coveragePercent < 100) {
    process.exit(1);
  }
}

export {checkCoverage, type CoverageReport};
