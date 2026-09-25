import { createRng, type Rng } from "@/lib/random";

/**
 * Deterministic SVG illustrations for demo listings. Original artwork generated
 * from a seed — no stock photos, no network, no licensing questions. Real
 * listings use uploaded photos via the StorageProvider instead.
 */

export const SCENES = ["exterior", "living", "kitchen", "bedroom", "bath", "outdoor"] as const;
export type Scene = (typeof SCENES)[number];

const W = 1200;
const H = 800;

const SKIES = [
  ["#bcd9ea", "#eef4f2"], // clear day
  ["#f2dcc0", "#f8efe3"], // golden hour
  ["#c9d6e8", "#f1ece4"], // soft overcast
  ["#a9cfe0", "#e4f0ea"], // bright
  ["#cfe1d8", "#f3f1e8"], // sage morning
  ["#b7cfe6", "#f4f1ea"], // high summer
];
const WALLS = ["#f3efe7", "#e9e4da", "#efe6dc", "#e4ebe6", "#ece8f0", "#f1e9df"];
const SIDING = [
  "#e8e1d4",
  "#d9ddd5",
  "#c9d3cf",
  "#e6d6c3",
  "#d4c9bc",
  "#bfcac4",
  "#efe9e1",
  "#a9b8b0",
];
const ROOFS = ["#4a4f55", "#5c4a43", "#3f4a47", "#6b5a4e", "#474b5a"];
const ACCENTS = ["#0f5c4c", "#b5654a", "#3e5c7a", "#8a6d3b", "#6b4f6e", "#2f4b45"];
const WOODS = ["#c49a6c", "#b08355", "#d4b08c", "#9c7650", "#e0c29e"];
const FABRICS = ["#6f8f86", "#c7b9a5", "#8b98a8", "#b88c7a", "#7b7f6e", "#d6cbb9"];

const rect = (x: number, y: number, w: number, h: number, fill: string, extra = "") =>
  `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" ${extra}/>`;
const poly = (pts: [number, number][], fill: string, extra = "") =>
  `<polygon points="${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}" fill="${fill}" ${extra}/>`;
const circle = (cx: number, cy: number, r: number, fill: string, extra = "") =>
  `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" ${extra}/>`;

function tree(r: Rng, x: number, groundY: number, scale = 1) {
  const h = r.float(150, 230) * scale;
  const trunk = rect(x - 7 * scale, groundY - h * 0.45, 14 * scale, h * 0.45, "#6d5846");
  const green = r.pick(["#5f8a6c", "#6e9676", "#4f7a5e", "#7aa07e", "#5a8266"]);
  const kind = r.int(0, 1);
  const crown =
    kind === 0
      ? `<ellipse cx="${x}" cy="${groundY - h * 0.62}" rx="${h * 0.3}" ry="${h * 0.36}" fill="${green}"/>`
      : poly(
          [
            [x, groundY - h],
            [x - h * 0.26, groundY - h * 0.3],
            [x + h * 0.26, groundY - h * 0.3],
          ],
          green,
        );
  return trunk + crown;
}

function windowBox(x: number, y: number, w: number, h: number, frame: string, glass = "#cfe0e6") {
  return (
    rect(x - 4, y - 4, w + 8, h + 8, frame, 'rx="3"') +
    rect(x, y, w, h, glass) +
    rect(x, y, w, h * 0.45, "#ffffff", 'opacity="0.35"') +
    rect(x + w / 2 - 2, y, 4, h, frame) +
    rect(x, y + h / 2 - 2, w, 4, frame)
  );
}

