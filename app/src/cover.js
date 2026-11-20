// The cover engine: poster layouts, sunset/neon grades and the renderer.
// Everything draws on a 2D canvas, so the editor preview and the exported PNG
// are the same drawing at different sizes. No Rockstar art, logo or font is
// used anywhere: the lettering is Anton and Pacifico, both under the OFL.

/** The three post sizes the app exports, in pixels. */
export const SIZES = {
  square: { w: 1080, h: 1080, label: 'Square 1080 x 1080' },
  story: { w: 1080, h: 1350, label: 'Story 1080 x 1350' },
  wide: { w: 1920, h: 1080, label: 'Wide 1920 x 1080' },
};

/** The poster layouts, each with its label and how many photo panels it holds. */
export const LAYOUTS = {
  grid9: { label: 'Nine-panel grid', panels: 9 },
  hero3: { label: 'Hero + three', panels: 4 },
  tilt: { label: 'Tilted snapshots', panels: 3 },
  bleed: { label: 'Full-bleed hero', panels: 1 },
  split: { label: 'Diagonal split', panels: 2 },
  duo: { label: 'Double feature', panels: 2 },
};

/** The colour grades: a photo filter, a wash gradient, a sky and the inks. */
export const GRADES = {
  sunset: {
    label: 'Vice Sunset',
    filter: 'saturate(1.35) contrast(1.08) brightness(1.03)',
    wash: ['#ff7a18', '#ff2d78'], washAlpha: 0.26,
    sky: ['#2b1055', '#7597de', '#ff7a18', '#ffd319'],
    ink: '#160a24', title: '#ffffff', accent: '#ff5c8a', sub: '#ffd319',
  },
  neon: {
    label: 'Neon Nights',
    filter: 'saturate(1.55) contrast(1.14) brightness(0.98)',
    wash: ['#ff2d78', '#00e5ff'], washAlpha: 0.30,
    sky: ['#12002e', '#3b0f66', '#ff2d78', '#00e5ff'],
    ink: '#0d0218', title: '#ffffff', accent: '#00e5ff', sub: '#ff7ad9',
  },
  golden: {
    label: 'Golden Hour',
    filter: 'saturate(1.25) contrast(1.05) brightness(1.06) sepia(0.22)',
    wash: ['#ffb347', '#ff7a18'], washAlpha: 0.24,
    sky: ['#3a1c00', '#b3541e', '#ffb347', '#ffe259'],
    ink: '#1c0f04', title: '#fff7e6', accent: '#ffb347', sub: '#ffe259',
  },
  pink: {
    label: 'Miami Pink',
    filter: 'saturate(1.45) contrast(1.06) brightness(1.04)',
    wash: ['#ff9a9e', '#f857a6'], washAlpha: 0.28,
    sky: ['#3d0c3f', '#a4133c', '#ff70a6', '#ffb3c6'],
    ink: '#20041f', title: '#ffffff', accent: '#ff70a6', sub: '#ffd6e8',
  },
  teal: {
    label: 'Teal Noir',
    filter: 'saturate(1.2) contrast(1.16) brightness(0.96)',
    wash: ['#00b4a2', '#1a2a6c'], washAlpha: 0.30,
    sky: ['#02141f', '#0f3443', '#00b4a2', '#7ef0e0'],
    ink: '#03161d', title: '#eafcff', accent: '#2de1c2', sub: '#9df5e8',
  },
  bubblegum: {
    label: 'Bubblegum',
    filter: 'saturate(1.5) contrast(1.05) brightness(1.05)',
    wash: ['#ff6ec7', '#7873f5'], washAlpha: 0.26,
    sky: ['#2a0a4a', '#7b2ff7', '#ff6ec7', '#ffc2e2'],
    ink: '#1c0733', title: '#ffffff', accent: '#ff6ec7', sub: '#c9b8ff',
  },
};

/** A fresh panel slot: which photo it shows, its zoom and its pan offsets. */
export function freshPanel(photo = 0) {
  return { photo, zoom: 1.15, x: 0, y: 0.08 };
}

