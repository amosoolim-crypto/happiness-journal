/* ═══════════════════════════════════════════════════════════════
   행복일지 — Service Worker  (sw.js)
   GitHub Pages / https:// 배포용
   ─────────────────────────────────────────────────────────────
   ★ CACHE_VERSION을 수동으로 올릴 필요 없습니다.
     index.html을 GitHub에 올릴 때마다 파일 크기+날짜로
     자동 버전이 계산되어 캐시가 갱신됩니다.
   ═══════════════════════════════════════════════════════════════ */

/* ── 자동 버전: index.html의 Last-Modified + Content-Length ── */
async function getAutoVersion() {
  try {
    const res = await fetch('./index.html', { method: 'HEAD', cache: 'no-store' });
    const modified = res.headers.get('last-modified') || '';
    const size     = res.headers.get('content-length') || '';
    /* 날짜+크기 조합 → 짧은 해시 */
    const raw = modified + '|' + size;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
    }
    return 'hj-auto-' + Math.abs(hash).toString(36);
  } catch (_) {
    /* 네트워크 실패 시 날짜 기반 폴백 */
    return 'hj-' + new Date().toISOString().slice(0, 10);
  }
}

const STATIC_URLS = [
  './',
  './index.html',
];

/* ── 설치 ────────────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    getAutoVersion().then(ver =>
      caches.open(ver).then(cache => cache.addAll(STATIC_URLS))
    ).then(() => self.skipWaiting())
  );
});

/* ── 활성화: 이전 캐시 자동 삭제 ───────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    getAutoVersion().then(currentVer =>
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(k => k !== currentVer)
            .map(k => caches.delete(k))
        )
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: Cache-First ──────────────────────────────────────── */
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
          getAutoVersion().then(ver =>
            caches.open(ver).then(cache => cache.put(event.request, toCache))
          );
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
    body:     data.body  || '기록할 시간입니다 🙏',
    icon:     './icon-192.png',
    badge:    './icon-72.png',
    tag:      data.tag   || 'hj-alarm',
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
