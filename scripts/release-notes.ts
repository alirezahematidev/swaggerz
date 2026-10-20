/**
 * Prints the CHANGELOG.md section of one version, used as the body of the GitHub release.
 *
 * Usage: node scripts/release-notes.ts <version>   (a leading `v` is ignored)
 */
import { readFile } from 'node:fs/promises';

const version = process.argv[2]?.replace(/^v/, '');
if (version === undefined || version === '') {
  console.error('Usage: node scripts/release-notes.ts <version>');
  process.exit(2);
}

// Version headings look like "## 1.2.0", "## 1.2.0 (2026-01-31)" or "## [1.2.0](compare-url) (…)";
// section headings inside a version ("### Features") never start with a digit.
const VERSION_HEADING = /^#{1,3} \[?(\d+\.\d+\.\d+[^\]\s]*)/;

const lines = (await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8')).split('\n');
const start = lines.findIndex((line) => VERSION_HEADING.exec(line)?.[1] === version);
if (start === -1) {
  console.error(`CHANGELOG.md has no section for ${version}.`);
  process.exit(1);
}
const end = lines.findIndex((line, index) => index > start && VERSION_HEADING.test(line));
const notes = lines
  .slice(start + 1, end === -1 ? undefined : end)
  .join('\n')
  .trim();
console.log(notes === '' ? `Release ${version}.` : notes);
