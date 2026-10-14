// HTML for the content blocks: code cards, settings cards, link cards.

import { escapeHtml, fileKey } from './util.mjs';
import { icon } from './icons.mjs';
import { parseInfo, formatRanges } from './fence.mjs';

const CONTEXT_LINES = 2; // lines around a highlight in the phone excerpt
const EXCERPT_WITHOUT_HIGHLIGHT = 12;
const MIN_HIDDEN = 4; // do not collapse when fewer lines would be hidden

/** Which lines the phone excerpt hides. Returns an array of booleans. */
export function farLines(count, highlight) {
  const far = new Array(count).fill(true);
  if (highlight.length === 0) {
    for (let i = 0; i < Math.min(count, EXCERPT_WITHOUT_HIGHLIGHT); i += 1) far[i] = false;
  } else {
    for (const n of highlight) {
      for (let i = n - 1 - CONTEXT_LINES; i <= n - 1 + CONTEXT_LINES; i += 1) {
        if (i >= 0 && i < count) far[i] = false;
      }
    }
  }
  if (far.filter(Boolean).length < MIN_HIDDEN) far.fill(false);
  return far;
}

/**
 * The lines of one code listing.
 * @param {string[]} linesHtml  highlighted HTML, one entry per line
 * @param {object} opt  { numbers, highlight: number[], removed, far: boolean[] }
 */
export function codeLines(linesHtml, opt = {}) {
  const hl = new Set(opt.highlight || []);
  const far = opt.far || [];
  let out = '';
  let inFarRun = false;
  linesHtml.forEach((html, i) => {
    const classes = ['ln'];
    if (opt.removed) classes.push('rm');
    else if (hl.has(i + 1)) classes.push('hl');
    if (far[i]) {
      classes.push('far');
      if (!inFarRun) out += '<span class="gap" aria-hidden="true"></span>';
      inFarRun = true;
    } else {
      inFarRun = false;
    }
    const number = opt.removed ? '' : opt.numbers ? opt.numbers[i] : i + 1;
    out += `<span class="${classes.join(' ')}"><span class="no" data-n="${number}"></span><span class="tx">${html}\n</span></span>`;
  });
  return out;
}

function digits(numbers) {
  const max = numbers.length ? Math.max(...numbers) : 1;
  return Math.max(2, String(max).length);
}

function pathHtml(file) {
  const at = file.lastIndexOf('/');
  const dir = at === -1 ? '' : file.slice(0, at + 1);
  const name = file.slice(at + 1);
  return `<span class="path">${dir ? `<span class="dir">${escapeHtml(dir)}</span>` : ''}<span class="name">${escapeHtml(name)}</span></span>`;
}

function fullFileButton(fence, env) {
  if (!fence.fileKey || !env.registerFile) return '';
  const src = env.registerFile(fence);
  const marked = fence.highlight.length ? fence.highlight.map((n) => fence.map[n - 1]) : fence.map;
  const lines = formatRanges(marked.filter(Boolean)).replace(/\s/g, '');
  return `<button type="button" class="tool" data-full-file data-file-key="${escapeHtml(fence.fileKey)}" data-file-src="${escapeHtml(src)}" data-lines="${lines}" title="View full file" aria-label="View full file">${icon('expand')}<span class="tool-label">View full file</span></button>`;
}

/** Screenshots of the app after a step, shown under its code card. */
function resultImages(fence, env) {
  if (!fence.results || !fence.results.length || !env.image) return '';
  const items = fence.results.map((r) => `<figure class="result">${env.image(r.src, r.caption || 'The app after this step')}${r.caption ? `<figcaption>${escapeHtml(r.caption)}</figcaption>` : ''}</figure>`).join('');
  return `<div class="step-results"><p class="step-results-title">${icon('phone')}<span>What you see</span></p><div class="step-results-row">${items}</div></div>`;
}

/** The code card of a tutorial step. */
export function renderStepCode(block, env) {
  const fence = block.code;
  const file = fence.file || 'Code';
  const lang = fence.lang || 'swift';
  const numbers = fence.numbers || fence.lines.map((_, i) => i + 1);
  const far = farLines(fence.lines.length, fence.highlight);
  const hidden = far.filter(Boolean).length;
  const body = codeLines(env.highlight(fence.lines.join('\n'), lang), { numbers, highlight: fence.highlight, far });

  let removed = '';
  for (const r of block.removes || []) {
    const rmBody = codeLines(env.highlight(r.lines.join('\n'), r.lang || lang), { removed: true });
    removed += `<p class="code-label code-label-remove">${icon('minus')}<span>Delete ${r.lines.length === 1 ? 'this line' : 'these lines'}</span></p><pre class="code code-removed"><code>${rmBody}</code></pre>`;
  }
  if (removed) removed += `<p class="code-label">${icon('check')}<span>The code after this step</span></p>`;

  const partial = fence.highlight.length > 0 && fence.highlight.length < fence.lines.length;
  const badges = [
    fence.isNew ? '<span class="badge">New file</span>' : '',
    fence.transient ? '<span class="badge badge-quiet" title="This code changes again later in this chapter">Changes later</span>' : '',
  ].join('');

  return `<figure class="codecard${hidden ? ' has-excerpt' : ''}" data-code style="--digits:${digits(numbers)}">
<figcaption class="codecard-head">
<span class="codecard-file" title="${escapeHtml(file)}">${icon('file')}${pathHtml(file)}</span>${badges}
<span class="codecard-tools"><button type="button" class="tool tool-hide" data-hide title="Hide the solution again" aria-label="Hide the solution again">${icon('eyeOff')}<span class="tool-label">Hide</span></button>${fullFileButton(fence, env)}<button type="button" class="tool" data-copy-code="${partial ? 'hl' : 'all'}" title="${partial ? 'Copy new lines' : 'Copy code'}" aria-label="${partial ? 'Copy new lines' : 'Copy code'}">${icon('copy')}<span class="tool-label">${partial ? 'Copy new lines' : 'Copy code'}</span></button></span>
</figcaption>
<div class="code-scroll" tabindex="0" role="group" aria-label="Code: ${escapeHtml(file)}">${removed}<pre class="code" data-main><code>${body}</code></pre></div>
${hidden ? `<button type="button" class="code-more" data-expand aria-expanded="false" data-count="${fence.lines.length}">Show all ${fence.lines.length} lines</button>` : ''}
</figure>${resultImages(fence, env)}`;
}

