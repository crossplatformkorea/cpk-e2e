#!/usr/bin/env node

/**
 * cpk-e2e CLI
 *
 * Usage:
 *   cpk-e2e discover [--json]          List all components in target project
 *   cpk-e2e check-coverage             Check story coverage
 *   cpk-e2e test [--headed]            Run Playwright render tests
 *   cpk-e2e run [--skip-build]         Full pipeline
 */

import {execSync} from 'child_process';
import * as path from 'path';

const args = process.argv.slice(2);
const command = args[0];

const SCRIPTS_DIR = path.resolve(__dirname);

function exec(cmd: string) {
  execSync(cmd, {stdio: 'inherit', cwd: process.cwd()});
}

switch (command) {
  case 'discover':
    exec(`node ${path.join(SCRIPTS_DIR, 'discover-components.js')} ${args.slice(1).join(' ')}`);
    break;

  case 'check-coverage':
    exec(`node ${path.join(SCRIPTS_DIR, 'check-coverage.js')}`);
    break;

  case 'test':
    exec(`npx playwright test ${args.slice(1).join(' ')}`);
    break;

  case 'run':
    exec(`node ${path.join(SCRIPTS_DIR, 'run-e2e.js')} ${args.slice(1).join(' ')}`);
    break;

  default:
    console.log(`
cpk-e2e - E2E render testing for React Native components

Commands:
  discover [--json]      List all components in target project
  check-coverage         Check story coverage
  test [--headed]        Run Playwright render tests
  run [--skip-build]     Full pipeline (discover + build + test)
`);
    break;
}
