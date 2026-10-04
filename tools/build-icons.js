/*
 * Draws the app icons (navy square, brass parcel outline with a corner pin) as PNGs without any
 * image library: a tiny supersampled rasterizer plus Node's zlib for the PNG encoding.
 * Run from the repo root:  node tools/build-icons.js
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const NAVY = [0x14, 0x21, 0x3d], NAVY2 = [0x22, 0x37, 0x63], BRASS = [0xe0, 0xb3, 0x5a];
const LOT = [[14, 44], [20, 18], [44, 14], [50, 36], [30, 50]]; // 64-unit design grid
const PIN = { x: 20, y: 18, r: 4.5 };
const STROKE = 3.2;

function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function distSeg(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}
function roundRect(x, y, s, r) {
  const cx = Math.min(Math.max(x, r), s - r), cy = Math.min(Math.max(y, r), s - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

// Color of one design-space point; scale/offset let the maskable icon keep the art in its safe zone
function sample(x, y, opts) {
  if (opts.rounded && !roundRect(x, y, 64, 14)) return null;
  const ux = (x - opts.offset) / opts.scale, uy = (y - opts.offset) / opts.scale;
  if (Math.hypot(ux - PIN.x, uy - PIN.y) <= PIN.r) return BRASS;
  let edge = Infinity;
  for (let i = 0; i < LOT.length; i++) edge = Math.min(edge, distSeg(ux, uy, LOT[i], LOT[(i + 1) % LOT.length]));
  if (edge <= STROKE / 2) return BRASS;
  if (inPoly(ux, uy, LOT)) return NAVY2;
  return NAVY;
}

function render(size, opts) {
  const ss = 4, px = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) for (let pxi = 0; pxi < size; pxi++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const x = (pxi + (sx + 0.5) / ss) * 64 / size, y = (py + (sy + 0.5) / ss) * 64 / size;
      const c = sample(x, y, opts);
      if (c) { r += c[0]; g += c[1]; b += c[2]; a += 255; }
    }
    const n = ss * ss, i = (py * size + pxi) * 4, cov = a / n;
    px[i] = cov ? Math.round(r / (a / 255)) : 0; px[i + 1] = cov ? Math.round(g / (a / 255)) : 0; px[i + 2] = cov ? Math.round(b / (a / 255)) : 0; px[i + 3] = Math.round(cov);
  }
  return px;
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

const out = path.join(__dirname, "..", "icons");
const files = [
  ["icon-192.png", 192, { rounded: true, scale: 1, offset: 0 }],
  ["icon-512.png", 512, { rounded: true, scale: 1, offset: 0 }],
  ["apple-touch-icon.png", 180, { rounded: false, scale: 1, offset: 0 }],
  // Maskable: full-bleed background, art shrunk into the central safe zone
  ["icon-maskable-512.png", 512, { rounded: false, scale: 0.72, offset: 64 * 0.14 }]
];
files.forEach(([name, size, opts]) => {
  fs.writeFileSync(path.join(out, name), png(size, render(size, opts)));
  console.log(name, size + "px");
});
