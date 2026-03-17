/**
 * cpk-e2e Configuration
 *
 * Configure the target project paths and options.
 * This file can be customized for different React Native projects.
 */

export interface CpkE2eConfig {
  /** Path to the target UI library root (relative to this config file) */
  targetRoot: string;

  /** Path to the main index file that exports components (relative to targetRoot) */
  indexPath: string;

  /** Path to built Storybook static files (relative to targetRoot) */
  storybookStaticPath: string;

  /** Command to build Storybook in the target project */
  storybookBuildCommand: string;

  /** Port for serving Storybook */
  storybookPort: number;

  /** Console error patterns to ignore during testing */
  ignoredErrors: string[];
}

const config: CpkE2eConfig = {
  targetRoot: '../cpk-ui',
  indexPath: 'src/index.tsx',
  storybookStaticPath: 'storybook-static',
  storybookBuildCommand: 'STORYBOOK=1 npx storybook build -o storybook-static',
  storybookPort: 6006,
  ignoredErrors: [
    'favicon.ico',
    'webpack',
    'HMR',
    'DevTools',
    'ERR_CONNECTION',
    'net::ERR_',
    'Failed to load resource',
    'downloadable font',
    'ResizeObserver',
    'Download the React DevTools',
    'was not wrapped in act',
  ],
};

export default config;
