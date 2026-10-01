// Parses the info string of a fenced code block.
//
//   swift file=AVCam/CaptureService.swift highlight=4-6,9
//   swift file=AVCam/Views/CameraPreview.swift new
//   swift file=AVCam/CaptureService.swift remove
//   settings title="Target AVCam › Info"
//   links

const FLAGS = ['new', 'remove', 'transient'];

export function parseInfo(info) {
  const out = {
    lang: '',
    file: null,
    title: null,
    highlight: [],
    highlightRaw: null,
    isNew: false,
    remove: false,
    transient: false,
    badHighlight: false,
  };
  let rest = String(info || '').trim();

  const lang = /^[^\s=]+(?=\s|$)/.exec(rest);
  if (lang) {
    out.lang = lang[0].toLowerCase();
    rest = rest.slice(lang[0].length);
  }

  // title="..." (quotes are needed when the title has spaces)
  rest = rest.replace(/(^|\s)title=(?:"([^"]*)"|(\S+))/, (m, lead, quoted, bare) => {
    out.title = quoted !== undefined ? quoted : bare;
    return ' ';
  });

  // file=path. The path can have spaces ("AVCam/Preview Content/X.swift"):
  // it ends at the next attribute or at the end of the line. Quotes also work.
  rest = rest.replace(
    /(^|\s)file=(?:"([^"]*)"|(.+?))(?=\s+(?:highlight=|new\b|remove\b|transient\b)|\s*$)/,
    (m, lead, quoted, bare) => {
      out.file = (quoted !== undefined ? quoted : bare).trim();
      return ' ';
    },
  );

  rest = rest.replace(/(^|\s)highlight=(\S*)/, (m, lead, value) => {
    out.highlightRaw = value;
    return ' ';
  });

  for (const flag of FLAGS) {
    const re = new RegExp(`(^|\\s)${flag}(?=\\s|$)`);
    if (re.test(rest)) {
      if (flag === 'new') out.isNew = true;
      else out[flag] = true;
      rest = rest.replace(re, ' ');
    }
  }

  if (out.highlightRaw !== null) {
    const parsed = parseRanges(out.highlightRaw);
    if (parsed) out.highlight = parsed;
    else out.badHighlight = true;
  }

  out.unknown = rest.trim();
  return out;
}

/** "4-6,9" -> [4, 5, 6, 9]. Returns null when the text is not valid. */
export function parseRanges(text) {
  const result = new Set();
  if (!text) return null;
  for (const part of text.split(',')) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
    if (!m) return null;
    const from = Number(m[1]);
    const to = m[2] ? Number(m[2]) : from;
    if (from < 1 || to < from) return null;
    for (let n = from; n <= to; n += 1) result.add(n);
  }
  return [...result].sort((a, b) => a - b);
}

/** [4, 5, 6, 9] -> "4-6, 9" */
export function formatRanges(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const parts = [];
  let start = null;
  let prev = null;
  for (const n of sorted) {
    if (start === null) {
      start = n;
    } else if (n !== prev + 1) {
      parts.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = n;
    }
    prev = n;
  }
  if (start !== null) parts.push(start === prev ? `${start}` : `${start}-${prev}`);
  return parts.join(', ');
}
