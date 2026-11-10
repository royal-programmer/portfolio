/**
 * Prompt helpers that need no DOM: the ghost suggestion (fish-style, the rest of the best completion)
 * and the "did you mean" lookup (Damerau-Levenshtein over command names and view ids).
 */

/** Optimal string alignment distance: insert, delete, substitute, and swap two neighbours, each 1. */
export function damerau(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Up to `max` names within distance 2 (1 for words of three letters or fewer), nearest first; a shared prefix wins ties. */
export function didYouMean(word: string, pool: string[], max = 2): string[] {
  const w = word.toLowerCase();
  if (w.length < 2 || w.length > 24) return [];
  const limit = w.length <= 3 ? 1 : 2;
  const scored: Array<{ n: string; d: number; i: number }> = [];
  pool.forEach((n, i) => {
    if (scored.some((s) => s.n === n)) return;
    const d = damerau(w, n.toLowerCase());
    if (d <= limit && d < Math.max(w.length, n.length)) scored.push({ n, d, i });
  });
  scored.sort((a, b) => a.d - b.d || Number(b.n.startsWith(w[0])) - Number(a.n.startsWith(w[0])) || a.i - b.i);
  return scored.slice(0, max).map((s) => s.n);
}

/** Commands whose first argument is suggested from how often it was used. */
const ARG_COMMANDS = new Set(["view", "theme", "portrait"]);

/**
 * The text that would complete `input`, or "". Order: a bare `view `/`theme `/`portrait ` gets the most-used
 * argument from the history (else the first candidate); otherwise the most recent history line that starts
 * with the input; otherwise the first completion candidate for the last word.
 */
export function ghostFor(input: string, history: string[], complete: (input: string) => string[]): string {
  if (!input || input.startsWith("/") || input.length > 120) return "";
  const bare = /^(\w+)\s+$/.exec(input);
  if (bare && ARG_COMMANDS.has(bare[1].toLowerCase())) {
    const cands = complete(input);
    if (!cands.length) return "";
    const uses = new Map<string, number>();
    for (const h of history) {
      const m = /^\s*\/?(\w+)\s+(\S+)\s*$/.exec(h);
      if (m && m[1].toLowerCase() === bare[1].toLowerCase() && cands.includes(m[2])) uses.set(m[2], (uses.get(m[2]) ?? 0) + 1);
    }
    let best = cands[0];
    let top = 0;
    for (const [k, v] of uses) if (v > top) (best = k), (top = v);
    return best;
  }
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.length > input.length && h.startsWith(input)) return h.slice(input.length);
  }
  if (/\s$/.test(input)) return "";
  const word = /\S*$/.exec(input)?.[0] ?? "";
  const first = complete(input).find((c) => c.length > word.length && c.startsWith(word));
  return first ? first.slice(word.length) : "";
}
