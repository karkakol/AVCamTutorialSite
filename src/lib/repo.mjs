// Read-only access to the app repository (the project that the learner builds).
// The site only reads from it: `git rev-parse`, `git show`, `git diff`.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export function openRepo(siteRoot) {
  const configured = process.env.APP_REPO || '../AVCamTutorialApp';
  const dir = path.resolve(siteRoot, configured);

  const git = (args) =>
    execFileSync('git', ['-C', dir, ...args], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    });

  let available = false;
  if (fs.existsSync(dir)) {
    try {
      available = git(['rev-parse', '--is-inside-work-tree']).trim() === 'true';
      // The folder must be the repository root, not a folder inside another one.
      if (available) {
        const top = fs.realpathSync(git(['rev-parse', '--show-toplevel']).trim());
        available = top === fs.realpathSync(dir);
      }
    } catch {
      available = false;
    }
  }

  const branchCache = new Map();
  const fileCache = new Map();
  const diffCache = new Map();

  return {
    dir,
    available,

    hasBranch(branch) {
      if (!available || !branch) return false;
      if (!branchCache.has(branch)) {
        let ok = false;
        try {
          git(['rev-parse', '--verify', '--quiet', `${branch}^{commit}`]);
          ok = true;
        } catch {
          ok = false;
        }
        branchCache.set(branch, ok);
      }
      return branchCache.get(branch);
    },

    /** The lines of a file on a branch, or null when the file is not there. */
    fileLines(branch, file) {
      if (!this.hasBranch(branch)) return null;
      const key = `${branch}:${file}`;
      if (!fileCache.has(key)) {
        let lines = null;
        try {
          const text = git(['show', key]);
          lines = text.replace(/\r\n/g, '\n').split('\n');
          if (lines.length && lines[lines.length - 1] === '') lines.pop();
        } catch {
          lines = null;
        }
        fileCache.set(key, lines);
      }
      return fileCache.get(key);
    },

    /**
     * The lines that `git diff start branch` adds to Swift files.
     * @returns {Map<string, {line: number, text: string}[]> | null}
     */
    addedSwiftLines(start, branch) {
      if (!this.hasBranch(start) || !this.hasBranch(branch)) return null;
      const key = `${start}..${branch}`;
      if (!diffCache.has(key)) {
        const out = git(['diff', '--no-color', '--no-ext-diff', '-M', '--unified=0', start, branch, '--', '*.swift']);
        diffCache.set(key, parseAddedLines(out));
      }
      return diffCache.get(key);
    },

    /**
     * The lines that `git diff start branch` removes from Swift files.
     * A removed line whose text is also an added line of the same file is a moved line and is left out.
     * @returns {Map<string, {text: string}[]> | null}
     */
    removedSwiftLines(start, branch) {
      if (!this.hasBranch(start) || !this.hasBranch(branch)) return null;
      const out = git(['diff', '--no-color', '--no-ext-diff', '-M', '--unified=0', start, branch, '--', '*.swift']);
      return parseRemovedLines(out);
    },
  };
}

function parseRemovedLines(diffText) {
  const files = new Map();
  let oldName = null;
  let removed = [];
  let added = new Set();
  const flush = (newName) => {
    // A deleted file has no new name; the page lists it in `uncovered:`.
    const file = newName || oldName;
    if (file && removed.length) {
      files.set(file, removed.filter((l) => !added.has(l.text.trim())));
    }
  };
  let newName = null;
  for (const raw of diffText.split('\n')) {
    if (raw.startsWith('diff --git')) {
      flush(newName);
      oldName = null; newName = null; removed = []; added = new Set();
    } else if (raw.startsWith('--- ')) {
      const name = unquote(raw.slice(4).trim());
      oldName = name === '/dev/null' ? null : (name.startsWith('a/') ? name.slice(2) : name);
    } else if (raw.startsWith('+++ ')) {
      const name = unquote(raw.slice(4).trim());
      newName = name === '/dev/null' ? null : (name.startsWith('b/') ? name.slice(2) : name);
    } else if (raw.startsWith('-') && !raw.startsWith('---')) {
      removed.push({ text: raw.slice(1).replace(/\r$/, '') });
    } else if (raw.startsWith('+') && !raw.startsWith('+++')) {
      added.add(raw.slice(1).trim());
    }
  }
  flush(newName);
  return files;
}

function parseAddedLines(diffText) {
  const files = new Map();
  let current = null;
  let lineNo = 0;
  for (const raw of diffText.split('\n')) {
    if (raw.startsWith('+++ ')) {
      const name = unquote(raw.slice(4).trim());
      if (name === '/dev/null') {
        current = null;
      } else {
        const file = name.startsWith('b/') ? name.slice(2) : name;
        current = [];
        files.set(file, current);
      }
    } else if (raw.startsWith('@@')) {
      const m = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
      lineNo = m ? Number(m[1]) : 0;
    } else if (raw.startsWith('+') && !raw.startsWith('+++') && current) {
      current.push({ line: lineNo, text: raw.slice(1).replace(/\r$/, '') });
      lineNo += 1;
    }
  }
  return files;
}

// git quotes paths with special characters: "a/b\303\244.swift"
function unquote(name) {
  if (!name.startsWith('"')) return name;
  try {
    const bytes = [];
    const body = name.slice(1, -1);
    for (let i = 0; i < body.length; i += 1) {
      if (body[i] === '\\') {
        const oct = /^[0-7]{3}/.exec(body.slice(i + 1));
        if (oct) {
          bytes.push(parseInt(oct[0], 8));
          i += 3;
        } else {
          const map = { n: 10, t: 9, '"': 34, '\\': 92 };
          bytes.push(map[body[i + 1]] ?? body.charCodeAt(i + 1));
          i += 1;
        }
      } else {
        bytes.push(...Buffer.from(body[i], 'utf8'));
      }
    }
    return Buffer.from(bytes).toString('utf8');
  } catch {
    return name;
  }
}
