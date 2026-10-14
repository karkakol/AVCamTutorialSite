// HTML templates: page shell, top bar, overview, article page, tutorial page.

import fs from 'node:fs';
import path from 'node:path';
import { escapeHtml, minutesLabel, hoursLabel, plural } from './util.mjs';
import { icon } from './icons.mjs';
import { asideOpen } from './markdown.mjs';
import { QUIZ_TITLE } from './parse.mjs';
import { renderStepCode, renderSettings, fileDataName, codeLines } from './blocks.mjs';
import { resolveImage, resolveLink } from './analyze.mjs';
import { SWIFT_NOTES, findSwiftNotes } from './swift-notes.mjs';

const NOTE_BY_ID = new Map(SWIFT_NOTES.map((n) => [n.id, n]));

/** The new lines of a step: the highlighted lines, or every line of a new file. */
function stepNewLines(step) {
  const fence = step.block && step.block.type === 'code' ? step.block.code : null;
  if (!fence) return [];
  if (fence.isNew || fence.highlight.length === 0) return fence.lines;
  return fence.highlight.map((n) => fence.lines[n - 1]).filter((l) => l !== undefined);
}

/** The first step (in chapter order) that uses each Swift construct. Cached on the site. */
function swiftFirstUses(site) {
  if (site.swiftFirstUses) return site.swiftFirstUses;
  const first = new Map();
  for (const chapter of site.chapters || []) {
    if (chapter.fixture) continue;
    for (const entry of chapter.entries) {
      const page = entry.page;
      if (!page || page.kind !== 'tutorial') continue;
      for (const section of page.sections) {
        for (const item of section.items) {
          if (item.type !== 'step') continue;
          for (const id of findSwiftNotes(stepNewLines(item))) {
            if (!first.has(id)) first.set(id, { slug: entry.slug, stepId: item.id, chapter: chapter.number, section: section.number, step: item.number });
          }
        }
      }
    }
  }
  site.swiftFirstUses = first;
  return first;
}

/** The Swift notes of a step: a card at the first use of a construct, a pointer at later uses. */
function swiftNotesHtml(site, page, step) {
  const ids = findSwiftNotes(stepNewLines(step));
  if (!ids.length) return '';
  const first = swiftFirstUses(site);
  const cards = [];
  const refs = [];
  for (const id of ids) {
    const note = NOTE_BY_ID.get(id);
    const use = first.get(id);
    if (!use || (use.slug === page.slug && use.stepId === step.id)) {
      cards.push(`<div class="swift-note"><p class="swift-note-title">${icon('swift')}<span>Swift: <code>${e(note.title)}</code></span></p><p>${e(note.text)} <a href="${note.link}" target="_blank" rel="noopener">Swift documentation</a></p></div>`);
    } else if (!note.common) {
      const where = use.slug === page.slug ? `step ${use.section}.${use.step}` : `chapter ${use.chapter}, step ${use.section}.${use.step}`;
      refs.push(`<a href="${use.slug}.html#${use.stepId}"><code>${e(note.title)}</code></a> (${where})`);
    }
  }
  const refHtml = refs.length ? `<p class="swift-refs">${icon('swift')}<span>Swift: ${refs.join(', ')}</span></p>` : '';
  return cards.join('') + refHtml;
}

const e = escapeHtml;
const KIND_LABEL = { article: 'Article', tutorial: 'Tutorial' };

// ---------------------------------------------------------------- environment

/** The render environment of one page: images, links, code highlighting. */
export function makeEnv(site, page, out) {
  const env = {
    ...(page ? page.env : {}),
    highlight: site.highlight,
    image: (src, alt) => imageHtml(site, page, src, alt, out),
    link: (href) => resolveLink(page, href, site),
    registerFile: (fence) => {
      out.files.set(fence.fileKey, { branch: page.branch, file: fence.file });
      return fileDataName(fence.fileKey);
    },
  };
  env.inline = (text) => site.md.renderInline(text, env);
  return env;
}

let svgCounter = 0;

