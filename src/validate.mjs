// Checks the content against the rules in docs/AUTHORING.md.
//
//   node src/validate.mjs               all pages in content/pages/
//   node src/validate.mjs --fixtures    also content/fixtures/
//   node src/validate.mjs ch03-build    only the named pages
//   node src/validate.mjs --budget      also print content budget notes
//
// Exit code 1 when there is at least one error.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSite } from './lib/site.mjs';
import { openRepo } from './lib/repo.mjs';
import { analyzeSite } from './lib/analyze.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const only = args.filter((a) => !a.startsWith('--')).map((a) => a.replace(/\.md$/, ''));

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, text) => (useColor ? `\u001b[${code}m${text}\u001b[0m` : text);
const red = (t) => paint('31', t);
const yellow = (t) => paint('33', t);
const dim = (t) => paint('2', t);
const bold = (t) => paint('1', t);

let site;
try {
  site = loadSite({ root: ROOT, fixtures: flags.has('--fixtures') });
} catch (error) {
  console.error(red(`Error: ${error.message}`));
  process.exit(1);
}
const repo = openRepo(ROOT);
const { notices } = analyzeSite(site, repo);

let errorCount = 0;
let warningCount = 0;

for (const notice of [...site.notices, ...notices]) {
  if (notice.level === 'error') {
    errorCount += 1;
    console.log(`${red('error')}    ${notice.message}`);
  } else {
    warningCount += 1;
    console.log(`${yellow('warning')}  ${notice.message}`);
  }
}

for (const slug of only) {
  if (!site.pages.has(slug)) {
    errorCount += 1;
    console.log(`${red('error')}    There is no written page "${slug}".`);
  }
}

function wordCount(tokens) {
  return tokens
    .filter((t) => t.type === 'inline')
    .map((t) => t.content)
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

/** Notes from "Content budget for a tutorial page". They are never errors. */
function budgetNotes(page) {
  const notes = [];
  if (page.kind !== 'tutorial') return notes;
  const steps = page.sections.flatMap((s) => s.items.filter((i) => i.type === 'step').map((step) => ({ step, section: s })));
  if (page.sections.length < 3 || page.sections.length > 6) notes.push(`The page has ${page.sections.length} sections (budget: 3 to 6).`);
  if (steps.length < 25 || steps.length > 45) notes.push(`The page has ${steps.length} steps (budget: 25 to 45).`);
  for (const s of page.sections) {
    if (s.stepCount < 5 || s.stepCount > 10) notes.push(`Section ${s.number} has ${s.stepCount} steps (budget: 5 to 10).`);
  }
  let captions = 0;
  for (const { step, section } of steps) {
    const at = `Section ${section.number}, step ${step.number} (line ${step.line})`;
    const words = wordCount(step.instruction);
    if (words && (words < 9 || words > 25)) notes.push(`${at}: the instruction has ${words} words (budget: 9 to 25).`);
    if (step.caption.length) captions += 1;
    if (step.block?.type === 'code' && !step.block.code.isNew) {
      const count = step.block.code.highlight.length;
      if (count > 8) notes.push(`${at}: ${count} highlighted lines (budget: 1 to 8).`);
    }
  }
  if (steps.length && captions * 2 < steps.length) notes.push(`${captions} of ${steps.length} steps have a caption (budget: at least half).`);
  const questions = page.quiz ? page.quiz.questions.length : 0;
  if (questions !== 3) notes.push(`The quiz has ${questions} questions (budget: 3).`);
  return notes;
}

const pages = [...site.pages.values()].filter((p) => only.length === 0 || only.includes(p.slug));
for (const page of pages) {
  const rel = path.relative(ROOT, page.file);
  const errors = page.problems.filter((p) => p.level === 'error');
  const warnings = page.problems.filter((p) => p.level !== 'error');
  errorCount += errors.length;
  warningCount += warnings.length;
  const notes = flags.has('--budget') ? budgetNotes(page) : [];
  if (page.problems.length === 0 && notes.length === 0) {
    console.log(`${bold(rel)}  ${dim('ok')}`);
    continue;
  }
  console.log(`\n${bold(rel)}`);
  for (const p of page.problems) {
    const level = p.level === 'error' ? red('error') : yellow('warning');
    const place = [p.line ? `line ${p.line}` : '', p.where || '', p.step ? `step ${p.step}` : ''].filter(Boolean).join(', ');
    console.log(`  ${level}${p.level === 'error' ? '  ' : ''} ${place ? dim(`[${place}]`) + ' ' : ''}${p.message}`);
  }
  for (const note of notes) console.log(`  ${dim('budget')}  ${note}`);
}

const notWritten = site.entries.filter((en) => !en.page).length;
console.log(
  `\n${pages.length} ${pages.length === 1 ? 'page' : 'pages'} checked` +
    (notWritten ? `, ${notWritten} listed pages are not written yet` : '') +
    `: ${errorCount ? red(`${errorCount} ${errorCount === 1 ? 'error' : 'errors'}`) : '0 errors'}, ${warningCount ? yellow(`${warningCount} ${warningCount === 1 ? 'warning' : 'warnings'}`) : '0 warnings'}.`,
);
process.exit(errorCount ? 1 : 0);