/**
 * One framing per panel: zoom and pan offsets that put a face, a torso or
 * a detail in the frame. Pan y is positive toward the top of the photo —
 * both bundled samples carry their subject's face in the top third, so a
 * face framing needs a large positive y (the renderer clamps the pan to the
 * photo's slack, so overshooting just pins the window to the top edge).
 * The tables are per layout because a panel's shape decides which framing
 * can show a face: a short wide panel needs a bigger y than a tall one.
 */
const FRAMINGS = {
  grid9: [
    { zoom: 1.9, x: -0.25, y: 1.3 }, // face, left
    { zoom: 2.1, x: 0.1, y: 1.4 }, // face close, centre
    { zoom: 1.7, x: 0.3, y: 1.2 }, // face, right
    { zoom: 1.4, x: -0.3, y: 0.35 }, // torso, left
    { zoom: 1.5, x: 0, y: 1.1 }, // face, centre
    { zoom: 1.4, x: 0.3, y: 0.35 }, // torso, right
    { zoom: 1.6, x: -0.3, y: -0.7 }, // detail, lower left
    { zoom: 1.2, x: 0.1, y: -0.55 }, // wide, lower
    { zoom: 1.7, x: 0.3, y: -0.75 }, // detail, lower right
  ],
  hero3: [
    { zoom: 1.15, x: 0, y: 0.5 }, // hero: whole photo, face in frame
    { zoom: 1.7, x: -0.1, y: 1.55 }, // face close
    { zoom: 1.35, x: 0.25, y: 0.3 }, // mid shot
    { zoom: 1.05, x: -0.15, y: -0.6 }, // wide, lower half
  ],
  tilt: [
    { zoom: 1.7, x: -0.2, y: 1.0 }, // face
    { zoom: 1.05, x: 0.1, y: -0.45 }, // wide scene, face out of frame
    { zoom: 1.8, x: 0.2, y: 1.1 }, // face close, other side
  ],
  bleed: [{ zoom: 1.15, x: 0, y: 0.4 }],
  split: [
    { zoom: 1.5, x: -0.2, y: 0.7 }, // face side
    { zoom: 1.15, x: 0.2, y: -0.3 }, // scene side
  ],
  duo: [
    { zoom: 1.6, x: 0, y: 1.5 }, // face band
    { zoom: 1.1, x: 0, y: -0.6 }, // wide band
  ],
};

/**
 * Spreads one photo's crops across the layout's panels, so a single photo
 * fills the poster as varied framings — a close face, a wide shot, a detail —
 * instead of the same crop repeated. Deterministic, so exports repeat.
 */
export function spreadCrops(state) {
  const table = FRAMINGS[state.layout] ?? FRAMINGS.grid9;
  const n = panelCount(state.layout);
  for (let i = 0; i < n; i++) {
    const framing = table[i] ?? table[table.length - 1];
    const slot = state.panels[i];
    slot.zoom = framing.zoom;
    slot.x = framing.x;
    slot.y = framing.y;
  }
}

/** A fresh cover state: the nine-panel grid, Vice Sunset, square, two samples. */
export function freshState() {
  const state = {
    layout: 'grid9',
    grade: 'sunset',
    size: 'square',
    title: 'VICE COAST',
    subtitle: 'sunset heist',
    photos: [],
    panels: Array.from({ length: 9 }, (_, i) => freshPanel(i % 2)),
  };
  // Open on varied framings, not nine copies of the same crop.
  spreadCrops(state);
  return state;
}

/** How many panels a layout shows. */
export function panelCount(layout) {
  return (LAYOUTS[layout] ?? LAYOUTS.grid9).panels;
}

// ---------------------------------------------------------------- geometry

/** The title band's height, in cover pixels, for a cover of height h. */
function titleHeight(layout, h) {
  if (layout === 'bleed') return Math.round(h * 0.22);
  if (layout === 'tilt') return Math.round(h * 0.15);
  return Math.round(h * 0.17);
}

/**
 * The geometry of a layout on a cover of w by h: the panel rectangles
 * ({x, y, w, h, rot, poly} in cover pixels), the title band rectangle and
 * whether the background is open sky or dark ink.
 */
