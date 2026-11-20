// shots.mjs — photograph Vice Coast Cover Studio for screenshots/ (see shots.json).
// Serves app/ with the repo's own serve.ts, drives headless Chromium over CDP
// (no dependencies: Node's own WebSocket speaks the protocol), opens each
// ?shot= scene, waits for the app to flag itself ready, and saves a JPEG
// under the gate's limits (<= 256 KiB, 1280 px long side, 480 px short side).
// If the local HTTP navigation is blocked, retries the shot from file://.
// Usage: node shots.mjs [chrome-binary]

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const appIndex = join(root, 'app', 'index.html');
const shots = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8'));
const CHROME = process.argv[2] || '/opt/meta-chromium/chrome';
const PORT = 8123;
const DEBUG = 9336;

// This Chromium build refuses to start without a Hatch WebGL domain policy:
// a versioned, newline-terminated, strictly sorted domain list plus its
// SHA-256, passed as two switches. The app uses 2D canvas only (no WebGL),
// so the list's content is inert here — example.com stands in as a valid
// registrable domain.
const DOMAINS_FILE = '/tmp/vice-coast-webgl-domains.txt';
writeFileSync(DOMAINS_FILE, 'hatch-webgl-allowed-domains-v1\nexample.com\n');
const DOMAINS_SHA = createHash('sha256').update(readFileSync(DOMAINS_FILE)).digest('hex');

const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: root, stdio: 'ignore' });
await new Promise((resolveWait) => {
  const end = Date.now() + 10000;
  const probe = async () => {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/`);
      if (r.ok) return resolveWait();
    } catch { /* not up yet */ }
    if (Date.now() > end) return resolveWait();
    setTimeout(probe, 250);
  };
  probe();
});

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader',
  '--use-angle=swiftshader', '--no-proxy-server', '--allow-file-access-from-files',
  `--hatch-webgl-allowed-domains-file=${DOMAINS_FILE}`,
  `--hatch-webgl-allowed-domains-sha256=${DOMAINS_SHA}`,
  `--remote-debugging-port=${DEBUG}`, '--user-data-dir=/tmp/vice-coast-chrome-shots',
  '--window-size=1280,800', 'about:blank',
], { stdio: 'ignore' });

async function waitFor(fn, timeout, label) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const v = await fn().catch(() => null);
    if (v) return v;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timeout: ${label}`);
}

let exitCode = 0;
try {
  const version = await waitFor(async () => {
    const r = await fetch(`http://127.0.0.1:${DEBUG}/json/version`);
    return r.ok ? r.json() : null;
  }, 20000, 'chrome debug port');
  console.log('Chrome:', version.Browser);

  const pages = await (await fetch(`http://127.0.0.1:${DEBUG}/json/list`)).json();
  const target = pages.find((p) => p.type === 'page');
  if (!target) throw new Error('no page target from chrome');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let nextId = 0;
  const pending = new Map();
  const exceptions = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') exceptions.push(msg.params.exceptionDetails.text || 'exception');
  });
  function send(method, params = {}) {
    const id = ++nextId;
    return new Promise((res) => { pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
  }
  async function evalJs(expr) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return r.result && r.result.result ? r.result.result.value : undefined;
  }

  await send('Page.enable');
  await send('Runtime.enable');

  mkdirSync(join(root, 'screenshots'), { recursive: true });
  for (const shot of shots) {
    exceptions.length = 0;
    await send('Emulation.setDeviceMetricsOverride', { width: shot.w, height: shot.h, deviceScaleFactor: 1, mobile: false });
    let ready = false;
    try {
      await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${shot.query}` });
      await waitFor(() => evalJs('window.__shotReady === true'), 20000, shot.name);
      ready = true;
    } catch {
      console.log(`${shot.name}: local HTTP scene did not become ready, retrying from file://`);
      await send('Page.navigate', { url: `file://${appIndex}${shot.query}` });
      await waitFor(() => evalJs('window.__shotReady === true'), 45000, shot.name);
      ready = true;
    }
    if (!ready) throw new Error(`shot never became ready: ${shot.name}`);
    await new Promise((r) => setTimeout(r, 350));
    let saved = null;
    for (const quality of [84, 74, 62, 50]) {
      const shotRes = await send('Page.captureScreenshot', { format: 'jpeg', quality, captureBeyondViewport: false });
      const buf = Buffer.from(shotRes.result.data, 'base64');
      if (buf.length <= 262144 || quality === 50) { saved = { buf, quality }; break; }
    }
    writeFileSync(join(root, 'screenshots', shot.name), saved.buf);
    console.log(`${shot.name}: ${saved.buf.length} bytes @ q${saved.quality}${exceptions.length ? ' — page exceptions: ' + exceptions.join(' | ') : ''}`);
  }
  ws.close();
} catch (err) {
  console.error(err.message);
  exitCode = 1;
} finally {
  chrome.kill();
  server.kill();
}
process.exit(exitCode);
