self.addEventListener('fetch', (event) => {
    // Leave cross-origin requests (ads, CDNs) to the browser so the worker never gets in their way
    if (new URL(event.request.url).origin !== self.location.origin) return;
    event.respondWith(fetch(event.request));
});
