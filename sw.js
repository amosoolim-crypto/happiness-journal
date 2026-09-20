/* ═══════════════════════════════════════════════════════════════
   행복일지 — Service Worker  (sw.js)
   GitHub Pages / https:// 배포용
   ─────────────────────────────────────────────────────────────
   ★ CACHE_VERSION을 수동으로 올릴 필요 없습니다.
     index.html을 GitHub에 올릴 때마다 파일 크기+날짜로
     자동 버전이 계산되어 캐시가 갱신됩니다.
   ═══════════════════════════════════════════════════════════════ */

const FALLBACK_VERSION = 'hj-20260920-1957';
const STATIC_URLS = ['./', './index.html'];

/* ── 자동 버전: index.html의 Last-Modified + Content-Length ── */
async function getAutoVersion() {
  try {
    const res = await fetch('./index.html', { method: 'HEAD', cache: 'no-store' });
    const modified = res.headers.get('last-modified') || '';
    const size     = res.headers.get('content-length') || '';
    const raw = modified + '|' + size;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
    }
    const ver = 'hj-auto-' + Math.abs(hash).toString(36);
    console.log('[SW] 자동 버전:', ver, '(modified:', modified, 'size:', size + ')');
    return ver;
  } catch (_) {
    console.log('[SW] 버전 자동계산 실패, fallback:', FALLBACK_VERSION);
    return FALLBACK_VERSION;
  }
}

/* ── install ── */
self.addEventListener('install', (event) => {
  console.log('[SW] install');
  event.waitUntil(
    getAutoVersion().then(async (ver) => {
      const cache = await caches.open(ver);
      await cache.addAll(STATIC_URLS);
      console.log('[SW] 캐시 완료:', ver);
    })
  );
  self.skipWaiting();
});

/* ── activate: 이전 캐시 삭제 ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    getAutoVersion().then(async (currentVer) => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(k => k !== currentVer).map(k => {
          console.log('[SW] 이전 캐시 삭제:', k);
          return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

/* ── fetch: 네트워크 우선, 실패 시 캐시 ── */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  /* 같은 origin의 요청만 처리 */
  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(async (res) => {
        if (res.ok) {
          const ver = await getAutoVersion();
          const cache = await caches.open(ver);
          cache.put(event.request, res.clone());
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        /* 네비게이션 실패 → index.html 반환 */
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      })
  );
});

/* ── 푸시 알림 ── */
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || '행복일지', {
      body: data.body || '',
      icon: './icon-192.png',
      badge: './icon-192.png',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('./'));
});