function imageHtml(site, page, src, alt, out) {
  const info = resolveImage(page, src, site.contentDir);
  if (info.external || !info.rel || !fs.existsSync(info.abs)) {
    return `<span class="missing-image">The image is missing: ${e(src)}</span>`;
  }
  if (/\.svg$/i.test(info.abs)) return inlineSvg(fs.readFileSync(info.abs, 'utf8'), alt);

  out.media.set(info.rel, info.abs);
  let size = '';
  let cls = 'media';
  const dims = pngSize(info.abs);
  if (dims) {
    size = ` width="${dims.width}" height="${dims.height}"`;
    if (dims.height > dims.width * 1.3) cls += ' media-portrait';
  }
  return `<img class="${cls}" src="media/${e(encodeURI(info.rel))}" alt="${e(alt)}"${size} loading="lazy" decoding="async">`;
}

function pngSize(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const buffer = Buffer.alloc(24);
    fs.readSync(fd, buffer, 0, 24, 0);
    fs.closeSync(fd);
    if (buffer.toString('ascii', 1, 4) !== 'PNG') return null;
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  } catch {
    return null;
  }
}

/** Inlines an SVG file so that it can use the CSS variables of the site. */
function inlineSvg(text, alt) {
  svgCounter += 1;
  const prefix = `svg${svgCounter}-`;
  let svg = text
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
  const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  for (const id of ids) {
    const safe = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    svg = svg
      .replace(new RegExp(`(\\sid=")${safe}"`, 'g'), `$1${prefix}${id}"`)
      .replace(new RegExp(`url\\(#${safe}\\)`, 'g'), `url(#${prefix}${id})`)
      .replace(new RegExp(`(href=")#${safe}"`, 'g'), `$1#${prefix}${id}"`);
  }
  svg = svg.replace(/<svg\b([^>]*)>/, (m, attrs) => {
    const cleaned = attrs
      .replace(/\s(width|height|class|role|aria-label)="[^"]*"/g, '')
      .replace(/\s+$/, '');
    return `<svg${cleaned} class="media diagram" role="img" aria-label="${e(alt)}">`;
  });
  return svg;
}

// ---------------------------------------------------------------- page shell

function shell(site, { title, description, bodyAttrs = '', topbar, main, assetVersion, dev }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title>
<meta name="description" content="${e(description || '')}">
<meta name="color-scheme" content="light dark">
<script>
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  try {
    var theme = localStorage.getItem('avcam-tutorial:theme');
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
    if (localStorage.getItem('avcam-tutorial:try-first') === 'on') root.classList.add('try-first');
  } catch (error) {}
})();
</script>
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/site.css?v=${assetVersion}">
<script src="assets/site.js?v=${assetVersion}" defer></script>
</head>
<body ${bodyAttrs}>
<a class="skip-link" href="#main">Skip to the content</a>
${topbar}
${main}
<footer class="sitefoot">
<div class="sitefoot-inner">
<div class="sitefoot-progress">
<p>The site saves your progress in this browser only.</p>
<button type="button" class="btn btn-quiet" data-reset-progress>${icon('reset')}<span>Reset progress</span></button>
</div>
<p class="sitefoot-note">${e(site.collection.footer || '')}</p>
</div>
</footer>
<dialog class="filedialog" id="file-dialog" aria-labelledby="file-dialog-title">
<div class="filedialog-head">
<div class="filedialog-titles"><h2 id="file-dialog-title"></h2><p class="filedialog-note"></p></div>
<button type="button" class="tool tool-icon" data-close-dialog aria-label="Close">${icon('close')}</button>
</div>
<div class="filedialog-body code-scroll" tabindex="0"></div>
</dialog>
<dialog class="filedialog shotsdialog" id="shots-dialog" aria-labelledby="shots-dialog-title">
<div class="filedialog-head">
<div class="filedialog-titles"><h2 id="shots-dialog-title">What you see</h2><p class="filedialog-note"></p></div>
<button type="button" class="tool tool-icon" data-close-dialog aria-label="Close">${icon('close')}</button>
</div>
<div class="shotsdialog-body"></div>
</dialog>
<div class="toast" role="status" aria-live="polite"></div>
${dev ? '<script>new EventSource("/__reload").onmessage = function () { location.reload(); };</script>' : ''}
</body>
</html>
`;
}

function themeSwitch() {
  const button = (value, label, title, iconName) =>
    `<button type="button" data-theme-set="${value}" aria-pressed="false" title="${title}">${icon(iconName)}<span class="sr-only">${label}</span></button>`;
  return `<div class="theme-switch" role="group" aria-label="Colour theme">
