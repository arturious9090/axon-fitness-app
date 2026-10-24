import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('apps/mobile/dist');
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ttf':'font/ttf','.ico':'image/x-icon'};
createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return;}const info=await stat(path).catch(()=>null);const file=info?.isFile()?path:resolve(root,'index.html');res.setHeader('Content-Type',mime[extname(file)]??'application/octet-stream');res.setHeader('Cache-Control',file.endsWith('sw.js')?'no-cache':'no-store');res.end(await readFile(file));}catch{res.writeHead(500).end();}}).listen(Number(process.env.WEB_PORT??8081),'127.0.0.1',()=>console.log('Axon web preview: http://localhost:8081'));
