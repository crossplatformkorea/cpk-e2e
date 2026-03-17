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
declare const config: CpkE2eConfig;
export default config;
