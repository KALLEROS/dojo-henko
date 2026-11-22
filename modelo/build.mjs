// =========================================================
//  Modelo isométrico del Dojo Henko (sin alumnos).
//  Genera modelo/vistas.js con 4 vistas del salón (una por esquina).
//  Correr:  node modelo/build.mjs
//  Medidas aproximadas a partir de las fotos: cada cuadro de tatami = 1 m.
// =========================================================
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const M = 20; // unidades del dibujo por metro
const W = 1000, H = 700;
const ELEV = 33;
const T = 0.15; // grosor de muro (m)
const ENTRADA = 1.2; // franja de loseta junto al vidrio (m) — supuesto
const TAT = 7; // tatami de 7 × 7 m, de pared a pared
const ROOM = { L: ENTRADA + TAT, W: TAT, H: 2.8 }; // salón principal
const ALC = { x0: ENTRADA + TAT, x1: ENTRADA + TAT + 2.2, y0: 0, y1: 2.6 }; // pasillo del fondo (bodega y baño) — supuesto
const CUT = 0.55; // altura de los muros recortados (los que quedan frente a la cámara)
const AZIMUTHS = [225, 315, 45, 135];

const m = (v) => v * M;
const pt = (x, y, z) => [m(x), m(y), m(z)];

// ---------- materiales (color solo donde el color es el tema: tatami, costales, conos) ----------
const MATS = {
  wall: "#f7eaeb", red: "#e0434d", blue: "#3b70cc", black: "#2b2729", steel: "#8d8b90", tan: "#d59a6c",
  orange: "#ef7a1f", yellow: "#f2c21b", white: "#fbfafa", wood: "#5a4636", tile: "#ece8e3", magenta: "#c8124f",
  green: "#3f9a5b", terracotta: "#b8643f", floor: "#cfc8c2",
};
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (rgb) => "#" + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const shade = (h, f) => toHex(hex(h).map((v) => v * f));
const lift = (h, f) => toHex(hex(h).map((v) => v + (255 - v) * f));
const matCss = Object.entries(MATS).map(([name, c]) => {
  const s = [0.62, 0.7, 0.78, 0.86].map((f) => shade(c, f));
  const sel = `.mt-${name}`;
  return [
    `${sel}>.iso-top{fill:${lift(c, 0.06)}}`,
    ...s.map((v, i) => `${sel}>.iso-shade[data-shade="${i}"]{fill:${v}}${sel}[data-seamless]>.iso-shade[data-shade="${i}"]{stroke:${v}}`),
    `${sel}[data-seamless]>.iso-top{stroke:${lift(c, 0.06)}}`,
    `${sel}>.iso-fill{fill:${shade(c, 0.8)}}`,
    `${sel}>.iso-edge{stroke:${shade(c, 0.45)}}`,
    `.ln-${name}{stroke:${shade(c, 0.55)}}`,
    `.fl-${name}{fill:${c}}`,
  ].join("");
}).join("\n");

