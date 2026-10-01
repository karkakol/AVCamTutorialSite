// Markdown setup (markdown-it) with the additions of the content format:
// asides in GitHub alert form, figures, link handling, tables, code blocks.

import MarkdownIt from 'markdown-it';
import { escapeHtml } from './util.mjs';
import { icon } from './icons.mjs';
import { renderProseFence } from './blocks.mjs';

export const ASIDE_KINDS = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  experiment: 'Experiment',
};

const ALERT_RE = /^\[!(NOTE|TIP|IMPORTANT|EXPERIMENT)\][ \t]*\n?/i;

export function asideOpen(kind) {
  return `<aside class="aside aside-${kind}"><p class="aside-label">${icon(kind)}<span>${ASIDE_KINDS[kind]}</span></p>`;
}

export function createMarkdown() {
  const md = new MarkdownIt({ html: true, linkify: false, typographer: false });

  // > [!NOTE] ... -> aside
  md.core.ruler.before('inline', 'alerts', (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i += 1) {
      if (tokens[i].type !== 'blockquote_open') continue;
      const inline = tokens[i + 2];
      if (!inline || tokens[i + 1].type !== 'paragraph_open' || inline.type !== 'inline') continue;
      const m = ALERT_RE.exec(inline.content);
      if (!m) continue;
      const kind = m[1].toLowerCase();
      inline.content = inline.content.slice(m[0].length);
      if (inline.content.trim() === '') {
        tokens[i + 1].hidden = true;
        tokens[i + 3].hidden = true;
      }
      tokens[i].meta = { alert: kind };
      // Find the matching close token.
      for (let j = i + 1; j < tokens.length; j += 1) {
        if (tokens[j].type === 'blockquote_close' && tokens[j].level === tokens[i].level) {
          tokens[j].meta = { alert: kind };
          break;
        }
      }
    }
  });

  // A paragraph that holds only one image is a figure.
  md.core.ruler.after('inline', 'figures', (state) => {
    const tokens = state.tokens;
    for (let i = 0; i + 2 < tokens.length; i += 1) {
      if (tokens[i].type !== 'paragraph_open' || tokens[i + 1].type !== 'inline') continue;
      const children = (tokens[i + 1].children || []).filter((c) => !(c.type === 'text' && c.content.trim() === ''));
      if (children.length === 1 && children[0].type === 'image') {
        tokens[i].meta = { figure: true };
        tokens[i].attrJoin('class', 'figure');
      }
    }
  });

  const r = md.renderer.rules;

  r.blockquote_open = (tokens, idx, options, env, self) => {
    const kind = tokens[idx].meta?.alert;
    return kind ? asideOpen(kind) : self.renderToken(tokens, idx, options);
  };
  r.blockquote_close = (tokens, idx, options, env, self) =>
    tokens[idx].meta?.alert ? '</aside>\n' : self.renderToken(tokens, idx, options);

  r.table_open = () => '<div class="table-wrap" tabindex="0" role="region" aria-label="Table"><table>\n';
  r.table_close = () => '</table></div>\n';

  r.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const alt = self.renderInlineAsText(token.children || [], options, env);
    const src = token.attrGet('src') || '';
    if (env && env.image) return env.image(src, alt);
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`;
  };

  r.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const href = token.attrGet('href') || '';
    const info = env && env.link ? env.link(href) : { href };
    if (info.missing) {
      token.attrs = token.attrs.filter(([name]) => name !== 'href');
      token.attrSet('class', 'link-missing');
      token.attrSet('title', 'This page is not written yet');
    } else {
      token.attrSet('href', info.href);
      if (info.external) {
        token.attrSet('target', '_blank');
        token.attrSet('rel', 'noopener');
      }
    }
    return self.renderToken(tokens, idx, options);
  };

  r.fence = (tokens, idx, options, env) => renderProseFence(tokens[idx], env);
  r.code_block = (tokens, idx, options, env) => renderProseFence(tokens[idx], env);

  return md;
}

/** Splits a flat token list into its top-level blocks. */
export function splitBlocks(tokens) {
  const blocks = [];
  let start = -1;
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t.level !== 0) continue;
    if (t.nesting === 1) {
      start = i;
    } else if (t.nesting === -1) {
      blocks.push(makeBlock(tokens.slice(start, i + 1)));
      start = -1;
    } else if (start === -1) {
      blocks.push(makeBlock([t]));
    }
  }
  return blocks;
}

function makeBlock(tokens) {
  const first = tokens[0];
  return {
    type: first.type.replace(/_open$/, ''),
    tag: first.tag,
    tokens,
    line: first.map ? first.map[0] + 1 : 0,
    endLine: first.map ? first.map[1] : 0,
  };
}

export function headingText(block) {
  return block.tokens[1] ? block.tokens[1].content.trim() : '';
}

/** A paragraph that holds only one image. Returns the image token or null. */
export function soleImage(block) {
  if (block.type !== 'paragraph' || !block.tokens[0].meta?.figure) return null;
  return block.tokens[1].children.find((c) => c.type === 'image');
}
