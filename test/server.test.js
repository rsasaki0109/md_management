import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../server.mjs';
async function request(url,method='GET'){const reply={writeHead(status,headers={}){this.status=status;this.headers=headers;return this;},end(body){this.body=body;return this;}};await handleRequest({url,method},reply);return reply;}
test('root and explicit index serve the application with correct content type',async()=>{for(const url of ['/','/?v=1','/index.html']){const r=await request(url);assert.equal(r.status,200);assert.match(r.headers['Content-Type'],/text\/html/);assert.match(r.body.toString(),/id="main"/);}});
test('modules, CSS, GIF and HEAD requests are served',async()=>{for(const [url,type] of [['/src/app.js','text/javascript'],['/src/style.css','text/css'],['/assets/hero.gif','image/gif']]){const r=await request(url);assert.equal(r.status,200);assert.ok(r.headers['Content-Type'].startsWith(type));}const head=await request('/','HEAD');assert.equal(head.status,200);assert.equal(head.body,undefined);});
test('hidden files, traversal, invalid encoding, missing files and unsafe methods are rejected',async()=>{for(const url of ['/.git/config','/README.md','/package.json','/src/%2e%2e%2f%2e%2e%2foutside.js','/%zz','/missing.js'])assert.equal((await request(url)).status,404,url);assert.equal((await request('/','POST')).status,405);});