${button('auto', 'Automatic theme', 'Same as the system', 'auto')}
${button('light', 'Light theme', 'Light', 'sun')}
${button('dark', 'Dark theme', 'Dark', 'moon')}
</div>`;
}

function chapterLabel(chapter) {
  return chapter.number ? `Chapter ${chapter.number}` : '';
}

function topbar(site, page, sections) {
  const brand = `<a class="brand" href="index.html" title="Go to the overview">${icon('logo')}<span class="brand-name">${e(site.shortTitle)}</span></a>`;
  if (!page) {
    return `<header class="topbar"><div class="topbar-inner">${brand}<span class="topbar-spacer"></span>${themeSwitch()}</div></header>`;
  }

  const groups = site.chapters
    .map((chapter) => {
      const heading = chapter.number ? `Chapter ${chapter.number} · ${e(chapter.title)}` : e(chapter.title);
      const rows = chapter.entries
        .map((entry) => {
          const inner = `${icon(entry.kind)}<span class="menu-text">${e(entry.title)}</span>`;
          if (!entry.page) return `<li><span class="menu-item is-disabled">${inner}<span class="menu-note">Not written yet</span></span></li>`;
          const current = entry.page === page ? ' aria-current="page"' : '';
          return `<li><a class="menu-item" href="${entry.slug}.html"${current} data-slug="${e(entry.slug)}" data-steps="${entry.page.stepCount}">${inner}<span class="menu-done" hidden>${icon('check')}<span class="sr-only">Complete</span></span></a></li>`;
        })
        .join('\n');
      return `<li class="menu-group"><p class="menu-heading">${heading}</p><ul>\n${rows}\n</ul></li>`;
    })
    .join('\n');

  const sectionLinks = sections
    .map((s, i) => `<li><a class="menu-item" href="#${e(s.id)}" data-sec-link="${i}"><span class="menu-index">${i + 1}</span><span class="menu-text">${e(s.title)}</span></a></li>`)
    .join('\n');

  return `<header class="topbar">
<div class="topbar-inner">
${brand}
<div class="picker picker-pages" data-picker>
<button type="button" class="picker-btn" aria-expanded="false" aria-controls="menu-pages" aria-label="Choose a page. Current page: ${e(page.title)}">
<span class="picker-label">${e(page.title)}</span>${icon('chevron')}
</button>
<div class="picker-menu" id="menu-pages" hidden>
<nav aria-label="Pages"><ul class="menu-groups">
${groups}
</ul></nav>
</div>
</div>
<div class="picker picker-sections" data-picker>
<button type="button" class="picker-btn" aria-expanded="false" aria-controls="menu-sections" aria-label="Choose a section of this page">
<span class="picker-label" data-section-label>${e(sections[0].title)}</span><span class="picker-count" data-section-count>1 of ${sections.length}</span>${icon('chevron')}
</button>
<div class="picker-menu" id="menu-sections" hidden>
<nav aria-label="Sections of this page"><ul>
${sectionLinks}
</ul></nav>
</div>
</div>
<span class="topbar-spacer"></span>
<button type="button" class="tryfirst-toggle" data-tryfirst-toggle aria-pressed="false" title="Hide the code of each step until you ask for it">${icon('pen')}<span class="tryfirst-label">Try first</span></button>
${themeSwitch()}
</div>
<div class="page-progress" aria-hidden="true"><span></span></div>
</header>`;
}

// ---------------------------------------------------------------- shared parts

function renderQuiz(site, page, env) {
  const quiz = page.quiz;
  if (!quiz || quiz.questions.length === 0) return '';
  const md = site.md;
  const render = (tokens) => md.renderer.render(tokens, md.options, env);
  const total = quiz.questions.length;

  const questions = quiz.questions
    .map((q) => {
      const titleId = `quiz-q${q.number}`;
      const choices = q.choices
        .map(
          (choice, i) => `<div class="choice" data-choice="${i}"${choice.correct ? ' data-correct' : ''}>
