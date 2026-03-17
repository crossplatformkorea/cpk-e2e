/**
 * E2E Test Orchestrator
 *
 * Full pipeline:
 * 1. Discover components from cpk-ui
 * 2. Build Storybook (if not already built)
 * 3. Check story coverage
 * 4. Run Playwright render tests
 * 5. Generate report
 *
 * Usage: tsx scripts/run-e2e.ts [--skip-build] [--headed]
 */

import {execSync} from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const CPK_UI_ROOT = path.resolve(__dirname, '../../cpk-ui');
const STORYBOOK_STATIC = path.join(CPK_UI_ROOT, 'storybook-static');

const args = process.argv.slice(2);
const skipBuild = args.includes('--skip-build');
const headed = args.includes('--headed');

function log(icon: string, msg: string) {
  console.log(`${icon}  ${msg}`);
}

function exec(cmd: string, cwd = ROOT) {
  execSync(cmd, {cwd, stdio: 'inherit', timeout: 300_000});
}

async function main() {
  console.log('\n\x1b[1m🔍 CPK-UI E2E Test Runner\x1b[0m\n');
  console.log('─'.repeat(60));

  // Step 1: Discover components
  log('📦', 'Discovering components...');
  exec('npx tsx scripts/discover-components.ts');

  // Step 2: Build Storybook
  if (!skipBuild || !fs.existsSync(STORYBOOK_STATIC)) {
    log('🏗️', 'Building Storybook...');
    exec('STORYBOOK=1 npx storybook build', CPK_UI_ROOT);
  } else {
    log('⏭️', 'Skipping Storybook build (--skip-build)');
  }

  // Step 3: Check coverage
  log('📊', 'Checking story coverage...');
  try {
    exec('npx tsx scripts/check-coverage.ts');
  } catch {
    log('⚠️', 'Some components are missing stories (non-blocking)');
  }

  // Step 4: Run Playwright tests
  log('🎭', 'Running Playwright render tests...');
  const playwrightCmd = headed
    ? 'npx playwright test --headed'
    : 'npx playwright test';
  exec(playwrightCmd);

  // Step 5: Report
  console.log('\n' + '─'.repeat(60));
  log('✅', 'E2E tests complete! Run `bun run report` to view the HTML report.');
  console.log();
}

main().catch((err) => {
  console.error('\n\x1b[31m✗ E2E pipeline failed\x1b[0m');
  console.error(err.message);
  process.exit(1);
});
