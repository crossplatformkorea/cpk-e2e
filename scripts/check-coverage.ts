/**
 * Story Coverage Checker
 *
 * Compares discovered React components against available Storybook stories
 * to find components missing E2E test coverage.
 *
 * Usage: tsx scripts/check-coverage.ts [--json]
 */

import {
  discoverExports,
  getStorybookIndex,
  type ComponentInfo,
} from './discover-components';

export interface CoverageReport {
  covered: ComponentInfo[];
  uncovered: ComponentInfo[];
  totalComponents: number;
  coveragePercent: number;
  storyCount: number;
}

function checkCoverage(): CoverageReport {
  const allExports = discoverExports();
  const components = allExports.filter((c) => c.isComponent);
  const stories = getStorybookIndex();

  // Get unique story titles (lowercased for matching)
  const storyTitles = new Set(stories.map((s) => s.title.toLowerCase()));
  const storyTitlesArray = Array.from(storyTitles);

  const covered: ComponentInfo[] = [];
  const uncovered: ComponentInfo[] = [];

  for (const comp of components) {
    const nameLower = comp.name.toLowerCase();

    const hasCoverage =
      comp.hasStory ||
      storyTitles.has(nameLower) ||
      // Check if a story title exactly matches the component name (case-insensitive)
      storyTitlesArray.some(
        (title) =>
          title.replace(/[-_]/g, '') === nameLower ||
          nameLower === title.replace(/[-_]/g, ''),
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
    storyCount: stories.length,
  };
}

// --- CLI ---
if (require.main === module) {
  const report = checkCoverage();
  const isJson = process.argv.includes('--json');

  if (isJson) {
    console.log(
      JSON.stringify(
        {
          totalComponents: report.totalComponents,
          coveredCount: report.covered.length,
          uncoveredCount: report.uncovered.length,
          coveragePercent: report.coveragePercent,
          storyCount: report.storyCount,
          covered: report.covered.map((c) => c.name),
          uncovered: report.uncovered.map((c) => c.name),
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`\n\x1b[1mStory Coverage Report\x1b[0m\n`);
    console.log('─'.repeat(60));
    console.log(`Stories found: ${report.storyCount}`);

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
}

export {checkCoverage};
