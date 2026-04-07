const CACHE_NAME = "wood-measure-v4";

const urlsToCache = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js"
];

// Cài đặt: cache các file cần thiết
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
    // Kích hoạt SW mới ngay, không chờ tab cũ đóng
    self.skipWaiting();
});

// Kích hoạt: xóa cache cũ
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            )
        )
    );
    // Áp dụng SW mới cho tất cả tab đang mở
    self.clients.claim();
});

// Fetch: network-first, fallback cache khi offline
self.addEventListener("fetch", event => {
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Lưu bản mới nhất vào cache
                let copy = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