<label class="choice-card"><input type="radio" name="quiz-q${q.number}" value="${i}"><span class="choice-mark" aria-hidden="true"></span><span class="choice-body">${render(choice.content)}</span></label>
<div class="choice-why" hidden><p class="choice-verdict">${choice.correct ? 'Correct' : 'Not correct'}</p>${render(choice.explanation)}</div>
</div>`,
        )
        .join('\n');
      return `<li class="question" data-question="${q.number - 1}">
<p class="eyebrow">Question ${q.number} of ${total}</p>
<h3 id="${titleId}">${md.renderer.renderInline(q.titleTokens, md.options, env)}</h3>
${q.content.length ? `<div class="prose question-content">${render(q.content)}</div>` : ''}
<div class="choices" role="radiogroup" aria-labelledby="${titleId}">
${choices}
</div>
<div class="quiz-actions">
<button type="button" class="btn btn-primary" data-quiz-submit disabled>Submit</button>
<button type="button" class="btn" data-quiz-next disabled>${q.number === total ? 'Show the result' : 'Next question'}</button>
</div>
</li>`;
    })
    .join('\n');

  return `<section class="quiz" id="${quiz.id}" data-sec data-quiz aria-labelledby="quiz-title">
<div class="quiz-inner">
<h2 id="quiz-title">${QUIZ_TITLE}</h2>
${quiz.intro.length ? `<div class="prose">${render(quiz.intro)}</div>` : ''}
<ol class="questions">
${questions}
</ol>
<div class="quiz-result" data-quiz-result hidden tabindex="-1">
<p class="eyebrow">Result</p>
<h3 data-quiz-score></h3>
<p data-quiz-comment></p>
<button type="button" class="btn" data-quiz-restart>${icon('reset')}<span>Do the quiz again</span></button>
</div>
</div>
</section>`;
}

function renderPageDone(page) {
  const steps = page.stepCount;
  return `<section class="pagedone" data-pagedone aria-label="Page progress">
<div class="pagedone-inner">
<p class="pagedone-status" data-pagedone-status aria-live="polite">${steps ? `0 of ${steps} steps done` : ''}</p>
<button type="button" class="btn" data-mark-complete aria-pressed="false">${icon('check')}<span>Mark page as complete</span></button>
</div>
</section>`;
}

function renderNext(page) {
  const next = page.next;
  if (!next) {
    return `<aside class="nextcard" aria-labelledby="next-title">
<div class="nextcard-inner">
<p class="eyebrow">The end</p>
<h2 id="next-title">This is the last page for now</h2>
<p>Go back to the overview to see your progress in all chapters.</p>
<a class="btn btn-primary" href="index.html"><span>Go to the overview</span>${icon('arrow')}</a>
</div>
</aside>`;
  }
  const meta = [KIND_LABEL[next.kind], minutesLabel(next.estimatedMinutes)].filter(Boolean).join(' · ');
  const chapter = next.chapterInfo.number && next.chapterInfo !== page.chapterInfo ? `Chapter ${next.chapterInfo.number} · ` : '';
  return `<aside class="nextcard" aria-labelledby="next-title">
