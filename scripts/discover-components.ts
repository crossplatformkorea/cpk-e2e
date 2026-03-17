/**
 * Component Discovery
 *
 * Parses cpk-ui's source code to find all exported components.
 * Outputs a JSON list of components with metadata.
 *
 * Usage: tsx scripts/discover-components.ts [--json]
 */

import * as fs from 'fs';
import * as path from 'path';

const CPK_UI_ROOT = path.resolve(__dirname, '../../cpk-ui');
const INDEX_PATH = path.join(CPK_UI_ROOT, 'src/index.tsx');

export interface ComponentInfo {
  name: string;
  category: string; // 'uis' | 'modals' | 'common' | 'providers' | 'hooks' | 'utils' | 'types'
  sourcePath: string;
  hasStory: boolean;
  hasTest: boolean;
  isComponent: boolean; // true for React components, false for hooks/utils/types
}

/**
 * Parse cpk-ui/src/index.tsx to extract all exports and their source paths.
 */
export function discoverExports(): ComponentInfo[] {
  const content = fs.readFileSync(INDEX_PATH, 'utf8');
  const results: ComponentInfo[] = [];

  // Match: export {Foo, Bar} from './path'
  // Match: export {default as Foo} from './path'
  // Match: export * from './path'
  // Match: export type {Foo} from './path'
  const exportRegex =
    /export\s+(?:type\s+)?(?:\{([^}]+)\}|\*)\s+from\s+['"]([^'"]+)['"]/g;

  let match: RegExpExecArray | null;
  while ((match = exportRegex.exec(content)) !== null) {
    const exports = match[1];
    const fromPath = match[2];

    // Determine category from path
    const category = resolveCategory(fromPath);

    if (exports) {
      // Named exports: export {A, B} from '...'
      const names = exports
        .split(',')
        .map((n) => n.trim())
        .map((n) => {
          // Handle "default as Foo" or "Foo as Bar"
          const asMatch = n.match(/(?:default\s+as|(\w+)\s+as)\s+(\w+)/);
          if (asMatch) return asMatch[2];
          return n;
        })
        .filter((n) => n && n !== 'default');

      for (const name of names) {
        const sourcePath = resolveSourcePath(fromPath);
        results.push({
          name,
          category,
          sourcePath,
          hasStory: checkHasStory(name, sourcePath),
          hasTest: checkHasTest(name, sourcePath),
          isComponent: isReactComponent(name, category),
        });
      }
    } else {
      // Star export: export * from '...'
      const sourcePath = resolveSourcePath(fromPath);
      const starExports = resolveStarExports(sourcePath);
      for (const name of starExports) {
        results.push({
          name,
          category,
          sourcePath,
          hasStory: checkHasStory(name, sourcePath),
          hasTest: checkHasTest(name, sourcePath),
          isComponent: isReactComponent(name, category),
        });
      }
    }
  }

  return results;
}

function resolveCategory(fromPath: string): string {
  if (fromPath.includes('/modals/')) return 'modals';
  if (fromPath.includes('/common/')) return 'common';
  if (fromPath.includes('/uis/')) return 'uis';
  if (fromPath.includes('/providers')) return 'providers';
  if (fromPath.includes('/hooks')) return 'hooks';
  if (fromPath.includes('/utils')) return 'utils';
  if (fromPath.includes('/types')) return 'types';
  return 'unknown';
}