function exterior(r: Rng, type: string) {
  const [skyTop, skyBottom] = r.pick(SKIES);
  const groundY = 620;
  let s = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${skyTop}"/><stop offset="1" stop-color="${skyBottom}"/></linearGradient></defs>`;
  s += rect(0, 0, W, H, "url(#sky)");
  s += circle(r.float(150, 1050), r.float(90, 170), r.float(34, 52), "#fff7e6", 'opacity="0.85"');
  // distant hills
  s += `<path d="M0 ${groundY - 60} Q ${W * 0.25} ${groundY - r.float(120, 180)} ${W * 0.5} ${groundY - 70} T ${W} ${groundY - 80} V ${groundY} H 0 Z" fill="#b9cbb9" opacity="0.7"/>`;
  s += rect(0, groundY, W, H - groundY, r.pick(["#9dbb8e", "#a7c296", "#93b389"]));
  s += rect(0, groundY + 70, W, 18, "#d8d2c6");

  const siding = r.pick(SIDING);
  const roof = r.pick(ROOFS);
  const accent = r.pick(ACCENTS);
  const trim = "#fbfaf7";

  if (type === "land") {
    s += tree(r, 260, groundY, 1.2) + tree(r, 940, groundY, 1.4) + tree(r, 1080, groundY, 1);
    for (let x = 80; x < W; x += 70) s += rect(x, groundY - 40, 8, 50, "#8a7458");
    s +=
      rect(60, groundY - 30, W - 120, 5, "#8a7458") + rect(60, groundY - 12, W - 120, 5, "#8a7458");
    s +=
      rect(520, groundY - 120, 160, 70, "#f4efe4", 'rx="6"') +
      rect(596, groundY - 50, 8, 60, "#6d5846");
    return s;
  }

  s += tree(r, r.float(70, 160), groundY, 1.1) + tree(r, r.float(1030, 1140), groundY, 1.2);

  if (type === "condo" || type === "apartment") {
    const floors = r.int(5, 8);
    const bw = r.float(420, 520);
    const bx = (W - bw) / 2;
    const fh = 62;
    const top = groundY - floors * fh - 30;
    s += rect(bx, top, bw, groundY - top, siding);
    s += rect(bx - 10, top - 14, bw + 20, 18, roof);
    const cols = 5;
    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        const wx = bx + 28 + c * ((bw - 56) / cols);
        const wy = top + 26 + f * fh;
        s += rect(wx, wy, (bw - 56) / cols - 16, 38, r.bool(0.25) ? "#f6e7c1" : "#c8dbe2");
        if (r.bool(0.3)) s += rect(wx - 4, wy + 34, (bw - 56) / cols - 8, 6, accent);
      }
    }
    s +=
      rect(bx + bw / 2 - 45, groundY - 70, 90, 70, "#3b4a48") +
      rect(bx + bw / 2 - 60, groundY - 84, 120, 14, accent);
    // neighbouring building
    s += rect(bx + bw + 40, groundY - 260, 180, 260, r.pick(SIDING), 'opacity="0.8"');
    return s;
  }

  if (type === "townhouse") {
    const uw = 190;
    const start = (W - uw * 3) / 2;
    for (let i = 0; i < 3; i++) {
      const x = start + i * uw;
      const color = i === 1 ? accent : siding;
      s += rect(x, groundY - 300, uw, 300, color, `stroke="${trim}" stroke-width="4"`);
      s += poly(
        [
          [x - 6, groundY - 300],
          [x + uw / 2, groundY - 370],
          [x + uw + 6, groundY - 300],
        ],
        roof,
      );
      s +=
        windowBox(x + 30, groundY - 270, 50, 64, trim) +
        windowBox(x + 110, groundY - 270, 50, 64, trim);
      s += windowBox(x + 30, groundY - 170, 50, 64, trim);
      s +=
        rect(x + 112, groundY - 110, 48, 110, "#4a3b33") +
        circle(x + 150, groundY - 55, 3, "#d9c38a");
    }
    return s;
  }

  // Detached homes (single family, multi-family, manufactured)
  const low = type === "manufactured";
  const twoStory = !low && (type === "multi_family" || r.bool(0.55));
  const hw = low ? 560 : r.float(420, 520);
  const hh = low ? 150 : twoStory ? 290 : 190;
  const hx = (W - hw) / 2 - (low ? 0 : 60);
  const top = groundY - hh;
  s += rect(hx, top, hw, hh, siding);
  if (low) {
    s += rect(hx - 10, top - 16, hw + 20, 20, roof);
  } else if (r.bool(0.5)) {
    s += poly(
      [
        [hx - 24, top],
        [hx + hw / 2, top - r.float(110, 150)],
        [hx + hw + 24, top],
      ],
      roof,
    );
  } else {
    s += poly(
      [
        [hx - 20, top],
        [hx + 40, top - 90],
        [hx + hw - 40, top - 90],
        [hx + hw + 20, top],
      ],
      roof,
    );
  }
  s +=
    rect(hx + hw / 2 - 32, groundY - 120, 64, 120, accent) +
    circle(hx + hw / 2 + 20, groundY - 60, 4, "#e2cf97");
  s += rect(hx + hw / 2 - 50, groundY - 132, 100, 12, trim);
  s +=
    windowBox(hx + 50, groundY - 120, 80, 70, trim) +
    windowBox(hx + hw - 130, groundY - 120, 80, 70, trim);
  if (twoStory) {
    s +=
      windowBox(hx + 50, top + 40, 80, 70, trim) +
      windowBox(hx + hw / 2 - 40, top + 40, 80, 70, trim) +
      windowBox(hx + hw - 130, top + 40, 80, 70, trim);
  }
  if (!low && r.bool(0.6)) {
    // attached garage
    const gx = hx + hw;
    s += rect(gx, groundY - 170, 200, 170, siding, 'opacity="0.95"');
    s += poly(
      [
        [gx - 4, groundY - 170],
        [gx + 100, groundY - 230],
        [gx + 204, groundY - 170],
      ],
      roof,
    );
    s += rect(gx + 25, groundY - 130, 150, 130, "#eeeae3");
    for (let i = 1; i < 5; i++) s += rect(gx + 25, groundY - 130 + i * 26, 150, 2, "#d0cabe");
  }
  // shrubs
  for (let i = 0; i < 5; i++)
    s += `<ellipse cx="${hx + 20 + i * (hw / 5)}" cy="${groundY + 4}" rx="34" ry="22" fill="#6f9a74"/>`;
  if (type === "multi_family") s += rect(hx + hw / 2 - 2, top, 4, hh, trim);
  return s;
}