<div class="nextcard-inner">
<p class="eyebrow">Next · ${chapter}${meta}</p>
<h2 id="next-title">${e(next.title)}</h2>
<p>${e(next.abstract)}</p>
<a class="btn btn-primary" href="${next.slug}.html"><span>${next.kind === 'tutorial' ? 'Start the tutorial' : 'Read the article'}</span>${icon('arrow')}</a>
</div>
</aside>`;
}

function heroEyebrow(page) {
  const parts = [];
  if (page.chapterInfo.fixture) parts.push('Fixture');
  else if (page.chapterInfo.number) parts.push(`Chapter ${page.chapterInfo.number}`, page.chapterInfo.title);
  parts.push(KIND_LABEL[page.kind]);
  return parts.map(e).join(' · ');
}

function cmd(command) {
  return `<div class="cmd"><code>${e(command)}</code><button type="button" class="tool tool-icon" data-copy-text="${e(command)}" aria-label="Copy the command">${icon('copy')}</button></div>`;
}

// ---------------------------------------------------------------- tutorial page

/**
 * Where the learner writes the code of a step, without the code itself: the file, the lines
 * around the new code, and a placeholder for the new lines.
 */
function solutionPlace(step, env) {
  const fence = step.block.code;
  const file = fence.file || 'Code';
  const fileHtml = `<code>${e(file)}</code>`;
  const removes = step.block.removes || [];
  let out = '';
  if (fence.isNew) {
    out += `<p class="solution-text"><strong>Where:</strong> create the new file ${fileHtml} and write the whole file yourself. The step text says what the file contains.</p>`;
  } else {
    const hl = new Set(fence.highlight);
    const html = env.highlight(fence.lines.join('\n'), fence.lang || 'swift');
    const numbers = fence.numbers || fence.lines.map((_, i) => i + 1);
    let body = '';
    let run = 0;
    fence.lines.forEach((line, i) => {
      if (hl.has(i + 1)) {
        run += 1;
        const last = !hl.has(i + 2);
        if (last) {
          const indent = (fence.lines[i - run + 1].match(/^\s*/) || [''])[0];
          body += `<span class="ln ph"><span class="no" data-n=""></span><span class="tx">${e(indent)}// your code goes here\n</span></span>`;
          run = 0;
        }
      } else {
        body += codeLines([html[i]], { numbers: [numbers[i]] });
      }
    });
    const context = fence.lines.length - fence.highlight.length;
    const where = context > 0
      ? `in ${fileHtml}. The lines below are already in your file; they show the place. Write your code at the marked line. The line numbers are those of the finished chapter.`
      : `in ${fileHtml}, at the place that the step text names. The whole region is new code.`;
    out += `<p class="solution-text"><strong>Where:</strong> ${where}</p>`;
    out += `<pre class="code solution-place"><code>${body}</code></pre>`;
  }
  for (const r of removes) {
    const rmHtml = env.highlight(r.lines.join('\n'), r.lang || fence.lang || 'swift');
    out += `<p class="solution-text"><strong>Also delete</strong> ${r.lines.length === 1 ? 'this line' : 'these lines'} in ${fileHtml}:</p><pre class="code solution-place"><code>${codeLines(rmHtml, { removed: true })}</code></pre>`;
  }
  return out;
}

/** The cover of a code panel in the "Try first" mode. */
function solutionCover(page, step, env) {
  if (!step.block || step.block.type !== 'code') return '';
  const file = step.block.code.file;
  const compare = page.branch && file ? `git diff ${page.branch} -- ${file}` : '';
  return `<div class="solution-cover" data-cover>
<p class="solution-title">${icon('pen')}<span>Write this step yourself first.</span></p>
<p class="solution-text">Read the goal of the step, write the code in Xcode, and build. Then show the solution and compare.</p>
${solutionPlace(step, env)}
<div class="solution-actions">
<button type="button" class="btn btn-primary" data-reveal>Show solution</button>
<button type="button" class="btn btn-quiet" data-reveal-section>Show all solutions of this section</button>
</div>
${compare ? `<p class="solution-compare">To compare your file with the finished chapter, run this in the folder of the app:</p><div class="cmd"><code>${e(compare)}</code><button type="button" class="tool tool-icon" data-copy-text="${e(compare)}" title="Copy">${icon('copy')}</button></div>` : ''}
</div>`;
}

function renderStepBlock(site, step, env) {
  const block = step.block;
  if (!block) return '<div class="missing-image">This step has no block yet.</div>';
  if (block.type === 'code') return renderStepCode(block, env);
  if (block.type === 'settings') return renderSettings(block, env);
  return `<figure class="shot">${env.image(block.src, block.alt)}</figure>`;
}

