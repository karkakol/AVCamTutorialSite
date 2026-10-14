// Turns one Markdown page (see docs/AUTHORING.md) into a page model.
// Structure problems are collected in `page.problems`; the parser never throws
// on bad content.

import { splitBlocks, headingText, soleImage, ASIDE_KINDS } from './markdown.mjs';
import { parseInfo } from './fence.mjs';
import { slugify, uniqueIds } from './util.mjs';

export const QUIZ_TITLE = 'Check your understanding';
const FRONT_MATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export function parseFrontMatter(source, problems) {
  const meta = {};
  const m = FRONT_MATTER_RE.exec(source);
  if (!m) {
    problems.push({ level: 'error', line: 1, message: 'The page has no front matter (a block between two "---" lines at the top).' });
    return { meta, body: source };
  }
  const lines = m[1].split(/\r?\n/);
  lines.forEach((raw, index) => {
    const line = raw.replace(/\s{2,}#.*$/, '').trim();
    if (!line || line.startsWith('#')) return;
    const kv = /^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) {
      problems.push({ level: 'error', line: index + 2, message: `Front matter: this line is not a "key: value" pair: ${raw.trim()}` });
      return;
    }
    let value = kv[2].trim();
    if (/^".*"$/.test(value) || /^'.*'$/.test(value)) value = value.slice(1, -1);
    meta[kv[1]] = value;
  });
  // Keep the line count, so that token line numbers equal file line numbers.
  const blank = m[0].replace(/[^\n]/g, '');
  return { meta, body: blank + source.slice(m[0].length) };
}

/**
 * @param {object} args
 * @param {string} args.slug
 * @param {string} args.source   The Markdown text of the page.
 * @param {string} args.file     The path of the file (for messages).
 * @param {import('markdown-it')} args.md
 */
export function parsePage({ slug, source, file, md }) {
  const problems = [];
  const { meta: raw, body } = parseFrontMatter(source, problems);
  const env = {};
  const tokens = md.parse(body, env);
  const makeId = uniqueIds();

  const page = {
    slug,
    file,
    source,
    kind: raw.kind === 'tutorial' ? 'tutorial' : 'article',
    chapter: Number(raw.chapter),
    title: raw.title || slug,
    abstract: raw.abstract || '',
    estimatedMinutes: Number(raw.estimatedMinutes) || 0,
    startBranch: raw.startBranch || null,
    branch: raw.branch || null,
    uncovered: (raw.uncovered || '').split(',').map((s) => s.trim()).filter(Boolean),
    raw,
    env,
    problems,
    intro: [],
    body: [], // article: tokens
    headings: [], // article: [{ id, title }]
    sections: [], // tutorial
    quiz: null,
    fences: [], // every code fence with file=
    images: [], // [{ src, line }]
    links: [], // [{ href, line }]
    anchors: new Set(),
    stepCount: 0,
  };

  checkFrontMatter(page, raw);
  collectRefs(page, tokens);

  const blocks = splitBlocks(tokens);
  const firstH2 = blocks.findIndex((b) => b.type === 'heading' && b.tag === 'h2');
  const introBlocks = firstH2 === -1 ? blocks : blocks.slice(0, firstH2);
  const rest = firstH2 === -1 ? [] : blocks.slice(firstH2);
  page.intro = flatten(introBlocks);

  // Groups: one per `##` heading.
  const groups = [];
  for (const block of rest) {
    if (block.type === 'heading' && block.tag === 'h2') {
      groups.push({ heading: block, title: headingText(block), line: block.line, blocks: [] });
    } else {
      groups[groups.length - 1].blocks.push(block);
    }
  }

  const ctx = { page, makeId, md };

  if (page.kind === 'tutorial') {
    if (introBlocks.some((b) => b.type === 'heading')) {
      problems.push({ level: 'error', line: introBlocks.find((b) => b.type === 'heading').line, message: 'A "###" heading comes before the first "##" section.' });
    }
    for (const group of groups) {
      if (isQuizTitle(group.title)) {
        page.quiz = parseQuiz(group, ctx);
      } else {
        if (page.quiz) {
          problems.push({ level: 'error', line: group.line, message: `The section "${group.title}" comes after the quiz. The quiz must be the last part of the page.` });
        }
        page.sections.push(parseSection(group, ctx));
      }
    }
    if (page.sections.length === 0) {
      problems.push({ level: 'error', line: 1, message: 'A tutorial page needs at least one "##" section with steps.' });
    }
  } else {
    const bodyTokens = [];
    for (const group of groups) {
      if (isQuizTitle(group.title)) {
        page.quiz = parseQuiz(group, ctx);
        continue;
      }
      const id = makeId(slugify(group.title));
      group.heading.tokens[0].attrSet('id', id);
      page.headings.push({ id, title: plainTitle(group.heading, md, env) });
      bodyTokens.push(...group.heading.tokens);
      for (const block of group.blocks) {
        if (block.type === 'heading' && block.tag === 'h3') {
          block.tokens[0].attrSet('id', makeId(slugify(headingText(block))));
        }
        collectFences(page, block, { where: `section "${group.title}"` });
        bodyTokens.push(...block.tokens);
      }
    }
    for (const block of introBlocks) collectFences(page, block, { where: 'intro' });
    page.body = bodyTokens;
  }

  if (page.quiz) page.anchors.add(page.quiz.id);
  for (const h of page.headings) page.anchors.add(h.id);
  for (const t of tokens) {
    if (t.type === 'heading_open' && t.attrGet('id')) page.anchors.add(t.attrGet('id'));
  }
  return page;
}

