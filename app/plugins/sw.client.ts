// 注册 Service Worker（仅生产构建），使应用可安装、可离线练习。
export default defineNuxtPlugin(() => {
  if (import.meta.dev) return
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    const baseUrl = useRuntimeConfig().app.baseURL ?? '/'
    navigator.serviceWorker.register(`${baseUrl}sw.js`).catch(() => {
      // 注册失败不影响应用功能
    })
  })
})
