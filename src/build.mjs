// Builds the static site into dist/.
//
//   node src/build.mjs              the real site
//   node src/build.mjs --fixtures   also the test pages in content/fixtures/
//   node src/build.mjs --quiet      print only problems

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadSite } from './lib/site.mjs';
import { openRepo } from './lib/repo.mjs';
import { analyzeSite } from './lib/analyze.mjs';
import { createCodeHighlighter } from './lib/highlight.mjs';
import { renderPage, renderOverview } from './lib/render.mjs';
import { fileDataName } from './lib/blocks.mjs';
import { faviconSvg } from './lib/icons.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let highlighterPromise = null;

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, entry.name);
    const b = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}

const LANG_BY_EXT = { swift: 'swift', plist: 'xml', entitlements: 'xml', json: 'json', xcconfig: 'text', md: 'markdown', h: 'objective-c', m: 'objective-c' };

export async function build({ fixtures = false, dev = false, quiet = false } = {}) {
  const started = Date.now();
  const dist = path.join(ROOT, 'dist');
  const site = loadSite({ root: ROOT, fixtures });
  const repo = openRepo(ROOT);
  const { notices } = analyzeSite(site, repo);

  highlighterPromise = highlighterPromise || createCodeHighlighter();
  site.highlight = (await highlighterPromise).highlight;

  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });

  // Assets
  const assetsDir = path.join(ROOT, 'src', 'assets');
  copyDir(assetsDir, path.join(dist, 'assets'));
  fs.writeFileSync(path.join(dist, 'assets', 'favicon.svg'), faviconSvg());
  const hash = crypto.createHash('sha1');
  for (const name of ['site.css', 'site.js']) hash.update(fs.readFileSync(path.join(assetsDir, name)));
  const options = { assetVersion: hash.digest('hex').slice(0, 8), dev };

  // Pages
  const out = { media: new Map(), files: new Map() };
  for (const page of site.pages.values()) {
    fs.writeFileSync(path.join(dist, `${page.slug}.html`), renderPage(site, page, out, options));
  }
  fs.writeFileSync(path.join(dist, 'index.html'), renderOverview(site, options));

  // Images that the pages use
  for (const [rel, abs] of out.media) {
    const target = path.join(dist, 'media', rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(abs, target);
  }

  // Whole files for the "View full file" dialog
  for (const [key, { branch, file }] of out.files) {
    const lines = repo.fileLines(branch, file);
    if (!lines) continue;
    const ext = file.split('.').pop().toLowerCase();
    const html = site.highlight(lines.join('\n'), LANG_BY_EXT[ext] || 'text');
    const data = { path: file, branch, lines: html };
    const target = path.join(dist, fileDataName(key));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `(window.__siteFiles = window.__siteFiles || {})[${JSON.stringify(key)}] = ${JSON.stringify(data)};\n`);
  }

  // Report
  const errors = [];
  const warnings = [];
  for (const n of [...site.notices, ...notices]) (n.level === 'error' ? errors : warnings).push(n);
  for (const page of site.pages.values()) {
    for (const p of page.problems) (p.level === 'error' ? errors : warnings).push(p);
  }
  if (!quiet) {
    const missing = site.entries.filter((en) => !en.page).length;
    console.log(
      `Built ${site.pages.size} ${site.pages.size === 1 ? 'page' : 'pages'} and the overview in ${Date.now() - started} ms -> dist/` +
        (missing ? ` (${missing} listed pages are not written yet)` : ''),
    );
    for (const n of [...site.notices, ...notices]) console.log(`${n.level === 'error' ? 'Error' : 'Warning'}: ${n.message}`);
    const pageErrors = errors.length - [...site.notices, ...notices].filter((n) => n.level === 'error').length;
    if (pageErrors > 0) {
      console.log(`The content has ${pageErrors} ${pageErrors === 1 ? 'error' : 'errors'}. Run "npm run validate${fixtures ? ' -- --fixtures' : ''}" to see them.`);
    }
  }
  return { site, errors, warnings };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  build({ fixtures: args.includes('--fixtures'), quiet: args.includes('--quiet') }).catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}