function isQuizTitle(title) {
  return title.trim().toLowerCase() === QUIZ_TITLE.toLowerCase();
}

function plainTitle(headingBlock, md, env) {
  const inline = headingBlock.tokens[1];
  return md.renderer.renderInlineAsText(inline.children || [], md.options, env).trim();
}

function flatten(blocks) {
  return blocks.flatMap((b) => b.tokens);
}

function checkFrontMatter(page, raw) {
  const err = (message) => page.problems.push({ level: 'error', line: 1, message: `Front matter: ${message}` });
  if (raw.kind !== 'tutorial' && raw.kind !== 'article') err('"kind" must be "tutorial" or "article".');
  if (raw.chapter === undefined || !/^\d+$/.test(raw.chapter)) err('"chapter" must be a number (0 for welcome and wrap-up).');
  if (!raw.title) err('"title" is missing.');
  if (!raw.abstract) err('"abstract" is missing.');
  if (!/^\d+$/.test(raw.estimatedMinutes || '')) err('"estimatedMinutes" must be a number.');
  if (raw.kind === 'tutorial') {
    if (!raw.startBranch) err('"startBranch" is missing (tutorial pages need it).');
    if (!raw.branch) err('"branch" is missing (tutorial pages need it).');
  }
  const known = ['kind', 'chapter', 'title', 'abstract', 'estimatedMinutes', 'startBranch', 'branch', 'uncovered'];
  for (const key of Object.keys(raw)) {
    if (!known.includes(key)) page.problems.push({ level: 'warning', line: 1, message: `Front matter: the key "${key}" is not part of the format. The site ignores it.` });
  }
}

/** Finds every image and link (for validation rule 5). */
function collectRefs(page, tokens) {
  for (const token of tokens) {
    const line = token.map ? token.map[0] + 1 : 0;
    if (token.type === 'inline' && token.children) {
      for (const child of token.children) {
        if (child.type === 'image') page.images.push({ src: child.attrGet('src') || '', line });
        if (child.type === 'link_open') page.links.push({ href: child.attrGet('href') || '', line });
      }
    }
    if (token.type === 'fence' && parseInfo(token.info).lang === 'links') {
      token.content.split('\n').forEach((raw, i) => {
        if (!raw.trim()) return;
        const parts = raw.split('|').map((s) => s.trim());
        if (parts.length < 2 || !parts[1]) {
          page.problems.push({ level: 'error', line: line + 1 + i, message: `A line in a "links" block must be "Title | URL | Description". Found: ${raw.trim()}` });
        } else {
          page.links.push({ href: parts[1], line: line + 1 + i });
        }
      });
    }
  }
}

