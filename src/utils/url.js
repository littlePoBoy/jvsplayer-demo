/** 播放地址校验：Demo 只接受流媒体常用协议，防 javascript: 等注入面。 */

const ALLOWED_SCHEMES = ['http:', 'https:', 'ws:', 'wss:']

export function isAllowedStreamUrl(rawUrl) {
  try {
    return ALLOWED_SCHEMES.includes(new URL(String(rawUrl).trim()).protocol)
  } catch {
    return false
  }
}
