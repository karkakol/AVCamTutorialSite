// Build-time syntax highlighting with Shiki.
// The theme below uses placeholder colours. Each placeholder maps to a short
// CSS class, so that the real colours live in site.css (light and dark).

import { createHighlighter } from 'shiki';
import { escapeHtml } from './util.mjs';

const CLASS_BY_COLOR = {
  '#000001': 'k', // keyword
  '#000002': 's', // string
  '#000003': 'c', // comment
  '#000004': 'n', // number, constant
  '#000005': 't', // type
  '#000006': 'f', // function
  '#000007': 'a', // attribute
  '#000008': 'o', // operator, punctuation
};

const theme = {
  name: 'site',
  type: 'light',
  colors: { 'editor.foreground': '#000000', 'editor.background': '#ffffff' },
  tokenColors: [
    { scope: ['keyword.operator', 'punctuation'], settings: { foreground: '#000008' } },
    {
      scope: ['keyword', 'storage.type', 'storage.modifier', 'variable.language', 'keyword.operator.type-casting', 'keyword.other'],
      settings: { foreground: '#000001' },
    },
    { scope: ['string', 'string punctuation'], settings: { foreground: '#000002' } },
    { scope: ['meta.embedded', 'string meta.embedded', 'meta.embedded punctuation'], settings: { foreground: '#000000' } },
    { scope: ['comment', 'comment punctuation', 'punctuation.definition.comment'], settings: { foreground: '#000003' } },
    { scope: ['constant.numeric', 'constant.language', 'constant.character'], settings: { foreground: '#000004' } },
    {
      scope: ['entity.name.type', 'support.type', 'support.class', 'entity.other.inherited-class', 'meta.type-name', 'entity.name.tag'],
      settings: { foreground: '#000005' },
    },
    { scope: ['entity.name.function', 'support.function', 'entity.other.attribute-name'], settings: { foreground: '#000006' } },
    {
      scope: ['meta.attribute', 'storage.modifier.attribute', 'punctuation.definition.attribute', 'keyword.control.directive', 'meta.preprocessor'],
      settings: { foreground: '#000007' },
    },
  ],
};

const LANGS = ['swift', 'shellscript', 'json', 'xml', 'yaml', 'diff', 'objective-c', 'markdown'];
const ALIASES = {
  sh: 'shellscript',
  bash: 'shellscript',
  zsh: 'shellscript',
  shell: 'shellscript',
  console: 'shellscript',
  plist: 'xml',
  entitlements: 'xml',
  objc: 'objective-c',
  yml: 'yaml',
  md: 'markdown',
};

export async function createCodeHighlighter() {
  const shiki = await createHighlighter({ themes: [theme], langs: LANGS });
  const cache = new Map();

  /** Returns one HTML string for each line of the code. */
  function highlight(code, lang) {
    const name = ALIASES[lang] || lang;
    const key = `${name}\u0000${code}`;
    if (cache.has(key)) return cache.get(key);
    let lines;
    if (!LANGS.includes(name)) {
      lines = code.split('\n').map(escapeHtml);
    } else {
      const { tokens } = shiki.codeToTokens(code, { lang: name, theme: 'site' });
      lines = tokens.map((line) => line.map((t) => tokenHtml(t, name)).join(''));
    }
    cache.set(key, lines);
    return lines;
  }

  return { highlight };
}

function span(cls, text) {
  if (text === '') return '';
  return cls ? `<span class="${cls}">${escapeHtml(text)}</span>` : escapeHtml(text);
}

// The Swift grammar gives no scope to most type names in expressions.
// A capitalised identifier is nearly always a type in Swift code.
const SWIFT_TYPE_RE = /(?<!\w)[A-Z][A-Za-z0-9_]*\b/g;

function tokenHtml(token, lang) {
  const cls = CLASS_BY_COLOR[(token.color || '').toLowerCase()] || '';
  const text = token.content;
  if (lang === 'swift' && (cls === '' || cls === 'f' || cls === 'o')) {
    let out = '';
    let last = 0;
    for (const m of text.matchAll(SWIFT_TYPE_RE)) {
      out += span(cls, text.slice(last, m.index));
      out += span('t', m[0]);
      last = m.index + m[0].length;
    }
    if (last === 0) return span(cls, text);
    return out + span(cls, text.slice(last));
  }
  return span(cls, text);
}