function resolveSourcePath(fromPath: string): string {
  const srcDir = path.join(CPK_UI_ROOT, 'src');
  const resolved = path.resolve(srcDir, fromPath);
  const candidates = [
    resolved + '.ts',
    resolved + '.tsx',
    resolved + '/index.ts',
    resolved + '/index.tsx',
    resolved,
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return resolved;
}

function resolveStarExports(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const names: string[] = [];

    // Find export declarations
    const exportMatches = content.matchAll(
      /export\s+(?:const|function|class|type|interface|enum)\s+(\w+)/g,
    );
    for (const m of exportMatches) {
      names.push(m[1]);
    }

    // Find re-exports
    const reExportMatches = content.matchAll(
      /export\s+\{([^}]+)\}\s+from/g,
    );
    for (const m of reExportMatches) {
      const exports = m[1].split(',').map((n) => {
        const asMatch = n.trim().match(/\w+\s+as\s+(\w+)/);
        return asMatch ? asMatch[1] : n.trim();
      });
      names.push(...exports.filter(Boolean));
    }

    return names;
  } catch {
    return [];
  }
}

function checkHasStory(name: string, sourcePath: string): boolean {
  const dir = path.dirname(sourcePath);
  const storyFiles = [
    path.join(dir, `${name}.stories.tsx`),
    path.join(dir, `${name}.stories.ts`),
    path.join(dir, `${name}.stories.jsx`),
  ];

  // Also check by directory name
  const parentDir = path.basename(dir);
  storyFiles.push(
    path.join(dir, `${parentDir}.stories.tsx`),
    path.join(dir, `${parentDir}.stories.ts`),
  );

  return storyFiles.some((f) => fs.existsSync(f));
}

function checkHasTest(name: string, sourcePath: string): boolean {
  const dir = path.dirname(sourcePath);
  const testFiles = [
    path.join(dir, `${name}.test.tsx`),
    path.join(dir, `${name}.test.ts`),
    path.join(dir, `__tests__`, `${name}.test.tsx`),
  ];

  const parentDir = path.basename(dir);
  testFiles.push(
    path.join(dir, `${parentDir}.test.tsx`),
    path.join(dir, `${parentDir}.test.ts`),
  );

  return testFiles.some((f) => fs.existsSync(f));
}

function isReactComponent(name: string, category: string): boolean {
  if (['hooks', 'utils', 'types'].includes(category)) return false;
  // React components start with uppercase, hooks start with "use"
  if (name.startsWith('use')) return false;
  if (name[0] === name[0].toUpperCase() && name[0] !== name[0].toLowerCase()) {
    return true;
  }
  return false;
}

// --- CLI ---
if (require.main === module) {
  const components = discoverExports();
  const isJson = process.argv.includes('--json');

  if (isJson) {
    console.log(JSON.stringify(components, null, 2));
  } else {
    const reactComponents = components.filter((c) => c.isComponent);
    const hooks = components.filter((c) => c.name.startsWith('use'));
    const types = components.filter((c) => c.category === 'types');
    const utils = components.filter(
      (c) => !c.isComponent && !c.name.startsWith('use') && c.category !== 'types',
    );

    console.log(`\n\x1b[1mCPK-UI Component Discovery\x1b[0m\n`);
    console.log(`${'─'.repeat(60)}`);

    console.log(`\n\x1b[36mReact Components (${reactComponents.length}):\x1b[0m`);
    for (const c of reactComponents) {
      const story = c.hasStory ? '\x1b[32m[story]\x1b[0m' : '\x1b[31m[no story]\x1b[0m';
      const test = c.hasTest ? '\x1b[32m[test]\x1b[0m' : '\x1b[31m[no test]\x1b[0m';
      console.log(`  ${c.name.padEnd(30)} ${c.category.padEnd(12)} ${story} ${test}`);
    }

    if (hooks.length > 0) {
      console.log(`\n\x1b[36mHooks (${hooks.length}):\x1b[0m`);
      for (const h of hooks) {
        console.log(`  ${h.name}`);
      }
    }

    if (types.length > 0) {
      console.log(`\n\x1b[36mTypes (${types.length}):\x1b[0m`);
      for (const t of types) {
        console.log(`  ${t.name}`);
      }
    }

    console.log(`\n${'─'.repeat(60)}`);
    console.log(
      `Total: ${reactComponents.length} components, ${hooks.length} hooks, ${types.length} types, ${utils.length} utils`,
    );
    console.log();
  }
}
