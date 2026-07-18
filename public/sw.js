/* LiveKit Service Worker — PWA yüklenebilirlik + hafif offline yedeği.
 *
 * Tasarım kararı: NETWORK-FIRST. Sayfa gezinmelerinde her zaman ağ denenir,
 * yanıt yalnız offline yedeği olarak önbelleğe alınır. Böylece uygulama ASLA
 * bayat içerik sunmaz (çevrimiçiyken ağ kazanır); yalnız bağlantı yokken son
 * görülen kabuğa düşülür. API ve /widget istekleri hiç ellenmez.
 */

const CACHE = "livekit-shell-v2";

self.addEventListener("install", () => {
  // Yeni SW'yi hemen etkinleştir — bekleyen eski sürüm tutulmaz.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Eski sürüm önbelleklerini temizle.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Yalnız kendi origin'imizdeki GET sayfa gezinmelerini ele al.
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // API (SSE dahil) ve widget yüzeyleri asla önbelleğe alınmaz/kesilmez.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/widget/")) return;

  if (req.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        // Başarılı gezinmeyi offline yedeği olarak sakla.
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      } catch {
        // Çevrimdışı: önce tam eşleşme, yoksa başlangıç kabuğu.
        const cached = await caches.match(req);
        return cached || (await caches.match("/start")) || Response.error();
      }
    })(),
  );
});