export function layoutGeometry(layout, w, h) {
  const th = titleHeight(layout, h);
  const m = Math.round(w * 0.02);
  const area = { x: m, y: m, w: w - m * 2, h: h - th - m * 2 };
  const title = { x: 0, y: h - th, w, h: th };
  if (layout === 'grid9') {
    const g = Math.round(w * 0.014);
    const cw = (area.w - g * 2) / 3;
    const ch = (area.h - g * 2) / 3;
    const panels = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        panels.push({ x: area.x + c * (cw + g), y: area.y + r * (ch + g), w: cw, h: ch, rot: 0, poly: null });
      }
    }
    return { panels, title, background: 'ink' };
  }
  if (layout === 'hero3') {
    const g = Math.round(w * 0.014);
    const heroW = area.w * 0.62;
    const colX = area.x + heroW + g;
    const colW = area.w - heroW - g;
    const ch = (area.h - g * 2) / 3;
    const panels = [{ x: area.x, y: area.y, w: heroW, h: area.h, rot: 0, poly: null }];
    for (let r = 0; r < 3; r++) {
      panels.push({ x: colX, y: area.y + r * (ch + g), w: colW, h: ch, rot: 0, poly: null });
    }
    return { panels, title, background: 'ink' };
  }
  if (layout === 'tilt') {
    const pw = area.w * 0.44;
    const ph = area.h * 0.52;
    const panels = [
      { x: area.x + area.w * 0.02, y: area.y + area.h * 0.06, w: pw, h: ph, rot: -0.1, poly: null },
      { x: area.x + area.w * 0.52, y: area.y + area.h * 0.02, w: pw, h: ph, rot: 0.06, poly: null },
      { x: area.x + area.w * 0.27, y: area.y + area.h * 0.44, w: pw, h: ph, rot: -0.03, poly: null },
    ];
    return { panels, title, background: 'sky' };
  }
  if (layout === 'bleed') {
    return {
      panels: [{ x: 0, y: 0, w, h, rot: 0, poly: null }],
      title: { x: 0, y: h - th, w, h: th },
      background: 'sky',
    };
  }
  if (layout === 'split') {
    // One diagonal from the top edge to the bottom edge, two photos either side.
    const topX = area.x + area.w * 0.62;
    const botX = area.x + area.w * 0.38;
    const panels = [
      { x: area.x, y: area.y, w: area.w, h: area.h, rot: 0, poly: [[area.x, area.y], [topX, area.y], [botX, area.y + area.h], [area.x, area.y + area.h]] },
      { x: area.x, y: area.y, w: area.w, h: area.h, rot: 0, poly: [[topX, area.y], [area.x + area.w, area.y], [area.x + area.w, area.y + area.h], [botX, area.y + area.h]] },
    ];
    return { panels, title, background: 'sky' };
  }
  // duo: two stacked bands.
  const g = Math.round(w * 0.014);
  const bh = (area.h - g) / 2;
  return {
    panels: [
      { x: area.x, y: area.y, w: area.w, h: bh, rot: 0, poly: null },
      { x: area.x, y: area.y + bh + g, w: area.w, h: bh, rot: 0, poly: null },
    ],
    title,
    background: 'ink',
  };
}

// ---------------------------------------------------------------- drawing

let grainTile = null;

/** A small tiled noise canvas, made once, for the film grain. */
function grainPattern(ctx) {
  if (grainTile) return grainTile;
  const t = document.createElement('canvas');
  t.width = 128;
  t.height = 128;
  const c = t.getContext('2d');
  const img = c.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 96 + Math.floor(Math.random() * 64);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  grainTile = ctx.createPattern(t, 'repeat');
  return grainTile;
}

/** A retro synthwave sun: a gradient disc cut by widening slats toward its foot. */
export function drawSynthSun(ctx, cx, cy, r, top, bottom, bg) {
  const grad = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = grad;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.fillStyle = bg;
  let y = cy + r * 0.05;
  let gap = r * 0.03;
  while (y < cy + r) {
    ctx.fillRect(cx - r, y, r * 2, gap);
    y += gap + r * 0.09;
    gap *= 1.5;
  }
  ctx.restore();
}