// ---------- una vista ----------
function buildView(azimuth, scale) {
  const unitP = { origin: [0, 0], scale: 1, azimuth, elevation: ELEV };
  const box = [];
  for (const x of [0, ALC.x1]) for (const y of [0, ROOM.W]) for (const z of [0, ROOM.H]) box.push(pt(x, y, z));
  const flat = box.map((p) => k.iso(p, unitP));
  const xs = flat.map((f) => f[0]), ys = flat.map((f) => f[1]);
  const P = {
    origin: [W / 2 - ((Math.min(...xs) + Math.max(...xs)) / 2) * scale, H / 2 - ((Math.min(...ys) + Math.max(...ys)) / 2) * scale],
    scale, azimuth, elevation: ELEV,
  };
  const V = k.towardViewer(P);
  const at = (p) => k.iso(p, P);
  const depth = (p) => k.depthOf(p, P);
  const S = (paths, mat, o = {}) => k.solidSvg(paths, { tone: "hi", crease: "none", ...o, className: `mt-${mat}${o.className ? " " + o.className : ""}` });
  const L = (d, cls, o = {}) => k.lineSvg(d, { ...o, className: cls });
  const box3 = (x0, y0, z0, x1, y1, z1) => k.slabOf({ x: m(x0), y: m(y0), w: m(x1 - x0), d: m(y1 - y0), r: 0 }, m(z0), m(z1 - z0), P, 2);
  const rbox = (x0, y0, z0, x1, y1, z1, r) => k.slabOf({ x: m(x0), y: m(y0), w: m(x1 - x0), d: m(y1 - y0), r: m(r) }, m(z0), m(z1 - z0), P, 6);
  const cyl = (x, y, r, z0, z1, steps = 28) => k.cylinder(m(x), m(y), m(r), m(z0), m(z1 - z0), P, steps);
  const quad = (pts, cls) => `<path class="${cls}" d="${k.pathOf(pts.map((p) => at(pt(...p))), true)}"/>`;
  const seg = (a, b, cls, o) => L(k.segment(pt(...a), pt(...b), P), cls, o);
  const visible = (n) => n[0] * V[0] + n[1] * V[1] > 1e-6; // ¿la cara con esa normal mira a la cámara?

  // muros: normal hacia adentro del salón; "lejos" = se ve su cara interior → completo; "cerca" = recortado
  const WALLS = {
    front: { n: [1, 0], box: [-T, 0, 0, ROOM.W] },
    left: { n: [0, 1], box: [0, -T, ALC.x1 + T, 0] },
    right: { n: [0, -1], box: [0, ROOM.W, ROOM.L + T, ROOM.W + T] },
    back: { n: [-1, 0], box: [ROOM.L, ALC.y1, ROOM.L + T, ROOM.W + T] },
    alcSide: { n: [0, -1], box: [ROOM.L + T, ALC.y1, ALC.x1 + T, ALC.y1 + T] },
    alcBack: { n: [-1, 0], box: [ALC.x1, -T, ALC.x1 + T, ALC.y1 + T] },
  };
  const far = (w) => visible(WALLS[w].n);

  const back = [], items = [], front = [];
  const put = (anchor, svg, extra = "") => items.push({ key: depth(pt(...anchor)), svg: extra ? `<g ${extra}>${svg}</g>` : svg });
  const piece = (name, info) => `class="pz" data-name="${name}" data-info="${info}"`;

  // ---------- piso ----------
  back.push(`<path class="iso-halo" d="${k.haloOf({ x: m(-T), y: m(-T), w: m(ALC.x1 + 2 * T), d: m(ROOM.W + 2 * T), r: 0 }, m(-0.12), 1, P)}"/>`);
  back.push(S(box3(-T, -T, -0.12, ROOM.L + T, ROOM.W + T, 0), "floor"));
  back.push(S(box3(ROOM.L, -T, -0.12, ALC.x1 + T, ALC.y1 + T, 0), "floor"));
  // loseta: entrada y pasillo del fondo
  const tiles = (x0, y0, x1, y1) => {
    let out = quad([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]], "fl-tile");
    for (let x = x0 + 0.5; x < x1 - 0.01; x += 0.5) out += seg([x, y0, 0], [x, y1, 0], "ln-tile");
    for (let y = y0 + 0.5; y < y1 - 0.01; y += 0.5) out += seg([x0, y, 0], [x1, y, 0], "ln-tile");
    return out;
  };
  back.push(tiles(0, 0, ENTRADA, ROOM.W), tiles(ALC.x0, 0, ALC.x1, ALC.y1));

  // ---------- tatami (cuadros de 1 m, 2.5 cm de grueso) ----------
  const MT = 0.025;
  const X0 = ENTRADA, X1 = ENTRADA + TAT; // tatami a lo largo
  const B0 = [X0 + 1, 1], B1 = [X1 - 1, TAT - 1]; // centro azul de 5 × 5 (borde rojo de un cuadro)
  back.push(`<g ${piece("Tatami", "7 × 7 m · cuadros de 1 × 1 m · borde rojo de un cuadro")}>`);
  back.push(S(box3(X0, 0, 0, X1, ROOM.W, MT), "red", { tone: "lo" }));
  back.push(quad([[B0[0], B0[1], MT], [B1[0], B0[1], MT], [B1[0], B1[1], MT], [B0[0], B1[1], MT]], "fl-blue"));
  // 21 azules + 4 rojos dentro del centro (posición de los rojos: supuesto, en rombo)
  for (const [i, j] of [[2, 1], [1, 2], [3, 2], [2, 3]]) {
    const x = B0[0] + i, y = B0[1] + j;
    back.push(quad([[x, y, MT], [x + 1, y, MT], [x + 1, y + 1, MT], [x, y + 1, MT]], "fl-red"));
  }
  // dientes del rompecabezas en el borde rojo/azul
  const teeth = (a, b) => {
    const [x0, y0] = a, [x1, y1] = b;
    const len = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / len, uy = (y1 - y0) / len, nx = -uy, ny = ux;
    const step = 0.1, amp = 0.035, out = [];
    for (let s = 0; s <= len + 1e-6; s += step) {
      const odd = Math.round(s / step) % 2;
      const o = odd ? amp : -amp;
      out.push([x0 + ux * s + nx * o, y0 + uy * s + ny * o, MT]);
      const s2 = Math.min(len, s + step);
      out.push([x0 + ux * s2 + nx * o, y0 + uy * s2 + ny * o, MT]);
    }
    return k.pathOf(out.map((p) => at(pt(...p))));
  };
  back.push(L([teeth([B0[0], B0[1]], [B1[0], B0[1]]), teeth([B1[0], B0[1]], [B1[0], B1[1]]), teeth([B1[0], B1[1]], [B0[0], B1[1]]), teeth([B0[0], B1[1]], [B0[0], B0[1]])].join(""), "ln-mat"));
  // juntas de 1 m
  let joints = "";
  for (let x = X0 + 1; x < X1 - 0.01; x += 1) joints += seg([x, 0, MT], [x, ROOM.W, MT], "ln-joint");
  for (let y = 1; y < ROOM.W - 0.01; y += 1) joints += seg([X0, y, MT], [X1, y, MT], "ln-joint");
  back.push(joints);
  // textura de las placas (rombos tenues), solo en algunos cuadros para no ensuciar
  let weave = "";
  for (let x = X0; x < X1 - 0.01; x += 1) for (let y = 0; y < ROOM.W - 0.01; y += 1) {
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      weave += k.pathOf([at(pt(x + t, y + 0.04, MT)), at(pt(x + t, y + 0.96, MT))]);
    }
  }
  back.push(`<path class="iso-line ln-weave" d="${weave}"/>`);
  back.push(`</g>`);

  // escalera de coordinación sobre el borde rojo
  {
    const y0 = 0.25, y1 = 0.75, x0 = ENTRADA + 1.3, x1 = ENTRADA + 5.8;
    let s = S(box3(x0, y0 - 0.02, MT, x1, y0 + 0.02, MT + 0.01), "black", { flat: true }) + S(box3(x0, y1 - 0.02, MT, x1, y1 + 0.02, MT + 0.01), "black", { flat: true });
    for (let x = x0 + 0.1; x < x1; x += 0.45) s += S(box3(x - 0.025, y0, MT + 0.002, x + 0.025, y1, MT + 0.012), "yellow", { flat: true });
    back.push(`<g ${piece("Escalera de coordinación", "4.5 m, peldaños cada 45 cm")}>${s}</g>`);
  }
  // aros en el piso, junto a la pared del fondo
  {
    let s = "";
    [[X1 - 0.5, 3.4, 0.33, "magenta"], [X1 - 0.45, 4.1, 0.3, "green"], [X1 - 0.55, 4.8, 0.32, "orange"]].forEach(([x, y, r, c]) => {
      s += L(k.ring(m(x), m(y), m(r), m(MT + 0.01), P, 48), `ln-hoop hoop-${c}`);
    });
    back.push(`<g ${piece("Aros de agilidad", "60–66 cm de diámetro")}>${s}</g>`);
  }

  // ---------- muros ----------
  function wallSvg(name) {
    const [x0, y0, x1, y1] = WALLS[name].box;
    const isFar = far(name);
    const top = isFar ? ROOM.H : CUT;
    let s = "";
    if (name === "front") {
      // fachada de vidrio con canceles de aluminio
      const posts = [0, 1.5, 3.0, 4.0, 5.5, ROOM.W];
      const glassTop = isFar ? 2.35 : CUT;
      s += S(box3(-T, 0, 0, 0, ROOM.W, 0.12), "steel", { tone: "lo" });
      for (let i = 0; i < posts.length - 1; i++) {
        const a = posts[i] + 0.04, b = posts[i + 1] - 0.04;
        s += quad([[-0.07, a, 0.12], [-0.07, b, 0.12], [-0.07, b, glassTop], [-0.07, a, glassTop]], "glass");
        if (isFar && b - a > 0.6) {
          const g1 = [pt(-0.07, a + 0.15, 1.0), pt(-0.07, a + 0.55, 1.9)].map(at);
          const g2 = [pt(-0.07, a + 0.3, 0.9), pt(-0.07, a + 0.6, 1.45)].map(at);
          s += k.fadeLineSvg(g1, { fade: [6, 6], tone: "faint", className: "glare" }) + k.fadeLineSvg(g2, { fade: [5, 5], tone: "faint", className: "glare" });
        }
      }
      for (const y of posts) s += S(box3(-T, y - 0.04, 0.12, 0, y + 0.04, glassTop), "steel", { tone: "lo" });
      // puerta: marco más grueso y jaladera
      s += S(box3(-T, 3.0, 0.12, -0.02, 3.08, glassTop), "steel", { tone: "lo" }) + S(box3(-T, 3.92, 0.12, -0.02, 4.0, glassTop), "steel", { tone: "lo" });
      if (isFar) {
        s += S(box3(-0.02, 3.72, 0.95, 0.03, 3.76, 1.25), "steel");
        s += S(box3(-T, 0, 2.35, 0, ROOM.W, ROOM.H), "wall", { tone: "lo" });
        s += S(box3(-T, 0, 2.3, 0, ROOM.W, 2.35), "steel", { tone: "lo" });
      } else {
        s += S(box3(-T, 0, CUT, 0, ROOM.W, CUT + 0.02), "steel", { tone: "lo" });
      }
      return s;
    }
    s += S(box3(x0, y0, 0, x1, y1, top), "wall", { tone: "lo" });
    return s;
  }

  // regla en la parte alta de los muros recortados: marcas cada 50 cm, número cada 2 m
  function rulerOn(name) {
    const [x0, y0, x1, y1] = WALLS[name].box;
    const z = name === "front" ? CUT + 0.02 : CUT;
    let minor = "", major = "", text = "";
    const alongX = name !== "front";
    const from = alongX ? Math.max(0, x0) : 0, to = alongX ? Math.min(x1, name === "left" ? ALC.x1 : ROOM.L) : ROOM.W;
    const mid = alongX ? (y0 + y1) / 2 : (x0 + x1) / 2;
    const half = alongX ? (y1 - y0) / 2 : (x1 - x0) / 2;
    for (let v = 0; v <= to - from + 1e-6; v += 0.5) {
      const isMajor = Math.abs(v - Math.round(v)) < 1e-6;
      const len = isMajor ? half * 0.95 : half * 0.5;
      const a = alongX ? [from + v, mid - half, z] : [mid - half, from + v, z];
      const b = alongX ? [from + v, mid - half + len, z] : [mid - half + len, from + v, z];
      const d = k.segment(pt(...a), pt(...b), P);
      if (isMajor) major += d; else minor += d;
      if (isMajor && Math.round(v) % 2 === 0 && v > 0) {
        const c = alongX ? [from + v + 0.05, mid + half * 0.35] : [mid + half * 0.35, from + v + 0.05];
        text += k.faceTextSvg(k.topMatrix([m(c[0]), m(c[1])], m(z), P, alongX ? "x" : "y"), `${Math.round(v)} m`, { size: 2.6, tone: "mid" });
      }
    }
    return `<g ${piece("Regla", "Marcas cada 50 cm, número cada 2 m")}>` + L(minor, "", { tone: "lo" }) + L(major, "", { tone: "mid" }) + text + "</g>";
  }

  const farWalls = Object.keys(WALLS).filter(far);
  const nearWalls = Object.keys(WALLS).filter((w) => !far(w));
  const sortedWalls = (list) => list.map((w) => ({ w, d: depth(pt((WALLS[w].box[0] + WALLS[w].box[2]) / 2, (WALLS[w].box[1] + WALLS[w].box[3]) / 2, 1)) })).sort((a, b) => a.d - b.d).map((o) => o.w);
  for (const w of sortedWalls(farWalls)) back.push(wallSvg(w));

  // detalles sobre muros lejanos: zoclo
  const baseboard = (w, z = 0.1) => {
    const [x0, y0, x1, y1] = WALLS[w].box;
    const n = WALLS[w].n;
    if (n[0] === 0) { const y = n[1] > 0 ? y1 : y0; return seg([Math.max(x0, 0), y, z], [x1 - (w === "right" ? T : 0), y, z], "ln-wall"); }
    const x = n[0] > 0 ? x1 : x0; return seg([x, Math.max(y0, w === "alcBack" ? 0 : y0 + T), z], [x, y1 - T, z], "ln-wall");
  };
  for (const w of farWalls) if (w !== "front") back.push(baseboard(w));

  // ---------- muro derecho: costales, BOB, peras de reflejo, bocina ----------
  if (far("right")) {
    // contactos
    for (const x of [2.4, 6.2]) back.push(S(box3(x, ROOM.W - 0.012, 0.3, x + 0.08, ROOM.W, 0.42), "white"));
  }
  const hangingBag = (x, color, name) => {
    const wy = ROOM.W, out = [];
    if (!far("right")) return;
    let fixed = "";
    fixed += S(box3(x - 0.07, wy - 0.03, 2.02, x + 0.07, wy, 2.42), "black");
    fixed += k.dotsSvg([at(pt(x - 0.04, wy - 0.03, 2.08)), at(pt(x + 0.04, wy - 0.03, 2.08)), at(pt(x - 0.04, wy - 0.03, 2.36)), at(pt(x + 0.04, wy - 0.03, 2.36))], { size: 0.45, tone: "mid" });
    fixed += S(box3(x - 0.025, wy - 0.52, 2.3, x + 0.025, wy - 0.03, 2.36), "black");
    fixed += S(box3(x - 0.018, wy - 0.3, 2.06, x + 0.018, wy - 0.03, 2.1), "black");
    fixed += seg([x, wy - 0.28, 2.1], [x, wy - 0.28, 2.3], "ln-black");
    fixed += S(cyl(x, wy - 0.45, 0.03, 2.17, 2.3, 16), "steel");
    let bag = "";
    const cy = wy - 0.45, r = 0.17;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      bag += seg([x, cy, 2.17], [x + Math.cos(a) * r * 0.75, cy + Math.sin(a) * r * 0.75, 1.96], "ln-steel");
    }
    bag += S(cyl(x, cy, r * 0.8, 1.93, 1.97, 24), "black");
    const body = cyl(x, cy, r, 1.0, 1.93, 40);
    const seams = [1.1, 1.83].map((z) => k.sideArc(m(x), m(cy), m(r), m(z), P, 28)).join("");
    bag += S(body, color, { inner: L(seams, `ln-${color}`) + L(k.knurl(m(x), m(cy), m(r), m(1.1), m(1.83), 6, P), `ln-${color}`) });
    bag += S(cyl(x, cy, r * 0.97, 0.98, 1.0, 24), "black");
    out.push(fixed, `<g data-swing data-dir="${k.axisVector(P, [0, -1, 0]).map((v) => v.toFixed(3)).join(",")}" ${piece(name, "90 cm de alto, colgado a 1 m del piso")}>${bag}</g>`);
    put([x, cy, 1.4], out.join(""));
  };
  hangingBag(ROOM.L - 0.7, "blue", "Costal colgante azul");
  hangingBag(ROOM.L - 1.7, "red", "Costal colgante rojo");

  const standingBase = (x, y) => {
    let s = S(cyl(x, y, 0.3, 0, 0.42, 48), "black", { inner: L(k.sideArc(m(x), m(y), m(0.3), m(0.06), P, 40), "ln-black") });
    s += L(k.ring(m(x), m(y), m(0.24), m(0.42), P, 40), "ln-black");
    s += S(cyl(x + 0.17, y - 0.12, 0.05, 0.42, 0.44, 16), "black");
    return s;
  };
  // costal de pie
  {
    const x = ROOM.L - 3.7, y = ROOM.W - 0.45;
    let s = standingBase(x, y);
    s += S(cyl(x, y, 0.21, 0.42, 0.5, 40), "black");
    const F = G.frameAlong(pt(x, y, 0.5), [0, 0, 1]);
    const prof = [[0, m(0.18)], [m(1.22), m(0.18)], [m(1.3), m(0.15), 1], [m(1.36), m(0.09), 1], [m(1.39), 0, 1]];
    const col = G.solidOf(prof, F, P);
    const dots = [1.0, 1.28, 1.56].map((z) => {
      const c = pt(x + V[0] * 0.18, y + V[1] * 0.18, z);
      return k.pathOf(Array.from({ length: 20 }, (_, i) => {
        const a = (i / 20) * Math.PI * 2;
        const side = [-V[1], V[0]];
        return at([c[0] + side[0] * m(0.05) * Math.cos(a), c[1] + side[1] * m(0.05) * Math.cos(a), c[2] + m(0.05) * Math.sin(a)]);
      }), true);
    }).join("");
    s += S(col, "black", { inner: `<path class="fl-white target" d="${dots}"/>` + L(G.arcOf(F, m(0.5), m(0.18), P), "ln-black") });
    put([x, y, 0.8], `<g data-wobble data-dir="${k.axisVector(P, [0, -1, 0]).map((v) => v.toFixed(3)).join(",")}" ${piece("Costal de pie", "1.9 m, base con agua o arena")}>${s}</g>`);
  }
  // BOB (maniquí de golpeo) con cinta naranja
  {
    const x = ROOM.L - 2.7, y = ROOM.W - 0.45;
    let base = standingBase(x, y);
    base += S(cyl(x, y, 0.21, 0.42, 0.5, 40), "black");
    let top = S(cyl(x, y, 0.055, 0.5, 1.13, 20), "black");
    // torso en tres partes (abajo → cinta → arriba) para que se pinte en orden
    top += S(rbox(x - 0.22, y - 0.13, 1.12, x + 0.22, y + 0.13, 1.17, 0.11), "tan");
    top += S(rbox(x - 0.23, y - 0.14, 1.17, x + 0.23, y + 0.14, 1.23, 0.115), "orange");
    if (visible([0, -1])) top += S(box3(x + 0.05, y - 0.16, 1.07, x + 0.11, y - 0.14, 1.23), "orange");
    top += S(rbox(x - 0.22, y - 0.13, 1.23, x + 0.22, y + 0.13, 1.54, 0.11), "tan", { inner: L(k.sideSeam({ x: m(x - 0.22), y: m(y - 0.13), w: m(0.44), d: m(0.26), r: m(0.11) }, m(1.4), P, 6), "ln-tan") });
    top += S(rbox(x - 0.18, y - 0.1, 1.54, x + 0.18, y + 0.1, 1.6, 0.09), "tan");
    top += S(cyl(x, y, 0.055, 1.6, 1.69, 20), "tan");
    const head = G.sphereOf(pt(x, y, 1.79), m(0.11), P);
    top += S(head, "tan");
    if (visible([0, -1])) top += k.dotsSvg([at(pt(x - 0.035, y - 0.105, 1.81)), at(pt(x + 0.035, y - 0.105, 1.81))], { size: 0.6, tone: "hi" });
    put([x, y, 0.8], `<g ${piece("BOB", "Maniquí de golpeo, 1.9 m")}>${base}<g data-wobble data-dir="${k.axisVector(P, [0, -1, 0]).map((v) => v.toFixed(3)).join(",")}">${top}</g></g>`);
  }
  // peras de reflejo (tubo al piso y al muro)
  const reflex = (x, ballColor) => {
    const wy = ROOM.W, py = wy - 0.22;
    let s = S(box3(x - 0.14, py - 0.14, 0, x + 0.14, py + 0.14, 0.035), "black");
    s += k.dotsSvg([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => at(pt(x + a * 0.1, py + b * 0.1, 0.035))), { size: 0.45, tone: "mid" });
    s += S(cyl(x, py, 0.022, 0.035, 0.75, 14), "black");
    let coilLines = "";
    for (let z = 0.78; z < 1.02; z += 0.035) coilLines += k.sideArc(m(x), m(py), m(0.045), m(z), P, 12);
    s += S(cyl(x, py, 0.04, 0.75, 1.03, 18), "orange", { inner: L(coilLines, "ln-orange") });
    s += S(cyl(x, py, 0.022, 1.03, 2.2, 14), "black");
    if (far("right")) s += S(box3(x - 0.03, py, 2.14, x + 0.03, wy, 2.2), "black") + S(box3(x - 0.06, wy - 0.02, 2.08, x + 0.06, wy, 2.26), "black");
    let ball = S(box3(x - 0.015, py - 0.2, 1.47, x + 0.015, py, 1.5), "orange");
    ball += S(G.sphereOf(pt(x, py - 0.26, 1.48), m(0.075), P), ballColor);
    ball += S(G.sphereOf(pt(x, py - 0.26, 1.54), m(0.035), P), "black");
    put([x, py, 1.0], `<g ${piece("Pera de reflejo", "Resorte a 1.5 m de altura")}>${s}<g data-swing data-fast data-dir="${k.axisVector(P, [1, -0.6, 0.2]).map((v) => v.toFixed(3)).join(",")}">${ball}</g></g>`);
  };
  reflex(ROOM.L - 4.7, "red");
  reflex(ROOM.L - 5.5, "black");
  // bocina
  {
    const x = ENTRADA + 0.7, y = ROOM.W - 0.3;
    let s = S(rbox(x - 0.15, y - 0.16, 0, x + 0.15, y + 0.16, 0.6, 0.02), "black");
    if (visible([0, -1])) s += L(k.sideRing(pt(x, y - 0.165, 0.38), m(0.09), "y", P, 28) + k.sideRing(pt(x, y - 0.165, 0.38), m(0.05), "y", P, 20) + k.sideRing(pt(x, y - 0.165, 0.18), m(0.03), "y", P, 16), "ln-steel");
    put([x, y, 0.3], `<g ${piece("Bocina", "60 cm de alto")}>${s}</g>`);
  }
  // ventilador de pedestal y planta en la entrada
  {
    const x = 0.7, y = ROOM.W - 1.1;
    let s = S(cyl(x, y, 0.2, 0, 0.04, 32), "black") + S(cyl(x, y, 0.025, 0.04, 1.15, 14), "steel");
    s += S(rbox(x - 0.08, y - 0.06, 1.12, x + 0.04, y + 0.06, 1.28, 0.05), "black");
    const c = pt(x + 0.07, y, 1.22);
    let grille = k.sideRing(c, m(0.23), "x", P, 40) + k.sideRing(c, m(0.15), "x", P, 32) + k.sideRing(c, m(0.06), "x", P, 20);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; grille += k.segment([c[0], c[1] + Math.cos(a) * m(0.06), c[2] + Math.sin(a) * m(0.06)], [c[0], c[1] + Math.cos(a) * m(0.23), c[2] + Math.sin(a) * m(0.23)], P); }
    s += L(grille, "ln-steel");
    put([x, y, 0.6], `<g ${piece("Ventilador", "Pedestal de 1.4 m")}>${s}</g>`);
    const px = 0.5, py = ROOM.W - 0.4;
    let p = S(cyl(px, py, 0.13, 0, 0.22, 28), "terracotta") + S(cyl(px, py, 0.14, 0.2, 0.24, 28), "terracotta");
    let leaves = "";
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, len = 0.22 + (i % 3) * 0.06;
      const b = pt(px, py, 0.24), tip = pt(px + Math.cos(a) * len, py + Math.sin(a) * len, 0.42 + (i % 2) * 0.12);
      const sideV = [-Math.sin(a) * m(0.035), Math.cos(a) * m(0.035), 0];
      const midp = [(b[0] + tip[0]) / 2, (b[1] + tip[1]) / 2, (b[2] + tip[2]) / 2 + m(0.05)];
      leaves += k.pathOf([b, [midp[0] + sideV[0], midp[1] + sideV[1], midp[2]], tip, [midp[0] - sideV[0], midp[1] - sideV[1], midp[2]]].map(at), true);
    }
    p += `<path class="leaf" d="${leaves}"/>`;
    put([px, py, 0.3], `<g ${piece("Planta", "Recibe a quien llega")}>${p}</g>`);
  }

  // ---------- pared del fondo: barra doble con ligas, ventana, rejilla, extintor ----------
  if (far("back")) {
    const wx = ROOM.L;
    // ventana tapiada de madera y rejilla de ventilación
    back.push(S(box3(wx - 0.04, 3.75, 1.5, wx, 4.55, 2.48), "wall") + S(box3(wx - 0.03, 3.82, 1.57, wx, 4.48, 2.41), "wood"));
    let planks = "";
    for (let y = 3.95; y < 4.48; y += 0.13) planks += seg([wx - 0.03, y, 1.57], [wx - 0.03, y, 2.41], "ln-wood");
    back.push(planks);
    back.push(S(box3(wx - 0.02, 5.3, 2.45, wx, 5.95, 2.62), "white"));
    let vent = "";
    for (let z = 2.48; z < 2.6; z += 0.03) vent += seg([wx - 0.02, 5.35, z], [wx - 0.02, 5.9, z], "ln-steel");
    back.push(vent);
  }
  if (far("back")) {
    const wx = ROOM.L;
    let s = "";
    const brackets = [3.0, 4.2, 5.4, 6.6];
    for (const y of brackets) {
      if (far("back")) s += S(box3(wx - 0.02, y - 0.04, 0.85, wx, y + 0.04, 1.32), "black");
      s += S(box3(wx - 0.13, y - 0.015, 0.92, wx - 0.02, y + 0.015, 0.97), "black") + S(box3(wx - 0.13, y - 0.015, 1.17, wx - 0.02, y + 0.015, 1.22), "black");
    }
    for (const z of [0.945, 1.195]) {
      const F = G.frameAlong(pt(wx - 0.12, 2.85, z), [0, 1, 0]);
      s += S(G.solidOf([[0, m(0.022)], [m(3.95), m(0.022)]], F, P, { steps: 16 }), "black");
    }
    // ligas de resistencia colgando
    const bands = [[3.25, 1.195, "red"], [3.55, 0.945, "black"], [3.85, 1.195, "red"], [4.55, 0.945, "green"], [4.9, 1.195, "red"], [5.2, 0.945, "black"], [5.8, 1.195, "red"], [6.15, 0.945, "black"]];
    let bandSvg = "";
    for (const [y, z, c] of bands) {
      const a = pt(wx - 0.12, y, z - 0.02), b = pt(wx - 0.1, y + 0.06, 0.12);
      bandSvg += L(k.pathOf([a, [a[0] + m(0.03), a[1] + m(0.02), (a[2] + b[2]) / 2], b].map(at)), `ln-band band-${c}`);
      bandSvg += S(cyl(wx - 0.1, y + 0.06, 0.025, 0.03, 0.14, 12), "black");
    }
    put([wx - 0.1, 4.8, 1.0], `<g ${piece("Barra doble con ligas", "Barras a 95 cm y 1.2 m, unos 4 m de largo")}>${s}${bandSvg}</g>`);
    // extintor
    let e = "";
    if (far("back")) e += S(box3(wx - 0.02, 2.66, 1.38, wx, 2.8, 1.46), "black");
    e += S(cyl(wx - 0.08, 2.73, 0.065, 0.95, 1.42, 24), "red", { inner: L(k.sideArc(m(wx - 0.08), m(2.73), m(0.065), m(1.3), P, 20), "ln-red") });
    e += S(cyl(wx - 0.08, 2.73, 0.03, 1.42, 1.5, 14), "black");
    e += L(k.pathOf([pt(wx - 0.08, 2.71, 1.47), pt(wx - 0.16, 2.66, 1.3), pt(wx - 0.15, 2.64, 1.05)].map(at)), "ln-black hose");
    put([wx - 0.08, 2.73, 1.2], `<g ${piece("Extintor", "Junto al pasillo del fondo")}>${e}</g>`);
  }
  {
    const wx = ROOM.L;
    // escudos de pateo recargados
    let sh = "";
    for (const [y, c] of [[5.75, "red"], [6.15, "red"]]) {
      sh += S(rbox(wx - 0.16, y - 0.19, 0, wx - 0.02, y + 0.19, 0.62, 0.04), c, { inner: L(k.sideSeam({ x: m(wx - 0.16), y: m(y - 0.19), w: m(0.14), d: m(0.38), r: m(0.04) }, m(0.31), P, 6), `ln-${c}`) });
    }
    put([wx - 0.09, 5.95, 0.3], `<g ${piece("Escudos de pateo", "62 × 38 cm")}>${sh}</g>`);
    // churros de alberca y conos apilados en la esquina
    let n = "";
    [[6.75, "yellow"], [6.62, "orange"], [6.82, "green"], [6.5, "yellow"]].forEach(([y, c], i) => { n += S(cyl(wx - 0.12 - (i % 2) * 0.1, y, 0.045, 0, 1.45 - i * 0.08, 18), c); });
    put([wx - 0.15, 6.65, 0.7], `<g ${piece("Churros de espuma", "1.4 m, para esquivar")}>${n}</g>`);
  }

  // ---------- pared izquierda: banner con el logo, lona enrollable, cuadros ----------
  if (far("left")) {
    const bx0 = ENTRADA + 2.5, bx1 = ENTRADA + 4.5, bz0 = 0.65, bz1 = 2.65, yy = 0.004; // 2 × 2 m
    let s = quad([[bx0, yy, bz0], [bx1, yy, bz0], [bx1, yy, bz1], [bx0, yy, bz1]], "banner");
    const o = at(pt(bx0 + 0.15, yy, bz1 - 0.2)), u = at(pt(bx1 - 0.15, yy, bz1 - 0.2)), v = at(pt(bx0 + 0.15, yy, bz0 + 0.2));
    s += `<image href="img/logo.png" x="0" y="0" width="1" height="1" preserveAspectRatio="none" transform="matrix(${(u[0] - o[0]).toFixed(3)} ${(u[1] - o[1]).toFixed(3)} ${(v[0] - o[0]).toFixed(3)} ${(v[1] - o[1]).toFixed(3)} ${o[0].toFixed(2)} ${o[1].toFixed(2)})"/>`;
    s += k.dotsSvg([at(pt(bx0 + 0.04, yy, bz1 - 0.04)), at(pt(bx1 - 0.04, yy, bz1 - 0.04))], { size: 0.6, tone: "mid" });
    back.push(`<g ${piece("Banner del dojo", "2 × 2 m, Shotokan Karate Do")}>${s}</g>`);
  }
  {
    // lona enrollable (roll-up)
    const x0 = ROOM.L - 1.0, x1 = ROOM.L - 0.2, y = 0.32;
    let s = S(rbox(x0 - 0.03, y - 0.09, 0, x1 + 0.03, y + 0.09, 0.07, 0.03), "steel");
    s += S(box3(x0, y - 0.008, 0.07, x1, y + 0.008, 2.0), "white");
    const faceY = visible([0, 1]) ? y + 0.009 : visible([0, -1]) ? y - 0.009 : null;
    if (faceY !== null) {
      s += quad([[x0, faceY, 0.07], [x1, faceY, 0.07], [x1, faceY, 0.5], [x0, faceY, 0.5]], "fl-magenta");
      s += quad([[x0, faceY, 1.78], [x1, faceY, 1.78], [x1, faceY, 2.0], [x0, faceY, 2.0]], "fl-black");
      const o = at(pt(x0 + 0.17, faceY, 1.7)), u = at(pt(x1 - 0.17, faceY, 1.7)), v = at(pt(x0 + 0.17, faceY, 1.24));
      s += `<image href="img/logo.png" x="0" y="0" width="1" height="1" preserveAspectRatio="none" transform="matrix(${(u[0] - o[0]).toFixed(3)} ${(u[1] - o[1]).toFixed(3)} ${(v[0] - o[0]).toFixed(3)} ${(v[1] - o[1]).toFixed(3)} ${o[0].toFixed(2)} ${o[1].toFixed(2)})"/>`;
      let rules = "";
      for (const z of [1.08, 1.0, 0.92, 0.84, 0.76]) rules += k.segment(pt(x0 + 0.12, faceY, z), pt(x1 - 0.12, faceY, z), P);
      s += L(rules, "", { tone: "lo", free: true });
    }
    put([(x0 + x1) / 2, y, 1.0], `<g ${piece("Lona enrollable", "80 cm × 2 m, información del dojo")}>${s}</g>`);
    // cuadros recargados en el muro
    let f = "";
    for (const [x, h] of [[ROOM.L - 2.0, 0.55], [ROOM.L - 1.75, 0.48]]) f += S(box3(x, 0.02, 0, x + 0.4, 0.05, h), "black") + S(box3(x + 0.04, 0.05, 0.04, x + 0.36, 0.052, h - 0.04), "white", { flat: true });
    put([ROOM.L - 1.8, 0.05, 0.25], `<g ${piece("Diplomas", "Por colgar")}>${f}</g>`);
  }

  // ---------- pasillo del fondo: estante de equipo y puerta ----------
  {
    const x0 = ALC.x1 - 0.55, x1 = ALC.x1 - 0.05, y0 = 0.2, y1 = 1.3;
    let s = "";
    const posts = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].sort((a, b) => depth(pt(a[0], a[1], 0)) - depth(pt(b[0], b[1], 0)));
    const backPosts = posts.slice(0, 3), frontPost = posts.slice(3);
    for (const [x, y] of backPosts) s += S(box3(x - 0.015, y - 0.015, 0, x + 0.015, y + 0.015, 1.85), "black");
    const levels = [0.12, 0.62, 1.12, 1.6];
    for (const z of levels) s += S(box3(x0, y0, z, x1, y1, z + 0.025), "black");
    // cosas en el estante
    s += S(rbox(x0 + 0.05, y0 + 0.05, 1.625, x1 - 0.05, y0 + 0.5, 1.83, 0.05), "blue") + S(rbox(x0 + 0.05, y0 + 0.58, 1.625, x1 - 0.05, y1 - 0.05, 1.8, 0.05), "black");
    s += S(rbox(x0 + 0.06, y0 + 0.08, 1.145, x1 - 0.08, y0 + 0.45, 1.3, 0.03), "red") + S(rbox(x0 + 0.06, y0 + 0.55, 1.145, x1 - 0.08, y1 - 0.1, 1.27, 0.03), "red");
    s += S(box3(x0 + 0.08, y0 + 0.1, 0.145, x1 - 0.05, y0 + 0.6, 0.4), "blue");
    for (let i = 0; i < 5; i++) s += S(G.sphereOf(pt(x0 + 0.15 + (i % 2) * 0.12, y0 + 0.75 + i * 0.1, 0.205 + (i % 2) * 0.02), m(0.06), P), ["yellow", "red", "green", "blue", "orange"][i]);
    // gis colgados en el nivel medio
    for (let i = 0; i < 3; i++) {
      const y = y0 + 0.2 + i * 0.32;
      s += S(box3(x0 + 0.12, y - 0.13, 0.66, x0 + 0.17, y + 0.13, 1.08), "white", { inner: L(k.segment(pt(x0 + 0.12, y, 1.08), pt(x0 + 0.12, y - 0.06, 0.66), P), "ln-white") });
    }
    for (const [x, y] of frontPost) s += S(box3(x - 0.015, y - 0.015, 0, x + 0.015, y + 0.015, 1.85), "black");
    put([(x0 + x1) / 2, (y0 + y1) / 2, 0.9], `<g ${piece("Estante de equipo", "Gis, guantes, petos y pelotas")}>${s}</g>`);
    if (far("alcBack")) {
      back.push(S(box3(ALC.x1 - 0.03, 1.5, 0, ALC.x1, 2.45, 2.12), "wall") + S(box3(ALC.x1 - 0.025, 1.57, 0, ALC.x1, 2.38, 2.06), "white"));
      back.push(k.dotsSvg([at(pt(ALC.x1 - 0.03, 1.67, 1.0))], { size: 1, tone: "hi" }));
    }
  }

  // ---------- vallas de agilidad (amarillo y negro) y conos ----------
  // franjas negras sobre un tubo delgado: un solo trazo con guiones medidos en el dibujo
  const stripes = (a3, b3, r, len, offset = 0) => {
    const A = at(a3), B = at(b3);
    const total = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const lenScreen = (total / Math.hypot(b3[0] - a3[0], b3[1] - a3[1], b3[2] - a3[2])) * m(len);
    return `<path class="stripe" d="M${A[0].toFixed(2)} ${A[1].toFixed(2)}L${B[0].toFixed(2)} ${B[1].toFixed(2)}" style="stroke-width:${(2 * m(r) * G.scaleOf(P) * 0.92).toFixed(2)};stroke-dasharray:${lenScreen.toFixed(2)} ${lenScreen.toFixed(2)};stroke-dashoffset:${(-(offset / len) * lenScreen).toFixed(2)}"/>`;
  };
  const hurdle = (x, y, along, h) => {
    const span = 0.8, half = span / 2;
    const ends = along === "y" ? [[x, y - half], [x, y + half]] : [[x - half, y], [x + half, y]];
    const sorted = [...ends].sort((a, b) => depth(pt(a[0], a[1], 0)) - depth(pt(b[0], b[1], 0)));
    const post = ([px, py]) => {
      let s = S(box3(px - 0.09, py - 0.09, MT, px + 0.09, py + 0.09, MT + 0.05), "yellow") + S(box3(px - 0.05, py - 0.05, MT + 0.05, px + 0.05, py + 0.05, MT + 0.08), "yellow");
      s += S(cyl(px, py, 0.016, MT + 0.08, 0.9, 12), "yellow");
      s += stripes(pt(px, py, MT + 0.18), pt(px, py, 0.9), 0.016, 0.1);
      return s;
    };
    let s = post(sorted[0]);
    const a = ends[0], b = ends[1];
    const dir = along === "y" ? [0, 1, 0] : [1, 0, 0];
    const F = G.frameAlong(pt(a[0], a[1], h), dir);
    s += S(G.solidOf([[0, m(0.013)], [m(span), m(0.013)]], F, P, { steps: 10 }), "yellow");
    s += stripes(pt(a[0], a[1], h), pt(b[0], b[1], h), 0.013, span / 12, span / 24);
    s += post(sorted[1]);
    put([x, y, 0.4], `<g ${piece("Valla de agilidad", `${Math.round(h * 100)} cm de alto`)}>${s}</g>`);
  };
  hurdle(ROOM.L - 2.6, 1.75, "y", 0.45);
  hurdle(ROOM.L - 1.95, 1.75, "y", 0.6);
  hurdle(ROOM.L - 1.3, 1.75, "y", 0.45);
  hurdle(ROOM.L - 2.3, 2.85, "y", 0.3);
  hurdle(ROOM.L - 1.65, 2.85, "y", 0.3);
  const cone = (x, y) => {
    const F = G.frameAlong(pt(x, y, MT), [0, 0, 1]);
    const s = S(G.solidOf([[0, m(0.1)], [m(0.02), m(0.1)], [m(0.02), m(0.05)], [m(0.17), m(0.012)], [m(0.18), 0]], F, P, { steps: 24 }), "orange");
    put([x, y, 0.05], `<g ${piece("Cono", "18 cm")}>${s}</g>`);
  };
  [[ENTRADA + 0.5, 1.6], [ENTRADA + 0.5, 2.7], [ENTRADA + 0.5, 3.8], [ENTRADA + 0.5, 4.9], [ENTRADA + 0.5, 6.0]].forEach(([x, y]) => cone(x, y));

  // ---------- muros cercanos (recortados) encima de todo ----------
  for (const w of sortedWalls(nearWalls)) front.push(wallSvg(w));
  for (const w of nearWalls) if (w === "left" || w === "front" || w === "right" || w === "back") front.push(rulerOn(w));

  items.sort((a, b) => a.key - b.key);
  const body = [...back, ...items.map((i) => i.svg), ...front].join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg modelo-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Modelo isométrico del interior de Dojo Henko visto desde una esquina: tatami rojo y azul de cuadros de 1 metro, costales, maniquí BOB, peras de reflejo, barra doble con ligas, vallas, conos y estante de equipo.">${body}</svg>`;
  const scr = Math.hypot(...k.axisVector(P, [M, 0, 0]));
  return { azimuth, svg, pxPerMetre: +scr.toFixed(3) };
}