function room(r: Rng, scene: Scene) {
  const wall = r.pick(WALLS);
  const wood = r.pick(WOODS);
  const fabric = r.pick(FABRICS);
  const accent = r.pick(ACCENTS);
  const floorY = 560;
  let s = rect(0, 0, W, floorY, wall);
  s += `<defs><linearGradient id="fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${wood}"/><stop offset="1" stop-color="${wood}" stop-opacity="0.75"/></linearGradient></defs>`;
  s += rect(0, floorY, W, H - floorY, scene === "bath" ? "#e9e7e2" : "url(#fl)");
  if (scene !== "bath")
    for (let x = 0; x < W; x += 120) s += rect(x, floorY, 2, H - floorY, "#000", 'opacity="0.06"');
  s += rect(0, floorY - 14, W, 14, "#fbfaf7");
  // window with daylight
  const wx = r.float(120, 700);
  s += rect(wx - 8, 110, 336, 316, "#fbfaf7") + rect(wx, 118, 320, 300, "#cfe3ea");
  s += `<path d="M ${wx} 330 Q ${wx + 80} 270 ${wx + 160} 320 T ${wx + 320} 300 V 418 H ${wx} Z" fill="#9fc0a4" opacity="0.8"/>`;
  s += rect(wx + 158, 118, 4, 300, "#fbfaf7") + rect(wx, 266, 320, 4, "#fbfaf7");
  s += poly(
    [
      [wx, 418],
      [wx + 320, 418],
      [wx + 420, 700],
      [wx - 60, 700],
    ],
    "#fff",
    'opacity="0.12"',
  );

  if (scene === "living") {
    s += `<ellipse cx="600" cy="690" rx="360" ry="60" fill="${r.pick(FABRICS)}" opacity="0.55"/>`;
    s +=
      rect(330, 480, 540, 130, fabric, 'rx="26"') +
      rect(310, 440, 580, 80, fabric, 'rx="30" opacity="0.92"');
    s += rect(300, 500, 70, 110, fabric, 'rx="22"') + rect(830, 500, 70, 110, fabric, 'rx="22"');
    s +=
      rect(420, 470, 110, 60, accent, 'rx="14" opacity="0.85"') +
      rect(660, 470, 110, 60, "#e8dcc6", 'rx="14"');
    s +=
      rect(500, 640, 200, 16, wood, 'rx="6"') +
      rect(515, 656, 10, 40, "#5a4a3c") +
      rect(675, 656, 10, 40, "#5a4a3c");
    s +=
      rect(1000, 330, 6, 280, "#3d3d3d") +
      poly(
        [
          [960, 330],
          [1046, 330],
          [1030, 280],
          [976, 280],
        ],
        "#efe3c8",
      );
    s +=
      rect(150, 520, 70, 90, "#b9a58b", 'rx="8"') +
      `<ellipse cx="185" cy="480" rx="70" ry="70" fill="#6f9a74"/>`;
    s += rect(560, 180, 170, 120, accent, 'opacity="0.35"') + rect(572, 192, 146, 96, "#f4efe6");
  } else if (scene === "kitchen") {
    s += rect(0, 200, W, 30, "#fbfaf7");
    for (let x = 60; x < W - 60; x += 180)
      s +=
        rect(x, 60, 170, 130, accent, 'rx="6" opacity="0.9"') + rect(x + 78, 150, 14, 4, "#d8c28b");
    s += rect(0, 380, W, 180, accent, 'opacity="0.95"') + rect(0, 370, W, 16, "#f1ede6");
    for (let x = 60; x < W - 60; x += 180) s += rect(x + 78, 420, 14, 4, "#d8c28b");
    s += rect(300, 520, 600, 150, "#fbfaf7") + rect(290, 505, 620, 22, "#e6e1d7");
    for (const x of [420, 600, 780])
      s +=
        rect(x - 1, 0, 2, 250, "#3d3d3d") +
        poly(
          [
            [x - 36, 250],
            [x + 36, 250],
            [x + 22, 215],
            [x - 22, 215],
          ],
          "#d9c38a",
        );
    s += rect(360, 560, 50, 110, wood, 'rx="4"') + rect(790, 560, 50, 110, wood, 'rx="4"');
    s +=
      `<ellipse cx="520" cy="496" rx="46" ry="12" fill="#c7b9a5"/>` +
      circle(700, 480, 22, "#b5654a", 'opacity="0.8"');
  } else if (scene === "bedroom") {
    s += rect(360, 330, 480, 170, wood, 'rx="12"');
    s +=
      rect(330, 470, 540, 170, "#f7f4ee", 'rx="18"') + rect(330, 540, 540, 100, fabric, 'rx="18"');
    s +=
      rect(390, 440, 170, 60, "#ffffff", 'rx="16"') + rect(640, 440, 170, 60, "#ffffff", 'rx="16"');
    s += rect(220, 520, 90, 110, wood, 'rx="6"') + rect(890, 520, 90, 110, wood, 'rx="6"');
    s += circle(265, 490, 26, "#efe3c8") + circle(935, 490, 26, "#efe3c8");
    s += rect(470, 180, 260, 120, accent, 'opacity="0.3"');
  } else if (scene === "bath") {
    for (let y = 0; y < floorY; y += 60)
      for (let x = (y / 60) % 2 ? 0 : 60; x < W; x += 120)
        s += rect(x, y, 120, 60, "#fff", 'opacity="0.25"');
    s +=
      rect(120, 440, 520, 170, "#fbfaf7", 'rx="40"') +
      rect(140, 450, 480, 40, "#d9e8ec", 'rx="18"');
    s += rect(560, 360, 12, 90, "#b9b9b9");
    s += rect(780, 430, 300, 200, wood, 'rx="8"') + rect(770, 410, 320, 26, "#f1ede6");
    s += `<ellipse cx="930" cy="410" rx="70" ry="14" fill="#fff"/>`;
    s += rect(820, 140, 220, 230, "#dbe7ea", 'rx="110" stroke="#c9b58a" stroke-width="8"');
    s += `<ellipse cx="90" cy="560" rx="40" ry="60" fill="#6f9a74"/>`;
  }
  return s;
}

