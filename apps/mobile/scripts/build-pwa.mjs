import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const dir=new URL('../dist/',import.meta.url);
async function files(path=''){const entries=await readdir(new URL(path,dir),{withFileTypes:true});const lists=await Promise.all(entries.map(e=>e.isDirectory()?files(`${path}${e.name}/`):[`${path}${e.name}`]));return lists.flat();}
let html=await readFile(new URL('index.html',dir),'utf8');
html=html.replace(/<title>.*?<\/title>/,'<title>Axon Fitness · Strength journal</title>').replace('</head>','<meta name="theme-color" content="#0b1210"><meta name="description" content="Axon strength training journal. Plan sessions, log sets, and track progress offline."><link rel="manifest" href="/manifest.json"></head>');
html=html.replace('</body>','<script>if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));}</script></body>');
await writeFile(new URL('index.html',dir),html);
const assets=(await files()).filter(f=>!['sw.js'].includes(f));
const version=createHash('sha256').update(assets.join('|')+html).digest('hex').slice(0,16);
await writeFile(new URL('sw.js',dir),`const CACHE='axon-${version}';const ASSETS=${JSON.stringify(assets.map(f=>'/'+f))};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('axon-')&&key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('/index.html')));return;}
 if(ASSETS.includes(url.pathname))event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});`);
console.log(`PWA built: ${assets.length} cached assets (${version})`);
