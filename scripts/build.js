#!/usr/bin/env node
/**
 * Pincer Build Script
 * Builds the extension for Chrome or Firefox
 */

import { execSync } from 'child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');

const target = process.argv[2] || 'chrome';

console.log(`Building Pincer for ${target}...`);

// Clean dist
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// Copy manifest
const manifestFile = target === 'firefox' ? 'manifest.firefox.json' : 'manifest.chrome.json';
cpSync(join(SRC, manifestFile), join(DIST, 'manifest.json'));

// Copy popup
mkdirSync(join(DIST, 'popup'), { recursive: true });
cpSync(join(SRC, 'popup/popup.html'), join(DIST, 'popup/popup.html'));
cpSync(join(SRC, 'popup/popup.css'), join(DIST, 'popup/popup.css'));

// Copy assets (create placeholder icons if not exist)
mkdirSync(join(DIST, 'assets/icons'), { recursive: true });

// Create placeholder icons (SVG data URIs converted to PNG would go here in production)
const iconSizes = [16, 48, 128];
for (const size of iconSizes) {
  // For now, create a simple placeholder file
  writeFileSync(
    join(DIST, `assets/icons/pincer-${size}.png`),
    Buffer.from('placeholder')
  );
}

// Compile TypeScript
console.log('Compiling TypeScript...');

// For now, just copy TS files as JS (in production, use esbuild or similar)
// This is a simplified build - real build would use esbuild/webpack

function copyAsJs(srcPath, destPath) {
  let content = readFileSync(srcPath, 'utf-8');
  
  // Simple TypeScript stripping (remove type annotations)
  // In production, use proper TypeScript compiler or esbuild
  content = content
    .replace(/: \w+(\[\])?\s*=/g, ' =')
    .replace(/: \w+(\[\])?\s*\)/g, ')')
    .replace(/: \w+(\[\])?\s*{/g, ' {')
    .replace(/: \w+(\[\])?\s*;/g, ';')
    .replace(/: Promise<[^>]+>/g, '')
    .replace(/as \w+/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/import type .+;?\n/g, '')
    .replace(/export type .+;?\n/g, '');
  
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, content);
}

// Copy and convert source files
copyAsJs(join(SRC, 'background/service-worker.ts'), join(DIST, 'background/service-worker.js'));
copyAsJs(join(SRC, 'content/content.ts'), join(DIST, 'content/content.js'));
copyAsJs(join(SRC, 'popup/popup.ts'), join(DIST, 'popup/popup.js'));
copyAsJs(join(SRC, 'lib/protocol.ts'), join(DIST, 'lib/protocol.js'));
copyAsJs(join(SRC, 'lib/connection.ts'), join(DIST, 'lib/connection.js'));
copyAsJs(join(SRC, 'lib/context.ts'), join(DIST, 'lib/context.js'));

console.log(`✓ Built to dist/ for ${target}`);
console.log(`\nTo load in ${target === 'firefox' ? 'Firefox' : 'Chrome'}:`);
if (target === 'firefox') {
  console.log('1. Open about:debugging#/runtime/this-firefox');
  console.log('2. Click "Load Temporary Add-on"');
  console.log('3. Select dist/manifest.json');
} else {
  console.log('1. Open chrome://extensions');
  console.log('2. Enable "Developer mode"');
  console.log('3. Click "Load unpacked"');
  console.log('4. Select the dist/ folder');
}