/** Makes a fence object from a fence token and stores it on the token. */
function makeFence(page, token, where) {
  const info = parseInfo(token.info);
  const text = token.content.replace(/\n$/, '');
  const fence = {
    info,
    lang: info.lang,
    file: info.file,
    lines: text === '' ? [] : text.split('\n'),
    line: token.map ? token.map[0] + 1 : 0, // the line of the opening ```
    highlight: [],
    isNew: info.isNew,
    remove: info.remove,
    transient: info.transient,
    copy: Boolean(info.copy),
    results: info.results || [],
    where,
    // Filled by the analysis (analyze.mjs):
    map: null, // file line of each fence line (0 = not found)
    numbers: null, // the line numbers to show
    fileKey: null, // set when the whole file is available on the branch
  };
  for (const r of fence.results) page.images.push({ src: r.src, line: fence.line });
  const count = fence.lines.length;
  if (info.badHighlight) {
    page.problems.push({ level: 'error', line: fence.line, where: where.where, step: where.step, message: `highlight="${info.highlightRaw}" is not valid. Use line numbers and ranges, for example highlight=4-6,9.` });
  }
  if (fence.isNew) {
    fence.highlight = fence.lines.map((_, i) => i + 1);
  } else if (!fence.remove) {
    const outside = info.highlight.filter((n) => n > count);
    if (outside.length) {
      page.problems.push({ level: 'error', line: fence.line, where: where.where, step: where.step, message: `highlight= names line ${outside.join(', ')}, but the fence has only ${count} lines.` });
    }
    fence.highlight = info.highlight.filter((n) => n <= count);
  }
  if (info.unknown) {
    page.problems.push({ level: 'warning', line: fence.line, where: where.where, step: where.step, message: `The fence has an attribute that the site does not know: "${info.unknown}".` });
  }
  token.meta = { ...(token.meta || {}), fence };
  if (fence.file) page.fences.push(fence);
  return fence;
}

const SPECIAL_LANGS = new Set(['links', 'settings']);

function collectFences(page, block, where) {
  for (const token of block.tokens) {
    if (token.type !== 'fence') continue;
    const info = parseInfo(token.info);
    if (SPECIAL_LANGS.has(info.lang)) continue;
    makeFence(page, token, where);
  }
}

function parseSettings(token) {
  const info = parseInfo(token.info);
  const rows = token.content
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => {
      const at = l.indexOf(': ');
      if (at === -1) return l.endsWith(':') ? { key: l.slice(0, -1).trim(), value: '' } : { key: '', value: l.trim() };
      return { key: l.slice(0, at).trim(), value: l.slice(at + 2).trim() };
    });
  return { type: 'settings', title: info.title || 'Settings', rows, results: info.results || [], line: token.map ? token.map[0] + 1 : 0 };
}

function parseSection(group, ctx) {
  const { page, makeId } = ctx;
  const number = page.sections.length + 1;
  const id = makeId(slugify(group.title));
  page.anchors.add(id);
  const section = {
    number,
    id,
    title: plainTitle(group.heading, ctx.md, page.env),
    titleTokens: group.heading.tokens[1].children,
    line: group.line,
    intro: [],
    media: null,
    items: [],
  };
  const where = `section ${number} "${section.title}"`;
  const problem = (level, line, message, step) => page.problems.push({ level, line, where, step, message });

  // Split by `###` headings.
  const parts = [{ heading: null, blocks: [] }];
  for (const block of group.blocks) {
    if (block.type === 'heading' && block.tag === 'h3') parts.push({ heading: block, blocks: [] });
    else if (block.type === 'heading') {
      problem('error', block.line, `A tutorial section can only have "###" headings. Found <${block.tag}> "${headingText(block)}".`);
      parts[parts.length - 1].blocks.push(block);
    } else parts[parts.length - 1].blocks.push(block);
  }

  // Section intro: paragraphs and one optional image.
  for (const block of parts[0].blocks) {
    const image = soleImage(block);
    if (image && !section.media) {
      section.media = { src: image.attrGet('src'), alt: image.content, line: block.line };
    } else {
      if (image) problem('warning', block.line, 'A section intro can have one image. The site shows the second image inside the text.');
      collectFences(page, block, { where });
      section.intro.push(...block.tokens);
    }
  }

  let stepNumber = 0;
  for (const part of parts.slice(1)) {
    const title = headingText(part.heading);
    const key = title.toLowerCase();
    if (key === 'step') {
      stepNumber += 1;
      const step = parseStep(part, { ...ctx, section, number: stepNumber, where });
      section.items.push(step);
      page.anchors.add(step.id);
      if (step.after.length) section.items.push({ type: 'text', tokens: step.after, line: step.line });
    } else if (ASIDE_KINDS[key]) {
      for (const b of part.blocks) collectFences(page, b, { where });
      section.items.push({ type: 'aside', kind: key, tokens: flatten(part.blocks), line: part.heading.line });
      if (part.blocks.length === 0) problem('error', part.heading.line, `The "### ${title}" aside has no text.`);
    } else if (key === 'text') {
      for (const b of part.blocks) collectFences(page, b, { where });
      section.items.push({ type: 'text', tokens: flatten(part.blocks), line: part.heading.line });
      if (part.blocks.length === 0) problem('error', part.heading.line, 'The "### Text" block has no text.');
    } else {
      problem('error', part.heading.line, `"### ${title}" is not a known heading. Use "### Step", "### Note", "### Tip", "### Important", "### Experiment", or "### Text".`);
      for (const b of part.blocks) collectFences(page, b, { where });
      section.items.push({ type: 'text', tokens: [...part.heading.tokens, ...flatten(part.blocks)], line: part.heading.line });
    }
  }
  if (stepNumber === 0) problem('error', group.line, 'The section has no steps.');
  section.stepCount = stepNumber;
  page.stepCount += stepNumber;
  return section;
}

