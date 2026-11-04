<script setup>
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import mpegts from 'mpegts.js'
import PlayerShell from '../components/PlayerShell.vue'
import InfoPanel from '../components/InfoPanel.vue'
import { probeCapabilities } from '../utils/capability.js'
import { isAllowedStreamUrl } from '../utils/url.js'
import { formatVideoCodecName, formatAudioCodecName } from '../utils/format.js'

// FLV 主路径（方案 A）：mpegts.js 解封装 → MSE → <video>。硬解优先，不做软解兜底。
const videoEl = useTemplateRef('videoEl')
const url = ref('https://mister-ben.github.io/videojs-flvjs/bbb.flv')
const isLive = ref(true)
const volume = ref(1)
const isMuted = ref(false)
const hasPlayer = ref(false)
const isPaused = ref(false)
const mediaInfo = ref(null)
const capRows = ref([])

let player = null

// 视频信息（与各播放页统一口径）：mpegts.js 仅走 MSE→<video>，解码模式固定为硬解
const videoRows = computed(() => {
  const mi = mediaInfo.value
  return [
    { label: '视频编码', value: formatVideoCodecName(mi?.videoCodec) },
    { label: '分辨率', value: mi?.width ? `${mi.width} × ${mi.height}` : null },
    { label: '帧率', value: mi?.fps ? `${Math.round(mi.fps * 100) / 100} fps` : null },
    { label: '解码模式', value: 'MSE（video标签）' },
    { label: '音频编码', value: mi?.hasAudio ? formatAudioCodecName(mi?.audioCodec) : '无音频' },
    { label: '音频采样率', value: mi?.audioSampleRate ? `${mi.audioSampleRate} Hz` : null },
  ]
})

function onMediaInfo(mi) {
  mediaInfo.value = { ...mi }
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
    return
  }
  if (!mpegts.isSupported()) {
    return
  }
  destroyPlayer()
  const instance = mpegts.createPlayer({ type: 'flv', isLive: isLive.value, url: target }, { enableWorker: true })
  instance.attachMediaElement(videoEl.value)
  instance.on(mpegts.Events.MEDIA_INFO, onMediaInfo)
  player = instance
  hasPlayer.value = true
  instance.load()
  instance.play().catch(() => {}) // 自动播放被浏览器拦截时静默，用户可点击播放按钮
  mediaInfo.value = null
  isPaused.value = false
}

function togglePause() {
  if (!player) {
    return
  }
  if (isPaused.value) {
    player.play()
    isPaused.value = false
  } else {
    player.pause()
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
  // 全屏 .stage（悬浮条的祖先）而不是 video，保证全屏内悬浮条仍可操作
  videoEl.value?.parentElement?.requestFullscreen?.()
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

    <template #overlay>
      <!-- mpegts.js 无截图/录像能力，不渲染对应按钮 -->
      <button class="btn" type="button" :disabled="!hasPlayer" @click="togglePause">
        {{ isPaused ? '播放' : '暂停' }}
      </button>
      <button class="btn" type="button" @click="toggleMute">
        {{ isMuted ? '取消静音' : '静音' }}
      </button>
      <span class="field-label">音量</span>
      <input v-model.number="volume" type="range" min="0" max="1" step="0.01" @input="applyVolume" />
      <button class="btn" type="button" :disabled="!hasPlayer" @click="goFullscreen">全屏</button>
    </template>

    <template #info>
      <InfoPanel title="视频信息" :rows="videoRows" />
      <InfoPanel title="浏览器 / 解码能力" :rows="capRows" />
    </template>
  </PlayerShell>
</template>
