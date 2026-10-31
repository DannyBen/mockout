const { createServer } = require('node:http');
const { readFile, mkdtemp, mkdir, writeFile, rm } = require('node:fs/promises');
const { join, resolve, extname, sep } = require('node:path');
const { tmpdir } = require('node:os');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

const root = resolve(__dirname, '..');
const publicDir = join(root, 'public');
const outputDir = join(root, 'support', 'screenshots');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

async function main() {
  // A temporary profile keeps captures independent of the user's saved projects.
  const profile = await mkdtemp(join(tmpdir(), 'mockout-screenshots-'));
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = resolve(publicDir, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!file.startsWith(publicDir + sep)) {
        response.writeHead(403).end();
        return;
      }
      const data = await readFile(file);
      response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
      response.end(data);
    } catch {
      response.writeHead(404).end();
    }
  });
  let browser;
  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    browser = spawn(process.env.CHROMIUM_BIN || 'chromium', [
      '--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
      '--no-first-run', '--no-default-browser-check', '--remote-debugging-pipe',
      `--user-data-dir=${profile}`, 'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
    let diagnostics = '';
    browser.stderr.on('data', data => { diagnostics = (diagnostics + data).slice(-4000); });
    let nextId = 0;
    let buffer = '';
    const pending = new Map();
    const rejectPending = error => {
      for (const entry of pending.values()) entry.reject(error);
      pending.clear();
    };
    browser.on('error', rejectPending);
    browser.on('exit', code => rejectPending(new Error(`Chromium exited (${code}). ${diagnostics}`)));
    browser.stdio[4].on('data', data => {
      buffer += data;
      let boundary;
      while ((boundary = buffer.indexOf('\0')) !== -1) {
        const message = JSON.parse(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 1);
        const entry = pending.get(message.id);
        if (!entry) continue;
        pending.delete(message.id);
        if (message.error) entry.reject(new Error(message.error.message));
        else entry.resolve(message.result);
      }
    });
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timed out: ${method}. ${diagnostics}`));
      }, 45000);
      pending.set(id, {
        resolve: value => { clearTimeout(timer); resolve(value); },
        reject: error => { clearTimeout(timer); reject(error); },
      });
      browser.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
    });
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const page = (method, params) => send(method, params, sessionId);
    await page('Emulation.setDeviceMetricsOverride', {
      width: 1280, height: 900, deviceScaleFactor: 1, mobile: false,
    });
    await page('Network.enable');
    await page('Network.setBlockedURLs', { urls: ['https://analytics.dannyb.co/*'] });
    await page('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'light' }],
    });
    await page('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
    const ready = await page('Runtime.evaluate', {
      expression: `(async () => {
        const deadline = Date.now() + 30000;
        while (!document.querySelector('.box') || [...document.querySelectorAll('link[data-mockout-font]')].some(link => !link.sheet)) {
          if (Date.now() > deadline) throw Error('Welcome project or Google Fonts did not load.');
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        const faces = await document.fonts.load('24px "Material Symbols Outlined"');
        if (!faces.length) throw Error('Welcome project icon font did not load.');
        await document.fonts.ready;
      })()`,
      awaitPromise: true,
    });
    if (ready.exceptionDetails) throw new Error(ready.exceptionDetails.exception?.description || ready.exceptionDetails.text);
    const captures = [];
    for (const theme of ['light', 'dark']) {
      await page('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-color-scheme', value: theme }],
      });
      await page('Runtime.evaluate', {
        expression: 'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
        awaitPromise: true,
      });
      const result = await page('Page.captureScreenshot', { format: 'png' });
      captures.push({ theme, data: Buffer.from(result.data, 'base64') });
    }
    await mkdir(outputDir, { recursive: true });
    for (const { theme, data } of captures) {
      const file = join(outputDir, `overview-${theme}.png`);
      await writeFile(file, data);
      console.log(`Saved ${file}`);
    }
  } finally {
    if (browser && browser.exitCode === null && browser.pid) {
      browser.kill();
      await once(browser, 'exit');
    }
    await new Promise(resolve => server.close(resolve));
    await rm(profile, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