function parseStep(part, ctx) {
  const { page, section, number, where } = ctx;
  const step = {
    type: 'step',
    number,
    id: `step-${section.number}-${number}`,
    line: part.heading.line,
    instruction: [],
    caption: [],
    block: null, // { type: 'code', code, removes } | { type: 'settings', ... } | { type: 'image', ... }
    after: [],
  };
  const problem = (level, line, message) => page.problems.push({ level, line, where, step: number, message });
  const fenceWhere = { where, step: number };

  const removes = [];
  let seenBlock = false;
  let extraBlocks = 0;

  for (const block of part.blocks) {
    const token = block.tokens[0];
    let candidate = null;

    if (block.type === 'fence') {
      const info = parseInfo(token.info);
      if (info.lang === 'settings') {
        for (const r of info.results || []) page.images.push({ src: r.src, line: token.map ? token.map[0] + 1 : 0 });
        candidate = parseSettings(token);
      } else if (info.lang !== 'links') {
        const fence = makeFence(page, token, fenceWhere);
        if (!fence.file) problem('error', fence.line, 'The code fence of a step needs file=<path from the app repository root>.');
        if (fence.remove) {
          if (seenBlock) {
            problem('error', fence.line, 'A "remove" fence must come BEFORE the main code fence of the step.');
            step.after.push(...block.tokens);
          } else {
            removes.push(fence);
          }
          continue;
        }
        candidate = { type: 'code', code: fence, removes: [], line: fence.line };
      }
    } else {
      const image = soleImage(block);
      if (image) candidate = { type: 'image', src: image.attrGet('src'), alt: image.content, line: block.line };
    }

    if (candidate) {
      if (!seenBlock) {
        seenBlock = true;
        step.block = candidate;
      } else {
        extraBlocks += 1;
        step.after.push(...block.tokens);
      }
      continue;
    }

    if (seenBlock) {
      step.after.push(...block.tokens);
    } else if (step.instruction.length === 0 && block.type === 'paragraph') {
      step.instruction = block.tokens;
    } else {
      if (step.instruction.length === 0) {
        problem('error', block.line, 'A step must start with its instruction (a paragraph).');
      }
      step.caption.push(...block.tokens);
    }
  }

  if (step.instruction.length === 0) problem('error', step.line, 'The step has no instruction.');
  if (!step.block) {
    if (removes.length) problem('error', removes[0].line, 'The step has a "remove" fence but no main code fence. Add the code fence that shows the region after the change.');
    else problem('error', step.line, 'The step has no block. Each step needs exactly one block: a code fence, a settings fence, or an image.');
  } else {
    if (removes.length && step.block.type !== 'code') {
      problem('error', removes[0].line, 'A "remove" fence must be followed by the main code fence of the step.');
    } else if (step.block.type === 'code') {
      step.block.removes = removes;
      for (const r of removes) {
        if (r.file && step.block.code.file && r.file !== step.block.code.file) {
          problem('warning', r.line, `The "remove" fence names ${r.file}, but the main fence names ${step.block.code.file}.`);
        }
      }
    }
    if (extraBlocks) {
      problem('error', step.line, `The step has ${extraBlocks + 1} blocks. Each step must have exactly one block (a "remove" fence before the code fence does not count).`);
    } else if (step.after.length) {
      problem('warning', step.line, 'The step has text after its block. The site shows it as plain text between the steps. Use "### Text" or "### Note" for that.');
    }
  }
  return step;
}

