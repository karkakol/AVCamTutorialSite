// Loads content/collection.json and all pages into one site model.

import fs from 'node:fs';
import path from 'node:path';
import { createMarkdown } from './markdown.mjs';
import { parsePage } from './parse.mjs';

function guessKind(slug) {
  return /-build$/.test(slug) ? 'tutorial' : 'article';
}

/**
 * @param {object} opt  { root, fixtures }
 */
export function loadSite({ root, fixtures = false }) {
  const contentDir = path.join(root, 'content');
  const pagesDir = path.join(contentDir, 'pages');
  const fixturesDir = path.join(contentDir, 'fixtures');
  const notices = [];
  const md = createMarkdown();

  const collectionFile = path.join(contentDir, 'collection.json');
  let collection;
  try {
    collection = JSON.parse(fs.readFileSync(collectionFile, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read content/collection.json: ${error.message}`);
  }

  const chapters = (collection.chapters || []).map((chapter, index) => ({
    index,
    number: Number(chapter.number) || 0,
    title: chapter.title || `Chapter ${chapter.number}`,
    abstract: chapter.abstract || '',
    fixture: false,
    entries: (chapter.pages || []).map((p) => {
      const entry = typeof p === 'string' ? { slug: p } : p;
      return {
        slug: entry.slug,
        kind: entry.kind || guessKind(entry.slug),
        title: entry.title || entry.slug,
        file: path.join(pagesDir, `${entry.slug}.md`),
        page: null,
      };
    }),
  }));

  if (fixtures && fs.existsSync(fixturesDir)) {
    const files = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.md')).sort();
    if (files.length) {
      chapters.push({
        index: chapters.length,
        number: 0,
        title: 'Fixtures',
        abstract: 'Test pages for the site generator. They are not part of the real site.',
        fixture: true,
        entries: files.map((f) => ({
          slug: f.replace(/\.md$/, ''),
          kind: 'article',
          title: f,
          file: path.join(fixturesDir, f),
          page: null,
        })),
      });
    }
  }

  const pages = new Map();
  const listed = new Set();
  const entries = [];
  for (const chapter of chapters) {
    chapter.id = chapter.fixture ? 'fixtures' : chapter.number ? `chapter-${chapter.number}` : `part-${chapter.index + 1}`;
    for (const entry of chapter.entries) {
      entry.chapter = chapter;
      if (listed.has(entry.slug)) {
        notices.push({ level: 'error', message: `content/collection.json lists the page "${entry.slug}" more than once.` });
        continue;
      }
      listed.add(entry.slug);
      entries.push(entry);
      if (fs.existsSync(entry.file)) {
        const source = fs.readFileSync(entry.file, 'utf8').replace(/\r\n/g, '\n');
        const page = parsePage({ slug: entry.slug, source, file: entry.file, md });
        page.entry = entry;
        page.chapterInfo = chapter;
        entry.page = page;
        entry.kind = page.kind;
        entry.title = page.title;
        pages.set(entry.slug, page);
        if (!chapter.fixture && Number.isFinite(page.chapter) && page.chapter !== chapter.number) {
          page.problems.push({
            level: 'warning',
            line: 1,
            message: `Front matter: "chapter: ${page.chapter}", but content/collection.json lists this page in chapter ${chapter.number}.`,
          });
        }
      }
    }
  }

  // Pages on disk that the collection does not list.
  if (fs.existsSync(pagesDir)) {
    for (const f of fs.readdirSync(pagesDir)) {
      if (f.endsWith('.md') && !listed.has(f.replace(/\.md$/, ''))) {
        notices.push({ level: 'warning', message: `content/pages/${f} is not listed in content/collection.json. The site does not build it.` });
      }
    }
  }

  // The "Next" chain skips pages that are not written yet.
  const written = entries.filter((e) => e.page);
  written.forEach((entry, i) => {
    entry.page.next = written[i + 1] ? written[i + 1].page : null;
    entry.page.prev = written[i - 1] ? written[i - 1].page : null;
  });

  return {
    root,
    contentDir,
    collection,
    title: collection.title || 'Tutorial',
    shortTitle: collection.shortTitle || collection.title || 'Tutorial',
    abstract: collection.abstract || '',
    xcode: collection.xcode || '',
    chapters,
    entries,
    pages,
    listed,
    md,
    notices,
  };
}
