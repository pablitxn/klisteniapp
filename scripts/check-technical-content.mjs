// Structural checks for documentation-only language changes. English fluency,
// translation accuracy and exception classification still require human review.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const args = process.argv.slice(2);
const value = flag => {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`${flag} requires a value`);
  return args[index + 1];
};
const base = value('--base');
const range = value('--commits');
const errors = [];
if (base) {
  git('rev-parse', '--verify', `${base}^{commit}`);
  const paths = git('diff', '--name-only', base, '--').split('\n').filter(Boolean);
  const additions = new Set(git('diff', '--name-only', '--diff-filter=A', base, '--').split('\n'));
  const auditFiles = new Set([
    'scripts/check-technical-content.mjs',
    'docs/english-pr-metadata-2026-10-13.json',
    'docs/english-audit-inventory-2026-10-13.json',
    'docs/english-branch-matrix-2026-10-13.json',
  ]);
  for (const path of paths) {
    if (!path.endsWith('.md') && !auditFiles.has(path)) {
      errors.push(`Outside documentation-only language scope: ${path}`);
      continue;
    }
    if (!path.endsWith('.md') || additions.has(path)) continue;
    const before = git('show', `${base}:${path}`);
    const after = readFileSync(path, 'utf8');
    for (const sha of new Set(before.match(/\b[a-f0-9]{40}\b/g) ?? [])) {
      if (!after.includes(sha)) errors.push(`Missing historical SHA ${sha} in ${path}`);
    }
  }
  console.log(`Checked ${paths.length} changed paths against ${base}; executable/product/evidence files preserved.`);
}
if (range) {
  const subjects = git('log', '--format=%s', range).split('\n').filter(Boolean);
  const conventional = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)\([a-z0-9][a-z0-9.-]*\)!?: \S.*$/;
  for (const subject of subjects) if (!conventional.test(subject)) errors.push(`Invalid Conventional Commit subject: ${subject}`);
  console.log(`Checked ${subjects.length} new commit subjects. English wording requires human judgment.`);
}
if (args.includes('--inventory')) {
  // Hints are advisory: accent-free Spanish can be missed; quotations, UI labels,
  // source titles and fixture values can match. Never translate based on this list.
  const hints = /[áéíóúñ¿¡]|\b(?:para|prueba|archivo|conserva|pendiente|validacion|verificar|correccion|reproducir)\b/i;
  const paths = git('ls-files', '*.md').split('\n').filter(Boolean);
  for (const path of paths) {
    const prose = readFileSync(path, 'utf8')
      .replace(/^```[^\n]*\n[\s\S]*?^```/gm, '')
      .replace(/`[^`]+`/g, '')
      .replace(/<a id="[^"]+"><\/a>/g, '');
    if (hints.test(prose)) console.log(`HUMAN REVIEW: ${path}`);
  }
  console.log(`Inventoried ${paths.length} tracked Markdown files. Hints do not certify English or classify exceptions.`);
}
if (!base && !range && !args.includes('--inventory')) throw new Error('Use --base REF, --commits RANGE or --inventory');
for (const error of errors) console.error(error);
if (errors.length) process.exitCode = 1;
