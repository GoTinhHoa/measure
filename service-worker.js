importScripts('version.js');
const CACHE_NAME = "wood-measure-" + APP_VERSION;

const urlsToCache = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./version.js",
    // Bộ giọng đọc số (14 mẩu, ~168KB) — cache để đọc được cả khi kho mất sóng
    "./voice/khong.mp3", "./voice/mot.mp3", "./voice/hai.mp3", "./voice/ba.mp3",
    "./voice/bon.mp3", "./voice/nam.mp3", "./voice/sau.mp3", "./voice/bay.mp3",
    "./voice/tam.mp3", "./voice/chin.mp3", "./voice/muoi.mp3", "./voice/muoi2.mp3",
    "./voice/mot2.mp3", "./voice/phay.mp3"
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