// misma escala en las cuatro vistas, para que la regla valga igual
function fitScale(azimuth) {
  const unitP = { origin: [0, 0], scale: 1, azimuth, elevation: ELEV };
  const pts = [];
  for (const x of [0, ALC.x1]) for (const y of [0, ROOM.W]) for (const z of [0, ROOM.H]) pts.push(k.iso(pt(x, y, z), unitP));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return Math.min((W - 40) / (Math.max(...xs) - Math.min(...xs)), (H - 40) / (Math.max(...ys) - Math.min(...ys)));
}
const scale = Math.min(...AZIMUTHS.map(fitScale));
const views = AZIMUTHS.map((a) => buildView(a, scale));

const css = `/* generado por modelo/build.mjs */\n${matCss}
.ln-tile{stroke:#d8d2cb}.ln-joint{stroke:#00000026}.ln-mat{stroke:#1d3f86;stroke-width:.7px}.ln-weave{stroke:#00000016}
.ln-wall{stroke:#d9c7c9}.ln-weave{stroke-width:.4px}
.glass{fill:#bcd6e6;fill-opacity:.38;stroke:none}.glare{opacity:.9}
.banner{fill:#fbfafa;stroke:#c8124f;stroke-width:1px}
.ln-hoop{stroke-width:2.2px}.hoop-magenta{stroke:#c8124f}.hoop-green{stroke:#3f9a5b}.hoop-orange{stroke:#ef7a1f}
.ln-band{stroke-width:1.3px}.band-red{stroke:#d33c46}.band-black{stroke:#2b2729}.band-green{stroke:#3f9a5b}
.stripe{fill:none;stroke:#2b2729;stroke-linecap:butt;vector-effect:none!important}.hose{stroke-width:1.1px}.leaf{fill:#4f9a5e;stroke:#2f6b3d;stroke-width:.5px}.target{stroke:none;opacity:.9}
`;

writeFileSync(join(HERE, "vistas.js"), `// generado por modelo/build.mjs — no editar a mano\nwindow.DOJO_MODELO = ${JSON.stringify({ width: W, height: H, views })};\n`);
writeFileSync(join(HERE, "materiales.css"), css);
console.log("vistas:", views.map((v) => `${v.azimuth}° ${(v.svg.length / 1024).toFixed(0)} KB`).join(", "), "· px por metro:", views[0].pxPerMetre);
