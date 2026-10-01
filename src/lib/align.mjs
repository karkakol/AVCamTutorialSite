// Finds where the lines of a code fence are in a file.
//
// A fence is a region of a file. Its lines must appear in the file in the
// same order, but the file can have more lines between them (code that a later
// step adds). The alignment prefers the placement with the fewest and the
// shortest gaps. When two placements are equal, the lines before a gap stay
// together (a closing brace belongs to the code above it). A fence line with no partner in the file is "unmatched".

// Whole numbers, so that two placements with the same gaps have equal cost.
const SKIP_FENCE_LINE = 1e9; // cost of a fence line that is not in the file
const GAP_OPEN = 1e5; // cost to start a run of extra file lines
const GAP_LINE = 1; // cost of each extra file line in a run
const LATER_MATCH = 1000; // cost to match a line that a later step adds

const norm = (line) => line.replace(/\s+$/, '');

/**
 * @param {string[]} fenceLines
 * @param {string[]} fileLines
 * @param {Set<number>} [later]  1-based file lines that later steps add. The
 *   learner does not have them yet at this step, so they cost nothing to skip.
 * @returns {{ map: number[], unmatched: number[] }}
 *   map[i] is the 1-based file line of fence line i, or 0 if it has none.
 *   unmatched lists the 0-based fence line indexes with no partner.
 */
export function align(fenceLines, fileLines, later = new Set()) {
  const a = fenceLines.map(norm);
  const b = fileLines.map(norm);
  const n = a.length;
  const m = b.length;
  const map = new Array(n).fill(0);
  if (n === 0) return { map, unmatched: [] };

  // File lines that are free to skip: empty lines and lines from later steps.
  const free = new Uint8Array(m + 1);
  const penalty = new Float64Array(m + 1);
  for (let j = 1; j <= m; j += 1) {
    if (b[j - 1] === '' || later.has(j)) free[j] = 1;
    if (later.has(j)) penalty[j] = LATER_MATCH;
  }

  const width = m + 1;
  // State 0: the last operation was a match or a skipped fence line.
  // State 1: the last operation was a skipped file line (inside a gap).
  const cost0 = new Float64Array((n + 1) * width).fill(Infinity);
  const cost1 = new Float64Array((n + 1) * width).fill(Infinity);
  const from0 = new Uint8Array((n + 1) * width); // 1 match<-0, 2 match<-1, 3 skip<-0, 4 skip<-1, 5 free file line
  const from1 = new Uint8Array((n + 1) * width); // 1 gap<-0, 2 gap<-1

  // Lines of the file before the fence are free.
  for (let j = 0; j <= m; j += 1) cost0[j] = 0;

  for (let i = 1; i <= n; i += 1) {
    const row = i * width;
    const prev = (i - 1) * width;
    for (let j = 0; j <= m; j += 1) {
      // Skip fence line i (it is not in the file).
      let best = Infinity;
      let how = 0;
      if (cost0[prev + j] + SKIP_FENCE_LINE < best) {
        best = cost0[prev + j] + SKIP_FENCE_LINE;
        how = 3;
      }
      if (cost1[prev + j] + SKIP_FENCE_LINE < best) {
        best = cost1[prev + j] + SKIP_FENCE_LINE;
        how = 4;
      }
      // Match fence line i with file line j.
      // On a tie, come from the gap: a repeated line (a closing brace) then
      // stays with the fence lines before the gap, not with the lines after it.
      if (j > 0 && a[i - 1] === b[j - 1]) {
        const direct = cost0[prev + j - 1] + penalty[j];
        const afterGap = cost1[prev + j - 1] + penalty[j];
        if (Math.min(direct, afterGap) <= best) {
          best = Math.min(direct, afterGap);
          how = afterGap <= direct ? 2 : 1;
        }
      }
      // Skip a free file line. It does not start a gap.
      if (j > 0 && i < n && free[j] && cost0[row + j - 1] < best) {
        best = cost0[row + j - 1];
        how = 5;
      }
      cost0[row + j] = best;
      from0[row + j] = how;

      // Skip file line j (a gap between two fence lines).
      if (j > 0 && i < n) {
        const lineCost = free[j] ? 0 : GAP_LINE;
        let gap = cost0[row + j - 1] + GAP_OPEN + lineCost;
        let gapHow = 1;
        if (cost1[row + j - 1] + lineCost < gap) {
          gap = cost1[row + j - 1] + lineCost;
          gapHow = 2;
        }
        cost1[row + j] = gap;
        from1[row + j] = gapHow;
      }
    }
  }

  // Lines of the file after the fence are free: take the best end column.
  let endJ = 0;
  let endCost = Infinity;
  for (let j = 0; j <= m; j += 1) {
    if (cost0[n * width + j] < endCost) {
      endCost = cost0[n * width + j];
      endJ = j;
    }
  }

  // Walk back.
  let i = n;
  let j = endJ;
  let state = 0;
  while (i > 0) {
    if (state === 0) {
      const how = from0[i * width + j];
      if (how === 1 || how === 2) {
        map[i - 1] = j;
        i -= 1;
        j -= 1;
        state = how === 1 ? 0 : 1;
      } else if (how === 5) {
        j -= 1;
      } else {
        i -= 1;
        state = how === 3 ? 0 : 1;
      }
    } else {
      const how = from1[i * width + j];
      j -= 1;
      state = how === 1 ? 0 : 1;
    }
  }

  const unmatched = [];
  for (let k = 0; k < n; k += 1) if (map[k] === 0) unmatched.push(k);
  return { map, unmatched };
}
