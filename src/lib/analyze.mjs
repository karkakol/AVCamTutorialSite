// Checks that need the app repository, and the cross-page checks.
//
// - Finds each code fence in its file on the page's `branch` (line numbers
//   for the code panel, validation rule 2).
// - Coverage (rule 3): each added Swift line is a highlighted line in a step.
// - Images and internal links (rule 5).
//
// The build and the validator share this code.

import fs from 'node:fs';
import path from 'node:path';
import { align } from './align.mjs';

const blank = (text) => text.trim() === '';

/**
 * @param {object} site   { pages: Map<slug, page>, listed: Set<slug>, contentDir }
 * @param {object} repo   from openRepo()
 * @returns {{ notices: object[] }}  site-level warnings (not tied to a page line)
 */
export function analyzeSite(site, repo) {
  const notices = [];
  if (!repo.available) {
    notices.push({
      level: 'warning',
      message: `The app repository is not available at ${repo.dir}. Skipped: code fence checks (rule 2), coverage (rule 3), and real line numbers. Set APP_REPO to the path of the repository.`,
    });
  }
  const missingBranches = new Set();

  for (const page of site.pages.values()) {
    analyzeFences(page, repo, missingBranches);
    analyzeCoverage(page, repo, missingBranches);
    analyzeImages(page, site);
    analyzeLinks(page, site);
    page.problems.sort((a, b) => (a.line || 0) - (b.line || 0));
  }

  if (repo.available) {
    for (const branch of missingBranches) {
      notices.push({
        level: 'warning',
        message: `The branch "${branch}" does not exist in the app repository (${repo.dir}). Skipped the checks that need it.`,
      });
    }
  }
  return { notices };
}

function analyzeFences(page, repo, missingBranches) {
  const branch = page.branch;
  if (branch && repo.available && !repo.hasBranch(branch)) missingBranches.add(branch);
  const canCheck = Boolean(branch) && repo.hasBranch(branch);

  // The fences of one file are handled from the last step back to the first.
  // The lines that a later step adds (its highlighted lines) are not in the
  // learner's file at an earlier step, so the alignment can skip them freely.
  const laterByFile = new Map();

  for (const fence of [...page.fences].reverse()) {
    const count = fence.lines.length;
    fence.numbers = fence.lines.map((_, i) => i + 1);
    fence.map = new Array(count).fill(0);
    if (!canCheck || fence.remove) continue;

    const fileLines = repo.fileLines(branch, fence.file);
    const problem = (line, message) =>
      page.problems.push({ level: 'error', line, where: fence.where.where, step: fence.where.step, message });

    if (!fileLines) {
      if (!fence.transient) problem(fence.line, `The file ${fence.file} does not exist on the branch "${branch}".`);
      continue;
    }
    fence.fileKey = `${branch}:${fence.file}`;

    const isStep = fence.where.step !== undefined;
    if (!laterByFile.has(fence.file)) laterByFile.set(fence.file, new Set());
    const later = laterByFile.get(fence.file);
    const { map, unmatched } = align(fence.lines, fileLines, isStep ? later : undefined);
    fence.map = map;
    if (isStep) {
      for (const n of fence.highlight) if (map[n - 1]) later.add(map[n - 1]);
    }
    if (unmatched.length === 0 && !fence.isNew) {
      fence.numbers = map.slice();
    }
    if (fence.transient) continue;

    // Rule 2: each line exists in the file, in the same order.
    for (const index of unmatched) {
      const text = fence.lines[index];
      const elsewhere = fileLines.some((l) => l.replace(/\s+$/, '') === text.replace(/\s+$/, ''));
      const reason = blank(text)
        ? 'An empty line here has no partner in the file.'
        : elsewhere
          ? 'The line exists in the file, but not at this position (the order is different).'
          : 'The line does not exist in the file.';
      problem(
        fence.line + 1 + index,
        `Code line ${index + 1} of the fence is not in ${fence.file} on "${branch}". ${reason}\n      | ${text}`,
      );
    }
  }
}