function renderTutorial(site, page, env) {
  const md = site.md;
  const render = (tokens) => md.renderer.render(tokens, md.options, env);

  const sectionsHtml = page.sections
    .map((section) => {
      const items = section.items
        .map((item) => {
          if (item.type === 'step') {
            const label = `Step ${item.number}`;
            return `<article class="step" id="${item.id}" data-step="${section.number}-${item.number}" aria-labelledby="${item.id}-label">
<header class="step-head">
<h3 class="step-label" id="${item.id}-label">${label}</h3>
<button type="button" class="check" data-step-check aria-pressed="false" aria-label="${label} of section ${section.number}: mark as done" title="Mark as done">${icon('check')}</button>
</header>
<div class="step-instruction">${render(item.instruction)}</div>
${item.caption.length ? `<div class="step-caption">${render(item.caption)}</div>` : ''}
</article>
<div class="step-block" data-block-for="${item.id}">${solutionCover(page, item, env)}${renderStepBlock(site, item, env)}${swiftNotesHtml(site, page, item)}</div>`;
          }
          if (item.type === 'aside') {
            return `<div class="between">${asideOpen(item.kind)}${render(item.tokens)}</aside></div>`;
          }
          return `<div class="between prose">${render(item.tokens)}</div>`;
        })
        .join('\n');
      const media = section.media ? `<div class="tsection-media"><figure class="figure">${env.image(section.media.src, section.media.alt)}</figure></div>` : '';
      return `<section class="tsection" id="${section.id}" data-sec aria-labelledby="${section.id}-title">
<header class="tsection-head${media ? ' has-media' : ''}">
<div class="tsection-text">
<p class="eyebrow">Section ${section.number}</p>
<h2 id="${section.id}-title">${md.renderer.renderInline(section.titleTokens, md.options, env)}</h2>
${section.intro.length ? `<div class="prose">${render(section.intro)}</div>` : ''}
</div>
${media}
</header>
<div class="steps" style="--n:${section.items.length}">
${items}
</div>
</section>`;
    })
    .join('\n');

  const start = page.startBranch && page.branch
    ? `<aside class="startcode" aria-labelledby="startcode-title">
<h2 id="startcode-title">${icon('branch')}<span>Start code</span></h2>
<p>This chapter starts from the branch <code>${e(page.startBranch)}</code> of the app repository. Run this command in the folder of the app:</p>
${cmd(`git switch ${page.startBranch}`)}
<p>To compare the start code with the finished chapter:</p>
${cmd(`git diff ${page.startBranch} ${page.branch}`)}
</aside>`
    : '';

  const meta = [
    page.estimatedMinutes ? `<li>${icon('clock')}<span><b>${page.estimatedMinutes}</b> minutes</span></li>` : '',
    site.xcode ? `<li>${icon('tool')}<span>Xcode <b>${e(site.xcode)}</b></span></li>` : '',
    `<li>${icon('tutorial')}<span><b>${page.stepCount}</b> ${page.stepCount === 1 ? 'step' : 'steps'} in ${plural(page.sections.length, 'section', 'sections')}</span></li>`,
  ].join('');

  return `<main id="main" class="page page-tutorial">
<header class="hero hero-tutorial" id="intro" data-sec>
<div class="hero-inner">
<div class="hero-text">
<p class="eyebrow">${heroEyebrow(page)}</p>
<h1>${e(page.title)}</h1>
<div class="hero-intro prose">${render(page.intro)}</div>
<ul class="hero-meta">${meta}</ul>
</div>
${start}
</div>
</header>
${sectionsHtml}
${renderQuiz(site, page, env)}
${renderPageDone(page)}
${renderNext(page)}
</main>`;
}

export function tutorialSections(page) {
  const list = [{ id: 'intro', title: 'Introduction' }, ...page.sections.map((s) => ({ id: s.id, title: s.title }))];
  if (page.quiz && page.quiz.questions.length) list.push({ id: page.quiz.id, title: QUIZ_TITLE });
  return list;
}

// ---------------------------------------------------------------- article page

