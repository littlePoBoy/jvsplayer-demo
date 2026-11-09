<script setup>
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import Hls from 'hls.js'
import PlayerShell from '../components/PlayerShell.vue'
import InfoPanel from '../components/InfoPanel.vue'
import StreamSourceBar from '../components/StreamSourceBar.vue'
import { probeCapabilities } from '../utils/capability.js'
import { isAllowedStreamUrl } from '../utils/url.js'
import { formatVideoCodecName, formatAudioCodecName } from '../utils/format.js'

// HLS 主路径（方案 A）：hls.js 解封装 → MSE → <video>（Safari 走原生 HLS）。硬解优先，不做软解兜底。
const videoEl = useTemplateRef('videoEl')
const sourceBar = useTemplateRef('sourceBar')
const hasSourceUrl = ref(false)
const volume = ref(1)
const isMuted = ref(false)
const hasPlayer = ref(false)
const isPaused = ref(false)
const isFullscreen = ref(false)
const levelInfo = ref(null)
const playError = ref('') // 播放失败原因（hls.js 致命错误），空 = 无错误
const decodePath = ref('') // 'mse' | 'native' | ''（未播放）
const capRows = ref([])

let hls = null

// 视频信息（与各播放页统一口径）。音频采样率 hls.js 未暴露，显示 '-'。
const DECODE_PATH_LABELS = {
  mse: 'MSE（video标签）',
  native: '原生 HLS（video标签）',
}

const videoRows = computed(() => {
  const li = levelInfo.value
  return [
    { label: '视频编码', value: formatVideoCodecName(li?.videoCodec) },
    { label: '分辨率', value: li?.width ? `${li.width} × ${li.height}` : null },
    { label: '帧率', value: li?.frameRate ? `${Math.round(li.frameRate * 100) / 100} fps` : null },
    { label: '解码模式', value: DECODE_PATH_LABELS[decodePath.value] ?? null },
    { label: '音频编码', value: formatAudioCodecName(li?.audioCodec) },
    { label: '音频采样率', value: null },
    { label: '播放状态', value: playError.value || null },
  ]
})

function onManifestParsed(_event, data) {
  const first = (data.levels ?? [])[0] ?? {}
  levelInfo.value = {
    width: first.width ?? 0,
    height: first.height ?? 0,
    videoCodec: first.videoCodec ?? null,
    audioCodec: first.audioCodec ?? null,
    frameRate: first.frameRate ?? 0,
  }
}

// 失败时明确提示（不做软解兜底）：H.265 失败可换浏览器 / 切 H.264 / 看 HLS 对照页
function onHlsError(_event, data) {
  if (data.fatal) {
    playError.value = `${data.type}/${data.details}${data.reason ? `：${data.reason}` : ''}`
  }
}

function destroyPlayer() {
  if (hls) {
    hls.destroy()
    hls = null
  }
  if (videoEl.value) {
    videoEl.value.removeAttribute('src')
    videoEl.value.load()
  }
  hasPlayer.value = false
  isPaused.value = false
}

async function play() {
  // 直播地址可在 StreamSourceBar 获取或手动输入；点播（回放）取址待做
  const target = await sourceBar.value.ensureUrl()
  if (!target || !isAllowedStreamUrl(target)) {
    return
  }
  destroyPlayer()
  const video = videoEl.value
  levelInfo.value = null
  playError.value = ''
  decodePath.value = ''
  if (Hls.isSupported()) {
    decodePath.value = 'mse'
    const instance = new Hls({ enableWorker: true })
    instance.on(Hls.Events.MANIFEST_PARSED, onManifestParsed)
    instance.on(Hls.Events.ERROR, onHlsError)
    instance.loadSource(target)
    instance.attachMedia(video)
    hls = instance
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    decodePath.value = 'native'
    video.src = target
    video.addEventListener('loadedmetadata', () => video.play().catch(() => {}), { once: true })
    hasPlayer.value = true
    return
  } else {
    return
  }
  hasPlayer.value = true
  video.play().catch(() => {}) // 自动播放被浏览器拦截时静默，用户可点击播放按钮
  isPaused.value = false
}

function togglePause() {
  const video = videoEl.value
  if (!hasPlayer.value || !video) {
    return
  }
  if (isPaused.value) {
    video.play()
    isPaused.value = false
  } else {
    video.pause()
    isPaused.value = true
  }
}

function applyVolume() {
  // 拖动音量滑杆自动取消静音
  isMuted.value = false
  if (videoEl.value) {
    videoEl.value.muted = false
    videoEl.value.volume = Number(volume.value)
  }
}

function toggleMute() {
  isMuted.value = !isMuted.value
  if (videoEl.value) {
    videoEl.value.muted = isMuted.value
  }
}

function goFullscreen() {
  // 已全屏则退出；否则全屏 .stage（悬浮条的祖先）而不是 video，保证全屏内悬浮条仍可操作
  if (document.fullscreenElement) {
    document.exitFullscreen()
    return
  }
  videoEl.value?.parentElement?.requestFullscreen?.()
}

// 按钮文案跟随真实全屏状态（含用户按 Esc 退出）
function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

onMounted(async () => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
  capRows.value = await probeCapabilities()
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  destroyPlayer()
})
</script>

<template>
  <PlayerShell>
    <template #top>
      <StreamSourceBar ref="sourceBar" v-model:has-url="hasSourceUrl" protocol-type="hls" @play="play" />
      <button class="btn btn-primary" type="button" :disabled="!hasSourceUrl" @click="play">播放</button>
      <button class="btn" type="button" :disabled="!hasPlayer" @click="destroyPlayer">停止</button>
    </template>

    <template #stage>
      <video ref="videoEl"></video>
    </template>

    <template #overlay>
      <!-- hls.js 无截图/录像能力，不渲染对应按钮 -->
      <button class="btn" type="button" :disabled="!hasPlayer && !hasSourceUrl" @click="togglePause">
        {{ isPaused ? '播放' : '暂停' }}
      </button>
      <button class="btn" type="button" @click="toggleMute">
        {{ isMuted ? '取消静音' : '静音' }}
      </button>
      <span class="field-label">音量</span>
      <input v-model.number="volume" type="range" min="0" max="1" step="0.01" @input="applyVolume" />
      <button class="btn" type="button" :disabled="!hasPlayer" @click="goFullscreen">
        {{ isFullscreen ? '退出全屏' : '全屏' }}
      </button>
    </template>

    <template #info>
      <InfoPanel title="视频信息" :rows="videoRows" />
      <InfoPanel title="浏览器 / 解码能力" :rows="capRows" />
    </template>
  </PlayerShell>
</template>
