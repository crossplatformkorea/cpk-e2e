/**
 * Component Discovery
 *
 * Parses cpk-ui's source code to find all exported components.
 * Uses Storybook's index.json when available for accurate story mapping.
 *
 * Usage: tsx scripts/discover-components.ts [--json]
 */

import * as fs from 'fs';
import * as path from 'path';
import config from '../cpk-e2e.config';

const CPK_UI_ROOT = path.resolve(__dirname, '..', config.targetRoot);
const INDEX_PATH = path.join(CPK_UI_ROOT, config.indexPath);
const STORYBOOK_STATIC = path.join(CPK_UI_ROOT, config.storybookStaticPath);

export interface ComponentInfo {
  name: string;
  category: string;
  sourcePath: string;
  hasStory: boolean;
  hasTest: boolean;
  isComponent: boolean;
}

export interface StoryInfo {
  id: string;
  title: string;
  name: string;
  type: string;
}

/**
 * Get story titles from built Storybook index.json.
 */
export function getStorybookIndex(): StoryInfo[] {
  const indexPaths = [
    path.join(STORYBOOK_STATIC, 'index.json'),
    path.join(STORYBOOK_STATIC, 'stories.json'),
  ];

  for (const p of indexPaths) {
    if (fs.existsSync(p)) {
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        const entries = data.entries || data.stories || {};
        return Object.values(
          entries as Record<string, StoryInfo>,
        ).filter((e) => e.type === 'story');
      } catch {
        continue;
      }
    }
  }

  return [];
}

/**
 * Parse cpk-ui/src/index.tsx to extract all exports.
 * Distinguishes actual React components from types/interfaces/hooks/utils.
 */
