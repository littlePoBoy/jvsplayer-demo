<script setup>
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import Hls from 'hls.js'
import PlayerShell from '../components/PlayerShell.vue'
import InfoPanel from '../components/InfoPanel.vue'
import { probeCapabilities } from '../utils/capability.js'
import { isAllowedStreamUrl } from '../utils/url.js'

// HLS 主路径（方案 A）：hls.js 解封装 → MSE → <video>（Safari 走原生 HLS）。硬解优先，不做软解兜底。
const videoEl = useTemplateRef('videoEl')
const url = ref('')
const volume = ref(1)
const hasPlayer = ref(false)
const isPaused = ref(false)
const status = ref({ text: '未播放', kind: '' })
const levelInfo = ref(null)
const capRows = ref([])

let hls = null

function setStatus(text, kind = '') {
  status.value = { text, kind }
}

const videoRows = computed(() => {
  const li = levelInfo.value
  return [
    { label: '分辨率', value: li ? `${li.width}×${li.height}` : '-' },
    { label: '视频编码', value: li?.videoCodec ?? '-' },
    { label: '音频编码', value: li?.audioCodec ?? '-' },
    { label: '码率', value: li?.bitrate ? `${Math.round(li.bitrate / 1000)} kbps` : '-' },
    { label: '清晰度档位', value: li ? `${li.levelCount} 档` : '-' },
    { label: '当前档位', value: li ? `#${li.currentLevel}` : '-' },
    { label: '播放状态', value: status.value.text },
  ]
})

function onManifestParsed(_event, data) {
  const levels = data.levels ?? []
  const first = levels[0] ?? {}
  levelInfo.value = {
    width: first.width ?? 0,
    height: first.height ?? 0,
    videoCodec: first.videoCodec ?? '-',
    audioCodec: first.audioCodec ?? '-',
    bitrate: first.bitrate ?? 0,
    levelCount: levels.length,
    currentLevel: 0,
  }
}

function onLevelSwitched(_event, data) {
  if (levelInfo.value) {
    levelInfo.value = { ...levelInfo.value, currentLevel: data.level }
  }
}

function onError(_event, data) {
  if (!data.fatal) {
    return
  }
  const hint = '若为 H.265/HEVC，可换 Chrome/Edge、改推 H.264，或看「HLS 对照」页（h265web.js 软解）。'
  if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
    setStatus(`网络错误：${data.details}。请检查地址与跨域（CORS）配置。${hint}`, 'is-error')
  } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
    setStatus(`媒体/解码错误：${data.details}。${hint}`, 'is-error')
  } else {
    setStatus(`播放失败：${data.details}。${hint}`, 'is-error')
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

function play() {
  const target = url.value.trim()
  if (!isAllowedStreamUrl(target)) {
    setStatus('播放地址无效：仅支持 http(s)/ws(s) 协议。', 'is-error')
    return
  }
  destroyPlayer()
  const video = videoEl.value
  levelInfo.value = null
  if (Hls.isSupported()) {
    const instance = new Hls({ enableWorker: true })
    instance.on(Hls.Events.MANIFEST_PARSED, onManifestParsed)
    instance.on(Hls.Events.LEVEL_SWITCHED, onLevelSwitched)
    instance.on(Hls.Events.ERROR, onError)
    instance.loadSource(target)
    instance.attachMedia(video)
    hls = instance
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = target
    video.addEventListener('loadedmetadata', () => video.play().catch(() => {}), { once: true })
    setStatus('使用浏览器原生 HLS 播放（如 Safari）', 'is-ok')
    hasPlayer.value = true
    return
  } else {
    setStatus('当前浏览器不支持 HLS（无 MSE 且无原生支持）。', 'is-error')
    return
  }
  hasPlayer.value = true
  video.play().catch((err) => {
    setStatus(`自动播放被浏览器拦截，请点击播放按钮：${err?.message ?? err}`, 'is-error')
  })
  isPaused.value = false
  setStatus('播放中…', 'is-ok')
}

function togglePause() {
  const video = videoEl.value
  if (!hasPlayer.value || !video) {
    return
  }
  if (isPaused.value) {
    video.play()
    isPaused.value = false
    setStatus('播放中…', 'is-ok')
  } else {
    video.pause()
    isPaused.value = true
    setStatus('已暂停', '')
  }
}

function applyVolume() {
  if (videoEl.value) {
    videoEl.value.volume = Number(volume.value)
  }
}

function goFullscreen() {
  videoEl.value?.requestFullscreen?.()
}

onMounted(async () => {
  capRows.value = await probeCapabilities()
})

onUnmounted(destroyPlayer)
</script>

<template>
  <PlayerShell>
    <template #top>
      <input
        v-model="url"
        class="input url-input"
        type="text"
        placeholder="粘贴 HLS 播放地址（.m3u8）"
        @keyup.enter="play"
      />
      <button class="btn btn-primary" type="button" @click="play">播放</button>
      <button class="btn" type="button" :disabled="!hasPlayer" @click="destroyPlayer">停止</button>
    </template>

    <template #stage>
      <video ref="videoEl"></video>
    </template>

    <template #controls>
      <div class="control-bar">
        <button class="btn" type="button" :disabled="!hasPlayer" @click="togglePause">
          {{ isPaused ? '播放' : '暂停' }}
        </button>
        <span class="field-label">音量</span>
        <input v-model.number="volume" type="range" min="0" max="1" step="0.01" @input="applyVolume" />
        <button class="btn" type="button" :disabled="!hasPlayer" @click="goFullscreen">全屏</button>
      </div>
    </template>

    <template #status>
      <span :class="status.kind">{{ status.text }}</span>
    </template>

    <template #info>
      <InfoPanel title="视频信息" :rows="videoRows" />
      <InfoPanel title="浏览器 / 解码能力" :rows="capRows" />
    </template>
  </PlayerShell>
</template>
