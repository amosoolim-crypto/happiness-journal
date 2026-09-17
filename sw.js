/* ═══════════════════════════════════════════════════════════════
   행복일지 — Service Worker  (sw.js)
   GitHub Pages / https:// 배포용
   ─────────────────────────────────────────────────────────────
   전략: Cache-First (오프라인 우선)
   · 앱 셸(index.html)을 캐시 → 오프라인에서도 완전 실행
   · localStorage 데이터는 브라우저가 직접 관리하므로 SW 불개입
   · 새 버전 배포 시 CACHE_VERSION만 올리면 자동 갱신
   ═══════════════════════════════════════════════════════════════ */

const CACHE_VERSION = 'hj-v1';
const CACHE_NAME    = `happiness-journal-${CACHE_VERSION}`;

/* 캐시할 파일 목록 */
const PRECACHE_URLS = [
  './',
  './index.html',
];

/* ── 설치: 앱 셸 사전 캐시 ──────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

/* ── 활성화: 이전 버전 캐시 삭제 ────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: Cache-First 전략 ─────────────────────────────────── */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const toCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
          return response;
        })
        .catch(() => {
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
    })
  );
});

/* ── Push 알림 수신 ─────────────────────────────────────────── */
self.addEventListener('push', event => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch(_) { data = { title:'행복일지', body: event.data.text() }; }

  const title   = data.title || '행복일지';
  const options = {
    body:     data.body    || '기록할 시간입니다 🙏',
    icon:     data.icon    || './icon-192.png',
    badge:    data.badge   || './icon-72.png',
    tag:      data.tag     || 'hj-alarm',
    renotify: true,
    vibrate:  [200, 100, 200],
    data:     { url: data.url || './' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* ── 알림 클릭 → 앱 열기 ────────────────────────────────────── */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('happiness-journal') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});
