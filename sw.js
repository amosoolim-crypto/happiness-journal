/* ═══════════════════════════════════════════════════════════════
   행복일지 — Service Worker  (sw.js)
   GitHub Pages / https:// 배포용
   ─────────────────────────────────────────────────────────────
   ★ CACHE_VERSION을 수동으로 올릴 필요 없습니다.
     index.html을 GitHub에 올릴 때마다 파일 크기+날짜로
     자동 버전이 계산되어 캐시가 갱신됩니다.
   ═══════════════════════════════════════════════════════════════ */

const FALLBACK_VERSION = 'hj-20261124-0930';
const CORE_URLS  = ['./', './index.html'];                       /* 반드시 필요한 파일 */
const EXTRA_URLS = ['./manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png']; /* 있으면 저장 (없어도 설치 실패 안 함) */

/* ── 자동 버전: index.html의 Last-Modified + Content-Length ──
   요청마다 HEAD를 보내지 않도록 60초 동안 결과를 재사용한다. */
let _verCache = null;
let _verAt = 0;
async function getAutoVersion() {
  if (_verCache && Date.now() - _verAt < 60000) return _verCache;
  try {
    const res = await fetch('./index.html', { method: 'HEAD', cache: 'no-store' });
    const modified = res.headers.get('last-modified') || '';
    const size     = res.headers.get('content-length') || '';
    const raw = modified + '|' + size;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
    }
    _verCache = (raw === '|') ? FALLBACK_VERSION : 'hj-auto-' + Math.abs(hash).toString(36);
    _verAt = Date.now();
    return _verCache;
  } catch (_) {
    return _verCache || FALLBACK_VERSION;
  }
}

/* ── install ── */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const ver = await getAutoVersion();
    const cache = await caches.open(ver);
    await cache.addAll(CORE_URLS);
    await Promise.all(EXTRA_URLS.map((u) => cache.add(u).catch(() => {})));
  })());
  self.skipWaiting();
});

/* ── activate: 이전 캐시 삭제 + 즉시 제어 ── */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const currentVer = await getAutoVersion();
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== currentVer).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* ── fetch: 네트워크 우선, 실패 시 캐시 ── */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;     /* 같은 origin만 처리 */
  if (req.headers.has('range')) return;           /* 부분 응답(206)은 캐시하지 않음 */

  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        /* 응답은 즉시 돌려주고, 캐시 저장은 뒤에서 처리 */
        event.waitUntil((async () => {
          try {
            const cache = await caches.open(await getAutoVersion());
            await cache.put(req, copy);
          } catch (_) {}
        })());
      }
      return res;
    } catch (_) {
      const cached = await caches.match(req);
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const home = await caches.match('./index.html');
        if (home) return home;
      }
      return Response.error();                    /* undefined 대신 정상적인 오류 응답 */
    }
  })());
});

/* ── 푸시 알림 ── */
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (_) { data = { body: event.data ? event.data.text() : '' }; }
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
