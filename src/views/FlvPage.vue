<script setup>
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import mpegts from 'mpegts.js'
import PlayerShell from '../components/PlayerShell.vue'
import InfoPanel from '../components/InfoPanel.vue'
import StreamSourceBar from '../components/StreamSourceBar.vue'
import { probeCapabilities } from '../utils/capability.js'
import { isAllowedStreamUrl } from '../utils/url.js'
import { formatVideoCodecName, formatAudioCodecName, formatDuration } from '../utils/format.js'

// FLV 主路径（方案 A）：mpegts.js 解封装 → MSE → <video>。硬解优先，不做软解兜底。
const videoEl = useTemplateRef('videoEl')
const sourceBar = useTemplateRef('sourceBar')
const hasSourceUrl = ref(false)
const url = ref('https://mister-ben.github.io/videojs-flvjs/bbb.flv')
// 直播/回放选择：回放 = mpegts.js 非直播模式（isLive:false，支持暂停/倍速/跳播）
const MODE_OPTIONS = [
  { value: 'live', label: '直播' },
  { value: 'vod', label: '回放' },
]
// 回放倍速（<video> playbackRate 取值）
const SPEED_OPTIONS = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 4, label: '4' },
  { value: 8, label: '8' },
  { value: 0.5, label: '1/2' },
  { value: 0.25, label: '1/4' },
  { value: 0.125, label: '1/8' },
]
const streamMode = ref('live')
const volume = ref(1)
const isMuted = ref(false)
const hasPlayer = ref(false)
const isPaused = ref(false)
const playSpeed = ref(1)
const curTime = ref(0)
const duration = ref(0)
const mediaInfo = ref(null)
const playError = ref('') // 播放失败原因（mpegts.js ERROR 事件），空 = 无错误
const capRows = ref([])

let player = null

const isVod = computed(() => streamMode.value === 'vod')
const canPlay = computed(() => (isVod.value ? !!url.value.trim() : hasSourceUrl.value))

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
    { label: '播放状态', value: playError.value || null },
  ]
})

function onMediaInfo(mi) {
  mediaInfo.value = { ...mi }
}

// 失败时明确提示（不做软解兜底）：H.265 失败可换浏览器 / 切 H.264 / 看 FLV 对照页
function onPlayerError(errorType, errorDetail, errorInfo) {
  playError.value = `${errorType}/${errorDetail}${errorInfo?.msg ? `：${errorInfo.msg}` : ''}`
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

async function play() {
  // 直播地址可在 StreamSourceBar 获取或手动输入，回放用手动地址（回放取址待做）
  const target = isVod.value ? url.value.trim() : await sourceBar.value.ensureUrl()
  if (!target || !isAllowedStreamUrl(target)) {
    return
  }
  if (!mpegts.isSupported()) {
    return
  }
  destroyPlayer()
  const instance = mpegts.createPlayer({ type: 'flv', isLive: streamMode.value === 'live', url: target }, { enableWorker: true })
  instance.attachMediaElement(videoEl.value)
  instance.on(mpegts.Events.MEDIA_INFO, onMediaInfo)
  instance.on(mpegts.Events.ERROR, onPlayerError)
  player = instance
  hasPlayer.value = true
  instance.load()
  instance.play().catch(() => {}) // 自动播放被浏览器拦截时静默，用户可点击播放按钮
  mediaInfo.value = null
  playError.value = ''
  isPaused.value = false
  playSpeed.value = 1
  curTime.value = 0
  duration.value = 0
  videoEl.value.playbackRate = 1
}

function onModeChange() {
  // 直播/回放影响 createPlayer 的 isLive 参数，切换即重建
  destroyPlayer()
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

// ---------- 回放控制（<video> 能力：playbackRate 倍速、currentTime 跳播） ----------

function onSpeedChange() {
  if (videoEl.value) {
    videoEl.value.playbackRate = Number(playSpeed.value)
  }
}

function onSeekInput(event) {
  const target = Number(event.target.value)
  if (!Number.isFinite(target)) {
    return
  }
  curTime.value = target
  if (videoEl.value) {
    videoEl.value.currentTime = target
  }
}

function onDurationChange() {
  // 直播流 duration 为 Infinity/NaN，回放为有限秒数
  const d = Number(videoEl.value?.duration)
  duration.value = Number.isFinite(d) && d > 0 ? d : 0
}

function onTimeUpdate() {
  const t = Number(videoEl.value?.currentTime)
  if (Number.isFinite(t)) {
    curTime.value = t
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
      <select v-model="streamMode" class="select" @change="onModeChange">
        <option v-for="opt in MODE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <input
        v-show="isVod"
        v-model="url"
        class="input url-input"
        type="text"
        placeholder="粘贴 HTTP-FLV / WS-FLV 播放地址"
        @keyup.enter="play"
      />
      <StreamSourceBar
        v-show="!isVod"
        ref="sourceBar"
        v-model:has-url="hasSourceUrl"
        protocol-type="https_flv"
        @play="play"
      />
      <button class="btn btn-primary" type="button" :disabled="!canPlay" @click="play">播放</button>
      <button class="btn" type="button" :disabled="!hasPlayer" @click="destroyPlayer">停止</button>
    </template>

    <template #stage>
      <video ref="videoEl" @durationchange="onDurationChange" @timeupdate="onTimeUpdate"></video>
    </template>

    <template #overlay>
      <!-- mpegts.js 无截图/录像能力，不渲染对应按钮 -->
      <template v-if="isVod">
        <button class="btn" type="button" :disabled="!hasPlayer" @click="togglePause">
          {{ isPaused ? '播放' : '暂停' }}
        </button>
        <span class="field-label">倍速</span>
        <select v-model.number="playSpeed" class="select" :disabled="!hasPlayer" @change="onSpeedChange">
          <option v-for="opt in SPEED_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <span class="field-label">跳播</span>
        <input
          type="range"
          min="0"
          :max="duration"
          step="0.1"
          :value="curTime"
          :disabled="!hasPlayer || duration <= 0"
          @input="onSeekInput"
        />
        <span class="field-label">{{ formatDuration(curTime) }} / {{ formatDuration(duration) }}</span>
        <button class="btn" type="button" @click="toggleMute">
          {{ isMuted ? '取消静音' : '静音' }}
        </button>
        <span class="field-label">音量</span>
        <input v-model.number="volume" type="range" min="0" max="1" step="0.01" @input="applyVolume" />
        <button class="btn" type="button" :disabled="!hasPlayer" @click="goFullscreen">全屏</button>
      </template>
      <template v-else>
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
    </template>

    <template #info>
      <InfoPanel title="视频信息" :rows="videoRows" />
      <InfoPanel title="浏览器 / 解码能力" :rows="capRows" />
    </template>
  </PlayerShell>
</template>
