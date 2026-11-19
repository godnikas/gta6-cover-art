// Fixed scenes for screenshots: ?shot=editor shows the editor with a sample
// photo loaded; ?shot=cover shows the cover alone, full frame. `photo` picks
// the sample, `layout`, `grade`, `size`, `caption` and `subtitle` set the cover.
// window.__shotReady is set once the scene is painted.
export async function runShot(shot, query, app) {
  const patch = {};
  if (query.get('layout')) patch.layout = query.get('layout');
  if (query.get('grade')) patch.grade = query.get('grade');
  if (query.get('size')) patch.size = query.get('size');
  if (query.get('caption')) patch.title = query.get('caption');
  if (query.get('subtitle')) patch.subtitle = query.get('subtitle');
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await app.applyShot(patch, query.get('photo') ?? 'pier');
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
