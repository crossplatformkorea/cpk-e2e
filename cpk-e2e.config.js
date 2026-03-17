"use strict";
/**
 * cpk-e2e Configuration
 *
 * Configure the target project paths and options.
 * This file can be customized for different React Native projects.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const config = {
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
exports.default = config;
