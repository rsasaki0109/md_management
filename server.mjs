import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep,relative} from 'node:path';
const root=resolve(fileURLToPath(new URL('.',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.gif':'image/gif','.png':'image/png','.webmanifest':'application/manifest+json'};
export async function handleRequest(req,res){
 try{
  if(!['GET','HEAD'].includes(req.method||'GET')){res.writeHead(405,{'Allow':'GET, HEAD'}).end();return;}
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let path=resolve(root,'.'+pathname);
  if(path!==root&&!path.startsWith(root+sep)){res.writeHead(404).end();return;}
  if(path===root)path=resolve(root,'index.html');
  if(relative(root,path).split(sep).some(part=>part.startsWith('.'))||!Object.hasOwn(mime,extname(path))){res.writeHead(404).end();return;}
  const data=await readFile(path);
  res.writeHead(200,{'Content-Type':mime[extname(path)],'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'}).end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404).end('Not found');}
}
export const createAppServer=()=>createServer(handleRequest);
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
 createAppServer().listen(port,host,()=>console.log(`http://${host}:${port}`));
}
