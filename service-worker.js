importScripts('version.js');
const CACHE_NAME = "wood-measure-" + APP_VERSION;

const urlsToCache = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./version.js"
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
// CHỈ xử lý GET file tĩnh (app + thư viện CDN). Request lên Supabase đi thẳng mạng, không qua SW:
// trước đây SW chặn cả lệnh ghi phiếu đo + cache mọi kết quả đọc Supabase (phình bộ nhớ, thêm 1 chỗ lỗi)
self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") return;
    if (new URL(event.request.url).hostname.endsWith("supabase.co")) return;
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
