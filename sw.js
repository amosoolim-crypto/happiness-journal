// 행복일지 Service Worker
// 이 앱은 단일 HTML 파일이라 캐시할 것은 index.html 하나뿐입니다.
// 이 SW의 유일한 목적은 Chrome이 "설치 가능한 PWA"로 인식하도록
// fetch 이벤트를 처리하는 것입니다 (설치 기준 충족).
// 앱의 실제 데이터는 전부 localStorage에 저장되므로 SW 캐시와 무관하게 항상 보존됩니다.

const CACHE_NAME = 'happiness-journal-v3';
const APP_SHELL = ['./', './index.html'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // 캐시 우선, 실패하면 네트워크 (오프라인에서도 앱이 항상 열리도록)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).catch(() => caches.match('./index.html'));
    })
  );
});