export function discoverExports(): ComponentInfo[] {
  const content = fs.readFileSync(INDEX_PATH, 'utf8');
  const results: ComponentInfo[] = [];
  const storybookStories = getStorybookIndex();

  // Match: export * from './path'
  // Match: export {Foo} from './path'
  // Match: export type {Foo} from './path'
  const exportRegex =
    /export\s+(?:type\s+)?(?:\{([^}]+)\}|\*)\s+from\s+['"]([^'"]+)['"]/g;

  let match: RegExpExecArray | null;
  while ((match = exportRegex.exec(content)) !== null) {
    const exports = match[1];
    const fromPath = match[2];
    const category = resolveCategory(fromPath);

    if (exports) {
      // Named exports
      const names = exports
        .split(',')
        .map((n) => n.trim())
        .map((n) => {
          const asMatch = n.match(/(?:default\s+as|(\w+)\s+as)\s+(\w+)/);
          if (asMatch) return asMatch[2];
          return n;
        })
        .filter((n) => n && n !== 'default');

      for (const name of names) {
        const sourcePath = resolveSourcePath(fromPath);
        const isComp = isActualComponent(name, sourcePath, category);
        results.push({
          name,
          category,
          sourcePath,
          hasStory: checkHasStoryFromIndex(name, sourcePath, storybookStories),
          hasTest: checkHasTest(name, sourcePath),
          isComponent: isComp,
        });
      }
    } else {
      // Star export: export * from '...'
      const sourcePath = resolveSourcePath(fromPath);
      const starExports = resolveStarExports(sourcePath);

      for (const exp of starExports) {
        const isComp = isActualComponent(exp.name, sourcePath, category);
        results.push({
          name: exp.name,
          category,
          sourcePath,
          hasStory: checkHasStoryFromIndex(
            exp.name,
            sourcePath,
            storybookStories,
          ),
          hasTest: checkHasTest(exp.name, sourcePath),
          isComponent: exp.isType ? false : isComp,
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

interface StarExport {
  name: string;
  isType: boolean;
}

function resolveStarExports(filePath: string): StarExport[] {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const results: StarExport[] = [];

    // Types and interfaces
    const typeMatches = content.matchAll(
      /export\s+(?:type|interface)\s+(\w+)/g,
    );
    for (const m of typeMatches) {
      results.push({name: m[1], isType: true});
    }

    // Actual value exports (const, function, class, enum)
    const valueMatches = content.matchAll(
      /export\s+(?:const|function|class|enum)\s+(\w+)/g,
    );
    for (const m of valueMatches) {
      results.push({name: m[1], isType: false});
    }

    // export default function/const/class
    const defaultMatch = content.match(
      /export\s+default\s+(?:function|class)\s+(\w+)/,
    );
    if (defaultMatch) {
      results.push({name: defaultMatch[1], isType: false});
    }

    // export default React.memo(Name) / export default memo(Name)
    const memoDefaultMatch = content.match(
      /export\s+default\s+(?:React\.)?memo\((?:forwardRef[^(]*\()?(\w+)/,
    );
    if (memoDefaultMatch) {
      const name = memoDefaultMatch[1];
      if (!results.some((r) => r.name === name)) {
        results.push({name, isType: false});
      }
    }

    // Named re-exports without 'from': export {Name} or export {A as B}
    const namedExportMatches = content.matchAll(
      /export\s+(type\s+)?\{([^}]+)\}(?!\s+from)/g,
    );
    for (const m of namedExportMatches) {
      const isType = !!m[1];
      const exports = m[2].split(',').map((n) => {
        const asMatch = n.trim().match(/(\w+)\s+as\s+(\w+)/);
        return asMatch ? asMatch[2] : n.trim();
      });
      for (const name of exports.filter(Boolean)) {
        if (!results.some((r) => r.name === name)) {
          results.push({name, isType});
        }
      }
    }

    // Re-exports: export {A, B} from './...'
    const reExportMatches = content.matchAll(
      /export\s+(type\s+)?\{([^}]+)\}\s+from/g,
    );
    for (const m of reExportMatches) {
      const isType = !!m[1];
      const exports = m[2].split(',').map((n) => {
        const asMatch = n.trim().match(/\w+\s+as\s+(\w+)/);
        return asMatch ? asMatch[1] : n.trim();
      });
      for (const name of exports.filter(Boolean)) {
        if (!results.some((r) => r.name === name)) {
          results.push({name, isType});
        }
      }
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Determine if a name is an actual React component (not a type, hook, or util).
 * Reads source file to check if it's exported as a function/const, not just a type.
 */
function isActualComponent(
  name: string,
  sourcePath: string,
  category: string,
): boolean {
  // Categories that are never components
  if (['hooks', 'utils', 'types', 'providers'].includes(category)) return false;

  // Hooks start with 'use'
  if (name.startsWith('use')) return false;

  // Must start with uppercase
  if (name[0] !== name[0].toUpperCase() || name[0] === name[0].toLowerCase()) {
    return false;
  }

  // Filter out obvious type names
  if (
    name.endsWith('Props') ||
    name.endsWith('Type') ||
    name.endsWith('Styles') ||
    name.endsWith('Options') ||
    name.endsWith('Context') ||
    name.endsWith('Ref') ||
    name.endsWith('Color') ||
    name.endsWith('Status') ||
    name.endsWith('Item') ||
    name.endsWith('Names')
  ) {
    return false;
  }

  // Check source file for actual component definition
  try {
    const content = fs.readFileSync(sourcePath, 'utf8');

    const compPatterns = [
      // export function Name / export default function Name
      new RegExp(`export\\s+(?:default\\s+)?function\\s+${name}\\b`),
      // export const Name = ...
      new RegExp(`export\\s+const\\s+${name}\\s*[:=]`),
      // export class Name
      new RegExp(`export\\s+class\\s+${name}\\b`),
      // const Name = ... (then exported separately)
      new RegExp(`(?:const|let|var)\\s+${name}\\s*[:=]`),
      // function Name(
      new RegExp(`function\\s+${name}\\s*[(<]`),
      // export {... as Name} or export {Name}
      new RegExp(`export\\s+\\{[^}]*\\b${name}\\b[^}]*\\}`),
      // export default React.memo(Name)
      new RegExp(`export\\s+default\\s+.*${name}`),
    ];

    return compPatterns.some((p) => p.test(content));
  } catch {
    return false;
  }
}

/**
 * Check if component has a story using Storybook index data.
 */
function checkHasStoryFromIndex(
  name: string,
  sourcePath: string,
  stories: StoryInfo[],
): boolean {
  const nameLower = name.toLowerCase();

  // Check Storybook index
  if (stories.some((s) => s.title.toLowerCase() === nameLower)) {
    return true;
  }

  // Check for story files on disk
  return checkHasStoryFile(name, sourcePath);
}

function checkHasStoryFile(name: string, sourcePath: string): boolean {
  const dir = path.dirname(sourcePath);
  const storyFiles = [
    path.join(dir, `${name}.stories.tsx`),
    path.join(dir, `${name}.stories.ts`),
  ];

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
    path.join(dir, '__tests__', `${name}.test.tsx`),
  ];

  const parentDir = path.basename(dir);
  testFiles.push(
    path.join(dir, `${parentDir}.test.tsx`),
    path.join(dir, `${parentDir}.test.ts`),
  );

  return testFiles.some((f) => fs.existsSync(f));
}

// --- CLI ---
if (require.main === module) {
  const components = discoverExports();
  const isJson = process.argv.includes('--json');

  if (isJson) {
    console.log(JSON.stringify(components, null, 2));
  } else {
    const reactComponents = components.filter((c) => c.isComponent);
    const types = components.filter(
      (c) =>
        !c.isComponent &&
        !c.name.startsWith('use') &&
        ['uis', 'modals', 'common'].includes(c.category),
    );
    const hooks = components.filter((c) => c.name.startsWith('use'));
    const other = components.filter(
      (c) =>
        !c.isComponent &&
        !c.name.startsWith('use') &&
        !['uis', 'modals', 'common'].includes(c.category),
    );

    console.log(`\n\x1b[1mCPK-UI Component Discovery\x1b[0m\n`);
    console.log(`${'─'.repeat(60)}`);

    console.log(`\n\x1b[36mReact Components (${reactComponents.length}):\x1b[0m`);
    for (const c of reactComponents) {
      const story = c.hasStory
        ? '\x1b[32m[story]\x1b[0m'
        : '\x1b[31m[no story]\x1b[0m';
      const test = c.hasTest
        ? '\x1b[32m[test]\x1b[0m'
        : '\x1b[31m[no test]\x1b[0m';
      console.log(
        `  ${c.name.padEnd(30)} ${c.category.padEnd(12)} ${story} ${test}`,
      );
    }

    if (hooks.length > 0) {
      console.log(`\n\x1b[36mHooks (${hooks.length}):\x1b[0m`);
      for (const h of hooks) {
        console.log(`  ${h.name}`);
      }
    }

    if (types.length > 0) {
      console.log(`\n\x1b[90mTypes/Interfaces (${types.length}):\x1b[0m`);
      for (const t of types) {
        console.log(`  \x1b[90m${t.name}\x1b[0m`);
      }
    }

    console.log(`\n${'─'.repeat(60)}`);
    console.log(
      `Total: ${reactComponents.length} components, ${hooks.length} hooks, ${types.length} types, ${other.length} other`,
    );
    console.log();
  }
}
