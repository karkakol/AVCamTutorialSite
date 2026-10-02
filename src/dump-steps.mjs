// Prints the steps of all tutorial pages as JSON, for tools/replay.py.
//   node src/dump-steps.mjs > steps.json
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSite } from './lib/site.mjs';
import { openRepo } from './lib/repo.mjs';
import { analyzeSite } from './lib/analyze.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = loadSite({ root: ROOT, fixtures: false });
const repo = openRepo(ROOT);
analyzeSite(site, repo);

const text = (tokens) => (tokens || []).filter((t) => t.type === 'inline').map((t) => t.content).join(' ');
const out = [];
for (const page of site.pages.values()) {
  if (page.kind !== 'tutorial') continue;
  const sections = [];
  for (const section of page.sections) {
    const items = [];
    for (const item of section.items) {
      if (item.type !== 'step') {
        items.push({ type: item.type, text: text(item.tokens || item.content || []) });
        continue;
      }
      const entry = { type: 'step', number: item.number, line: item.line, instruction: text(item.instruction), caption: text(item.caption) };
      entry.block = item.block ? item.block.type : null;
      if (item.block && item.block.type === 'code') {
        const f = item.block.code;
        entry.file = f.file;
        entry.isNew = !!f.isNew;
        entry.transient = !!f.transient;
        entry.highlightFileLines = f.map ? f.highlight.map((n) => f.map[n - 1]).filter(Boolean) : [];
        entry.removes = (item.block.removes || []).map((r) => ({ file: r.file || f.file, lines: r.lines }));
      }
      items.push(entry);
    }
    sections.push({ number: section.number, title: section.title, items });
  }
  out.push({ slug: page.slug, startBranch: page.startBranch, branch: page.branch, uncovered: page.uncovered, sections });
}
console.log(JSON.stringify(out));