function parseQuiz(group, ctx) {
  const { page, md } = ctx;
  const quiz = { id: slugify(QUIZ_TITLE), line: group.line, intro: [], questions: [] };
  const where = 'quiz';
  const parts = [{ heading: null, blocks: [] }];
  for (const block of group.blocks) {
    if (block.type === 'heading' && block.tag === 'h3') parts.push({ heading: block, blocks: [] });
    else parts[parts.length - 1].blocks.push(block);
  }
  quiz.intro = flatten(parts[0].blocks);

  parts.slice(1).forEach((part, index) => {
    const number = index + 1;
    const problem = (level, line, message) => page.problems.push({ level, line, where: `quiz question ${number}`, message });
    const question = { number, line: part.heading.line, titleTokens: part.heading.tokens[1].children, content: [], choices: [] };
    for (const block of part.blocks) {
      collectFences(page, block, { where: `quiz question ${number}` });
      if (block.type === 'bullet_list' && question.choices.length === 0) {
        question.choices = parseChoices(block, md, page.env, problem);
      } else if (question.choices.length === 0) {
        question.content.push(...block.tokens);
      } else {
        problem('warning', block.line, 'Text after the choices of a question is not shown.');
      }
    }
    if (question.choices.length < 2) problem('error', question.line, 'A question needs at least two choices ("- [ ] ..." and "- [x] ...").');
    const correct = question.choices.filter((c) => c.correct).length;
    if (question.choices.length && correct !== 1) {
      problem('error', question.line, `A question must have exactly one correct choice ("- [x]"). This question has ${correct}.`);
    }
    question.choices.forEach((choice, i) => {
      if (choice.explanation.length === 0) problem('error', choice.line, `Choice ${i + 1} has no explanation. Add an indented "> ..." line below the choice.`);
    });
    quiz.questions.push(question);
  });

  if (quiz.questions.length === 0) page.problems.push({ level: 'error', line: group.line, where, message: 'The quiz has no questions ("### Question text?").' });
  return quiz;
}

function parseChoices(listBlock, md, env, problem) {
  const tokens = listBlock.tokens;
  const choices = [];
  let i = 1;
  while (i < tokens.length - 1) {
    if (tokens[i].type !== 'list_item_open' || tokens[i].level !== 1) {
      i += 1;
      continue;
    }
    let end = i + 1;
    while (!(tokens[end].type === 'list_item_close' && tokens[end].level === 1)) end += 1;
    const inner = tokens.slice(i + 1, end);
    const choice = { correct: false, content: [], explanation: [], line: tokens[i].map ? tokens[i].map[0] + 1 : 0 };

    // Split the item into the choice content and the explanation (a block quote).
    let k = 0;
    while (k < inner.length) {
      const t = inner[k];
      if (t.type === 'blockquote_open' && t.level === 2) {
        let close = k + 1;
        while (!(inner[close].type === 'blockquote_close' && inner[close].level === 2)) close += 1;
        choice.explanation.push(...inner.slice(k + 1, close));
        k = close + 1;
      } else {
        choice.content.push(t);
        k += 1;
      }
    }

    const first = choice.content.find((t) => t.type === 'inline');
    const mark = first ? /^\[( |x|X)\][ \t]*/.exec(first.content) : null;
    if (!mark) {
      problem('error', choice.line, 'A choice must start with "[ ]" (wrong) or "[x]" (correct).');
    } else {
      choice.correct = mark[1].toLowerCase() === 'x';
      first.content = first.content.slice(mark[0].length);
      first.children = [];
      md.inline.parse(first.content, md, env, first.children);
    }
    choices.push(choice);
    i = end + 1;
  }
  return choices;
}