/** Draws one photo into a rectangle, cover-fit, with zoom and pan offsets. */
function drawPhotoIn(ctx, img, rect, slot, filter) {
  const s = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * slot.zoom;
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  // The pan never uncovers the rectangle: it is clamped to the photo's slack.
  const ox = Math.max(-(dw - rect.w) / 2, Math.min((dw - rect.w) / 2, slot.x * rect.w));
  const oy = Math.max(-(dh - rect.h) / 2, Math.min((dh - rect.h) / 2, slot.y * rect.h));
  const cx = rect.x + rect.w / 2 + ox;
  const cy = rect.y + rect.h / 2 + oy;
  ctx.save();
  if (filter) ctx.filter = filter;
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();
}

/** Draws one panel: a white inked frame, the photo clipped inside it. */
function drawPanel(ctx, img, panel, slot, grade, scale) {
  const border = Math.max(3, Math.round(scale * 7));
  ctx.save();
  if (panel.rot) {
    ctx.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
    ctx.rotate(panel.rot);
    ctx.translate(-(panel.x + panel.w / 2), -(panel.y + panel.h / 2));
  }
  if (panel.poly) {
    ctx.beginPath();
    ctx.moveTo(panel.poly[0][0], panel.poly[0][1]);
    for (let i = 1; i < panel.poly.length; i++) ctx.lineTo(panel.poly[i][0], panel.poly[i][1]);
    ctx.closePath();
    ctx.save();
    ctx.clip();
    if (img) {
      const xs = panel.poly.map((p) => p[0]);
      const ys = panel.poly.map((p) => p[1]);
      const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      drawPhotoIn(ctx, img, box, slot, grade.filter);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(panel.poly[0][0], panel.poly[0][1]);
    for (let i = 1; i < panel.poly.length; i++) ctx.lineTo(panel.poly[i][0], panel.poly[i][1]);
    ctx.closePath();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = border;
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = Math.round(scale * 14);
  ctx.shadowOffsetY = Math.round(scale * 5);
  ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  const inner = { x: panel.x + border, y: panel.y + border, w: panel.w - border * 2, h: panel.h - border * 2 };
  ctx.save();
  ctx.beginPath();
  ctx.rect(inner.x, inner.y, inner.w, inner.h);
  ctx.clip();
  if (img) drawPhotoIn(ctx, img, inner, slot, grade.filter);
  else {
    ctx.fillStyle = grade.ink;
    ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
  }
  ctx.restore();
  ctx.restore();
}

/** Rows of halftone dots along the top of the title band. */
function drawHalftone(ctx, title, accent, scale) {
  const step = Math.max(10, Math.round(scale * 16));
  const r = Math.max(1.5, scale * 2.2);
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.35;
  for (let row = 0; row < 2; row++) {
    for (let x = step / 2 + row * step * 0.5; x < title.w; x += step) {
      ctx.beginPath();
      ctx.arc(x, title.y + 8 * scale + row * step * 0.7, r * (1 - row * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** Fits one line of Anton capitals across the band, shrinking until it fits. */
function drawTitle(ctx, text, band, grade, scale) {
  const clean = (text || '').trim().toUpperCase() || 'VICE COAST';
  let size = band.h * 0.52;
  const setFont = () => { ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`; };
  setFont();
  while (ctx.measureText(clean).width > band.w * 0.9 && size > 18) {
    size -= 2;
    setFont();
  }
  const grad = ctx.createLinearGradient(0, band.y + band.h * 0.15, 0, band.y + band.h * 0.85);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.55, grade.title);
  grad.addColorStop(1, grade.sub);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(10,4,20,0.85)';
  ctx.lineWidth = Math.max(2, size * 0.07);
  ctx.strokeText(clean, band.w / 2, band.y + band.h * 0.44);
  ctx.fillStyle = grad;
  ctx.fillText(clean, band.w / 2, band.y + band.h * 0.44);
}

/** The neon script subtitle, centred under the title. */
function drawSubtitle(ctx, text, band, grade, scale) {
  const clean = (text || '').trim();
  if (!clean) return;
  const size = band.h * 0.24;
  ctx.font = `${size}px Pacifico, cursive`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = grade.accent;
  ctx.shadowBlur = Math.round(scale * 16);
  ctx.fillStyle = grade.sub;
  ctx.fillText(clean, band.w / 2, band.y + band.h * 0.82);
  ctx.shadowBlur = 0;
}

/** A small star badge, top-left of the cover. */
function drawBadge(ctx, w, grade, scale) {
  const label = 'SUNSET EDITION';
  ctx.font = `bold ${Math.max(11, Math.round(scale * 15))}px Anton, sans-serif`;
  const pad = Math.round(scale * 12);
  const tw = ctx.measureText(label).width;
  const bw = tw + pad * 2 + Math.round(scale * 18);
  const bh = Math.round(scale * 30);
  const x = Math.round(w * 0.02);
  const y = Math.round(w * 0.02);
  ctx.save();
  ctx.fillStyle = 'rgba(10,4,20,0.82)';
  ctx.beginPath();
  ctx.roundRect(x, y, bw, bh, bh / 2);
  ctx.fill();
  ctx.strokeStyle = grade.accent;
  ctx.lineWidth = Math.max(1.5, scale * 1.5);
  ctx.stroke();
  ctx.fillStyle = '#ffd319';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('★', x + pad, y + bh / 2 + 1);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(label, x + pad + Math.round(scale * 18), y + bh / 2 + 1);
  ctx.restore();
}

/**
 * Draws the whole cover onto `canvas` at w by h pixels, from `state`:
 * sky or ink background, photo panels, grade wash, title band, badge,
 * grain and vignette. The state keeps photos as loaded images.
 */
export function drawCover(canvas, state, w, h) {
  const ctx = canvas.getContext('2d');
  canvas.width = w;
  canvas.height = h;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const scale = w / 1080;
  const geo = layoutGeometry(state.layout, w, h);

  if (geo.background === 'sky') {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    grade.sky.forEach((c, i) => sky.addColorStop(i / (grade.sky.length - 1), c));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    drawSynthSun(ctx, w * 0.5, h * 0.42, Math.min(w, h) * 0.26, '#ffd319', '#ff2d78', grade.sky[0]);
  } else {
    const ink = ctx.createLinearGradient(0, 0, 0, h);
    ink.addColorStop(0, grade.ink);
    ink.addColorStop(1, '#000000');
    ctx.fillStyle = ink;
    ctx.fillRect(0, 0, w, h);
  }

  const count = panelCount(state.layout);
  for (let i = 0; i < count; i++) {
    const slot = state.panels[i] ?? freshPanel(0);
    const img = state.photos[slot.photo] ? state.photos[slot.photo].img : null;
    drawPanel(ctx, img, geo.panels[i], slot, grade, scale);
  }

  // The grade wash over the panels, then the title band.
  const wash = ctx.createLinearGradient(0, 0, 0, h);
  wash.addColorStop(0, grade.wash[0]);
  wash.addColorStop(1, grade.wash[1]);
  ctx.save();
  ctx.globalAlpha = grade.washAlpha;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  const band = geo.title;
  if (state.layout === 'bleed') {
    const scrim = ctx.createLinearGradient(0, band.y - band.h * 0.6, 0, h);
    scrim.addColorStop(0, 'rgba(10,4,20,0)');
    scrim.addColorStop(1, 'rgba(10,4,20,0.92)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, band.y - band.h * 0.6, w, band.h * 1.6);
  } else {
    ctx.fillStyle = grade.ink;
    ctx.fillRect(band.x, band.y, band.w, band.h);
    ctx.fillStyle = grade.accent;
    ctx.fillRect(band.x, band.y, band.w, Math.max(2, Math.round(scale * 4)));
  }
  drawHalftone(ctx, band, grade.accent, scale);
  drawTitle(ctx, state.title, band, grade, scale);
  drawSubtitle(ctx, state.subtitle, band, grade, scale);
  if (state.layout !== 'bleed') drawBadge(ctx, w, grade, scale);

  // Film grain and vignette over everything.
  const grain = grainPattern(ctx);
  if (grain) {
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}
