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

/**
 * 编码名展示归一（视频信息栏口径：H264 / H265 / G711A / G711U / AAC）。
 * 兼容各家取值形态：mpegts.js / hls.js 的 codec 字符串（avc1.*、hvc1.*、mp4a.*）
 * 与 h265web.js 的编码常量（264 / 265 / 112 / 500）。未知返回 null（InfoPanel 显示 '-'）。
 */
export function formatVideoCodecName(raw) {
  if (raw === null || raw === undefined || raw === '' || raw === -1 || raw === 500) {
    return null
  }
  const text = String(raw).toLowerCase()
  if (text === 'unknown' || text === 'none') {
    return null
  }
  if (text.includes('265') || text.includes('hvc') || text.includes('hev')) {
    return 'H265'
  }
  if (text.includes('264') || text.includes('avc')) {
    return 'H264'
  }
  return String(raw)
}

export function formatAudioCodecName(raw) {
  if (raw === null || raw === undefined || raw === '' || raw === -1 || raw === 500) {
    return null
  }
  const text = String(raw).toLowerCase()
  if (text === 'unknown' || text === 'none') {
    return null
  }
  if (text.includes('g711a') || text === 'pcma') {
    return 'G711A'
  }
  if (text.includes('g711u') || text === 'pcmu') {
    return 'G711U'
  }
  if (text.includes('g711')) {
    return 'G711'
  }
  if (text.includes('aac') || text.includes('mp4a') || raw === 112) {
    return 'AAC'
  }
  return String(raw)
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
