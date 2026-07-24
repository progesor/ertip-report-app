import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const mode = process.argv.includes('--write') ? 'write' : 'check';
const root = process.cwd();
const ignoredDirectories = new Set([
  '.git',
  '.next',
  'node_modules',
  'dist',
  'coverage',
  'playwright-report',
  'test-results',
]);
const textExtensions = new Set([
  '.css',
  '.json',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);
const exactTextFiles = new Set([
  '.env.example',
  '.gitattributes',
  '.gitignore',
  'Dockerfile',
]);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath)));
      continue;
    }

    const relativePath = path.relative(root, absolutePath);
    if (textExtensions.has(path.extname(entry.name)) || exactTextFiles.has(relativePath)) {
      files.push(absolutePath);
    }
  }

  return files;
}

function normalize(content) {
  const normalizedLines = content.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');
  const withoutTrailingWhitespace = normalizedLines.map((line) => line.replace(/[\t ]+$/u, ''));
  const joined = withoutTrailingWhitespace.join('\n');
  return joined.endsWith('\n') ? joined : `${joined}\n`;
}

const changedFiles = [];
for (const file of await collectFiles(root)) {
  const content = await readFile(file, 'utf8');
  const normalized = normalize(content);

  if (content === normalized) {
    continue;
  }

  const relativePath = path.relative(root, file);
  changedFiles.push(relativePath);
  if (mode === 'write') {
    await writeFile(file, normalized, 'utf8');
  }
}

if (mode === 'write') {
  console.log(`Formatted ${changedFiles.length} file(s).`);
} else if (changedFiles.length > 0) {
  console.error('Formatting violations:');
  for (const file of changedFiles) {
    console.error(`- ${file}`);
  }
  process.exitCode = 1;
} else {
  console.log('Formatting check passed.');
}