function analyzeCoverage(page, repo, missingBranches) {
  if (page.kind !== 'tutorial' || !page.branch || !page.startBranch) return;
  if (repo.available && !repo.hasBranch(page.startBranch)) missingBranches.add(page.startBranch);
  const added = repo.addedSwiftLines(page.startBranch, page.branch);
  if (!added) return;

  // The file lines that the steps highlight.
  const covered = new Map(); // file -> Set<line>
  const stepFiles = new Set();
  for (const section of page.sections) {
    for (const item of section.items) {
      if (item.type !== 'step' || !item.block || item.block.type !== 'code') continue;
      const fence = item.block.code;
      if (!fence.file || !fence.map) continue;
      stepFiles.add(fence.file);
      if (!covered.has(fence.file)) covered.set(fence.file, new Set());
      for (const n of fence.highlight) {
        const fileLine = fence.map[n - 1];
        if (fileLine) covered.get(fence.file).add(fileLine);
      }
    }
  }

  const uncoveredFiles = new Set(page.uncovered);
  for (const [file, lines] of added) {
    if (uncoveredFiles.has(file)) continue;
    const have = covered.get(file) || new Set();
    const missing = lines.filter((l) => !blank(l.text) && !have.has(l.line));
    if (missing.length === 0) continue;
    const hint = stepFiles.has(file) ? '' : ' No step shows this file.';
    for (const l of missing) {
      page.problems.push({
        level: 'error',
        line: 0,
        where: 'coverage',
        message: `${file}:${l.line} is added between "${page.startBranch}" and "${page.branch}", but no step highlights it.${hint}\n      | ${l.text}`,
      });
    }
  }

  // Removed lines: each Swift line that the chapter removes must be in a `remove` fence of that file.
  const removed = repo.removedSwiftLines(page.startBranch, page.branch);
  if (removed) {
    const shown = new Map(); // file -> Set<trimmed text>
    for (const section of page.sections) {
      for (const item of section.items) {
        if (item.type !== 'step' || !item.block || item.block.type !== 'code') continue;
        for (const r of item.block.removes || []) {
          const file = r.file || item.block.code.file;
          if (!shown.has(file)) shown.set(file, new Set());
          for (const t of r.lines) shown.get(file).add(String(t).trim());
        }
      }
    }
    for (const [file, lines] of removed) {
      if (uncoveredFiles.has(file)) continue;
      const have = shown.get(file) || new Set();
      for (const l of lines) {
        if (blank(l.text) || have.has(l.text.trim())) continue;
        page.problems.push({
          level: 'error',
          line: 0,
          where: 'removed lines',
          message: `${file}: a line is removed between "${page.startBranch}" and "${page.branch}", but no "remove" fence shows it.\n      | ${l.text}`,
        });
      }
    }
  }

  // Each file in `uncovered:` must be explained on the page.
  const bodyText = page.source.replace(/^---[\s\S]*?\n---/, '');
  for (const file of page.uncovered) {
    const base = path.basename(file);
    if (!bodyText.includes(base) && !bodyText.includes(file)) {
      page.problems.push({
        level: 'warning',
        line: 1,
        where: 'front matter',
        message: `"uncovered" lists ${file}, but the page text does not name this file. Explain each uncovered file on the page.`,
      });
    }
  }
}

/** content-relative path of an image, or null when it is outside content/. */
export function resolveImage(page, src, contentDir) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//')) return { external: true };
  const clean = decodeURI(src.split('#')[0].split('?')[0]);
  const abs = path.resolve(path.dirname(page.file), clean);
  const rel = path.relative(contentDir, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return { abs, rel: null };
  return { abs, rel: rel.split(path.sep).join('/') };
}

function analyzeImages(page, site) {
  for (const image of page.images) {
    const info = resolveImage(page, image.src, site.contentDir);
    if (info.external) {
      page.problems.push({ level: 'error', line: image.line, message: `The image ${image.src} is not a local file. Put images in content/images/.` });
    } else if (!info.rel) {
      page.problems.push({ level: 'error', line: image.line, message: `The image ${image.src} is outside the content folder.` });
    } else if (!fs.existsSync(info.abs)) {
      page.problems.push({ level: 'error', line: image.line, message: `The image file does not exist: ${image.src} (looked for content/${info.rel}).` });
    }
  }
}

/**
 * Internal link forms: "#anchor", "slug", "slug.md", "slug.html", "./slug.md",
 * each with an optional "#anchor". "index" or "./" is the overview.
 */
export function resolveLink(page, href, site) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return { external: true, href };
  const [rawPath, anchor = ''] = href.split('#');
  let target = rawPath.replace(/^\.\//, '').replace(/^\/+/, '').replace(/\.(md|html)$/i, '');
  if (rawPath === '' ) target = page.slug;
  else if (target === '' || target === 'index') target = 'index';
  const suffix = anchor ? `#${anchor}` : '';
  if (target === 'index') return { href: `index.html${suffix}`, slug: 'index', anchor };
  if (rawPath === '') return { href: suffix || '#', slug: page.slug, anchor };
  if (site.pages.has(target)) return { href: `${target}.html${suffix}`, slug: target, anchor };
  if (site.listed.has(target)) return { missing: true, notWritten: true, slug: target, anchor };
  return { missing: true, slug: target, anchor };
}

function analyzeLinks(page, site) {
  for (const link of page.links) {
    if (!link.href) {
      page.problems.push({ level: 'error', line: link.line, message: 'A link has no target.' });
      continue;
    }
    const info = resolveLink(page, link.href, site);
    if (info.external) continue;
    if (info.missing && info.notWritten) {
      page.problems.push({ level: 'warning', line: link.line, message: `The link "${link.href}" goes to the page "${info.slug}", which is not written yet. The site shows the link as plain text.` });
    } else if (info.missing) {
      page.problems.push({ level: 'error', line: link.line, message: `The link "${link.href}" does not resolve. There is no page "${info.slug}". Use the form "ch03-build.md" or "ch03-build.md#section-id".` });
    } else if (info.anchor && info.slug !== 'index') {
      const target = site.pages.get(info.slug);
      if (target && !target.anchors.has(info.anchor)) {
        page.problems.push({ level: 'error', line: link.line, message: `The link "${link.href}" names the anchor "#${info.anchor}", but the page "${info.slug}" has no such heading or step.` });
      }
    }
  }
}
