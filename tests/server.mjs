import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const files = new Map([
  ['/', ['index.html', 'text/html']],
  ['/app.js', ['app.js', 'text/javascript']],
  ['/style.css', ['style.css', 'text/css']],
]);

createServer(async (request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  const file = files.get(path);
  if (!file) { response.writeHead(404).end(); return; }
  try {
    const contents = await readFile(new URL(`../${file[0]}`, import.meta.url));
    response.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8` });
    response.end(contents);
  } catch {
    response.writeHead(500).end();
  }
}).listen(4173, '127.0.0.1');
