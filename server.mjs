import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
createServer(async (req, res) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!path.startsWith(root) || path.slice(root.length).split(sep).some(p => p.startsWith('.')) || !['.html','.js','.css','.svg',''].includes(extname(path))) {res.writeHead(404).end(); return;}
    const data = await readFile(path === root.slice(0,-1) || path === root ? resolve(root,'index.html') : path);
    res.writeHead(200, {'Content-Type': mime[extname(path)] || 'text/html; charset=utf-8', 'X-Content-Type-Options':'nosniff'}).end(data);
  } catch {res.writeHead(404).end('Not found');}
}).listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('http://localhost:' + (process.env.PORT || 3000)));
