// Wires the editor: photos in, layout and grade picked, caption typed, panel
// cropped by drag and zoom, cover out as a PNG in three post sizes.
// A `?shot=` query sets up a fixed scene for a screenshot instead (./shots.js).
import { drawCover, freshState, freshPanel, panelCount, layoutGeometry, spreadCrops, LAYOUTS, GRADES, SIZES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const state = freshState();
let selectedPanel = 0;

const $ = (id) => document.getElementById(id);

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** The preview canvas's pixel size for the current post size. */
function previewSize() {
  const s = SIZES[state.size];
  const long = 900;
  const k = long / Math.max(s.w, s.h);
  return { w: Math.round(s.w * k), h: Math.round(s.h * k) };
}

/** Redraws the preview canvas from the state, and the panel readout. */
export function renderPreview() {
  const { w, h } = previewSize();
  drawCover(canvas, state, w, h);
  const count = panelCount(state.layout);
  $('panelLabel').textContent = `Panel ${Math.min(selectedPanel + 1, count)} of ${count} — drag the photo to move it, scroll to zoom`;
  $('zoom').value = String((state.panels[selectedPanel] ?? freshPanel()).zoom);
}

/** Loads the two bundled sample photos so the editor opens with a cover. */
async function loadSamples() {
  for (const [name, file] of [['pier', 'samples/pier.jpg'], ['boulevard', 'samples/boulevard.jpg']]) {
    try {
      const img = await loadImage(file);
      state.photos.push({ img, name });
    } catch {
      // A missing sample just leaves that slot empty; uploads still work.
    }
  }
  buildThumbs();
}

/** Rebuilds the photo thumbnail strip from state.photos. */
function buildThumbs() {
  const strip = $('thumbs');
  strip.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'thumb';
    button.title = `Put “${photo.name}” in the selected panel`;
    const img = document.createElement('img');
    img.src = photo.img.src;
    img.alt = photo.name;
    button.appendChild(img);
    button.addEventListener('click', () => {
      state.panels[selectedPanel].photo = i;
      renderPreview();
      status.textContent = `Panel ${selectedPanel + 1} now shows ${photo.name}.`;
    });
    strip.appendChild(button);
  });
}

/** Builds the layout, grade and size pickers from the engine's tables. */
function buildPickers() {
  const layouts = $('layouts');
  for (const [key, layout] of Object.entries(LAYOUTS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.textContent = layout.label;
    b.dataset.key = key;
    b.addEventListener('click', () => {
      state.layout = key;
      selectedPanel = 0;
      document.querySelectorAll('#layouts .pick').forEach((el) => el.classList.toggle('on', el === b));
      renderPreview();
    });
    if (key === state.layout) b.classList.add('on');
    layouts.appendChild(b);
  }
  const grades = $('grades');
  for (const [key, grade] of Object.entries(GRADES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.title = grade.label;
    b.dataset.key = key;
    b.style.background = `linear-gradient(135deg, ${grade.wash[0]}, ${grade.wash[1]})`;
    const label = document.createElement('span');
    label.textContent = grade.label;
    b.appendChild(label);
    b.addEventListener('click', () => {
      state.grade = key;
      document.querySelectorAll('#grades .swatch').forEach((el) => el.classList.toggle('on', el === b));
      renderPreview();
    });
    if (key === state.grade) b.classList.add('on');
    grades.appendChild(b);
  }
  const sizes = $('sizes');
  for (const [key, size] of Object.entries(SIZES)) {
    const label = document.createElement('label');
    label.className = 'size';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'size';
    radio.value = key;
    radio.checked = key === state.size;
    radio.addEventListener('change', () => {
      state.size = key;
      renderPreview();
    });
    label.append(radio, document.createTextNode(size.label));
    sizes.appendChild(label);
  }
}

/** Renders one size at full export resolution and downloads it as a PNG. */
export function exportPNG(sizeKey) {
  const size = SIZES[sizeKey] ?? SIZES[state.size];
  const off = document.createElement('canvas');
  drawCover(off, state, size.w, size.h);
  return new Promise((resolve) => {
    off.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vice-coast-cover-${size.w}x${size.h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      status.textContent = `Saved vice-coast-cover-${size.w}x${size.h}.png`;
      resolve(a.download);
    }, 'image/png');
  });
}

/** The point-in-polygon test for the diagonal-split panels. */
function insidePoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Which panel, if any, a preview-canvas point (in canvas pixels) falls in. */
function panelAt(px, py) {
  const { w, h } = previewSize();
  const geo = layoutGeometry(state.layout, w, h);
  const count = panelCount(state.layout);
  for (let i = count - 1; i >= 0; i--) {
    const p = geo.panels[i];
    if (p.poly) {
      if (insidePoly(px, py, p.poly)) return i;
    } else if (px >= p.x && px <= p.x + p.w && py >= p.y && py <= p.y + p.h) {
      return i;
    }
  }
  return -1;
}

/** Pointer position on the preview canvas, in canvas pixels. */
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * canvas.width,
    y: ((e.clientY - r.top) / r.height) * canvas.height,
  };
}

let drag = null;

canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const hit = panelAt(p.x, p.y);
  if (hit < 0) return;
  selectedPanel = hit;
  canvas.setPointerCapture(e.pointerId);
  drag = { x: p.x, y: p.y, slot: { ...state.panels[hit] } };
  renderPreview();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const { w, h } = previewSize();
  const geo = layoutGeometry(state.layout, w, h);
  const panel = geo.panels[selectedPanel];
  const slot = state.panels[selectedPanel];
  const rw = panel.poly ? w : panel.w;
  const rh = panel.poly ? h : panel.h;
  slot.x = Math.max(-0.45, Math.min(0.45, drag.slot.x + (p.x - drag.x) / rw));
  slot.y = Math.max(-0.45, Math.min(0.45, drag.slot.y + (p.y - drag.y) / rh));
  renderPreview();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const hit = panelAt(canvasPoint(e).x, canvasPoint(e).y);
  if (hit < 0) return;
  selectedPanel = hit;
  const slot = state.panels[hit];
  slot.zoom = Math.max(1, Math.min(3, slot.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
  renderPreview();
}, { passive: false });

$('photo').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  for (const file of files) {
    try {
      const img = await loadImage(URL.createObjectURL(file));
      state.photos.push({ img, name: file.name.replace(/\.[^.]+$/, '') });
    } catch {
      status.textContent = `Could not read ${file.name}.`;
    }
  }
  buildThumbs();
  if (state.photos.length > 0) {
    state.panels[selectedPanel].photo = state.photos.length - 1;
    renderPreview();
    status.textContent = `${files.length} photo${files.length === 1 ? '' : 's'} added — click a thumbnail to put it in the selected panel.`;
  }
  e.target.value = '';
});
$('samplePier').addEventListener('click', () => {
  const i = state.photos.findIndex((p) => p.name === 'pier');
  if (i >= 0) { state.panels[selectedPanel].photo = i; renderPreview(); }
});
$('sampleBoulevard').addEventListener('click', () => {
  const i = state.photos.findIndex((p) => p.name === 'boulevard');
  if (i >= 0) { state.panels[selectedPanel].photo = i; renderPreview(); }
});
$('title').addEventListener('input', (e) => { state.title = e.target.value; renderPreview(); });
$('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; renderPreview(); });
$('zoom').addEventListener('input', (e) => {
  state.panels[selectedPanel].zoom = Number(e.target.value);
  renderPreview();
});
$('centerPanel').addEventListener('click', () => {
  const slot = state.panels[selectedPanel];
  slot.x = 0;
  slot.y = 0;
  slot.zoom = 1.15;
  renderPreview();
});
$('fillAll').addEventListener('click', () => {
  const photo = state.panels[selectedPanel].photo;
  for (const slot of state.panels) slot.photo = photo;
  spreadCrops(state);
  renderPreview();
  status.textContent = 'Every panel now shows the same photo, in varied framings.';
});
$('shuffle').addEventListener('click', () => {
  for (const slot of state.panels) slot.photo = Math.floor(Math.random() * state.photos.length);
  renderPreview();
});
$('export').addEventListener('click', () => { exportPNG(state.size); });
$('exportAll').addEventListener('click', async () => {
  for (const key of Object.keys(SIZES)) {
    await exportPNG(key);
    await new Promise((r) => setTimeout(r, 350));
  }
  status.textContent = 'Saved all three sizes.';
});

/** Syncs the pickers and inputs with the state (used after a ?shot= scene). */
function syncControls() {
  $('title').value = state.title;
  $('subtitle').value = state.subtitle;
  document.querySelectorAll('#layouts .pick').forEach((el) => el.classList.toggle('on', el.dataset.key === state.layout));
  document.querySelectorAll('#grades .swatch').forEach((el) => el.classList.toggle('on', el.dataset.key === state.grade));
  document.querySelectorAll('#sizes input').forEach((el) => { el.checked = el.value === state.size; });
}

/** Applies a ?shot= scene: state from the query, sample photo, full-frame cover. */
async function applyShot(patch, photoName) {
  Object.assign(state, patch);
  selectedPanel = 0;
  if (state.photos.length === 0) await loadSamples();
  const i = state.photos.findIndex((p) => p.name === photoName);
  if (i >= 0) {
    for (const slot of state.panels) slot.photo = i;
  }
  spreadCrops(state);
  syncControls();
  await document.fonts.ready;
  if (document.body.classList.contains('shot-cover')) {
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    drawCover(canvas, state, window.innerWidth, window.innerHeight);
  } else {
    renderPreview();
  }
}

// Test and screenshot hooks: the same render the export button uses.
window.__coverApp = { state, exportPNG, renderPreview, applyShot };

buildPickers();
const shot = new URLSearchParams(location.search).get('shot');
try {
  await Promise.all([document.fonts.load('100px Anton'), document.fonts.load('60px Pacifico')]);
} catch {
  // The fallback fonts still draw; the cover just loses its display lettering.
}
if (shot) {
  await runShot(shot, new URLSearchParams(location.search), { applyShot });
} else {
  await loadSamples();
  renderPreview();
}
