/**
 * 按需加载外部全局脚本（JWebPlayer.bundle.js / h265web.js）。
 * 页面级隔离：哪个页面用哪个库就加载哪个，不预加载进全局入口。
 */

const loadedScripts = new Map()

export function loadScript(src) {
  if (loadedScripts.has(src)) {
    return loadedScripts.get(src)
  }
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loadedScripts.delete(src)
      reject(new Error(`脚本加载失败：${src}`))
    }
    document.head.appendChild(script)
  })
  loadedScripts.set(src, promise)
  return promise
}
