/** 展示格式化工具（纯函数） */

export function formatDateTime(unixSeconds) {
  if (unixSeconds === null || unixSeconds === undefined || Number.isNaN(Number(unixSeconds))) {
    return '-'
  }
  const date = new Date(Number(unixSeconds) * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

export function formatDuration(seconds) {
  const sec = Math.floor(Number(seconds))
  if (!Number.isFinite(sec) || sec < 0) {
    return '-'
  }
  const pad = (n) => String(n).padStart(2, '0')
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export function formatBytes(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n < 0) {
    return '-'
  }
  const units = ['B', 'KB', 'MB', 'GB']
  let value = n
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