function renderArticle(site, page, env) {
  const md = site.md;
  for (const token of page.body) {
    if (token.type === 'heading_open' && token.tag === 'h2') token.attrSet('data-sec', '');
  }
  const meta = page.estimatedMinutes ? `<ul class="hero-meta"><li>${icon('clock')}<span><b>${page.estimatedMinutes}</b> minutes</span></li></ul>` : '';
  return `<main id="main" class="page page-article">
<header class="hero hero-article" id="intro" data-sec>
<div class="hero-inner">
<div class="hero-text">
<p class="eyebrow">${heroEyebrow(page)}</p>
<h1>${e(page.title)}</h1>
<div class="hero-intro prose">${md.renderer.render(page.intro, md.options, env)}</div>
${meta}
</div>
</div>
</header>
<div class="article-body prose">
${md.renderer.render(page.body, md.options, env)}
</div>
${renderQuiz(site, page, env)}
${renderPageDone(page)}
${renderNext(page)}
</main>`;
}

export function articleSections(page) {
  const list = [{ id: 'intro', title: 'Introduction' }, ...page.headings];
  if (page.quiz && page.quiz.questions.length) list.push({ id: page.quiz.id, title: QUIZ_TITLE });
  return list;
}

export function renderPage(site, page, out, options) {
  const env = makeEnv(site, page, out);
  const sections = page.kind === 'tutorial' ? tutorialSections(page) : articleSections(page);
  const main = page.kind === 'tutorial' ? renderTutorial(site, page, env) : renderArticle(site, page, env);
  return shell(site, {
    title: `${page.title} · ${site.shortTitle}`,
    description: page.abstract,
    bodyAttrs: `data-page="${e(page.slug)}" data-kind="${page.kind}" data-steps="${page.stepCount}" data-title="${e(page.title)}"`,
    topbar: topbar(site, page, sections),
    main,
    ...options,
  });
}

// ---------------------------------------------------------------- overview

function heroArt() {
  // An abstract viewfinder. Original artwork, drawn with the site colours.
  return `<svg class="ohero-art" viewBox="0 0 360 300" role="img" aria-label="A camera viewfinder with a focus frame">
<rect x="20" y="20" width="320" height="260" rx="22" fill="var(--surface)" stroke="var(--line)" stroke-width="1.5"/>
<g stroke="var(--line)" stroke-width="1">
<path d="M126.7 36v228M233.3 36v228M36 106.7h288M36 193.3h288"/>
</g>
<g fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
<path d="M44 76V56a12 12 0 0 1 12-12h20M284 44h20a12 12 0 0 1 12 12v20M316 224v20a12 12 0 0 1-12 12h-20M76 256H56a12 12 0 0 1-12-12v-20"/>
</g>
<g fill="none" stroke="var(--accent)" stroke-width="2">
<rect x="140" y="110" width="80" height="80" rx="8"/>
<path d="M180 110v10M180 190v-10M140 150h10M220 150h-10"/>
</g>
<circle cx="180" cy="150" r="3" fill="var(--accent)"/>
<g fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-linecap="round">
<path d="M150 236h60"/>
<path d="M180 230v12"/>
</g>
<g fill="var(--muted)" font-family="inherit" font-size="11" letter-spacing=".06em">
<text x="56" y="246">ISO 64</text>
<text x="262" y="246">1/120</text>
</g>
<circle cx="296" cy="66" r="5" fill="var(--accent)" opacity=".85"/>
</svg>`;
}

