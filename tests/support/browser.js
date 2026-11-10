import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { resolve, extname, sep, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

// Small Chromium DevTools driver shared by regression tests and screenshots.
// No browser download or dependency install is needed.
export async function openBrowser({ directory = 'dist', script = '', url: baseURL, width = 1280, height = 900 } = {}) {
  const root = resolve(directory);
  const profile = await mkdtemp(join(tmpdir(), 'mockout-browser-'));
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
      const data = await readFile(file);
      response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }); response.end(data);
    } catch { response.writeHead(404).end(); }
  });
  let browser;
  let close = async () => {
    if (browser && browser.exitCode === null && browser.pid) { browser.kill(); await once(browser, 'exit'); }
    await new Promise(resolve => server.close(resolve));
    await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  };
  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    browser = spawn(process.env.CHROMIUM_BIN || 'chromium', [
      '--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--remote-debugging-pipe', `--user-data-dir=${profile}`, 'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
    let nextId = 0, buffer = '', diagnostics = '';
    const pending = new Map(), errors = [], requests = [];
    browser.stderr.on('data', data => { diagnostics = (diagnostics + data).slice(-4000); });
    const rejectPending = error => { for (const entry of pending.values()) entry.reject(error); pending.clear(); };
    browser.on('error', rejectPending);
    browser.on('exit', code => rejectPending(new Error(`Chromium exited (${code}). ${diagnostics}`)));
    browser.stdio[4].on('data', data => {
      buffer += data;
      let boundary;
      while ((boundary = buffer.indexOf('\0')) !== -1) {
        const message = JSON.parse(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 1);
        if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
        if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map(item => item.value || item.description).join(' '));
        if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) requests.push(message.params.response.url);
        const entry = pending.get(message.id);
        if (!entry) continue;
        pending.delete(message.id);
        if (message.error) entry.reject(new Error(message.error.message)); else entry.resolve(message.result);
      }
    });
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}. ${diagnostics}`)); }, 15000);
      pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
      browser.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
    });
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const page = (method, params) => send(method, params, sessionId);
    const evaluate = async expression => {
      const result = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
      if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    const wait = expression => evaluate(`(async () => { const deadline = Date.now() + 10000; while (!(await (${expression}))) { if (Date.now() > deadline) throw Error('Condition timed out: ' + ${JSON.stringify(expression)}); await new Promise(resolve => setTimeout(resolve, 30)); } })()`);
    await page('Page.enable'); await page('Runtime.enable'); await page('Network.enable');
    await page('Network.setBlockedURLs', { urls: ['https://analytics.dannyb.co/*', 'https://fonts.googleapis.com/*', 'https://fonts.gstatic.com/*'] });
    await page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await page('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
    if (script) await page('Page.addScriptToEvaluateOnNewDocument', { source: script });
    const url = baseURL || `http://127.0.0.1:${server.address().port}/`;
    await page('Page.navigate', { url });
    const key = async (key, { code = key, modifiers = 0, text } = {}) => {
      const windowsVirtualKeyCode = ({ Escape: 27, Tab: 9, Enter: 13, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Delete: 46, Backspace: 8, Home: 36, End: 35, Space: 32 })[key] || (code.startsWith('Key') ? code.charCodeAt(3) : 0);
      await page('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers, windowsVirtualKeyCode, ...(text ? { text } : {}) });
      await page('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers, windowsVirtualKeyCode });
    };
    const mouse = async (type, x, y, extra = {}) => {
      if (type === 'mousePressed') await page('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      return page('Input.dispatchMouseEvent', { type, x, y, ...(type === 'mouseMoved' && extra.buttons === 1 ? { button: 'left' } : {}), ...extra });
    };
    return { send, page, evaluate, wait, key, mouse, errors, requests, url, close };
  } catch (error) { await close(); throw error; }
}