function outdoor(r: Rng) {
  const [skyTop, skyBottom] = r.pick(SKIES);
  const wood = r.pick(WOODS);
  let s = `<defs><linearGradient id="sky2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${skyTop}"/><stop offset="1" stop-color="${skyBottom}"/></linearGradient></defs>`;
  s += rect(0, 0, W, H, "url(#sky2)");
  s += rect(0, 420, W, 380, "#9dbb8e");
  for (let x = 0; x < W; x += 36) s += rect(x, 330, 30, 110, "#c9b28f");
  s += tree(r, 160, 440, 1.5) + tree(r, 1050, 440, 1.3);
  const pool = r.bool(0.4);
  if (pool) {
    s +=
      rect(640, 520, 460, 200, "#e9e3d8", 'rx="16"') +
      rect(665, 540, 410, 160, "#7cc3d0", 'rx="10"');
    s += `<path d="M680 600 q 40 -14 80 0 t 80 0 t 80 0 t 80 0" stroke="#fff" stroke-width="4" fill="none" opacity="0.6"/>`;
  }
  s += rect(0, 560, pool ? 600 : 1200, 240, wood);
  for (let y = 580; y < H; y += 30) s += rect(0, y, pool ? 600 : 1200, 3, "#000", 'opacity="0.08"');
  s +=
    rect(160, 600, 260, 14, "#4a4f55") +
    rect(180, 614, 10, 60, "#4a4f55") +
    rect(390, 614, 10, 60, "#4a4f55");
  s +=
    rect(90, 560, 70, 90, r.pick(FABRICS), 'rx="12"') +
    rect(430, 560, 70, 90, r.pick(FABRICS), 'rx="12"');
  s += circle(290, 540, 40, r.pick(ACCENTS), 'opacity="0.3"');
  for (let i = 0; i < 12; i++)
    s += circle(60 + i * 95, 110 + Math.sin(i) * 10, 5, "#fff3c4", 'opacity="0.9"');
  s += `<path d="M 0 100 Q 600 160 1200 100" stroke="#6b5a4e" stroke-width="2" fill="none"/>`;
  return s;
}

export function renderDemoImage(type: string, seed: string, scene: Scene): string {
  const r = createRng(`${seed}:${scene}`);
  let body: string;
  if (scene === "exterior") body = exterior(r, type);
  else if (scene === "outdoor") body = outdoor(r);
  else body = room(r, scene);
  const label = `<g opacity="0.75"><rect x="${W - 196}" y="${H - 52}" width="180" height="34" rx="17" fill="#15201c" opacity="0.55"/><text x="${W - 106}" y="${H - 30}" font-family="Inter, Arial, sans-serif" font-size="15" fill="#fff" text-anchor="middle">Illustration · demo</text></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice">${body}${label}</svg>`;
}
