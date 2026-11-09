/**
 * 浏览器 / 解码能力探测（方案 §4：播放前探测，结果展示在右侧信息栏）。
 * 返回 [{ label, value }] 行数组，供 InfoPanel 展示。
 */

const HEVC_CODEC_CANDIDATES = [
  'hvc1.1.6.L93.B0',
  'hev1.1.6.L93.B0',
  'hvc1.2.4.L120.B0',
]

const HEVC_MP4_CANDIDATES = HEVC_CODEC_CANDIDATES.map((codec) => `video/mp4; codecs="${codec}"`)

function detectBrowser() {
  const ua = navigator.userAgent
  const rules = [
    ['Edge', /Edg\/(\d+)/],
    ['Chrome', /Chrome\/(\d+)/],
    ['Firefox', /Firefox\/(\d+)/],
    ['Safari', /Version\/(\d+)/],
  ]
  for (const [name, re] of rules) {
    const matched = ua.match(re)
    if (matched) {
      return `${name} ${matched[1]}`
    }
  }
  return '未知浏览器'
}

function isMseSupported() {
  return typeof window.MediaSource !== 'undefined' || typeof window.ManagedMediaSource !== 'undefined'
}

function isMseTypeSupported(mime) {
  if (typeof window.MediaSource === 'undefined' || !MediaSource.isTypeSupported) {
    return false
  }
  return MediaSource.isTypeSupported(mime)
}

async function isWebCodecsConfigSupported(codec) {
  if (typeof window.VideoDecoder === 'undefined' || !VideoDecoder.isConfigSupported) {
    return false
  }
  try {
    const result = await VideoDecoder.isConfigSupported({
      codec,
      codedWidth: 1920,
      codedHeight: 1080,
    })
    return Boolean(result.supported)
  } catch {
    return false
  }
}

export async function probeCapabilities() {
  const mse = isMseSupported()
  const mseHevc = HEVC_MP4_CANDIDATES.some(isMseTypeSupported)
  const webCodecs = typeof window.VideoDecoder !== 'undefined'
  const [wcH264, wcHevcHits] = await Promise.all([
    isWebCodecsConfigSupported('avc1.64001f'),
    Promise.all(HEVC_CODEC_CANDIDATES.map(isWebCodecsConfigSupported)),
  ])
  const wcHevc = wcHevcHits.some(Boolean)
  const nativeHls = document.createElement('video').canPlayType('application/vnd.apple.mpegurl')
  const toSupport = (ok) => (ok ? '支持' : '不支持')

  return [
    { label: '浏览器', value: detectBrowser() },
    { label: 'MSE', value: toSupport(mse) },
    { label: 'MSE H.264', value: toSupport(isMseTypeSupported('video/mp4; codecs="avc1.64001f"')) },
    { label: 'MSE H.265', value: toSupport(mseHevc) },
    { label: 'WebCodecs', value: toSupport(webCodecs) },
    { label: 'WebCodecs H.264', value: toSupport(wcH264) },
    { label: 'WebCodecs H.265', value: toSupport(wcHevc) },
    { label: '原生 HLS（Safari）', value: nativeHls ? '支持' : '不支持' },
    { label: 'WebAssembly', value: toSupport(typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function') },
    { label: 'User-Agent', value: navigator.userAgent },
  ]
}
