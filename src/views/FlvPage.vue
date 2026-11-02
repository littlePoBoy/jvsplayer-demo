<script setup>
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import mpegts from 'mpegts.js'
import PlayerShell from '../components/PlayerShell.vue'
import InfoPanel from '../components/InfoPanel.vue'
import { probeCapabilities } from '../utils/capability.js'
import { isAllowedStreamUrl } from '../utils/url.js'

// FLV 主路径（方案 A）：mpegts.js 解封装 → MSE → <video>。硬解优先，不做软解兜底。
const videoEl = useTemplateRef('videoEl')
const url = ref('')
const isLive = ref(true)
const volume = ref(1)
const hasPlayer = ref(false)
const isPaused = ref(false)
const status = ref({ text: '未播放', kind: '' })
const mediaInfo = ref(null)
const stats = ref(null)
const capRows = ref([])

let player = null

function setStatus(text, kind = '') {
  status.value = { text, kind }
}

const urlRows = computed(() => [
  { label: '播放地址', value: url.value || '（未填写）', copy: true },
  { label: '流类型', value: isLive.value ? '直播（isLive=true）' : '点播（isLive=false）' },
])

const videoRows = computed(() => {
  const mi = mediaInfo.value
  const st = stats.value
  return [
    { label: '分辨率', value: mi ? `${mi.width}×${mi.height}` : '-' },
    { label: '视频编码', value: mi?.videocodec ?? '-' },
    { label: '音频编码', value: mi?.hasAudio ? (mi.audiocodec ?? '有') : '无音频' },
    { label: '帧率', value: mi?.fps ? `${mi.fps} fps` : '-' },
    { label: '已解码帧', value: st ? String(st.decodedFrames ?? '-') : '-' },
    { label: '丢帧', value: st ? String(st.droppedFrames ?? '-') : '-' },
    { label: '接收速率', value: st?.speed ? `${st.speed} KB/s` : '-' },
    { label: '播放状态', value: status.value.text },
  ]
})

function onMediaInfo(mi) {
  mediaInfo.value = { ...mi }
  const isHevc = /hev|hvc/i.test(mi.videocodec || '')
  const mseHevcOk = capRows.value.some((row) => row.label === 'MSE H.265' && row.value === '支持')
  if (isHevc && !mseHevcOk) {
    setStatus('视频为 H.265，但当前浏览器 MSE 不支持 HEVC 硬解。可换 Chrome/Edge、改推 H.264，或看「FLV 对照」页（h265web.js 软解）。', 'is-error')
  }
}

function onStatistics(next) {
  stats.value = { ...next }
}

function onError(errorType, errorDetail, errorInfo) {
  const detail = errorInfo?.info ? ` / ${errorInfo.info}` : ''
  setStatus(`播放失败：${errorType} / ${errorDetail}${detail}。若为 H.265/HEVC，可换 Chrome/Edge、改推 H.264，或看「FLV 对照」页（h265web.js 软解）。`, 'is-error')
}

function destroyPlayer() {
  if (player) {
    player.pause()
    player.destroy()
    player = null
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
  if (!mpegts.isSupported()) {
    setStatus('当前浏览器不支持 MSE，无法播放 FLV。', 'is-error')
    return
  }
  destroyPlayer()
  const instance = mpegts.createPlayer({ type: 'flv', isLive: isLive.value, url: target }, { enableWorker: true })
  instance.attachMediaElement(videoEl.value)
  instance.on(mpegts.Events.MEDIA_INFO, onMediaInfo)
  instance.on(mpegts.Events.STATISTICS_INFO, onStatistics)
  instance.on(mpegts.Events.ERROR, onError)
  player = instance
  hasPlayer.value = true
  instance.load()
  instance.play().catch((err) => {
    setStatus(`自动播放被浏览器拦截，请点击播放按钮：${err?.message ?? err}`, 'is-error')
  })
  mediaInfo.value = null
  stats.value = null
  isPaused.value = false
  setStatus('播放中…', 'is-ok')
}

function togglePause() {
  if (!player) {
    return
  }
  if (isPaused.value) {
    player.play()
    isPaused.value = false
    setStatus('播放中…', 'is-ok')
  } else {
    player.pause()
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
        placeholder="粘贴 HTTP-FLV / WS-FLV 播放地址"
        @keyup.enter="play"
      />
      <label class="checkbox-label">
        <input v-model="isLive" type="checkbox" />
        直播流
      </label>
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
      <InfoPanel title="播放地址" :rows="urlRows" />
      <InfoPanel title="视频信息" :rows="videoRows" />
      <InfoPanel title="浏览器 / 解码能力" :rows="capRows" />
    </template>
  </PlayerShell>
</template>
