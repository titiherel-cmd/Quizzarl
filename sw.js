const CACHE_NAME = 'blindtest-cache-v1';
// Liste des fichiers de base à sauvegarder sur le téléphone
const urlsToCache = [
    './',
    './index.html',
    './app.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// 1. Lors de l'installation, on met les fichiers en cache
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Fichiers mis en cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// 2. Nettoyage des anciens caches lors des mises à jour
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Ancien cache supprimé');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// 3. Interception des requêtes web
self.addEventListener('fetch', event => {
    // On ne met PAS en cache les requêtes vers les serveurs externes (Firebase, YouTube)
    // pour garantir que le temps réel fonctionne parfaitement.
    if (event.request.url.includes('firebaseio.com') || 
        event.request.url.includes('googleapis.com') || 
        event.request.url.includes('youtube.com')) {
        return;
    }

    // Pour les fichiers locaux (HTML, JS, images), on regarde s'ils sont en cache d'abord
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // S'il est en cache, on le sert. Sinon, on le télécharge normalement.
                return response || fetch(event.request);
            })
    );
});