export function renderOverview(site, options) {
  const written = site.entries.filter((en) => en.page && !en.chapter.fixture);
  const totalMinutes = written.reduce((sum, en) => sum + en.page.estimatedMinutes, 0);
  const realChapters = site.chapters.filter((c) => c.number > 0);
  const first = site.entries.find((en) => en.page);
  const allListed = site.entries.filter((en) => !en.chapter.fixture);

  const stats = [
    `<li><b>${realChapters.length}</b> chapters</li>`,
    `<li><b>${allListed.length}</b> pages</li>`,
    totalMinutes && written.length === allListed.length ? `<li>About <b>${hoursLabel(Math.round(totalMinutes / 30) * 30)}</b></li>` : '',
    site.xcode ? `<li>Xcode <b>${e(site.xcode)}</b></li>` : '',
  ].join('');

  const index = site.chapters
    .map((chapter) => {
      const n = chapter.number ? `<span class="oindex-n">${chapter.number}</span>` : '<span class="oindex-n oindex-dot"></span>';
      return `<li><a href="#${chapter.id}" data-chapter-link="${chapter.id}">${n}<span class="oindex-title">${e(chapter.title)}</span><span class="oindex-done" hidden>${icon('check')}</span></a></li>`;
    })
    .join('\n');

  const chapters = site.chapters
    .map((chapter) => {
      const rows = chapter.entries
        .map((entry) => {
          const iconHtml = `<span class="pagerow-icon">${icon(entry.kind)}</span>`;
          if (!entry.page) {
            return `<li><div class="pagerow is-missing">${iconHtml}<span class="pagerow-main"><span class="pagerow-title">${e(entry.title)}</span><span class="pagerow-sub">${KIND_LABEL[entry.kind]}</span></span><span class="pagerow-note">Not written yet</span></div></li>`;
          }
          const p = entry.page;
          const time = p.estimatedMinutes ? `<span class="pagerow-time">${icon('clock')}<span>${minutesLabel(p.estimatedMinutes)}</span></span>` : '';
          return `<li><a class="pagerow" href="${entry.slug}.html" data-slug="${e(entry.slug)}" data-steps="${p.stepCount}" data-title="${e(p.title)}">${iconHtml}<span class="pagerow-main"><span class="pagerow-title">${e(p.title)}</span><span class="pagerow-sub"><span>${KIND_LABEL[p.kind]}</span><span class="pagerow-partial" data-partial hidden></span></span></span>${time}<span class="pagerow-done" data-done><span class="sr-only" data-done-text>Not complete</span>${icon('check')}</span></a></li>`;
        })
        .join('\n');
      const writtenCount = chapter.entries.filter((en) => en.page).length;
      return `<section class="chapter${chapter.fixture ? ' chapter-fixture' : ''}" id="${chapter.id}" data-chapter aria-labelledby="${chapter.id}-title">
<header class="chapter-head">
${chapter.number ? `<span class="chapter-number" aria-hidden="true">${chapter.number}</span>` : ''}
<div class="chapter-text">
${chapter.number ? `<p class="eyebrow">${chapterLabel(chapter)}</p>` : ''}
<h2 id="${chapter.id}-title">${e(chapter.title)}</h2>
${chapter.abstract ? `<p class="chapter-abstract">${e(chapter.abstract)}</p>` : ''}
</div>
<p class="chapter-progress" data-chapter-progress data-total="${writtenCount}"${writtenCount ? '' : ' hidden'}></p>
</header>
<ul class="pagerows">
${rows}
</ul>
</section>`;
    })
    .join('\n');

  const main = `<main id="main" class="page page-overview">
<header class="ohero">
<div class="ohero-inner">
<div class="ohero-text">
<p class="eyebrow">A step-by-step tutorial</p>
<h1>${e(site.title)}</h1>
<p class="ohero-abstract">${e(site.abstract)}</p>
<ul class="ohero-stats">${stats}</ul>
<div class="ohero-actions">
${first ? `<a class="btn btn-primary btn-large" href="${first.slug}.html" data-start><span>Start the tutorial</span>${icon('arrow')}</a>` : '<p class="ohero-empty">The first page is not written yet.</p>'}
<a class="btn btn-large" href="#" data-continue hidden><span class="btn-stack"><span>Continue where you stopped</span><small data-continue-title></small></span>${icon('arrow')}</a>
</div>
</div>
${heroArt()}
</div>
</header>
<div class="olayout">
<nav class="oindex" aria-label="Chapters">
<p class="oindex-heading">Chapters</p>
<ol>
${index}
</ol>
</nav>
<div class="chapters">
${chapters}
</div>
</div>
</main>`;

  return shell(site, {
    title: site.title,
    description: site.abstract,
    bodyAttrs: 'data-page="index" data-kind="overview"',
    topbar: topbar(site, null, []),
    main,
    ...options,
  });
}
