const CACHE='pay-work-shell-v30';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon.svg','./auth.js','./account.js','./preferences.js','./sync.js','./supabase-config.js','./telegram-mini-app.js','./telegram-mini-app.css','./paywork-chat.css','./telegram-entry.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(fetch(event.request).then(response=>{if(response.ok&&new URL(event.request.url).origin===location.origin){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response}).catch(()=>caches.match(event.request).then(response=>response||caches.match('./index.html'))))});
