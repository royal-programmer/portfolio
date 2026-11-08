/**
 * A small QR encoder for the terminal's `qr` command: byte mode, error correction M, versions 1-6
 * (a URL of up to 106 bytes), Reed-Solomon, the eight masks with penalty scoring. Pure, no
 * dependencies. Layout and algorithm follow ISO/IEC 18004.
 */

/** Per version (index 1-6) at level M: [EC codewords per block, number of blocks, total codewords]. */
const M_TABLE: Record<number, [number, number, number]> = {
  1: [10, 1, 26],
  2: [16, 1, 44],
  3: [26, 1, 70],
  4: [18, 2, 100],
  5: [24, 2, 134],
  6: [16, 4, 172],
};
const ALIGN: Record<number, number[]> = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34] };

// GF(256) with the QR polynomial 0x11D.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function rsDivisor(degree: number): number[] {
  const r = Array<number>(degree).fill(0);
  r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      r[j] = mul(r[j], root);
      if (j + 1 < degree) r[j] ^= r[j + 1];
    }
    root = mul(root, 2);
  }
  return r;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const r = Array<number>(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ (r.shift() as number);
    r.push(0);
    divisor.forEach((c, i) => (r[i] ^= mul(c, factor)));
  }
  return r;
}

/** The module grid (true = dark) for `text`, or null if it does not fit in version 6. */
export function qrModules(text: string): boolean[][] | null {
  const bytes = Array.from(new TextEncoder().encode(text));
  let ver = 0;
  for (let v = 1; v <= 6; v++) {
    const [ec, blocks, total] = M_TABLE[v];
    if (bytes.length <= total - ec * blocks - 2) {
      ver = v;
      break;
    }
  }
  if (!ver) return null;
  const [ecLen, nBlocks, totalCw] = M_TABLE[ver];
  const dataCw = totalCw - ecLen * nBlocks;

  // Data bits: mode 0100 (byte), 8-bit count, bytes, terminator, pad to a byte, then 0xEC 0x11 filler.
  const bits: number[] = [];
  const put = (v: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1);
  };
  put(0b0100, 4);
  put(bytes.length, 8);
  bytes.forEach((b) => put(b, 8));
  put(0, Math.min(4, dataCw * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let pad = 0xec; data.length < dataCw; pad ^= 0xec ^ 0x11) data.push(pad);

  // Blocks, their EC, interleaved.
  const blockLen = dataCw / nBlocks;
  const div = rsDivisor(ecLen);
  const dBlocks: number[][] = [];
  const eBlocks: number[][] = [];
  for (let b = 0; b < nBlocks; b++) {
    const d = data.slice(b * blockLen, (b + 1) * blockLen);
    dBlocks.push(d);
    eBlocks.push(rsRemainder(d, div));
  }
  const code: number[] = [];
  for (let i = 0; i < blockLen; i++) dBlocks.forEach((b) => code.push(b[i]));
  for (let i = 0; i < ecLen; i++) eBlocks.forEach((b) => code.push(b[i]));

  const size = ver * 4 + 17;
  const mod: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const fn: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const setFn = (x: number, y: number, dark: boolean) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    mod[y][x] = dark;
    fn[y][x] = true;
  };

  for (let i = 0; i < size; i++) {
    setFn(6, i, i % 2 === 0);
    setFn(i, 6, i % 2 === 0);
  }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        setFn(cx + dx, cy + dy, d !== 2 && d !== 4);
      }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  const pos = ALIGN[ver];
  pos.forEach((py, i) =>
    pos.forEach((px, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFn(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }),
  );

  const drawFormat = (mask: number) => {
    // Level M is 00; BCH(15,5) with 0x537, xor 0x5412.
    let rem = mask;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const f = ((mask << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((f >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) setFn(8, i, bit(i));
    setFn(8, 7, bit(6));
    setFn(8, 8, bit(7));
    setFn(7, 8, bit(8));
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(i));
    setFn(8, size - 8, true);
  };
  drawFormat(0);

  // Codewords, zigzag from the bottom right, skipping column 6 and function modules.
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < size; v++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? size - 1 - v : v;
        if (!fn[y][x] && k < code.length * 8) {
          mod[y][x] = ((code[k >>> 3] >>> (7 - (k & 7))) & 1) === 1;
          k++;
        }
      }
  }

  const applyMask = (m: number) => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        if (fn[y][x]) continue;
        const inv =
          m === 0 ? (x + y) % 2 === 0
          : m === 1 ? y % 2 === 0
          : m === 2 ? x % 3 === 0
          : m === 3 ? (x + y) % 3 === 0
          : m === 4 ? (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0
          : m === 5 ? ((x * y) % 2) + ((x * y) % 3) === 0
          : m === 6 ? (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
          : (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
        if (inv) mod[y][x] = !mod[y][x];
      }
  };

  const penalty = (): number => {
    let p = 0;
    const lines = (get: (a: number, b: number) => boolean) => {
      for (let a = 0; a < size; a++) {
        let run = 1;
        let s = "";
        for (let b = 0; b < size; b++) {
          s += get(a, b) ? "1" : "0";
          if (b > 0 && get(a, b) === get(a, b - 1)) {
            run++;
            if (run === 5) p += 3;
            else if (run > 5) p += 1;
          } else run = 1;
        }
        for (const pat of ["10111010000", "00001011101"]) for (let i = s.indexOf(pat); i >= 0; i = s.indexOf(pat, i + 1)) p += 40;
      }
    };
    lines((a, b) => mod[a][b]);
    lines((a, b) => mod[b][a]);
    for (let y = 0; y < size - 1; y++)
      for (let x = 0; x < size - 1; x++) if (mod[y][x] === mod[y][x + 1] && mod[y][x] === mod[y + 1][x] && mod[y][x] === mod[y + 1][x + 1]) p += 3;
    let dark = 0;
    mod.forEach((r) => r.forEach((c) => c && dark++));
    p += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
    return p;
  };

  let best = 0;
  let bestP = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(m);
    drawFormat(m);
    const p = penalty();
    if (p < bestP) {
      bestP = p;
      best = m;
    }
    applyMask(m); // undo
  }
  applyMask(best);
  drawFormat(best);
  return mod;
}

/**
 * Text rows for the terminal: two modules per row with `▀ ▄ █` and spaces. Dark modules are drawn as
 * ink on a light tile (the caller paints the tile), with a quiet zone of `quiet` modules, so phone
 * scanners see the usual dark-on-light code.
 */
export function qrLines(modules: boolean[][], quiet = 4): string[] {
  const n = modules.length + quiet * 2;
  const at = (x: number, y: number) => {
    const mx = x - quiet;
    const my = y - quiet;
    return mx >= 0 && my >= 0 && mx < modules.length && my < modules.length && modules[my][mx];
  };
  const rows: string[] = [];
  for (let y = 0; y < n; y += 2) {
    let r = "";
    for (let x = 0; x < n; x++) {
      const top = at(x, y);
      const bot = y + 1 < n && at(x, y + 1);
      r += top && bot ? "█" : top ? "▀" : bot ? "▄" : " ";
    }
    rows.push(r);
  }
  return rows;
}
