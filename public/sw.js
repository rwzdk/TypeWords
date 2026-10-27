// TypeWords 极简 Service Worker：可安装 + 离线兜底。
// 策略：
//  - 页面导航（request.mode === 'navigate'）：network-first，失败回落缓存的 '/'
//  - 同源静态资源（_nuxt 带内容 hash、dicts 数据、图标音效）：stale-while-revalidate
//  - 其余（第三方 API 等）：直连，不缓存
const CACHE = 'typewords-v1'

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(['/', '/manifest.webmanifest', '/icons/icon.svg'])),
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

function isSameOriginAsset(url) {
  return url.origin === self.location.origin && /\/(_nuxt|dicts|list|sound|imgs|icons|libs)\//.test(url.pathname)
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET') return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const copy = res.clone()
          caches.open(CACHE).then(cache => cache.put('/', copy))
          return res
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  if (isSameOriginAsset(url)) {
    event.respondWith(
      caches.open(CACHE).then(async cache => {
        const cached = await cache.match(event.request)
        const network = fetch(event.request)
          .then(res => {
            if (res.ok) cache.put(event.request, res.clone())
            return res
          })
          .catch(() => cached)
        return cached || network
      }),
    )
  }
})