export function renderSettings(settings, env) {
  const rows = settings.rows
    .map((row) => {
      const value = row.value
        ? `<span class="value"><span>${escapeHtml(row.value)}</span><button type="button" class="tool tool-icon" data-copy-text="${escapeHtml(row.value)}" aria-label="Copy the value">${icon('copy')}</button></span>`
        : '';
      const key = row.key ? `<span class="key">${escapeHtml(row.key)}</span>` : '';
      return `<li class="row${row.key ? '' : ' row-solo'}">${key}${value}</li>`;
    })
    .join('\n');
  return `<figure class="settings-card">
<figcaption>${icon('settings')}<span>${escapeHtml(settings.title)}</span></figcaption>
<ul class="settings-rows">
${rows}
</ul>
</figure>${resultImages(settings, env)}`;
}

export function renderLinks(content, env) {
  const cards = content
    .split('\n')
    .filter((l) => l.trim())
    .map((raw) => {
      const [title = '', url = '', ...restParts] = raw.split('|').map((s) => s.trim());
      const text = restParts.join(' | ');
      const info = env.link ? env.link(url) : { href: url, external: true };
      let host = '';
      try {
        host = info.external ? new URL(url).hostname.replace(/^www\./, '') : '';
      } catch {
        host = '';
      }
      const inline = (t) => (env.inline ? env.inline(t) : escapeHtml(t));
      const inner = `<span class="link-card-title">${inline(title)}</span>${text ? `<span class="link-card-text">${inline(text)}</span>` : ''}${
        host ? `<span class="link-card-host">${escapeHtml(host)}${icon('external')}</span>` : ''
      }`;
      if (info.missing) return `<li><span class="link-card link-missing">${inner}</span></li>`;
      const attrs = info.external ? ' target="_blank" rel="noopener"' : '';
      return `<li><a class="link-card" href="${escapeHtml(info.href)}"${attrs}>${inner}</a></li>`;
    })
    .join('\n');
  return `<ul class="link-cards">\n${cards}\n</ul>\n`;
}

/** A fenced block inside normal text (articles, intros, captions, quiz). */
export function renderProseFence(token, env = {}) {
  const info = parseInfo(token.info || '');
  if (info.lang === 'links') return renderLinks(token.content, env);
  if (info.lang === 'settings') {
    const rows = token.content
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => {
        const at = l.indexOf(': ');
        return at === -1 ? { key: '', value: l.trim() } : { key: l.slice(0, at).trim(), value: l.slice(at + 2).trim() };
      });
    return renderSettings({ title: info.title || 'Settings', rows }, env);
  }

  const fence = token.meta?.fence;
  const text = token.content.replace(/\n$/, '');
  const lines = fence ? fence.lines : text.split('\n');
  const lang = info.lang || 'text';
  const highlight = env.highlight ? env.highlight(lines.join('\n'), lang) : lines.map(escapeHtml);
  const file = fence?.file || info.file;
  const numbers = fence?.numbers || lines.map((_, i) => i + 1);
  const hl = fence ? fence.highlight : info.highlight;
  const body = codeLines(highlight, { numbers, highlight: hl, removed: info.remove });
  const copy = `<button type="button" class="tool${file ? '' : ' tool-icon'}" data-copy-code="all"${file ? '' : ' aria-label="Copy code"'}>${icon('copy')}${file ? '<span class="tool-label">Copy code</span>' : ''}</button>`;

  if (file) {
    return `<figure class="codecard codecard-prose" data-code style="--digits:${digits(numbers)}">
<figcaption class="codecard-head"><span class="codecard-file" title="${escapeHtml(file)}">${icon('file')}${pathHtml(file)}</span><span class="codecard-tools">${fence ? fullFileButton(fence, env) : ''}${copy}</span></figcaption>
<div class="code-scroll" tabindex="0" role="group" aria-label="Code: ${escapeHtml(file)}"><pre class="code"><code>${body}</code></pre></div>
</figure>\n`;
  }
  return `<figure class="codecard codecard-prose codecard-plain" data-code>
${copy}
<div class="code-scroll" tabindex="0" role="group" aria-label="Code"><pre class="code"><code>${body}</code></pre></div>
</figure>\n`;
}

export function fileDataName(key) {
  return `files/${fileKey(key)}.js`;
}
